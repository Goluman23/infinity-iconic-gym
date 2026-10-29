// Fast rules: catch the messages that matter most without calling the AI
// (instant, free, and the wording is always the approved one).
// If nothing matches, intent is '' and the AI classifies the message.
export function fastRules(message) {
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

  let intent = '';
  let w = { phrase: '', day: '', part: '', hour: null };
  // A typed Indian mobile number (usually the answer to "type your number") → log it and alert the desk.
  const num = m.replace(/[\s-]/g, '').match(/(?:\+?91)?([6-9]\d{9})(?!\d)/);
  const sharedPhone = num ? num[1] : '';
  if (sharedPhone) { intent = 'phone_shared'; w = when(m.replace(/(?:\+?91[\s-]*)?[6-9](?:[\s-]*\d){9}/, ' ')); }
  else if (RX.callback.test(m)) intent = 'callback';
  else if (RX.visit.test(m)) { intent = 'visit_plan'; w = when(m); }
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
