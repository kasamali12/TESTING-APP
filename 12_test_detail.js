// Test detail: Wrong vs Skipped are separate; a test with no skipped questions keeps four tiles
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
async function runTest(p, answers) { // answers: array of 'right' | 'wrong' | 'skip'
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(400);
  await p.evaluate(() => openCustomTest()); await p.waitForTimeout(600);
  await p.evaluate(() => { toggleCtSubj(4); for (let i = 0; i < 5; i++) ctAdjQ(0, -1); }); await p.waitForTimeout(250);
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start/.test(x.textContent)).click(); }); await p.waitForTimeout(1300);
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(1500);
  const n = await p.evaluate(() => roundQ.length);
  for (let i = 0; i < n; i++) {
    const a = answers[i] || 'skip';
    if (a !== 'skip') { const c = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + (a === 'right' ? c : (c + 1) % 4)); await p.waitForTimeout(120); }
    if (i < n - 1) { if (a === 'skip') { await p.evaluate(() => { const b = document.getElementById('qzb-save'); if (b) b.click(); }); } else await p.click('#qzb-save'); await p.waitForTimeout(150); }
  }
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(400); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1500);
}
async function detail(p, which) {
  await p.evaluate(() => navTo('tests')); await p.waitForTimeout(400); await p.evaluate(() => setTestsTab('custom')); await p.waitForTimeout(400);
  const ids = await p.evaluate(() => [...new Set([...document.querySelectorAll('#stests [onclick*="viewTestDetail"]')].map(x => (x.getAttribute('onclick').match(/viewTestDetail\('([^']+)'\)/) || [])[1]).filter(Boolean))]);
  await p.evaluate(id => viewTestDetail(id), ids[which]); await p.waitForTimeout(900);
  return p.evaluate(() => [...document.querySelectorAll('#stestdetail .td-stat')].map(x => x.querySelector('.td-sl').textContent.trim() + '=' + x.querySelector('.td-sv').textContent.trim()));
}
(async () => {
  const { b, p, errs } = await L.boot({}); await L.importCsv(p);
  await runTest(p, ['right', 'right', 'right', 'right', 'right', 'wrong', 'wrong']); // 5 right, 2 wrong, 3 skipped (10 questions)
  let t = await detail(p, 0); console.log('tiles:', t.join(' | '));
  ok('detail shows Correct 5, Wrong 2, Skipped 8, Total 15', t.includes('Correct=5') && t.includes('Wrong=2') && t.includes('Skipped=8') && t.includes('Total=15'), t.join(' '));
  const geo = await p.evaluate(() => { const g = document.querySelector('#stestdetail .td-stats'); const r = g.getBoundingClientRect(); const k = [...g.children].map(x => x.getBoundingClientRect()); return { w: Math.round(r.width), rows: new Set(k.map(x => Math.round(x.top))).size, minW: Math.round(Math.min(...k.map(x => x.width))), overflow: g.scrollWidth > g.clientWidth + 1 }; });
  ok('five tiles sit on one row with no overflow', geo.rows === 1 && !geo.overflow, JSON.stringify(geo));
  await p.screenshot({ path: 'out/e2e_td_skipped.png' });
  const sk = await p.evaluate(() => [...document.querySelectorAll('#stestdetail [class*="skip"], #stestdetail .td-q')].length);
  await runTest(p, Array(15).fill('right').map((x, i) => i < 12 ? 'right' : 'wrong')); // 12 right, 3 wrong, none skipped
  const sessions = await p.evaluate(() => sessions.length); console.log('sessions', sessions);
  t = await detail(p, 0); console.log('tiles (newest first?):', t.join(' | '));
  const t2 = await detail(p, 1); console.log('tiles (other):', t2.join(' | '));
  const all = [t, t2]; ok('two saved tests are listed', all[0].join() !== all[1].join(), all.map(x => x.join(' ')).join('  //  ')); const clean = all.find(x => !x.some(y => /^Skipped/.test(y)));
  ok('a test with nothing skipped keeps four tiles (no Skipped tile)', clean && clean.length === 4 && clean.includes('Wrong=3') && clean.includes('Correct=12'), clean && clean.join(' '));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
