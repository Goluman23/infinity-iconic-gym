// Infinity campaign calendar — the ONE place for season windows, offer text and festival dates.
// Everything else (concierge replies, follow-up copy, the sheet engine, the older brain) reads from here.
// Dates are IST, inclusive. Edit this file when a date or offer changes, then run the tests and
// `node apps-script/build-followup-gs.mjs` so the sheet gets the same calendar.
// No imports: this file is also pasted into the Apps Script engine.

export const PRICE_RANGE = { en: '₹1,000–1,300 a month', hinglish: '₹1,000–1,300 mahina' }; // confirmed 1 Nov 2026

// Festival days (2026–27, Drik Panchang, New Delhi). Used for greetings and holiday-hours answers.
export const FESTIVALS = [
  { key: 'dhanteras', date: '2026-11-06', name: 'Dhanteras' },
  { key: 'diwali', date: '2026-11-08', name: 'Diwali' },
  { key: 'govardhan', date: '2026-11-10', name: 'Govardhan Puja' },
  { key: 'bhaidooj', date: '2026-11-11', name: 'Bhai Dooj' },
  { key: 'chhath', date: '2026-11-15', name: 'Chhath Puja' },
  { key: 'xmas', date: '2026-12-25', name: 'Christmas' },
  { key: 'newyear', date: '2027-01-01', name: 'New Year' },
];

// Campaign windows. Latest-starting window wins when two overlap. `offer` null = no dated offer line.
export const CAMPAIGNS = [
  { key: 'diwali', start: '2026-10-01', end: '2026-11-08', endLabel: '8 Nov', emoji: '🪔',
    offer: { en: 'Diwali special: 14 months for the price of 12', hinglish: 'Diwali special: 12 mahine ki keemat mein 14 mahine' } },
  { key: 'detox', start: '2026-11-11', end: '2026-11-20', endLabel: '20 Nov', emoji: '🥗', offer: null },
  { key: 'wedding', start: '2026-11-16', end: '2026-12-15', endLabel: '15 Dec', emoji: '💍', offer: null },
  { key: 'xmas', start: '2026-12-16', end: '2026-12-25', endLabel: '25 Dec', emoji: '🎄', offer: null },
  { key: 'newyear', start: '2026-12-26', end: '2027-01-31', endLabel: '31 Jan', emoji: '🎆', offer: null },
  { key: 'valentine', start: '2027-02-01', end: '2027-02-14', endLabel: '14 Feb', emoji: '💞', offer: null },
];

export function istYmd(date = new Date()) {
  const t = new Date(new Date(date).getTime() + 330 * 60000);
  return t.toISOString().slice(0, 10);
}

export function campaignAt(now = new Date()) {
  const ymd = istYmd(now);
  let hit = null;
  for (const c of CAMPAIGNS) if (ymd >= c.start && ymd <= c.end) hit = c;
  return hit;
}

// The offer running right now (only a verified, dated one), or null.
export function offerAt(now = new Date(), lang = 'en') {
  const c = campaignAt(now);
  if (!c || !c.offer) return null;
  const H = lang === 'hinglish';
  return { key: c.key, emoji: c.emoji, endLabel: c.endLabel, ends: `${c.end}T23:59:59+05:30`,
    text: c.offer[H ? 'hinglish' : 'en'],
    line: H ? `${c.emoji} ${c.offer.hinglish}, sirf ${c.endLabel} tak.` : `${c.emoji} ${c.offer.en}, only till ${c.endLabel}.` };
}

export function festivalOn(now = new Date()) {
  const ymd = istYmd(now);
  return FESTIVALS.find(f => f.date === ymd) || null;
}
