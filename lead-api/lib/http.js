import { CONFIG } from './config.js';

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGIN || '*').trim();
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Intake-Key, X-Brain-Key');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  return false;
}
export function send(res, code, obj) {
  res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj, null, 2));
}
export function authorised(req) {
  if (!CONFIG.intakeKey) return CONFIG.dryRun; // without a key, only dry runs are allowed
  const k = req.headers['x-intake-key'] || '';
  // constant-time-ish compare
  if (k.length !== CONFIG.intakeKey.length) return false;
  let d = 0; for (let i = 0; i < k.length; i++) d |= k.charCodeAt(i) ^ CONFIG.intakeKey.charCodeAt(i);
  return d === 0;
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 1_000_000) throw new Error('Body too large');
  return raw ? JSON.parse(raw) : {};
}
