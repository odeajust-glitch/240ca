// The 13 Nov mock-up of a faint visible code (see README.md), not used by the site. board-test as the owner key,
// read only (every request that is not a GET is stopped, but the sign-in); the code drawn in this browser only.
// The code is a stand-in (4 characters), not any account's number. usage: node visible-capture.js <outdir> [code]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
const base = 'https://board-test.sarniaboard.workers.dev/';
const CODE = process.argv[3] || 'RFQ8';
const tile = (ink, op) => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="104"><g transform="rotate(-24 75 52)" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="${ink}" fill-opacity="${op}"><text x="20" y="40">${CODE}</text><text x="95" y="92">${CODE}</text></g></svg>`).toString('base64');
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    await ctx.addInitScript((t) => { try { localStorage.setItem('boardNoCount', '1'); localStorage.setItem('boardTheme', t); } catch (e) {} }, theme);
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (req.method() !== 'GET' && req.method() !== 'HEAD') { if (u.pathname.endsWith('/auth/owner')) return route.continue(); return route.abort(); }
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(base + 'account', { waitUntil: 'domcontentloaded' }).catch(() => {});
    console.log('owner sign-in', await page.evaluate(() => fetch('auth/owner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.status)).catch((e) => String(e)));
    await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
    console.log(theme, 'hidden mark on page:', await page.evaluate(() => !!document.getElementById('shotmark')));
    await page.evaluate(() => window.scrollTo(0, 300)); await page.waitForTimeout(600);
    const set = (css) => page.evaluate((c) => {
      let el = document.getElementById('vmx');
      if (!c) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('div'); el.id = 'vmx'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483001;background-repeat:repeat;background-size:150px 104px;' + c;
    }, css);
    await set(null); await page.screenshot({ path: path.join(out, `${theme}-none.png`) });
    for (const op of [0.04, 0.06, 0.09]) {
      await set(`background-image:url(${tile(theme === 'light' ? '#000' : '#fff', op)})`); await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, `${theme}-v${Math.round(op * 100)}.png`) });
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
