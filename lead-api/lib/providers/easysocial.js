// EasySocial adapter. Endpoints from easysocial.io/docs:
//   Get lead     POST {base}/engage/v1/leads                {contact_number}
//   Create leads POST {base}/api/v1/leads/bulk-create       {data:[…]}
//   Update lead  PUT  {base}{ES_UPDATE_PATH with {contact}} {lead_data, add_tags, remove_tags}
//   First message: the cURL EasySocial generates for each "Broadcast → Create API" campaign,
//   pasted into ES_CAMPAIGNS (one per first-touch type). Placeholders are filled per lead.
const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
const json = (k, d) => { try { return JSON.parse(env(k) || 'null') ?? d; } catch { throw new Error(`${k} is not valid JSON`); } };

export const ES = {
  get base() { return env('ES_CLIENT_BASE', 'https://client-api.e-so.in'); },
  get token() { return env('ES_ACCESS_TOKEN'); },
  get lookupPath() { return env('ES_LOOKUP_PATH', '/engage/v1/leads'); },
  get createPath() { return env('ES_CREATE_PATH', '/api/v1/leads/bulk-create'); },
  get updatePath() { return env('ES_UPDATE_PATH', '/engage/v1/leads/{contact}/update'); },
  get channelKey() { return env('ES_CHANNEL_KEY', 'contact-easysocial-whatsapp-api-support_number'); },
  get channelValue() { return env('ES_CHANNEL_VALUE', '919953004008'); },
  get tagIds() { return json('ES_TAG_IDS', {}); },          // {"intake_api": 101, …} — numeric ids from EasySocial
  get campaigns() { return json('ES_CAMPAIGNS', {}); },     // {"form": {url, method, headers, body}, …}
  get dryRun() { return env('DRY_RUN', '0') === '1'; },
};

export const esCalls = [];
let fetchImpl = (...a) => fetch(...a);
export function setFetch(fn) { fetchImpl = fn; }

async function call(method, url, body, headers = {}) {
  esCalls.push({ method, url, body });
  if (ES.dryRun) return { status: 200, json: { success: true, dry_run: true, payload: null } };
  if (!ES.token && !headers['__noauth']) throw new Error('ES_ACCESS_TOKEN is not set');
  const h = { 'Content-Type': 'application/json', Accept: 'application/json', ...(ES.token ? { Authorization: `Bearer ${ES.token}` } : {}), ...headers };
  delete h.__noauth;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetchImpl(url, { method, headers: h, body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 || r.status >= 500) { if (attempt < 3) { await new Promise(res => setTimeout(res, 700 * attempt * attempt)); continue; } }
    return { status: r.status, json: j };
  }
}

const digits = (p) => String(p).replace(/\D/g, '');
function normalise(payload) {
  if (!payload) return null;
  const ld = payload.lead_data || {};
  return {
    id: payload.id, raw: payload,
    optedOut: payload.opt_in === false || ld.inf_optout === 'yes',
    stage: ld.inf_stage || '', firstTouchAt: ld.inf_first_touch_at || null, firstSource: ld.inf_source || '',
  };
}

export const easysocial = {
  name: 'easysocial',
  async find(phone) {
    const r = await call('POST', ES.base + ES.lookupPath, { contact_number: Number(digits(phone)) });
    if (r.status === 404) return null;
    if (r.status === 401) throw new Error('EasySocial: access token rejected (401)');
    if (r.status >= 400) throw new Error(`EasySocial lookup failed (${r.status}): ${r.json?.message || ''}`);
    return normalise(r.json?.payload);
  },
  async create(lead) {
    const row = {
      [ES.channelKey]: Number(ES.channelValue), country_code: 91, contact_number: lead.phone.slice(2),
      origin: 'API', name: lead.name,
    };
    const r = await call('POST', ES.base + ES.createPath, { data: [row] });
    if (r.status >= 400) throw new Error(`EasySocial create failed (${r.status}): ${r.json?.message || r.json?.error || ''}`);
    // bulk-create returns no id — read the lead back
    return (await this.find(lead.phone)) || { id: null, optedOut: false, stage: '', firstTouchAt: null, firstSource: '', created: true };
  },
  async save(contact, phone, fields, tags = []) {
    const ids = ES.tagIds;
    const add = tags.map(t => Number(ids[t])).filter(v => Number.isFinite(v) && v > 0);
    const missing = tags.filter(t => !(Number(ids[t]) > 0));
    const lead_data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    const url = ES.base + ES.updatePath.replace('{contact}', digits(phone));
    const r = await call('PUT', url, { lead_data, ...(add.length ? { add_tags: add } : {}) });
    if (r.status >= 400) throw new Error(`EasySocial update failed (${r.status}): ${r.json?.message || ''}`);
    return { missingTagIds: missing };
  },
  async sendFirstTouch(contact, key, lead, extra = {}) {
    const spec = ES.campaigns[key];
    if (!spec || !spec.url) {
      if (ES.dryRun) { esCalls.push({ method: 'CAMPAIGN', url: `DRY_RUN:${key}` }); return; }
      throw new Error(`No EasySocial API campaign configured for "${key}" (ES_CAMPAIGNS)`);
    }
    const vars = {
      phone: lead.phone, phone10: lead.phone.slice(2), phone_plus: '+' + lead.phone, name: lead.name, first_name: lead.first,
      goal: lead.goal || 'fitness', time: lead.time || '', area: lead.area || '', source: lead.source || '', ...extra,
    };
    const fill = (v) => typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '') : Array.isArray(v) ? v.map(fill) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
    const r = await call((spec.method || 'POST').toUpperCase(), fill(spec.url), spec.body == null ? null : fill(spec.body), { ...(spec.headers ? fill(spec.headers) : {}), ...(spec.useToken === false ? { __noauth: '1' } : {}) });
    if (r.status >= 400 || r.json?.success === false) throw new Error(`EasySocial campaign "${key}" failed (${r.status}): ${r.json?.message || ''}`);
  },
};
