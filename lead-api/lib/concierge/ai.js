// Claude classifies the messages the fast rules didn't catch.
// It only LABELS the message and pulls out details; customers see approved
// templates. Claude writes words only for a general question, and compose()
// still blocks any price in them. Any failure → intent "unclear" (helpful menu).
const SYSTEM = `You classify messages sent to the Instagram/WhatsApp inbox of Infinity Gym by EQ Iconic (Sector 86, Faridabad, India). People write in English, Hindi or Hinglish, often with typos.

Facts (use ONLY these for replies):
- Address: 2nd Floor, Plot 4P, Main Bypass Road, above Mittal Foam House, near Amolik Chowk, Sector 86, Faridabad.
- Hours: Mon–Sat 5 AM–11 PM, Sunday 12–9 PM.
- 10,000 sq ft; strength, cardio, functional zone, rooftop CrossFit box, HYROX training.
- 50+ group classes a month: Zumba, yoga, functional; ladies-only batches with female trainers.
- Personal training, diet guidance, in-house physiotherapy, body-composition scans.
- Steam, showers, lockers, changing rooms, fully air-conditioned, valet parking.
- First session is free. Couple and family passes exist.
- Exact prices are NEVER given in chat.

Return ONLY a JSON object, no other text:
{"intent": one of "visit_plan","callback","price","offer","location","timings","classes","facilities","member_service","complaint","human","greeting","thanks","other_question","unclear",
 "lang": "en" or "hinglish",
 "when": short English phrase for WHEN they plan to visit (e.g. "tomorrow evening", "Saturday at 7 AM") or "",
 "hours_conflict": true if that time is outside opening hours, else false,
 "reply": ONLY for "other_question": a warm reply of at most 280 characters in the same language style as the message, using only the facts above, never any price or number of rupees; otherwise ""}

Intent guide:
- visit_plan: they say when they will come / drop in / visit ("kal shaam ko aata hu", "will come after office", "Sunday ko aayenge").
- callback: they want us to call them, or ask for a number to call.
- member_service: existing member — renew, freeze, pause, refund, cancel, attendance, trainer change.
- complaint: unhappy about service, staff, cleanliness, billing, equipment.
- human: wants a real person.
- unclear: emoji only, gibberish, or not about the gym.`;

export const INTENTS = ['visit_plan', 'callback', 'price', 'offer', 'location', 'timings', 'classes', 'facilities',
  'member_service', 'complaint', 'human', 'greeting', 'thanks', 'other_question', 'unclear'];

export function parseAnswer(body) {
  let ai = {};
  try {
    const text = (body?.content || []).map(c => c.text || '').join('');
    ai = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch { ai = {}; }
  const ok = INTENTS.includes(ai.intent);
  return {
    intent: ok ? ai.intent : 'unclear',
    source: ok ? 'ai' : 'ai-failed',
    lang: ai.lang === 'hinglish' || ai.lang === 'en' ? ai.lang : '',
    when: typeof ai.when === 'string' ? ai.when.slice(0, 60) : '',
    hoursConflict: ai.hours_conflict === true,
    aiReply: typeof ai.reply === 'string' ? ai.reply.slice(0, 400) : '',
  };
}

let fetchImpl = (...a) => fetch(...a);
export function setAiFetch(fn) { fetchImpl = fn; }

export async function classify(message, {
  apiKey = (process.env.ANTHROPIC_API_KEY || '').trim(),
  model = (process.env.CONCIERGE_MODEL || 'claude-haiku-5-5').trim(),
  timeoutMs = Number(process.env.CONCIERGE_AI_TIMEOUT_MS || 6000),
} = {}) {
  // Skip Claude when the key is missing or clearly not a real key (placeholder, stray "…", spaces).
  if (!/^sk-ant-[\x21-\x7e]{30,}$/.test(apiKey)) return { ...parseAnswer(null), source: 'ai-off' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 300, temperature: 0, system: SYSTEM,
        messages: [{ role: 'user', content: `Message: """${String(message).slice(0, 1000)}"""` }] }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      console.log('[concierge] AI status', r.status, model, err.slice(0, 300));
      return parseAnswer(null);
    }
    return parseAnswer(await r.json());
  } catch (e) {
    console.log('[concierge] AI failed', e.name === 'AbortError' ? 'timeout' : e.message);
    return parseAnswer(null);
  } finally { clearTimeout(timer); }
}
