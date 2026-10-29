// Runs a lead through time with scripted customer/desk events — used by tests and the simulator.
import { newLead, applyEvent, plan, markSent } from './engine.js';

export function simulate({ lead: init, events = [], until, stats = {} }) {
  let lead = newLead(init);
  const log = [{ at: lead.stageAt, who: 'customer', text: init.firstText || '(first message)', note: 'lead created' }];
  const evs = [...events].sort((a, b) => new Date(a.at) - new Date(b.at));
  let now = new Date(init.at); const end = new Date(until);
  for (let guard = 0; guard < 400; guard++) {
    const a = plan(lead, now, stats);
    const nextEv = evs[0] ? new Date(evs[0].at) : null;
    const dueAt = a ? new Date(a.due) : null;
    if (nextEv && (!dueAt || nextEv <= dueAt) && nextEv <= end) {
      const ev = evs.shift(); now = nextEv;
      const r = applyEvent(lead, ev); lead = r.lead;
      log.push({ at: now.toISOString(), who: ev.type === 'inbound' ? 'customer' : 'desk', text: ev.text || ev.type, note: [...r.alerts, ...r.credits.map(c => `credit ${c.kind} → ${c.step}/${c.variant}`)].join(' · ') });
      continue;
    }
    if (!a || dueAt > end) break;
    now = dueAt;
    log.push({ at: a.due, who: 'bot', step: a.stepId, label: a.label, variant: a.variant, mode: a.delivery.mode, category: a.delivery.category || '', cost: a.delivery.cost ?? 0, blocked: a.delivery.reason || '', text: a.text, skipped: a.skip });
    lead = markSent(lead, a, now);
  }
  return { lead, log };
}
