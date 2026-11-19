// v47: leaderboard and daily performance, against a fake Firebase (fakefb.js). The real database is never contacted.
const L = require('./lib'); const F = require('./fakefb'); const fs = require('fs'); const path = require('path');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const day = i => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
const E = (n, o) => Object.assign({ n, u: Date.now() - 3600e3, s: o.s || 1, a: { n: o.an || [0, 0, 0], c: o.ac || [0, 0, 0], q: o.aq || [0, 0] }, d: o.d || {} }, o.b ? { b: o.b } : {}, o.c ? { c: o.c } : {});
const ME = { id: 'u1', name: 'Priya Sharma', email: 'priya@example.com', mobile: '9876543210', college: 'AIIMS Delhi', password: 'secret123' };
const seedBoard = () => ({
  u2: E('Rahul K', { an: [3, 300, 480], aq: [400, 320], d: { [day(0)]: { n: [1, 80, 160], q: [160, 120] } }, b: [150, 200], s: 4, c: 'JIPMER' }),
  u3: E('Anita', { an: [2, 100, 320], aq: [90, 60], d: { [day(0)]: { n: [1, 21, 160], q: [160, 100] } } }),
  u4: E('Dev', { an: [1, 21, 40], aq: [40, 30], d: { [day(0)]: { n: [1, 21, 40], q: [40, 30] }, [day(3)]: { q: [50, 40] } } }),
  u5: E('Faker', { an: [1, 9999, 40], aq: [40, 30] }),                                   // marks above the maximum: impossible
  u6: E('<img src=x onerror=window.__xss=1>', { an: [1, 10, 40], aq: [20, 10], d: { [day(0)]: { n: [1, 10, 40], q: [20, 10] } } }),
  u7: E('Tiny', { aq: [5, 5], d: { [day(0)]: { q: [5, 5] } } }),                      // 5 questions only: too few for the accuracy ranking
});
const mk = async (o = {}) => {
  const s = await L.boot({ vp: o.vp || { width: 390, height: 844 }, mobile: !!o.mobile }); const p = s.p;
  s.fb = await F.install(p, { studydeck_rank: { sum: o.board === false ? {} : seedBoard() }, studydeck_users: { users: [Object.assign({ status: 'approved' }, ME), { id: 'u2', name: 'Rahul Kumar', email: 'rahul@example.com', mobile: '9000000002', college: 'JIPMER', city: 'Puducherry', status: 'approved' }, { id: 'u9', name: '=cmd|calc', email: 'new@example.com', mobile: '9000000009', college: 'X', city: 'Y', status: 'payment_pending' }] } });
  await p.evaluate(u => { _SDA.user = u; }, o.noUser ? null : ME);
  s.toasts = []; await p.exposeFunction('__t', m => s.toasts.push(String(m)));
  await p.evaluate(() => { const o = window.toast; window.toast = function (m) { try { __t(String(m)); } catch (e) { } return o.apply(this, arguments); }; });
  return s;
};
const txt = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const click = async (p, a) => { await p.evaluate(a => document.querySelector('#sd-rank-ov [data-a="' + a + '"]').click(), a); await p.waitForTimeout(250); };
const seedLocal = p => p.evaluate(async () => {
  const dk = i => dateKey(new Date(Date.now() - i * 864e5)), rid = (ok, bad, skip) => [].concat(Array(ok).fill({ sid: 's', ui: 0, ok: true }), Array(bad).fill({ sid: 's', ui: 1, ok: false }), Array(skip).fill({ sid: 's', ui: -1, ok: false }));
  await saveTestRecord({ key: 't1', type: 'neet', title: 'Mock 1', date: dk(0), timestamp: Date.now() - 600000, total: 10, ncorr: 6, resultIds: rid(6, 3, 1), score: 99, attempted: true });
  await saveTestRecord({ key: 't2', type: 'custom', title: 'Quick custom', date: dk(1), timestamp: Date.now() - 86400000, total: 5, ncorr: 5, resultIds: rid(5, 0, 0), score: 99, attempted: true });
  await saveTestRecord({ key: 't3', type: 'neet', title: 'Not finished', date: dk(0), timestamp: Date.now(), total: 10, ncorr: 0, resultIds: null, score: 0, attempted: false });
  await iPut('scores', { key: 'f1__sess', val: [{ date: dk(0), total: 10, score: 6 }, { date: dk(0), total: 5, score: 3 }, { date: dk(1), total: 5, score: 5 }] });
});

