/**
 * Infinity follow-ups — scheduler + sheet control panel (runs inside the "Infinity Leads" sheet).
 *
 * Tabs it manages:
 *  • Follow-ups       one row per lead. The desk can change "Stage" (Visited / Joined / Lost) and
 *                     "Session (IST)" (e.g. 03/11/2026 19:00); everything else is filled in for you.
 *  • Follow-up log    every message the engine sent, would send (DRY RUN) or could not send.
 *  • Follow-up stats  sends, replies, bookings per message and variant — the engine learns from it.
 *
 * Setup: add this file and FollowupEngine.gs next to Code.gs, run installFollowupTrigger() once.
 * Messages go out only when Vercel has FOLLOWUP_LIVE=1; until then everything is logged as DRY RUN.
 */
const FU_SEND_URL = 'https://api.eqiconic.com/api/es/followup-send';
const FU_TABS = {
  leads: ['Lead ID', 'Name', 'Phone', 'Channel', 'Stage', 'Session (IST)', 'Next step', 'Next due (IST)', 'Last sent', 'Messages sent', 'State'],
  log: ['Time (IST)', 'Lead ID', 'Name', 'Channel', 'Step', 'Variant', 'Delivery', 'Est. cost ₹', 'Status', 'Message'],
  stats: ['Message', 'Variant', 'Sent', 'Replied', 'Booked', 'Visited', 'Joined', 'Reply %', 'Booked %'],
};
const FU_NAMES = { leads: 'Follow-ups', log: 'Follow-up log', stats: 'Follow-up stats' };
const STAGE_LABEL = { new: 'New', booked: 'Booked', visited: 'Visited', joined: 'Joined', closed: 'Closed', optout: 'Opted out' };
const LABEL_EVENT = { visited: 'visited', joined: 'joined', lost: 'lost', closed: 'lost', booked: 'booked' };

function fuSheet_(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(FU_NAMES[key]);
  if (!sh) {
    sh = ss.insertSheet(FU_NAMES[key]);
    sh.appendRow(FU_TABS[key]); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, FU_TABS[key].length).setFontWeight('bold');
    if (key === 'leads') {
      sh.hideColumns(FU_TABS.leads.length); // State (JSON) — the engine's memory
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(['New', 'Booked', 'Visited', 'Joined', 'Lost', 'Closed', 'Opted out'], true).build();
      sh.getRange(2, 5, 2000, 1).setDataValidation(rule);
    }
  }
  return sh;
}
function fuIst_(d) { return Utilities.formatDate(new Date(d), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm'); }
function fuParseIst_(v) {
  if (v instanceof Date) return v;
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) - 330 * 60000) : null;
}

// ── stats (learning) ──────────────────────────────────────────────────────
function fuReadStats_() {
  const rows = fuSheet_('stats').getDataRange().getValues().slice(1), st = {};
  rows.forEach(r => { if (!r[0]) return; (st[r[0]] = st[r[0]] || {})[r[1]] = { sent: +r[2] || 0, replied: +r[3] || 0, booked: +r[4] || 0, visited: +r[5] || 0, joined: +r[6] || 0 }; });
  return st;
}
function fuBump_(copyId, variant, field) {
  const sh = fuSheet_('stats'), rows = sh.getDataRange().getValues();
  const col = { sent: 3, replied: 4, booked: 5, visited: 6, joined: 7 }[field];
  let i = rows.findIndex((r, k) => k > 0 && r[0] === copyId && r[1] === variant);
  if (i < 0) { sh.appendRow([copyId, variant, 0, 0, 0, 0, 0, '', '']); i = sh.getLastRow() - 1; }
  const row = i + 1, cell = sh.getRange(row, col); cell.setValue((+cell.getValue() || 0) + 1);
  sh.getRange(row, 8).setFormula(`=IFERROR(D${row}/C${row},0)`).setNumberFormat('0%');
  sh.getRange(row, 9).setFormula(`=IFERROR(E${row}/C${row},0)`).setNumberFormat('0%');
}

// ── lead rows ─────────────────────────────────────────────────────────────
function fuFind_(id) {
  const sh = fuSheet_('leads'), ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  const i = ids.findIndex(r => String(r[0]) === String(id));
  return i < 0 ? null : i + 2;
}
function fuWrite_(row, lead, next) {
  const sh = fuSheet_('leads');
  const vals = [lead.id, lead.name, lead.phone ? "'" + lead.phone : '', { wa: 'WhatsApp', ig: 'Instagram', fb: 'Messenger' }[lead.channel] || lead.channel,
    STAGE_LABEL[lead.stage] || lead.stage, lead.session ? fuIst_(lead.session.at) + (lead.session.approx ? ' (approx)' : '') : '',
    next ? next.stepId + ' · ' + next.label : '—', next ? fuIst_(next.due) : '', lead.lastOutbound ? fuIst_(lead.lastOutbound) : '',
    lead.history.filter(h => !h.blocked).length, JSON.stringify(lead)];
  if (row) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
}

