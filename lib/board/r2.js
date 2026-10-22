// Publishes the snapshot website to Cloudflare R2 (owner, 2026-10-22: off
// Netlify, whose per-deploy credits can't cover an update every 15 min).
// The laptop uploads straight to the bucket through R2's S3 API with its own
// key; the Worker in cloudflare/board-worker.js serves the bucket behind
// Cloudflare Access (email login). Only files whose content changed go up.
//
// Signing is AWS Signature Version 4 (R2 speaks it, region "auto"), written
// out here so the laptop needs no extra package.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
// RFC 3986: encodeURIComponent leaves !'()* alone; S3 wants them encoded.
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encPath = (p) => p.split('/').map(enc).join('/');

// Headers for one signed request. `headers` are extra ones to sign (e.g.
// content-type); host, x-amz-date and x-amz-content-sha256 are added.
function signRequest({ method, host, path: reqPath, query = {}, body = '', headers = {}, keyId, secret, region = 'auto', service = 's3', now = new Date() }) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const all = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])),
    host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(all).sort();
  const canonicalQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
  const canonical = [method, encPath(reqPath), canonicalQuery, names.map((n) => `${n}:${all[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
  const out = { ...all, authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` };
  delete out.host; // fetch sets it
  return { headers: out, url: `https://${host}${encPath(reqPath)}${canonicalQuery ? `?${canonicalQuery}` : ''}` };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.odt': 'application/vnd.oasis.opendocument.text', '.css': 'text/css; charset=utf-8' };
const typeOf = (name) => TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';

const xmlText = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Every object in the bucket: key → MD5 (R2's ETag for a single upload).
async function listBucket(r2, fetchImpl) {
  const found = new Map();
  let token = null;
  do {
    const query = { 'list-type': '2', ...(token ? { 'continuation-token': token } : {}) };
    const req = signRequest({ ...r2, method: 'GET', path: `/${r2.bucket}`, query });
    const res = await fetchImpl(req.url, { headers: req.headers, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(why(res.status, 'list the bucket'));
    const xml = await res.text();
    for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = xmlText((/<Key>([\s\S]*?)<\/Key>/.exec(item) || [])[1] || '');
      const etag = xmlText((/<ETag>([\s\S]*?)<\/ETag>/.exec(item) || [])[1] || '').replace(/"/g, '');
      if (key) found.set(key, etag);
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xmlText((/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml) || [])[1] || '') : null;
  } while (token);
  return found;
}

function why(status, what) {
  if (status === 401 || status === 403) return `Cloudflare refused the R2 key (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) trying to ${what}`;
  if (status === 404) return `no R2 bucket by that name (R2_BUCKET) for this account (R2_ACCOUNT_ID) trying to ${what}`;
  return `R2 answered ${status} trying to ${what}`;
}

function siteFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? siteFiles(full, base) : [{ full, key: path.relative(base, full).split(path.sep).join('/') }];
  });
}

// Mirrors the site folder into the bucket: uploads new and changed files,
// deletes ones the site no longer has. Never throws; a failed publish
// mustn't stop the board check.
// r2: { accountId, bucket, keyId, secret }
async function deployR2({ dir, r2, fetchImpl = fetch }) {
  try {
    const conn = { ...r2, host: `${r2.accountId}.r2.cloudflarestorage.com` };
    const have = await listBucket(conn, fetchImpl);
    const files = siteFiles(dir);
    let uploaded = 0;
    for (const f of files) {
      const body = fs.readFileSync(f.full);
      const md5 = crypto.createHash('md5').update(body).digest('hex');
      if (have.get(f.key) === md5) continue;
      const req = signRequest({ ...conn, method: 'PUT', path: `/${r2.bucket}/${f.key}`, body, headers: { 'content-type': typeOf(f.key) } });
      const res = await fetchImpl(req.url, { method: 'PUT', headers: req.headers, body, signal: AbortSignal.timeout(60000) });
      if (!res.ok) return { ok: false, message: why(res.status, `upload ${f.key}`) };
      uploaded++;
    }
    const keep = new Set(files.map((f) => f.key));
    let removed = 0;
    for (const key of have.keys()) {
      if (keep.has(key)) continue;
      const req = signRequest({ ...conn, method: 'DELETE', path: `/${r2.bucket}/${key}` });
      const res = await fetchImpl(req.url, { method: 'DELETE', headers: req.headers, signal: AbortSignal.timeout(60000) });
      if (!res.ok && res.status !== 404) return { ok: false, message: why(res.status, `remove ${key}`) };
      removed++;
    }
    return { ok: true, uploaded, removed };
  } catch (err) {
    const cause = err.cause && (err.cause.code || err.cause.message);
    return { ok: false, message: cause ? `${err.message} (${cause})` : err.message };
  }
}

module.exports = { signRequest, deployR2, listBucket, typeOf };
