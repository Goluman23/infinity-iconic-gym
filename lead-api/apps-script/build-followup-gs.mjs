// Generates apps-script/FollowupEngine.gs from the tested engine code, so Google Apps Script runs
// exactly the same logic as the tests and the simulator. Run: node apps-script/build-followup-gs.mjs
import fs from 'node:fs';
const rd = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = s => s.replace(/^import .*$/gm, '').replace(/^export\s+/gm, '');
const out = `/**
 * Infinity follow-up engine — GENERATED from lead-api/lib (concierge/rules.js, followup/copy.js,
 * followup/engine.js). Do not edit here; edit those files and run: node apps-script/build-followup-gs.mjs
 */
const FU = (() => {
const structuredClone = o => JSON.parse(JSON.stringify(o));
${strip(rd('../lib/concierge/rules.js'))}
${strip(rd('../lib/followup/copy.js'))}
${strip(rd('../lib/followup/engine.js'))}
return { fastRules, newLead, applyEvent, plan, markSent, parseSession, istParts, fmtTime, fmtWhen, COPY, SEQUENCES };
})();
`;
fs.writeFileSync(new URL('./FollowupEngine.gs', import.meta.url), out);
console.log('wrote apps-script/FollowupEngine.gs', out.length, 'bytes');
