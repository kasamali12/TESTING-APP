// v43: exam layout, instructions, settings rows, floating cards, quiz leftovers, first run, honest score projection
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const VP = { width: 390, height: 844 };
const nextQ = async p => { await p.click('#qzb-save'); await p.waitForTimeout(150); };

async function startPractice(p) {
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300);
  await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Quiz/.test(x.textContent)).click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { pickSeg([...document.querySelectorAll('.modal button')].find(x => x.textContent.trim() === 'All' && /count/.test(x.getAttribute('onclick') || '')), 'count', 0); confirmQuiz(); }); await p.waitForTimeout(900);
}

(async () => {
  // ── 1. first run: nothing imported yet ──
  let s = await L.boot({ vp: VP, mobile: true }); let p = s.p;
  await p.waitForTimeout(600);
  let t = await p.evaluate(() => { const w = document.getElementById('daily-plan-wrap'); return { first: !!w.querySelector('.sd-firstrun'), start: /Start Today/.test(w.textContent), txt: w.textContent.replace(/\s+/g, ' ').slice(0, 120) }; });
  ok('no decks: Home asks for questions instead of showing a plan for nothing', t.first && !t.start, t.txt);
  await p.evaluate(() => { [...document.querySelectorAll('#daily-plan-wrap button')].find(x => /blank deck/i.test(x.textContent)).click(); }); await p.waitForTimeout(500);
  ok('"Create blank deck" opens the new-deck dialog', await p.evaluate(() => !!document.querySelector('#ndeck-ov.open')));
  await p.evaluate(() => closeNewDeckModal()); await p.waitForTimeout(400);
  await L.importCsv(p); await p.evaluate(() => navTo('home')); await p.waitForTimeout(900);
  t = await p.evaluate(() => { const w = document.getElementById('daily-plan-wrap'); return { first: !!w.querySelector('.sd-firstrun'), start: /Start Today/.test(w.textContent), warn: (w.textContent.match(/No practice yet[^.]*\.|Only \d+ sessions?[^.]*/) || [''])[0] }; });
  ok('after importing, the plan card is back', !t.first && t.start, JSON.stringify(t));
  ok('with decks but no sessions the warning no longer says "Only 0 sessions"', /No practice yet/.test(t.warn) && !/Only 0/.test(t.warn), t.warn);

  // ── 2. practice quiz: label, undo bar, last-question toast ──
  await startPractice(p);
  ok('practice round ends with "Finish quiz"', /Finish quiz/.test(await p.evaluate(() => document.getElementById('qzb-submit').textContent)));
  const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#sq .quiz-wrap')).paddingTop));
  ok('practice quiz keeps its top offset below the fixed bar', pad >= 56, pad + 'px');
  ok('the keyboard-shortcuts badge is not drawn over the options on a phone', await p.evaluate(() => { const b = document.getElementById('kb-float-btn'); return !b || getComputedStyle(b).display === 'none'; }));
  const n = await p.evaluate(() => roundQ.length);
  for (let i = 0; i < n - 1; i++) { const c = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + c); await p.waitForTimeout(120); await nextQ(p); }
  const cl = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + ((cl + 1) % 4)); await p.waitForTimeout(450);
  ok('wrong tap shows the undo bar', await p.evaluate(() => document.getElementById('undo-answer-bar').classList.contains('show')));
  await nextQ(p);
  ok('"Last question" notice is showing', await p.evaluate(() => [...document.querySelectorAll('.toast')].some(x => /Last question/.test(x.textContent))));
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300);
  ok('opening the submit dialog already clears the undo bar', !(await p.evaluate(() => document.getElementById('undo-answer-bar').classList.contains('show'))));
  await p.evaluate(() => _doSubmit()); await p.waitForTimeout(2000);
  t = await p.evaluate(() => ({ bar: document.getElementById('undo-answer-bar').classList.contains('show'), last: typeof _lastAnswerState === 'undefined' ? 'n/a' : _lastAnswerState, toast: [...document.querySelectorAll('.toast')].some(x => /Last question/.test(x.textContent)), scr: [...document.querySelectorAll('#sd-app-wrapper > div[id^=s]')].filter(e => !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none').map(e => e.id).join() }));
  ok('on the results screen there is no undo bar and no "Last question" notice', !t.bar && !t.toast && t.last === null, JSON.stringify(t));
  const before = await p.evaluate(() => document.getElementById('res-body').textContent.replace(/\s+/g, ' ').slice(0, 60));
  await p.evaluate(() => { try { undoLastAnswer(); } catch (e) {} }); await p.waitForTimeout(300);
  ok('Undo can no longer change a finished quiz', before === await p.evaluate(() => document.getElementById('res-body').textContent.replace(/\s+/g, ' ').slice(0, 60)));
  // leaving mid-quiz also clears it
  await startPractice(p); const c2 = await p.evaluate(() => roundQ[qi].correct); await p.click('#o' + ((c2 + 1) % 4)); await p.waitForTimeout(450);
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(500);
  ok('leaving the question screen clears the undo bar', !(await p.evaluate(() => document.getElementById('undo-answer-bar').classList.contains('show'))));

  // ── 3. the resume card does not float over a sheet ──
  await p.waitForTimeout(3200);
  ok('the resume card shows on Home', await p.evaluate(() => !!document.getElementById('sd-dock')), await p.evaluate(() => (document.getElementById('sd-dock') || {}).textContent));
  await p.evaluate(() => openNeetTest()); await p.waitForTimeout(1800);
  ok('and is gone while the NEET sheet is open', !(await p.evaluate(() => !!document.getElementById('sd-dock'))));
  await p.screenshot({ path: 'out/v43_neet_sheet.png' });

  // ── 4. NEET instructions ──
  await p.evaluate(() => { [...document.querySelectorAll('#neet-ov button')].find(x => x.offsetParent && /Proceed to Instructions/.test(x.textContent)).click(); }); await p.waitForTimeout(800);
  t = await p.evaluate(() => { const box = document.querySelector('.nbr-instructions').getBoundingClientRect(); return [...document.querySelectorAll('.nbr-inst-item')].map(x => { const r = x.getBoundingClientRect(); return { right: Math.round(r.right), box: Math.round(box.right), sw: x.scrollWidth, cw: x.clientWidth }; }); });
  ok('every instruction line fits inside its box (nothing clipped on the right)', t.every(x => x.right <= x.box && x.sw <= x.cw + 1), JSON.stringify(t.filter(x => x.sw > x.cw + 1 || x.right > x.box)));
  await p.evaluate(() => document.querySelectorAll('.nbr-inst-item')[1].scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  await p.screenshot({ path: 'out/v43_instructions.png' });
  await p.evaluate(() => document.getElementById('nbr-agree-chk').click()); await p.waitForTimeout(250); await p.click('#neet-brief-start-btn'); await p.waitForTimeout(700);
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(2500);

  // ── 5. the exam screen ──
  t = await p.evaluate(() => { const g = id => document.getElementById(id).getBoundingClientRect(); const out = {}; out.band = Math.round(document.querySelector('#sq .q-section-bar').getBoundingClientRect().top - g('gtmr-bar').bottom); out.dBottom = Math.round(g('o3').bottom); out.barTop = Math.round(g('qz-actionbar').top); out.label = document.getElementById('qzb-submit').textContent.trim(); out.timerTop = Math.round(g('gtmr-bar').top); return out; });
  ok('no empty band between the timer and the question', t.band >= 0 && t.band <= 24, JSON.stringify(t));
  ok('option D is fully visible above the answer buttons on Q1, without scrolling', t.dBottom <= t.barTop, 'D bottom ' + t.dBottom + ' / buttons top ' + t.barTop);
  ok('a timed test still says "Submit Exam"', /Submit Exam/.test(t.label), t.label);
  await p.screenshot({ path: 'out/v43_exam_q1.png' });
  for (let i = 0; i < 4; i++) { await p.click('#o1'); await p.waitForTimeout(150); await nextQ(p); }
  t = await p.evaluate(() => ({ d: Math.round(document.getElementById('o3').getBoundingClientRect().bottom), bar: Math.round(document.getElementById('qz-actionbar').getBoundingClientRect().top), timer: Math.round(document.getElementById('gtmr-bar').getBoundingClientRect().top), timerShown: document.getElementById('gtmr-bar').getBoundingClientRect().height > 0 }));
  ok('the timer is still in view after moving through questions', t.timerShown && t.timer < 120, JSON.stringify(t));
  await s.b.close();

  // ── 6. settings rows ──
  s = await L.boot({ vp: VP, mobile: true }); p = s.p;
  await p.evaluate(() => navTo('set')); await p.waitForTimeout(600);
  t = await p.evaluate(() => { const rows = [...document.querySelectorAll('#sset .set-row')].filter(r => r.querySelectorAll(':scope > .seg-grp > .seg').length >= 3); return rows.map(r => { const g = r.querySelector(':scope > .seg-grp'), lab = r.firstElementChild, a = lab.getBoundingClientRect(), b = g.getBoundingClientRect(), rr = r.getBoundingClientRect(); return { n: g.children.length, name: lab.textContent.trim().slice(0, 18), stacked: b.top >= a.bottom - 1, full: Math.abs(b.width - (rr.width - 36)) < 6, over: g.scrollWidth > g.clientWidth + 1 || b.right > rr.right + 1, rowsOfButtons: new Set([...g.children].map(x => Math.round(x.getBoundingClientRect().top))).size }; }); });
  const bad = t.filter(x => !x.stacked || !x.full || x.over);
  ok('settings: every row with 3+ choices has the label on top and equal-width choices below', t.length >= 5 && bad.length === 0, bad.length ? JSON.stringify(bad) : t.length + ' rows');
  await p.screenshot({ path: 'out/v43_settings.png' });
  const wrapped = t.filter(x => x.n <= 4 && x.rowsOfButtons !== 1);
  ok('settings: a row with up to four choices keeps them on one line (no lone "XL" or "Pill" underneath)', t.some(x => x.n === 4) && wrapped.length === 0, JSON.stringify(wrapped));
  await s.b.close();

  // ── 7. analytics: no invented score ──
  s = await L.boot({ vp: VP, mobile: true }); p = s.p; await L.importCsv(p);
  await L.quiz(p, { right: 8, total: 12 }); await p.evaluate(() => navTo('ana')); await p.waitForTimeout(700);
  t = await p.evaluate(() => { const txt = document.getElementById('sana') ? document.getElementById('sana').textContent.replace(/\s+/g, ' ') : document.body.textContent; return { gate: /Needs more practice/.test(txt), q: (txt.match(/Questions answered\s*(\d+) \/ (\d+)/) || []).slice(1).join('/'), subj: (txt.match(/Subjects practiced\s*(\d+) \/ (\d+)/) || []).slice(1).join('/'), noScore: !/out of 720/.test(txt) && !/above UR/.test(txt), hist: localStorage.getItem('sd-projected-score-history') }; });
  ok('after one 12-question session: a "needs more practice" card, no score, no cut-off claim', t.gate && t.noScore, JSON.stringify(t));
  ok('the card shows real progress (12 of 100 questions, 1 of 5 subjects)', t.q === '12/100' && t.subj === '1/5', t.q + ' | ' + t.subj);
  ok('nothing was written to the score history', !t.hist || t.hist === '[]', String(t.hist));
  await p.screenshot({ path: 'out/v43_analytics_gate.png' });
  ok('"biggest opportunity" is not claimed from this little data', !(await p.evaluate(() => { navTo('home'); return /biggest opportunity/.test(document.getElementById('shome').textContent); })));
  // enough data: 120 questions over 5 subjects
  await p.evaluate(() => { const ids = NEET_SUBJECTS.slice(0, 5).map(x => x.id); window._loadSubjAcc = () => { const o = {}; ids.forEach((id, i) => o[id] = { history: [{ pct: 60 + i * 5, source: 'practice' }] }); return o; }; sessions.push({ date: dateKey(), deck: 'x', score: 90, total: 120, ms: 1, pct: 75, type: 'practice' }); });
  await p.evaluate(() => navTo('ana')); await p.waitForTimeout(500);
  await p.evaluate(() => navTo('ana')); await p.waitForTimeout(500);
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(200); await p.evaluate(() => navTo('ana')); await p.waitForTimeout(500);
  t = await p.evaluate(() => { const txt = document.getElementById('sana').textContent.replace(/\s+/g, ' '); return { score: /Projected NEET PG Score.*out of 720/.test(txt), note: (txt.match(/(\d+) of (\d+) subjects have no practice yet/) || []).slice(1).join('/'), hist: JSON.parse(localStorage.getItem('sd-projected-score-history') || '[]').length, ready: /Predicted Exam-Ready Date[^.]*(at least 3|needs)/i.test(txt) }; });
  ok('with 120 questions in 5 subjects the projection appears', t.score, JSON.stringify(t));
  ok('it says how many subjects are only assumed (14 of 19)', t.note === '14/19', t.note);
  ok('opening Analytics several times adds one history entry per day, not one per visit', t.hist === 1, 'entries: ' + t.hist);
  ok('so the exam-ready date still waits for real check-ins on 3 different days', t.ready, '');
  ok('no page or console errors', s.errs.length === 0, s.errs.join(' ; '));
  await s.b.close();
  // ── 8. phone turned sideways: the exam header does not peek out from under the top bar ──
  s = await L.boot({ vp: { width: 844, height: 390 }, mobile: true }); p = s.p; await L.importCsv(p);
  await p.evaluate(() => openNeetTest()); await p.waitForTimeout(1500);
  await p.evaluate(() => { [...document.querySelectorAll('#neet-ov button')].find(x => x.offsetParent && /Proceed to Instructions/.test(x.textContent)).click(); }); await p.waitForTimeout(700);
  await p.evaluate(() => document.getElementById('nbr-agree-chk').click()); await p.waitForTimeout(250); await p.click('#neet-brief-start-btn'); await p.waitForTimeout(600);
  await p.evaluate(() => { [...document.querySelectorAll('.sheet-footer button')].find(x => x.offsetParent && /Start Test/.test(x.textContent)).click(); }); await p.waitForTimeout(2300);
  t = await p.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(); return { bar: Math.round(r('.topbar').bottom), hdr: Math.round(r('.neet-exam-hdr').bottom), timerTop: Math.round(r('#gtmr-bar').top), timerH: Math.round(r('#gtmr-bar').height), actTop: Math.round(r('#qz-actionbar').top) }; });
  ok('landscape exam: nothing of the hidden header shows below the top bar', t.hdr <= t.bar, JSON.stringify(t));
  ok('landscape exam: the timer sits right under the top bar and stays in view', t.timerTop - t.bar <= 2 && t.timerH > 20, JSON.stringify(t));
  ok('landscape exam: the question area keeps at least 130 px between the timer and the answer buttons', t.actTop - (t.timerTop + t.timerH) >= 130, (t.actTop - (t.timerTop + t.timerH)) + 'px');
  await s.b.close();
  console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})();
