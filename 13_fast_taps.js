
const L = require('./lib');
(async () => { const { b, p, errs } = await L.boot({}); await L.importCsv(p);
  await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Quiz/.test(x.textContent)).click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { pickSeg([...document.querySelectorAll('.modal button')].find(x => x.textContent.trim() === 'All' && /count/.test(x.getAttribute('onclick') || '')), 'count', 0); confirmQuiz(); }); await p.waitForTimeout(800);
  let good = 0;
  for (let i = 0; i < 12; i++) {
    const c = await p.evaluate(() => roundQ[qi].correct);
    await p.click('#o' + c); await p.waitForTimeout(40); await p.click('#qzb-save'); await p.waitForTimeout(60);
  }
  const st = await p.evaluate(() => ({ ua: qUserAns.join(','), ok: qUserAns.every((a, i) => a === roundQ[i].correct), status: qStatus.join(',') }));
  console.log(st.ok ? 'PASS all 12 fast answers stored on their own question' : 'FAIL ' + JSON.stringify(st));
  // tap then Submit right away
  await b.close(); process.exitCode = st.ok ? 0 : 1; })();
