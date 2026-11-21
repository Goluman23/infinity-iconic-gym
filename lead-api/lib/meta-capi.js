// Meta Conversions API (CAPI) relay for eqiconic.com.
// The browser Pixel and this server send the SAME event with the SAME event_id,
// so Meta de-duplicates them and keeps whichever arrives (ad blockers, iOS, in-app
// browsers often block the Pixel — the server copy still gets through).
//
// Env (Vercel → infinity-lead-api → Production):
//   META_PIXEL_ID         the dataset / Pixel ID (digits) — since 21 Nov 2026: 1560701859153303 (portfolio Infinity Gym - Eq Iconic)
//   META_CAPI_TOKEN       Events Manager → Settings → Conversions API → Generate access token (mark Sensitive)
//   META_TEST_EVENT_CODE  optional, e.g. TEST12345 — events show in "Test events"; remove after testing
//   META_GRAPH_VERSION    optional, default v23.0
//   META_ALLOWED_ORIGINS  optional, comma list; default https://www.eqiconic.com,https://eqiconic.com
import crypto from 'node:crypto';

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
export const EVENTS = new Set(['PageView', 'ViewContent', 'Lead', 'Contact', 'Schedule', 'CompleteRegistration']);
const CUSTOM_KEYS = ['content_name', 'channel', 'goal', 'plan', 'source', 'offer', 'utm_source', 'utm_campaign', 'utm_content', 'km'];

let transport = (url, init) => fetch(url, init);
export function setTransport(fn) { transport = fn; }

export function capiConfig() {
  return {
    pixelId: env('META_PIXEL_ID'),
    token: env('META_CAPI_TOKEN'),
    testCode: env('META_TEST_EVENT_CODE'),
    version: env('META_GRAPH_VERSION', 'v23.0'),
    origins: env('META_ALLOWED_ORIGINS', 'https://www.eqiconic.com,https://eqiconic.com').split(',').map(s => s.trim()).filter(Boolean),
  };
}

const sha = v => crypto.createHash('sha256').update(v).digest('hex');
// Indian mobile → 91XXXXXXXXXX (Meta wants digits with country code, then SHA-256)
export function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '').replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(d)) return '91' + d;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  return '';
}
export function normName(n) { return String(n || '').trim().toLowerCase().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, '') || ''; }
const clip = (v, n = 200) => String(v ?? '').slice(0, n);

// Turn what the page sent into one Meta server event. Returns null if not acceptable.
export function buildEvent(body, req) {
  const name = clip(body.event_name, 40);
  if (!EVENTS.has(name)) return null;
  const id = clip(body.event_id, 80);
  if (!/^[\w.-]{8,80}$/.test(id)) return null;
  const url = clip(body.event_source_url, 500);
  if (!/^https:\/\/(www\.)?eqiconic\.com(\/|$|\?|#)/.test(url)) return null;

  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ud = {
    client_ip_address: fwd || req.socket?.remoteAddress || undefined,
    client_user_agent: clip(req.headers['user-agent'], 400) || undefined,
  };
  const u = body.user || {};
  if (/^fb\.\d\.\d+\.[\w-]+$/.test(u.fbp || '')) ud.fbp = clip(u.fbp, 120);
  if (/^fb\.\d\.\d+\.[\w-]+$/.test(u.fbc || '')) ud.fbc = clip(u.fbc, 400);
  const ph = normPhone(u.ph);
  if (ph) { ud.ph = [sha(ph)]; ud.external_id = [sha('inf:' + ph)]; }
  const fn = normName(u.fn);
  if (fn) ud.fn = [sha(fn)];
  ud.ct = [sha('faridabad')]; ud.st = [sha('hr')]; ud.country = [sha('in')];

  const cd = {};
  const c = body.custom || {};
  for (const k of CUSTOM_KEYS) if (c[k] !== undefined && c[k] !== '') cd[k] = clip(c[k], 100);

  const t = Number(body.event_time);
  const now = Math.floor(Date.now() / 1000);
  return {
    event_name: name, event_id: id,
    event_time: Number.isFinite(t) && t > now - 7 * 86400 && t <= now + 60 ? Math.floor(t) : now,
    action_source: 'website', event_source_url: url,
    user_data: ud, ...(Object.keys(cd).length ? { custom_data: cd } : {}),
  };
}

export async function sendEvent(ev) {
  const cfg = capiConfig();
  if (!cfg.pixelId || !cfg.token) return { ok: true, skipped: 'not_configured' };
  const payload = { data: [ev], ...(cfg.testCode ? { test_event_code: cfg.testCode } : {}) };
  const r = await transport(`https://graph.facebook.com/${cfg.version}/${encodeURIComponent(cfg.pixelId)}/events?access_token=${encodeURIComponent(cfg.token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) return { ok: false, status: r.status, error: j?.error?.message || 'meta_error' };
  return { ok: true, received: j.events_received ?? null, test: Boolean(cfg.testCode) };
}
