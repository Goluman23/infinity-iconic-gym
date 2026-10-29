import { CONFIG } from './config.js';

// Thin ManyChat client with retries. In DRY_RUN it records calls instead of sending,
// and a test can inject a mock with setTransport().
let transport = null;
export const calls = [];
export function setTransport(fn) { transport = fn; }

async function request(method, path, body) {
  calls.push({ method, path, body });
  if (transport) return transport(method, path, body);
  if (CONFIG.dryRun) return { status: 'success', data: dryRunReply(path, body) };
  if (!CONFIG.manychatKey) throw new Error('MANYCHAT_API_KEY is not set');
  const url = CONFIG.manychatBase + path;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${CONFIG.manychatKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => ({}));
    if (r.ok && json.status !== 'error') return json;
    const retryable = r.status === 429 || r.status >= 500;
    if (!retryable || attempt === 3) {
      const msg = json.message || json.details?.messages?.map(m => m.message).join('; ') || `HTTP ${r.status}`;
      const err = new Error(`ManyChat ${path}: ${msg}`); err.status = r.status; err.body = json; throw err;
    }
    await new Promise(res => setTimeout(res, 600 * attempt * attempt));
  }
}

function dryRunReply(path, body) {
  if (path.startsWith('/fb/subscriber/findBySystemField')) return null;
  if (path === '/fb/subscriber/createSubscriber') return { id: 'dry_' + (body?.[CONFIG.phoneField] || body?.phone || 'x'), tags: [], custom_fields: [] };
  return {};
}

export const mc = {
  async findByPhone(phone) {
    const r = await request('GET', `/fb/subscriber/findBySystemField?phone=%2B${phone}`);
    return r?.data || null;
  },
  async getInfo(id) {
    const r = await request('GET', `/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(id)}`);
    return r?.data || null;
  },
  async create(lead) {
    const body = {
      first_name: lead.first, last_name: lead.last || undefined,
      [CONFIG.phoneField]: '+' + lead.phone, phone: '+' + lead.phone,
      has_opt_in_sms: false, consent_phrase: lead.consentText,
    };
    const r = await request('POST', '/fb/subscriber/createSubscriber', body);
    return r?.data;
  },
  async setFields(id, fields) {
    const list = Object.entries(fields).filter(([, v]) => v !== undefined && v !== '').map(([field_name, field_value]) => ({ field_name, field_value: String(field_value) }));
    if (!list.length) return;
    for (let i = 0; i < list.length; i += 20) await request('POST', '/fb/subscriber/setCustomFields', { subscriber_id: id, fields: list.slice(i, i + 20) });
  },
  async addTag(id, tag_name) { await request('POST', '/fb/subscriber/addTagByName', { subscriber_id: id, tag_name }); },
  async removeTag(id, tag_name) { await request('POST', '/fb/subscriber/removeTagByName', { subscriber_id: id, tag_name }); },
  async sendFlow(id, flow_ns) { await request('POST', '/fb/sending/sendFlow', { subscriber_id: id, flow_ns }); },
};
