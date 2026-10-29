/**
 * Infinity follow-up engine — GENERATED from lead-api/lib (concierge/rules.js, followup/copy.js,
 * followup/engine.js). Do not edit here; edit those files and run: node apps-script/build-followup-gs.mjs
 */
const FU = (() => {
const structuredClone = o => JSON.parse(JSON.stringify(o));
// Fast rules: catch the messages that matter most without calling the AI
// (instant, free, and the wording is always the approved one).
// If nothing matches, intent is '' and the AI classifies the message.
function fastRules(message) {
  const m = (message || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const HINGLISH = /\b(hai|hain|hu|hoon|kya|kal|aaj|subah|shaam|sham|raat|karo|karna|karu|mein|nahi|kitna|kitne|ji|bhai|aap|aapka|batao|chahiye|kaise|kab|wala|aaunga|aaungi|aayenge|aa raha|aa rahi)\b/;
  const lang = /[ऀ-ॿ]/.test(m) ? 'hinglish' : HINGLISH.test(m) ? 'hinglish' : 'en';

  // When are they coming? Builds a short English phrase like "tomorrow evening at 6 PM".
  function when(text) {
    const day =
      /\b(today|aaj)\b/.test(text) ? 'today' :
      /\b(tomorrow|kal)\b/.test(text) ? 'tomorrow' :
      /\b(tonight)\b/.test(text) ? 'tonight' :
      (text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/) || [])[1] || '';
    const part =
      /\b(morning|subah|savere)\b/.test(text) ? 'morning' :
      /\b(afternoon|dopahar|dophar)\b/.test(text) ? 'afternoon' :
      /\b(evening|shaam|sham)\b/.test(text) ? 'evening' :
      /\b(night|raat)\b/.test(text) && day !== 'tonight' ? 'night' : '';
    const t = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|baje)?\b/);
    let hour = null, at = '';
    if (t && (t[3] || /baje|at|around|by|ko/.test(text))) {
      hour = Number(t[1]);
      const min = t[2] ? ':' + t[2] : '';
      let ap = t[3] === 'am' || t[3] === 'pm' ? t[3] : '';
      if (!ap && part) ap = part === 'morning' ? 'am' : 'pm';
      if (!ap) { // "6 baje" with no morning/evening — don't guess AM or PM
        at = hour >= 1 && hour <= 12 ? `${hour}${min}` : '';
        hour = null;
      } else if (hour >= 1 && hour <= 12) {
        at = `${hour}${min} ${ap.toUpperCase()}`;
        hour = ap === 'pm' && hour !== 12 ? hour + 12 : ap === 'am' && hour === 12 ? 0 : hour;
      } else { hour = null; }
    }
    const prep = (text.match(/\b(after|before|around|by)\s+\d/) || [])[1] || 'at';
    const phrase = [day, part && !(day === 'tonight') ? part : '', at ? prep + ' ' + at : ''].filter(Boolean).join(' ');
    return { phrase: phrase.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/, d => d[0].toUpperCase() + d.slice(1)), day, part, hour };
  }

  // Opening hours: Mon–Sat 5 AM–11 PM, Sun 12–9 PM.
  function outsideHours(w) {
    if (w.hour == null) return w.day === 'sunday' && w.part === 'morning';
    if (w.day === 'sunday') return w.hour < 12 || w.hour >= 21;
    return w.hour < 5 || w.hour >= 23;
  }

  const RX = {
    callback: /\b(call ?me|call back|callback|ring me|phone (kar|karo|karna|kijiye)|call (kar|karo|karna|kijiye|karein|karu|kar sakte)|mujhe call)\b/,
    visit: /\b(aa(u|o)nga|aa(u|o)ngi|aayenge|aaenge|aa (raha|rahi|rahe)|aata (hu|hoon)|aati (hu|hoon)|pahunch\w*|i'?ll come|we'?ll come|will come|i'?ll visit|we'?ll visit|will visit|will drop|i'?ll drop|drop (in|by)|come (by|over|today|tomorrow|in the)|coming (today|tomorrow|tonight|in the|at|on|this|next|around|by))\b/,
    human: /\b(human|real person|agent|manager|koi hai|baat kar(ni|na)|talk to (someone|the team|a person|team))\b/,
    timing: /\b(baje|timing|timings|time kya|kab (khul|band)|open|close)\b/,
    price: /\b(price|prices|pricing|how much|fee|fees|kitn[aei]|cost|charges?|rate|package|membership (fee|cost|price))\b/,
  };

  // A short reply that is just a slot ("tomorrow evening at 7", "Saturday 7 AM", "kal subah 7 baje")
  // answers "which day suits you?" — treat it as a visit plan. Questions and price/timing asks are not.
  function slotOnly(text) {
    if (/\?/.test(text) || text.split(' ').length > 7 || RX.price.test(text) || RX.timing.test(text.replace(/\bbaje\b/g, ''))) return false;
    const x = when(text);
    return !!x.day && x.day !== 'tonight' ? !!(x.part || /\d/.test(x.phrase)) : x.day === 'tonight';
  }

  let intent = '';
  let w = { phrase: '', day: '', part: '', hour: null };
  // A typed Indian mobile number (usually the answer to "type your number") → log it and alert the desk.
  const num = m.replace(/[\s-]/g, '').match(/(?:\+?91)?([6-9]\d{9})(?!\d)/);
  const sharedPhone = num ? num[1] : '';
  if (sharedPhone) { intent = 'phone_shared'; w = when(m.replace(/(?:\+?91[\s-]*)?[6-9](?:[\s-]*\d){9}/, ' ')); }
  else if (RX.callback.test(m)) intent = 'callback';
  else if (RX.visit.test(m)) { intent = 'visit_plan'; w = when(m); }
  else if (slotOnly(m)) { intent = 'visit_plan'; w = when(m); }
  else if (RX.human.test(m)) intent = 'human';
  else if (RX.price.test(m) && !RX.timing.test(m)) intent = 'price';

  return {
    lang,
    intent,
    source: intent ? 'rules' : 'ai',
    when: w.phrase,
    sharedPhone,
    hoursConflict: intent === 'visit_plan' ? outsideHours(w) : false,
  };
}

