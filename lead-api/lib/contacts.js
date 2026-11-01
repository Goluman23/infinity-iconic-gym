// Infinity contact names carry the desk's source codes, e.g. "Shivam Dang IF", "Nishant Verma YC",
// "Sujith Muraleedharan Ref (Kunal Goswami)", "Mayank Verma &1 More". This file turns a saved name into
// a clean first name for messages plus the codes, and builds filtered send lists for broadcasts.
//
// Codes (confirmed by the client, 1 Nov 2026) — these say WHERE a contact came from, not member status:
//   IF  = Infinity Faridabad (branch label)      YC  = Yadvinder Chauhan's client (trainer's client)
//   Ref = referred by a member                   DC  = direct call enquiry
//   WE  = WhatsApp enquiry                       TB  = trial booked on the website
// Member status comes from EasySocial's synced segments (Active / Inactive Members, Enquiry).
import { normalizePhone } from './rules.js';

export const CODES = {
  IF: { tag: 'SRC_BRANCH_FARIDABAD', label: 'Infinity Faridabad' },
  YC: { tag: 'SRC_TRAINER_YC', label: "Yadvinder Chauhan's client" },
  REF: { tag: 'SRC_REFERRAL', label: 'Member referral' },
  DC: { tag: 'SRC_DIRECT_CALL', label: 'Direct call' },
  WE: { tag: 'SRC_WHATSAPP', label: 'WhatsApp enquiry' },
  TB: { tag: 'SRC_WEBSITE_TRIAL', label: 'Trial booked on website' },
};
const CODE_RX = /^(if|yc|ref|dc|we|tb)$/i;
const NOT_A_NAME = /^(no name|unknown|test|infinity gym|-|\.)$/i;

// "Sujith Muraleedharan Ref (Kunal Goswami)" → { first: 'Sujith', codes: ['REF'], referrer: 'Kunal Goswami', group: false }
export function parseContactName(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  const referrer = (s.match(/\(([^)]+)\)/) || [])[1]?.trim() || '';
  s = s.replace(/\([^)]*\)/g, ' ');
  const group = /&\s*\d*\s*more\b|\b\d+\s*more\b|\s&\s/i.test(s);              // "&1 More", "7 1 MORE", "A & B"
  s = s.replace(/&\s*\d*\s*more\b|\b\d+\s*\d*\s*more\b/ig, ' ').replace(/\bdirect call\b/ig, ' DC ');
  const words = s.split(/[\s,]+/).filter(Boolean);
  const codes = [...new Set(words.filter(w => CODE_RX.test(w)).map(w => w.toUpperCase()))];
  const nameWords = words.filter(w => !CODE_RX.test(w) && !/^&$/.test(w));
  // Leading title-like prefixes the desk uses ("Ps.", "Ps") are not names.
  while (nameWords.length > 1 && /^ps\.?$/i.test(nameWords[0])) nameWords.shift();
  const full = nameWords.join(' ').trim();
  const cand = nameWords[0] || '';
  const first = NOT_A_NAME.test(full) || !/^[a-z][a-z'.-]*$/i.test(cand) || cand.length < 2
    ? '' : cand[0].toUpperCase() + cand.slice(1).toLowerCase();
  return { first, full, codes, referrer, group, tags: codes.map(c => CODES[c].tag) };
}

// ── send lists ─────────────────────────────────────────────────────────────
// contacts: [{ name, phone, tags: ['SUPPRESS_OPT_OUT', …], segment: 'Active Members' | 'Inactive Members' | 'Enquiry' | '' }]
// campaign: 'offer' (Diwali/Detox acquisition) · 'winback' (Detox to lapsed) · 'members' (hours reminder, greeting)
// Returns { send: [{ phone, first_name, segment, source }], skipped: [{ phone, name, reason }] }.
const SUPPRESS = ['SUPPRESS_OPT_OUT', 'SUPPRESS_MARKETING'];
const INTERNAL = new Set(['919953004008', '919953005008']); // gym desk + WhatsApp bot numbers

export function buildSendList(contacts, campaign, { exclude = [] } = {}) {
  const send = [], skipped = [], seen = new Set(), excl = new Set(exclude.map(normalizePhone).filter(Boolean));
  for (const c of contacts) {
    const phone = normalizePhone(c.phone);
    const p = parseContactName(c.name);
    const tags = (c.tags || []).map(t => String(t).toUpperCase());
    const seg = String(c.segment || '').toLowerCase();
    const isActive = /^active/.test(seg) || tags.some(t => t.startsWith('SUPPRESS_ACTIVE_MEMB'));
    const isInactive = /^inactive/.test(seg);
    const skip = reason => skipped.push({ phone: phone || String(c.phone || ''), name: c.name || '', reason });
    if (!phone) { skip('invalid phone'); continue; }
    if (seen.has(phone)) { skip('duplicate'); continue; }
    seen.add(phone);
    if (INTERNAL.has(phone) || /^infinity gym$|test/i.test(p.full)) { skip('internal / test'); continue; }
    if (excl.has(phone)) { skip('already sent / excluded'); continue; }
    if (campaign !== 'members' && tags.some(t => SUPPRESS.includes(t))) { skip('opted out'); continue; }
    if (campaign === 'members') {
      if (!isActive) { skip('not an active member'); continue; }
    } else if (campaign === 'winback') {
      if (isActive) { skip('active member'); continue; }
    } else { // offer
      if (isActive) { skip('active member'); continue; }
      if (p.codes.includes('YC') && !isInactive) { skip("trainer's client (YC) — not in Inactive Members"); continue; }
    }
    send.push({ phone, first_name: p.first || 'there', segment: c.segment || '', source: p.codes.join(' ') });
  }
  return { send, skipped };
}

// Minimal CSV (quoted fields, commas, newlines) — enough for EasySocial / Excel exports.
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head = [], ...body] = rows.filter(r => r.some(x => x.trim()));
  const H = head.map(h => h.trim().toLowerCase());
  const col = (...names) => H.findIndex(h => names.some(n => h === n || h.includes(n)));
  const ci = { name: col('name'), phone: col('phone', 'mobile', 'number', 'contact'), tags: col('tag'), segment: col('segment', 'status') };
  return body.map(r => ({
    name: ci.name >= 0 ? r[ci.name] : '', phone: ci.phone >= 0 ? r[ci.phone] : '',
    tags: ci.tags >= 0 ? String(r[ci.tags] || '').split(/[;,|]/).map(t => t.trim()).filter(Boolean) : [],
    segment: ci.segment >= 0 ? r[ci.segment] : '',
  }));
}

export function toCsv(rows, cols) {
  const esc = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n';
}
