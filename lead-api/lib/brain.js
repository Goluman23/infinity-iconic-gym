// The "brain": understands any free text a lead sends and decides the reply.
// Stateless — EasySocial passes the lead's fields in the request and saves the
// returned lead_attributes, so the next message has context.
import { SEASONS } from './seasons.js';
import { seasonFor, localParts } from './rules.js';

const NUM1 = '+91 99530 04008', NUM2 = '+91 99530 05008';
const ADDR = '2nd floor, above Mittal Foam House, Amolik Chowk, Sector 86, Faridabad';
const MAPS = 'https://www.google.com/maps/search/?api=1&query=Infinity+Gym+by+EQ+Iconic+Sector+86+Faridabad';

// ---------- understanding ----------
const HINDI = /[ऀ-ॿ]|\b(hai|kya|kitn\w*|kaise|chahiye|karna|mujhe|aapka|nahi|haan|theek|batao|bataiye|koi|kab|kahan)\b/i;
const ENGLISH = /\b(the|what|how|please|can|you|is|are|where|when|my)\b/i;
export const GREET = /^(hi+|hey+|hello+|helo|hlo|hellow|namaste|namaskar|नमस्ते|good (morning|afternoon|evening|night)|gm|sat ?sri ?akal|ram ram|radhe radhe|jai shree krishna|salaam|salam|assalamu ?alaikum|yo|sup|hola|hy|hai)\b[\s,!.?🙏👋]*/i;
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s️‍!?.]+$/u;
const ACK_EMOJI = /^[👍🙏👌✅🙂😊]+$/u;

