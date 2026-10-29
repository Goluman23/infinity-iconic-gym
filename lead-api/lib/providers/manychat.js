// ManyChat adapter (kept as a fallback provider). Same interface as the EasySocial adapter.
import { CONFIG } from '../config.js';
import { mc } from '../manychat.js';

const tagNames = info => (info?.tags || []).map(t => (t.name || t).toString());
const fieldVal = (info, name) => (info?.custom_fields || []).find(f => f.name === name)?.value ?? null;
const STAGES = ['st_member', 'st_won', 'st_trial_booked', 'st_lapsed', 'st_new', 'st_lost', 'invalid_number'];
function normalise(info) {
  if (!info) return null;
  const tags = tagNames(info);
  return {
    id: info.id, raw: info, tags,
    optedOut: tags.includes('optout'),
    stage: STAGES.find(s => tags.includes(s)) || '',
    firstTouchAt: fieldVal(info, 'inf_first_touch_at'), firstSource: fieldVal(info, 'inf_source') || '',
  };
}

export const manychat = {
  name: 'manychat',
  async find(phone) {
    const sub = await mc.findByPhone(phone);
    if (!sub) return null;
    return normalise((await mc.getInfo(sub.id)) || sub);
  },
  async create(lead) { const s = await mc.create(lead); return { ...normalise(s), created: true }; },
  async save(contact, phone, fields, tags = []) {
    const { inf_stage, ...rest } = fields;
    await mc.setFields(contact.id, rest);
    for (const t of [...tags, ...(inf_stage ? [inf_stage] : [])]) await mc.addTag(contact.id, t);
    return { missingTagIds: [] };
  },
  async sendFirstTouch(contact, key) {
    const ns = CONFIG.flows[key];
    if (!ns && !CONFIG.dryRun) throw new Error(`Flow for "${key}" is not configured (set FLOW_* env)`);
    await mc.sendFlow(contact.id, ns || `DRY_RUN:${key}`);
  },
};
