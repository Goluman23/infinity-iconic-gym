// POST /api/es/campaign-push — add a list of contacts to a named EasySocial API campaign.
// Body: { key, campaign: "festive video", contacts: [{ name, phone, tags?, segment? }], list?: "Society A",
//         exclude?: [phones], live?: true, confirm?: "<campaign id>", allowNoLedger?: true }
// Every call filters the list (lib/contacts.js rules for the campaign), skips anyone already sent this
// campaign or its excludeCampaigns (Campaign log tab), and returns a preview. It only sends when
// CAMPAIGN_LIVE=1 in Vercel AND the call says live:true with confirm = the campaign id. Up to 25 sends
// per call; "remaining" tells you to call again.
import { send, readBody, cors } from '../../lib/http.js';
import { easysocial } from '../../lib/providers/easysocial.js';
import { buildSendList } from '../../lib/contacts.js';
import { resolveCampaign, campaignOpen, CAMPAIGN_REGISTRY, PAST_BROADCASTS, derivedSpec } from '../../lib/campaign-registry.js';
import { normalizePhone } from '../../lib/rules.js';
import { sentTo, record } from '../../lib/campaign-ledger.js';

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
const BATCH = 25; // EasySocial's send API takes about 1–3 s per message; 25 fits well inside the 90 s limit
let pause = ms => new Promise(r => setTimeout(r, ms));
export function setPause(fn) { pause = fn; }

function keyOk(got) {
  const want = env('CAMPAIGN_PUSH_KEY'); got = String(got || '');
  if (!want || got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'Body must be JSON' }); }
  if (!keyOk(body.key)) return send(res, 401, { error: 'Missing or wrong key' });
  // Record recipients of an earlier one-off broadcast (PAST_BROADCASTS) so API campaigns skip them.
  if (body.recordPrevious) {
    const id = String(body.recordPrevious);
    if (!PAST_BROADCASTS[id]) return send(res, 404, { error: `Unknown past broadcast "${id}"`, known: Object.keys(PAST_BROADCASTS) });
    const phones = [...new Set((body.phones || []).map(normalizePhone).filter(Boolean))];
    const at = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    try { await record(phones.map(p => ({ 'Time (IST)': at, Campaign: id, Phone: p, 'First name': '', Source: '', List: PAST_BROADCASTS[id], Result: 'previous', Error: '' }))); }
    catch (e) { return send(res, 502, { error: e.message }); }
    return send(res, 200, { ok: true, recorded: phones.length, broadcast: id });
  }
  const c = resolveCampaign(body.campaign);
  if (!c) return send(res, 404, { error: `Unknown campaign "${body.campaign || ''}"`, campaigns: CAMPAIGN_REGISTRY.map(x => ({ id: x.id, name: x.name, aliases: x.aliases })) });
  if (!campaignOpen(c)) return send(res, 409, { error: `${c.name} ended on ${c.ends}` });
  const contacts = Array.isArray(body.contacts) ? body.contacts.slice(0, 20000) : [];
  if (!contacts.length) return send(res, 400, { error: 'contacts must be a non-empty array of {name, phone}' });

  const wantLive = body.live === true;
  let already = [], ledgerError = '';
  try { already = await sentTo([c.id, ...(c.excludeCampaigns || [])]); } catch (e) { ledgerError = e.message; }
  // allowNoLedger: true lets a first batch go out before the Campaign log tab exists; pass earlier batches in `exclude`.
  if (wantLive && ledgerError && body.allowNoLedger !== true) return send(res, 503, { error: `Cannot check who already got it (${ledgerError}) — nothing sent` });

  const { send: list, skipped } = buildSendList(contacts, c.rule, { exclude: [...already, ...(body.exclude || [])] });
  const reasons = skipped.reduce((m, s) => (m[s.reason] = (m[s.reason] || 0) + 1, m), {});
  const summary = { campaign: { id: c.id, name: c.name, template: c.template }, received: contacts.length, eligible: list.length, skipped: skipped.length, reasons, alreadyInLedger: already.length, ...(ledgerError ? { ledgerWarning: ledgerError } : {}) };

  const live = wantLive && env('CAMPAIGN_LIVE') === '1' && body.confirm === c.id;
  if (!live) {
    return send(res, 200, { ok: true, dryRun: true, ...summary, sample: list.slice(0, 5),
      why: !wantLive ? 'preview (live:true not set)' : env('CAMPAIGN_LIVE') !== '1' ? 'CAMPAIGN_LIVE is not 1 in Vercel' : `confirm must equal "${c.id}"` });
  }

  let campaigns = {}; try { campaigns = JSON.parse(env('ES_CAMPAIGNS', '{}')); } catch {}
  const spec = campaigns[c.id] || derivedSpec(c, campaigns);
  if (!spec) return send(res, 503, { error: `${c.name} is not wired to EasySocial yet (no ES_CAMPAIGNS entry, or es.campaignId/templateId empty) — nothing sent` });
  const extra = { spec, ...(c.bodyOverride ? { bodyOverride: c.bodyOverride } : {}) };
  const size = Math.max(1, Math.min(BATCH, Number(body.batch) || BATCH));
  const batch = list.slice(0, size), results = [];
  for (const p of batch) {
    try { await easysocial.sendFirstTouch(p.phone, c.id, { phone: p.phone, name: p.first_name, first: p.first_name, source: p.source }, extra); results.push({ ...p, result: 'sent' }); }
    catch (e) { results.push({ ...p, result: 'failed', error: e.message.slice(0, 200) }); }
    console.log(`[campaign] ${c.id} ${p.phone} ${results.at(-1).result}${results.at(-1).error ? ' ' + results.at(-1).error : ''}`);
    await pause(150);
  }
  const at = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  let logged = true;
  try { await record(results.map(r => ({ 'Time (IST)': at, Campaign: c.id, Phone: r.phone, 'First name': r.first_name, Source: r.source, List: String(body.list || '').slice(0, 60), Result: r.result, Error: r.error || '' }))); }
  catch (e) { logged = false; console.log('[campaign] ledger write failed', e.message); }
  const sent = results.filter(r => r.result === 'sent').length;
  return send(res, 200, { ok: true, live: true, ...summary, sent, failed: results.length - sent, remaining: list.length - batch.length, logged,
    sentPhones: results.filter(r => r.result === 'sent').map(r => r.phone),
    failures: results.filter(r => r.result === 'failed').slice(0, 20) });
}
