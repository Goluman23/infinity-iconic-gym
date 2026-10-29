// GET|POST /api/es/buttons — API Interactive Button node placed right after the brain node.
// URL: /api/es/buttons?key=…&ctx=[inf_ctx]&lang=[inf_lang]&name=[name]
// Rebuilds the buttons for the route the brain just chose (≤3, titles ≤20 chars).
import { buttonsFor, ROUTE_IDS } from '../../lib/brain.js';
import { buttonsOnly, mainMenu } from '../../lib/es-format.js';
import { send } from '../../lib/http.js';
import { brainAuthorised, input, clean } from '../../lib/es-brain-http.js';

export default async function handler(req, res) {
  const { q, p } = await input(req);
  if (!brainAuthorised(req, q)) return send(res, 401, { error: 'Missing or wrong key' });
  const ctx = clean(p.ctx || p.inf_ctx), lang = clean(p.lang || p.inf_lang) === 'hi' ? 'hi' : 'en';
  if (!ctx || ctx === 'menu' || !ROUTE_IDS.includes(ctx)) return send(res, 200, mainMenu(lang));
  return send(res, 200, buttonsOnly(buttonsFor(ctx, lang, clean(p.name)), lang));
}
