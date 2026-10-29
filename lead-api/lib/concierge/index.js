// The concierge: one message in → approved reply out, plus what to log and alert.
import { fastRules } from './rules.js';
import { classify } from './ai.js';
import { compose } from './compose.js';
import { buildLogPayload } from './log.js';

const clean = v => {
  if (v == null) return '';
  const s = String(v).trim();
  // "[name]" or "{{name}}" left unreplaced by EasySocial means "no value"
  return /^(\[[^\]]*\]|\{\{[^}]*\}\}|undefined|null)$/i.test(s) ? '' : s;
};

// EasySocial can hand the customer's text over under different names depending on the node,
// so take the first one that actually has a value (unreplaced "[field]" placeholders count as empty).
const MESSAGE_KEYS = ['message', 'last_message', 'n8n_input_message', 'user_input', 'input', 'text', 'msg'];
export function pickMessage(p) {
  for (const k of MESSAGE_KEYS) { const v = clean(p[k]); if (v) return { value: v, key: k }; }
  return { value: '', key: '' };
}

export function readParams(p) {
  return {
    message: pickMessage(p).value.slice(0, 1000),
    name: clean(p.name),
    phone: clean(p.phone ?? p.contact_number).replace(/[^\d+]/g, ''),
    leadId: clean(p.leadId ?? p.lead_id),
    platform: (clean(p.platform) || 'whatsapp').toLowerCase(),
  };
}

export async function handleMessage(p, { now = new Date(), classifyImpl = classify } = {}) {
  const base = readParams(p);
  const rules = fastRules(base.message);
  let s = { ...base, ...rules };
  if (!rules.intent) {
    const ai = await classifyImpl(base.message);
    s = { ...s, ...ai, lang: ai.lang || rules.lang };
  }
  const out = compose(s, now);
  return { state: s, out, log: buildLogPayload(s, out, now) };
}
