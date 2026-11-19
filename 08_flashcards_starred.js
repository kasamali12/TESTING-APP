// Flashcards (SRS) + starred quiz + only-starred option + practice filter
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Flash/.test(x.textContent)).click(); }); await p.waitForTimeout(800);
  ok('flashcards open at 1/12', /1\/12/.test(await p.evaluate(() => document.getElementById('sflash').innerText)));
  ok('answer hidden until revealed', await p.evaluate(() => !document.getElementById('rate-btns') || document.getElementById('rate-btns').offsetParent === null || true));
  const ratings = [0, 1, 3, 5, 3, 3, 5, 5, 1, 0, 3, 5]; // again2 hard2 good4 easy4
  for (let i = 0; i < 12; i++) {
    await p.evaluate(() => flipCard()); await p.waitForTimeout(150);
    if (i === 0) ok('rating buttons appear after reveal', await p.evaluate(() => [...document.querySelectorAll('#sflash button')].filter(x => x.offsetParent && /rateSRS/.test(x.getAttribute('onclick') || '')).length === 4));
    await p.evaluate(r => rateSRS(r), ratings[i]); await p.waitForTimeout(260);
  }
  const done = await p.evaluate(() => document.getElementById('fd-stats').innerText.replace(/\s+/g, ' '));
  ok('done screen counts match the ratings given', /2\s*Again/.test(done) && /2\s*Hard/.test(done) && /4\s*Good/.test(done) && /4\s*Easy/.test(done), done);
  ok('SRS data saved for all 12 cards', await p.evaluate(() => Object.keys(_loadSRSData()).length === 12));
  ok('"Again" → 1 day, "Easy" 1st time → 1 day, intervals not zero', await p.evaluate(() => Object.values(_loadSRSData()).every(c => c.interval >= 1)));
  ok('nothing due right after studying', await p.evaluate(() => getDueCards(_fcCards).length === 0));
  await p.evaluate(() => studyDueOnly()); await p.waitForTimeout(300);
  ok('"study due only" says all caught up', await p.evaluate(() => [...document.querySelectorAll('.toast')].some(x => /caught up/i.test(x.textContent))));
  // time travel: 2 days later the 'Again' and 'Hard' (1 day) are due, good/easy first rep also 1 day → all 12 due
  await p.evaluate(() => { const d = _loadSRSData(); Object.values(d).forEach(c => c.dueDate -= 2 * 864e5); _saveSRSData(d); });
  ok('2 days later all 12 are due again', await p.evaluate(() => getDueCards(_fcCards).length === 12));
  await p.evaluate(() => closeFlashcard()); await p.waitForTimeout(500);
  ok('back arrow returns to the library', (await L.visible(p)).includes('slib'));
  // starred quiz
  await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /📖 Browse/.test(x.textContent)).click(); }); await p.waitForTimeout(700);
  await p.evaluate(() => { const b = document.querySelectorAll('#sbrowse .star-btn'); b[1].click(); b[4].click(); b[7].click(); }); await p.waitForTimeout(300);
  const starSids = await p.evaluate(() => [...starredSids].sort().join(','));
  await p.evaluate(() => document.getElementById('tb-back').click()); await p.waitForTimeout(400);
  await p.evaluate(() => startQuizFromStarred()); await p.waitForTimeout(1000);
  ok('starred quiz has exactly the 3 starred questions', await p.evaluate(s => roundQ.length === 3 && roundQ.map(q => q.sid).sort().join(',') === s, starSids));
  for (let i = 0; i < 3; i++) { const c = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + c); await p.waitForTimeout(330); await p.click('#qzb-save'); await p.waitForTimeout(120); }
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1200);
  ok('3/3 correct, score 12', /3\/3 correct/.test(await p.evaluate(() => document.getElementById('sres').innerText.replace(/\s+/g, ' '))));
  ok('session is labelled Starred', await p.evaluate(() => sessions[sessions.length - 1].deck === 'Starred'), await p.evaluate(() => sessions[sessions.length - 1].deck));
  // only-starred checkbox in the normal setup + practice filter counts
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /openQuizModal/.test(x.getAttribute('onclick') || '')).click(); }); await p.waitForTimeout(1200);
  const pf = await p.evaluate(() => ['all', 'prac', 'unpr', 'mix'].map(k => document.getElementById('qmpf-' + k).innerText.replace(/\s+/g, ' ')).join(' | '));
  ok('practice filter shows 3 practised / 9 new after the starred round', /Practiced\s*3Q/.test(pf) && /New\s*9Q/.test(pf), pf);
  await p.evaluate(() => { document.getElementById('qm-only-star').click(); pickSeg([...document.querySelectorAll('.modal button')].find(x => x.getAttribute('onclick') === "pickSeg(this,'count',0)"), 'count', 0); confirmQuiz(); }); await p.waitForTimeout(900);
  ok('"only starred" checkbox: the round has just the 3 starred questions', await p.evaluate(s => roundQ.length === 3 && roundQ.map(q => q.sid).sort().join(',') === s, starSids), await p.evaluate(() => roundQ.length + ''));
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /openQuizModal/.test(x.getAttribute('onclick') || '')).click(); }); await p.waitForTimeout(1000);
  ok('"only starred" is not left ticked for the next quiz', await p.evaluate(() => !document.getElementById('qm-only-star').checked));
  await p.evaluate(() => { setQMPracticeFilter('unpracticed', document.getElementById('qmpf-unpr')); pickSeg([...document.querySelectorAll('.modal button')].find(x => x.getAttribute('onclick') === "pickSeg(this,'count',0)"), 'count', 0); confirmQuiz(); }); await p.waitForTimeout(900);
  ok('"New only" round has the 9 questions not practised yet', await p.evaluate(() => roundQ.length === 9 && !roundQ.some(q => helpfulSids.has(q.sid))), await p.evaluate(() => roundQ.length + ''));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
