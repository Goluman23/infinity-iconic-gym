// Infinity follow-up engine — decides WHAT to send, WHEN, and HOW (free-form vs template),
// for every lead, from a small state object. Pure functions: no I/O, so the same code runs in
// Vercel, in Google Apps Script (the scheduler) and in the browser simulator.
//
// Stages:  new → booked → visited → joined      (any stage → optout / closed)
// Rules:   stop on reply (nurture clock restarts from their last message), stop on opt-out,
//          quiet hours, ≥3 h between messages (reminders excepted), ≤1 nurture per 20 h,
//          WhatsApp: free-form inside 24 h of their last message, approved template after;
//          Instagram/Messenger: only inside the 24 h window (no messages after it closes).
import { COPY, render } from './copy.js';

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const IST = 330 * MIN; // UTC+05:30, no daylight saving

// ── time helpers (all decisions in India time) ─────────────────────────────
export function istParts(d) { const t = new Date(d.getTime() + IST); return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), dow: t.getUTCDay() }; }
export function istDate(y, mo, d, h, mi = 0) { return new Date(Date.UTC(y, mo, d, h, mi) - IST); }
function dayStart(d, addDays = 0) { const p = istParts(d); return istDate(p.y, p.mo, p.d + addDays, 0, 0); }
function at(d, h, mi = 0, addDays = 0) { const p = istParts(d); return istDate(p.y, p.mo, p.d + addDays, h, mi); }
const hm = d => { const p = istParts(d); return p.h + p.mi / 60; };
export function fmtTime(d) { const p = istParts(d); const h12 = ((p.h + 11) % 12) + 1; return `${h12}${p.mi ? ':' + String(p.mi).padStart(2, '0') : ''} ${p.h < 12 ? 'AM' : 'PM'}`; }
export function fmtWhen(d, from, lang = 'en') {
  const days = Math.round((dayStart(d) - dayStart(from)) / DAY);
  const p = istParts(d); const hi = lang === 'hinglish';
  const dayWord = days === 0 ? (hi ? 'aaj' : 'today') : days === 1 ? (hi ? 'kal' : 'tomorrow')
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.dow] + (hi ? ' ko' : '');
  return hi ? `${dayWord} ${fmtTime(d)} baje`.replace(' AM baje', ' baje subah').replace(' PM baje', ' baje') : `${dayWord} at ${fmtTime(d)}`;
}

// Quiet hours (India time). Nurture never at night; reminders may go early for early sessions.
export const WINDOWS = { nurture: [10, 20.5], active: [8, 22.5], reminder: [5, 21.5] };
export function fitWindow(due, kind, prefHour) {
  const [a, b] = WINDOWS[kind];
  const h = hm(due);
  if (h >= a && h <= b) return due;
  // too late → next morning slot; too early → same day's opening (or preferred hour)
  const target = prefHour != null && prefHour >= a && prefHour <= b ? prefHour : a;
  return h > b ? at(due, Math.floor(target), Math.round((target % 1) * 60), 1) : at(due, Math.floor(target), Math.round((target % 1) * 60), 0);
}
// Nurture goes out at the hour they usually talk to us (if sensible), else 11:00 or 18:30.
function prefHourOf(lead) { const h = lead.firstInbound ? hm(new Date(lead.firstInbound)) : null; return h != null && h >= 10 && h <= 20.5 ? h : (h != null && h > 15 ? 18.5 : 11); }

// ── session time from what the customer said ("tomorrow evening at 6 PM") ──
export function parseSession(phrase, from) {
  const t = String(phrase || '').toLowerCase();
  let addDays = null, approx = false;
  if (/\btoday\b|\btonight\b|\bthis (morning|evening|afternoon)\b/.test(t)) addDays = 0;
  else if (/\btomorrow\b/.test(t)) addDays = 1;
  else { const w = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|weekend)\b/); if (w) { const target = w[1] === 'weekend' ? 6 : ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(w[1]); const dow = istParts(from).dow; addDays = (target - dow + 7) % 7 || 7; } }
  const part = /morning/.test(t) ? 'morning' : /afternoon/.test(t) ? 'afternoon' : /evening/.test(t) ? 'evening' : /night|tonight/.test(t) ? 'night' : '';
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  let h = null, mi = 0;
  if (m) {
    h = +m[1]; mi = +(m[2] || 0);
    if (m[3] === 'pm' && h < 12) h += 12; else if (m[3] === 'am' && h === 12) h = 0;
    else if (!m[3]) { if (part === 'morning') { /* as is */ } else if (part) { if (h < 12) h += 12; } else { approx = true; if (h >= 1 && h <= 9) h += 12; } }
  } else { approx = true; h = part === 'morning' ? 7 : part === 'afternoon' ? 13 : part === 'night' ? 20 : /weekend|saturday|sunday/.test(t) ? (/sunday/.test(t) ? 12 : 10) : 18; }
  if (h > 23) return null;
  if (addDays == null) { addDays = 0; const cand = at(from, h, mi, 0); if (cand.getTime() < from.getTime() + HOUR) addDays = 1; }
  let s = at(from, h, mi, addDays);
  // keep inside opening hours (Sun 12–21, else 5–23)
  const p = istParts(s), sun = p.dow === 0;
  if (sun && hm(s) < 12) { s = at(s, 12); approx = true; } else if (!sun && hm(s) < 5) { s = at(s, 6); approx = true; }
  if (s.getTime() <= from.getTime()) return null;
  return { at: s.toISOString(), approx, phrase: phrase || '' };
}

