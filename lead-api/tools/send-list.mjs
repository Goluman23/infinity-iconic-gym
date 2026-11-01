#!/usr/bin/env node
// Build a filtered broadcast list from an EasySocial contacts export.
//   node tools/send-list.mjs contacts.csv --campaign offer|winback|members \
//        [--active active.csv] [--inactive inactive.csv] [--enquiry enquiry.csv] [--exclude already-sent.csv] [--out name]
// Writes <out>-send.csv (phone, first_name, segment, source) for EasySocial's Excel upload and
// <out>-skipped.csv (who was left out and why). Rules: lib/contacts.js buildSendList.
import fs from 'node:fs';
import { parseCsv, buildSendList, toCsv } from '../lib/contacts.js';
import { normalizePhone } from '../lib/rules.js';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : ''; };
const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const campaign = opt('campaign') || 'offer';
if (!file || !['offer', 'winback', 'members'].includes(campaign)) {
  console.error('usage: node tools/send-list.mjs contacts.csv --campaign offer|winback|members [--active f] [--inactive f] [--enquiry f] [--exclude f] [--out name]');
  process.exit(1);
}
const read = f => parseCsv(fs.readFileSync(f, 'utf8'));
const contacts = read(file);
const seg = new Map();
for (const [k, label] of [['active', 'Active Members'], ['inactive', 'Inactive Members'], ['enquiry', 'Enquiry']])
  if (opt(k)) for (const c of read(opt(k))) { const p = normalizePhone(c.phone); if (p) seg.set(p, label); }
for (const c of contacts) { const p = normalizePhone(c.phone); if (p && seg.has(p)) c.segment = seg.get(p); }
const exclude = opt('exclude') ? read(opt('exclude')).map(c => c.phone) : [];
const { send, skipped } = buildSendList(contacts, campaign, { exclude });
const out = opt('out') || `${campaign}-${new Date().toISOString().slice(0, 10)}`;
fs.writeFileSync(`${out}-send.csv`, toCsv(send, ['phone', 'first_name', 'segment', 'source']));
fs.writeFileSync(`${out}-skipped.csv`, toCsv(skipped, ['phone', 'name', 'reason']));
const why = skipped.reduce((m, s) => (m[s.reason] = (m[s.reason] || 0) + 1, m), {});
console.log(`${contacts.length} contacts → ${send.length} to send, ${skipped.length} skipped`, why);
console.log(`wrote ${out}-send.csv and ${out}-skipped.csv`);
