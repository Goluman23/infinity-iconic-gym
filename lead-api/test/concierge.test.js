// Concierge (AI fallback) against a fake Claude and a fake sheet script — nothing real is sent.
// Run: node test/concierge.test.js
process.env.CONCIERGE_KEY = 'k123';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-0123456789abcdefghijklmnopqrstuvwxyz';
process.env.SHEET_LOG_URL = 'https://script.google.com/macros/s/TEST/exec';
process.env.SHEET_LOG_SECRET = 's3cret';

const { handleMessage } = await import('../lib/concierge/index.js');
const { setAiFetch } = await import('../lib/concierge/ai.js');
const { setLogFetch } = await import('../lib/concierge/log.js');
const { default: handler, keyOk } = await import('../api/es/concierge.js');

let pass = 0, fail = 0;
const ok = (name, c, extra = '') => { if (c) pass++; else { fail++; console.log('  ✗', name, extra); } };
const NOW = new Date('2026-10-29T14:00:00Z'); // during the Diwali offer
const AFTER = new Date('2026-11-02T10:00:00Z'); // after it ended

const fakeAI = (answer) => async () => {
  if (answer === 'FAIL') return { intent: 'unclear', source: 'ai-failed', lang: '', when: '', hoursConflict: false, aiReply: '' };
  const { parseAnswer } = await import('../lib/concierge/ai.js');
  return parseAnswer({ content: [{ type: 'text', text: JSON.stringify(answer || { intent: 'unclear', lang: 'en' }) }] });
};
const run = async (message, { ai, phone = '919811112222', platform = 'whatsapp', name = 'Rohit Sharma', now = NOW } = {}) => {
  const r = await handleMessage({ message, phone, platform, name, leadId: '[leadId]' }, { now, classifyImpl: fakeAI(ai) });
  return { ...r.state, ...r.out, log: r.log };
};

// ── fast rules + templates ────────────────────────────────────────────────
const cases = [
  ['kal subah aaunga', 'visit_plan', o => o.reply.includes('*kal subah*') && o.reply.includes('CALL ME') && o.lang === 'hinglish'],
  ["I'll come in the evening", 'visit_plan', o => o.reply.includes('*evening*') && o.reply.startsWith('Thank you for letting us know')],
  ['evening mein aata hu', 'visit_plan', o => o.reply.includes('*shaam ko*')],
  ['will come tomorrow at 7 pm', 'visit_plan', o => o.reply.includes('tomorrow at 7 PM') && !o.hoursConflict],
  ['sunday ko 10 am aayenge', 'visit_plan', o => o.hoursConflict && o.reply.includes('Ek chhota note')],
  ['kal 6 baje aaunga', 'visit_plan', o => o.when === 'tomorrow at 6' && !o.hoursConflict],
  ['CALL ME', 'callback', o => o.reply.includes('on this number') && o.response.lead_attributes.inf_handoff === 'yes'],
  ['9876543210', 'phone_shared', o => o.sharedPhone === '9876543210' && o.alert],
  ['my no is +91 98765 43210 call after 6 pm', 'phone_shared', o => o.sharedPhone === '9876543210' && o.reply.includes('*after 6 PM*')],
  ['how much is the membership?', 'price', o => o.reply.includes('₹1,000–1,300')],
  ['fees kitni hai', 'price', o => o.reply.includes('₹1,000–1,300') && !/17,500|30,000|14,500/.test(o.reply)],
  ['talk to a real person', 'human', o => o.response.lead_attributes.inf_handoff === 'yes'],
];
for (const [msg, want, check] of cases) {
  const o = await run(msg);
  ok(`"${msg}" → ${want}`, o.intent === want, `(got ${o.intent})`);
  ok(`"${msg}" reply`, check(o), '\n' + o.reply);
  ok(`"${msg}" both response shapes`, o.response.message === o.reply && o.response.data.body_text === o.reply && o.response.last_response === o.reply);
}
let o = await run('call me', { platform: 'instagram', phone: '[phone]' });
ok('Instagram call-back asks for the number', o.reply.includes('mobile number'));
o = await run('kitne baje khulta hai', { ai: { intent: 'timings', lang: 'hinglish' } });
ok('"kitne baje" is timings, not price', o.intent === 'timings' && o.reply.includes('Sunday'));

