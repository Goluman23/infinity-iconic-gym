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

export function readParams(p) {
  return {
    message: clean(p.message ?? p.n8n_input_message ?? p.text ?? p.last_message).slice(0, 1000),
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
