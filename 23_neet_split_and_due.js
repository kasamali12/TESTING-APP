// v44: one NEET subject split everywhere, Half/Full mock sizes that really apply, honest labels, and the Home "reviews due" chip
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const VP = { width: 390, height: 844 };

(async () => {
  // ── NEET subject split ──
  let s = await L.boot({ vp: VP, mobile: true }); let p = s.p; await L.importCsv(p);
  await p.evaluate(() => openNeetTest()); await p.waitForTimeout(1300);
  let t = await p.evaluate(() => ({
    sameList: NEET_DIST_PRESET.length === NEET_SUBJECTS.length && NEET_DIST_PRESET.every((x, i) => x.id === NEET_SUBJECTS[i].id && x.q === NEET_SUBJECTS[i].q),
    total: NEET_SUBJECTS.reduce((a, x) => a + x.q, 0),
    preview: [...document.querySelectorAll('#neet-dist-preview .ndg-item')].map(e => e.querySelector('.ndg-name').textContent.trim() + ':' + parseInt(e.querySelector('.ndg-q').textContent)),
    grid: neetSubjCfg.map(x => x.name.trim() + ':' + x.qCount), cfg: neetSubjCfg.map(x => ({ n: x.name.trim(), q: x.qCount, avail: x.avail, key: !!x.pathKey })),
    ids: NEET_DIST_PRESET.map(x => x.id)
  }));
  ok('the preview card and the exam grid use one list (same subjects, same counts)', t.sameList, '');
  ok('that list adds up to 180 questions', t.total === 180, String(t.total));
  ok('the preview shows 19 subjects and each count is what the grid will build (when the deck has enough questions)', t.preview.length === 19 && t.cfg.every((c, i) => { const want = parseInt(t.preview[i].split(':')[1]); return c.q === (c.key && c.avail && want > c.avail ? c.avail : want); }), JSON.stringify(t.cfg.filter((c, i) => c.q !== parseInt(t.preview[i].split(':')[1]))));
  await p.evaluate(() => pickNeetType('half')); await p.waitForTimeout(500);
  t = await p.evaluate(() => ({ map: Object.values(window.__sdNeetQ).reduce((a, b) => a + b, 0), min: Math.min(...Object.values(window.__sdNeetQ)), n: Object.keys(window.__sdNeetQ).length, cfg: neetSubjCfg.reduce((a, x) => a + x.qCount, 0), type: neetMockType, tile: document.getElementById('nis-q').textContent }));
  ok('Half Mock gives exactly 90 questions (not 98 from rounding), every subject at least 1', t.map === 90 && t.min >= 1 && t.n === 19, JSON.stringify(t));
  ok('and the exam grid really follows it (it used to stay at the full size)', t.cfg <= 90 && t.cfg >= 60 && /90/.test(t.tile), JSON.stringify(t));
  await p.evaluate(() => pickNeetType('full')); await p.waitForTimeout(400);
  t = await p.evaluate(() => ({ map: Object.values(window.__sdNeetQ).reduce((a, b) => a + b, 0), tile: document.getElementById('nis-q').textContent }));
  ok('switching back to Full gives 180', t.map === 180 && /180/.test(t.tile), JSON.stringify(t));
  await p.evaluate(() => { pickNeetType('half'); window.__sdNeetQ = null; applyNeetDistPreset(); });
  ok('"Apply Preset" on the half mock applies the half split', await p.evaluate(() => Object.values(window.__sdNeetQ).reduce((a, b) => a + b, 0)) === 90);
  await p.evaluate(() => { pickNeetType('half'); });
  t = await p.evaluate(() => { openNeetTest(); return new Promise(r => setTimeout(() => r({ q: window.__sdNeetQ, type: neetMockType }), 900)); });
  ok('opening the sheet again starts from the full mock', t.q === null && t.type === 'full', JSON.stringify(t));
  t = await p.evaluate(() => { const o = document.getElementById('neet-ov').textContent; return { est: /Typical subject split \(estimate\)/.test(o), note: /NBEMS does not publish how many questions come from each subject/.test(o), old: /NBE 2024/.test(o) }; });
  ok('the sheet says the split is an estimate, and no longer claims "NBE 2024 / 2026 distribution"', t.est && t.note && !t.old, JSON.stringify(t));
  ok('the score predictor note does not call the split "real"', !/real NBE 2026 mark distribution/.test(await p.evaluate(() => document.body.innerHTML)));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();

  // ── reviews due ──
  s = await L.boot({ vp: VP, mobile: true }); p = s.p; await L.importCsv(p);
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(900);
  ok('with no flashcards reviewed there is no due chip', !(await p.evaluate(() => !!document.querySelector('.sd-duechip'))));
  const sids = await p.evaluate(async () => { const out = []; for (const n of rootNodes) (await collectQ(n, true)).forEach(q => out.push(q.sid)); return out; });
  ok('the test deck has questions to schedule', sids.length >= 10, String(sids.length));
  await p.evaluate(sd => { const now = Date.now(), o = {}; sd.slice(0, 3).forEach(k => o[k] = { interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: now - 3600e3, lastRating: 3 }); sd.slice(3, 5).forEach(k => o[k] = { interval: 6, easeFactor: 2.5, repetitions: 2, dueDate: now + 5 * 864e5, lastRating: 3 }); localStorage.setItem(SRS_KEY, JSON.stringify(o)); navTo('lib'); navTo('home'); }, sids);
  await p.waitForTimeout(900);
  t = await p.evaluate(() => { const c = document.querySelector('.sd-duechip'); return c ? { txt: c.textContent.replace(/\s+/g, ' ').trim(), top: c === document.getElementById('daily-plan-wrap').firstElementChild, h: Math.round(c.getBoundingClientRect().height), label: c.getAttribute('aria-label') } : null; });
  ok('3 cards past their review date -> the chip says "3 flashcards due" (the 2 not yet due are not counted)', t && /3 flashcards due/.test(t.txt), JSON.stringify(t));
  ok('the chip is the first thing in the plan area, tall enough to tap, and has a spoken label', t && t.top && t.h >= 44 && /3 flashcards are due/.test(t.label), JSON.stringify(t));
  t = await p.evaluate(() => { const out = {}, h = document.documentElement, prev = h.getAttribute('data-radius'); for (const m of ['sharp', 'soft', 'pill']) { h.setAttribute('data-radius', m); out[m] = [getComputedStyle(document.querySelector('.sd-duechip')).borderRadius, getComputedStyle(document.querySelector('.ana-card')).borderRadius]; } prev === null ? h.removeAttribute('data-radius') : h.setAttribute('data-radius', prev); return out; });
  ok('the chip follows the Corner Radius setting exactly like the cards (sharp, soft, pill)', Object.values(t).every(v => v[0] === v[1]) && t.sharp[0] !== t.pill[0], JSON.stringify(t));
  await p.screenshot({ path: 'out/v44_home_due.png' });
  await p.evaluate(() => document.querySelector('.sd-duechip').click()); await p.waitForTimeout(1500);
  t = await p.evaluate(() => ({ screen: getComputedStyle(document.getElementById('sflash')).display, cards: _fcCards.length, label: document.getElementById('fc-deck-label').textContent, sidsDue: _fcCards.every(c => (_loadSRSData()[c.sid] || {}).dueDate <= Date.now()) }));
  ok('tapping it opens flashcards with exactly those 3 cards', t.screen !== 'none' && t.cards === 3 && t.sidsDue && /Due today/.test(t.label), JSON.stringify(t));
  await p.evaluate(() => rateSRS(3)); await p.waitForTimeout(300);
  await p.evaluate(() => { closeFlashcard(); navTo('home'); }); await p.waitForTimeout(900);
  t = await p.evaluate(() => { const c = document.querySelector('.sd-duechip'); return c && c.textContent.replace(/\s+/g, ' ').trim(); });
  ok('after rating one, the chip counts 2', /2 flashcards due/.test(t || ''), t);
  await p.evaluate(() => { const o = _loadSRSData(); o['ghost-1'] = { interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: Date.now() - 1000, lastRating: 3 }; localStorage.setItem(SRS_KEY, JSON.stringify(o)); navTo('lib'); navTo('home'); }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.sd-duechip').click()); await p.waitForTimeout(1500);
  t = await p.evaluate(() => ({ cards: _fcCards.length, toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' | ') }));
  ok('a due card that belongs to another deck is reported, and the cards in this deck still open', t.cards === 2 && /2 due in this deck\. 1 more are in other decks/.test(t.toast), JSON.stringify(t));
  await p.evaluate(() => { localStorage.setItem(SRS_KEY, JSON.stringify({ 'ghost-1': { interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: Date.now() - 1000, lastRating: 3 } })); closeFlashcard(); navTo('home'); }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.sd-duechip').click()); await p.waitForTimeout(1200);
  ok('when none of the due cards are in the open deck it says so instead of opening an empty screen', /another deck/.test(await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' | '))));
  await p.evaluate(() => { localStorage.removeItem(SRS_KEY); navTo('lib'); navTo('home'); }); await p.waitForTimeout(800);
  ok('and the chip is gone once nothing is due', !(await p.evaluate(() => !!document.querySelector('.sd-duechip'))));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})();
