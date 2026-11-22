const { boot } = require('./lib'); const path = require('path'); const fs = require('fs');
(async () => {
  const file = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const read = async (p) => { await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Browse/.test(x.textContent)).click(); }); await p.waitForTimeout(600);
    return p.evaluate(() => (typeof browseQ !== 'undefined' ? browseQ : []).map(x => ({ q: x.q, opts: x.opts, correct: x.correct, exp: x.exp || '' }))); };
  // 1) import the edge file, export it with the app's own CSV export
  let s1 = await boot({ file }); let p = s1.p;
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300);
  await p.setInputFiles('#fi-import', path.resolve('data/edge.csv')); await p.waitForTimeout(2000);
  const a = await read(p);
  await p.evaluate(() => navTo('lib')).catch(() => {}); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.evaluate(() => exportCSV())]);
  const out = path.resolve('data/roundtrip_export.csv'); await dl.saveAs(out);
  await s1.b.close();
  const txt = fs.readFileSync(out, 'utf8'); ok(/line one\r?\nline two\r?\nline three/.test(txt), 'export keeps the line breaks inside the quoted explanation');
  // 2) import the exported file into a fresh app
  let s2 = await boot({ file }); p = s2.p;
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300);
  await p.setInputFiles('#fi-import', out); await p.waitForTimeout(2000);
  const b = await read(p);
  ok(b.length === a.length && a.length === 7, 'same number of questions after round trip (' + a.length + ' -> ' + b.length + ')');
  ok(JSON.stringify(a) === JSON.stringify(b), 'every question, option, answer key and explanation survives the round trip');
  const q2 = b.find(x => /Q2/.test(x.q)); ok(q2 && q2.exp === 'line one\nline two\nline three', 'multi-line explanation is intact: ' + JSON.stringify(q2 && q2.exp));
  const notice = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|'));
  ok(!/Check your file/.test(notice), 'the exported file gives no import warning (' + notice.slice(0, 60) + ')');
  ok(s1.errs.length === 0 && s2.errs.length === 0, 'no page errors');
  await s2.b.close(); console.log('FAILS ' + fails);
})();
