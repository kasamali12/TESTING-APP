// First run inside StudyDeck: the set-up screen has a way back, themes follow, and finishing it lands on the Today page.
const { chromium } = require('playwright'); const path = require('path');
const file = path.resolve(process.argv[2] || process.env.APP || '../index.html');
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) process.exitCode = 1; };
const errs = [];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  await c.route('**/*', r => { const u = r.request().url(); /^(file|data|blob|about):/.test(u) ? r.continue() : r.abort(); });
  await c.addInitScript(() => { try { localStorage.setItem('sd_terms_v2', '1'); localStorage.setItem('sd_intro_v2', '1'); } catch (e) {} });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p.goto('file://' + file, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; setThemeMode('dark'); openTriPath(); });
  await p.waitForFunction(() => { const f = document.getElementById('tripath-iframe'); try { return f.contentDocument.querySelector('.sd-top'); } catch (e) { return false; } }, null, { timeout: 15000 });
  const f = p.frames().find(x => x !== p.mainFrame()); await p.waitForTimeout(600);
  ok('first-run screen has the StudyDeck top bar with a back arrow', await f.evaluate(() => !!document.querySelector('.sd-top .sd-back')));
  ok('no bottom bar during set-up', await f.evaluate(() => !document.querySelector('.sd-nav')));
  await p.screenshot({ path: 'out/tp41_onb_dark.png' });
  await p.evaluate(() => setThemeMode('light')); await p.waitForTimeout(500);
  await p.screenshot({ path: 'out/tp41_onb_light.png' });
  ok('first-run screen follows the theme', await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === await p.evaluate(() => getComputedStyle(document.body).backgroundColor));
  // click through the set-up
  for (let i = 0; i < 14; i++) {
    const done = await f.evaluate(() => !!document.querySelector('.sd-nav'));
    if (done) break;
    const clicked = await f.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(x => /^(Continue|Next|Build my plan|Generate|Build|Start|Finish|Get started|Create plan|Done|Let.s go|Open TriPath|Go to|Open)/i.test(x.textContent.trim())); const bt = bs[bs.length - 1]; if (bt) { bt.click(); return bt.textContent.trim(); } return null; });
    if (!clicked && (global.__wait = (global.__wait || 0) + 1) < 8) { await p.waitForTimeout(900); continue; }
    if (!clicked) { const alt = await f.evaluate(() => [...document.querySelectorAll('button,div[role=button]')].map(x => x.textContent.trim().slice(0, 28)).filter(Boolean)); console.log('no obvious button; options:', alt.slice(0, 12)); break; }
    await p.waitForTimeout(700);
  }
  console.log('buttons now:', await f.evaluate(() => [...document.querySelectorAll('button')].map(x => x.textContent.trim().slice(0, 30))));
  if (!(await f.evaluate(() => !!document.querySelector('.sd-nav')))) { await f.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(x => !/^‹$/.test(x.textContent.trim())); bs[bs.length - 1] && bs[bs.length - 1].click(); }); await p.waitForTimeout(900); }
  ok('set-up finishes and the Today page + bottom bar appear', await f.evaluate(() => !!document.querySelector('.sd-nav') && /Today/.test(document.body.innerText)));
  await p.evaluate(() => setThemeMode('dark')); await p.waitForTimeout(500);
  await p.screenshot({ path: 'out/tp41_after_onb.png' });
  ok('plan saved for next time', await p.evaluate(() => !!localStorage.getItem('tripath_plan_v1') || Object.keys(localStorage).some(k => /^tripath_plan/.test(k))));
  await f.evaluate(() => document.querySelector('.sd-back').click()); await p.waitForTimeout(500);
  ok('back arrow works', await p.evaluate(() => document.getElementById('stripath').classList.contains('hidden')));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
})();
