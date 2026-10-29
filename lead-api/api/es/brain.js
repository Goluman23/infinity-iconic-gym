// GET|POST /api/es/brain — EasySocial chatbot webhook node ("n8n-style").
// EasySocial calls: https://<project>/api/es/brain?key=…&leadId=[leadId]&message=[n8n_input_message]&phone=[phone]
// Answers {message, lead_attributes, last_response}; EasySocial sends `message` and saves lead_attributes.
// &numbered=1 writes the options into the text (no button node needed).
// ?format=text|buttons|bool returns the API Basic / Interactive Button / True-False node shapes instead.
import { think } from '../../lib/brain.js';
import { toEasySocial } from '../../lib/es-format.js';
import { send } from '../../lib/http.js';
import { brainAuthorised, input, stateFor, remember, clean } from '../../lib/es-brain-http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const { q, p } = await input(req);
  if (!brainAuthorised(req, q)) return send(res, 401, { error: 'Missing or wrong key' });
  try {
    const { leadId, st } = await stateFor(p);
    const d = think(st);
    remember(leadId, d.attrs);
    const format = clean(p.format) || 'n8n';
    return send(res, 200, { ...toEasySocial(d, format, { numbered: clean(p.numbered) === '1' }), ...(p.debug === '1' ? { debug: { route: d.route, intent: d.intent, buttons: d.buttons, handoff: d.handoff, flow: d.flow } } : {}) });
  } catch (e) {
    // Never leave the person unanswered: fall back to a hand-off message.
    return send(res, 200, {
      message: 'Thanks for writing to Infinity 🙌 A team member will reply here shortly. Reception: +91 99530 04008.',
      lead_attributes: { inf_handoff: 'yes', inf_route: 'error', inf_error: String(e.message).slice(0, 120) },
      last_response: 'error',
    });
  }
}
