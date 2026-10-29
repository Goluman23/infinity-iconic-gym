// Picks the messaging platform. PROVIDER=easysocial (default) or manychat.
import { CONFIG } from '../config.js';
import { easysocial, ES } from './easysocial.js';
import { manychat } from './manychat.js';

const wrap = {
  easysocial: {
    ...easysocial,
    hasFirstTouch: k => CONFIG.dryRun || !!ES.campaigns[k]?.url,
    missingMessage: k => `No EasySocial API campaign for "${k}" — add it to ES_CAMPAIGNS`,
  },
  manychat: {
    ...manychat,
    hasFirstTouch: k => CONFIG.dryRun || !!CONFIG.flows[k],
    missingMessage: k => `Flow for "${k}" is not configured (set FLOW_* env)`,
  },
};
export function providerName() { return (process.env.PROVIDER || 'easysocial').trim().toLowerCase(); }
export function getProvider() {
  const p = wrap[providerName()];
  if (!p) throw new Error(`Unknown PROVIDER "${providerName()}" (use easysocial or manychat)`);
  return p;
}
