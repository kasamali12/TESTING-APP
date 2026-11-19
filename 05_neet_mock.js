// NEET PG mock: sheet → instructions → exam (palette, mark for review, timer) → submit → results → Tests tab → detail/retry/delete
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(500);
  await p.evaluate(() => openNeetTest()); await p.waitForTimeout(700);
  ok('sheet summary matches what can really run (3 subjects · 30Q · 35m)', await p.evaluate(() => document.getElementById('neet-subj-summary').textContent) === '3 subjects · 30Q · 35m');
  await p.evaluate(() => { [...document.querySelectorAll('#neet-ov button')].find(x => x.offsetParent && /Proceed to Instructions/.test(x.textContent)).click(); }); await p.waitForTimeout(800);
  ok('instructions page shows 30 questions / 120 marks / 0 hr 35 min', JSON.stringify(await p.evaluate(() => ['nbib-q', 'nbib-marks', 'nbib-dur'].map(i => document.getElementById(i).textContent))) === '["30","120","0 hr 35 min"]');
  ok('Start Exam is locked until the agreement is ticked', await p.evaluate(() => document.getElementById('neet-brief-start-btn').disabled));
  await p.evaluate(() => document.getElementById('nbr-agree-chk').click()); await p.waitForTimeout(250);
  ok('ticking the agreement unlocks it', await p.evaluate(() => !document.getElementById('neet-brief-start-btn').disabled));
  await p.click('#neet-brief-start-btn'); await p.waitForTimeout(700);
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(2500);
  ok('exam screen is open with 30 unique questions', (await L.visible(p))[0] === 'sq' && await p.evaluate(() => roundQ.length === 30 && new Set(roundQ.map(q => q.sid)).size === 30));
  const t0 = await p.evaluate(() => globalTmrLeft);
  ok('global timer is 35 min', t0 > 2090 && t0 <= 2100, t0 + 's');
  await p.waitForTimeout(2300); const t1 = await p.evaluate(() => globalTmrLeft);
  ok('timer is counting down', t1 < t0, t0 + ' → ' + t1);
  const sub = await p.evaluate(() => [...document.querySelectorAll('#sq [id^="pst-"]')].map(x => x.textContent.trim().replace(/\s+/g, ' ')).join(' | ')); console.log('palette filters:', sub);
  // mark Q1 for review, answer, jump to Q10 via palette and back
  await p.screenshot({ path: 'out/e2e_neet_q1.png' });
  const markBtn = await p.evaluate(() => [...document.querySelectorAll('#sq button')].filter(x => x.offsetParent && /Mark|Review|🔖/.test(x.textContent)).map(x => (x.id || '') + ':' + x.textContent.trim().slice(0, 20) + '|' + (x.getAttribute('onclick') || '').slice(0, 30)));
  console.log('mark-like buttons:', markBtn);
  // Q1: answer then "Mark & Next" (answered + marked)
  const c0 = await p.evaluate(() => roundQ[0].correct); await p.click('#o' + c0); await p.waitForTimeout(400); await p.click('button[onclick="qzReviewNext()"]'); await p.waitForTimeout(250);
  ok('Mark & Next moved on to Q2 and recorded the answer + mark', await p.evaluate(() => qi === 1 && qUserAns[0] === roundQ[0].correct && /mark|review/i.test(String(qStatus[0]))), await p.evaluate(() => 'qi=' + qi + ' st0=' + qStatus[0]));
  // jump with the palette to Q10 (index 9), answer wrong, then continue by Save & Next until the end
  const jump = await p.evaluate(() => typeof palJumpTo === 'function' ? 'palJumpTo' : (typeof palGoTo === 'function' ? 'palGoTo' : 'none')); console.log('palette jump fn:', jump);
  await p.evaluate(j => window[j](9), jump); await p.waitForTimeout(300);
  ok('palette jump lands on Q10', await p.evaluate(() => qi === 9), await p.evaluate(() => 'qi=' + qi));
  // answer: Q2..Q22 right except every 4th wrong, leave Q23-Q30 unanswered
  for (let i = 1; i < 30; i++) {
    await p.evaluate(([j, i]) => window[j](i), [jump, i]); await p.waitForTimeout(80);
    if (i >= 22) continue;                                        // 8 unanswered
    const c = await p.evaluate(() => roundQ[qi].correct); const pick = (i % 4 === 0) ? (c + 1) % 4 : c;
    await p.click('#o' + pick); await p.waitForTimeout(330);       // let the 280 ms lock fire
  }
  const tally = await p.evaluate(() => { let a = 0, w = 0, u = 0; roundQ.forEach((q, i) => { if (qUserAns[i] === undefined || qUserAns[i] === null || qUserAns[i] < 0) u++; else if (qUserAns[i] === q.correct) a++; else w++; }); return { right: a, wrong: w, skipped: u }; });
  console.log('tally', JSON.stringify(tally));
  await p.screenshot({ path: 'out/e2e_neet_palette.png' });
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(500);
  console.log('submit dialog:', await p.evaluate(() => [...document.querySelectorAll('.modal-ov,[id$=-ov]')].filter(x => x.offsetParent && !x.classList.contains('hidden')).map(x => x.id + ' :: ' + x.innerText.replace(/\s+/g, ' ').slice(0, 240)).join(' // ')));
  await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1800);
  const vis = await L.visible(p); const rt = await p.evaluate(id => document.getElementById(id).innerText.replace(/\s+/g, ' ').slice(0, 700), vis[0]); console.log(vis, rt);
  const expectScore = tally.right * 4 - tally.wrong;
  ok('result score = +4/−1 of what was answered', new RegExp(expectScore + '\\s*Score').test(rt) || rt.includes(String(expectScore)), 'expected ' + expectScore);
  ok('headline counts: right · wrong · skipped match the answers given', rt.includes(tally.right + ' correct · ' + tally.wrong + ' wrong · ' + tally.skipped + ' skipped'), rt.slice(0, 70));
  await p.screenshot({ path: 'out/e2e_neet_result.png' });
  // Tests tab
  await p.evaluate(() => navTo('tests')); await p.waitForTimeout(500);
  const tt = await p.evaluate(() => document.getElementById('stests').innerText.replace(/\s+/g, ' ').slice(0, 300)); console.log(tt);
  ok('Tests › NEET PG lists the mock as done', /1 Total/.test(tt) && /1 Done/.test(tt));
  ok('session saved with NEET label and type mock', await p.evaluate(() => sessions.length === 1 && sessions[0].deck === 'NEET PG Mock' && sessions[0].type === 'mock'), await p.evaluate(() => JSON.stringify(sessions[0])));
  // detail
  const tid = await p.evaluate(() => (document.querySelector('#stests [onclick*="viewTestDetail"]').getAttribute('onclick').match(/viewTestDetail\('([^']+)'/) || [])[1]);
  await p.evaluate(id => viewTestDetail(id), tid); await p.waitForTimeout(700);
  const dv = await L.visible(p); const dt = await p.evaluate(id => document.getElementById(id).innerText.replace(/\s+/g, ' ').slice(0, 500), dv[0]); console.log(dv, dt);
  ok('test detail opens and shows the score', dv[0] !== 'stests' && /57%|17\/30|63/.test(dt), dv.join(','));
  await p.screenshot({ path: 'out/e2e_test_detail.png' });
  console.log('detail buttons:', await p.evaluate(id => [...document.querySelectorAll('#' + id + ' button, #' + id + ' [onclick]')].filter(x => x.offsetParent).map(x => x.textContent.trim().replace(/\s+/g, ' ').slice(0, 20) + '|' + (x.getAttribute('onclick') || '').slice(0, 36)), dv[0]));
  // retry from previous test
  const rr = await p.evaluate(async id => { try { const r = await retryTest(id); return 'returned ' + r + ' | neet-ov hidden=' + document.getElementById('neet-ov').classList.contains('hidden') + ' | toasts=' + [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' / '); } catch (e) { return 'THREW ' + e.message; } }, tid);
  console.log('retryTest ->', rr);
  await p.waitForTimeout(600);
  ok('Retry on a finished NEET test reopens the NEET sheet with its subjects', await p.evaluate(() => !document.getElementById('neet-ov').classList.contains('hidden')));
  ok('and remembers it should repeat the same questions', await p.evaluate(() => testQSource === 'previous' && !!sourceTestId));
  await p.screenshot({ path: 'out/e2e_retry_state.png' });
  const origSids = await p.evaluate(() => roundQ.map(q => q.sid).sort().join(','));
  await p.evaluate(() => { [...document.querySelectorAll('#neet-ov button')].find(x => /Proceed to Instructions/.test(x.textContent)).click(); }); await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('nbr-agree-chk').click()); await p.waitForTimeout(200);
  await p.click('#neet-brief-start-btn'); await p.waitForTimeout(700);
  const srcSel = await p.evaluate(() => [...document.querySelectorAll('.sheet-modal [onclick*="pickQSource"], .sheet-modal .on, .qsrc-opt.on')].map(x => (x.getAttribute('onclick') || x.className) + ' :: ' + x.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)).join(' | '));
  console.log('source sheet selection:', srcSel, '| testQSource =', await p.evaluate(() => testQSource));
  await p.screenshot({ path: 'out/e2e_retry_source.png' });
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(2500);
  const newSids = await p.evaluate(() => roundQ.map(q => q.sid).sort().join(','));
  ok('Retry starts a new attempt on the SAME 30 questions', (await L.visible(p))[0] === 'sq' && newSids === origSids, (await L.visible(p)).join(',') + ' same=' + (newSids === origSids));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
