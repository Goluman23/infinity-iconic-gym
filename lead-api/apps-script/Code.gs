/**
 * Infinity Concierge — lead sheet logger (free, runs on Google Apps Script)
 *
 * Paste into the lead Google Sheet: Extensions → Apps Script → replace Code.gs → Save.
 * Then Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone → Deploy.
 * Copy the Web app URL into Vercel as SHEET_LOG_URL, and SECRET below into SHEET_LOG_SECRET.
 *
 * What it does
 *  • "Conversations" tab — every message the bot's keywords missed: what they wrote,
 *    what it was understood as, what the bot replied. This is what the weekly review reads.
 *  • "Leads" tab + email to the desk — visit plans, call-backs, numbers shared,
 *    complaints, member requests. The same person + same reason within 3 hours is
 *    logged and emailed once.
 *  • "WhatsApp messages" tab — every incoming WhatsApp message, once EasySocial support
 *    switches on their message webhook (it reaches this script through /api/es/webhook).
 */
const SECRET = 'PASTE_A_LONG_RANDOM_SECRET_HERE';          // same value as SHEET_LOG_SECRET in Vercel
const DESK_EMAIL = 'frontdesk@example.com';                // who gets the alerts (comma-separate several)
const REPEAT_WINDOW_SECONDS = 3 * 60 * 60;                 // skip repeat alerts within 3 hours

const TABS = {
  conversations: ['Received (IST)', 'Platform', 'Name', 'Number', 'They wrote', 'Understood as', 'Caught by', 'When', 'Bot replied', 'Lead ID'],
  leads: ['Received (IST)', 'Platform', 'Reason', 'Name', 'Number', 'When', 'Outside hours', 'Message', 'Lead ID', 'Status'],
  whatsapp: ['Received (IST)', 'From', 'Type', 'Text', 'Status', 'Error'],
};
const TAB_NAMES = { conversations: 'Conversations', leads: 'Leads', whatsapp: 'WhatsApp messages' };

function doGet() {
  return ContentService.createTextOutput('Infinity sheet logger is running.');
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  if (SECRET === 'PASTE_A_LONG_RANDOM_SECRET_HERE' || body.secret !== SECRET) return out_({ ok: false, error: 'bad secret' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.kind === 'concierge') {
      append_('conversations', body.conversation || {});
      if (body.alert) {
        const cache = CacheService.getScriptCache();
        const key = 'alert:' + String(body.alert.key).slice(0, 200);
        if (cache.get(key)) return out_({ ok: true, alert: 'repeat-skipped' });
        cache.put(key, '1', REPEAT_WINDOW_SECONDS);
        append_('leads', body.alert.row || {});
        if (DESK_EMAIL && DESK_EMAIL.indexOf('@example.com') === -1) {
          MailApp.sendEmail(DESK_EMAIL, body.alert.subject || 'New lead', body.alert.text || '');
        }
        return out_({ ok: true, alert: 'sent' });
      }
      return out_({ ok: true });
    }
    if (body.source === 'easysocial') {
      (body.events || []).forEach(function (ev) {
        if (ev.type !== 'wa_message' && ev.type !== 'wa_status') return;
        if (ev.type === 'wa_status' && ev.status !== 'failed') return; // keep the log about conversations
        const at = ev.at ? new Date(Number(ev.at) * (String(ev.at).length > 11 ? 1 : 1000)) : new Date();
        append_('whatsapp', {
          'Received (IST)': Utilities.formatDate(at, 'Asia/Kolkata', 'dd MMM yyyy, h:mm a'),
          From: ev.from || ev.to || '', Type: ev.kind || ev.type, Text: ev.text || '', Status: ev.status || '', Error: ev.error || '',
        });
      });
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown kind' });
  } finally {
    lock.releaseLock();
  }
}

function append_(tab, obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = TAB_NAMES[tab];
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(TABS[tab]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS[tab].length).setFontWeight('bold');
  }
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  // Leading apostrophe keeps numbers like 9876543210 and text like "=..." as plain text.
  sh.appendRow(headers.map(function (h) { const v = obj[h]; return v == null ? '' : "'" + String(v).slice(0, 5000); }));
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor (▶ setup) to create the tabs and approve the permissions. */
function setup() {
  Object.keys(TABS).forEach(function (t) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName(TAB_NAMES[t])) { append_(t, {}); ss.getSheetByName(TAB_NAMES[t]).deleteRow(2); }
  });
  if (DESK_EMAIL.indexOf('@example.com') === -1) MailApp.getRemainingDailyQuota();
}
