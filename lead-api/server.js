// Local server for testing: node server.js  → http://localhost:3000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import lead from './api/lead.js';
import bulk from './api/bulk.js';
import health from './api/health.js';
import esBrain from './api/es/brain.js';
import esButtons from './api/es/buttons.js';
import esList from './api/es/list.js';
import esWebhook from './api/es/webhook.js';
import esConcierge from './api/es/concierge.js';

const routes = { '/api/lead': lead, '/api/bulk': bulk, '/api/health': health,
  '/api/es/brain': esBrain, '/api/es/buttons': esButtons, '/api/es/list': esList, '/api/es/webhook': esWebhook, '/api/es/concierge': esConcierge };
http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (routes[path]) return routes[path](req, res);
  if (path === '/' || path === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(await readFile(new URL('./public/index.html', import.meta.url)));
  }
  res.statusCode = 404; res.end('Not found');
}).listen(process.env.PORT || 3000, () => console.log('Lead API on http://localhost:' + (process.env.PORT || 3000)));
