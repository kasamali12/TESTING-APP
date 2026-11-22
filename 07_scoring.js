// Scoring is +4/-1 exactly and does not depend on the order of the answers
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const openSetup = async p => { await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Quiz/.test(x.textContent) && !/⭐/.test(x.textContent)).click(); }); await p.waitForTimeout(450); };
const run = async (p, pattern, exp) => {
  await openSetup(p);
  await p.evaluate(([e]) => { pickSeg([...document.querySelectorAll('.modal button')].find(x => x.getAttribute('onclick') === "pickSeg(this,'count',5)"), 'count', 5); const sh = document.getElementById('qm-sh'); if (sh.checked) sh.click(); const ex = document.getElementById('qm-ex'); if (ex.checked !== e) ex.click(); confirmQuiz(); }, [exp]); await p.waitForTimeout(900);
  for (let i = 0; i < 5; i++) { const c = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + (pattern[i] === 'R' ? c : (c + 1) % 4)); await p.waitForTimeout(330); await p.click('#qzb-save'); await p.waitForTimeout(120); }
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1000);
  return p.evaluate(() => document.getElementById('sres').innerText.replace(/\s+/g, ' '));
};
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  for (const [exp, label] of [[true, 'practice mode'], [false, 'exam style']]) {
    let r = await run(p, 'WRRWW', exp); ok(label + ': W R R W W → 5 (not 6)', /\b5\s*Score/.test(r) && /2\/5 correct/.test(r), r.slice(0, 70));
    r = await run(p, 'WWWRR', exp); ok(label + ': W W W R R → 5 (not 8)', /\b5\s*Score/.test(r), r.slice(0, 70));
    r = await run(p, 'RRRRR', exp); ok(label + ': all right → 20', /\b20\s*Score/.test(r), r.slice(0, 70));
    r = await run(p, 'WWWWW', exp); ok(label + ': all wrong never shows a negative score (floor 0)', /\b0\s*Score/.test(r) && !/-\d+\s*Score/.test(r), r.slice(0, 70));
  }
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