// Called by Code.gs for every customer message (concierge or WhatsApp webhook).
function fuIngest_(ev) {
  if (!ev || !ev.id) return;
  const row = fuFind_(ev.id);
  let lead = row ? JSON.parse(fuSheet_('leads').getRange(row, FU_TABS.leads.length).getValue()) : FU.newLead({ id: ev.id, name: ev.name, phone: ev.phone, channel: ev.channel || 'wa', lang: ev.lang || 'en', at: ev.at });
  if (ev.name && !lead.name) lead.name = ev.name;
  if (ev.phone && !lead.phone) lead.phone = ev.phone;
  if (!ev.intent && ev.text) { const r = FU.fastRules(ev.text); ev.intent = r.intent; ev.when = ev.when || r.when; ev.lang = ev.lang || r.lang; }
  const res = FU.applyEvent(lead, ev); lead = res.lead;
  res.credits.forEach(c => fuBump_(c.step, c.variant, c.kind));
  fuWrite_(row, lead, FU.plan(lead, new Date(), fuReadStats_()));
}

// ── the scheduler (time trigger, every 10 minutes) ─────────────────────────
function runFollowups() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try {
    const sh = fuSheet_('leads'), n = sh.getLastRow() - 1; if (n < 1) return;
    const rows = sh.getRange(2, 1, n, FU_TABS.leads.length).getValues();
    const stats = fuReadStats_(), now = new Date(), started = Date.now();
    rows.forEach((r, i) => {
      if (Date.now() - started > 4.5 * 60000) return; // stay inside Apps Script's 6-minute limit
      let lead; try { lead = JSON.parse(r[FU_TABS.leads.length - 1]); } catch (e) { return; }
      // desk changes in the sheet → events
      const stageCell = String(r[4] || '').toLowerCase().trim();
      const wanted = LABEL_EVENT[stageCell] || LABEL_EVENT[stageCell.replace('opted out', 'optout')];
      if (wanted && wanted !== lead.stage && !(wanted === 'lost' && lead.stage === 'closed')) {
        const res = FU.applyEvent(lead, { type: wanted, at: now.toISOString() }); lead = res.lead; res.credits.forEach(c => fuBump_(c.step, c.variant, c.kind));
      }
      const sessCell = fuParseIst_(String(r[5] || '').replace(' (approx)', ''));
      if (sessCell && (!lead.session || Math.abs(sessCell - new Date(lead.session.at)) > 60000) && sessCell > now) {
        lead = FU.applyEvent(lead, { type: 'booked', at: now.toISOString(), session: { at: sessCell.toISOString(), approx: false, phrase: '' } }).lead;
      }
      const a = FU.plan(lead, now, stats);
      if (a && a.send) {
        const status = fuDeliver_(lead, a), delivered = status === 'SENT' || status === 'DRY RUN';
        // anything not delivered (Instagram, no number, API error) is skipped, never counted as sent
        lead = FU.markSent(lead, delivered ? a : Object.assign({}, a, { delivery: { mode: 'blocked', reason: status } }), now);
        if (delivered) fuBump_(a.copyId, a.variant, 'sent');
        fuSheet_('log').appendRow([fuIst_(now), lead.id, lead.name, lead.channel, a.stepId, a.variant,
          a.delivery.mode + (a.delivery.category ? ' · ' + a.delivery.category : ''), a.delivery.cost || 0, status, a.text]);
      }
      fuWrite_(i + 2, lead, FU.plan(lead, now, stats));
    });
  } finally { lock.releaseLock(); }
}

function fuDeliver_(lead, a) {
  if (a.delivery.mode === 'blocked') return 'BLOCKED';
  if (lead.channel !== 'wa') return 'NOT SENT · ' + (lead.channel === 'ig' ? 'Instagram' : 'Messenger') + ' has no send API in EasySocial — use EasySocial auto-reminder';
  if (!/^91[6-9]\d{9}$/.test(String(lead.phone || ''))) return 'NOT SENT · no WhatsApp number';
  const first = String(lead.name || '').split(' ')[0];
  const res = UrlFetchApp.fetch(FU_SEND_URL, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ secret: SECRET, phone: lead.phone, mode: a.delivery.mode, text: a.text, copyId: a.copyId, variant: a.variant, lang: lead.lang,
      vars: { name: lead.name, first_name: first, when: lead.session ? FU.fmtWhen(new Date(lead.session.at), new Date(), lead.lang) : '', time: lead.session ? FU.fmtTime(new Date(lead.session.at)) : '' } }) });
  let j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() === 200 && j.dryRun) return 'DRY RUN';
  if (res.getResponseCode() === 200 && j.ok) return 'SENT';
  return 'ERROR · ' + (j.error || res.getResponseCode());
}

/** Run once: creates the tabs and a trigger that runs the follow-ups every 10 minutes. */
function installFollowupTrigger() {
  ['leads', 'log', 'stats'].forEach(fuSheet_);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runFollowups').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runFollowups').timeBased().everyMinutes(10).create();
}
