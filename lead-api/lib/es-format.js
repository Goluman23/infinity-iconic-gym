// Turns a brain decision into the JSON shapes EasySocial's chatbot nodes expect.
// Shapes from EasySocial docs: API Basic Message (data.body_text), API Interactive
// Button / List (data.interactive), API True/False (data.success + lead_attributes),
// and the n8n-style webhook node (message, lead_attributes, last_response).
export function toEasySocial(d, format = 'n8n', opts = {}) {
  const attrs = { ...d.attrs, inf_has_buttons: d.buttons.length ? 'yes' : 'no' };
  if (format === 'text') return { data: { body_text: d.text }, lead_attributes: attrs };
  if (format === 'bool') return { data: { success: !d.handoff && !d.flow }, lead_attributes: attrs };
  if (format === 'buttons') {
    const buttons = (d.buttons.length ? d.buttons : [{ id: 'menu', title: 'Quick answers' }])
      .slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } }));
    return { data: { interactive: { type: 'button', body: { text: d.text.slice(0, 1024) }, action: { buttons } } }, lead_attributes: attrs };
  }
  // numbered=1: options written into the text ("Reply 1, 2 or 3") for setups without a button node.
  const text = opts.numbered && d.buttons.length
    ? d.text + '\n\n' + d.buttons.map((b, i) => `*${i + 1}* · ${b.title}`).join('\n') + (d.lang === 'hi' ? '\n\n_Number ya shabd likh dijiye_' : '\n\n_Reply with a number or just type_')
    : d.text;
  return { message: text, lead_attributes: attrs, last_response: text };
}

// Buttons only, for an API Interactive Button node placed after the n8n-style brain node.
export function buttonsOnly(buttons, lang) {
  const list = (buttons.length ? buttons : [{ id: 'menu', title: lang === 'hi' ? 'Jaldi jawab' : 'Quick answers' }]).slice(0, 3);
  return { data: { interactive: { type: 'button', body: { text: lang === 'hi' ? 'Ek option chunein 👇' : 'Choose an option 👇' }, action: { buttons: list.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } } } };
}

// Main menu as an API Interactive List (max 10 rows, titles ≤ 20 chars, no emoji).
export function mainMenu(lang) {
  const hi = lang === 'hi';
  const rows = [
    ['book', 'Book free session', 'Free session book'], ['price', 'Plans and offer', 'Plans aur offer'], ['fit', 'Which plan fits me', 'Mere liye plan'],
    ['hyrox', 'HYROX and CrossFit', 'HYROX aur CrossFit'], ['pt', 'Personal training', 'Personal training'], ['physio', 'Physiotherapy', 'Physiotherapy'],
    ['classes', 'Ladies and Group-X', 'Ladies aur Group-X'], ['loc', 'Location and parking', 'Location aur parking'], ['human', 'Talk to the team', 'Team se baat'],
    ['lang', hi ? 'English mein baat' : 'हिंदी में बात करें', 'English mein baat'],
  ];
  return { data: { interactive: { type: 'list', body: { text: hi ? 'Bataiye, kya madad karein?' : 'How can we help?' }, action: { button: hi ? 'Option chunein' : 'Choose an option', sections: [{ title: 'Infinity Iconic', rows: rows.map(([id, en, h]) => ({ id, title: (id === 'lang' ? en : (hi ? h : en)).slice(0, 20) })) }] } } } };
}
