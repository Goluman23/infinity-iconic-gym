// Builds the WhatsApp template pack (for Meta approval in EasySocial) from the same copy the engine uses.
// Templates are only needed for messages sent more than 24 h after the customer's last message.
import { COPY, render } from './copy.js';
import { newLead } from './engine.js';

// Submit priority 1 first: they cover the messages that most often fall outside the 24 h window.
const PRIORITY1 = new Set(['new_d1', 'new_d3', 'new_d7', 'new_d14', 'book_3h', 'book_1h', 'book_after', 'vis_d1', 'join_1h']);
const SKIP = new Set(['new_30m', 'new_ig_last', 'optout_ack']); // always inside the window (free-form)
const FIELD = { NAME: 'first_name', WHEN: 'when', TIME: 'time' };
const AFTER_OFFER = new Date('2026-12-01T12:00:00+05:30'); // templates stay evergreen: no dated offer lines

export function templatePack() {
  const rows = [];
  for (const [id, c] of Object.entries(COPY)) {
    if (SKIP.has(id)) continue;
    for (const v of Object.keys(c.variants)) for (const lang of ['en', 'hinglish']) {
      const lead = { ...newLead({ id: 'x', name: '§NAME§', at: AFTER_OFFER }), lang };
      let text = render(id, v, lead, AFTER_OFFER, { when: '§WHEN§', time: '§TIME§' });
      const order = []; text = text.replace(/§(NAME|WHEN|TIME)§/g, (_, k) => { let i = order.indexOf(k); if (i < 0) { order.push(k); i = order.length - 1; } return `{{${i + 1}}}`; });
      const code = lang === 'hinglish' ? 'hi' : 'en';
      rows.push({
        priority: PRIORITY1.has(id) && (v === 'A' || id === 'new_d1') ? 1 : 2,
        template_name: `infinity_${id}_${v}_${code}`.toLowerCase(),
        campaign_key: `fu_${id}_${v}_${code}`,
        category: c.kind === 'utility' ? 'UTILITY' : 'MARKETING',
        language: lang === 'hinglish' ? 'Hindi (hi) — written in Hinglish' : 'English (en)',
        when_used: c.label, body: text,
        variables: order.map((k, i) => `{{${i + 1}}} = ${FIELD[k]}`).join('; '),
        sample: order.map((k, i) => `{{${i + 1}}} = ${{ NAME: 'Rohit', WHEN: 'tomorrow at 7 AM', TIME: '7 AM' }[k]}`).join('; '),
      });
    }
  }
  return rows.sort((a, b) => a.priority - b.priority);
}

export function toCSV(rows) {
  const cols = ['priority', 'template_name', 'campaign_key', 'category', 'language', 'when_used', 'body', 'variables', 'sample'];
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n') + '\n';
}
