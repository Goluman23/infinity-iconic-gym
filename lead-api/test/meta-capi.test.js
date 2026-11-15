// Offline test for /api/meta/capi: fake Graph API, no network.  Run: npm test
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const { buildEvent, sendEvent, setTransport, normPhone, normName } = await import('../lib/meta-capi.js');
const handler = (await import('../api/meta/capi.js')).default;
const sha = v => crypto.createHash('sha256').update(v).digest('hex');

assert.equal(normPhone('+91 98765 43210'), '919876543210');
assert.equal(normPhone('09876543210'), '919876543210');
assert.equal(normPhone('12345'), '');
assert.equal(normName('  Ritesh Hans '), 'ritesh');

const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'UA', origin: 'https://www.eqiconic.com' } };
const good = { event_name: 'Lead', event_id: 'inf.abc12345', event_source_url: 'https://www.eqiconic.com/?utm_source=meta',
  user: { fbp: 'fb.1.1700000000000.123456', fbc: 'fb.1.1700000000000.IwAR0abc', ph: '9876543210', fn: 'Asha' },
  custom: { content_name: 'trial_form', goal: 'Fat loss', junk: 'x' } };

let ev = buildEvent(good, req);
assert.equal(ev.event_name, 'Lead'); assert.equal(ev.action_source, 'website');
assert.equal(ev.user_data.client_ip_address, '1.2.3.4');
assert.deepEqual(ev.user_data.ph, [sha('919876543210')]);
assert.deepEqual(ev.user_data.fn, [sha('asha')]);
assert.equal(ev.custom_data.goal, 'Fat loss'); assert.ok(!('junk' in ev.custom_data));
assert.equal(buildEvent({ ...good, event_name: 'Purchase' }, req), null);           // not on the allow-list
assert.equal(buildEvent({ ...good, event_source_url: 'https://evil.com/' }, req), null);
assert.equal(buildEvent({ ...good, event_id: 'x' }, req), null);
ev = buildEvent({ ...good, user: { fbp: 'garbage', ph: '123' } }, req);
assert.ok(!ev.user_data.fbp && !ev.user_data.ph);

// not configured → skipped, nothing sent
delete process.env.META_PIXEL_ID; delete process.env.META_CAPI_TOKEN;
let calls = [];
setTransport(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ events_received: 1 }) }; });
assert.deepEqual(await sendEvent(buildEvent(good, req)), { ok: true, skipped: 'not_configured' });
assert.equal(calls.length, 0);

// configured → posts to Graph with test code
process.env.META_PIXEL_ID = '111222333'; process.env.META_CAPI_TOKEN = 'TOKEN'; process.env.META_TEST_EVENT_CODE = 'TEST1';
let out = await sendEvent(buildEvent(good, req));
assert.equal(out.ok, true); assert.equal(out.received, 1);
assert.match(calls[0].url, /graph\.facebook\.com\/v\d+\.\d\/111222333\/events\?access_token=TOKEN/);
const sent = JSON.parse(calls[0].init.body);
assert.equal(sent.test_event_code, 'TEST1'); assert.equal(sent.data[0].event_id, 'inf.abc12345');

// handler: origin check + happy path
function mockRes() { return { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b || ''; } }; }
let res = mockRes();
await handler({ method: 'POST', headers: { origin: 'https://evil.com' }, body: good }, res);
assert.equal(res.statusCode, 403);
res = mockRes();
await handler({ method: 'POST', headers: req.headers, body: good }, res);
assert.equal(res.statusCode, 200); assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://www.eqiconic.com');
res = mockRes();
await handler({ method: 'OPTIONS', headers: req.headers }, res);
assert.equal(res.statusCode, 204);

console.log('meta-capi tests passed');
