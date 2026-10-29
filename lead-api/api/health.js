import { CONFIG } from '../lib/config.js';
import { seasonFor, inQuietHours, localParts } from '../lib/rules.js';
import { cors, send } from '../lib/http.js';
import { providerName } from '../lib/providers/index.js';
import { ES } from '../lib/providers/easysocial.js';

// GET /api/health — shows configuration status (never the keys themselves)
export default async function handler(req, res) {
  if (cors(req, res)) return;
  const provider = providerName();
  const keys = Object.keys(CONFIG.flows);
  let es = {}, missing;
  if (provider === 'easysocial') {
    let campaigns = {}, tagIds = {}, bad = [];
    try { campaigns = ES.campaigns; } catch { bad.push('ES_CAMPAIGNS'); }
    try { tagIds = ES.tagIds; } catch { bad.push('ES_TAG_IDS'); }
    missing = keys.filter(k => !campaigns[k]?.url);
    es = { es_token_set: Boolean(ES.token), es_brain_key_set: Boolean(process.env.ES_BRAIN_KEY), es_webhook_secret_set: Boolean(process.env.ES_WEBHOOK_SECRET),
      es_tag_ids_missing: ['intake_api', 'wa_optin', 'intake_member_contact', 'intake_while_booked'].filter(t => !(Number(tagIds[t]) > 0)), es_invalid_json: bad };
  } else missing = keys.filter(k => !CONFIG.flows[k]);
  return send(res, 200, {
    ok: true, brand: CONFIG.brand, provider, dry_run: CONFIG.dryRun,
    ...(provider === 'manychat' ? { manychat_key_set: Boolean(CONFIG.manychatKey) } : es), intake_key_set: Boolean(CONFIG.intakeKey),
    first_touch_missing: missing, season_today: seasonFor(), quiet_hours_now: inQuietHours(), local: localParts(),
  });
}