// ── AI paths ──────────────────────────────────────────────────────────────
o = await run('is there parking for bikes?', { ai: { intent: 'other_question', lang: 'en', reply: 'Yes — we have valet parking right at the door 🚗' } });
ok('AI general answer used', o.reply.startsWith('Yes — we have valet parking') && o.reply.includes('first session is free'));
o = await run('1 saal ka?', { ai: { intent: 'other_question', lang: 'en', reply: 'One year is ₹14,999 only!' } });
ok('AI price blocked → approved range', !o.reply.includes('14,999') && o.reply.includes('₹1,000–1,300'));
o = await run('Yearly is 15000 per month?', { ai: { intent: 'other_question', lang: 'en', reply: 'It is 15,000 a month' } });
ok('AI price without ₹ blocked', !o.reply.includes('15,000'));
o = await run('trainer bahut rude tha', { ai: { intent: 'complaint', lang: 'hinglish' } });
ok('complaint → apology + alert', o.intent === 'complaint' && o.reply.includes('maafi') && o.alert);
o = await run('membership freeze karni hai', { ai: { intent: 'member_service', lang: 'hinglish' } });
ok('member request → hand-over', o.response.lead_attributes.inf_handoff === 'yes');
o = await run('asdfgh', { ai: 'FAIL' });
ok('AI failure → helpful fallback', o.intent === 'unclear' && o.source === 'ai-failed' && o.reply.includes('human'));
o = await run('😂😂', { ai: { intent: 'made_up' } });
ok('unknown AI label → unclear', o.intent === 'unclear');
o = await run('hey', { ai: { intent: 'greeting', lang: 'en' } });
ok('greeting uses first name, no alert', o.reply.startsWith('Hey Rohit 👋') && !o.alert && o.reply.includes('Diwali'));
o = await run('hey', { ai: { intent: 'greeting', lang: 'en' }, now: AFTER });
ok('offer line gone after 31 Oct', !o.reply.includes('Diwali'));
o = await run('offer?', { ai: { intent: 'offer', lang: 'en' }, now: AFTER });
ok('offer question after 31 Oct says it ended', o.reply.includes('has ended'));
o = await run('Shaam ko 5 baje aa jaunga', { ai: { intent: 'visit_plan', lang: 'hinglish', when: 'this evening at 5 PM', hours_conflict: false } });
ok('AI catches a visit the rules missed', o.intent === 'visit_plan' && o.reply.includes('*aaj shaam 5 baje*'));

// ── what goes to the sheet ────────────────────────────────────────────────
o = await run('kal subah aaunga');
ok('conversation row', o.log.conversation['They wrote'] === 'kal subah aaunga' && o.log.conversation['Understood as'] === 'visit_plan' && o.log.conversation['Caught by'] === 'rules');
ok('alert built', o.log.alert && o.log.alert.subject.includes('Visit planned') && o.log.alert.text.includes('919811112222') && o.log.alert.row.When === 'tomorrow morning');
ok('alert repeat key', o.log.alert.key === '919811112222|visit_plan');
o = await run('hey', { ai: { intent: 'greeting' } });
ok('no alert for a greeting', o.log.alert === null && o.log.conversation['Understood as'] === 'greeting');

// ── HTTP endpoint ─────────────────────────────────────────────────────────
const aiCalls = [], sheetCalls = [];
setAiFetch(async (url, opt) => {
  aiCalls.push({ url, opt });
  return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"intent":"complaint","lang":"en","when":"","hours_conflict":false,"reply":""}' }] }) };
});
setLogFetch(async (url, opt) => { sheetCalls.push({ url, body: JSON.parse(opt.body) }); return { ok: true, status: 200, text: async () => '{"ok":true}' }; });

function call(path) {
  return new Promise(resolve => {
    const req = { method: 'GET', url: path, headers: {} };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b ? JSON.parse(b) : null }); } };
    handler(req, res);
  });
}
let r = await call('/api/es/concierge?key=nope&message=hi');
ok('wrong key → 401', r.status === 401);
ok('keyOk rejects empty', !keyOk({ headers: {} }, {}));
r = await call('/api/es/concierge?key=k123&message=' + encodeURIComponent('kal shaam aaunga') + '&phone=919800000001&name=Asha&platform=instagram&debug=1');
ok('visit via HTTP', r.status === 200 && r.body.message.includes('kal shaam') && r.body.data.body_text === r.body.message && r.body.debug.source === 'rules');
ok('rules path skips Claude', aiCalls.length === 0);
await new Promise(res => setTimeout(res, 20));
ok('sheet got the conversation + alert', sheetCalls.length === 1 && sheetCalls[0].body.secret === 's3cret' && sheetCalls[0].body.alert.subject.includes('Asha') && sheetCalls[0].body.conversation.Platform === 'Instagram');
r = await call('/api/es/concierge?key=k123&message=' + encodeURIComponent('the AC was not working today') + '&phone=919800000002&debug=1');
ok('complaint via Claude', r.body.debug.intent === 'complaint' && r.body.lead_attributes.inf_handoff === 'yes');
ok('Claude request is well-formed', aiCalls.length === 1 && aiCalls[0].url === 'https://api.anthropic.com/v1/messages'
  && aiCalls[0].opt.headers['x-api-key'].startsWith('sk-ant-test') && JSON.parse(aiCalls[0].opt.body).model === 'claude-haiku-5-5');
setAiFetch(async () => { throw new Error('network down'); });
r = await call('/api/es/concierge?key=k123&message=' + encodeURIComponent('qwerty') + '&debug=1');
ok('Claude down → still replies', r.status === 200 && r.body.debug.intent === 'unclear' && r.body.message.length > 20);
setLogFetch(async () => { throw new Error('sheet down'); });
r = await call('/api/es/concierge?key=k123&message=CALL%20ME&phone=919800000003');
ok('sheet down → reply still sent', r.status === 200 && r.body.message.includes('call you'));

const { classify } = await import('../lib/concierge/ai.js');
ok('placeholder key "sk-ant-…" skips Claude', (await classify('hi', { apiKey: 'sk-ant-…' })).source === 'ai-off');
ok('empty key skips Claude', (await classify('hi', { apiKey: '' })).source === 'ai-off');

console.log(`${pass}/${pass + fail} concierge checks passed`);
if (fail) process.exit(1);
