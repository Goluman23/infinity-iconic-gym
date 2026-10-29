// GET|POST /api/es/concierge — the AI fallback for EasySocial (Instagram + WhatsApp).
// EasySocial sends every message its keyword flow didn't understand:
//   /api/es/concierge?key=CONCIERGE_KEY&message=[n8n_input_message]&phone=[phone]&name=[name]&leadId=[leadId]&platform=instagram
// Answers {message, last_response, lead_attributes, data:{body_text}} — fits both the
// Webhook (n8n) node and the API Basic Message node. After replying, it logs the
// conversation to the lead sheet and alerts the front desk (via SHEET_LOG_URL).
import { waitUntil } from '@vercel/functions';
import { send } from '../../lib/http.js';
import { input } from '../../lib/es-brain-http.js';
import { handleMessage } from '../../lib/concierge/index.js';
import { sendToSheet } from '../../lib/concierge/log.js';

export function keyOk(req, q) {
  const want = (process.env.CONCIERGE_KEY || process.env.ES_BRAIN_KEY || '').trim();
  if (!want) return (process.env.DRY_RUN || '0') === '1';
  const got = String(q.key || req.headers['x-brain-key'] || '');
  if (got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}

const FALLBACK = 'Hey 👋 Thanks for writing to Infinity Iconic. Our team will reply here shortly — or call the front desk on +91 99530 04008.';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const { p } = await input(req);
  if (!keyOk(req, p)) return send(res, 401, { error: 'Missing or wrong key' });
  try {
    const { out, log, state } = await handleMessage(p);
    const job = sendToSheet(log);
    try { waitUntil(job); } catch { await job; } // outside Vercel (local server) just wait
    return send(res, 200, { ...out.response, ...(p.debug === '1' ? { debug: { intent: out.intent, source: state.source, when: state.when, alert: out.alert } } : {}) });
  } catch (e) {
    console.log('[concierge] error', e.message);
    // Never leave the person unanswered.
    return send(res, 200, { message: FALLBACK, last_response: FALLBACK, data: { body_text: FALLBACK }, lead_attributes: { inf_handoff: 'yes', inf_intent: 'error' } });
  }
}