// Follow-up copy for Infinity Iconic. Every message: English + Hinglish; key nurture steps have
// A/B variants so the engine can learn which one gets more replies and bookings.
// Placeholders: {hi} greeting with first name, {when} session phrase, {time} clock time,
// {map} map link, {offer_line} current offer sentence (empty after it ends), {review} review link.

const PLACE = {
  address: '2nd Floor, Plot 4P, Main Bypass Road, above Mittal Foam House, near Amolik Chowk, Sector 86',
  map: 'https://www.google.com/maps/search/?api=1&query=INFINITY+GYM+BY+EQ+ICONIC&query_place_id=ChIJYTG1AgDdDDkRoW254Z2Ly4A',
  review: 'https://search.google.com/local/writereview?placeid=ChIJYTG1AgDdDDkRoW254Z2Ly4A',
  hours: 'Mon–Sat 5 AM–11 PM · Sun 12–9 PM',
  desk: '+91 99530 04008',
};

// Offer shown in follow-ups; lines disappear automatically after `ends`.
const OFFER = {
  ends: '2026-10-31T23:59:59+05:30',
  en: '🪔 Diwali special: 14 months for the price of 12, only till 31 Oct.',
  hinglish: '🪔 Diwali special: 12 mahine ki keemat mein 14 mahine, sirf 31 Oct tak.',
};

