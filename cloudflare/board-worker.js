// The line-up snapshot website on Cloudflare (owner, 2026-10-22). Serves the
// files the board checker uploads to the R2 bucket bound as SITE; nothing
// else. Cloudflare Access (Settings → Domains & Routes → workers.dev →
// Enable Cloudflare Access) asks each visitor for an allowed email and a
// one-time code before a request reaches this code.
//
// Setup: docs/board-checker/CLOUDFLARE.md. Paste this whole file into the
// Worker's editor in the Cloudflare dashboard.

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json',
  txt: 'text/plain; charset=utf-8', png: 'image/png', css: 'text/css; charset=utf-8',
  odt: 'application/vnd.oasis.opendocument.text',
};

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    let key;
    try {
      key = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return new Response('Bad address', { status: 400 });
    }
    if (key === '' || key.endsWith('/')) key += 'index.html';
    if (key.split('/').includes('..')) return new Response('Not found', { status: 404 });

    const head = await env.SITE.head(key);
    if (!head) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const headers = new Headers();
    head.writeHttpMetadata(headers);
    if (!headers.has('content-type')) headers.set('content-type', TYPES[key.split('.').pop().toLowerCase()] || 'application/octet-stream');
    // The page polls data/index.json for newer boards: always check back.
    headers.set('cache-control', 'no-cache');
    headers.set('etag', head.httpEtag);
    headers.set('x-robots-tag', 'noindex, nofollow');
    headers.set('x-content-type-options', 'nosniff');

    if (request.headers.get('if-none-match') === head.httpEtag) return new Response(null, { status: 304, headers });
    if (request.method === 'HEAD') return new Response(null, { headers });
    const obj = await env.SITE.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers });
  },
};
