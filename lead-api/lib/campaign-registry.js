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
    ends: '2026-11-08T23:59:59+05:30',
    excludeCampaigns: ['festive_100_test'],
  },
];

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
