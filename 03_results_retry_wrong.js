// Results screen actions, retry wrong, review, starred quiz, weak-area, Home, history
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const answerAll = async (p, total, right) => {
  for (let i = 0; i < total; i++) {
    const c = await p.evaluate(() => roundQ[qi].correct); const pick = i < right ? c : (c + 1) % 4;
    await p.click('#o' + pick); await p.waitForTimeout(120); await p.click('#qzb-save'); await p.waitForTimeout(120);
  }
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1200);
};
const resText = p => p.evaluate(() => document.getElementById('sres').innerText.replace(/\s+/g, ' '));
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  await L.quiz(p, { right: 8, total: 12, star: true });
  ok('results: 8/12 correct, score 28 (+4/-1)', /8\/12 correct/.test(await resText(p)) && /28\s*Score/.test(await resText(p)), (await resText(p)).slice(0, 80));
  const wrongSids = await p.evaluate(() => roundQ.map((q, i) => ({ sid: q.sid, st: qStatus[i], ua: qUserAns[i], c: q.correct })).filter(x => x.ua !== x.c).map(x => x.sid));
  ok('exactly 4 wrong answers recorded', wrongSids.length === 4, wrongSids.length + '');
  // review answers
  await p.evaluate(() => showReview()); await p.waitForTimeout(600);
  const rv = await L.visible(p); ok('Review Answers opens a review screen', rv.length === 1 && rv[0] !== 'sres', rv.join(','));
  const rtxt = await p.evaluate(() => document.getElementById('srev').innerText.replace(/\s+/g, ' '));
  ok('review shows every question with its explanation', (rtxt.match(/Q\d+:/g) || []).length === 12 && /Explanation|Correct/i.test(rtxt), (rtxt.match(/Q\d+:/g) || []).length + ' q');
  await p.screenshot({ path: 'out/e2e_review.png' });
  await p.evaluate(() => document.getElementById('tb-back').click()); await p.waitForTimeout(500);
  ok('back from review returns to results', (await L.visible(p)).includes('sres'), (await L.visible(p)).join(','));
  // mistakes only
  await p.evaluate(() => showMistakesOnly()); await p.waitForTimeout(600);
  const mv = await L.visible(p); const mtxt = await p.evaluate(id => document.getElementById(id).innerText.replace(/\s+/g, ' '), mv[0]);
  ok('Review Mistakes shows exactly the 4 wrong questions', (mtxt.match(/Q\d+:/g) || []).length === 4, mv.join(',') + ' ' + (mtxt.match(/Q\d+:/g) || []).length);
  await p.evaluate(() => document.getElementById('tb-back').click()); await p.waitForTimeout(500);
  // retry wrong
  await p.evaluate(() => retryWrong()); await p.waitForTimeout(900);
  ok('Retry Wrong starts a quiz of 4', await p.evaluate(() => roundQ.length === 4 && qi === 0), await p.evaluate(() => roundQ.length + ''));
  const same = await p.evaluate(w => roundQ.map(q => q.sid).sort().join() === w.sort().join(), wrongSids);
  ok('and they are the same 4 questions that were wrong', same);
  await answerAll(p, 4, 4);
  ok('retry results: 4/4 correct', /4\/4 correct/.test(await resText(p)), (await resText(p)).slice(0, 70));
  ok('no "Retry Wrong" button when nothing was wrong', await p.evaluate(() => ![...document.querySelectorAll('#sres button')].some(x => /Retry/.test(x.textContent) && x.offsetParent)));
  // history & analytics got both sessions
  ok('two sessions saved', await p.evaluate(() => sessions.length === 2), await p.evaluate(() => sessions.length + ''));
  // Play Again
  await p.evaluate(() => startQuiz(activeNode || qmNode)); await p.waitForTimeout(900);
  ok('Play Again starts a fresh quiz', await p.evaluate(() => qi === 0 && roundQ.length > 0), await p.evaluate(() => roundQ.length + ' q'));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(600);
  ok('Home button/nav leaves a running quiz without errors', (await L.visible(p)).includes('shome'), (await L.visible(p)).join(','));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