// kind: 'nurture' (marketing template outside 24h) · 'utility' (booking/visit/member service template)
const COPY = {
  // ── New lead, no booking yet ─────────────────────────────────────────────
  new_30m: { kind: 'nurture', label: '30 min after their last message', variants: {
    A: { en: "{hi} 👋 just checking you got everything you needed. Would you like to come in for a *free session* this week? Tell me a day and time — morning or evening 🙂",
         hinglish: "{hi} 👋 bas check kar raha tha ki aapko sab info mil gayi? Is hafte *free session* ke liye aana chahenge? Bas din aur time bata dijiye — subah ya shaam 🙂" },
    B: { en: "{hi}, quick one — most people decide within 15 minutes of seeing the place 💪 Shall I keep a *free session* for you? Reply with a time, or type *CALL ME*.",
         hinglish: "{hi}, ek chhoti si baat — zyada log gym dekhte hi 15 minute mein decide kar lete hain 💪 Aapke liye *free session* rakh doon? Time bata dijiye, ya *CALL ME* likhiye." } } },
  new_ig_last: { kind: 'nurture', label: 'Instagram · before the 24 h window closes', channels: ['ig', 'fb'], variants: {
    A: { en: "{hi}, I can only message you here for a little longer 🙂 Want the details on WhatsApp instead? Send your number and our team will share timings, plans and your *free session*.",
         hinglish: "{hi}, yahan main thodi der hi message kar sakta hoon 🙂 WhatsApp par details chahiye? Apna number bhej dijiye — team timings, plans aur *free session* share kar degi." } } },
  new_d1: { kind: 'nurture', label: 'Day 1 · free session + value', variants: {
    A: { en: "{hi} 👋 Infinity Iconic, Sector 86 here. Your first session is on us — a coach shows you around, checks your goal and sets up your first workout. Mornings from 5 AM, evenings till 11 PM. Which day suits you?",
         hinglish: "{hi} 👋 Infinity Iconic, Sector 86 se. Aapka pehla session free hai — coach gym dikhayenge, goal samjhenge aur pehla workout set karenge. Subah 5 baje se raat 11 tak. Kaunsa din theek rahega?" },
    B: { en: "{hi}, quick question — what's your main goal right now: weight loss, strength, or just getting consistent? Tell me and I'll suggest the best batch and trainer for you 🙂",
         hinglish: "{hi}, ek sawaal — abhi aapka main goal kya hai: weight loss, strength, ya bas regular hona? Bataiye, main aapke liye best batch aur trainer suggest kar dunga 🙂" } } },
  new_d3: { kind: 'nurture', label: 'Day 3 · social proof', variants: {
    A: { en: "{hi} — our members say the rooftop CrossFit and 50+ classes a month are what keep them coming back 🔥 Try one free this week. Reply with a day, or type *CALL ME*.",
         hinglish: "{hi} — hamare members kehte hain rooftop CrossFit aur mahine ki 50+ classes hi unhe roz wapas laati hain 🔥 Is hafte ek class free try kijiye. Din bataiye, ya *CALL ME* likhiye." },
    B: { en: "{hi}, not sure which plan fits you? Our team does a free 2-minute call to suggest one — no pressure. Want a call? Just reply *YES*.",
         hinglish: "{hi}, plan samajh nahi aa raha? Hamari team 2 minute ki free call par sahi plan suggest kar deti hai — koi pressure nahi. Call chahiye? Bas *YES* likhiye." } } },
  new_d7: { kind: 'nurture', label: 'Day 7 · urgency or objection', variants: {
    A: { en: "{hi} {offer_line_or_fresh} Shall I keep a *free session* slot for you this week?",
         hinglish: "{hi} {offer_line_or_fresh} Is hafte aapke liye *free session* ka slot rakh doon?" },
    B: { en: "{hi}, honest question — is anything stopping you from starting? Timing, budget, or just not sure yet? Tell me and I'll help sort it out 🙂",
         hinglish: "{hi}, seedha sawaal — shuru karne mein kya rok raha hai? Timing, budget, ya abhi pakka nahi? Bataiye, hum milkar solve kar lenge 🙂" } } },
  new_d14: { kind: 'nurture', label: 'Day 14 · polite break-up', variants: {
    A: { en: "{hi}, I don't want to keep messaging if now isn't the right time 🙂 Shall I close your enquiry, or keep a free session open for you? Reply *KEEP* or *CLOSE*.",
         hinglish: "{hi}, agar abhi sahi time nahi hai to main baar-baar message nahi karna chahta 🙂 Aapki enquiry band kar doon, ya free session open rakhoon? *KEEP* ya *CLOSE* likhiye." } } },
  new_d30: { kind: 'nurture', label: 'Day 30 · re-engage', variants: {
    A: { en: "{hi} 👋 it's been a while! Whenever you're ready, your free session at Infinity Iconic is still open. Reply with a day and we'll set it up.",
         hinglish: "{hi} 👋 kaafi din ho gaye! Jab bhi aap ready hon, Infinity Iconic mein aapka free session abhi bhi open hai. Din bataiye, hum set kar denge." } } },

  // ── Session booked ───────────────────────────────────────────────────────
  book_eve: { kind: 'utility', label: 'Evening before the session (7:30 PM)', variants: {
    A: { en: "{hi} 👋 see you {when} at Infinity Iconic!\n📍 {address} · valet parking at the door.\nBring water and comfortable shoes 💪 Need a different time? Just reply.",
         hinglish: "{hi} 👋 {when} milte hain Infinity Iconic par!\n📍 {address} · valet parking hai.\nPaani ki bottle aur comfortable shoes le aaiye 💪 Time badalna ho to bas reply kar dijiye." } } },
  book_3h: { kind: 'utility', label: '3 hours before the session', variants: {
    A: { en: "{hi}, your free session is in about 3 hours ({time}). Our front desk is expecting you 🙂 Reply *1* to confirm or *2* to change the time.",
         hinglish: "{hi}, aapka free session lagbhag 3 ghante mein hai ({time}). Front desk aapka intezaar kar raha hai 🙂 Confirm ke liye *1*, time badalne ke liye *2* likhiye." } } },
  book_1h: { kind: 'utility', label: '1 hour before the session', variants: {
    A: { en: "See you in an hour{comma_name}! 🗺️ {map}\nValet parking at the door — ask for the front desk when you arrive.",
         hinglish: "Ek ghante mein milte hain{comma_name}! 🗺️ {map}\nValet parking hai — pahunch kar front desk par puchiye." } } },
  book_after: { kind: 'utility', label: '3 hours after the session', variants: {
    A: { en: "{hi}, how was your session? 🙂 If you couldn't make it, no worries — reply with a new day and time and we'll set it up again.",
         hinglish: "{hi}, session kaisa raha? 🙂 Agar aa nahi paaye to koi baat nahi — naya din aur time bata dijiye, hum phir se set kar denge." } } },

  // ── Visited, not joined (front desk marks "Visited") ────────────────────
  vis_2h: { kind: 'utility', label: 'After the visit (same evening or next morning)', variants: {
    A: { en: "Thanks for visiting Infinity Iconic{comma_name} 🙌 Hope you enjoyed it! Any questions about plans or timings, just ask here. {offer_line}",
         hinglish: "Infinity Iconic aane ke liye shukriya{comma_name} 🙌 Umeed hai accha laga! Plans ya timings ke baare mein kuch bhi poochna ho, yahin likhiye. {offer_line}" } } },
  vis_d1: { kind: 'nurture', label: 'Day 1 after visit', variants: {
    A: { en: "{hi}, had a chance to think it over? I can ask the team to hold your plan and price for you — just reply *HOLD*.",
         hinglish: "{hi}, sochne ka mauka mila? Main team se aapka plan aur price hold karwa sakta hoon — bas *HOLD* likhiye." },
    B: { en: "{hi}, what did you like most at Infinity — the trainers, the classes or the space? And is there anything holding you back? 🙂",
         hinglish: "{hi}, Infinity mein sabse accha kya laga — trainers, classes ya space? Aur kya kuch hai jo rok raha hai? 🙂" } } },
  vis_d3: { kind: 'nurture', label: 'Day 3 after visit · social proof', variants: {
    A: { en: "{hi} — most members say the first two weeks are the hardest, and our coaches check in with you every session to make them easy 💪 Ready to start? Reply *JOIN* and the desk will set it up.",
         hinglish: "{hi} — members kehte hain pehle do hafte sabse mushkil hote hain, isliye hamare coaches har session mein aapke saath rehte hain 💪 Shuru karein? *JOIN* likhiye, desk set kar dega." } } },
  vis_d6: { kind: 'nurture', label: 'Day 6 after visit · urgency', variants: {
    A: { en: "{hi} {offer_line_or_fresh} Want the team to lock in your plan? Reply *JOIN*.",
         hinglish: "{hi} {offer_line_or_fresh} Team aapka plan lock kar de? *JOIN* likhiye." } } },
  vis_d14: { kind: 'nurture', label: 'Day 14 after visit · break-up', variants: {
    A: { en: "{hi}, I'll stop following up after this 🙂 If you'd still like to join, reply *JOIN* anytime and we'll take it from there. Wishing you the best either way!",
         hinglish: "{hi}, iske baad main follow-up nahi karunga 🙂 Join karna ho to kabhi bhi *JOIN* likhiye, hum sambhal lenge. Dono hi surat mein all the best!" } } },

  // ── Joined (front desk marks "Joined") ───────────────────────────────────
  join_1h: { kind: 'utility', label: 'Welcome, 1 hour after joining', variants: {
    A: { en: "Welcome to Infinity Iconic{comma_name}! 🎉 Your coach will set up your plan on day one. Timings: {hours}. Save this number — message us anytime.",
         hinglish: "Infinity Iconic mein swagat hai{comma_name}! 🎉 Pehle din coach aapka plan set karenge. Timings: {hours}. Ye number save kar lijiye — kabhi bhi message kijiye." } } },
  join_d7: { kind: 'utility', label: 'Day 7 check-in', variants: {
    A: { en: "{hi}, one week in! 💪 How's it going? If anything isn't right — timing, trainer or equipment — tell me and we'll fix it.",
         hinglish: "{hi}, ek hafta ho gaya! 💪 Kaisa chal raha hai? Timing, trainer ya equipment mein kuch theek na lage to bataiye, hum fix kar denge." } } },
  join_d30: { kind: 'nurture', label: 'Day 30 · review + referral', variants: {
    A: { en: "{hi}, one month at Infinity! 🙌 If you're enjoying it, a quick Google review would mean a lot: {review}\nAnd bring a friend for a free session anytime.",
         hinglish: "{hi}, Infinity mein ek mahina ho gaya! 🙌 Accha lag raha ho to ek chhota sa Google review de dijiye: {review}\nAur kisi dost ko free session ke liye kabhi bhi laaiye." } } },

  // ── Opt-out confirmation (sent once, then nothing) ─────────────────────
  optout_ack: { kind: 'utility', label: 'After they opt out', variants: {
    A: { en: "No problem{comma_name} — we won't message again. If you ever want a free session, just say hi 🙂",
         hinglish: "Koi baat nahi{comma_name} — hum dobara message nahi karenge. Kabhi free session chahiye ho to bas hi likhiye 🙂" } } },
};