// ── sequences ─────────────────────────────────────────────────────────────
// anchor: 'quiet' = max(stage start, their last message) · 'session' · 'stage'
export const SEQUENCES = {
  new: [
    { id: 'new_30m', anchor: 'quiet', after: 30 * MIN, window: 'active', repeatOnReply: 2 },
    { id: 'new_ig_last', anchor: 'quiet', after: 21 * HOUR, window: 'active', channels: ['ig', 'fb'] },
    { id: 'new_d1', anchor: 'quiet', after: DAY, window: 'nurture' },
    { id: 'new_d3', anchor: 'quiet', after: 3 * DAY, window: 'nurture' },
    { id: 'new_d7', anchor: 'quiet', after: 7 * DAY, window: 'nurture' },
    { id: 'new_d14', anchor: 'quiet', after: 14 * DAY, window: 'nurture' },
    { id: 'new_d30', anchor: 'quiet', after: 30 * DAY, window: 'nurture', last: true },
  ],
  booked: [
    { id: 'book_eve', anchor: 'session', rule: 'eveBefore', window: 'reminder', reminder: true },
    { id: 'book_3h', anchor: 'session', after: -3 * HOUR, window: 'reminder', reminder: true, minLead: 4 * HOUR, strictWindow: [8, 21.5] },
    { id: 'book_1h', anchor: 'session', after: -HOUR, window: 'reminder', reminder: true, minLead: 90 * MIN },
    { id: 'book_after', anchor: 'session', after: 3 * HOUR, window: 'active' },
    { id: 'nb_d2', copy: 'new_d3', anchor: 'sessionOrReply', after: 2 * DAY, window: 'nurture' },
    { id: 'nb_d5', copy: 'new_d7', anchor: 'sessionOrReply', after: 5 * DAY, window: 'nurture' },
    { id: 'nb_d12', copy: 'new_d14', anchor: 'sessionOrReply', after: 12 * DAY, window: 'nurture' },
    { id: 'nb_d30', copy: 'new_d30', anchor: 'sessionOrReply', after: 30 * DAY, window: 'nurture', last: true },
  ],
  visited: [
    { id: 'vis_2h', anchor: 'stage', after: 2 * HOUR, window: 'nurture' },
    { id: 'vis_d1', anchor: 'quiet', after: DAY, window: 'nurture' },
    { id: 'vis_d3', anchor: 'quiet', after: 3 * DAY, window: 'nurture' },
    { id: 'vis_d6', anchor: 'quiet', after: 6 * DAY, window: 'nurture' },
    { id: 'vis_d14', anchor: 'quiet', after: 14 * DAY, window: 'nurture', last: true },
  ],
  joined: [
    { id: 'join_1h', anchor: 'stage', after: HOUR, window: 'active' },
    { id: 'join_d7', anchor: 'stage', after: 7 * DAY, window: 'nurture' },
    { id: 'join_d30', anchor: 'stage', after: 30 * DAY, window: 'nurture', last: true },
  ],
  optout: [{ id: 'optout_ack', anchor: 'stage', after: 0, window: 'reminder', ackOnly: true }],
};
export const ALL_STEPS = Object.entries(SEQUENCES).flatMap(([stage, s]) => s.map(x => ({ stage, ...x })));

// ── lead state ────────────────────────────────────────────────────────────
export function newLead({ id, name = '', phone = '', channel = 'wa', lang = 'en', at }) {
  const t = new Date(at).toISOString();
  return { id: String(id || phone || name), name, phone, channel, lang, stage: 'new', stageAt: t, firstInbound: t, lastInbound: t, lastOutbound: null, lastNurture: null, session: null, sent: {}, skipped: {}, history: [], lastStep: null };
}

