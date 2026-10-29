// Brain: every typed message gets a relevant answer. Run: node test/brain.test.js
process.env.DRY_RUN = '1';
const { think } = await import('../lib/brain.js');
const { toEasySocial, mainMenu } = await import('../lib/es-format.js');

const DAY = new Date('2026-10-28T07:00:00Z'); // 12:30 IST
const T = [
  ['Hi', 'again'], ['hello', 'again'], ['👋', 'again'], ['🙏', 'ack'], ['👍', 'ack'], ['thanks', 'thanks'], ['ok', 'ack'], ['bye', 'bye'],
  ['anyone available?', 'avail'], ['available?', 'avail'], ['Anyone available for a quick call?', 'call'], ['can someone call me', 'call'],
  ['call me in 1 hour', 'cb_1h'], ['call me in the evening', 'cb_eve'], ['call me tomorrow morning', 'cb_morning'],
  ['phone number?', 'number'], ['contact number please', 'number'], ['location', 'loc'], ['where are you', 'loc'], ['address bhejo', 'loc'],
  ['timings', 'hours'], ['open on sunday?', 'hours'], ['diwali open?', 'holiday'], ['price', 'price'], ['fees kitni hai', 'price'],
  ['which plan for fat loss', 'fit'], ['book trial', 'book'], ['free trial', 'book'], ['hyrox', 'hyrox'], ['personal trainer', 'pt'],
  ['physio for knee', 'physio'], ['zumba classes', 'classes'], ['ladies batch', 'classes'], ['parking available?', 'facil'],
  ['I am a member', 'member'], ['renew membership', 'member'], ['cancel my membership', 'cancel'], ['refund', 'cancel'],
  ['complaint trainer was rude', 'complaint'], ['you idiots', 'abuse'], ['discount please', 'discount'], ['knee injury can I join', 'injury'],
  ['job vacancy', 'career'], ['corporate plan for my office', 'corp'], ['other branches?', 'branch'], ['my son is 15', 'minor'],
  ['wrong number', 'wrong'], ['who is this', 'who'], ['stop', 'optout'], ['not interested', 'notint'], ['talk to human', 'human'],
  ['I want to talk to a real person', 'human'], ['kisi se baat karni hai', 'human'], ['are you a bot', 'bot'], ['asdf', 'fallback'],
  ['reschedule my session', 'reschedule'], ['https://bit.ly/x', 'link'], ['1', 'book'], ['yes', 'book'], ['no', 'thanks'],
];
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; if (!cond) console.log('FAIL ', label, extra); };

for (const [msg, want] of T) {
  const d = think({ message: msg, name: 'Riya', ctx: 'welcome', now: DAY });
  ok(`"${msg}" → ${want}`, d.route === want, `got ${d.route}`);
  ok(`"${msg}" has text`, d.text && d.text.length > 5);
  ok(`"${msg}" buttons ≤3 and ≤20 chars`, d.buttons.length <= 3 && d.buttons.every(b => b.title.length <= 20 && b.id));
}

// Context cases
ok('New contact "Hi" → welcome', think({ message: 'Hi', name: 'Riya', now: DAY }).route === 'welcome');
ok('Booked contact "Hi" → known reply', think({ message: 'Hi', stage: 'st_trial_booked', now: DAY }).route.startsWith('known_'));
ok('Member "Hi" → known reply', think({ message: 'hello', stage: 'st_member', now: DAY }).route.startsWith('known_'));
const f1 = think({ message: 'asdf', ctx: 'welcome', now: DAY });
ok('Unclear once → fallback with menu', f1.route === 'fallback' && f1.attrs.inf_miss === '1');
ok('Unclear twice → person', think({ message: 'qwerty', ctx: 'welcome', miss: f1.attrs.inf_miss, now: DAY }).handoff != null);
ok('Same text 3× → person', think({ message: 'price?', ctx: 'price', last: 'price?', rep: '2', now: DAY }).route === 'human');
ok('Hinglish → lang hi', think({ message: 'fees kitni hai', now: DAY }).lang === 'hi');
ok('Hindi stays hi on short English', think({ message: 'ok', lang: 'hi', ctx: 'price', now: DAY }).lang === 'hi');
ok('Language row toggles', think({ message: 'हिंदी में बात करें', now: DAY }).lang === 'hi');
ok('Button title maps back', think({ message: 'Book free session', ctx: 'menu', now: DAY }).route === 'book');
ok('"human" → handoff set', !!think({ message: 'human', now: DAY }).attrs.inf_handoff);
ok('"book" → flow booking', think({ message: 'book trial', now: DAY }).attrs.inf_flow === 'booking');
ok('"stop" → inf_optout yes', think({ message: 'stop', now: DAY }).attrs.inf_optout === 'yes');
const night = think({ message: 'call me', now: new Date('2026-10-28T19:00:00Z') }); // 00:30 IST
ok('Call at night → no promise of a call in 15 min', !/15 minutes/.test(night.text));
ok('Price gives a range, never the exact amount', (t => /1,000–1,300/.test(t) && !/17,500|30,000|14,500/.test(t))(think({ message: 'price', now: DAY }).text));

// EasySocial shapes
const d = think({ message: 'location', now: DAY });
const n8n = toEasySocial(d);
ok('n8n shape', typeof n8n.message === 'string' && n8n.lead_attributes.inf_route === 'loc' && n8n.last_response);
const btn = toEasySocial(think({ message: 'hi', now: DAY }), 'buttons');
ok('button shape', btn.data.interactive.type === 'button' && btn.data.interactive.action.buttons.length <= 3);
ok('text shape', toEasySocial(d, 'text').data.body_text.length > 5);
ok('bool shape', typeof toEasySocial(d, 'bool').data.success === 'boolean');
const m = mainMenu('en').data.interactive;
ok('list ≤10 rows, ≤20 chars', m.action.sections[0].rows.length <= 10 && m.action.sections[0].rows.every(r => r.title.length <= 20));

// Endpoint handler
const { default: brain } = await import('../api/es/brain.js');
const fakeRes = () => { const r = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } }; return r; };
const req = { method: 'GET', url: '/api/es/brain?leadId=42&message=' + encodeURIComponent('anyone available?') + '&name=Riya&ctx=[inf_ctx]', headers: {} };
const res = fakeRes(); await brain(req, res);
const out = JSON.parse(res.body);
ok('GET /api/es/brain answers', res.statusCode === 200 && out.lead_attributes.inf_route === 'avail', res.body);
const res2 = fakeRes(); await brain({ method: 'GET', url: '/api/es/brain?leadId=42&message=hi', headers: {} }, res2);
ok('Warm cache gives context on next message', JSON.parse(res2.body).lead_attributes.inf_route === 'again', res2.body);

console.log(`${pass}/${pass + fail} brain checks passed`);
if (fail) process.exit(1);
