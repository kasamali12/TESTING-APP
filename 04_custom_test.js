// Custom test: build, take, results, saved in Tests tab, detail
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(500);
  await p.evaluate(() => openCustomTest()); await p.waitForTimeout(700);
  const sum0 = await p.evaluate(() => document.getElementById('ct-subj-summary').textContent.replace(/\s+/g, ' '));
  ok('builder preselects the 3 subjects that have questions', /3 subjects/.test(sum0), sum0);
  await p.evaluate(() => { toggleCtSubj(4); for (let i = 0; i < 5; i++) ctAdjQ(0, -1); }); await p.waitForTimeout(300);
  const sum1 = await p.evaluate(() => document.getElementById('ct-subj-summary').textContent.replace(/\s+/g, ' '));
  ok('deselect Pharmacology + lower Anatomy by 5 → 2 subjects · 15Q', /2 subjects/.test(sum1) && /15Q/.test(sum1), sum1);
  await p.evaluate(() => { for (let i = 0; i < 40; i++) ctAdjQ(1, 1); }); await p.waitForTimeout(200);
  ok('question count is capped at what is available (12)', await p.evaluate(() => /12\b/.test(document.querySelectorAll('#ct-subj-grid [onclick^="ctAdjQ(1,1)"]')[0].parentElement.textContent)));
  await p.evaluate(() => { for (let i = 0; i < 40; i++) ctAdjQ(1, -1); }); await p.waitForTimeout(200);
  ok('count never goes below 1', await p.evaluate(() => /\b1\b/.test(document.querySelectorAll('#ct-subj-grid [onclick^="ctAdjQ(1,1)"]')[0].parentElement.textContent)));
  await p.evaluate(() => { for (let i = 0; i < 4; i++) ctAdjQ(1, 1); }); await p.waitForTimeout(200); // physiology 5
  const sum2 = await p.evaluate(() => document.getElementById('ct-subj-summary').textContent.replace(/\s+/g, ' '));
  console.log('summary now:', sum2);
  const startBtn = await p.evaluate(() => { const b = [...document.querySelectorAll('.sheet-footer button')].filter(x => x.offsetParent); return b.map(x => x.textContent.trim() + '|' + (x.getAttribute('onclick') || '').slice(0, 50)); });
  console.log('footer', startBtn);
  await p.screenshot({ path: 'out/e2e_ct_ready.png' });
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start/.test(x.textContent)).click(); }); await p.waitForTimeout(1500);
  ok('"Choose Question Source" sheet appears', await p.evaluate(() => [...document.querySelectorAll('.sheet-hdr-title')].some(x => x.offsetParent && /Choose Question Source/.test(x.textContent))));
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(1800);
  const st = await p.evaluate(() => [roundQ.length, qi, typeof isNeetMode !== 'undefined' && isNeetMode, currentTestType]);
  ok('test starts with 10 questions', st[0] === 10 && st[1] === 0, JSON.stringify(st));
  ok('questions come only from the two chosen subjects', await p.evaluate(() => roundQ.every(q => /Anatomy|Physiology/i.test((q.path || q.deck || q.subj || q.pk || JSON.stringify(q)).toString()))));
  await p.screenshot({ path: 'out/e2e_ct_quiz.png' });
  console.log('quiz UI buttons:', await p.evaluate(() => [...document.querySelectorAll('#sq button, #sq [onclick]')].filter(x => x.offsetParent).map(x => (x.id ? '#' + x.id + ' ' : '') + x.textContent.trim().replace(/\s+/g, ' ').slice(0, 18)).slice(0, 16)));
  // answer all, 7 right
  for (let i = 0; i < 10; i++) {
    const c = await p.evaluate(() => roundQ[qi].correct); const pick = i < 7 ? c : (c + 1) % 4;
    await p.click('#o' + pick); await p.waitForTimeout(120); await p.click('#qzb-save'); await p.waitForTimeout(120);
  }
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(400); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1500);
  const vis = await L.visible(p); console.log('after submit', vis);
  const rt = await p.evaluate(id => document.getElementById(id).innerText.replace(/\s+/g, ' ').slice(0, 400), vis[0]); console.log(rt);
  await p.screenshot({ path: 'out/e2e_ct_result.png' });
  ok('result shows 7/10 correct and +4/-1 score 25', /7\/10 correct/.test(rt) && /25\s*Score/.test(rt), rt.slice(0, 90));
  // Tests tab lists it
  await p.evaluate(() => navTo('tests')); await p.waitForTimeout(500); await p.evaluate(() => setTestsTab('custom')); await p.waitForTimeout(500);
  const tt = await p.evaluate(() => document.getElementById('stests').innerText.replace(/\s+/g, ' ').slice(0, 400)); console.log(tt);
  ok('Tests › Custom now lists 1 test, done, with a score', /1 Total/.test(tt) && /1 Done/.test(tt), tt.slice(0, 100));
  await p.screenshot({ path: 'out/e2e_tests_list.png' });
  await p.evaluate(() => setTestsTab('neet')); await p.waitForTimeout(300);
  ok('NEET PG tab stays empty (custom test not mixed in)', /0 Total/.test(await p.evaluate(() => document.getElementById('stests').innerText.replace(/\s+/g, ' '))));
  await p.evaluate(() => setTestsTab('custom')); await p.waitForTimeout(300);
  console.log('test row buttons:', await p.evaluate(() => [...document.querySelectorAll('#stests [onclick]')].filter(x => x.offsetParent).map(x => x.textContent.trim().replace(/\s+/g, ' ').slice(0, 20) + '|' + x.getAttribute('onclick').slice(0, 40))));
  ok('analytics saw the session', await p.evaluate(() => sessions.length === 1 && sessions[0].total === 10), await p.evaluate(() => JSON.stringify(sessions[0]).slice(0, 160)));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
