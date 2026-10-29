// EasySocial adapter against a fake EasySocial API (no real messages). Run: node test/easysocial.test.js
process.env.PROVIDER = 'easysocial';
process.env.DRY_RUN = '0';
process.env.ES_ACCESS_TOKEN = 'tok';
process.env.ES_TAG_IDS = JSON.stringify({ intake_api: 11, wa_optin: 12, src_website_form: 13, intake_member_contact: 14, intake_while_booked: 15 });
const camp = (id) => ({ url: `https://api.easysocial.in/api/v1/campaign/${id}/send`, method: 'POST', body: { phone: '{{phone}}', variables: { body1: '{{first_name}}', body2: '{{goal}}' } } });
process.env.ES_CAMPAIGNS = JSON.stringify({ form: camp('form'), missed_call: camp('mc'), lapsed: camp('lapsed'), walkin: camp('walkin') });
process.env.BULK_DELAY_MS = '0';

const { setFetch, esCalls } = await import('../lib/providers/easysocial.js');
const { processLead } = await import('../lib/intake.js');

const db = new Map(); const sent = [];
const seed = (phone, lead_data = {}, opt_in = true) => db.set(phone, { id: db.size + 1, name: 'X', contact_number: phone, opt_in, lead_data, tags: [] });
seed('919811111111', {}, false);
seed('919822222222', { inf_stage: 'st_member' });
seed('919833333333', { inf_stage: 'st_trial_booked' });
seed('919844444444', { inf_stage: 'st_lapsed', inf_source: 'WA-DIRECT' });
const reply = (status, json) => ({ status, json: async () => json });
setFetch(async (url, opt) => {
  const body = opt.body ? JSON.parse(opt.body) : null;
  if (opt.headers.Authorization !== 'Bearer tok' && !url.includes('/campaign/')) return reply(401, { message: 'bad token' });
  if (url.endsWith('/engage/v1/leads')) { const l = db.get(String(body.contact_number)); return l ? reply(200, { success: true, payload: l }) : reply(404, { success: false }); }
  if (url.endsWith('/api/v1/leads/bulk-create')) { for (const r of body.data) seed('91' + r.contact_number); return reply(200, { success: true }); }
  const m = url.match(/\/leads\/(\d+)\/update$/);
  if (m && opt.method === 'PUT') { const l = db.get(m[1]); Object.assign(l.lead_data, body.lead_data); l.tags.push(...(body.add_tags || [])); return reply(200, { success: true }); }
  if (url.includes('/campaign/')) { sent.push({ url, body }); return reply(200, { success: true }); }
  return reply(404, {});
});

const DAY = new Date('2026-10-28T06:00:00Z'), NIGHT = new Date('2026-10-28T17:00:00Z');
const base = { name: 'Riya Sharma', phone: '98123 45610', entry: 'website_form', consent: true, goal: 'Fat loss', time: '5–8 PM', area: 'Omaxe Heights' };
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log(cond ? 'PASS ' : 'FAIL ', label, cond ? '' : extra); };

let r = await processLead(base, DAY);
ok('New lead → created, saved, campaign sent', r.status === 'sent' && r.created && sent.length === 1, JSON.stringify(r));
ok('Campaign placeholders filled', sent[0].body.phone === '919812345610' && sent[0].body.variables.body1 === 'Riya' && sent[0].body.variables.body2 === 'Fat loss', JSON.stringify(sent[0]));
const riya = db.get('919812345610');
ok('lead_data saved (stage st_new, ctx, source)', riya.lead_data.inf_stage === 'st_new' && riya.lead_data.inf_ctx === 'first_touch_form' && riya.lead_data.inf_source === 'WEBSITE-FORM', JSON.stringify(riya.lead_data));
ok('Tag ids added', [11, 12, 13].every(t => riya.tags.includes(t)), JSON.stringify(riya.tags));
ok('Again within 24 h → duplicate', (await processLead(base, DAY)).status === 'duplicate');
ok('Opted out (opt_in false) → skipped', (await processLead({ ...base, phone: '9811111111' }, DAY)).status === 'skipped_opted_out');
r = await processLead({ ...base, phone: '9822222222' }, DAY);
ok('Member → skipped + tag 14', r.status === 'skipped_member' && db.get('919822222222').tags.includes(14));
ok('Booked → skipped', (await processLead({ ...base, phone: '9833333333' }, DAY)).status === 'skipped_booked');
r = await processLead({ ...base, phone: '9844444444' }, DAY);
ok('Lapsed → win-back campaign, first source kept', r.flow === 'lapsed' && sent.at(-1).url.includes('/lapsed/') && db.get('919844444444').lead_data.inf_source === 'WA-DIRECT');
ok('Broadcast at night → deferred', (await processLead({ ...base, phone: '9866666666', entry: 'broadcast_walkin' }, NIGHT)).status === 'deferred');
r = await processLead({ ...base, phone: '9877777777', entry: 'ig_phone' }, DAY);
ok('Entry without a campaign → clear error, nothing sent', r.status === 'error' && /ES_CAMPAIGNS/.test(r.errors[0]));
ok('Missing tag id → warning, still sent', (await processLead({ ...base, phone: '9888888888', entry: 'missed_call' }, DAY)).warnings?.[0]?.includes('src_missed_call'));

// Webhook signature + summary
const crypto = await import('node:crypto');
const { verifySignature, summarise } = await import('../api/es/webhook.js');
const raw = Buffer.from('{"event":"lead_update"}');
const sig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(raw).digest('hex');
ok('Webhook signature accepted', verifySignature(raw, sig, 's3cret'));
ok('Webhook bad signature rejected', !verifySignature(raw, sig.replace(/.$/, '0'), 's3cret'));
const wa = summarise({ entry: [{ changes: [{ value: { messages: [{ from: '9198', type: 'text', text: { body: 'hi' }, timestamp: '1' }] } }] }] });
ok('Meta-format message parsed', wa[0].type === 'wa_message' && wa[0].text === 'hi');

console.log(`${pass}/${pass + fail} EasySocial checks passed · ${sent.length} first messages · ${esCalls.length} API calls`);
if (fail) process.exit(1);
