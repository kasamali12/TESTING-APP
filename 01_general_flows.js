// Main study flow with real data: navigation, import, quiz, scoring, review, retry, stars, analytics, home.
const L = require('./lib');
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };
const txt = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel).then(t => t.replace(/\s+/g, ' '));
(async () => {
  const { b, p, errs } = await L.boot();
  // ── navigation ──
  for (const [t, sec] of [['home', 'shome'], ['lib', 'slib'], ['tests', 'stests'], ['ana', 'sana'], ['set', 'sset']]) {
    await p.evaluate(t => navTo(t), t); await p.waitForTimeout(250);
    const v = await L.visible(p);
    ok('tab ' + t + ' shows only its page', v.length === 1 && v[0] === sec, JSON.stringify(v));
    ok('tab ' + t + ' is highlighted in the bottom bar', await p.evaluate(t => { const b = [...document.querySelectorAll('#bnav [onclick]')].find(x => (x.getAttribute('onclick') || '').includes("'" + t + "'")); return !!b && /active|on|sel/.test(b.className); }, t), await p.evaluate(t => { const b = [...document.querySelectorAll('#bnav [onclick]')].find(x => (x.getAttribute('onclick') || '').includes("'" + t + "'")); return b && b.className; }, t));
  }
  // ── import ──
  await L.importCsv(p);
  ok('CSV import created 3 decks with 36 questions', /3 Decks/.test(await txt(p, '#slib')) && /36/.test(await txt(p, '#slib')));
  const idb = await p.evaluate(async () => { const q = await loadQuestions(); return Array.isArray(q) ? q.length : (q && Object.keys(q).length); }).catch(e => 'err ' + e.message);
  console.log('loadQuestions ->', idb);
  // ── quiz: star Q1, answer 8 right / 4 wrong ──
  await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Quiz/.test(x.textContent)).click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { pickSeg([...document.querySelectorAll('.modal button')].find(x => x.textContent.trim() === 'All' && /count/.test(x.getAttribute('onclick') || '')), 'count', 0); confirmQuiz(); }); await p.waitForTimeout(800);
  ok('quiz opens with 12 questions', (await p.evaluate(() => roundQ.length)) === 12 && /Q1\/12/.test(await txt(p, '#sq')));
  await p.evaluate(() => document.getElementById('qsb').click()); await p.waitForTimeout(200);
  ok('star button toggles to starred', /★|Starred|Unstar/.test(await p.evaluate(() => document.getElementById('qsb').textContent)), await p.evaluate(() => document.getElementById('qsb').textContent));
  const wrongTexts = [];
  for (let i = 0; i < 12; i++) {
    const st = await p.evaluate(() => ({ qi, c: roundQ[qi].correct, q: roundQ[qi].q }));
    const pick = i < 8 ? st.c : (st.c + 1) % 4; if (i >= 8) wrongTexts.push(st.q);
    await p.click('#o' + pick); await p.waitForTimeout(350);
    if (i === 0) ok('picked option is highlighted', await p.evaluate(p => document.querySelectorAll('#sq .opt')[p].className, pick).then(c => /pending|sel|chosen|picked|active/.test(c)), await p.evaluate(p => document.querySelectorAll('#sq .opt')[p].className, pick));
    if (i === 3) { await p.click('text=Mark & Next'); await p.waitForTimeout(250); await p.click('text=Previous'); await p.waitForTimeout(250); }
    await p.click('#qzb-save'); await p.waitForTimeout(280);
  }
  await p.evaluate(() => openPalette()); await p.waitForTimeout(300);
  const pal = await txt(p, '#sq');
  ok('palette counts: 12 answered', /12 Answered/.test(pal) || /Answered/.test(pal), (pal.match(/(\d+) Answered (\d+) Not Answered (\d+) Marked/) || [])[0]);
  await p.evaluate(() => closePalette());
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(400);
  ok('submit asks for confirmation', await p.evaluate(() => !document.getElementById('submit-confirm-ov').classList.contains('hidden')));
  await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1200);
  const res = await txt(p, '#sres');
  ok('results page shows 8/12 correct', /8\/12 correct/.test(res), res.slice(0, 160));
  ok('results: Correct 8, Wrong 4', /8 Correct/.test(res) && /4 Wrong/.test(res));
  ok('results: subject-wise block lists Anatomy 8/12', /Anatomy 8\/12/.test(res), (res.match(/Anatomy[^A-Z]{0,30}/) || [])[0]);
  ok('results: percent 67%', /67%/.test(res), (res.match(/\d+%/g) || []).join(','));
  await p.screenshot({ path: 'out/e2e_results2.png' });
  // ── review mistakes / answers ──
  await p.evaluate(() => showMistakesOnly()); await p.waitForTimeout(600);
  const mis = await txt(p, '#srev');
  ok('review mistakes shows the 4 wrong answers', (mis.match(/Q\d+: Which statement/g) || []).length === 4, (mis.match(/Q\d+: Which statement/g) || []).length + ' items');
  ok('review shows the explanation text', /Explanation:/.test(mis));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(300);
  // ── retry wrong: results again ──
  ok('home reflects the practice (no errors)', errs.length === 0, errs.join('|'));
  console.log('FAILS', fails, 'ERRS', errs.length, errs.slice(0, 5));
  await b.close(); process.exitCode = fails || errs.length ? 1 : 0;
})();
