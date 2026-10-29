// GET /api/es/list — API Interactive List node: the 10-row main menu (last row switches language).
import { mainMenu } from '../../lib/es-format.js';
import { send } from '../../lib/http.js';
import { brainAuthorised, input, clean } from '../../lib/es-brain-http.js';

export default async function handler(req, res) {
  const { q, p } = await input(req);
  if (!brainAuthorised(req, q)) return send(res, 401, { error: 'Missing or wrong key' });
  return send(res, 200, mainMenu(clean(p.lang || p.inf_lang) === 'hi' ? 'hi' : 'en'));
}
