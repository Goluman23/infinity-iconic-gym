import { CONFIG, ENTRY } from './config.js';

export const GOALS = ['Fat loss', 'Muscle gain', 'HYROX / CrossFit', 'General fitness', 'Rehab / pain recovery', 'Training with partner', 'Family (3+)'];

// Indian mobile → 91XXXXXXXXXX. Returns null when it can't be a valid number.
export function normalizePhone(raw) {
  if (raw == null) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return '91' + d;
}

const HINDI = /[ऀ-ॿ]|\b(hai|kya|kitn\w*|kaise|chahiye|karna|mujhe|aapka|nahi|haan|theek|batao|bataiye)\b/i;
export function detectLang(text, given) {
  if (given === 'hi' || given === 'en') return given;
  return text && HINDI.test(text) ? 'hi' : 'en';
}

// Same calendar as the Flow Simulator's season engine (latest-starting season wins).
const SEASONS = [
  ['diwali', '2026-10-01', '2026-10-31'], ['detox', '2026-11-11', '2026-11-20'],
  ['wedding', '2026-11-16', '2026-12-15'], ['xmas', '2026-12-16', '2026-12-25'],
  ['newyear', '2026-12-26', '2027-01-31'], ['valentine', '2027-02-01', '2027-02-14'],
];
export function localParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}
export function seasonFor(date = new Date()) {
  const { ymd } = localParts(date);
  let hit = 'evergreen';
  for (const [k, a, b] of SEASONS) if (ymd >= a && ymd <= b) hit = k;
  return hit;
}
export function inQuietHours(date = new Date()) {
  const { hour } = localParts(date);
  const { quietStart: s, quietEnd: e } = CONFIG;
  return s > e ? (hour >= s || hour < e) : (hour >= s && hour < e);
}

// Validate and clean one lead. Returns { ok, lead } or { ok:false, errors }.
export function cleanLead(input = {}) {
  const errors = [];
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const first = name.split(' ')[0] || '';
  const phone = normalizePhone(input.phone);
  const entry = String(input.entry ?? '').trim();
  const consent = input.consent === true || input.consent === 'true' || input.consent === 'yes' || input.consent === 1 || input.consent === '1';
  if (!first) errors.push('name is required');
  if (!phone) errors.push('phone must be a valid 10-digit Indian mobile number');
  if (!ENTRY[entry]) errors.push(`entry must be one of: ${Object.keys(ENTRY).join(', ')}`);
  if (!consent) errors.push('WhatsApp consent is required — do not message people who did not agree');
  const goal = input.goal && GOALS.includes(input.goal) ? input.goal : (input.goal ? null : '');
  if (goal === null) errors.push(`goal must be one of: ${GOALS.join(', ')}`);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    lead: {
      name, first, last: name.split(' ').slice(1).join(' '), phone, entry,
      source: String(input.source || entry.toUpperCase().replace(/_/g, '-')).slice(0, 60),
      goal: goal || '', time: String(input.time || '').slice(0, 30), area: String(input.area || '').slice(0, 60),
      lang: detectLang(input.note, input.lang), note: String(input.note || '').slice(0, 300),
      consentText: String(input.consent_text || `Agreed to WhatsApp messages from ${CONFIG.brand} via ${entry}`).slice(0, 200),
      expiry: input.expiry || '',
    },
  };
}
