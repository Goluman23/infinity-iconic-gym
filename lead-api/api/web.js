import reviews from '../lib/routes/reviews.js';
import metaCapi from '../lib/routes/meta-capi.js';

// One function for the website's small endpoints. The Hobby plan allows only 12 functions
// per deployment, so these share one. Public URLs stay the same through vercel.json rewrites:
//   /api/reviews    → /api/web?fn=reviews   (Google rating + reviews)
//   /api/meta/capi  → /api/web?fn=capi      (Meta Conversions API relay)
const ROUTES = { reviews, capi: metaCapi };

export default async function handler(req, res) {
  let fn = req.query?.fn;
  if (!fn) { try { fn = new URL(req.url, 'http://x').searchParams.get('fn'); } catch {} }
  const route = ROUTES[fn];
  if (!route) { res.statusCode = 404; return res.end('Not found'); }
  return route(req, res);
}
