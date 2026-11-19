// Day boundaries follow the local calendar (India: 01:30 IST on 13 Nov is still 13 Nov, not 12 Nov).
const L = require('./lib');
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };
(async () => {
  const { b, p, errs } = await L.boot({ tz: 'Asia/Calcutta', time: Date.UTC(2026, 10, 12, 20, 0, 0), file: process.argv[2] });   // = 2026-11-13 01:30 IST
  console.log('local now', await p.evaluate(() => new Date().toString().slice(0, 33)), '| UTC', await p.evaluate(() => new Date().toISOString()));
  ok('dateKey() is the local date', await p.evaluate(() => dateKey()) === '2026-11-13', await p.evaluate(() => dateKey()));
  await L.importCsv(p); await L.quiz(p);
  const d = await p.evaluate(() => (typeof sessions !== 'undefined' ? sessions.map(s => s.date) : null));
  ok('the session is stored under the local date', d && d[0] === '2026-11-13', JSON.stringify(d));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(900);
  const home = await p.evaluate(() => document.getElementById('shome').innerText.replace(/\s+/g, ' '));
  ok('Home counts the 12 questions as today', /12 Today/.test(home), (home.match(/\d+ Today/) || [])[0]);
  ok('no "missed yesterday" streak-freeze on day one', !/missed yesterday/.test(home));
  console.log('FAILS', fails, errs.slice(0, 3)); await b.close(); process.exitCode = fails ? 1 : 0;
})();
