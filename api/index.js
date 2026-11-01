// Vercel serverless function: every /api/* request is rewritten here (see
// vercel.json) and handled by the Express app.
import app from '../server/src/app.js';

export default function handler(req, res) {
  // vercel.json passes the original sub-path as ?__path=...; restore the
  // original URL so Express routing sees /api/doctor/login etc.
  const url = new URL(req.url, 'http://localhost');
  const subPath = url.searchParams.get('__path');
  if (subPath !== null) {
    url.searchParams.delete('__path');
    const pathname = url.pathname === '/api' || url.pathname === '/api/' ? `/api/${subPath}` : url.pathname;
    req.url = pathname + url.search;
  }
  return app(req, res);
}
