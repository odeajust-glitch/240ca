// The screenshot mark (owner, 2026-11-12): "Would it be possible to bake a hidden id number in the backround
// that is not visible to people but if I gave you a picture of a screen shot or a screen shot, you would be
// able to know what account it came from", then, shown the test (docs/board-checker/screenshot-mark), "Build
// it on the test site first". TEST SITE ONLY: drawn and read only behind PREVIEW (board-test with the owner
// key). A member on either site gets neither. To promote: drop the PREVIEW tests in paintShotMark and
// renderHealth and change the gating test below, quoting him.
// No names here: made-up account ids and colours only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodeCrypto = require('node:crypto');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const worker = fs.readFileSync(require.resolve('../../cloudflare/board-worker.js'), 'utf8');
const py = fs.readFileSync(require.resolve('../../docs/board-checker/screenshot-mark/wm.py'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };

const block = cut('  const ShotMark = (() => {', '  // The mark on the page and Page Health');
// Run as the page runs it (plain globals: crypto, TextEncoder), not in a separate context: the reader does a
// few million sums, and the arrays it returns should compare as ordinary arrays.
const SM = new Function(`${block}\nreturn ShotMark;`)();

test('the layout is the one tested, and the same as the Python reader’s', () => {
  const list = (name) => JSON.parse(new RegExp(`^${name} = np\\.array\\((\\[[^\\n]*\\])\\)`, 'm').exec(py)[1]);
  assert.deepEqual([...SM.SYNC_POS], list('SYNC_POS'));
  assert.deepEqual([...SM.SYNC_VAL], list('SYNC_VAL'));
  assert.deepEqual(SM.PAIRS.map((p) => [...p]), list('PAIRS'));
  // Every one of the 64 cells is used once: 24 sync (12 marked, 12 not) and 20 pairs.
  const used = [...SM.SYNC_POS, ...SM.PAIRS.flat()].sort((a, b) => a - b);
  assert.deepEqual(used, [...Array(64).keys()]);
  assert.equal(SM.SYNC_VAL.filter((v) => v > 0).length, 12);
  assert.equal(SM.N * SM.CELL, 64, 'a 64 CSS px tile, as the style rule draws it');
});

test('the account’s number: the Worker’s own account id, then the number the Python reader gives it', async () => {
  // The Worker: id = the first 32 hex of SHA-256("account:" + the email, trimmed, in small letters).
  assert.ok(worker.includes('const uidOf = async (email) => (await shaHex(`account:${email}`)).slice(0, 32);'));
  assert.ok(worker.includes("const email = String(b.email || '').trim().toLowerCase();"));
  assert.ok(worker.includes("if (p.u === 'owner') return { id: 'owner', status: 'approved', name: 'Owner', role: 'member', t: p.t };"));
  const email = 'some.one@example.com';
  assert.equal(await SM.accountId({ signedIn: true, name: 'Some One', email: '  Some.One@Example.com ' }), nodeCrypto.createHash('sha256').update(`account:${email}`).digest('hex').slice(0, 32));
  assert.equal(await SM.accountId({ signedIn: true, name: 'Owner', email: null }), 'owner');
  assert.equal(await SM.accountId({ signedIn: false, name: null, email: null }), '');
  assert.equal(await SM.accountId(null), '');
  // The same numbers as docs/board-checker/screenshot-mark/wm.py's mark_of, worked out there.
  assert.equal(await SM.markOf('owner'), 802536);
  assert.equal(await SM.markOf('0123456789abcdef0123456789abcdef'), 423516);
  assert.equal(await SM.markOf('ffffffffffffffffffffffffffffffff'), 250952);
});

test('the tile: black at alpha 1 on a light page, white at alpha 2 on a dark one, only in the marked cells', () => {
  const mark = 369607;
  const v = SM.cells(mark);
  assert.equal([...v].filter((x) => x > 0).length, 32);
  for (const light of [true, false]) {
    const px = SM.tileRGBA(mark, light);
    for (let i = 0; i < 64; i++) {
      const [r, g, b, a] = px.slice(4 * i, 4 * i + 4);
      assert.equal(a, v[i] > 0 ? (light ? 1 : 2) : 0, `cell ${i}`);
      if (a) assert.deepEqual([r, g, b], light ? [0, 0, 0] : [255, 255, 255]);
    }
  }
});

// A made-up page: background and card fills, lines of "text", a coloured chip, then the mark the way a browser
// lays it over the page (darker by a level on a light page, lighter on a dark one), at a given size.
function page(W, H, { light = true, mark = null, scale = 3, ox = 0, oy = 0, noise = 0, seed = 1 } = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bg = light ? [236, 238, 234] : [26, 35, 38], card = light ? [251, 251, 249] : [32, 42, 46], ink = light ? [29, 42, 46] : [226, 233, 232];
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x, y, c) => { const i = 4 * (y * W + x); px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, x > 30 && x < W - 30 && y > 90 && y < H - 60 ? card : bg);
  for (let k = 0; k < (W * H) / 900; k++) {
    const x0 = 40 + Math.floor(rnd() * (W - 120)), y0 = 100 + Math.floor(rnd() * (H - 180)), w = 3 + Math.floor(rnd() * 30), h = 2 + Math.floor(rnd() * 9);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, ink);
  }
  for (let y = 120; y < 150; y++) for (let x = 60; x < 160; x++) put(x, y, [220, 240, 226]);
  if (mark !== null) {
    const v = SM.cells(mark), cell = SM.CELL * scale;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cx = Math.floor((x + ox) / cell) % SM.N, cy = Math.floor((y + oy) / cell) % SM.N;
      if (v[cy * SM.N + cx] <= 0) continue;
      const i = 4 * (y * W + x);
      for (let c = 0; c < 3; c++) px[i + c] = light ? Math.floor(px[i + c] * 254 / 255) : px[i + c] + Math.floor(2 * (255 - px[i + c]) / 255);
    }
  }
  if (noise) for (let i = 0; i < W * H * 4; i += 4) { const n = Math.round((rnd() + rnd() + rnd() - 1.5) * noise); for (let c = 0; c < 3; c++) px[i + c] += n; }
  return px;
}

