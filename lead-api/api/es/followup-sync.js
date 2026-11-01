// POST /api/es/followup-sync — the follow-up scheduler (Apps Script) keeps EasySocial in step with the
// journey: suppression tags (SUPPRESS_OPT_OUT, SUPPRESS_MARKETING, SUPPRESS_ACTIVE_MEMBER) and the
// lifecycle stage field, so broadcasts and EasySocial's own automations exclude the right people.
// Body: { secret, phone, add: [tag names], remove: [tag names], stage }
// Dry run unless FOLLOWUP_LIVE=1 (nothing is written to EasySocial until you go live).
import { send, readBody } from '../../lib/http.js';
import { easysocial } from '../../lib/providers/easysocial.js';
import { authorised } from './followup-send.js';

const ALLOWED = new Set(['SUPPRESS_OPT_OUT', 'SUPPRESS_MARKETING', 'SUPPRESS_ACTIVE_MEMBER']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'Body must be JSON' }); }
  if (!authorised(body)) return send(res, 401, { error: 'Missing or wrong secret' });
  const phone = String(body.phone || '').replace(/\D/g, '');
  if (!/^91[6-9]\d{9}$/.test(phone)) return send(res, 400, { error: 'phone must be an Indian mobile with 91 prefix' });
  const add = (body.add || []).filter(t => ALLOWED.has(t)), remove = (body.remove || []).filter(t => ALLOWED.has(t));
  const fields = body.stage ? { inf_journey_stage: String(body.stage).slice(0, 30) } : {};
  if ((process.env.FOLLOWUP_LIVE || '').trim() !== '1') return send(res, 200, { ok: true, dryRun: true, would: { phone, add, remove, fields } });
  try {
    const r = await easysocial.setTags(phone, add, remove, fields);
    return send(res, 200, { ok: true, synced: true, missingTagIds: r.missingTagIds });
  } catch (e) { return send(res, 502, { error: e.message }); }
}
