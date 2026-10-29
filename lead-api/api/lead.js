import { processLead } from '../lib/intake.js';
import { cors, send, authorised, readBody } from '../lib/http.js';

// POST /api/lead  — one lead → first WhatsApp message → flow starts
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  if (!authorised(req)) return send(res, 401, { error: 'Missing or wrong X-Intake-Key' });
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'Body must be JSON' }); }
  const result = await processLead(body);
  const code = { invalid: 422, error: 502, deferred: 202 }[result.status] || 200;
  return send(res, code, result);
}
