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
  // Detox: value add-ons, NOT more months — keeps the Diwali deadline honest (people who waited don't get a better price).
  { key: 'detox', start: '2026-11-11', end: '2026-11-15', endLabel: '15 Nov', emoji: '🥗',
    offer: { en: 'Post-Diwali Detox: FREE Detox Starter Kit with any annual membership — body-composition scan, 14-day diet plan and 1 personal-training session',
             hinglish: 'Post-Diwali Detox: kisi bhi annual membership ke saath FREE Detox Starter Kit — body-composition scan, 14 din ka diet plan aur 1 personal-training session' } },
  { key: 'wedding', start: '2026-11-16', end: '2026-12-15', endLabel: '15 Dec', emoji: '💍', offer: null },
  { key: 'xmas', start: '2026-12-16', end: '2026-12-25', endLabel: '25 Dec', emoji: '🎄', offer: null },
  { key: 'newyear', start: '2026-12-26', end: '2027-01-31', endLabel: '31 Jan', emoji: '🎆', offer: null },
  { key: 'valentine', start: '2027-02-01', end: '2027-02-14', endLabel: '14 Feb', emoji: '💞', offer: null },
];

// Opening hours. Normal: Mon–Sat 05:00–23:00, Sun 12:00–21:00. Special days override them.
export const NORMAL_HOURS = { en: 'Mon–Sat 5 AM–11 PM · Sun 12–9 PM', hinglish: 'Mon–Sat subah 5 – raat 11 · Sunday 12 – 9' };
export const SPECIAL_HOURS = [
  { date: '2026-11-07', open: 5, close: 13, en: 'Sat 7 Nov: 5 AM – 1 PM', hinglish: 'Shanivaar 7 Nov: subah 5 – dopahar 1' },
  { date: '2026-11-08', closed: true, en: 'Sun 8 Nov (Diwali): closed', hinglish: 'Ravivaar 8 Nov (Diwali): band' },
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

// Is the gym open at this moment (IST)? Special days first, then normal hours.
export function isOpenAt(date) {
  const ymd = istYmd(date);
  const t = new Date(new Date(date).getTime() + 330 * 60000);
  const h = t.getUTCHours() + t.getUTCMinutes() / 60, dow = t.getUTCDay();
  const sp = SPECIAL_HOURS.find(x => x.date === ymd);
  if (sp) return !sp.closed && h >= sp.open && h < sp.close;
  return dow === 0 ? h >= 12 && h < 21 : h >= 5 && h < 23;
}
export function isClosedDay(date) { const sp = SPECIAL_HOURS.find(x => x.date === istYmd(date)); return !!(sp && sp.closed); }
export function isSpecialDay(date) { return SPECIAL_HOURS.some(x => x.date === istYmd(date)); }

// "🪔 Diwali hours: Sat 7 Nov: 5 AM – 1 PM · Sun 8 Nov (Diwali): closed" while a special day is within the next 7 days.
export function holidayNotice(now = new Date(), lang = 'en') {
  const today = istYmd(now), soon = istYmd(new Date(new Date(now).getTime() + 7 * 864e5));
  const up = SPECIAL_HOURS.filter(x => x.date >= today && x.date <= soon);
  if (!up.length) return '';
  const H = lang === 'hinglish';
  return (H ? '🪔 Tyohaar timings: ' : '🪔 Festival hours: ') + up.map(x => x[H ? 'hinglish' : 'en']).join(' · ');
}