export function intentOf(text) {
  const s = text.toLowerCase().trim();
  if (/^\s*(stop|unsubscribe|band karo|message mat karo)\s*$|don'?t message|stop messaging/.test(s)) return 'optout';
  if (/\b(idiots?|stupid|fraud|scam|cheat|chor|bakwas|useless|worst|bc|mc|f+u+c+k|wtf|bloody)\b/.test(s)) return 'abuse';
  if (/https?:\/\/|www\.|bit\.ly|\.com\/|t\.me\//.test(s)) return 'link';
  if (/(talk|speak|chat|connect)\s+(to|with)\s+(a\s+|an\s+|some\s*one|any\s*one|real|actual)?\s*(human|person|someone|anyone|staff|manager|owner|agent|executive|coach|trainer|people|team|real person)|\b(real person|human please|agent please|customer care|customer support|insaan se|kisi se baat|baat karni hai|baat karna hai|manager se|owner se|representative)\b|^(human|agent|person|team|support)[\s.!?]*$/.test(s)) return 'human';
  if (/(phone|contact|mobile|whatsapp|your|ka)\s*(no|number|num)\b|\bnumber (do|dijiye|bhejo|please|pls)\b|^(number|phone no|contact no|contact number|contact|mobile no)\s*\??$/.test(s)) return 'number';
  if (/\b(call|ring|phone)\b/.test(s) && /\b(later|in (1|one|an|2|two) ?(hr|hour)|after (an|1|one) hour|ghante)\b/.test(s)) return 'cb_1h';
  if (/\b(call|ring|phone)\b/.test(s) && /\b(evening|shaam|after work|after office|tonight)\b/.test(s)) return 'cb_eve';
  if (/\b(call|ring|phone)\b/.test(s) && /\b(morning|subah|tomorrow|kal)\b/.test(s)) return 'cb_morning';
  if (/\bcall\b|\bcalling\b|\bring me\b|phone kar|call kar|call back|callback|\btalk on (the )?(phone|call)\b|available to talk|can i talk|can we talk/.test(s)) return 'call';
  if (/\b(any ?one|some ?one|any ?body|koi)\s+(available|there|online|hai|here)\b|^(available|are you available|you there|u there|r u there|are you there|online|anyone|koi hai)\s*\??$|\bis (any|some)one (there|available|online)\b/.test(s)) return 'avail';
  if (/\b(are you|r u|is this) (a )?(bot|robot|machine|ai|automated|real)\b|\bbot hai\b/.test(s)) return 'bot';
  if (/\b(cancel|refund|money back|paise wapas)\b/.test(s)) return 'cancel';
  if (/\b(complain|complaint|not happy|unhappy|bad experience|rude|dirty|broken|not working|kharab)\b/.test(s)) return 'complaint';
  if (/discount|cheap|kam kar|less price|offer kam|negotiat|best price|last price/.test(s)) return 'discount';
  if (/physio|rehab/.test(s)) return 'physio';
  if (/injur|\bpain\b|dard|doctor|surgery|knee|back pain|slip disc|fracture|pregnan/.test(s)) return 'injury';
  if (/\b(job|jobs|career|careers|vacanc\w*|hiring|naukri|cv|resume)\b/.test(s)) return 'career';
  if (/corporate|company|office|employees|bulk|society members/.test(s)) return 'corp';
  if (/gurgaon|gurugram|dlf|other branch|branches|another branch|any branch|second branch|more centres|more centers/.test(s)) return 'branch';
  if (/resched|change (my )?(slot|time|timing|session|booking)|postpone|can'?t come|cannot come|won'?t be able|will be late|running late|another (day|slot|time)/.test(s)) return 'reschedule';
  if (/\b(son|daughter|beta|beti|kid|kids|child|children|bachch\w*)\b|\b1[0-7] ?(years|yrs|saal)\b/.test(s)) return 'minor';
  if (/wrong number/.test(s)) return 'wrong';
  if (/who is this|who are you|kaun ho|aap kaun/.test(s)) return 'who';
  if (/\b(i am a member|i'?m a member|already a member|existing member|renew|renewal|freeze|pause|my membership|membership (end|expir)|my locker|attendance|extend)\b/.test(s)) return 'member';
  if (/hyrox|crossfit|cross fit/.test(s)) return 'hyrox';
  if (/zumba|yoga|aerobic|dance|group ?x|class|classes|batch|ladies|female trainer|lady trainer|women/.test(s)) return 'classes';
  if (/\b(pt|personal train\w*|trainer|coach|diet|nutrition)\b/.test(s)) return 'pt';
  if (/physio|rehab|recovery|posture/.test(s)) return 'physio';
  if (/steam|sauna|shower|locker|\bac\b|air con|cafe|café|parking|valet|washroom|changing/.test(s)) return 'facil';
  if (/diwali|holi|christmas|new year|festival|tyohar|holiday|chhutti/.test(s) && /open|timing|band|closed|khula|khul/.test(s)) return 'holiday';
  if (/timing|timings|\bhours\b|open|close|closed|kab|khul|sunday|morning|evening|today/.test(s) && !/book|trial|session/.test(s)) return 'hours';
  if (/location|address|where|kahan|kaha|map|direction|reach|route|how to come|landmark|near/.test(s)) return 'loc';
  if (/which plan|plan fits|best plan|kaunsa plan|kaun sa plan|suit me|recommend/.test(s)) return 'fit';
  if (/fee|fees|price|cost|kitn|rate|plan|offer|charges|paise|membership|package/.test(s)) return 'price';
  if (/trial|session|book|join|visit|aana|demo|tour|start/.test(s)) return 'book';
  if (/not interested|no thanks|nahi chahiye|not now/.test(s)) return 'notint';
  if (/^(thanks|thank you|thanku|thx|ty|tysm|dhanyavaad|shukriya|ok|okay|okk+|k|kk|cool|great|nice|done|noted|sure|alright|theek hai|thik hai|accha|acha)\s*[.!]*$/.test(s) || ACK_EMOJI.test(s)) return 'thanks';
  if (/^(bye|goodbye|see you|tata|ok bye|bye bye)\b/.test(s)) return 'bye';
  if (/^(yes|yeah|yep|yup|haan|ha|han|ji|ji haan|sure|ok sure|please|pls|y)\s*[.!]*$/.test(s)) return 'yes';
  if (/^(no|nope|nah|nahi|na|nahin)\s*[.!]*$/.test(s)) return 'no';
  if (/^[1-9]$/.test(s)) return 'pick';
  if (/^\?+$/.test(s)) return 'menu';
  return null;
}

// ---------- replies ----------
// Every route has text (en/hi) and optional buttons [id, en, hi]. Button ids are route ids,
// so a tapped button comes back as a message the brain routes directly.
// `handoff` marks routes where a person must take over; `flow` asks EasySocial to switch chatflow.
function S(now) { return SEASONS[seasonFor(now)] || SEASONS.evergreen; }
const BTN = {
  book: ['book', 'Book free session', 'Session book karein'],
  price: ['price', 'Plans & offer', 'Plans & offer'],
  loc: ['loc', 'Timings & location', 'Timings & location'],
  human: ['human', 'Talk to a person', 'Kisi se baat'],
  menu: ['menu', 'Quick answers', 'Jaldi jawab'],
  call: ['call', 'Call me', 'Mujhe call karein'],
};
const R = {
  welcome: (c) => ({ en: `Hi ${c.name}! 👋 Welcome to *Infinity Iconic* — Sector 86, Greater Faridabad.\n\n🪔 *Diwali special:* train *14 months for the price of 12* — only till 31 Oct.\n\nBest way to see if we're your gym? Drop in for a *free session* 💪 — or leave your number and we'll call you.`, hi: `Hi ${c.name}! 👋 *Infinity Iconic*, Sector 86 mein aapka swagat hai.\n\n🪔 *Diwali special:* *12 mahine ki keemat mein 14 mahine* — sirf 31 Oct tak.\n\nEk *free session* ke liye aaiye 💪 — ya apna number bhejiye, hum call kar lenge.`, sig: 'स्वागत है।', buttons: [BTN.book, ['cb_later', 'Get a call back', 'Call back karein'], BTN.human], list: true }),
  menu: (c) => ({ en: `How can we help, ${c.name}?`, hi: `Bataiye ${c.name}, kya madad karein?`, buttons: [BTN.book, BTN.price, BTN.human], list: true }),
  again: (c) => ({ en: `Hi again, ${c.name}! 👋 Picking up where we left off —`, hi: `Phir se hi, ${c.name}! 👋 Wahin se shuru karte hain —`, resume: true }),
  ack: () => ({ en: `👍 Whenever you're ready — pick an option, or type your question.`, hi: `👍 Jab aap ready hon — option chunein, ya sawaal likhein.`, resume: true }),
  thanks: (c) => ({ en: `You're welcome, ${c.name}! 😊 Anything else I can help with?`, hi: `Aapka swagat hai, ${c.name}! 😊 Aur kuch madad karein?`, buttons: [BTN.book, BTN.price, ['bye', "That's all", 'Bas itna hi']] }),
  bye: (c) => ({ en: `Have a great day, ${c.name}! 💪 We're here whenever you need us.`, hi: `Aapka din shubh ho, ${c.name}! 💪 Jab bhi zaroorat ho, hum yahin hain.`, sig: 'धन्यवाद।' }),
  avail: (c) => c.night
    ? { en: `Our team is offline right now — back at 5 AM 🌙\n\nI can answer most things instantly, or set up a call first thing in the morning.`, hi: `Team abhi offline hai — subah 5 baje wapas 🌙\n\nZyaadatar sawaalon ka jawab main abhi de sakta hoon, ya subah ki call set kar doon.`, buttons: [BTN.menu, ['cb_morning', 'Call me at 7 AM', 'Subah 7 baje call'], ['leave', 'Leave a message', 'Message chhodein']] }
    : { en: `Yes — we're here! 🙂 Neha from the front desk is online now.\n\nChat here, or would you prefer a call?`, hi: `Haan — hum yahin hain! 🙂 Front desk se Neha abhi online hain.\n\nYahin chat karein, ya call pasand karenge?`, buttons: [['human', 'Chat with Neha', 'Neha se chat'], ['cb_now', 'Call me', 'Mujhe call karein'], BTN.menu] },
  call: (c) => c.night
    ? { en: `Our desk is offline right now (back at 5 AM) 🌙\n\nWe can call you first thing in the morning — or pick a time.`, hi: `Desk abhi offline hai (subah 5 baje wapas) 🌙\n\nHum subah sabse pehle call kar sakte hain — ya aap time chunein.`, buttons: [['cb_morning', 'Call me at 7 AM', 'Subah 7 baje call'], ['cb_later', 'Choose a time', 'Time chunein'], ['leave', 'Leave a message', 'Message chhodein']] }
    : { en: `Of course! 📞 Call us on *${NUM1}* or *${NUM2}* — or we'll call you.\n\nWhat works best?`, hi: `Bilkul! 📞 *${NUM1}* ya *${NUM2}* par call karein — ya hum aapko call karein.\n\nKya theek rahega?`, buttons: [['cb_now', 'Call me now', 'Abhi call karein'], ['cb_later', 'Call me later', 'Baad mein call'], BTN.menu] },
  number: () => ({ en: `📞 ${NUM1} · ${NUM2}\nThe desk picks up 5 AM – 11 PM (Sun 12 – 9 PM).\n\nWould you like us to call you instead?`, hi: `📞 ${NUM1} · ${NUM2}\nDesk subah 5 – raat 11 call uthata hai (Sun 12 – 9).\n\nYa hum aapko call karein?`, buttons: [['cb_now', 'Call me', 'Mujhe call karein'], BTN.menu] }),
  cb_now: (c) => c.night ? R.cb_morning(c) : ({ en: `Done ✅ Neha will call you on this number within 15 minutes.\n\nIf you miss it, we'll message you here — nothing gets lost.`, hi: `Ho gaya ✅ Neha 15 minute mein isi number par call karengi.\n\nAgar call miss ho, hum yahin message karenge.`, handoff: 'callback_now', attrs: { inf_callback: 'within 15 minutes' } }),
  cb_later: () => ({ en: `No problem — when should we call?`, hi: `Koi baat nahi — kab call karein?`, buttons: [['cb_1h', 'In 1 hour', '1 ghante mein'], ['cb_eve', 'This evening', 'Aaj shaam'], ['cb_morning', 'Tomorrow morning', 'Kal subah']] }),
  cb_1h: () => ({ en: `Noted ✅ We'll call you in about an hour.`, hi: `Note kar liya ✅ Lagbhag 1 ghante mein call karenge.`, handoff: 'callback_later', attrs: { inf_callback: 'in 1 hour' } }),
  cb_eve: () => ({ en: `Noted ✅ We'll call you this evening (5–8 PM).`, hi: `Note kar liya ✅ Aaj shaam (5–8 PM) call karenge.`, handoff: 'callback_later', attrs: { inf_callback: 'this evening (5–8 PM)' } }),
  cb_morning: () => ({ en: `Noted ✅ We'll call you tomorrow at 7 AM. Reply here anytime if that changes.`, hi: `Note kar liya ✅ Kal subah 7 baje call karenge. Badlav ho toh yahin bata dein.`, handoff: 'callback_later', attrs: { inf_callback: 'tomorrow at 7 AM' } }),
  leave: () => ({ en: `Sure — type your message and the desk will reply first thing in the morning.`, hi: `Zaroor — apna message likhiye, desk subah sabse pehle reply karega.`, handoff: 'message_for_desk' }),
  bot: () => ({ en: `I'm Infinity's automated assistant 🤖 — quick with answers, and a real person is always one tap away.`, hi: `Main Infinity ka automated assistant hoon 🤖 — jaldi jawab deta hoon, aur ek asli insaan hamesha ek tap door hai.`, buttons: [BTN.human, BTN.menu] }),
  hours: (c) => ({ en: `${c.night ? "We're closed right now — we open at 5 AM 🌙" : "We're open now, till 11 PM ✅"}\n\n🕔 Mon–Sat 5 AM – 11 PM\n🕛 Sun 12 PM – 9 PM\n📍 ${ADDR}`, hi: `${c.night ? 'Abhi band hai — subah 5 baje khulega 🌙' : 'Abhi khula hai, raat 11 baje tak ✅'}\n\n🕔 Mon–Sat subah 5 – raat 11\n🕛 Sun dopahar 12 – raat 9\n📍 ${ADDR}`, buttons: [BTN.book, ['loc', 'Location', 'Location']] }),
  holiday: () => ({ en: `On festival days the gym runs shorter hours — usually morning to early afternoon. Exact timings go up on our Instagram stories the day before.\n\nRegular hours: Mon–Sat 5 AM – 11 PM · Sun 12 PM – 9 PM.`, hi: `Tyohaar ke din gym kam ghante khulta hai — aksar subah se dopahar tak. Exact timing ek din pehle Instagram story par aati hai.\n\nNormal: Mon–Sat 5 AM – 11 PM · Sun 12 – 9 PM.`, buttons: [BTN.book] }),
  loc: () => ({ en: `📍 ${ADDR}\nOpposite Hareram's Sweets · valet parking at the door.\n\nDirections: ${MAPS}`, hi: `📍 ${ADDR}\nHareram's Sweets ke saamne · gate par valet parking.\n\nDirections: ${MAPS}`, buttons: [BTN.book, ['hours', 'Timings', 'Timings']] }),
  price: (c) => { const s = S(c.now); return { en: `Great question 🙂 Our memberships work out to roughly *₹1,000–1,300 a month* — the exact price depends on your plan, duration and what you'd like included (personal training, physio, couple or family passes).\n\n${s.emoji} And with the *${s.offer}* you get *${s.months} months for the price of 12* — only till *${s.end}*.\n\nTo make sure you get the right plan at the best price, our team shares exact pricing personally — on a quick call, over chat, or when you drop in for your *free session* 💪`, hi: `Accha sawaal 🙂 Hamari membership lagbhag *₹1,000–1,300 mahina* padti hai — exact price aapke plan, duration aur add-ons (personal training, physio, couple ya family pass) par depend karta hai.\n\n${s.emoji} Aur *${s.offer}* mein *12 ki keemat mein ${s.months} mahine* — sirf *${s.end}* tak.\n\nSahi plan aur best price ke liye hamari team aapko exact pricing personally batati hai — ek quick call, chat, ya *free session* par 💪`, buttons: [BTN.book, ['cb_later', 'Get exact pricing', 'Exact price jaanein'], BTN.human] }; },
  fit: () => ({ en: `Happy to match you to the right plan — what's your goal?`, hi: `Aapke liye sahi plan chunte hain — aapka goal kya hai?`, flow: 'plan_match' }),
  book: () => ({ en: `Lovely! Let's book your free session — body-composition test, a tour and a coach consult (about 45 minutes).`, hi: `Badhiya! Free session book karte hain — body-composition test, tour aur coach se baat (lagbhag 45 minute).`, flow: 'booking' }),
  hyrox: () => ({ en: `Our rooftop zone has a rig, turf, sprint track, sleds and wall balls — with coached HYROX prep every week.\n\nTry a session?`, hi: `Rooftop zone mein rig, turf, sprint track, sled aur wall balls hain — har hafte coached HYROX prep.\n\nEk session try karein?`, buttons: [BTN.book, BTN.price] }),
  pt: () => ({ en: `Personal training at Infinity: internationally certified coaches, a personalised workout card, diet guidance and muscle-imbalance correction.\n\nPT packages are shared by the desk — want a coach to call you?`, hi: `Infinity mein personal training: certified coaches, personalised workout card, diet guidance aur muscle-imbalance correction.\n\nPT packages desk batata hai — coach aapko call karein?`, buttons: [['cb_now', 'Coach, call me', 'Coach call karein'], BTN.book] }),
  physio: () => ({ en: `Our in-house physio does assessments, recovery plans and muscle-imbalance correction — right on the gym floor.\n\nIf you're in pain right now, please check with your doctor too.`, hi: `Humare in-house physio assessment, recovery plan aur muscle-imbalance correction karte hain — gym mein hi.\n\nAgar abhi dard hai, toh doctor se bhi zaroor poochiye.`, buttons: [['book', 'Physio assessment', 'Physio assessment'], ['human', 'Physio desk', 'Physio desk']] }),
  classes: () => ({ en: `50+ classes a month in Faridabad's biggest Group-X hall — Zumba, aerobics, dance, yoga and mobility, morning and evening. Women trainers are on the floor too.`, hi: `Faridabad ke sabse bade Group-X hall mein har mahine 50+ classes — Zumba, aerobics, dance, yoga aur mobility, subah-shaam. Floor par lady trainers bhi hain.`, buttons: [['book', 'Book a free class', 'Free class book'], BTN.human] }),
  facil: () => ({ en: `Yes — all included: steam and showers, premium lockers, centralised AC, the rooftop café and valet parking at the door. 🙌`, hi: `Haan — sab included hai: steam aur shower, premium lockers, centralised AC, rooftop café aur gate par valet parking. 🙌`, buttons: [['book', 'See the gym', 'Gym dekhein'], BTN.price] }),
  member: (c) => ({ en: `Happy to help with your membership, ${c.name}. What do you need?`, hi: `Aapki membership mein madad karte hain, ${c.name}. Kya chahiye?`, buttons: [['renew', 'Renew', 'Renew'], ['human', 'Freeze / pause', 'Freeze karna hai'], ['human', 'Something else', 'Kuch aur']] }),
  renew: () => ({ en: `Great — the desk will send your renewal link with your loyalty price in a few minutes.`, hi: `Badhiya — desk kuch minute mein loyalty price ke saath renewal link bhejega.`, handoff: 'renewal' }),
  cancel: (c) => ({ en: `I'm sorry to hear that, ${c.name}. Rohit, our manager, will personally call you today to sort it out.`, hi: `Sunkar afsos hua, ${c.name}. Humare manager Rohit aaj khud call karke madad karenge.`, handoff: 'manager' }),
  complaint: (c) => ({ en: `I'm sorry about this, ${c.name}. I've passed it to our manager, who will get back to you personally today.`, hi: `Iske liye maafi, ${c.name}. Maine yeh manager ko de diya hai, woh aaj khud aapse baat karenge.`, handoff: 'manager' }),
  abuse: () => ({ en: `I'm sorry you're upset. I've passed this straight to our manager, who will personally get back to you.`, hi: `Aap naraz hain, iska afsos hai. Maine yeh seedhe manager ko de diya hai, woh khud aapse baat karenge.`, handoff: 'manager' }),
  link: () => ({ en: `Thanks — our team will take a look and reply here.`, hi: `Thanks — team dekh kar yahin reply karegi.`, handoff: 'review' }),
  discount: (c) => ({ en: `Good question — I'm passing this to *Neha* at our front desk. She'll reply right here within 5 minutes 🙂`, hi: `Achha sawaal hai — main ise front desk par *Neha* ko de raha hoon. Woh yahin 5 minute mein reply karengi 🙂`, handoff: 'desk' }),
  injury: () => ({ en: `Thanks for telling us. Our physio and a coach will look at this personally — Neha will reply here in a few minutes. If it's recent, please check with your doctor too.`, hi: `Batane ke liye thanks. Humare physio aur coach khud dekhenge — Neha kuch minute mein yahin reply karengi. Agar haal hi ka hai, toh doctor se bhi poochiye.`, handoff: 'physio' }),
  career: () => ({ en: `Thanks for your interest in joining Team Infinity! 🙌 Please email your CV to hello@eqiconic.com with the role in the subject line.`, hi: `Team Infinity join karne mein interest ke liye thanks! 🙌 Apna CV hello@eqiconic.com par bhejein, subject mein role likhein.`, attrs: { inf_stage: 'careers' } }),
  corp: () => ({ en: `Great — we do corporate and society memberships: 5 or more members at ₹14,999 each, on one bill. Neha will call you today to set it up.`, hi: `Badhiya — hum corporate aur society memberships karte hain: 5 ya zyaada members, ₹14,999 har ek, ek hi bill par. Neha aaj aapko call karengi.`, handoff: 'b2b' }),
  branch: () => ({ en: `We also have an Infinity club in DLF Phase 3, Gurugram. Shall I connect you with them — or book a session here in Sector 86?`, hi: `Humara ek Infinity club DLF Phase 3, Gurugram mein bhi hai. Unse connect karoon — ya yahan Sector 86 mein session book karein?`, buttons: [['human', 'Connect Gurugram', 'Gurugram se connect'], ['book', 'Book in Sector 86', 'Sector 86 mein book']] }),
  minor: () => ({ en: `Thanks for asking! For members under 18, a parent comes along for the first visit. Neha will share the details in a few minutes.`, hi: `Poochhne ke liye thanks! 18 se kam umar ke members ke liye pehli visit par parent saath aate hain. Neha kuch minute mein details share karengi.`, handoff: 'desk' }),
  wrong: () => ({ en: `Sorry for the trouble — we've removed this number from our list.`, hi: `Pareshani ke liye maafi — humne yeh number list se hata diya hai.`, attrs: { inf_stage: 'invalid_number' }, optout: true }),
  who: () => ({ en: `This is Infinity Gym by EQ Iconic — above Mittal Foam House, Amolik Chowk, Sector 86. How can we help?`, hi: `Yeh Infinity Gym by EQ Iconic hai — Mittal Foam House ke upar, Amolik Chowk, Sector 86. Kya madad karein?`, buttons: [BTN.price, BTN.book, ['optout', 'Stop messages', 'Messages band']] }),
  optout: () => ({ en: `Done — you won't get any more updates from us. If you ever want to train with us, just message HI 🙂`, hi: `Ho gaya — ab aapko humse koi update nahi aayega. Kabhi train karna ho toh bas HI likh dijiye 🙂`, sig: 'धन्यवाद।', optout: true }),
  notint: (c) => ({ en: `No problem at all, ${c.name} — thanks for letting us know. If you ever want to try us, your free session is always open. 💚`, hi: `Koi baat nahi, ${c.name} — batane ke liye thanks. Kabhi try karna ho toh free session hamesha open hai. 💚`, sig: 'धन्यवाद।', attrs: { inf_stage: 'st_lost' } }),
  human: (c) => c.night
    ? { en: `Thanks ${c.name}! 🌙 Our desk opens at 5 AM — Neha will reply first thing in the morning.`, hi: `Thanks ${c.name}! 🌙 Desk subah 5 baje khulta hai — Neha subah sabse pehle reply karengi.`, handoff: 'desk' }
    : { en: `Of course — I'm passing you to *Neha* at our front desk. She'll reply right here within 5 minutes 🙂`, hi: `Zaroor — main aapko front desk par *Neha* se jod raha hoon. Woh yahin 5 minute mein reply karengi 🙂`, handoff: 'desk' },
  long: (c) => ({ en: `Thanks for the detail, ${c.name} — Neha will read this and reply personally ${c.night ? 'first thing in the morning' : 'in a few minutes'}.`, hi: `Detail ke liye thanks, ${c.name} — Neha padh kar ${c.night ? 'subah sabse pehle' : 'kuch minute mein'} khud reply karengi.`, handoff: 'desk' }),
  fallback: () => ({ en: `Sorry, I didn't catch that 🙈 Pick an option below — or type *TEAM* to talk to a person.`, hi: `Maaf kijiye, samajh nahi aaya 🙈 Neeche se ek option chunein — ya insaan se baat ke liye *TEAM* likhein.`, buttons: [BTN.book, BTN.price, BTN.human] }),
};
// Routes a known contact gets on a plain greeting — never the new-lead pitch
const KNOWN = {
  st_trial_booked: (c) => ({ en: `Hi ${c.name}! 👋 Your session is booked${c.trial ? ` for ${c.trial}` : ''}. Anything you need before then?`, hi: `Hi ${c.name}! 👋 Aapka session book hai${c.trial ? ` — ${c.trial}` : ''}. Usse pehle kuch chahiye?`, buttons: [['reschedule', 'Reschedule', 'Time badlein'], ['loc', 'Directions', 'Directions'], BTN.human] }),
  st_member: (c) => ({ en: `Welcome back, ${c.name}! 💚 What do you need today?`, hi: `Welcome back, ${c.name}! 💚 Aaj kya chahiye?`, buttons: [['renew', 'Renew / upgrade', 'Renew / upgrade'], ['human', 'Freeze / pause', 'Freeze karna hai'], ['classes', 'Class timetable', 'Class timetable']] }),
  st_lapsed: (c) => ({ en: `${c.name}! We've missed you on the floor 🙌 Come back with no re-joining fee and a free physio re-assessment?`, hi: `${c.name}! Floor par aapki kami lag rahi thi 🙌 Bina re-joining fee aur free physio re-assessment ke saath wapas aayenge?`, sig: 'फिर से स्वागत है।', buttons: [['renew', "I'm in", 'Main ready hoon'], BTN.call, BTN.human] }),
};
R.reschedule = () => ({ en: `No problem — let's pick a new time.`, hi: `Koi baat nahi — naya time chunte hain.`, flow: 'booking' });
KNOWN.st_won = KNOWN.st_member;

const ROUTES = Object.keys(R);
const titleToRoute = (msg) => {
  const m = msg.trim().toLowerCase();
  for (const id of ROUTES) if (m === id) return id;
  const all = [...Object.values(BTN), ['bye', "That's all", 'Bas itna hi'], ['cb_now', 'Call me now', ''], ['cb_later', 'Call me later', ''], ['cb_later', 'Choose a time', ''], ['cb_1h', 'In 1 hour', ''], ['cb_eve', 'This evening', ''], ['cb_morning', 'Tomorrow morning', ''], ['cb_morning', 'Call me at 7 AM', ''], ['leave', 'Leave a message', ''], ['human', 'Chat with Neha', ''], ['fit', 'Which plan fits me?', ''], ['renew', "I'm in", ''], ['renew', 'Renew', ''], ['optout', 'Stop messages', '']];
  for (const [id, en, hi] of all) if (m === en.toLowerCase() || (hi && m === hi.toLowerCase())) return id;
  return null;
};

// ---------- main entry ----------
/**
 * @param {object} p  message, name, stage, lang, ctx (last route), miss, rep, last, trial, now, channel
 * @returns {{route, intent, lang, text, buttons, sig, handoff, flow, optout, attrs}}
 */
export function think(p) {
  const now = p.now || new Date();
  const hour = localParts(now).hour;
  const c = { name: (p.name || '').split(' ')[0] || 'there', night: p.night ?? (hour >= 23 || hour < 5), now, trial: p.trial };
  const msg = String(p.message || '').trim();
  let lang = p.lang === 'hi' || p.lang === 'en' ? p.lang : 'en';
  if (HINDI.test(msg)) lang = 'hi'; else if (lang === 'hi' && ENGLISH.test(msg) && msg.split(/\s+/).length > 2) lang = 'en';
  const stage = p.stage || '';
  const prev = p.ctx && R[p.ctx] ? p.ctx : null;
  const prevButtons = prev ? (render(prev, c).buttons || []) : [];
  const rep = (p.last && p.last.toLowerCase() === msg.toLowerCase()) ? Number(p.rep || 1) + 1 : 1;
  let miss = Number(p.miss || 0);

  let route = null, intent = null;
  if (!msg) route = 'menu';
  else if (rep >= 3) { route = 'human'; intent = 'repeat'; }
  else if (/^(lang|हिंदी में बात करें|english mein baat|english mein baat karein)$/i.test(msg)) { lang = /हिंदी/.test(msg) || (msg.toLowerCase() === 'lang' && lang === 'en') ? 'hi' : 'en'; route = 'menu'; intent = 'language'; }
  else if ((route = titleToRoute(msg))) intent = 'button';
  else {
    const g = msg.match(GREET); const body = g ? msg.slice(g[0].length).trim() : msg;
    intent = body ? intentOf(body) : 'greet';
    if (!intent && EMOJI_ONLY.test(msg) && !/[a-z0-9ऀ-ॿ]/i.test(msg)) intent = ACK_EMOJI.test(msg.replace(/\s/g, '')) ? 'thanks' : (/👋/.test(msg) ? 'greet' : 'emoji');
    const pick = (i) => prevButtons[i] ? prevButtons[i][0] : null;
    switch (intent) {
      case 'yes': route = pick(0) || 'menu'; break;
      case 'no': { const b = prevButtons.find(x => /not|later|that's all|stop|bas|nahi/i.test(x[1] + ' ' + x[2])); route = b ? b[0] : 'thanks'; break; }
      case 'pick': route = pick(Number(msg) - 1) || 'menu'; break;
      case 'greet': route = KNOWN[stage] ? null : (prev && prevButtons.length ? 'again' : 'welcome'); if (KNOWN[stage]) route = '__known'; break;
      case 'thanks': route = prev && prevButtons.length ? 'ack' : 'thanks'; break;
      case 'emoji': route = prev && prevButtons.length ? 'ack' : 'welcome'; break;
      case null: break;
      default: route = intent === 'member' && !['st_member', 'st_won', 'st_lapsed'].includes(stage) ? 'member' : intent;
    }
    if (!route && !intent) {
      if (msg.split(/\s+/).length > 30 || msg.length > 180) { route = 'long'; intent = 'long'; }
      else { miss += 1; route = miss >= 2 ? 'human' : 'fallback'; intent = miss >= 2 ? 'unclear_twice' : 'unclear'; }
    }
  }
  if (route !== 'fallback' && intent !== 'unclear') miss = 0;

  let out;
  if (route === '__known') { out = KNOWN[stage](c); route = 'known_' + stage; }
  else out = render(route, c);
  if (out.resume && prev) { const back = render(prev, c); out = { ...out, buttons: back.buttons, list: back.list }; }
  const ctxNext = out.resume ? prev : (out.buttons ? route : null);
  return {
    route, intent, lang,
    text: (lang === 'hi' ? out.hi : out.en) + (out.sig ? `\n\n_${out.sig}_` : ''),
    buttons: (out.buttons || []).slice(0, 3).map(([id, en, hi]) => ({ id, title: (lang === 'hi' && hi ? hi : en).slice(0, 20) })),
    list: Boolean(out.list), handoff: out.handoff || null, flow: out.flow || null, optout: Boolean(out.optout),
    attrs: {
      inf_lang: lang, inf_intent: intent || route, inf_route: route, inf_ctx: ctxNext || '',
      inf_miss: String(miss), inf_rep: String(rep), inf_last_msg: msg.slice(0, 200),
      inf_handoff: out.handoff || '', inf_flow: out.flow || '', ...(out.optout ? { inf_optout: 'yes' } : {}), ...(out.attrs || {}),
    },
  };
}
function render(route, c) { const f = R[route] || R.menu; return f(c); }
export const ROUTE_IDS = ROUTES;

// Buttons for a route on their own (used by the EasySocial Interactive Button node).
export function buttonsFor(route, lang = 'en', name = '') {
  const out = render(route, { name: name.split(' ')[0] || 'there', night: false, now: new Date() });
  return (out.buttons || []).slice(0, 3).map(([id, en, hi]) => ({ id, title: (lang === 'hi' && hi ? hi : en).slice(0, 20) }));
}
