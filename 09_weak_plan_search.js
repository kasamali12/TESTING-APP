// Weak-area quizzes built from test history, daily plan, global search
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const finish = async p => { await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1300); };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  // custom test: Anatomy 5 + Physiology 5, 7 right
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(400); await p.evaluate(() => openCustomTest()); await p.waitForTimeout(600);
  await p.evaluate(() => { toggleCtSubj(4); for (let i = 0; i < 5; i++) ctAdjQ(0, -1); for (let i = 0; i < 40; i++) ctAdjQ(1, -1); for (let i = 0; i < 4; i++) ctAdjQ(1, 1); });
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start/.test(x.textContent)).click(); }); await p.waitForTimeout(700);
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(1800);
  for (let i = 0; i < 10; i++) { const c = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + (i < 7 ? c : (c + 1) % 4)); await p.waitForTimeout(330); await p.click('#qzb-save'); await p.waitForTimeout(120); }
  const wrong = await p.evaluate(() => roundQ.filter((q, i) => qUserAns[i] !== q.correct).map(q => q.sid).sort());
  await finish(p);
  ok('custom test finished 7/10', /7\/10 correct/.test(await p.evaluate(() => document.getElementById('sres').innerText.replace(/\s+/g, ' '))));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(500);
  await p.evaluate(() => startWeakAreaQuiz()); await p.waitForTimeout(1500);
  const got = await p.evaluate(() => roundQ.map(q => q.sid).sort());
  ok('Weak Areas quiz = exactly the 3 questions missed in the test', JSON.stringify(got) === JSON.stringify(wrong), got.length + ' got, ' + wrong.length + ' expected');
  ok('it is a normal quiz screen with a label', (await L.visible(p))[0] === 'sq');
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(400);
  console.log('smart weak:', await p.evaluate(async () => { await startSmartWeakQuiz(); return [roundQ.length, document.querySelector('#sq') && !document.getElementById('sq').classList.contains('hidden')]; }));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(400);
  console.log('daily plan:', await p.evaluate(async () => { await startDailyPlanQuiz(); return roundQ.length; }), await L.visible(p));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(300);
  // global search
  await p.evaluate(() => openGSearch()); await p.waitForTimeout(400);
  await p.evaluate(() => { const i = document.getElementById('gsearch-inp'); i.value = 'carpal'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(900);
  const gs = await p.evaluate(() => document.getElementById('gsearch-results').innerText.replace(/\s+/g, ' ').slice(0, 300)); console.log('gsearch:', gs);
  ok('global search finds the Carpal bones questions', /Carpal/i.test(gs));
  await p.screenshot({ path: 'out/e2e_gsearch.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('Escape closes search', await p.evaluate(() => document.getElementById('gsearch-ov').classList.contains('hidden')));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
