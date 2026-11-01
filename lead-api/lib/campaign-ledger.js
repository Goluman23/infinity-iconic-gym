// The campaign ledger lives in the "Campaign log" tab of the Infinity Leads sheet (Apps Script, Code.gs).
// sentTo(ids) → phones already sent for those campaigns · record(rows) → append send results.
const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
let fetchImpl = (...a) => fetch(...a);
export function setLedgerFetch(fn) { fetchImpl = fn; }

async function post(payload, timeoutMs = 15000) {
  const url = env('SHEET_LOG_URL');
  if (!url) throw new Error('SHEET_LOG_URL not set');
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { method: 'POST', signal: ctrl.signal, redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: env('SHEET_LOG_SECRET'), ...payload }) });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error(`ledger answered ${r.status}: ${text.slice(0, 120)}`); }
    if (!j.ok) throw new Error(`ledger: ${j.error || 'failed'}`);
    return j;
  } finally { clearTimeout(t); }
}

export async function sentTo(campaignIds) {
  const j = await post({ kind: 'campaign_sent', campaigns: campaignIds });
  return j.phones || [];
}

export async function record(rows) {
  if (!rows.length) return { ok: true, rows: 0 };
  return post({ kind: 'campaign', rows });
}
