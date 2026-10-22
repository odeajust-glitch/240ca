// Web push from the laptop (owner, 2026-10-22: turn alerts from the site,
// free and with no message cap). A phone subscribes on the site; its
// subscription (an endpoint at Google/Apple/Mozilla/Microsoft plus two keys)
// is kept in the R2 bucket by the Worker. This sends one encrypted message
// to such a subscription, signed with the board checker's own VAPID key.
//
// RFC 8291 (message encryption, aes128gcm) and RFC 8292 (VAPID), written out
// with Node's crypto so the laptop needs no extra package.
const crypto = require('crypto');
const fs = require('fs');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// Only real push services: the laptop never posts to an address a stranger
// typed into a subscription.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
function pushEndpointOk(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

// The board checker's VAPID key pair, made once and kept in the data folder.
// { publicKey: base64url of the 65-byte point (what the site hands phones), privateJwk }
function loadOrCreateKeys(file) {
  try {
    const k = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (k.publicKey && k.privateJwk) return k;
  } catch { /* first run */ }
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const keys = { publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)])), privateJwk: jwk };
  fs.writeFileSync(file, JSON.stringify(keys, null, 2));
  return keys;
}

// The encrypted body for one subscription (RFC 8291 §3–4, one record).
// `as` (the sender's one-time key) and `salt` are only passed in by tests.
function encrypt(payload, { p256dh, auth }, { as = null, salt = crypto.randomBytes(16) } = {}) {
  const uaPublic = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (as) ecdh.setPrivateKey(unb64u(as)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const sealed = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, sealed]);
}

// "vapid t=…, k=…" for one push service (RFC 8292). `sub` says who's sending.
function vapidHeader(endpoint, keys, { sub, now = Date.now() } = {}) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub }));
  const key = crypto.createPrivateKey({ key: keys.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

// Sends one message. { ok } / { gone: true } (the phone unsubscribed: drop
// it) / { ok: false, message }. Never throws.
async function sendPush(subscription, message, { keys, sub, fetchImpl = fetch, ttl = 6 * 3600 }) {
  try {
    if (!pushEndpointOk(subscription.endpoint)) return { ok: false, gone: true, message: 'not a push service address' };
    const body = encrypt(JSON.stringify(message), subscription.keys || {});
    const res = await fetchImpl(subscription.endpoint, {
      method: 'POST',
      headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency: 'high',
        authorization: vapidHeader(subscription.endpoint, keys, { sub }) },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 404 || res.status === 410) return { ok: false, gone: true, message: `push service says ${res.status}` };
    if (!res.ok) return { ok: false, message: `push service answered ${res.status}` };
    return { ok: true };
  } catch (err) {
    const cause = err.cause && (err.cause.code || err.cause.message);
    return { ok: false, message: cause ? `${err.message} (${cause})` : err.message };
  }
}

module.exports = { encrypt, vapidHeader, sendPush, loadOrCreateKeys, pushEndpointOk };
