// Shared request handling for the EasySocial chatbot endpoints.
import { easysocial, ES } from './providers/easysocial.js';

const memo = new Map(); // warm-instance cache: leadId → last state (a fallback, not the record)

// "[inf_ctx]" or "{{inf_ctx}}" left unreplaced by the platform means "no value".
export const clean = v => {
  if (v == null) return '';
  const s = String(v).trim();
  return /^(\[[^\]]*\]|\{\{[^}]*\}\}|undefined|null)$/i.test(s) ? '' : s;
};

export function brainAuthorised(req, q) {
  const want = (process.env.ES_BRAIN_KEY || '').trim();
  if (!want) return (process.env.DRY_RUN || '0') === '1';
  const got = clean(q.key) || req.headers['x-brain-key'] || '';
  if (got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}

export function queryOf(req) {
  const u = new URL(req.url, 'http://x');
  return Object.fromEntries(u.searchParams.entries());
}

// Build the brain input. Order of trust: values sent by EasySocial → lead lookup by phone → warm cache.
export async function stateFor(p) {
  const leadId = clean(p.leadId || p.lead_id);
  const st = {
    message: clean(p.message ?? p.n8n_input_message ?? p.text), name: clean(p.name),
    stage: clean(p.stage || p.inf_stage), lang: clean(p.lang || p.inf_lang), ctx: clean(p.ctx || p.inf_ctx),
    miss: clean(p.miss || p.inf_miss), rep: clean(p.rep || p.inf_rep), last: clean(p.last || p.inf_last_msg),
    trial: clean(p.trial || p.inf_trial),
  };
  const phone = clean(p.phone || p.contact_number);
  if (!st.ctx && phone && ES.token && !ES.dryRun) {
    try {
      const c = await easysocial.find(phone);
      const ld = c?.raw?.lead_data || {};
      st.name ||= clean(c?.raw?.name); st.stage ||= clean(ld.inf_stage); st.lang ||= clean(ld.inf_lang);
      st.ctx ||= clean(ld.inf_ctx); st.miss ||= clean(ld.inf_miss); st.rep ||= clean(ld.inf_rep);
      st.last ||= clean(ld.inf_last_msg); st.trial ||= clean(ld.inf_trial);
    } catch { /* lookup is best effort — the brain still answers */ }
  }
  if (!st.ctx && leadId && memo.has(leadId)) { const m = memo.get(leadId); for (const k of Object.keys(m)) st[k] ||= m[k]; }
  return { leadId, phone, st };
}

export function remember(leadId, attrs) {
  if (!leadId) return;
  memo.set(leadId, { lang: attrs.inf_lang, ctx: attrs.inf_ctx, miss: attrs.inf_miss, rep: attrs.inf_rep, last: attrs.inf_last_msg });
  if (memo.size > 5000) memo.delete(memo.keys().next().value);
}

export async function input(req) {
  const q = queryOf(req);
  let body = {};
  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') body = req.body;
    else {
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = Object.fromEntries(new URLSearchParams(raw)); }
    }
  }
  return { q, p: { ...q, ...body } };
}
