// POST /api/es/followup-send — called by the follow-up scheduler (Google Apps Script) to deliver one
// WhatsApp follow-up. Nothing is sent unless FOLLOWUP_LIVE=1 is set in Vercel (dry run otherwise).
// Body: { secret, phone, mode: 'free_form'|'template', text, copyId, vars: { first_name, when, time } }
//  · free_form → EasySocial free-form API (only valid inside 24 h of the customer's last message)
//  · template  → the EasySocial API campaign stored under ES_CAMPAIGNS["fu_<copyId>"] (approved template)
import { send, readBody } from '../../lib/http.js';
import { easysocial, ES } from '../../lib/providers/easysocial.js';

const env = k => (process.env[k] || '').trim();
let fetchImpl = (...a) => fetch(...a);
export function setSendFetch(fn) { fetchImpl = fn; }

export function authorised(body) {
  const want = env('SHEET_LOG_SECRET'); const got = String(body.secret || '');
  if (!want || got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'Body must be JSON' }); }
  if (!authorised(body)) return send(res, 401, { error: 'Missing or wrong secret' });
  const phone = String(body.phone || '').replace(/\D/g, '');
  if (!/^91[6-9]\d{9}$/.test(phone)) return send(res, 400, { error: 'phone must be an Indian mobile with 91 prefix' });
  if (!['free_form', 'template'].includes(body.mode)) return send(res, 400, { error: 'mode must be free_form or template' });
  if (env('FOLLOWUP_LIVE') !== '1') return send(res, 200, { ok: true, dryRun: true, would: { phone, mode: body.mode, copyId: body.copyId } });
  try {
    if (body.mode === 'free_form') {
      const key = env('ES_AUTH_KEY') || env('ES_ACCESS_TOKEN');
      if (!key) return send(res, 500, { error: 'ES_AUTH_KEY is not set' });
      const r = await fetchImpl(env('ES_FREEFORM_URL') || 'https://api.easysocial.in/engage/v1/wa-messages/send', {
        method: 'POST', headers: { 'auth-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: phone, type: 'text', text: String(body.text || '').slice(0, 4096) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) return send(res, 502, { error: `EasySocial free-form failed (${r.status})`, detail: j.message || '' });
      return send(res, 200, { ok: true, sent: 'free_form' });
    }
    const v = body.vars || {};
    // most specific approved template first: fu_<step>_<variant>_<lang> → fu_<step>_<lang> → fu_<step>
    const lang = body.lang === 'hinglish' ? 'hi' : 'en';
    const keys = [`fu_${body.copyId}_${body.variant || 'A'}_${lang}`, `fu_${body.copyId}_${lang}`, `fu_${body.copyId}`];
    const key = keys.find(k => ES.campaigns[k]?.url) || keys[keys.length - 1];
    await easysocial.sendFirstTouch(null, key, { phone, name: v.name || '', first: v.first_name || '' }, { when: v.when || '', time: v.time || '' });
    return send(res, 200, { ok: true, sent: 'template', campaign: key });
  } catch (e) {
    return send(res, 502, { error: e.message });
  }
}
