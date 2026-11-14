// Netlify Function adapter for a free preview on *.netlify.app.
// Same worker code as on Cloudflare; Netlify passes the client IP as x-nf-client-connection-ip,
// which is only forwarded to the in-memory rate limiter and never stored.
import worker from '../../src/index';
export default async (req: Request): Promise<Response> => {
  const ip = req.headers.get('x-nf-client-connection-ip');
  if (!ip || req.headers.get('cf-connecting-ip')) return worker.fetch(req);
  const headers = new Headers(req.headers);
  headers.set('cf-connecting-ip', ip);
  const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') { init.body = req.body; init.duplex = 'half'; }
  return worker.fetch(new Request(req.url, init));
};
export const config = { path: ['/', '/mcp', '/health'] };
