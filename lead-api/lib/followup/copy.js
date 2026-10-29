// Follow-up copy for Infinity Iconic. Every message: English + Hinglish; key nurture steps have
// A/B variants so the engine can learn which one gets more replies and bookings.
// Placeholders: {hi} greeting with first name, {when} session phrase, {time} clock time,
// {map} map link, {offer_line} current offer sentence (empty after it ends), {review} review link.

export const PLACE = {
  address: '2nd Floor, Plot 4P, Main Bypass Road, above Mittal Foam House, near Amolik Chowk, Sector 86',
  map: 'https://www.google.com/maps/search/?api=1&query=INFINITY+GYM+BY+EQ+ICONIC&query_place_id=ChIJYTG1AgDdDDkRoW254Z2Ly4A',
  review: 'https://search.google.com/local/writereview?placeid=ChIJYTG1AgDdDDkRoW254Z2Ly4A',
  hours: 'Mon–Sat 5 AM–11 PM · Sun 12–9 PM',
  desk: '+91 99530 04008',
};

// Offer shown in follow-ups; lines disappear automatically after `ends`.
export const OFFER = {
  ends: '2026-10-31T23:59:59+05:30',
  en: '🪔 Diwali special: 14 months for the price of 12, only till 31 Oct.',
  hinglish: '🪔 Diwali special: 12 mahine ki keemat mein 14 mahine, sirf 31 Oct tak.',
};

// kind: 'nurture' (marketing template outside 24h) · 'utility' (booking/visit/member service template)
export const COPY = {
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

export function offerLines(now, lang) {
  const live = now <= new Date(OFFER.ends);
  const line = live ? OFFER[lang === 'hinglish' ? 'hinglish' : 'en'] : '';
  const fresh = lang === 'hinglish' ? ', naya mahina, nayi shuruaat 💪 Free session ke slots khule hain — subah aur shaam.' : ', new month, fresh start 💪 Free session slots are open — mornings and evenings.';
  return { line, orFresh: line || fresh };
}

export function render(stepId, variant, lead, now, extra = {}) {
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
