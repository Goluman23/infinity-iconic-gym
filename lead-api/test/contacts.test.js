import { parseContactName, buildSendList, parseCsv } from '../lib/contacts.js';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const P = parseContactName;
let p = P('Shivam Dang IF'); ok('IF stripped, first name kept', p.first === 'Shivam' && p.codes.join() === 'IF' && p.full === 'Shivam Dang');
p = P('Shami IF YC'); ok('two codes', p.first === 'Shami' && p.codes.join() === 'IF,YC');
p = P('Sujith Muraleedharan Ref (Kunal Goswami)'); ok('referral + referrer', p.first === 'Sujith' && p.codes.join() === 'REF' && p.referrer === 'Kunal Goswami');
p = P('Mayank Verma &1 More'); ok('&1 More → group', p.first === 'Mayank' && p.group);
p = P('Raman Singh 7 1 MORE'); ok('"7 1 MORE" → group', p.first === 'Raman' && p.group);
p = P('Priyanshu Khari & Rudransh Bhatia IF'); ok('two names → group, first person', p.first === 'Priyanshu' && p.group);
p = P('Vinayak If Direct Call'); ok('"If Direct Call" → IF + DC', p.first === 'Vinayak' && p.codes.includes('IF') && p.codes.includes('DC'));
p = P('Ps. Aman Sodhi'); ok('"Ps." prefix dropped', p.first === 'Aman');
p = P('No Name'); ok('No Name → no first name', p.first === '');
p = P('Dev Ahuja If'); ok('lower-case code', p.codes.join() === 'IF' && p.first === 'Dev');
p = P('Rahul WE'); ok('WE code', p.codes.join() === 'WE' && p.tags[0] === 'SRC_WHATSAPP');
p = P('Neha TB'); ok('TB code', p.tags[0] === 'SRC_WEBSITE_TRIAL');

const C = [
  { name: 'Aman IF', phone: '+91 98111 11111', segment: 'Enquiry' },
  { name: 'Aman IF', phone: '9811111111', segment: 'Enquiry' },                       // duplicate
  { name: 'Bina IF', phone: '+91 98111 22222', segment: 'Active Members' },
  { name: 'Chetan YC', phone: '+91 98111 33333', segment: '' },                      // trainer's client, unknown status
  { name: 'Deepa YC', phone: '+91 98111 44444', segment: 'Inactive Members' },
  { name: 'Esha Ref (Kunal)', phone: '+91 98111 55555', tags: ['SUPPRESS_OPT_OUT'] },
  { name: 'Infinity Gym', phone: '+91 99530 04008' },
  { name: 'No Name', phone: '+91 98111 66666' },
  { name: 'Bad', phone: '12345' },
  { name: 'Farhan', phone: '+91 98111 77777', tags: ['SUPPRESS_ACTIVE_MEMB'] },
];
let r = buildSendList(C, 'offer');
const phones = r.send.map(s => s.phone);
ok('offer: enquiry, inactive YC and no-name go', phones.join() === '919811111111,919811144444,919811166666', phones.join());
ok('offer: no-name gets "there"', r.send.find(s => s.phone === '919811166666').first_name === 'there');
const why = Object.fromEntries(r.skipped.map(s => [s.name, s.reason]));
ok('offer: skips duplicate, member, YC unknown, opted out, desk, bad number, member tag',
  r.skipped.length === 7 && why['Bina IF'] === 'active member' && /YC/.test(why['Chetan YC']) && why['Esha Ref (Kunal)'] === 'opted out' && why['Infinity Gym'] === 'internal / test' && why['Bad'] === 'invalid phone' && why['Farhan'] === 'active member', JSON.stringify(r.skipped));
r = buildSendList(C, 'members');
ok('members: only active members', r.send.map(s => s.phone).join() === '919811122222,919811177777', r.send.map(s => s.phone).join());
r = buildSendList(C, 'winback');
ok('winback: YC with unknown status allowed, members out', r.send.some(s => s.phone === '919811133333') && !r.send.some(s => s.phone === '919811122222'));
r = buildSendList(C, 'offer', { exclude: ['9811111111'] });
ok('exclude list (already sent) honoured', !r.send.some(s => s.phone === '919811111111'));
const rows = parseCsv('Name,Phone Number,Tags\n"Shivam Dang IF","+91 99999 00000","SUPPRESS_OPT_OUT; CMP_DETOX_2026"\nNo Name,9811100000,\n');
ok('CSV parse with quoted fields + tags', rows.length === 2 && rows[0].tags.length === 2 && rows[1].phone === '9811100000');

console.log(`${pass}/${pass + fail} contact checks passed`);
if (fail) process.exit(1);
