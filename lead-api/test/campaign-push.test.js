// /api/es/campaign-push: preview by default, live only with CAMPAIGN_LIVE=1 + live + confirm,
// skips ledger recipients (incl. earlier broadcasts), batches of 100, logs results.
import handler, { setPause } from '../api/es/campaign-push.js';
import { setLedgerFetch } from '../lib/campaign-ledger.js';
import { setFetch } from '../lib/providers/easysocial.js';
import { resolveCampaign } from '../lib/campaign-registry.js';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x); } };
setPause(async () => {});
process.env.CAMPAIGN_PUSH_KEY = 'k'.repeat(24); process.env.SHEET_LOG_URL = 'https://sheet'; process.env.SHEET_LOG_SECRET = 's';
process.env.ES_CAMPAIGNS = JSON.stringify({ festive_video: { url: 'https://es/campaign', method: 'POST', useToken: false, body: { phone: '{{phone}}', variables: ['{{first_name}}'] } } });
let ledger = { sent: ['919811100001'], prev: ['919811100002'] }, logged = [], esPosts = [], ledgerDown = false;
setLedgerFetch(async (url, o) => {
  const b = JSON.parse(o.body);
  if (ledgerDown) return { status: 500, text: async () => 'down' };
  if (b.kind === 'campaign_sent') return { status: 200, text: async () => JSON.stringify({ ok: true, phones: [...(b.campaigns.includes('festive_video') ? ledger.sent : []), ...(b.campaigns.includes('festive_100_test') ? ledger.prev : [])] }) };
  if (b.kind === 'campaign') { logged.push(...b.rows); return { status: 200, text: async () => JSON.stringify({ ok: true }) }; }
});
setFetch(async (url, o) => { esPosts.push({ url, body: JSON.parse(o.body) }); return { status: url.includes('fail') ? 400 : 200, json: async () => ({ success: true }) }; });
const call = async body => { let out; const res = { setHeader() {}, end(s) { out = JSON.parse(s); }, statusCode: 0 }; await handler({ method: 'POST', body, headers: {} }, res); return { code: res.statusCode, ...out }; };
const contacts = [
  { name: 'Aman IF', phone: '9811100001' },        // already sent this campaign
  { name: 'Bina', phone: '9811100002' },           // got the 100-test broadcast
  { name: 'Chetan DC', phone: '9811100003' },
  { name: 'Deepa', phone: '9811100004', segment: 'Active Members' },
  { name: 'Esha WE', phone: '9811100005' },
];
const KEY = 'k'.repeat(24);

ok('Festive offer API resolves', resolveCampaign('Festive offer API')?.id === 'festive_api' && resolveCampaign('festive offer')?.id === 'festive_video');
ok('aliases resolve', resolveCampaign('festive video')?.id === 'festive_video' && resolveCampaign('Infinity Festive Offer – Video')?.id === 'festive_video' && resolveCampaign('infinity_festive_video_offer')?.id === 'festive_video');
let r = await call({ key: 'wrong', campaign: 'festive video', contacts });
ok('wrong key → 401', r.code === 401);
r = await call({ key: KEY, campaign: 'nope', contacts });
ok('unknown campaign → 404 with the list', r.code === 404 && r.campaigns[0].id === 'festive_video');
r = await call({ key: KEY, campaign: 'festive video', contacts });
ok('preview by default, nothing sent', r.dryRun && r.eligible === 2 && esPosts.length === 0, JSON.stringify(r));
ok('preview skips ledger + 100-test + members', r.reasons['already sent / excluded'] === 2 && r.reasons['active member'] === 1);
ok('preview sample has clean first names', r.sample.map(s => s.first_name).join() === 'Chetan,Esha');
r = await call({ key: KEY, campaign: 'festive video', contacts, live: true, confirm: 'festive_video' });
ok('live:true without CAMPAIGN_LIVE → still a dry run', r.dryRun && /CAMPAIGN_LIVE/.test(r.why) && esPosts.length === 0);
process.env.CAMPAIGN_LIVE = '1';
r = await call({ key: KEY, campaign: 'festive video', contacts, live: true });
ok('live without confirm → dry run', r.dryRun && /confirm/.test(r.why));
r = await call({ key: KEY, campaign: 'festive video', contacts, live: true, confirm: 'festive_video', list: 'Society A' });
ok('live sends only eligible', r.live && r.sent === 2 && esPosts.length === 2 && esPosts[0].body.phone === '919811100003' && esPosts[0].body.variables[0] === 'Chetan', JSON.stringify(esPosts[0]));
ok('results written to the ledger', logged.length === 2 && logged[0].Campaign === 'festive_video' && logged[0].List === 'Society A' && logged[0].Result === 'sent');
ledgerDown = true;
r = await call({ key: KEY, campaign: 'festive video', contacts, live: true, confirm: 'festive_video' });
ok('ledger unreachable → refuses to send', r.code === 503 && esPosts.length === 2);
r = await call({ key: KEY, campaign: 'festive video', contacts });
ok('ledger unreachable → preview still works with a warning', r.dryRun && r.ledgerWarning);
esPosts = []; r = await call({ key: KEY, campaign: 'festive video', contacts, live: true, confirm: 'festive_video', allowNoLedger: true, exclude: ['9811100003'] });
ok('ledger unreachable + allowNoLedger → sends, honours exclude, logged=false', r.live && r.sent === esPosts.length && esPosts.length >= 1 && r.logged === false);
ledgerDown = false;
const many = Array.from({ length: 250 }, (_, i) => ({ name: 'P' + i, phone: '98' + String(20000000 + i) }));
esPosts = []; r = await call({ key: KEY, campaign: 'festive video', contacts: many, live: true, confirm: 'festive_video' });
ok('batches of 100 with remaining count', r.sent === 100 && r.remaining === 150 && esPosts.length === 100, `${r.sent} ${r.remaining}`);
logged = []; r = await call({ key: KEY, recordPrevious: 'festive_100_test', phones: ['+91 98111 00009', '9811100009', 'bad'] });
ok('record earlier broadcast recipients (deduped, valid only)', r.recorded === 1 && logged[0].Result === 'previous' && logged[0].Phone === '919811100009');
console.log(`${pass}/${pass + fail} campaign push checks passed`);
if (fail) process.exit(1);
