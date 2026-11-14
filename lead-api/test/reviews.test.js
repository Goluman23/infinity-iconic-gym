// Offline test for /api/reviews: a fake Google Places response, no network.  Run: npm test
import assert from 'node:assert/strict';
const { pickBest, getReviews, setTransport } = await import('../lib/reviews.js');

const review = (rating, text, publishTime, name = 'A') => ({
  rating, publishTime, relativePublishTimeDescription: '2 weeks ago',
  text: { text }, originalText: { text },
  authorAttribution: { displayName: name, uri: 'https://maps.google.com/u/' + name, photoUri: 'https://lh3/' + name },
  googleMapsUri: 'https://maps.google.com/r/' + name,
});
const long = 'Great coaching and a huge, clean floor. Trainers actually correct your form every session.';
const sample = [
  review(5, long, '2026-10-01T00:00:00Z', 'Old5'),
  review(5, long, '2026-11-01T00:00:00Z', 'New5'),
  review(4, long, '2026-11-05T00:00:00Z', 'Four'),
  review(3, long, '2026-11-10T00:00:00Z', 'Three'),
  review(5, 'Nice', '2026-11-11T00:00:00Z', 'Short'),
];

// best first: 5★ newest → 5★ older → 4★; drops 3★ and too-short text
assert.deepEqual(pickBest(sample).map(r => r.author), ['New5', 'Old5', 'Four']);
assert.equal(pickBest(sample, { minStars: 5 }).length, 2);
assert.ok(!('time' in pickBest(sample)[0]));
assert.equal(pickBest(sample)[0].authorUrl, 'https://maps.google.com/u/New5');

// not configured → safe fallback with links
delete process.env.GOOGLE_PLACES_KEY;
let out = await getReviews();
assert.equal(out.ok, false); assert.equal(out.reason, 'not_configured'); assert.match(out.writeUrl, /writereview\?placeid=/);

// configured → calls Places API (New) with key + field mask, never leaks the key
process.env.GOOGLE_PLACES_KEY = 'test-key';
let seen;
setTransport(async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ rating: 4.9, userRatingCount: 176, googleMapsUri: 'https://maps', reviews: sample }) }; });
out = await getReviews();
assert.equal(out.ok, true); assert.equal(out.rating, 4.9); assert.equal(out.count, 176); assert.equal(out.reviews.length, 3);
assert.match(seen.url, /^https:\/\/places\.googleapis\.com\/v1\/places\/ChIJYTG1AgDdDDkRoW254Z2Ly4A/);
assert.equal(seen.init.headers['X-Goog-Api-Key'], 'test-key');
assert.match(seen.init.headers['X-Goog-FieldMask'], /reviews/);
assert.ok(!JSON.stringify(out).includes('test-key'));

// Google error → ok:false, no throw
setTransport(async () => ({ ok: false, status: 403, json: async () => ({ error: { status: 'PERMISSION_DENIED' } }) }));
out = await getReviews();
assert.deepEqual([out.ok, out.reason, out.status, out.detail], [false, 'google_error', 403, 'PERMISSION_DENIED']);

console.log('reviews: all checks passed');
