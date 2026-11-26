import { CONFIG } from '../lib/config.js';
import { seasonFor, inQuietHours, localParts } from '../lib/rules.js';
import { cors, send } from '../lib/http.js';
import { providerName } from '../lib/providers/index.js';
import { ES } from '../lib/providers/easysocial.js';
import { capiConfig } from '../lib/meta-capi.js';

// GET /api/health — shows configuration status (never the keys themselves)
export default async function handler(req, res) {
  if (cors(req, res)) return;
  const provider = providerName();
  const keys = Object.keys(CONFIG.flows);
  let es = {}, missing;
  if (provider === 'easysocial') {
    let campaigns = {}, tagIds = {}, bad = [];
    let esDiag = null;
    try { campaigns = ES.campaigns; esDiag = { entries: Object.keys(campaigns) }; } catch (e) {
      bad.push('ES_CAMPAIGNS');
      // Where the value breaks and its length, never the value itself.
      const raw = String(process.env.ES_CAMPAIGNS || ''); const m = String(e.message).match(/position (\d+)/); const pos = m ? Number(m[1]) : null;
      esDiag = { length: raw.length, position: pos, charAtPosition: pos != null ? JSON.stringify(raw[pos] || '') : null,
        curlyQuotes: /[\u201c\u201d\u2018\u2019]/.test(raw), first: JSON.stringify(raw.trim()[0] || ''), last: JSON.stringify(raw.trim().slice(-1)) };
    }
    try { tagIds = ES.tagIds; } catch { bad.push('ES_TAG_IDS'); }
    missing = keys.filter(k => !campaigns[k]?.url);
    es = { es_token_set: Boolean(ES.token), es_brain_key_set: Boolean(process.env.ES_BRAIN_KEY), es_webhook_secret_set: Boolean(process.env.ES_WEBHOOK_SECRET),
      es_tag_ids_missing: ['intake_api', 'wa_optin', 'intake_member_contact', 'intake_while_booked'].filter(t => !(Number(tagIds[t]) > 0)), es_invalid_json: bad, es_campaigns: esDiag };
  } else missing = keys.filter(k => !CONFIG.flows[k]);
  return send(res, 200, {
    ok: true, brand: CONFIG.brand, provider, dry_run: CONFIG.dryRun,
    ...(provider === 'manychat' ? { manychat_key_set: Boolean(CONFIG.manychatKey) } : es), intake_key_set: Boolean(CONFIG.intakeKey),
    meta_capi: (c => ({ pixel_id_set: Boolean(c.pixelId), token_set: Boolean(c.token), test_mode: Boolean(c.testCode) }))(capiConfig()),
    first_touch_missing: missing, season_today: seasonFor(), quiet_hours_now: inQuietHours(), local: localParts(),
  });
}
