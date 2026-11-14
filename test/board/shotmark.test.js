// The screenshot mark (owner, 2026-11-12): "Would it be possible to bake a hidden id number in the backround
// that is not visible to people but if I gave you a picture of a screen shot or a screen shot, you would be
// able to know what account it came from", then, shown the test (docs/board-checker/screenshot-mark), "Build
// it on the test site first"; and, 2026-11-13, having tried it: "works great, push to the main page". ON FOR
// EVERY SIGNED-IN ACCOUNT, BOTH SITES, with the number the Worker gives the account from a secret it keeps
// (test/board/accounts.test.js tests that side); read on the owner's Page Health on both sites.
// No names here: made-up account ids and colours only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodeCrypto = require('node:crypto');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const worker = fs.readFileSync(require.resolve('../../cloudflare/board-worker.js'), 'utf8');
const py = fs.readFileSync(require.resolve('../../docs/board-checker/screenshot-mark/wm.py'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };

const block = cut('  const ShotMark = (() => {', '  // The mark on the page (every signed-in account');
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

test('the number drawn is the Worker’s for the signed-in account; the trial’s hash is kept only to trace the trial', async () => {
  // The Worker: /auth/me hands a signed-in account its number (shotmarkOf, from the kept secret).
  assert.ok(worker.includes("...(s && s.status === 'approved' ? { ...(await profileOf(env, s)), mark: await shotmarkOf(env, s.id) } : {}) });"));
  assert.ok(html.includes("const mark = SHOT_ME && SHOT_ME.signedIn ? SHOT_ME.mark : null;"));
  assert.ok(!/accountId/.test(block), 'the page no longer works a number out for itself');
  // The test-site trial's number for the owner key (the same as wm.py's mark_of), kept so his trial screenshots trace.
  assert.equal(await SM.markOf('owner'), 802536);
  assert.equal(await SM.markOf('0123456789abcdef0123456789abcdef'), 423516);
  assert.equal(await SM.markOf('ffffffffffffffffffffffffffffffff'), 250952);
  assert.ok(html.includes("out.push({ id: 'owner-trial', mark: await ShotMark.markOf('owner'),"));
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
    // The test site's stronger squares: the same cells at the alpha asked for.
    const strong = SM.tileRGBA(mark, light, 4);
    for (let i = 0; i < 64; i++) assert.equal(strong[4 * i + 3], v[i] > 0 ? 4 : 0);
  }
});