function offerLines(now, lang) {
  const live = now <= new Date(OFFER.ends);
  const line = live ? OFFER[lang === 'hinglish' ? 'hinglish' : 'en'] : '';
  const fresh = lang === 'hinglish' ? ', naya mahina, nayi shuruaat 💪 Free session ke slots khule hain — subah aur shaam.' : ', new month, fresh start 💪 Free session slots are open — mornings and evenings.';
  return { line, orFresh: line || fresh };
}

function render(stepId, variant, lead, now, extra = {}) {
  const step = COPY[stepId];
  const v = step.variants[variant] || step.variants.A;
  const lang = lead.lang === 'hinglish' ? 'hinglish' : 'en';
  const first = (lead.name || '').trim().split(/\s+/)[0] || '';
  const { line, orFresh } = offerLines(now, lang);
  const map = {
    hi: first ? `Hi ${first}` : 'Hi', comma_name: first ? `, ${first}` : '',
    when: extra.when || (lang === 'hinglish' ? 'jaldi' : 'soon'), time: extra.time || '',
    address: PLACE.address, map: PLACE.map, review: PLACE.review, hours: PLACE.hours, desk: PLACE.desk,
    offer_line: line, offer_line_or_fresh: orFresh,
  };
  return v[lang].replace(/\{(\w+)\}/g, (_, k) => map[k] ?? '').replace(/ +\n/g, '\n').replace(/\s+$/,'').replace(/ {2,}/g, ' ').replace(/ ,/g, ',');
}

