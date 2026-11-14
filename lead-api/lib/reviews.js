// Google reviews for the website, via the Places API (New) — Place Details.
// Google returns at most 5 reviews ("most relevant"); we keep the best ones for the site.
// Env: GOOGLE_PLACES_KEY (required), GOOGLE_PLACE_ID (defaults to Infinity Faridabad),
//      REVIEWS_MIN_STARS (default 4), REVIEWS_MIN_CHARS (default 40).

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
export const DEFAULT_PLACE_ID = 'ChIJYTG1AgDdDDkRoW254Z2Ly4A';
const FIELDS = 'rating,userRatingCount,reviews,googleMapsUri';

let transport = (url, init) => fetch(url, init);
export function setTransport(fn) { transport = fn; }

export function pickBest(reviews = [], { minStars = 4, minChars = 40, limit = 6 } = {}) {
  return reviews
    .map(r => ({
      author: r.authorAttribution?.displayName || 'Google user',
      authorUrl: r.authorAttribution?.uri || '',
      photo: r.authorAttribution?.photoUri || '',
      rating: Number(r.rating) || 0,
      text: (r.originalText?.text || r.text?.text || '').replace(/\s+\n/g, '\n').trim(),
      when: r.relativePublishTimeDescription || '',
      time: Date.parse(r.publishTime || '') || 0,
      url: r.googleMapsUri || '',
    }))
    .filter(r => r.rating >= minStars && r.text.length >= minChars)
    .sort((a, b) => b.rating - a.rating || b.time - a.time)
    .slice(0, limit)
    .map(({ time, ...r }) => r);
}

export async function getReviews() {
  const key = env('GOOGLE_PLACES_KEY');
  const placeId = env('GOOGLE_PLACE_ID', DEFAULT_PLACE_ID);
  const links = {
    readUrl: `https://search.google.com/local/reviews?placeid=${placeId}`,
    writeUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
  };
  if (!key) return { ok: false, reason: 'not_configured', ...links };

  const r = await transport(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
  });
  if (!r.ok) {
    let detail = ''; try { detail = (await r.json())?.error?.status || ''; } catch {}
    return { ok: false, reason: 'google_error', status: r.status, detail, ...links };
  }
  const p = await r.json();
  return {
    ok: true,
    rating: p.rating ?? null,
    count: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri || '',
    ...links,
    reviews: pickBest(p.reviews, {
      minStars: Number(env('REVIEWS_MIN_STARS', '4')) || 4,
      minChars: Number(env('REVIEWS_MIN_CHARS', '40')) || 40,
    }),
  };
}
