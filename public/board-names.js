// Unlocks data/names.json (lib/board/names.js lockNames) with the passcode
// the rep types: PBKDF2-SHA256 → AES-256-GCM, in the browser. A wrong
// passcode fails the GCM check and returns null. Shared with the tests.
(function (root) {
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function unlockNames(locked, passphrase, subtle = root.crypto.subtle) {
    const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await subtle.deriveKey({ name: 'PBKDF2', salt: bytes(locked.salt), iterations: locked.iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    try {
      const plain = await subtle.decrypt({ name: 'AES-GCM', iv: bytes(locked.iv) }, key, bytes(locked.data));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch {
      return null;
    }
  }

  const api = { unlockNames };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardNames = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
