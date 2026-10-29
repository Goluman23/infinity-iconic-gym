import { processBulk } from '../lib/intake.js';
import { cors, send, authorised, readBody } from '../lib/http.js';

// POST /api/bulk  { leads: [ ... ] } — broadcast imports and batches (max BULK_MAX)
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  if (!authorised(req)) return send(res, 401, { error: 'Missing or wrong X-Intake-Key' });
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'Body must be JSON' }); }
  if (!Array.isArray(body.leads) || !body.leads.length) return send(res, 422, { error: 'leads must be a non-empty array' });
  return send(res, 200, await processBulk(body.leads));
}
export const config = { maxDuration: 300 };
