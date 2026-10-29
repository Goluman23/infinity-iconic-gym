// Sends each conversation (and any front-desk alert) to the Google Apps Script
// attached to the lead sheet. The script writes the rows, emails the desk and
// skips repeat alerts. Free: no n8n, no paid email service.
const env = k => (process.env[k] || '').trim();

const LABEL = {
  visit_plan: '🏃 Visit planned',
  callback: '📞 Call-back requested',
  phone_shared: '📞 Number shared — call back',
  member_service: '🪪 Member request',
  complaint: '⚠️ Complaint',
  human: '🙋 Wants a person',
};

export function istTime(d = new Date()) {
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

// Builds what the sheet script receives. Pure, so it is easy to test.
export function buildLogPayload(s, out, now = new Date()) {
  const platform = s.platform === 'instagram' ? 'Instagram' : s.platform === 'messenger' ? 'Messenger' : 'WhatsApp';
  const callNo = s.sharedPhone || (/\d{10}/.test(s.phone || '') ? s.phone : '');
  const ist = istTime(now);
  const conversation = {
    'Received (IST)': ist, Platform: platform, Name: s.name || '', Number: callNo,
    'They wrote': s.message || '', 'Understood as': out.intent, 'Caught by': s.source,
    When: s.when || '', 'Bot replied': out.reply, 'Lead ID': s.leadId || '',
  };
  let alert = null;
  if (out.alert) {
    const label = LABEL[out.intent] || out.intent;
    alert = {
      key: `${s.phone || s.sharedPhone || s.leadId || s.name || 'unknown'}|${out.intent}`,
      subject: `${label} — ${s.name || callNo || platform}${s.when ? ' · ' + s.when : ''}`,
      text: [
        `${label} · ${platform}`,
        `Name: ${s.name || '—'}`,
        `Number: ${callNo || '— (ask in chat)'}`,
        ...(s.when ? [`When: ${s.when}${s.hoursConflict ? ' (outside opening hours!)' : ''}`] : []),
        `They wrote: "${(s.message || '').slice(0, 300)}"`,
        `Received: ${ist}`,
      ].join('\n'),
      row: {
        'Received (IST)': ist, Platform: platform, Reason: label, Name: s.name || '', Number: callNo,
        When: s.when || '', 'Outside hours': s.hoursConflict ? 'yes' : '', Message: s.message || '',
        'Lead ID': s.leadId || '', Status: 'New',
      },
    };
  }
  // Feeds the follow-up engine (sheet "Follow-ups" tab): every customer message is an inbound event.
  const channel = s.platform === 'instagram' ? 'ig' : s.platform === 'messenger' ? 'fb' : 'wa';
  const followup = {
    type: 'inbound', at: now.toISOString(), text: s.message || '', intent: out.intent, when: s.when || '',
    lang: s.lang || 'en', name: s.name || '', phone: channel === 'wa' ? (callNo || '') : (s.sharedPhone || ''),
    leadId: s.leadId || '', channel, id: channel === 'wa' && callNo ? callNo : (s.leadId || s.sharedPhone || s.name || ''),
  };
  return { kind: 'concierge', conversation, alert, followup };
}

let fetchImpl = (...a) => fetch(...a);
export function setLogFetch(fn) { fetchImpl = fn; }

export async function sendToSheet(payload, { timeoutMs = 8000 } = {}) {
  const url = env('SHEET_LOG_URL');
  if (!url) return { skipped: 'SHEET_LOG_URL not set' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Apps Script answers with a redirect to the result; fetch follows it.
    const r = await fetchImpl(url, {
      method: 'POST', signal: ctrl.signal, redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: env('SHEET_LOG_SECRET'), ...payload }),
    });
    const text = await r.text().catch(() => '');
    if (!r.ok) console.log('[concierge] sheet log status', r.status, text.slice(0, 200));
    return { status: r.status, text: text.slice(0, 200) };
  } catch (e) {
    console.log('[concierge] sheet log failed', e.name === 'AbortError' ? 'timeout' : e.message);
    return { error: e.message };
  } finally { clearTimeout(timer); }
}
