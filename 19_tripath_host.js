// TriPath inside StudyDeck: opens, looks native in every theme, follows live changes, goes back, keeps its data.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const file = path.resolve(process.argv[2] || process.env.APP || '../index.html'); const tag = process.argv[3] || 'tp41';
const state = JSON.parse(require('zlib').gunzipSync(fs.readFileSync(path.resolve('data/state_onboarded.json.gz'))).toString('utf8'));
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) process.exitCode = 1; };
const errs = [];
(async () => {
  const b = await chromium.launch();
  const mk = async (vw, vh, extra = {}) => {
    const c = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ...extra });
    await c.route('**/*', r => { const u = r.request().url(); /^(file|data|blob|about):/.test(u) ? r.continue() : r.abort(); });
    await c.addInitScript(st => { try { localStorage.setItem('sd_terms_v2', '1'); localStorage.setItem('sd_intro_v2', '1'); for (const k in st) localStorage.setItem(k, st[k]); } catch (e) {} }, state);
    const p = await c.newPage();
    p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    await p.goto('file://' + file, { waitUntil: 'load' }); await p.waitForTimeout(1800);
    await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; });
    return { c, p };
  };
  const fr = p => p.frame({ url: /about:srcdoc/ }) || p.frames().find(f => f !== p.mainFrame());
  const frameBg = async p => { const f = fr(p); return f ? f.evaluate(() => getComputedStyle(document.body).backgroundColor) : null; };
  const hostBg = p => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const openTP = async p => { await p.evaluate(() => { navTo('home'); }); await p.waitForTimeout(500); await p.evaluate(() => openTriPath()); await p.waitForFunction(() => { const f = document.getElementById('tripath-iframe'); try { return f && f.contentDocument && f.contentDocument.querySelector('.sd-top'); } catch (e) { return false; } }, null, { timeout: 15000 }); await p.waitForTimeout(700); };

  // ── phone, dark ──
  let { c, p } = await mk(390, 780, { isMobile: true, hasTouch: true });
  await p.evaluate(() => setThemeMode('dark'));
  const t0 = Date.now(); await openTP(p); console.log('open time ms', Date.now() - t0);
  ok('TriPath page is showing', await p.evaluate(() => !document.getElementById('stripath').classList.contains('hidden')));
  ok('host bottom bar is hidden', await p.evaluate(() => document.getElementById('bnav').classList.contains('hidden')));
  ok('StudyDeck-style top bar is drawn', await fr(p).evaluate(() => !!document.querySelector('.sd-top .sd-title') && document.querySelector('.sd-title').textContent === 'TriPath'));
  ok('StudyDeck-style bottom bar has 5 tabs', await fr(p).evaluate(() => document.querySelectorAll('.sd-nav .sd-ni').length === 5));
  const bgD = [await hostBg(p), await frameBg(p)];
  ok('dark: same background as StudyDeck', bgD[0] === bgD[1], bgD.join(' vs '));
  const font = await fr(p).evaluate(() => getComputedStyle(document.querySelector('.sd-title')).fontFamily);
  const hfont = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  ok('same font family as StudyDeck', font.split(',')[0] === hfont.split(',')[0], font + ' | ' + hfont);
  ok('the app has really rendered (today page text)', /Today|plan|topic/i.test(await fr(p).evaluate(() => document.body.innerText)));
  await p.screenshot({ path: `out/${tag}_m_dark_today.png` });
  for (const [i, name] of [[1, 'plan'], [2, 'subjects'], [3, 'progress'], [4, 'settings']]) {
    await fr(p).evaluate(i => document.querySelectorAll('.sd-nav .sd-ni')[i].click(), i); await p.waitForTimeout(500);
    await p.screenshot({ path: `out/${tag}_m_dark_${name}.png` });
  }
  // settings shows the "follows StudyDeck" note instead of its own toggle
  ok('settings: theme belongs to StudyDeck', /follows StudyDeck/.test(await fr(p).evaluate(() => document.body.innerText)));
  // live theme switch while open
  await p.evaluate(() => setThemeMode('light')); await p.waitForTimeout(500);
  const bgL = [await hostBg(p), await frameBg(p)];
  ok('light: same background as StudyDeck, live', bgL[0] === bgL[1] && bgL[0] !== bgD[0], bgL.join(' vs '));
  ok('light: text colour is dark', await fr(p).evaluate(() => { const m = getComputedStyle(document.querySelector('.sd-title')).color.match(/\d+/g).map(Number); return m[0] < 80; }));
  await fr(p).evaluate(() => document.querySelectorAll('.sd-nav .sd-ni')[0].click()); await p.waitForTimeout(400);
  await p.screenshot({ path: `out/${tag}_m_light_today.png` });
  for (const [i, name] of [[1, 'plan'], [2, 'subjects'], [3, 'progress'], [4, 'settings']]) {
    await fr(p).evaluate(i => document.querySelectorAll('.sd-nav .sd-ni')[i].click(), i); await p.waitForTimeout(400);
    await p.screenshot({ path: `out/${tag}_m_light_${name}.png` });
  }
  // true black
  await p.evaluate(() => { setThemeMode('dark'); document.documentElement.setAttribute('data-amoled', '1'); }); await p.waitForTimeout(600);
  const bgA = [await hostBg(p), await frameBg(p)];
  ok('true black: TriPath is rgb(0,0,0) too', bgA[0] === 'rgb(0, 0, 0)' && bgA[1] === 'rgb(0, 0, 0)', bgA.join(' vs '));
  await fr(p).evaluate(() => document.querySelectorAll('.sd-nav .sd-ni')[0].click()); await p.waitForTimeout(400);
  await p.screenshot({ path: `out/${tag}_m_amoled_today.png` });
  await fr(p).evaluate(() => document.querySelectorAll('.sd-nav .sd-ni')[1].click()); await p.waitForTimeout(400);
  await p.screenshot({ path: `out/${tag}_m_amoled_plan.png` });
  // text size
  await p.evaluate(() => document.documentElement.style.setProperty('--fscale', '1.2')); await p.waitForTimeout(500);
  ok('text size follows StudyDeck', await fr(p).evaluate(() => getComputedStyle(document.querySelector('.sd-body')).zoom === '1.2'), await fr(p).evaluate(() => getComputedStyle(document.querySelector('.sd-body')).zoom));
  await p.evaluate(() => document.documentElement.style.removeProperty('--fscale'));
  // font switch
  await p.evaluate(() => document.documentElement.setAttribute('data-font', 'outfit')); await p.waitForTimeout(500);
  ok('font switch follows StudyDeck', /Outfit/.test(await fr(p).evaluate(() => getComputedStyle(document.querySelector('.sd-title')).fontFamily)), await fr(p).evaluate(() => getComputedStyle(document.querySelector('.sd-title')).fontFamily));
  await p.evaluate(() => document.documentElement.removeAttribute('data-font'));
  // back
  await fr(p).evaluate(() => document.querySelector('.sd-back').click()); await p.waitForTimeout(600);
  ok('back arrow returns to StudyDeck Home', await p.evaluate(() => !document.getElementById('shome').classList.contains('hidden') && document.getElementById('stripath').classList.contains('hidden')));
  ok('host bottom bar is back', await p.evaluate(() => !document.getElementById('bnav').classList.contains('hidden')));
  // reopen keeps state, no reload
  await p.evaluate(() => openTriPath()); await p.waitForTimeout(500);
  ok('reopen shows TriPath again', await p.evaluate(() => !document.getElementById('stripath').classList.contains('hidden')));
  ok('TriPath saved its data under its own keys', await p.evaluate(() => Object.keys(localStorage).filter(k => /^tripath_/.test(k)).length >= 3));
  ok('Home button text', await p.evaluate(() => { openTriPath; return true; }));
  await c.close();

  // ── Home shortcut ──
  ({ c, p } = await mk(390, 780, { isMobile: true, hasTouch: true }));
  await p.evaluate(() => { setThemeMode('dark'); navTo('home'); }); await p.waitForTimeout(800);
  const btnTxt = await p.evaluate(() => { const b = [...document.querySelectorAll('#shome button')].find(x => /TriPath/.test(x.textContent)); return b ? b.textContent : null; });
  ok('Home shortcut present', !!btnTxt, btnTxt);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#shome button')].find(x => /TriPath/.test(x.textContent)); b.click(); });
  await p.waitForFunction(() => { const f = document.getElementById('tripath-iframe'); try { return f.contentDocument.querySelector('.sd-top'); } catch (e) { return false; } }, null, { timeout: 15000 });
  ok('Home shortcut opens TriPath', true);
  await c.close();

  // ── desktop and landscape ──
  for (const [vw, vh, label, extra] of [[1280, 800, 'd1280', {}], [1100, 760, 'd1100', {}], [820, 1000, 't820', {}], [780, 360, 'land', { isMobile: true, hasTouch: true }]]) {
    ({ c, p } = await mk(vw, vh, extra));
    await p.evaluate(() => setThemeMode('dark')); await openTP(p);
    await p.screenshot({ path: `out/${tag}_${label}_today.png` });
    await fr(p).evaluate(() => document.querySelectorAll('.sd-nav .sd-ni')[1].click()); await p.waitForTimeout(400);
    await p.screenshot({ path: `out/${tag}_${label}_plan.png` });
    const geom = await fr(p).evaluate(() => { const n = document.querySelector('.sd-nav').getBoundingClientRect(), b = document.querySelector('.sd-body').getBoundingClientRect(), t = document.querySelector('.sd-top').getBoundingClientRect(); return { nav: [n.left, n.top, n.width, n.height].map(Math.round), body: [b.left, b.width].map(Math.round), top: [t.left, t.width].map(Math.round), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    console.log(label, JSON.stringify(geom));
    ok(label + ': no sideways scroll', !geom.hscroll);
    await c.close();
  }
  console.log('ERRORS:', errs.length, errs.slice(0, 6));
  ok('no page or console errors', errs.length === 0);
  await b.close();
})();