const OPTOUT = /\b(stop|unsubscribe|not interested|no thanks|don'?t message|band karo|mat bhejo|nahi chahiye|interest nahi)\b/i;
export function applyEvent(lead, ev) {
  const L = structuredClone(lead), credits = [], alerts = [];
  const t = new Date(ev.at); const iso = t.toISOString();
  if (ev.type === 'inbound') {
    const text = String(ev.text || '').trim();
    if (L.lastStep && t - new Date(L.lastStep.at) < 2 * DAY && !L.lastStep.credited) { credits.push({ step: L.lastStep.copy, variant: L.lastStep.variant, kind: 'replied' }); L.lastStep.credited = true; }
    L.lastInbound = iso; if (!L.firstInbound) L.firstInbound = iso;
    if (ev.lang) L.lang = ev.lang;
    if (OPTOUT.test(text) || /^\s*close\s*$/i.test(text)) { L.stage = /^\s*close/i.test(text) ? 'closed' : 'optout'; L.stageAt = iso; alerts.push(L.stage === 'optout' ? 'opted out' : 'asked to close'); }
    else if (/^\s*2\s*$/.test(text) && L.stage === 'booked') { alerts.push('wants to reschedule'); }
    else if (/^\s*(join|hold)\s*$/i.test(text)) { alerts.push(`replied ${text.toUpperCase()} — call to close`); }
    if (ev.intent === 'visit_plan' && ev.when && !['optout', 'closed', 'joined'].includes(L.stage)) {
      const s = parseSession(ev.when, t);
      if (s) { L.stage = 'booked'; L.stageAt = iso; L.session = s; L.sent = Object.fromEntries(Object.entries(L.sent).filter(([k]) => !k.startsWith('book_') && !k.startsWith('nb_'))); alerts.push('visit booked'); if (L.lastStep) credits.push({ step: L.lastStep.copy, variant: L.lastStep.variant, kind: 'booked' }); }
    }
  } else if (['booked', 'visited', 'joined', 'lost', 'optout', 'closed'].includes(ev.type)) {
    if (ev.type === 'booked') { const s = ev.session || parseSession(ev.when, t); if (!s) return { lead: L, credits, alerts: ['could not read the session time'] }; L.session = s; }
    if ((ev.type === 'visited' || ev.type === 'joined') && L.lastStep) credits.push({ step: L.lastStep.copy, variant: L.lastStep.variant, kind: ev.type });
    L.stage = ev.type === 'lost' ? 'closed' : ev.type; L.stageAt = iso;
  }
  return { lead: L, credits, alerts };
}

// ── learning: pick the variant that converts best (with a little exploration) ──
export const LEARN = { minSends: 20, explore: 0.15, bookedWeight: 3 };
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
export function pickVariant(copyId, leadId, stats = {}) {
  const vs = Object.keys(COPY[copyId].variants); if (vs.length === 1) return vs[0];
  const st = vs.map(v => ({ v, ...(stats[copyId]?.[v] || {}), sent: stats[copyId]?.[v]?.sent || 0 }));
  const under = st.filter(x => x.sent < LEARN.minSends);
  if (under.length) return under.sort((a, b) => a.sent - b.sent || hash(leadId + a.v) - hash(leadId + b.v))[0].v;
  if (hash(leadId + copyId) < LEARN.explore) return vs[Math.floor(hash(copyId + leadId) * vs.length)];
  const score = x => ((x.replied || 0) + LEARN.bookedWeight * (x.booked || 0)) / x.sent;
  return st.sort((a, b) => score(b) - score(a))[0].v;
}

// ── channel rules ─────────────────────────────────────────────────────────
export const PRICE_INR = { free_form: 0, utility: 0.145, marketing: 1.09 }; // Meta India rates from 1 Oct 2026; first 1,000 service messages/month free
export function deliveryFor(lead, kind, now) {
  const inWindow = lead.lastInbound && now - new Date(lead.lastInbound) < DAY;
  if (lead.channel === 'wa') return inWindow ? { mode: 'free_form', cost: PRICE_INR.free_form } : { mode: 'template', category: kind === 'utility' ? 'utility' : 'marketing', cost: kind === 'utility' ? PRICE_INR.utility : PRICE_INR.marketing };
  return inWindow ? { mode: 'free_form', cost: 0 } : { mode: 'blocked', reason: `${lead.channel === 'ig' ? 'Instagram' : 'Messenger'} only allows messages within 24 h of their last message` };
}

// ── the planner ───────────────────────────────────────────────────────────
function anchorTime(lead, step) {
  const stageAt = new Date(lead.stageAt), last = new Date(lead.lastInbound || lead.stageAt);
  if (step.anchor === 'session' || step.anchor === 'sessionOrReply') {
    const s = new Date(lead.session.at);
    return step.anchor === 'sessionOrReply' ? new Date(Math.max(s, last)) : s;
  }
  if (step.anchor === 'quiet') return new Date(Math.max(stageAt, last));
  return stageAt;
}
function dueTime(lead, step) {
  if (step.rule === 'eveBefore') {
    const s = new Date(lead.session.at), booked = new Date(lead.stageAt);
    if (hm(s) >= 11) return null; // only for morning sessions
    const eve = at(s, 19, 30, -1);
    return booked < eve ? eve : null;
  }
  const a = anchorTime(lead, step);
  return new Date(a.getTime() + step.after);
}

// Returns the next thing to do for this lead (or null). `send` tells the scheduler whether it's due now.
export function plan(lead, now, stats = {}) {
  const seq = SEQUENCES[lead.stage]; if (!seq) return null;
  if (lead.stage === 'optout') { if (lead.sent.optout_ack) return null; }
  const candidates = [];
  for (const step of seq) {
    if (step.channels && !step.channels.includes(lead.channel)) continue;
    const copyId = step.copy || step.id;
    const prev = lead.sent[step.id];
    if (prev) {
      if (!step.repeatOnReply) continue;
      const count = lead.history.filter(h => h.step === step.id).length;
      if (count >= step.repeatOnReply || new Date(prev) >= new Date(lead.lastInbound)) continue;
    }
    if (lead.skipped[step.id] && !step.repeatOnReply) continue;
    let due = dueTime(lead, step); if (!due) continue;
    if (step.reminder) {
      const s = new Date(lead.session.at), booked = new Date(lead.stageAt);
      if (step.minLead && s - booked < step.minLead) continue;
      if (step.strictWindow && (hm(due) < step.strictWindow[0] || hm(due) > step.strictWindow[1])) continue;
      if (hm(due) < WINDOWS.reminder[0] || hm(due) > WINDOWS.reminder[1]) continue; // never in the middle of the night
      if (now >= s) continue; // session started — reminder no longer useful
    } else {
      due = fitWindow(due, step.window, step.window === 'nurture' ? prefHourOf(lead) : null);
      if (step.id === 'new_ig_last') { const close = new Date(new Date(lead.lastInbound).getTime() + DAY - 30 * MIN); if (due > close) continue; }
    }
    // Instagram/Messenger: nothing can be sent after the 24 h window closes, so drop those steps.
    if (lead.channel !== 'wa' && lead.lastInbound && due.getTime() >= new Date(lead.lastInbound).getTime() + DAY - 15 * MIN) continue;
    candidates.push({ step, copyId, due });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.due - b.due);
  // If several are overdue, send only the most recent one and mark the older ones skipped.
  const overdue = candidates.filter(c => c.due <= now);
  const pick = overdue.length ? overdue[overdue.length - 1] : candidates[0];
  const skip = overdue.slice(0, -1).map(c => c.step.id);
  let due = pick.due;
  // spacing rules (reminders exempt)
  if (!pick.step.reminder && !pick.step.ackOnly) {
    if (lead.lastOutbound) due = new Date(Math.max(due, new Date(lead.lastOutbound).getTime() + 3 * HOUR));
    if (pick.step.window === 'nurture' && lead.lastNurture) due = new Date(Math.max(due, new Date(lead.lastNurture).getTime() + 20 * HOUR));
    if (due > pick.due) due = fitWindow(due, pick.step.window, pick.step.window === 'nurture' ? prefHourOf(lead) : null);
  }
  const kind = COPY[pick.copyId].kind;
  const variant = pickVariant(pick.copyId, lead.id, stats);
  const when = lead.session ? (lead.session.approx ? lead.session.phrase || fmtWhen(new Date(lead.session.at), due, lead.lang) : fmtWhen(new Date(lead.session.at), due, lead.lang)) : '';
  const text = render(pick.copyId, variant, lead, due, { when, time: lead.session ? fmtTime(new Date(lead.session.at)) : '' });
  const delivery = deliveryFor(lead, kind, due);
  return { stepId: pick.step.id, copyId: pick.copyId, label: COPY[pick.copyId].label, stage: lead.stage, variant, due: due.toISOString(), send: due <= now, skip, kind, delivery, text, last: !!pick.step.last };
}

// Record that an action was sent (or blocked/skipped) and return the new lead state.
export function markSent(lead, action, now) {
  const L = structuredClone(lead), iso = new Date(now).toISOString();
  for (const s of action.skip || []) L.skipped[s] = iso;
  if (action.delivery.mode === 'blocked') { L.skipped[action.stepId] = iso; L.history.push({ step: action.stepId, at: iso, blocked: action.delivery.reason }); return L; }
  L.sent[action.stepId] = iso; L.lastOutbound = iso;
  if (action.kind === 'nurture') L.lastNurture = iso;
  L.lastStep = { step: action.stepId, copy: action.copyId, variant: action.variant, at: iso };
  L.history.push({ step: action.stepId, copy: action.copyId, variant: action.variant, at: iso, mode: action.delivery.mode });
  if (action.last && L.stage !== 'joined') { L.stage = 'closed'; L.stageAt = iso; }
  return L;
}
