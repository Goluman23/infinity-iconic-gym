// Named EasySocial API campaigns you can add lists to by saying the name ("add this list to festive video").
// Each entry: id (also the key in ES_CAMPAIGNS, which holds the cURL spec EasySocial generates for the
// "Broadcast → Create API" campaign), a display name, aliases you might say, the WhatsApp template it uses,
// who may receive it (rule: offer | winback | members — see lib/contacts.js), when it stops accepting
// contacts, and earlier campaigns whose recipients must not get it again.
export const CAMPAIGN_REGISTRY = [
  {
    id: 'festive_video',
    name: 'Infinity Festive Offer – Video',
    aliases: ['festive video', 'festive offer video', 'infinity festive offer', 'festive offer', 'video offer', 'diwali video'],
    template: 'infinity_festive_video_offer',
    rule: 'offer',
    ends: '2026-11-10T23:59:59+05:30',
    excludeCampaigns: ['festive_100_test', 'festive_api'],
  },
  {
    // EasySocial campaign "Festive offer API" (Create API, made by the client 3 Nov 2026). Lists are added in batches.
    id: 'festive_api',
    name: 'Festive offer API',
    aliases: ['festive offer api', 'festive api', 'festive offer api campaign', 'api campaign'],
    template: 'set in EasySocial (Festive offer API campaign)',
    rule: 'offer',
    ends: '2026-11-10T23:59:59+05:30',
    excludeCampaigns: ['festive_100_test', 'festive_video'],
    // Overrides the matching fields in the ES_CAMPAIGNS body, so the offer timer follows `ends` without editing the secret.
    bodyOverride: { expiration_time_ms: String(Date.parse('2026-11-10T23:59:59+05:30')) },
  },
  {
    // EasySocial campaign "After festive detox" (Create API, 11 Nov 2026): the client's Infinity Detox Offer with the poster.
    // Sent to everyone who got the festive offer. Uses the same account key as festive_api, so no new secret:
    // es.from = the ES_CAMPAIGNS entry whose URL key is reused; campaignId/templateId = the new campaign's ids.
    id: 'after_festive_detox',
    name: 'After festive detox',
    aliases: ['after festive detox', 'detox', 'detox offer', 'infinity detox offer', 'detox campaign', 'after festive detox campaign'],
    template: 'infinity_detox_offer',
    rule: 'offer',
    ends: '2026-11-30T23:59:59+05:30',
    excludeCampaigns: [],
    es: {
      from: 'festive_api', campaignId: '', templateId: '',
      body: { mobileNumber: '{{phone}}', body1: '{{first_name}}', header1: 'https://api.eqiconic.com/media/infinity-detox-offer.jpg', name: '{{first_name}}' },
    },
  },
];

// Build the EasySocial send spec for a campaign that reuses another campaign's account key (see es above).
export function derivedSpec(c, campaigns) {
  if (!c.es) return null;
  const base = campaigns[c.es.from];
  if (!base || !base.url || !c.es.campaignId || !c.es.templateId) return null;
  const url = base.url.replace(/\/\d+\/\d+\/?$/, `/${c.es.campaignId}/${c.es.templateId}`);
  return { ...base, url, body: c.es.body || base.body };
}

// Recipients of earlier one-off broadcasts, kept in the ledger under these ids so they are never re-sent.
export const PAST_BROADCASTS = {
  festive_100_test: 'infinity_festive_offer_100_test (Excel, 1 Nov 2026)',
};

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function resolveCampaign(said) {
  const q = norm(said);
  if (!q) return null;
  const exact = CAMPAIGN_REGISTRY.find(c => [c.id, c.name, c.template, ...c.aliases].some(a => norm(a) === q));
  if (exact) return exact;
  const hits = CAMPAIGN_REGISTRY.filter(c => [c.id, c.name, ...c.aliases].some(a => norm(a).includes(q) || q.includes(norm(a))));
  return hits.length === 1 ? hits[0] : null;
}

export function campaignOpen(c, now = new Date()) { return !c.ends || now <= new Date(c.ends); }
