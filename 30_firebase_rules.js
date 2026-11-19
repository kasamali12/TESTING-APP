// v47: firebase/database.rules.json against what the app really writes. The rules are run by rules_eval.js (a stand-in for Google's engine, not the engine itself).
const L = require('./lib'); const F = require('./fakefb'); const R = require('./rules_eval'); const fs = require('fs'); const path = require('path');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase/database.rules.json'), 'utf8')), E = R.engine(rules);

(async () => {
  // ── a real row, written by the app itself ──
  const s = await L.boot({ vp: { width: 390, height: 844 } }), p = s.p; const fb = await F.install(p, { studydeck_rank: { sum: {} } });
  await p.evaluate(() => { _SDA.user = { id: 'u1', name: 'Priya Sharma', college: 'AIIMS' }; localStorage.setItem('sd-rank-me', JSON.stringify({ uid: 'u1', n: 'Priya S.', showC: true, c: 'AIIMS', at: Date.now() })); });
  await p.evaluate(async () => {
    const dk = i => dateKey(new Date(Date.now() - i * 864e5)), rid = (ok, bad, skip) => [].concat(Array(ok).fill({ ui: 0, ok: true }), Array(bad).fill({ ui: 1, ok: false }), Array(skip).fill({ ui: -1, ok: false }));
    await saveTestRecord({ key: 't1', type: 'neet', title: 'Mock 1', date: dk(0), timestamp: Date.now() - 600000, total: 10, ncorr: 6, resultIds: rid(6, 3, 1), score: 99, attempted: true });
    await saveTestRecord({ key: 't2', type: 'custom', title: 'Quick custom', date: dk(1), timestamp: Date.now() - 86400000, total: 5, ncorr: 5, resultIds: rid(5, 0, 0), score: 99, attempted: true });
    await iPut('scores', { key: 'f1__sess', val: [{ date: dk(0), total: 10, score: 6 }, { date: dk(1), total: 5, score: 5 }] });
    await _sdRank.sync(true);
  });
  const real = JSON.parse(fb.writes().filter(w => w.method === 'PUT').pop().body); await s.b.close();
  const db = { studydeck_users: { users: [{ id: 1 }] }, studydeck_settings: { upiId: 'x@y', amount: 1 }, studydeck_rank: { sum: {} } };
  const W = (v, id = 'u1') => E.write(db, 'studydeck_rank/sum/' + id, v), mut = f => { const c = JSON.parse(JSON.stringify(real)); f(c); return c; };
  const day = Object.keys(real.d)[0];

  ok('the rules accept the row the app really writes (name, college, totals, last days, best mock, last test)', W(real).ok, JSON.stringify(W(real)));
  ok('a row with no recent days and no best mock (new student) is accepted', W({ n: 'New', u: Date.now(), s: 0, a: { n: [0, 0, 0], c: [0, 0, 0], q: [0, 0] } }).ok);
  ok('deleting your own row is allowed ("Leave"), and so is clearing the whole board (admin)', E.write(db, 'studydeck_rank/sum/u1', null).ok && E.write(db, 'studydeck_rank/sum', null).ok);
  ok('writing anything else under studydeck_rank is refused', !E.write(db, 'studydeck_rank/other', { a: 1 }).ok && !E.write(db, 'studydeck_rank/sum', { u1: real }).ok);
  ok('the board can be read, the rest of studydeck_rank and the root cannot', E.canRead(db, 'studydeck_rank/sum') && E.canRead(db, 'studydeck_rank/sum/u1') && !E.canRead(db, 'studydeck_rank') && !E.canRead(db, ''));
  // ── made-up or damaged rows are refused ──
  const bad = {
    'marks above the maximum': mut(c => { c.a.n[1] = c.a.n[2] + 1; }), 'marks below minus a quarter of the maximum': mut(c => { c.a.n[1] = -c.a.n[2]; }),
    'more right answers than questions': mut(c => { c.a.q[1] = c.a.q[0] + 1; }), 'negative questions': mut(c => { c.a.q[0] = -1; }),
    'a name of 41 letters': mut(c => { c.n = 'x'.repeat(41); }), 'an empty name': mut(c => { c.n = ''; }), 'a number for a name': mut(c => { c.n = 5; }),
    'an extra field': mut(c => { c.zzz = 1; }), 'a day written without its date format': mut(c => { c.d['2026-1-5'] = c.d[day]; }),
    'a last-active time a day in the future': mut(c => { c.u = Date.now() + 864e5; }), 'a test list with two numbers instead of three': mut(c => { c.a.n = [1, 2]; }),
    'a last test of an unknown kind': mut(c => { c.l[1] = 'x'; }), 'a streak of 6000 days': mut(c => { c.s = 6000; }),
    '5000 questions in one day': mut(c => { c.d[day].q = [5000, 100]; }), '200 tests in one day': mut(c => { c.d[day].n = [200, 0, 0]; }),
    'a test that holds 3000 marks': mut(c => { c.a.n = [1, 100, 3000]; }), 'a best mock above 4000 marks': mut(c => { c.b = [5000, 5000]; }),
    'a missing totals block': mut(c => { delete c.a; }), 'a title of 31 letters': mut(c => { c.l[4] = 'y'.repeat(31); }),
  };
  Object.keys(bad).forEach(k => { const r = W(bad[k]); ok('refused: ' + k, !r.ok, r.why); });
  ok('a negative score down to minus a quarter of the maximum is still accepted (4 wrong of 10 = −4 of 40)', W(mut(c => { c.a.n = [1, -10, 40]; })).ok);
  // ── the two nodes that were already there behave as before ──
  ok('sign-up list: still readable, still refuses a write that has no users list', E.canRead(db, 'studydeck_users') && !E.write(db, 'studydeck_users', { other: 1 }).ok && E.write(db, 'studydeck_users', { users: [{ id: 1 }] }).ok);
  ok('payment settings: still need a UPI id and an amount', !E.write(db, 'studydeck_settings', { note: 'x' }).ok && E.write(db, 'studydeck_settings', { upiId: 'a@b', amount: 5 }).ok);
  ok('everything else in the project stays closed', !E.write(db, 'something_else', { a: 1 }).ok && !E.canRead(db, 'something_else'));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; '));
  console.log(FAILS ? FAILS + ' FAILED' : 'ALL PASSED'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
