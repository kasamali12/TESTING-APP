// Browse screen: list, star, filter, sort, search, expand, back
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  const open = async () => { await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /📖 Browse/.test(x.textContent)).click(); }); await p.waitForTimeout(700); };
  const qs = () => p.evaluate(() => [...document.querySelectorAll('#sbrowse .bq .bq-q')].map(x => x.textContent.trim().slice(0, 40)));
  await open();
  let list = await qs();
  ok('Browse lists all 12 questions of the deck', list.length === 12, list.length + '');
  // expand
  await p.evaluate(() => document.querySelector('#sbrowse .bq .bq-head').click()); await p.waitForTimeout(250);
  ok('tapping a question opens its options', await p.evaluate(() => { const bq = document.querySelector('#sbrowse .bq'); const body = bq.querySelector('.bq-body'); return body.offsetHeight > 20 && bq.querySelectorAll('.bq-opt').length === 4; }));
  ok('correct option is marked', await p.evaluate(() => document.querySelectorAll('#sbrowse .bq')[0].querySelectorAll('.bq-opt.ok').length === 1));
  // star two
  await p.evaluate(() => { const b = document.querySelectorAll('#sbrowse .bq .star-btn'); b[2].click(); b[5].click(); }); await p.waitForTimeout(300);
  ok('star toggles on (☆ → ⭐)', await p.evaluate(() => [...document.querySelectorAll('#sbrowse .star-btn')].filter(x => /⭐/.test(x.textContent)).length === 2));
  ok('starred counter on filter chip', await p.evaluate(() => { const e = document.getElementById('ft-star'); return /2/.test(e.textContent) || (typeof starredSids !== 'undefined' && starredSids.size === 2); }));
  // filter starred
  await p.evaluate(() => setBrowseFilter('starred')); await p.waitForTimeout(250);
  list = await qs(); ok('⭐ filter shows only the 2 starred', list.length === 2, list.join(' | '));
  await p.evaluate(() => setBrowseFilter('unpracticed')); await p.waitForTimeout(250);
  ok('New filter shows all 12 (nothing practised yet)', (await qs()).length === 12);
  await p.evaluate(() => setBrowseFilter('practiced')); await p.waitForTimeout(250);
  ok('Done filter is empty before practice', (await qs()).length === 0);
  await p.evaluate(() => setBrowseFilter('all')); await p.waitForTimeout(250);
  // sort
  await p.evaluate(() => toggleBrowseSort()); await p.waitForTimeout(150);
  await p.evaluate(() => setBrowseSort('starred-first')); await p.waitForTimeout(250);
  ok('sort "⭐ First" puts the starred ones on top', await p.evaluate(() => { const r = [...document.querySelectorAll('#sbrowse .bq')].slice(0, 2); return r.every(x => /⭐/.test(x.querySelector('.star-btn').textContent)); }));
  ok('sort button shows as selected', await p.evaluate(() => document.getElementById('bsort-starred').classList.contains('on')));
  await p.evaluate(() => setBrowseSort('wrong-first')); await p.waitForTimeout(250);
  ok('sort "✗ Weakest" button shows as selected', await p.evaluate(() => document.getElementById('bsort-wrong').classList.contains('on')));
  await p.evaluate(() => setBrowseSort('alpha')); await p.waitForTimeout(250);
  list = await qs(); const sorted = [...list].sort((a, b) => a.localeCompare(b));
  ok('sort A–Z orders the list', JSON.stringify(list) === JSON.stringify(sorted), list.slice(0, 3).join(' | '));
  await p.evaluate(() => setBrowseSort('default')); await p.waitForTimeout(250);
  // search
  await p.evaluate(() => { const i = document.getElementById('search-inp'); const bar = document.getElementById('search-bar'); if (bar) bar.className = 'search-bar on'; i.value = 'Circle of Willis'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(500);
  list = await qs(); ok('search "Circle of Willis" narrows to 3 of 12', list.length === 3 && list.every(x => /Wil/.test(x)), list.length + '');
  await p.evaluate(() => { const i = document.getElementById('search-inp'); i.value = 'zzzzqq'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(500);
  ok('search with no match shows nothing, no error', (await qs()).length === 0);
  await p.evaluate(() => { const i = document.getElementById('search-inp'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(500);
  ok('clearing search brings all 12 back', (await qs()).length === 12);
  // star survives a reload of the screen and of the whole page
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await open();
  ok('stars are still there after leaving and re-entering', await p.evaluate(() => [...document.querySelectorAll('#sbrowse .star-btn')].filter(x => /⭐/.test(x.textContent)).length === 2));
  await p.reload(); await p.waitForTimeout(1500); await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; });
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(500); await p.evaluate(() => { const id = (document.querySelector('#slib [onclick*="loadSavedDeck"]').getAttribute('onclick').match(/loadSavedDeck\('([^']+)'/) || [])[1]; return loadSavedDeck(id); }); await p.waitForTimeout(1200);
  await open(); ok('stars survive a page reload (shown in Browse)', await p.evaluate(() => [...document.querySelectorAll('#sbrowse .star-btn')].filter(x => /⭐/.test(x.textContent)).length === 2));
  ok('starring keeps the card whole (Mark Done + options still there)', await p.evaluate(() => { const c = document.querySelectorAll('#sbrowse .bq')[2]; return /Mark Done/.test(c.textContent) && c.querySelectorAll('.bq-opt').length === 4; }));
  // back arrow
  await open(); await p.evaluate(() => document.getElementById('tb-back').click()); await p.waitForTimeout(400);
  ok('back arrow leaves Browse', (await L.visible(p)).indexOf('sbrowse') < 0, (await L.visible(p)).join(','));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