test('reading: the right account from a light page, a dark page, a smaller picture with noise and a crop; nothing from a plain page', async () => {
  const ids = ['owner', ...Array.from({ length: 40 }, (_, k) => nodeCrypto.createHash('sha256').update(`made-up ${k}`).digest('hex').slice(0, 32))];
  const cands = [];
  for (const id of ids) cands.push({ id, mark: await SM.markOf(id) });
  const who = cands[7];
  const read = (px, W, H) => SM.decode(px, W, H, cands);
  // as taken on a phone at 3x, light and dark, the tile starting anywhere on the picture
  let r = read(page(780, 1100, { mark: who.mark, ox: 37, oy: 11 }), 780, 1100);
  assert.equal(r.found, true, JSON.stringify(r)); assert.equal(r.best, who.id); assert.equal(r.read, who.mark); assert.equal(r.cellsAgree, 20);
  r = read(page(780, 1100, { light: false, mark: who.mark, ox: 5, oy: 90 }), 780, 1100);
  assert.equal(r.found, true, JSON.stringify(r)); assert.equal(r.best, who.id);
  // shrunk (about what a text message does to a phone screenshot) with a little noise
  r = read(page(640, 1000, { mark: who.mark, scale: 1.64, ox: 3, oy: 50, noise: 0.8, seed: 9 }), 640, 1000);
  assert.equal(r.found, true, JSON.stringify(r)); assert.equal(r.best, who.id);
  // a crop of one box
  r = read(page(450, 450, { mark: who.mark, ox: 101, oy: 77 }), 450, 450);
  assert.equal(r.found, true, JSON.stringify(r)); assert.equal(r.best, who.id);
  // a page with no mark is never pinned on anyone
  for (const light of [true, false]) {
    r = read(page(780, 1100, { light, seed: 3 }), 780, 1100);
    assert.equal(r.found, false, JSON.stringify(r));
  }
  // too small to read
  assert.equal(read(page(40, 40, { mark: who.mark }), 40, 40).found, false);
});

test('only on the test site: the layer, the trace box, and nothing sent anywhere', () => {
  const paint = cut('  async function paintShotMark() {', '  // A change of page style');
  assert.ok(paint.includes("if (!PREVIEW || !SHOT_ME || !SHOT_ME.signedIn) { if (old) old.remove(); shotMarkFor = ''; return; }"), 'drawn only on the test site, for a signed-in account');
  assert.ok(paint.includes('if (!PREVIEW) return;'), 'and not if the test site went off meanwhile');
  assert.ok(html.includes("${PREVIEW ? traceSection() : ''}") && html.includes('if (PREVIEW) wireTrace(view); // screenshot mark (test site)'));
  assert.ok(html.includes('SHOT_ME = me; paintShotMark();'), 'the account is the one the sign-in check names');
  assert.ok(html.includes('    paintShotMark(); // the screenshot mark (test site)\n  }'), 'drawn or taken off when the test site switches on or off');
  assert.ok(html.includes("window.dispatchEvent(new Event('board-theme'));") && html.includes("window.addEventListener('board-theme', () => { paintShotMark(); });"), 'follows the page from light to dark');
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.ok(style.includes('#shotmark { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; background-repeat: repeat; background-size: 64px 64px; image-rendering: pixelated; }'));
  // The trace reads the picture on the phone: the only request is the Members list it matches against.
  const trace = cut('  function traceSection() {', '  // ---------------------------------------------------------------------------------------------\n  modeCurrent.onclick');
  assert.deepEqual(trace.match(/fetch\([^,)]*/g), ["fetch('health/accounts'"]);
  assert.ok(!/method:\s*'POST'/.test(trace) && !/FormData|sendBeacon|XMLHttpRequest/.test(trace));
  assert.ok(!block.includes('fetch('), 'the reader itself asks nothing of anyone');
});
