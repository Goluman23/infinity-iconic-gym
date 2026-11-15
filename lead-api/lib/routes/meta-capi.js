import { readBody, send } from '../http.js';
import { buildEvent, sendEvent, capiConfig } from '../meta-capi.js';

// POST /api/meta/capi — called by eqiconic.com (fetch keepalive) for every Pixel event.
// Only accepts the website's own origin; never returns the token.
export default async function handler(req, res) {
  const origin = String(req.headers.origin || '');
  const okOrigin = capiConfig().origins.includes(origin);
  if (okOrigin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
  if (!okOrigin) return send(res, 403, { ok: false, error: 'origin' });

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { ok: false, error: 'bad_json' }); }
  const ev = buildEvent(body || {}, req);
  if (!ev) return send(res, 400, { ok: false, error: 'invalid_event' });
  try {
    const out = await sendEvent(ev);
    return send(res, out.ok ? 200 : 502, out);
  } catch (e) {
    return send(res, 502, { ok: false, error: 'network' });
  }
}