// Infinity follow-up engine — decides WHAT to send, WHEN, and HOW (free-form vs template),
// for every lead, from a small state object. Pure functions: no I/O, so the same code runs in
// Vercel, in Google Apps Script (the scheduler) and in the browser simulator.
//
// Stages:  new → booked → visited → joined      (any stage → optout / closed)
// Rules:   stop on reply (nurture clock restarts from their last message), stop on opt-out,
//          quiet hours, ≥3 h between messages (reminders excepted), ≤1 nurture per 20 h,
//          WhatsApp: free-form inside 24 h of their last message, approved template after;
//          Instagram/Messenger: only inside the 24 h window (no messages after it closes).


const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const IST = 330 * MIN; // UTC+05:30, no daylight saving

// ── time helpers (all decisions in India time) ─────────────────────────────
function istParts(d) { const t = new Date(d.getTime() + IST); return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), dow: t.getUTCDay() }; }
function istDate(y, mo, d, h, mi = 0) { return new Date(Date.UTC(y, mo, d, h, mi) - IST); }
function dayStart(d, addDays = 0) { const p = istParts(d); return istDate(p.y, p.mo, p.d + addDays, 0, 0); }
function at(d, h, mi = 0, addDays = 0) { const p = istParts(d); return istDate(p.y, p.mo, p.d + addDays, h, mi); }
const hm = d => { const p = istParts(d); return p.h + p.mi / 60; };
function fmtTime(d) { const p = istParts(d); const h12 = ((p.h + 11) % 12) + 1; return `${h12}${p.mi ? ':' + String(p.mi).padStart(2, '0') : ''} ${p.h < 12 ? 'AM' : 'PM'}`; }
function fmtWhen(d, from, lang = 'en') {
  const days = Math.round((dayStart(d) - dayStart(from)) / DAY);
  const p = istParts(d); const hi = lang === 'hinglish';
  const dayWord = days === 0 ? (hi ? 'aaj' : 'today') : days === 1 ? (hi ? 'kal' : 'tomorrow')
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.dow] + (hi ? ' ko' : '');
  return hi ? `${dayWord} ${fmtTime(d)} baje`.replace(' AM baje', ' baje subah').replace(' PM baje', ' baje') : `${dayWord} at ${fmtTime(d)}`;
}