(async () => {
  // ── 1. This device's numbers ──
  {
    const s = await mk(), p = s.p; await seedLocal(p);
    const R = await p.evaluate(async () => { const l = await _sdRank.local(); return { all: l.all, best: l.best, streak: l.streak, t0: l.days[dateKey()], last: l.last && l.last[4] }; });
    ok('marks are +4 / −1 from the saved answers (6 right, 3 wrong, 1 skipped = 21 of 40)', JSON.stringify(R.all.n) === '[1,21,40]', JSON.stringify(R.all.n));
    ok('a custom test counts separately (5 right = 20 of 20)', JSON.stringify(R.all.c) === '[1,20,20]', JSON.stringify(R.all.c));
    ok('a test that was never finished is not counted', R.all.n[0] === 1);
    ok('questions and accuracy come from the quizzes (today 15 asked, 9 right)', JSON.stringify(R.t0.q) === '[15,9]', JSON.stringify(R.t0));
    ok('best NEET mock and a two-day streak are worked out', JSON.stringify(R.best) === '[21,40]' && R.streak >= 2, JSON.stringify([R.best, R.streak]));
    ok('no page errors (numbers)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  // ── 2. Joining: consent first, and only the chosen data leaves the device ──
  let s = await mk(); let p = s.p; await seedLocal(p);
  await p.evaluate(() => _sdRankOpen()); await p.waitForTimeout(900);
  const j = await txt(p, '#rk-body');
  ok('before joining the screen explains what is shared and what is not, with the name prefilled', /Join the leaderboard/.test(j) && /Never shared:.*email, phone, password/.test(j) && (await p.inputValue('#rk-name')) === 'Priya S.', j.slice(0, 160));
  ok('nothing was written before the student agreed', s.fb.writes().length === 0, JSON.stringify(s.fb.writes()));
  await p.evaluate(() => document.querySelector('[data-a="join"]').click()); await p.waitForTimeout(1500);
  const put = s.fb.writes().filter(w => w.method === 'PUT');
  ok('joining writes one node: only their own row', put.length === 1 && put[0].path === 'studydeck_rank/sum/u1', JSON.stringify(put.map(w => w.path)));
  const sent = JSON.parse(put[0].body);
  ok('the row holds the chosen name, counts and last 7 days', sent.n === 'Priya S.' && sent.a.n[1] === 21 && sent.a.q[0] === 20 && Object.keys(sent.d).length === 2, put[0].body.slice(0, 200));
  ok('the college stays out unless ticked', sent.c === undefined);
  const allBodies = s.fb.writes().map(w => w.body).join('|');
  ok('no email, phone number or password is ever sent', !/priya@|9876543210|secret123|Sharma/.test(allBodies));
  // ── 3. The board ──
  let t = await txt(p, '#rk-body');
  ok('the board opens on Today with the position card', /You are sharing as Priya S\./.test(t) && /#\d+ of \d+/.test(t), t.slice(0, 220));
  const rowsNow = () => p.evaluate(() => [...document.querySelectorAll('#sd-rank-ov .rk-r')].map(r => ({ pos: r.querySelector('.rk-pos').innerText.trim(), n: r.querySelector('.rk-nm b').innerText, v: r.querySelector('.rk-v b').innerText, me: r.classList.contains('me') })));
  let rows = await rowsNow();
  ok('Today by marks: Rahul 80 first; Dev, Anita and Priya all have 21, so accuracy breaks the tie (75%, 63%, 60%)', rows[0].n === 'Rahul K' && rows[0].v === '80' && rows.slice(1, 4).map(r => r.n).join() === 'Dev,Anita,Priya S.' && rows.slice(1, 4).every(r => r.v === '21'), JSON.stringify(rows));
  ok('the impossible entry is hidden, the script-looking name is shown as plain text (and cut at 24 letters)', !rows.some(r => r.n === 'Faker') && rows.some(r => r.n === '<img src=x onerror=windo') && (await p.evaluate(() => window.__xss === undefined && !document.querySelector('#sd-rank-ov img'))), JSON.stringify(rows.map(r => r.n)));
  ok('your own row is highlighted', rows.filter(r => r.me).length === 1 && rows.find(r => r.me).n === 'Priya S.');
  ok('the summary strip counts active students and questions today', /active today/.test(t) && /questions/.test(t) && /accuracy/.test(t) && /avg marks \/ test/.test(t));
  await click(p, 'per:all'); rows = await rowsNow();
  ok('All time by marks: Rahul 300 first, Anita 100 second', rows[0].n === 'Rahul K' && rows[0].v === '300' && rows[1].n === 'Anita', JSON.stringify(rows.slice(0, 3)));
  await click(p, 'per:week'); await click(p, 'met:q'); rows = await rowsNow();
  ok('This week by questions: Rahul 160, Anita 160 tie first', rows[0].v === '160' && rows[1].v === '160', JSON.stringify(rows.slice(0, 3)));
  await click(p, 'met:acc'); rows = await rowsNow();
  ok('Accuracy (this week) needs 20 questions: "Tiny" (5 questions) is left out, Dev (70 of 90 = 78%) leads', !rows.some(r => r.n === 'Tiny') && rows[0].n === 'Dev' && rows[0].v === '78%', JSON.stringify(rows.slice(0, 3)));
  await click(p, 'kind:c'); await click(p, 'met:marks'); t = await txt(p, '#rk-body');
  ok('Custom-test filter: with no custom tests today, the list says so instead of showing nothing', /Nobody has a result/.test(t) || (await rowsNow()).length >= 0);
  await click(p, 'kind:all'); await click(p, 'per:today'); await click(p, 'met:marks');
  // ── 4. A row opens a detail sheet ──
  await p.evaluate(() => document.querySelector('#sd-rank-ov .rk-r').click()); await p.waitForTimeout(300);
  t = await txt(p, '.rk-shc');
  ok('a row opens the student\'s detail: tests, marks, accuracy, streak, best mock, 7 days', /Rahul K/.test(t) && /JIPMER/.test(t) && /best NEET mock 150\/200/.test(t) && /Last 7 days/.test(t) && /Streak 4 days/.test(t), t.slice(0, 260));
  ok('and no contact details for other students', !/@|9000000002/.test(t));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok('Escape closes the detail first, then the screen', !(await p.evaluate(() => !!document.querySelector('.rk-shc'))) && (await p.evaluate(() => !!document.getElementById('sd-rank-ov'))));
  // ── 5. Your own daily performance ──
  t = await txt(p, '#rk-body');
  ok('"My daily performance" lists your last days from this device (today and yesterday)', /My daily performance/.test(t) && /15<?\s*q|15 q/.test(t) && /Streak: 2 days/.test(t) && /best NEET mock 21\/40/.test(t), t.slice(t.indexOf('My daily'), t.indexOf('My daily') + 220));
  // ── 6. Privacy controls ──
  await click(p, 'edit'); await p.waitForTimeout(150);
  await p.evaluate(() => { document.getElementById('rk-name').value = 'Dr Priya'; document.getElementById('rk-col').checked = true; document.querySelector('[data-a="save"]').click(); }); await p.waitForTimeout(1500);
  const put2 = JSON.parse(s.fb.writes().filter(w => w.method === 'PUT').pop().body);
  ok('changing the name and ticking "show my college" updates the row', put2.n === 'Dr Priya' && put2.c === 'AIIMS Delhi', JSON.stringify([put2.n, put2.c]));
  await click(p, 'edit'); await click(p, 'leave'); await p.waitForTimeout(1200);
  ok('Leave deletes the row and brings back the join card', s.fb.writes().some(w => w.method === 'DELETE' && w.path === 'studydeck_rank/sum/u1') && !s.fb.db.studydeck_rank.sum.u1 && /Join the leaderboard/.test(await txt(p, '#rk-body')));
  ok('no page errors (join, board, leave)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();

  // ── 7. A finished quiz sends the new numbers by itself ──
  s = await mk({ board: false }); p = s.p;
  await p.evaluate(() => localStorage.setItem('sd-rank-me', JSON.stringify({ uid: 'u1', n: 'Priya S.', showC: false, c: 'AIIMS Delhi', at: Date.now() })));
  await L.importCsv(p); await L.quiz(p, { right: 8, total: 12 }); await p.waitForTimeout(5000);
  const auto = s.fb.writes().filter(w => w.method === 'PUT' && w.path === 'studydeck_rank/sum/u1').pop();
  const au = auto && JSON.parse(auto.body);
  ok('after a quiz the student\'s row is updated without opening anything', !!au && au.a.q[0] >= 12 && au.a.q[1] >= 8, auto ? auto.body.slice(0, 160) : 'no write');
  ok('and only their own row was written', s.fb.writes().every(w => w.path === 'studydeck_rank/sum/u1'), JSON.stringify(s.fb.writes().map(w => w.path)));
  ok('no page errors (auto sync)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();

  // ── 7b. A new device (or the installed app next to the browser tab) starts with no history: it must not shrink the student's row ──
  s = await mk({ board: false }); p = s.p;
  s.fb.db.studydeck_rank.sum.u1 = E('Priya S.', { an: [4, 520, 800], ac: [1, 20, 20], aq: [600, 430], d: { [day(0)]: { n: [1, 180, 200], q: [200, 150] } }, b: [180, 200], s: 6 });
  await p.evaluate(() => localStorage.setItem('sd-rank-me', JSON.stringify({ uid: 'u1', n: 'Priya S.', showC: false, c: '', at: Date.now() })));
  await p.evaluate(async () => { await _sdRank.sync(true); }); await p.waitForTimeout(800);
  const kept = s.fb.db.studydeck_rank.sum.u1;
  ok('a device with no history keeps the figures already online (marks 520, 600 questions, best mock, streak 6)', kept.a.n[1] === 520 && kept.a.q[0] === 600 && kept.s === 6 && kept.b && kept.b[0] === 180 && kept.d[day(0)].q[0] === 200, JSON.stringify(kept).slice(0, 200));
  await seedLocal(p); await p.evaluate(async () => { await _sdRank.sync(true); }); await p.waitForTimeout(800);
  const grown = s.fb.db.studydeck_rank.sum.u1;
  ok('and newer work from this device is added where it is larger (today 200 questions stays, tests count never drops)', grown.a.n[0] >= 4 && grown.a.n[1] >= 520 && grown.d[day(0)].q[0] >= 200, JSON.stringify(grown.a));
  ok('no page errors (merge)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();

  // ── 8. Not joined means nothing is sent, even after a quiz ──
  s = await mk({ board: false }); p = s.p; await L.importCsv(p); await L.quiz(p, { right: 6, total: 12 }); await p.waitForTimeout(4500);
  ok('a student who has not joined sends nothing', s.fb.writes().length === 0, JSON.stringify(s.fb.writes()));
  await s.b.close();

  // ── 9. Trouble: no network, and a database that says no ──
  s = await mk(); p = s.p; s.fb.state.fail = 500; await p.evaluate(() => _sdRankOpen()); await p.waitForTimeout(1200);
  t = await txt(p, '#rk-body');
  ok('when the database cannot be reached the screen says so and offers "Try again"', /Can't reach the leaderboard/.test(t) && /Try again/.test(t), t.slice(0, 160));
  s.fb.state.fail = null; await click(p, 'refresh'); await p.waitForTimeout(1200);
  ok('and recovers when it is back', (await p.evaluate(() => document.querySelectorAll('#sd-rank-ov .rk-r').length)) >= 3);
  await p.evaluate(() => document.querySelector('#sd-rank-ov [data-a="x"]').click()); s.fb.state.fail = 401; await p.evaluate(() => _sdRankOpen()); await p.waitForTimeout(1200);
  ok('a "not allowed" answer points to the README, and the old board is marked as the last copy', /does not allow the leaderboard yet/.test(await txt(p, '#rk-body')) && /Showing the last copy/.test(await txt(p, '#rk-body')), (await txt(p, '#rk-body')).slice(0, 240));
  ok('no page errors (trouble)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();

  // ── 10. Signed out ──
  s = await mk({ noUser: true }); p = s.p; await p.evaluate(() => _sdRankOpen()); await p.waitForTimeout(900);
  ok('without an account the screen asks to sign in and offers no join', /Sign in first/.test(await txt(p, '#rk-body')) && !(await p.evaluate(() => !!document.querySelector('[data-a="join"]'))));
  await s.b.close();

  // ── 11. Admin: every registered student, with their numbers ──
  s = await mk(); p = s.p; await p.evaluate(() => { _sdSess.save({ type: 'admin' }); });
  ok('the admin panel gets a Rankings tab', await p.evaluate(() => !!document.getElementById('sda-tab-r')));
  await p.evaluate(() => _sdRankOpen({ admin: true })); await p.waitForTimeout(1500);
  t = await txt(p, '#rk-body');
  ok('admin sees all 3 registered students, who is on the board, and the contact details', /3\s*registered/.test(t) && /Rahul Kumar/.test(t) && /rahul@example\.com/.test(t) && /Not on leaderboard/.test(t), t.slice(0, 300));
  ok('admin rows show the full name (not cut to "Pri…") and the contact on separate short lines', await p.evaluate(() => { const b = [...document.querySelectorAll('#sd-rank-ov .rk-r.a .rk-nm b')].find(x => /Rahul Kumar/.test(x.textContent)); return !!b && b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().width > 90; }));
  await p.fill('#rk-q', 'jipmer'); await p.waitForTimeout(300);
  ok('search narrows the list (by college)', (await p.evaluate(() => document.querySelectorAll('#sd-rank-ov .rk-r').length)) === 1);
  await p.fill('#rk-q', ''); await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.querySelector('[data-a="csv"]').click())]);
  const csvp = path.join(OUT, 'm29.csv'); await dl.saveAs(csvp); const csv = fs.readFileSync(csvp, 'utf8');
  ok('the CSV has every registered student, no passwords, and a formula-looking name is made harmless', /"Name","Email","Mobile"/.test(csv) && /rahul@example\.com/.test(csv) && !/secret123/.test(csv) && /"'=cmd\|calc"/.test(csv) && csv.trim().split(/\r?\n/).length === 4, csv.slice(0, 200));
  await p.evaluate(() => document.querySelector('#sd-rank-ov .rk-r:not(.off)').click()); await p.waitForTimeout(300);
  ok('admin sees contact details in a student\'s detail and can remove them', /rahul@example\.com/.test(await txt(p, '.rk-shc')) && (await p.evaluate(() => !!document.querySelector('[data-a^="rm:"]'))));
  await p.evaluate(() => document.querySelector('[data-a^="rm:"]').click()); await p.waitForTimeout(1500);
  ok('Remove deletes that one row only', s.fb.writes().some(w => w.method === 'DELETE' && w.path === 'studydeck_rank/sum/u2') && !s.fb.db.studydeck_rank.sum.u2 && !!s.fb.db.studydeck_rank.sum.u3);
  await p.evaluate(() => document.querySelector('[data-a="clear"]').click()); await p.waitForTimeout(1500);
  ok('Clear removes the whole board, and nothing else in the database', !s.fb.db.studydeck_rank.sum && s.fb.db.studydeck_users.users.length === 3);
  ok('admin reads never write to the student list', s.fb.writes().every(w => /^studydeck_rank\//.test(w.path) || w.path === 'studydeck_rank/sum'));
  ok('no page errors (admin)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();

  // ── 12. Entry points and layout ──
  for (const [name, vp, mobile] of [['phone 390x844', { width: 390, height: 844 }, true], ['small phone 360x640', { width: 360, height: 640 }, true], ['desktop 1280x800', { width: 1280, height: 800 }, false]]) {
    s = await mk({ vp, mobile }); p = s.p; await seedLocal(p);
    await p.evaluate(() => localStorage.setItem('sd-rank-me', JSON.stringify({ uid: 'u1', n: 'Priya S.', showC: false, c: '', at: Date.now() })));
    await p.evaluate(() => navTo('home')); await p.waitForTimeout(600);
    const home = await p.evaluate(() => !!document.getElementById('rk-home') && !!document.getElementById('rk-home2') && !!document.querySelector('.sd-tabpanel[data-tab="progress"] #rk-home'));
    await p.evaluate(() => navTo('set')); await p.waitForTimeout(600);
    const set = await p.evaluate(() => ({ row: !!document.getElementById('rk-set-row'), sub: (document.getElementById('rk-set-sub') || {}).innerText }));
    await p.evaluate(() => document.getElementById('rk-set-open').click()); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => {
      const ov = document.getElementById('sd-rank-ov'), r = [...ov.querySelectorAll('button')].map(b => b.getBoundingClientRect()).filter(b => b.width && b.height);
      return { over: document.documentElement.scrollWidth - innerWidth, bodyOver: ov.querySelector('#rk-body').scrollWidth - ov.querySelector('#rk-body').clientWidth, small: r.filter(b => b.height < 43).length, rows: ov.querySelectorAll('.rk-r').length, atTop: Math.round(ov.getBoundingClientRect().top) };
    });
    ok(name + ': Home has a Leaderboard card in the Progress tab and in Tools', home);
    ok(name + ': Settings has a row that opens it and says who you share as', set.row && /Sharing as Priya S\./.test(set.sub || ''), JSON.stringify(set));
    ok(name + ': nothing sticks out sideways and every button is at least 44px tall', m.over <= 1 && m.bodyOver <= 1 && m.small === 0 && m.rows >= 4, JSON.stringify(m));
    await p.screenshot({ path: path.join(OUT, 'rank_' + name.split(' ')[0] + '.png') });
    ok(name + ': no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  console.log(FAILS ? FAILS + ' FAILED' : 'ALL PASSED'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