// A made-up page: background and card fills, lines of "text", a coloured chip, then the mark the way a browser
// lays it over the page (darker by a level on a light page, lighter on a dark one), at a given size.
function page(W, H, { light = true, mark = null, scale = 3, ox = 0, oy = 0, noise = 0, seed = 1, alpha = null } = {}) {
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
      const al = alpha == null ? (light ? 1 : 2) : alpha;
      for (let c = 0; c < 3; c++) px[i + c] = light ? Math.floor(px[i + c] * (255 - al) / 255) : px[i + c] + Math.floor(al * (255 - px[i + c]) / 255);
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

test('on for every signed-in account with a number from the Worker, both sites; the trace box on the owner’s Page Health; nothing sent anywhere', () => {
  const paint = cut('  function paintShotMark() {', '  // A change of page style');
  assert.ok(!paint.includes('PREVIEW'), 'not tied to the test site any more (owner, 2026-11-13: "push to the main page")');
  assert.ok(paint.includes("if (!Number.isInteger(mark) || mark < 0 || mark >= 1 << ShotMark.NBITS) { if (old) old.remove(); shotMarkFor = ''; return; }"), 'nothing drawn without a number from the Worker, or signed out');
  assert.ok(html.includes('${traceSection()}') && html.includes('    wireTrace(view); // screenshot mark\n'), 'the box is on Page Health on both sites (the page is the owner’s alone)');
  assert.ok(!html.includes('${PREVIEW ? traceSection()') && !html.includes('if (PREVIEW) wireTrace'));
  assert.ok(html.includes('SHOT_ME = me; paintShotMark();'), 'the account is the one the sign-in check names');
  assert.ok(html.includes("window.dispatchEvent(new Event('board-theme'));") && html.includes("window.addEventListener('board-theme', () => { paintShotMark(); });"), 'follows the page from light to dark');
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.ok(style.includes('#shotmark { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; background-repeat: repeat; background-size: 64px 64px; image-rendering: pixelated; }'));
  assert.ok(!/body\.preview-site[^{]*#shotmark/.test(style));
  // Before the Worker with the numbers is pasted, the box says so (only the trial can be traced then).
  assert.ok(html.includes("out.ready = !!(d && Number.isInteger(d.ownerMark));") && html.includes("paste the new Worker code into both Workers"));
  // The trace reads the picture on the phone: the only request is the Members list it matches against.
  const trace = cut('  function traceSection() {', '  // ---------------------------------------------------------------------------------------------\n  modeCurrent.onclick');
  assert.deepEqual(trace.match(/fetch\([^,)]*/g), ["fetch('health/accounts'"]);
  assert.ok(!/method:\s*'POST'/.test(trace) && !/FormData|sendBeacon|XMLHttpRequest/.test(trace));
  assert.ok(!block.includes('fetch('), 'the reader itself asks nothing of anyone');
});

// The squares (owner, 2026-11-14: "Instead of a number would you be able to do squares or diamonds. Kinda like a QR
// code. make a binary code up using having a shaded spot or a non shaded spot"). TEST SITE ONLY: the hidden mark's
// own squares drawn again on top, N times as strong in all, read from a photo by its screen's four corners.
test('the squares: test site only, the hidden mark\'s own cells 3 x as strong unless he picks others on his phone, lined up on it', () => {
  const code = cut('  const SHOTCODE_TIMES = ', '  function traceSection() {');
  assert.ok(code.includes("if (!PREVIEW || !Number.isInteger(mark) || mark < 0 || mark >= 1 << ShotMark.NBITS) { if (old) old.remove(); shotCodeFor = ''; return; }"), 'the test site with the owner key only, and only with a number from the Worker');
  assert.ok(code.includes('ShotMark.tileRGBA(mark, light, alpha)'), 'the hidden mark\'s own number and cells');
  assert.ok(code.includes("const key = `${mark}|${light}|${level}`;"), 'drawn again when the strength changes');
  assert.ok(code.includes("if (alpha <= 0) { if (old) old.remove(); shotCodeFor = ''; return; }"), '1 x: the hidden mark alone');
  const parts = new Function(`${code}\nreturn { times: SHOTCODE_TIMES, level: SHOTCODE_LEVEL, levelNow: shotCodeLevel, alpha: shotCodeAlpha };`)();
  assert.deepEqual(parts.times, [1, 2, 3, 4, 6]);
  assert.equal(parts.level, '3/3');
  // N times the hidden mark in all: its own alpha 1 (light) and 2 (dark) are under the squares.
  assert.deepEqual([1, 2, 3, 4, 6].map((n) => parts.alpha(true, `${n}/3`)), [0, 1, 2, 3, 5]);
  assert.deepEqual([1, 2, 3, 4, 6].map((n) => parts.alpha(false, `3/${n}`)), [0, 2, 4, 6, 10]);
  // Kept on his phone only; light and dark each fall back to the default on their own.
  const keep = global.localStorage;
  try {
    global.localStorage = { getItem: () => '2/6' }; assert.equal(parts.levelNow(), '2/6');
    global.localStorage = { getItem: () => '4/9' }; assert.equal(parts.levelNow(), '4/3');
    global.localStorage = { getItem: () => '1.5/5' }; assert.equal(parts.levelNow(), '3/3', 'the faint code\'s old percentages read as the default');
    global.localStorage = { getItem: () => null }; assert.equal(parts.levelNow(), '3/3');
    global.localStorage = { getItem: () => { throw new Error('blocked'); } }; assert.equal(parts.levelNow(), '3/3');
  } finally { global.localStorage = keep; }
  // Lined up on the hidden mark: the same 64 px tile from the same corner, square pixels.
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.ok(style.includes('#shotcode { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; background-repeat: repeat; background-size: 64px 64px; image-rendering: pixelated; }'));
  // Repainted when the test site switches on or off, and with the page style (paintShotMark runs on both).
  assert.ok(html.includes("paintMine();\n      paintShotCode(); // the faint visible code (test site only)"));
  assert.ok(cut('  function paintShotMark() {', '  // A change of page style').includes('  paintShotCode(); // the faint visible code (test site only)'));
  assert.ok(!cut('  function paintShotMark() {', '  // A change of page style').includes('PREVIEW'), 'the hidden mark is drawn as before, whatever the test site does');
  // The 4-character code is gone.
  assert.ok(!/codeOf|markOfCode|tracecodego|traceByCode/.test(html));
});

// A made-up photo of a screen: the page (with its mark) put on a bigger, darker picture through a tilt, a little
// blur, a glow across it, highlights pressed down (his light photo kept a third of a shade) and the camera's grain.
function photoOf(screen, SW, SH, corners, { PW = 1000, PH = 1400, grain = 3, seed = 4 } = {}) {
  let s2 = seed >>> 0;
  const rnd = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296);
  const M = SM.homography(corners, [[0, 0], [SW, 0], [SW, SH], [0, SH]]); // photo → screen
  const out = new Uint8ClampedArray(PW * PH * 4);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const q = M[6] * x + M[7] * y + 1, u = (M[0] * x + M[1] * y + M[2]) / q, v = (M[3] * x + M[4] * y + M[5]) / q;
    const i = 4 * (y * PW + x);
    let c = [40, 40, 44];
    if (u >= 0 && v >= 0 && u < SW - 1 && v < SH - 1) { const j = 4 * (Math.floor(v) * SW + Math.floor(u)); c = [screen[j], screen[j + 1], screen[j + 2]]; }
    const glow = 0.85 + 0.15 * (x / PW);
    for (let k = 0; k < 3; k++) {
      let val = c[k] * glow;
      if (val > 180) val = 180 + (val - 180) * 0.4;
      out[i + k] = val + (rnd() + rnd() + rnd() - 1.5) * 2 * grain;
    }
    out[i + 3] = 255;
  }
  return out;
}

test('a photo of a screen: straightened by its four corners and read, sure only when it clearly is', async () => {
  const ids = ['owner', ...Array.from({ length: 44 }, (_, k) => nodeCrypto.createHash('sha256').update(`made-up ${k}`).digest('hex').slice(0, 32))];
  const cands = [];
  for (const id of ids) cands.push({ id, mark: await SM.markOf(id) });
  const who = cands[11];
  const SW = 900, SH = 1900; // a phone screenshot at about 2.2 x (410 CSS px wide)
  const corners = [[230, 110], [790, 150], [820, 1330], [190, 1290]];
  // Taps a little off: about half a percent of the screen's width (3 px here), each corner its own way.
  const off = [[3, -2], [-2, 3], [2, 2], [-3, -1]];
  for (const light of [true, false]) {
    const screen = page(SW, SH, { light, mark: who.mark, scale: 2.2, ox: 13, oy: 70, alpha: light ? 3 : 6 }); // the squares at 3 x
    const ph = photoOf(screen, SW, SH, corners, { seed: light ? 4 : 5 });
    let r = SM.readPhoto(ph, 1000, 1400, corners, cands);
    assert.equal(r.found, true, `${light ? 'light' : 'dark'}: ${JSON.stringify({ ...r, flat: undefined })}`);
    assert.equal(r.best, who.id);
    assert.ok(r.w === 480 && r.flat.length === 480 * r.h * 4, 'the straightened photo comes back to show');
    r = SM.readPhoto(ph, 1000, 1400, corners.map(([x, y], i) => [x + off[i][0], y + off[i][1]]), cands);
    assert.equal(r.best, who.id, `${light ? 'light' : 'dark'}, taps off: ${JSON.stringify({ ...r, flat: undefined })}`);
    // Taps further off (about 1%) may leave it unsure, never sure of the wrong account.
    for (const k of [6, 9]) {
      r = SM.readPhoto(ph, 1000, 1400, corners.map(([x, y], i) => [x + off[i][0] * k / 3, y - off[i][1] * k / 3]), cands);
      assert.ok(!r.found || r.best === who.id, `${light ? 'light' : 'dark'}, taps ${k} px off: ${JSON.stringify({ ...r, flat: undefined })}`);
    }
  }
  // The verdict, with the numbers his own photos gave (14 Nov, the one-shade mark alone, taps 2% off): sure of the
  // right account at 20 of 20 bits; NOT sure of a wrong one that had 18 of 20 by count but only 0.84 weighed, 0.26
  // above the next (it was "sure" by count alone).
  const pick = (best, counts, weighed, z = 9, strength = 1.8) => { const c = [13, 12, 14, 11], w = [0.33, 0.2, 0.3, 0.1]; c[best] = counts[0]; w[best] = weighed[0]; c[(best + 1) % 4] = counts[1]; w[(best + 1) % 4] = weighed[1]; return SM.photoVerdict(c, w, z, strength); };
  assert.deepEqual(pick(2, [20, 13], [1, 0.33]), { best: 2, nextCount: 13, nextWeighed: 0.33, sure: true });
  assert.equal(pick(1, [18, 15], [0.84, 0.58]).sure, false, 'the wrong account his photo gave, by count');
  assert.equal(pick(1, [18, 14], [0.93, 0.41]).sure, true);
  assert.equal(pick(1, [17, 13], [0.95, 0.3]).sure, false, 'under 18 of 20');
  assert.equal(pick(1, [19, 17], [0.95, 0.3]).sure, false, 'under 3 clear of the next by count');
  assert.equal(pick(1, [19, 13], [0.95, 0.6]).sure, false, 'under 0.4 clear of the next weighed');
  assert.equal(pick(1, [20, 13], [1, 0.3], 5.9).sure, false, 'the sync not clear');
  assert.equal(pick(1, [20, 13], [1, 0.3], 9, 1.1).sure, false, 'the fold no stronger than at a wrong spacing');
  // Screenshots are read as before (the 12 Nov test's 752 reads stand on this).
  assert.ok(block.includes('out.found = !photo && out.strength >= 3 && z >= 6 && ab >= 0.8 && ab - an >= 0.35;'));
  // A photo of a page with no squares is never pinned on anyone.
  const plain = photoOf(page(SW, SH, { seed: 3 }), SW, SH, corners);
  assert.equal(SM.readPhoto(plain, 1000, 1400, corners, cands).found, false);
  // Four taps that make no screen.
  assert.equal(SM.readPhoto(plain, 1000, 1400, [[10, 10], [12, 10], [12, 12], [10, 12]], cands).why, 'corners');
  // On the page: the photo box on the test site only, the photo read on the phone, nothing sent anywhere.
  const box = cut('  function photoBox() {', '  // Who a mark could belong to');
  assert.ok(box.includes('id="tracephoto"') && box.includes('id="shotlight"') && box.includes('id="shotdark"'));
  assert.ok(html.includes("${traceLast}</div>${PREVIEW ? photoBox() : ''}</div></section>"), 'the test site only');
  const wire = cut('    // A photo of a screen: shown to tap the screen\'s four corners on', "    const input = view.querySelector('#tracefile');");
  assert.ok(wire.includes('ShotMark.readPhoto(px, W, H, taps, cands)') && wire.includes("localStorage.setItem('shotCodeLevel', `${onLight.value}/${onDark.value}`)") && wire.includes('paintShotCode();'));
  assert.ok(!/fetch\(|FormData|sendBeacon|XMLHttpRequest/.test(wire), 'nothing sent anywhere (the accounts come from traceCandidates)');
  assert.ok(html.includes("${PREVIEW ? ' For a photo of a screen, use the box below: tap the screen’s four corners on it and the squares are read.' : ''}"));
});
