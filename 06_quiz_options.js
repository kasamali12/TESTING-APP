// Quiz options: count, shuffle, explanations, only-starred, practice filter, timer; starred / weak / daily-plan quizzes
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const openSetup = async p => { await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Quiz/.test(x.textContent) && !/⭐/.test(x.textContent)).click(); }); await p.waitForTimeout(450); };
const seg = (p, key, val) => p.evaluate(([k, v]) => { const b = [...document.querySelectorAll('.modal button')].find(x => (x.getAttribute('onclick') || '') === `pickSeg(this,'${k}',${v})`); b.click(); }, [key, val]);
const set = (p, id, on) => p.evaluate(([i, o]) => { const c = document.getElementById(i); if (c.checked !== o) c.click(); }, [id, on]);
const answer = async (p, n, right) => { for (let i = 0; i < n; i++) { const c = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + (i < right ? c : (c + 1) % 4)); await p.waitForTimeout(120); await p.click('#qzb-save'); await p.waitForTimeout(100); } await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(900); };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  // count 5, shuffle off => first 5 in deck order
  await openSetup(p); await seg(p, 'count', 5); await set(p, 'qm-sh', false); await p.evaluate(() => confirmQuiz()); await p.waitForTimeout(900);
  const ord = await p.evaluate(() => roundQ.map(q => q.q.slice(0, 4)).join(','));
  ok('count 5 → 5 questions', await p.evaluate(() => roundQ.length === 5));
  ok('shuffle off keeps deck order (Q1..Q5)', ord === 'Q1: ,Q2: ,Q3: ,Q4: ,Q5: ', ord);
  // explanations on: after answering the explanation is visible at once
  const c0 = await p.evaluate(() => roundQ[0].correct); await p.click('#o' + c0); await p.waitForTimeout(700);
  const exp1 = await p.evaluate(() => { const e = document.getElementById('exp-box') || document.querySelector('.exp-box, #qexp, .q-exp'); return e ? [e.offsetParent !== null, e.innerText.slice(0, 40)] : 'none'; });
  console.log('explanation panel (exp ON):', JSON.stringify(exp1));
  await p.screenshot({ path: 'out/e2e_practice_exp.png' });
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(400);
  console.log('left quiz mid-way, vis:', await L.visible(p), '| errs', errs.length);
  // explanations off
  await openSetup(p); await seg(p, 'count', 5); await set(p, 'qm-ex', false); await p.evaluate(() => confirmQuiz()); await p.waitForTimeout(900);
  const c1 = await p.evaluate(() => roundQ[0].correct); await p.click('#o' + c1); await p.waitForTimeout(700);
  const exp0 = await p.evaluate(() => { const e = document.getElementById('exp-box') || document.querySelector('.exp-box, #qexp, .q-exp'); return e ? [e.offsetParent !== null, e.innerText.slice(0, 40)] : 'none'; });
  console.log('explanation panel (exp OFF):', JSON.stringify(exp0));
  ok('exam style: no explanation shown while answering', exp0 === 'none' || exp0[0] === false);
  ok('"explanations" choice is remembered for next time', await p.evaluate(() => cfg.exp === false));
  await answer(p, 5, 3);   // finish the 5-question round: 3 right, 2 wrong (first already answered right)
  console.log('result:', (await p.evaluate(() => document.getElementById('sres').innerText.replace(/\s+/g, ' ').slice(0, 90))));
  console.log(errs); await b.close(); process.exit(FAILS ? 1 : 0);
})();