// Quiet hours (India time). Nurture never at night; reminders may go early for early sessions.
const WINDOWS = { nurture: [10, 20.5], active: [8, 22.5], reminder: [5, 21.5] };
function fitWindow(due, kind, prefHour) {
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
function parseSession(phrase, from) {
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
const SEQUENCES = {
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
const ALL_STEPS = Object.entries(SEQUENCES).flatMap(([stage, s]) => s.map(x => ({ stage, ...x })));

// ── lead state ────────────────────────────────────────────────────────────
function newLead({ id, name = '', phone = '', channel = 'wa', lang = 'en', at }) {
  const t = new Date(at).toISOString();
  return { id: String(id || phone || name), name, phone, channel, lang, stage: 'new', stageAt: t, firstInbound: t, lastInbound: t, lastOutbound: null, lastNurture: null, session: null, sent: {}, skipped: {}, history: [], lastStep: null };
}

const OPTOUT = /\b(stop|unsubscribe|not interested|no thanks|don'?t message|band karo|mat bhejo|nahi chahiye|interest nahi)\b/i;
function applyEvent(lead, ev) {
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
const LEARN = { minSends: 20, explore: 0.15, bookedWeight: 3 };
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function pickVariant(copyId, leadId, stats = {}) {
  const vs = Object.keys(COPY[copyId].variants); if (vs.length === 1) return vs[0];
  const st = vs.map(v => ({ v, ...(stats[copyId]?.[v] || {}), sent: stats[copyId]?.[v]?.sent || 0 }));
  const under = st.filter(x => x.sent < LEARN.minSends);
  if (under.length) return under.sort((a, b) => a.sent - b.sent || hash(leadId + a.v) - hash(leadId + b.v))[0].v;
  if (hash(leadId + copyId) < LEARN.explore) return vs[Math.floor(hash(copyId + leadId) * vs.length)];
  const score = x => ((x.replied || 0) + LEARN.bookedWeight * (x.booked || 0)) / x.sent;
  return st.sort((a, b) => score(b) - score(a))[0].v;
}

// ── channel rules ─────────────────────────────────────────────────────────
const PRICE_INR = { free_form: 0, utility: 0.145, marketing: 1.09 }; // Meta India rates from 1 Oct 2026; first 1,000 service messages/month free
function deliveryFor(lead, kind, now) {
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
function plan(lead, now, stats = {}) {
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
function markSent(lead, action, now) {
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

return { fastRules, newLead, applyEvent, plan, markSent, parseSession, istParts, fmtTime, fmtWhen, COPY, SEQUENCES };
})();
