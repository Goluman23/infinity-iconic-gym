// /api/es/followup-send: auth, dry run by default, live free-form call shape. Run: node test/followup-send.test.js
process.env.SHEET_LOG_SECRET = 's3cret';
const { default: handler, setSendFetch } = await import('../api/es/followup-send.js');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  ✗', n); } };
const call = body => new Promise(resolve => {
  const req = { method: 'POST', url: '/api/es/followup-send', headers: {}, body };
  const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
  handler(req, res);
});
const good = { secret: 's3cret', phone: '919811112222', mode: 'free_form', text: 'Hi Rohit', copyId: 'new_30m' };
ok('wrong secret → 401', (await call({ ...good, secret: 'x' })).status === 401);
ok('bad phone → 400', (await call({ ...good, phone: '12345' })).status === 400);
let r = await call(good); ok('dry run by default', r.status === 200 && r.body.dryRun === true);
process.env.FOLLOWUP_LIVE = '1'; process.env.ES_AUTH_KEY = 'ak';
const calls = []; setSendFetch(async (url, opt) => { calls.push({ url, opt }); return { ok: true, status: 200, json: async () => ({ success: true }) }; });
r = await call(good);
ok('live free-form sent', r.body.sent === 'free_form' && calls[0].url.endsWith('/engage/v1/wa-messages/send') && calls[0].opt.headers['auth-key'] === 'ak' && JSON.parse(calls[0].opt.body).mobile_number === '919811112222');
r = await call({ ...good, mode: 'template', copyId: 'new_d1' });
ok('template without campaign → clear error', r.status === 502 && /fu_new_d1/.test(r.body.error));
process.env.ES_ACCESS_TOKEN = 'tok'; process.env.ES_CAMPAIGNS = JSON.stringify({ fu_new_d1_B_hi: { url: 'https://api.easysocial.in/x/send', body: { phone: '{{phone}}', variables: { body1: '{{first_name}}' } } } });
const { setFetch } = await import('../lib/providers/easysocial.js'); const camp = []; setFetch(async (url, opt) => { camp.push({ url, opt }); return { status: 200, json: async () => ({ success: true }) }; });
r = await call({ ...good, mode: 'template', copyId: 'new_d1', variant: 'B', lang: 'hinglish', vars: { first_name: 'Rohit' } });
ok('picks the variant + language template', r.body.campaign === 'fu_new_d1_B_hi' && JSON.parse(camp[0].opt.body).variables.body1 === 'Rohit');
console.log(`${pass}/${pass + fail} follow-up send checks passed`);
if (fail) process.exit(1);
