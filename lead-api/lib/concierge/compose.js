// Compose the reply from approved templates, decide whether to hand over
// to the team, and whether the front desk needs an alert.
// ─── Edit these when details change ───────────────────────────────────────
const OFFER_TEXT = { en: '14 months for the price of 12', hinglish: '12 mahine ki keemat mein 14 mahine' };
const OFFER_ENDS = '2026-10-31T23:59:59+05:30';   // offer lines disappear automatically after this
const OFFER_END_LABEL = '31 Oct';
const ADDRESS = '2nd Floor, Plot 4P, Main Bypass Road, above Mittal Foam House, near Amolik Chowk, Sector 86';
const MAP = 'https://www.google.com/maps/search/?api=1&query=INFINITY+GYM+BY+EQ+ICONIC&query_place_id=ChIJYTG1AgDdDDkRoW254Z2Ly4A';
const HOURS = 'Mon–Sat 5 AM–11 PM · Sun 12–9 PM';
const DESK = '+91 99530 04008';
// ──────────────────────────────────────────────────────────────────────────

export function compose(j, now = new Date()) {
  const H = j.lang === 'hinglish';
  // Visit time in Hinglish: "tomorrow evening at 6 PM" → "kal shaam 6 baje"
  const hiWhen = w => w.toLowerCase()
    .replace(/\btomorrow\b/, 'kal').replace(/\btoday\b/, 'aaj').replace(/\btonight\b/, 'aaj raat')
    .replace(/\bthis evening\b/, 'aaj shaam').replace(/\bthis morning\b/, 'aaj subah')
    .replace(/\bmorning\b/, 'subah').replace(/\bevening\b/, 'shaam').replace(/\bafternoon\b/, 'dopahar').replace(/\bnight\b/, 'raat')
    .replace(/\bat (\d{1,2}(?::\d{2})?)\s*(am|pm)?/, (_, t) => t + ' baje')
    .replace(/\bafter (\d{1,2}(?::\d{2})?)\s*(am|pm)?/, (_, t) => t + ' baje ke baad').replace(/\b(?:around|by|before) (\d{1,2}(?::\d{2})?)\s*(am|pm)?/, (_, t) => t + ' baje tak')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/, d => d[0].toUpperCase() + d.slice(1) + ' ko');
  const WHEN = j.when ? (H ? hiWhen(j.when).replace(/^(subah|shaam|dopahar|raat)$/, '$1 ko') : j.when) : '';
  const offerLive = now <= new Date(OFFER_ENDS);
  const first = (j.name || '').split(' ')[0];
  const hasPhone = /\d{10}/.test(j.phone || '');
  const hoursNote = j.hoursConflict
    ? (H ? `\n\nℹ️ Ek chhota note: hamare timings ${HOURS} hain — team aapke liye sahi time set kar degi.`
         : `\n\nℹ️ Quick note: we're open ${HOURS} — the team will help you pick a time that works.`)
    : '';
  const offerLine = offerLive
    ? (H ? `\n\n🪔 *Diwali special:* ${OFFER_TEXT.hinglish} — sirf *${OFFER_END_LABEL}* tak.`
         : `\n\n🪔 *Diwali special:* ${OFFER_TEXT.en} — only till *${OFFER_END_LABEL}*.`)
    : '';
  const place = `📍 ${ADDRESS}\n🗺️ ${MAP}\n🕔 ${HOURS}`;
  const MENU_HINT = H
    ? 'Bas likhiye: *price*, *offer*, *location*, *timings* — ya bataiye aap kab aana chahenge 🙂'
    : 'Just type *price*, *offer*, *location* or *timings* — or tell us when you\'d like to drop in 🙂';

  // Never let a written reply contain a price.
  const hasPrice = s => /₹|\brs\.?\s*\d|\binr\b|\d[\d,]{2,}\s*(\/-|rupees|per month|a month|\/month|pm\b)/i.test(s);

  const T = {
    visit_plan: () => (H
      ? `Shukriya batane ke liye${WHEN ? ` ki aap *${WHEN}* aa rahe hain` : ' ki aap gym aa rahe hain'} 🙌\n\nFront desk par hamare executive aapka welcome karenge, gym ka tour denge aur membership options aur pricing aaram se samjhayenge.\n\n${place}\n\nPehle call par baat karni ho? Bas *CALL ME* likh dijiye.`
      : `Thank you for letting us know${j.when ? ` you'll drop in *${j.when}*` : ' you\'ll drop in'} 🙌\n\nOne of our executives will be at the front desk to welcome you, show you around the gym and help you with membership options and pricing.\n\n${place}\n\nWould you like to speak on a call first? Just type *CALL ME*.`) + hoursNote,
    callback: () => hasPhone
      ? (H ? `Zaroor 📞 Hamari team isi number par aapko jaldi call karegi. Koi khaas time ho to likh dijiye (jaise *aaj 6 baje*).\n\nAbhi baat karni ho? *${DESK}* (${HOURS}).`
           : `Of course 📞 Our team will call you on this number shortly. If a particular time suits you, just type it (e.g. *today 6 PM*).\n\nPrefer to call now? *${DESK}* (${HOURS}).`)
      : (H ? `Zaroor 📞 Apna *mobile number* aur call ka sahi *time* likh dijiye — hamari team aapko call karegi.\n\nAbhi baat karni ho? *${DESK}* (${HOURS}).`
           : `Of course 📞 Just type your *mobile number* and a good *time* — our team will call you.\n\nPrefer to call now? *${DESK}* (${HOURS}).`),
    phone_shared: () => H
      ? `Shukriya${first ? ' ' + first : ''} 🙌 Number mil gaya — hamari team${WHEN ? ` *${WHEN}*` : ' jaldi'} aapko call karegi.\n\nTab tak koi sawaal ho to yahin likhiye.`
      : `Thanks${first ? ' ' + first : ''} 🙌 Got your number — our team will call you${j.when ? ` *${j.when}*` : ' shortly'}.\n\nAnything you'd like to know meanwhile? Just ask here.`,
    price: () => (H
      ? `Accha sawaal 🙂 Hamari membership lagbhag *₹1,000–1,300 mahina* padti hai — exact price aapke plan, duration aur add-ons (personal training, physio, couple/family pass) par depend karti hai.`
      : `Great question 🙂 Our memberships work out to roughly *₹1,000–1,300 a month* — the exact price depends on your plan, duration and what you'd like included (personal training, physio, couple or family passes).`)
      + offerLine
      + (H ? `\n\nSahi plan sahi price par mile, isliye exact pricing hamari team personally batati hai — call par, chat par, ya jab aap *free session* ke liye aayein 💪 *CALL ME* likhiye ya bataiye kab aayenge.`
           : `\n\nTo make sure you get the right plan at the best price, our team shares exact pricing personally — on a quick call or when you drop in for your *free session* 💪 Type *CALL ME*, or tell us when you'd like to visit.`),
    offer: () => offerLive
      ? (H ? `🪔 *Diwali special — ${OFFER_TEXT.hinglish}*, sirf *${OFFER_END_LABEL}* tak.\n\nHar plan mein physio support, body-composition scan, steam, valet parking aur mahine ki 50+ group classes. Couple aur family pass par aur bachat.\n\nExact price ke liye *CALL ME* likhiye, ya bataiye kab *free session* ke liye aayenge 💪`
           : `🪔 *Diwali special — ${OFFER_TEXT.en}*, only till *${OFFER_END_LABEL}*.\n\nEvery plan includes physio support, body-composition scans, steam, valet parking and 50+ group classes a month. Couple and family passes save even more.\n\nFor exact pricing, type *CALL ME* — or tell us when you'd like to drop in for a *free session* 💪`)
      : (H ? `Diwali offer ab khatam ho gaya hai, par nayi membership par team ke paas hamesha kuch na kuch hota hai 🙂 *CALL ME* likhiye, ya bataiye kab *free session* ke liye aayenge.`
           : `Our Diwali offer has ended, but the team always has something for new members 🙂 Type *CALL ME*, or tell us when you'd like to drop in for a *free session*.`),
    location: () => (H ? `Hum yahan hain 👇\n\n${place}\n🚗 Valet parking\n\nKabhi bhi aaiye — pehla session free hai 🙂`
                       : `Here's where to find us 👇\n\n${place}\n🚗 Valet parking at the door\n\nCome by anytime — your first session is free 🙂`),
    timings: () => (H ? `🕔 Hum *Mon–Sat subah 5 – raat 11* aur *Sunday 12 – 9* khule rehte hain — morning, evening aur weekend batches.\n\n📍 ${ADDRESS}\n\nBataiye kab aayenge — pehla session free hai 🙂`
                      : `🕔 We're open *Mon–Sat 5 AM – 11 PM* and *Sunday 12 – 9 PM* — morning, evening and weekend batches.\n\n📍 ${ADDRESS}\n\nTell us when you'd like to drop in — your first session is free 🙂`),
    classes: () => (H ? `🔥 *HYROX aur rooftop CrossFit*\n💃 *Mahine ki 50+ group classes* — Zumba, yoga, functional, ladies-only batches female trainers ke saath\n🧑‍⚕️ *Personal training, diet aur in-house physio*\n\nEk class free try karni hai? Bataiye kab aayenge 💪`
                      : `🔥 *HYROX & rooftop CrossFit*\n💃 *50+ group classes a month* — Zumba, yoga, functional, ladies-only batches with female trainers\n🧑‍⚕️ *Personal training, diet & in-house physio*\n\nWant to try a class free? Tell us when you'd like to come 💪`),
    facilities: () => (H ? `✨ 10,000 sq ft premium gym — strength, cardio, functional aur rooftop zone.\n🧖 Steam, showers, lockers, changing rooms · ❄️ fully AC · 🚗 valet parking.\n\nKhud dekhiye — pehla session free hai. Bataiye kab aayenge 🙂`
                         : `✨ 10,000 sq ft of premium kit — strength, cardio, functional and a rooftop zone.\n🧖 Steam, showers, lockers and changing rooms · ❄️ fully air-conditioned · 🚗 valet parking.\n\nBest seen in person — your first session is free. When would you like to come? 🙂`),
    member_service: () => (H ? `Infinity family ka hissa banne ke liye shukriya 💪 Main ye hamari membership desk ko de raha hoon — woh yahin jaldi reply karenge.\n\nUrgent ho to call karein: *${DESK}*.`
                             : `Thanks for being part of Infinity 💪 I'm passing this to our membership desk — they'll reply here shortly.\n\nUrgent? Call *${DESK}*.`),
    complaint: () => (H ? `Iske liye sach mein maafi chahte hain 🙏 Maine ye seedha hamare manager ko bhej diya hai — woh yahin jaldi aapse baat karenge.\n\nUrgent ho to: *${DESK}*.`
                        : `We're really sorry about this 🙏 I've passed it straight to our manager — they'll get back to you here shortly.\n\nIf it's urgent, please call *${DESK}*.`),
    human: () => (H ? `Zaroor 🙌 Team ko bata diya hai — koi yahin jaldi reply karega (${HOURS}).\n\nJaldi ho to call karein: *${DESK}*.`
                    : `Sure 🙌 I've let the team know — someone will reply right here shortly (${HOURS}).\n\nIn a hurry? Call *${DESK}*.`),
    greeting: () => (H ? `Namaste${first ? ' ' + first : ''} 👋 *Infinity Iconic* mein swagat hai — Sector 86 ka 10,000 sq ft premium gym.${offerLine}\n\n${MENU_HINT}`
                       : `Hey${first ? ' ' + first : ''} 👋 Welcome to *Infinity Iconic* — Sector 86's 10,000 sq ft premium gym.${offerLine}\n\n${MENU_HINT}`),
    thanks: () => (H ? `Aapka swagat hai 🙌 Kabhi bhi zarurat ho, hum yahin hain. Bas bataiye kab aana chahenge 🙂`
                     : `Anytime 🙌 We're here whenever you need us — just tell us when you'd like to drop in 🙂`),
    other_question: () => {
      const r = (j.aiReply || '').trim();
      if (hasPrice(r)) return T.price();   // it was really a price question — give the approved range
      if (!r) return T.unclear();
      return r + (H ? `\n\nKhud dekhna ho to bataiye kab aayenge — pehla session free hai 🙂` : `\n\nWant to see it for yourself? Tell us when you'd like to drop in — your first session is free 🙂`);
    },
    unclear: () => (H ? `Hey 👋 Main yahan madad ke liye hoon. ${MENU_HINT}\n\nTeam se baat karni ho to *human* likhiye.`
                      : `Hey 👋 Here's how I can help. ${MENU_HINT}\n\nTo chat with our team, type *human*.`),
  };

  const intent = T[j.intent] ? j.intent : 'unclear';
  const message = T[intent]();
  const HANDOFF = ['callback', 'phone_shared', 'member_service', 'complaint', 'human'];
  const ALERT = ['visit_plan', 'callback', 'phone_shared', 'member_service', 'complaint', 'human'];

  const lead_attributes = {
    inf_intent: intent,
    inf_lang: j.lang,
    inf_last_msg: (j.message || '').slice(0, 200),
    ...(j.when ? { inf_visit_when: j.when } : {}),
    ...(j.sharedPhone ? { inf_callback_number: j.sharedPhone } : {}),
    ...(HANDOFF.includes(intent) ? { inf_handoff: 'yes' } : {}),
  };

  return {
    intent,
    reply: message,
    alert: ALERT.includes(intent),
    // What EasySocial reads: "message" for the Webhook (n8n) node, "data.body_text" for API Basic Message.
    response: { message, last_response: message, lead_attributes, data: { body_text: message } },
  };
}
