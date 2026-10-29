// GET|POST /api/es/webhook — EasySocial webhooks (lead_create / lead_update / lead_delete, WhatsApp messages).
// GET  : verification — echoes the challenge when verify_token matches ES_WEBHOOK_VERIFY_TOKEN.
// POST : checks x-hub-signature-256 (HMAC-SHA256 of the raw body with ES_WEBHOOK_SECRET), answers 200 fast,
//        and forwards a compact event to the lead sheet's Apps Script (SHEET_LOG_URL or FORWARD_WEBHOOK_URL).
import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { send } from '../../lib/http.js';

export const config = { api: { bodyParser: false } };

export function verifySignature(raw, header, secret) {
  if (!secret) return true;                    // no secret set → accept (set one before going live)
  if (!header) return false;
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const got = String(header).startsWith('sha256=') ? String(header) : 'sha256=' + header;
  return want.length === got.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

export function summarise(evt) {
  const out = [];
  const type = evt.event || evt.type || evt.object || 'unknown';
  // Meta-format WhatsApp message payload
  for (const e of evt.entry || []) for (const ch of e.changes || []) {
    const v = ch.value || {};
    for (const m of v.messages || []) out.push({ type: 'wa_message', from: m.from, kind: m.type, text: m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '', at: m.timestamp });
    for (const s of v.statuses || []) out.push({ type: 'wa_status', to: s.recipient_id, status: s.status, at: s.timestamp, error: s.errors?.[0]?.title });
  }
  if (!out.length) {
    const lead = evt.data || evt.lead || evt.payload || {};
    out.push({ type, lead_id: lead.id, phone: lead.contact_number || lead.phone, name: lead.name, stage: lead.lead_data?.inf_stage, tags: lead.tags?.map?.(t => t.name || t) });
  }
  return out;
}

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    const token = u.searchParams.get('hub.verify_token') || u.searchParams.get('verify_token');
    const challenge = u.searchParams.get('hub.challenge') || u.searchParams.get('challenge');
    const want = (process.env.ES_WEBHOOK_VERIFY_TOKEN || '').trim();
    if (want && token === want && challenge != null) { res.statusCode = 200; res.setHeader('Content-Type', 'text/plain'); return res.end(challenge); }
    return send(res, 403, { error: 'verify_token mismatch' });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if (!verifySignature(raw, req.headers['x-hub-signature-256'], (process.env.ES_WEBHOOK_SECRET || '').trim())) return send(res, 401, { error: 'Bad signature' });
  let evt = {}; try { evt = JSON.parse(raw.toString('utf8') || '{}'); } catch { return send(res, 400, { error: 'Body must be JSON' }); }
  const events = summarise(evt);
  console.log('[es-webhook]', JSON.stringify(events));
  // Log to the lead sheet's Apps Script (SHEET_LOG_URL), or any FORWARD_WEBHOOK_URL you set.
  const fwd = (process.env.FORWARD_WEBHOOK_URL || process.env.SHEET_LOG_URL || '').trim();
  if (fwd) {
    // EasySocial wants an answer within 4 s and Apps Script can be slower, so log in the background.
    const job = fetch(fwd, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ source: 'easysocial', secret: (process.env.SHEET_LOG_SECRET || '').trim(), events }) })
      .catch(e => console.log('[es-webhook] forward failed', e.message));
    try { waitUntil(job); } catch { await job; }
  }
  return send(res, 200, { ok: true, received: events.length });
}
