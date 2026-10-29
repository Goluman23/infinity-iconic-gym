import { CONFIG, ENTRY } from './config.js';
import { cleanLead, seasonFor, inQuietHours, localParts } from './rules.js';
import { getProvider } from './providers/index.js';

const NEXT = {
  form: 'Template lead_form_welcome → lead picks Morning / Evening / Weekend → 3 slots → booked (WA-B) → reminders (WA-C)',
  missed_call: 'Template lead_missed_call → Book a visit / Plans / Call me back',
  ig_phone: 'Template lead_reengage → Morning / Evening → slots → booked',
  walkin: 'Broadcast M1 → Interested (plan match) / Who is this? / Not interested · max 2 messages',
  camp: 'Broadcast M2 resident privilege → Book / Who is this? / Not now',
  lapsed: 'Win-back WF5 → I\'m in (renewal link) / Call me / Not now',
  corporate: 'Corporate hand-off → team calls today',
};


// Process one lead end to end. Never throws: always returns a result row.
export async function processLead(input, now = new Date()) {
  const started = Date.now();
  const c = cleanLead(input);
  if (!c.ok) return { status: 'invalid', errors: c.errors, input: { name: input?.name, phone: input?.phone } };
  const lead = c.lead;
  const entry = ENTRY[lead.entry];
  const flowKey = entry.flow;
  const P = getProvider();
  const season = seasonFor(now);
  const base = { name: lead.name, phone: '+' + lead.phone, entry: lead.entry, season, provider: P.name };

  if (!P.hasFirstTouch(flowKey)) return { ...base, status: 'error', errors: [P.missingMessage(flowKey)] };
  if (!entry.initiated && inQuietHours(now)) {
    return { ...base, status: 'deferred', reason: `Broadcasts are not sent between ${CONFIG.quietStart}:00 and ${CONFIG.quietEnd}:00`, retry_after: `${String(CONFIG.quietEnd).padStart(2, '0')}:00 local` };
  }

  try {
    // 1 · Find or create the WhatsApp contact
    let contact = await P.find(lead.phone);
    let created = false;
    if (!contact) { contact = await P.create(lead); created = true; }
    if (!contact) throw new Error(`${P.name} did not return the contact`);
    const id = contact.id ?? null;
    const stage = contact.stage || '';

    // 2 · Known-contact rules — never pitch members, never message opted-out or invalid numbers
    if (contact.optedOut) return { ...base, id, status: 'skipped_opted_out', reason: 'Contact opted out. They are only messaged again if they write to Infinity first.' };
    if (stage === 'invalid_number') return { ...base, id, status: 'skipped_invalid_number' };
    if ((stage === 'st_member' || stage === 'st_won') && flowKey !== 'corporate') {
      await P.save(contact, lead.phone, { inf_last_source: lead.source }, ['intake_member_contact']);
      return { ...base, id, status: 'skipped_member', reason: 'Active member — no sales message. Tagged for the desk.' };
    }
    if (stage === 'st_trial_booked') {
      await P.save(contact, lead.phone, { inf_last_source: lead.source }, ['intake_while_booked']);
      return { ...base, id, status: 'skipped_booked', reason: 'Session already booked — reminders are running. Tagged for the desk.' };
    }
    const last = contact.firstTouchAt;
    if (last && (now - new Date(last)) / 36e5 < CONFIG.duplicateWindowHours) {
      return { ...base, id, status: 'duplicate', reason: `First message already sent at ${last}` };
    }

    // 3 · Lapsed ex-members get the win-back, whatever form they used
    const useKey = stage === 'st_lapsed' && entry.initiated && P.hasFirstTouch('lapsed') ? 'lapsed' : flowKey;

    // 4 · Save what we know (first source is kept; latest source always updated)
    const saved = await P.save(contact, lead.phone, {
      inf_source: contact.firstSource || lead.source, inf_last_source: lead.source, inf_entry: lead.entry,
      inf_goal: lead.goal, inf_time: lead.time, inf_area: lead.area, inf_lang: lead.lang,
      inf_note: lead.note, inf_expiry: lead.expiry, inf_season_at_intake: season,
      inf_first_touch_at: now.toISOString(), inf_ctx: 'first_touch_' + useKey,
      ...(stage ? {} : { inf_stage: 'st_new' }),
    }, ['intake_api', 'wa_optin', `src_${lead.entry}`]);

    // 5 · Send the first message — always an approved template (the lead has not written yet)
    await P.sendFirstTouch(contact, useKey, lead);
    const out = { ...base, id, status: 'sent', created, flow: useKey, next: NEXT[useKey], ms: Date.now() - started };
    if (saved?.missingTagIds?.length) out.warnings = [`Tag ids not set in ES_TAG_IDS: ${saved.missingTagIds.join(', ')}`];
    return out;
  } catch (e) {
    return { ...base, status: 'error', errors: [e.message] };
  }
}

export async function processBulk(list, now = new Date()) {
  const rows = [];
  const seen = new Set();
  for (const [i, input] of list.slice(0, CONFIG.bulkMax).entries()) {
    const key = String(input?.phone || '').replace(/\D/g, '').slice(-10);
    if (key && seen.has(key)) { rows.push({ row: i + 1, status: 'duplicate_in_file', phone: input.phone }); continue; }
    seen.add(key);
    const r = await processLead(input, now);
    rows.push({ row: i + 1, ...r });
    if (r.status === 'sent' && !CONFIG.dryRun) await new Promise(res => setTimeout(res, CONFIG.bulkDelayMs));
  }
  const count = s => rows.filter(r => r.status === s).length;
  return {
    total: list.length, processed: rows.length, skipped_over_limit: Math.max(0, list.length - CONFIG.bulkMax),
    summary: Object.fromEntries([...new Set(rows.map(r => r.status))].map(s => [s, count(s)])),
    local_time: localParts(now), rows,
  };
}
