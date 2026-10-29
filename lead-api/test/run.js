// Offline test: a fake ManyChat keeps contacts in memory, so every rule can be checked
// without sending a real WhatsApp message.  Run: npm test
process.env.PROVIDER = 'manychat';
process.env.DRY_RUN = '0';
process.env.MANYCHAT_API_KEY = 'test';
process.env.INTAKE_KEY = 'secret';
for (const k of ['FORM', 'MISSED_CALL', 'IG_PHONE', 'CORPORATE']) process.env['FLOW_FIRST_TOUCH_' + k] = 'content_' + k.toLowerCase();
for (const k of ['WALKIN', 'CAMP', 'LAPSED']) process.env['FLOW_BROADCAST_' + k] = 'content_bc_' + k.toLowerCase();

const { setTransport, calls } = await import('../lib/manychat.js');
const { processLead, processBulk } = await import('../lib/intake.js');

// ---- fake ManyChat ----
const db = new Map(); let seq = 1; const sent = [];
function seed(phone, tags = [], fields = {}) {
  const id = 'sub_' + seq++;
  db.set(id, { id, phone: '+' + phone, tags: tags.map(name => ({ name })), custom_fields: Object.entries(fields).map(([name, value]) => ({ name, value })) });
}
setTransport(async (method, path, body) => {
  if (path.startsWith('/fb/subscriber/findBySystemField')) {
    const phone = decodeURIComponent(path.split('phone=')[1]);
    return { status: 'success', data: [...db.values()].find(s => s.phone === phone) || null };
  }
  if (path.startsWith('/fb/subscriber/getInfo')) return { status: 'success', data: db.get(path.split('=')[1]) };
  if (path === '/fb/subscriber/createSubscriber') { const id = 'sub_' + seq++; const s = { id, phone: body.whatsapp_phone, tags: [], custom_fields: [] }; db.set(id, s); return { status: 'success', data: s }; }
  const s = db.get(body.subscriber_id);
  if (path === '/fb/subscriber/setCustomFields') { for (const f of body.fields) { const x = s.custom_fields.find(c => c.name === f.field_name); x ? (x.value = f.field_value) : s.custom_fields.push({ name: f.field_name, value: f.field_value }); } return { status: 'success' }; }
  if (path === '/fb/subscriber/addTagByName') { if (!s.tags.some(t => t.name === body.tag_name)) s.tags.push({ name: body.tag_name }); return { status: 'success' }; }
  if (path === '/fb/sending/sendFlow') { sent.push({ to: s.phone, flow: body.flow_ns }); return { status: 'success' }; }
  return { status: 'success' };
});

// 11:00 and 22:30 India time on 26 Oct 2026
const DAY = new Date('2026-10-26T05:30:00Z'), NIGHT = new Date('2026-10-26T17:00:00Z'), JAN = new Date('2027-01-05T06:00:00Z');
const base = { name: 'Riya Sharma', phone: '98123 45610', entry: 'website_form', consent: true, goal: 'Fat loss', time: '5–8 PM', area: 'Omaxe Heights' };

seed('919811111111', ['optout']);
seed('919822222222', ['st_member']);
seed('919833333333', ['st_trial_booked']);
seed('919844444444', ['st_lapsed'], { inf_source: 'WA-DIRECT' });

const cases = [
  ['New website-form lead → first message sent', { ...base }, DAY, 'sent'],
  ['Same person again within 24 h → not re-sent', { ...base }, DAY, 'duplicate'],
  ['Opted-out contact → nothing sent', { ...base, phone: '9811111111' }, DAY, 'skipped_opted_out'],
  ['Active member → no sales message', { ...base, phone: '9822222222' }, DAY, 'skipped_member'],
  ['Booked lead → reminders already running', { ...base, phone: '9833333333' }, DAY, 'skipped_booked'],
  ['Lapsed member fills a form → win-back flow', { ...base, phone: '9844444444' }, DAY, 'sent'],
  ['Wrong phone number → rejected', { ...base, phone: '12345' }, DAY, 'invalid'],
  ['No WhatsApp consent → rejected', { ...base, phone: '9855555555', consent: false }, DAY, 'invalid'],
  ['Unknown goal → rejected', { ...base, phone: '9855555556', goal: 'Bodybuilding' }, DAY, 'invalid'],
  ['Walk-in broadcast at 10:30 PM → deferred to 9 AM', { ...base, phone: '9866666666', entry: 'broadcast_walkin' }, NIGHT, 'deferred'],
  ['Walk-in broadcast at 11 AM → sent', { ...base, phone: '9866666666', entry: 'broadcast_walkin' }, DAY, 'sent'],
  ['Form lead at 10:30 PM → still sent (they just asked)', { ...base, phone: '9877777777' }, NIGHT, 'sent'],
  ['Missed call → missed-call template', { name: 'Aman', phone: '+91 98888 88888', entry: 'missed_call', consent: 'yes' }, DAY, 'sent'],
  ['Hindi note → inf_lang = hi', { ...base, phone: '9899999999', note: 'fees kitni hai?' }, DAY, 'sent'],
  ['Lead in January → season = newyear', { ...base, phone: '9890000000' }, JAN, 'sent'],
];

let pass = 0;
for (const [label, input, when, expect] of cases) {
  const r = await processLead(input, when);
  const ok = r.status === expect;
  pass += ok;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n      → ${r.status}${r.flow ? ' · flow ' + r.flow : ''}${r.season ? ' · season ' + r.season : ''}${r.errors ? ' · ' + r.errors.join(' | ') : ''}${r.reason ? ' · ' + r.reason : ''}`);
}
const hindi = [...db.values()].find(s => s.phone === '+919899999999');
const langOk = hindi.custom_fields.find(f => f.name === 'inf_lang')?.value === 'hi';
console.log(`${langOk ? 'PASS' : 'FAIL'}  Hindi lead saved with inf_lang = hi`); pass += langOk;
const lapsed = sent.find(s => s.to === '+919844444444');
const lapsedOk = lapsed?.flow === 'content_bc_lapsed';
console.log(`${lapsedOk ? 'PASS' : 'FAIL'}  Lapsed member got the win-back flow (${lapsed?.flow})`); pass += lapsedOk;
const keptSource = db.get('sub_4').custom_fields.find(f => f.name === 'inf_source')?.value === 'WA-DIRECT';
console.log(`${keptSource ? 'PASS' : 'FAIL'}  First source kept (WA-DIRECT), latest stored separately`); pass += keptSource;

const bulk = await processBulk([
  { ...base, phone: '9700000001', entry: 'broadcast_camp', area: 'Omaxe Heights' },
  { ...base, phone: '9700000001', entry: 'broadcast_camp' },
  { ...base, phone: '9700000002', entry: 'broadcast_camp', consent: false },
  { ...base, phone: '9811111111', entry: 'broadcast_camp' },
], DAY);
const bulkOk = bulk.summary.sent === 1 && bulk.summary.duplicate_in_file === 1 && bulk.summary.invalid === 1 && bulk.summary.skipped_opted_out === 1;
console.log(`${bulkOk ? 'PASS' : 'FAIL'}  Bulk camp import → ${JSON.stringify(bulk.summary)}`); pass += bulkOk;

const total = cases.length + 4;
console.log(`\n${pass}/${total} passed · ${sent.length} WhatsApp first messages would have been sent · ${calls.length} ManyChat API calls`);
console.log('First lead\'s ManyChat calls, in order:');
calls.slice(0, 9).forEach(c => console.log('  ', c.method, c.path.split('?')[0], c.body ? JSON.stringify(c.body).slice(0, 110) : ''));
process.exit(pass === total ? 0 : 1);
