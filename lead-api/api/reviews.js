import { getReviews } from '../lib/reviews.js';

// GET /api/reviews — Infinity's Google rating, review count and best recent reviews, for the website.
// Public data, so any origin may read it. Cached at Vercel's edge for 6 hours, which keeps
// Google calls to a handful a day (well inside the Places API free monthly allowance).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }

  let out;
  try { out = await getReviews(); }
  catch (e) { out = { ok: false, reason: 'fetch_failed' }; }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', out.ok
    ? 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400'
    : 'public, max-age=60, s-maxage=300');
  res.end(JSON.stringify(out));
}
