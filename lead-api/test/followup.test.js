// Follow-up engine: cadence, reminders, windows, quiet hours, stop rules, learning. Run: node test/followup.test.js
import { parseSession, plan, newLead, applyEvent, markSent, pickVariant, istParts, fitWindow, deliveryFor } from '../lib/followup/engine.js';
import { simulate } from '../lib/followup/simulate.js';
import { COPY, render } from '../lib/followup/copy.js';
import { fastRules } from '../lib/concierge/rules.js';

let pass = 0, fail = 0;
const ok = (name, c, extra = '') => { if (c) pass++; else { fail++; console.log('  ✗', name, extra); } };
const ist = iso => { const p = istParts(new Date(iso)); return `${p.d}/${p.mo + 1} ${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
const hourOf = iso => { const p = istParts(new Date(iso)); return p.h + p.mi / 60; };
const base = { id: 'L1', name: 'Rohit Sharma', phone: '919811112222', channel: 'wa', lang: 'en', at: '2026-11-02T13:00:00+05:30' };
const bots = r => r.log.filter(l => l.who === 'bot');

// ── session parsing ──────────────────────────────────────────────────────
const from = new Date('2026-11-02T13:00:00+05:30'); // Monday
let s = parseSession('tomorrow morning at 7 AM', from); ok('tomorrow 7 AM', ist(s.at) === '3/11 07:00' && !s.approx, JSON.stringify(s));
s = parseSession('today at 7 PM', from); ok('today 7 PM', ist(s.at) === '2/11 19:00');
s = parseSession('evening', from); ok('evening → today 6 PM approx', ist(s.at) === '2/11 18:00' && s.approx);
s = parseSession('tomorrow at 6', from); ok('"tomorrow at 6" → 6 PM approx', ist(s.at) === '3/11 18:00' && s.approx);
s = parseSession('Saturday at 7 AM', from); ok('Saturday 7 AM', ist(s.at) === '7/11 07:00');
s = parseSession('Sunday morning', from); ok('Sunday morning → 12 PM (opening)', ist(s.at) === '8/11 12:00');
s = parseSession('weekend', from); ok('weekend → Saturday 10 AM', ist(s.at) === '7/11 10:00');
s = parseSession('this morning', new Date('2026-11-02T15:00:00+05:30')); ok('past time → null', s === null);

// ── new lead, never replies ───────────────────────────────────────────────
let r = simulate({ lead: base, until: '2026-12-10T00:00:00+05:30' });
let b = bots(r);
ok('new lead cadence', b.map(x => x.step).join(',') === 'new_30m,new_d1,new_d3,new_d7,new_d14,new_d30', b.map(x => x.step).join(','));
ok('30 min nudge exact', ist(b[0].at) === '2/11 13:30');
ok('30 min is free-form (inside 24 h)', b[0].mode === 'free_form');
ok('day 1+ are marketing templates', b.slice(1).every(x => x.mode === 'template' && x.category === 'marketing'));
ok('nurture only 10:00–20:30', b.slice(1).every(x => hourOf(x.at) >= 10 && hourOf(x.at) <= 20.5));
ok('stage closed after day 30', r.lead.stage === 'closed');

// lead that wrote at 11:40 PM: nudge waits for morning
r = simulate({ lead: { ...base, at: '2026-11-02T23:40:00+05:30' }, until: '2026-11-04T00:00:00+05:30' });
ok('late-night lead: nudge next morning 8 AM', ist(bots(r)[0].at) === '3/11 08:00', ist(bots(r)[0].at));

// replying restarts the clock and skips nothing repeated
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-03T15:00:00+05:30', text: 'ok will think' }], until: '2026-11-08T00:00:00+05:30' });
b = bots(r);
ok('reply credits the step that triggered it', r.log.some(l => /credit replied → new_d1/.test(l.note || '')));
ok('after reply: second 30-min nudge allowed', b.filter(x => x.step === 'new_30m').length === 2);
ok('after reply: day 3 counted from the reply', b.find(x => x.step === 'new_d3') && ist(b.find(x => x.step === 'new_d3').at).startsWith('6/11'), b.map(x => x.step + '@' + ist(x.at)).join(' '));

// ── booked sessions ───────────────────────────────────────────────────────
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-02T13:05:00+05:30', text: 'kal subah 7 baje aaunga', intent: 'visit_plan', when: 'tomorrow morning at 7 AM', lang: 'hinglish' }], until: '2026-11-04T00:00:00+05:30' });
b = bots(r);
ok('morning session: evening-before + 1 h + after (no 4 AM reminder)', b.map(x => x.step).join(',') === 'book_eve,book_1h,book_after', b.map(x => x.step + '@' + ist(x.at)).join(' '));
ok('evening-before at 7:30 PM', ist(b[0].at) === '2/11 19:30');
ok('1 h before at 6 AM', ist(b[1].at) === '3/11 06:00');
ok('Hinglish reminder', /milte hain/.test(b[0].text) && /kal 7 baje subah/.test(b[0].text), b[0].text);

r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-02T13:05:00+05:30', text: 'aaj shaam 7 baje', intent: 'visit_plan', when: 'today at 7 PM' }], until: '2026-11-03T00:00:00+05:30' });
b = bots(r);
ok('evening session: 3 h + 1 h reminders', b.map(x => x.step).join(',').startsWith('book_3h,book_1h'), b.map(x => x.step).join(','));
ok('3 h text has the time', /\(7 PM\)/.test(b[0].text));
ok('reminders are free-form inside the window', b.slice(0, 2).every(x => x.mode === 'free_form'));

r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-02T18:10:00+05:30', text: 'aaj 7 baje', intent: 'visit_plan', when: 'today at 7 PM' }], until: '2026-11-03T00:00:00+05:30' });
ok('booked 50 min before: no 3 h / 1 h spam', !bots(r).some(x => x.step === 'book_3h' || x.step === 'book_1h'), bots(r).map(x => x.step).join(','));

// booking 3 days ahead, last message long ago → reminders become utility templates
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-02T13:05:00+05:30', text: 'friday 7 pm', intent: 'visit_plan', when: 'Friday at 7 PM' }], until: '2026-11-07T00:00:00+05:30' });
b = bots(r).filter(x => x.step.startsWith('book_'));
ok('far-off booking: 3 h reminder is a utility template', b.find(x => x.step === 'book_3h')?.category === 'utility');

// ── visited → joined ──────────────────────────────────────────────────────
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-02T13:05:00+05:30', text: 'aaj 7 baje', intent: 'visit_plan', when: 'today at 7 PM' }, { type: 'visited', at: '2026-11-02T20:00:00+05:30' }, { type: 'joined', at: '2026-11-05T18:00:00+05:30' }], until: '2026-12-10T00:00:00+05:30' });
b = bots(r);
const v2h = b.find(x => x.step === 'vis_2h').at; ok('visit thank-you next day in daytime (not 10 PM)', ist(v2h).startsWith('3/11') && hourOf(v2h) >= 10 && hourOf(v2h) <= 20.5, ist(v2h));
ok('joined: welcome, day 7, day 30', ['join_1h', 'join_d7', 'join_d30'].every(id => b.some(x => x.step === id)));
ok('no nurture after joining', !b.some(x => /^(vis_d3|vis_d6|vis_d14|new_)/.test(x.step)));
ok('review link in day 30', /writereview/.test(b.find(x => x.step === 'join_d30').text));

// ── stop rules ────────────────────────────────────────────────────────────
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-05T12:00:00+05:30', text: 'not interested, mat bhejo' }], until: '2026-12-10T00:00:00+05:30' });
b = bots(r);
ok('opt-out: one acknowledgement, then silence', b[b.length - 1].step === 'optout_ack' && b.filter(x => new Date(x.at) >= new Date('2026-11-05T12:00:00+05:30')).length === 1);
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-17T12:00:00+05:30', text: 'CLOSE' }], until: '2026-12-10T00:00:00+05:30' });
ok('CLOSE stops everything', !bots(r).some(x => new Date(x.at) > new Date('2026-11-17T12:00:00+05:30')));

// ── Instagram: only inside 24 h ───────────────────────────────────────────
r = simulate({ lead: { ...base, channel: 'ig' }, until: '2026-11-20T00:00:00+05:30' });
b = bots(r);
ok('Instagram: 30 min + last-chance only', b.map(x => x.step).join(',') === 'new_30m,new_ig_last', b.map(x => x.step).join(','));
ok('Instagram last-chance before window closes', new Date(b[1].at) < new Date('2026-11-03T13:00:00+05:30'));
ok('Instagram never uses templates', b.every(x => x.mode === 'free_form'));

// ── spacing & quiet hours ─────────────────────────────────────────────────
ok('fitWindow pushes 11 PM nurture to next morning', ist(fitWindow(new Date('2026-11-02T23:00:00+05:30'), 'nurture', 11).toISOString()) === '3/11 11:00');
r = simulate({ lead: base, until: '2026-12-10T00:00:00+05:30' });
const times = bots(r).map(x => new Date(x.at).getTime());
ok('≥ 3 h between messages', times.every((t, i) => !i || t - times[i - 1] >= 3 * 3600e3));

// ── learning ──────────────────────────────────────────────────────────────
ok('explores until both variants have 20 sends', pickVariant('new_d1', 'x', { new_d1: { A: { sent: 25 }, B: { sent: 3 } } }) === 'B');
const stats = { new_d1: { A: { sent: 100, replied: 10, booked: 2 }, B: { sent: 100, replied: 25, booked: 6 } } };
const picks = Array.from({ length: 200 }, (_, i) => pickVariant('new_d1', 'lead' + i, stats));
const bShare = picks.filter(v => v === 'B').length / picks.length;
ok('mostly picks the better variant, still explores', bShare > 0.8 && bShare < 1, String(bShare));
ok('single-variant steps always A', pickVariant('book_3h', 'x', {}) === 'A');

// ── bare slot replies count as bookings ("tomorrow evening at 7") ─────────────
ok('slot reply → visit plan', fastRules('tomorrow evening at 7').when === 'tomorrow evening at 7 PM');
ok('Hinglish slot reply', fastRules('kal subah 7 baje').intent === 'visit_plan');
ok('timing question is not a booking', fastRules('kal kitne baje khulta hai?').intent === '');
r = simulate({ lead: base, events: [{ type: 'inbound', at: '2026-11-02T13:10:00+05:30', ...(x => ({ text: 'tomorrow evening at 7', intent: x.intent, when: x.when }))(fastRules('tomorrow evening at 7')) }], until: '2026-11-04T00:00:00+05:30' });
ok('slot reply gets 3 h + 1 h reminders', ['book_3h', 'book_1h', 'book_after'].every(id => bots(r).some(x => x.step === id)), bots(r).map(x => x.step).join(','));

// ── copy safety ───────────────────────────────────────────────────────────
const lead = newLead({ ...base });
const all = Object.keys(COPY).flatMap(id => Object.keys(COPY[id].variants).flatMap(v => ['en', 'hinglish'].map(lang => render(id, v, { ...lead, lang }, new Date('2026-11-02T12:00:00+05:30'), { when: 'tomorrow at 7 AM', time: '7 AM' }))));
ok('no exact prices in any follow-up', !all.some(t => /₹\s?\d|17,500|30,000|14,500/.test(t)));
ok('no unfilled placeholders', !all.some(t => /\{\w+\}/.test(t)), all.find(t => /\{\w+\}/.test(t)));
ok('every step has English + Hinglish', Object.values(COPY).every(c => Object.values(c.variants).every(v => v.en && v.hinglish)));
const before = render('new_d7', 'A', lead, new Date('2026-10-30T12:00:00+05:30')), after = render('new_d7', 'A', lead, new Date('2026-11-03T12:00:00+05:30'));
ok('offer line only while the offer runs', /Diwali/.test(before) && !/Diwali/.test(after) && /new month/.test(after), after);
ok('WhatsApp delivery rules', deliveryFor({ channel: 'wa', lastInbound: '2026-11-02T10:00:00Z' }, 'nurture', new Date('2026-11-04T10:00:00Z')).category === 'marketing');

console.log(`${pass}/${pass + fail} follow-up checks passed`);
if (fail) process.exit(1);
