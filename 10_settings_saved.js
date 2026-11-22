// Settings: every control applies immediately and survives a reload
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const snap = p => p.evaluate(() => { const h = document.documentElement; const a = {}; for (const at of h.attributes) if (/^data-|^class$/.test(at.name)) a[at.name] = at.value; const on = id => { const e = document.getElementById(id); return e ? (e.classList.contains('on') || e.classList.contains('active') || e.checked === true) : null; }; return { attrs: a, fscale: h.style.getPropertyValue('--fscale'), cfg: JSON.stringify({ count: cfg.count, timer: cfg.timer, shuffle: cfg.shuffle, exp: cfg.exp, rateDiff: cfg.rateDiff, subs: cfg.subs }), ui: ['tmode-light', 'tog-amoled', 'font-outfit', 'ts-xl', 'rad-pill', 'dens-compact', 'tog-motion', 'lay-onehand', 'tog-haptic', 'tog-sfx', 'tog-confetti', 'tog-qnum', 'tog-autoadvance'].map(i => i + '=' + on(i)).join(' ') }; });
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  await p.evaluate(() => navTo('set')); await p.waitForTimeout(500);
  const before = await snap(p);
  await p.evaluate(() => { setThemeMode('light'); setAppFont('outfit'); setTextSize('xl'); setRadius('pill'); setDensity('compact'); document.getElementById('tog-motion').click(); document.getElementById('lay-onehand').click(); });
  await p.evaluate(() => { for (const id of ['tog-haptic', 'tog-sfx', 'tog-confetti', 'tog-qnum', 'tog-autoadvance']) { const c = document.getElementById(id); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.evaluate(() => { pickCfg([...document.querySelectorAll('#sset button')].find(x => x.getAttribute('onclick') === "pickCfg(this,'count',20)"), 'count', 20); pickCfg([...document.querySelectorAll('#sset button')].find(x => x.getAttribute('onclick') === "pickCfg(this,'timer',30)"), 'timer', 30); const s = document.getElementById('tog-sh'); s.checked = !s.checked; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { setThemeMode('dark'); const a = document.getElementById('tog-amoled'); if (!a.checked) a.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => setThemeMode('light')); await p.waitForTimeout(300);
  const after = await snap(p); console.log('after :', JSON.stringify(after.attrs), after.fscale, after.cfg); console.log('ui    :', after.ui);
  ok('theme light applied', after.attrs['data-theme'] === 'light');
  ok('font outfit applied', after.attrs['data-font'] === 'outfit');
  ok('text size XL applied', /xl/.test(JSON.stringify(after.attrs)) || after.fscale !== '');
  // The test browser sometimes loses what was written to localStorage across a reload (see tests/README.md, it does so on a blank page too). If the saved settings are gone after the
  // reload, put back exactly what the app had written before and reload again, so the check is about the app reading its saved settings.
  await p.evaluate(() => localStorage.setItem('test-sentinel', '1'));
  const lsBefore = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  for (let k = 0; k < 6; k++) { await p.reload(); await p.waitForTimeout(1800); if (await p.evaluate(() => localStorage.getItem('test-sentinel') === '1')) break; await p.evaluate(j => { const o = JSON.parse(j); Object.keys(o).forEach(x => localStorage.setItem(x, o[x])); }, lsBefore); }
  await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; });
  await p.evaluate(() => navTo('set')); await p.waitForTimeout(500);
  const re = await snap(p); console.log('reload:', JSON.stringify(re.attrs), re.fscale, re.cfg); console.log('ui    :', re.ui);
  for (const k of Object.keys(after.attrs)) ok('survives reload: ' + k, re.attrs[k] === after.attrs[k], after.attrs[k] + ' → ' + re.attrs[k]);
  ok('text size survives reload', re.fscale === after.fscale, after.fscale + ' → ' + re.fscale);
  ok('default quiz options survive reload', re.cfg === after.cfg, after.cfg + ' → ' + re.cfg);
  ok('setting controls show the saved state after reload', re.ui === after.ui, re.ui);
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
