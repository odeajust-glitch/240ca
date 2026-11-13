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

// The faint visible code (owner, 2026-11-13, told the hidden mark can't be read from a photo of a screen: "build it on
// the test site, 5% light 7% dark"). TEST SITE ONLY: drawn under PREVIEW (board-test with the owner key).
test('the visible code: the same number as 4 characters, one code per number, read back however it is typed', () => {
  assert.equal(SM.codeOf(0), '0000');
  assert.equal(SM.codeOf((1 << 20) - 1), 'ZZZZ');
  assert.equal(SM.codeOf(802536), 'RFQ8'); // worked out by hand: 24, 15, 23, 8 in Crockford's base 32
  const seen = new Set();
  for (let m = 0; m < 1 << 20; m++) {
    const c = SM.codeOf(m);
    assert.ok(/^[0-9A-HJKMNP-TV-Z]{4}$/.test(c), c); // no I, L, O or U
    if (SM.markOfCode(c) !== m) assert.fail(`${m} -> ${c} -> ${SM.markOfCode(c)}`);
    seen.add(c);
  }
  assert.equal(seen.size, 1 << 20, 'every number its own code');
  for (const typed of ['RFQ8', 'rfq8', ' r f q 8 ', 'RFQ-8', 'rf.q8']) assert.equal(SM.markOfCode(typed), 802536, typed);
  assert.equal(SM.markOfCode('OOOO'), 0, 'O read as 0');
  assert.equal(SM.markOfCode('il1I'), SM.markOfCode('1111'), 'I and L read as 1');
  for (const bad of ['', null, undefined, 'RFQ', 'RFQ88', 'U000', 'RF?8', '12345']) assert.equal(SM.markOfCode(bad), null, String(bad));
});

test('the visible code: test site only, 5% black on a light page, 7% white on a dark one, the hidden mark untouched', () => {
  const code = cut('  let shotCodeFor = \'\';', '  function traceSection() {');
  assert.ok(code.includes("if (!PREVIEW || !Number.isInteger(mark) || mark < 0 || mark >= 1 << ShotMark.NBITS) { if (old) old.remove(); shotCodeFor = ''; return; }"), 'the test site with the owner key only, and only with a number from the Worker');
  assert.ok(code.includes("el.style.backgroundImage = shotCodeTile(ShotMark.codeOf(mark), light);"), 'the same number as the hidden mark');
  // The tile, as the page builds it.
  const tile = new Function(`${cut('  const SHOTCODE_W = 400', '  function paintShotCode() {')}\nreturn shotCodeTile;`)();
  const svgOf = (u) => Buffer.from(/base64,([^"]+)"/.exec(u)[1], 'base64').toString('utf8');
  const light = svgOf(tile('RFQ8', true)), dark = svgOf(tile('RFQ8', false));
  assert.ok(light.includes('fill="#000" fill-opacity="0.05"') && dark.includes('fill="#fff" fill-opacity="0.07"'), 'his strengths');
  for (const s of [light, dark]) assert.ok(s.match(/>RFQ8</g).length >= 40);
  // Scattered, not in rows (an even grid of codes gave emailed dark screenshots a spacing the reader took for the
  // hidden mark's): 40 codes at least 77 px apart round the tile's edges, none of the screen far from one, and the
  // tile bigger than any spacing the reader looks for (420 px of picture, at 1.64 picture px a CSS px, text-message size).
  const at = new Function(`${cut('  const SHOTCODE_W = 400', '  let shotCodeFor')}\nreturn { W: SHOTCODE_W, H: SHOTCODE_H, P: SHOTCODE_AT };`)();
  assert.equal(at.P.length, 40);
  const d = (a, b) => { const dx = Math.min(Math.abs(a[0] - b[0]), at.W - Math.abs(a[0] - b[0])), dy = Math.min(Math.abs(a[1] - b[1]), at.H - Math.abs(a[1] - b[1])); return Math.hypot(dx, dy); };
  for (let i = 0; i < at.P.length; i++) for (let j = i + 1; j < at.P.length; j++) assert.ok(d(at.P[i], at.P[j]) >= 77, `${i} ${j}`);
  let gap = 0;
  for (let x = 0; x < at.W; x += 4) for (let y = 0; y < at.H; y += 4) gap = Math.max(gap, Math.min(...at.P.map((p) => d([x, y], p))));
  assert.ok(gap <= 80, `a spot ${gap} px from any code`);
  assert.ok(Math.min(at.W, at.H) * 1.64 > 420);
  // Repainted when the test site switches on or off, and with the page style (paintShotMark runs on both).
  assert.ok(html.includes("paintMine();\n      paintShotCode(); // the faint visible code (test site only)"));
  assert.ok(cut('  function paintShotMark() {', '  // A change of page style').includes('  paintShotCode(); // the faint visible code (test site only)'));
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.ok(style.includes('#shotcode { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; background-repeat: repeat; background-size: 400px 880px; }'), 'taps go through; the tile the codes are laid out on');
  // The hidden mark is drawn as before (the layout and tile tests above), whatever the test site does.
  assert.ok(!cut('  function paintShotMark() {', '  // A change of page style').includes('PREVIEW'));
});

test('a photo of a screen: the code box on the test site only, matched against the Worker’s numbers, nothing sent anywhere', () => {
  assert.ok(html.includes("${traceLast}</div>${PREVIEW ? traceCodeBox() : ''}</div></section>"), 'the main site’s Page Health is as it was');
  assert.ok(html.includes("${PREVIEW ? ' For a photo of a screen, type the code you see on it below.' : ''}"));
  const look = cut('  async function traceByCode(text) {', '  // Who a mark could belong to');
  assert.ok(look.includes("const hits = cands.filter((c) => c.id !== 'owner-trial' && c.mark === mark);"), 'the trial’s number was never drawn as a code');
  assert.ok(look.includes("if (!cands.ready) return"), 'before the Worker gives out numbers it says so');
  assert.ok(!look.includes('fetch('), 'the only request is the Members list traceCandidates already asks for');
});
