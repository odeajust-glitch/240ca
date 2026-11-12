// The 12 Nov capture: the main site as a member, read only, the mark drawn in that browser only (see README.md). Not used by the site.
// Read-only. The main site as a member (the stand-in in HANDOFF), phone sized at 3x like an iPhone.
// Each view is captured without the mark and with it, the mark drawn in this browser only.
// Nothing is saved on the site: every request that is not a GET is stopped (but the sign-in).
// usage: node shots.js <outdir>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const tiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'tiles.json'), 'utf8'));
const base = 'https://board.sarniaboard.workers.dev/';
const PLAN = [
  { theme: 'light', pol: 'light', views: [['Current', 0], ['Current', 1400], ['My stats', 0], ['My stats', 3000], ['Analytics', 0], ['Order summary', 0]], amps: [1, 2, 3] },
  { theme: 'dark', pol: 'dark', views: [['Current', 0], ['Current', 1400], ['My stats', 3000]], amps: [1, 2, 3] },
  { theme: 'board', pol: 'dark', views: [['Current', 1400]], amps: [1, 2, 3] },
];
const visibleTile = (ink) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="190" height="130"><text x="18" y="78" transform="rotate(-24 95 65)" font-family="sans-serif" font-size="22" font-weight="700" fill="${ink}" fill-opacity="0.07">№ 4821</text></svg>`).toString('base64');

(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  for (const plan of PLAN) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    await ctx.addInitScript((theme) => { try { localStorage.setItem('boardNoCount', '1'); localStorage.setItem('boardTheme', theme); } catch (e) {} }, plan.theme);
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (req.method() !== 'GET' && req.method() !== 'HEAD') { if (u.pathname.endsWith('/auth/owner')) return route.continue(); return route.abort(); }
      if (/sarniaboard/.test(u.hostname) && (/^\/health(\/|$)/.test(u.pathname) || u.pathname === '/stats/days')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' });
      return route.continue();
    });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    await page.goto(base + 'account', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.evaluate(() => fetch('auth/owner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.status)).catch(() => {});
    await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
    for (const [tab, y] of plan.views) {
      await page.locator('.top .modes button', { hasText: new RegExp('^' + tab + '$') }).first().click();
      await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2200);
      await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(700);
      const name = `${plan.theme}-${tab.toLowerCase().replace(/\s+/g, '')}-${y}`;
      const setMark = (css) => page.evaluate((c) => {
        let el = document.getElementById('wmx');
        if (!c) { if (el) el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.id = 'wmx'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
        el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;background-repeat:repeat;' + c;
      }, css);
      await setMark(null);
      await page.screenshot({ path: path.join(out, `${name}-none.png`) });
      for (const amp of plan.amps) {
        await setMark(`background-image:url(data:image/png;base64,${tiles[`${amp}-${plan.pol}`]});background-size:64px 64px;image-rendering:pixelated;`);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(out, `${name}-a${amp}.png`) });
      }
      if (plan.theme !== 'board' && tab === 'Current' && y === 0) {
        const ink = plan.theme === 'dark' ? '#ffffff' : '#000000';
        await setMark(`background-image:url(${visibleTile(ink)});background-size:190px 130px;`);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(out, `${name}-visible.png`) });
      }
      await setMark(null);
      console.log('captured', name);
    }
    console.log(plan.theme, 'page errors', errors.length, errors.slice(0, 2));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
