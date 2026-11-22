// shared helpers for the end-to-end checks
const { chromium } = require('playwright'); const path = require('path');
exports.boot = async (opts = {}) => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: opts.vp || { width: 420, height: 860 }, acceptDownloads: true, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, ...(opts.tz ? { timezoneId: opts.tz } : {}) });
  if (opts.time) await c.addInitScript(t => { const D = Date, off = t - D.now(); class FD extends D { constructor(...a) { if (a.length === 0) super(D.now() + off); else super(...a); } static now() { return D.now() + off; } } window.Date = FD; }, opts.time);
  await c.route('**/*', r => { const u = r.request().url(); /^(file|data|blob|about):/.test(u) ? r.continue() : r.abort(); });
  await c.addInitScript(() => { try { localStorage.setItem('sd_terms_v2', '1'); localStorage.setItem('sd_intro_v2', '1'); } catch (e) {} });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(opts.file || process.env.APP || '../index.html')); await p.waitForTimeout(1600);
  await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; });
  return { b, c, p, errs };
};
exports.importCsv = async p => { await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.setInputFiles('#fi-import', path.resolve('data/mcqs.csv')); await p.waitForFunction(() => /3 Decks|3 decks/.test(document.body.innerText), null, { timeout: 15000 }); await p.waitForTimeout(500); };
exports.visible = p => p.evaluate(() => [...document.querySelectorAll('#sd-app-wrapper > div[id^=s]')].filter(e => !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none').map(e => e.id).filter(i => !/overlay|-ov/.test(i)));
exports.quiz = async (p, { right = 8, total = 12, star = false } = {}) => {
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300);
  await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /Quiz/.test(x.textContent)).click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { pickSeg([...document.querySelectorAll('.modal button')].find(x => x.textContent.trim() === 'All' && /count/.test(x.getAttribute('onclick') || '')), 'count', 0); confirmQuiz(); }); await p.waitForTimeout(800);
  if (star) { await p.click('#qsb'); await p.waitForTimeout(200); }
  for (let i = 0; i < total; i++) {
    const c = await p.evaluate(() => roundQ[qi].correct); const pick = i < right ? c : (c + 1) % 4;
    await p.click('#o' + pick); await p.waitForTimeout(120); await p.click('#qzb-save'); await p.waitForTimeout(120);
  }
  await p.evaluate(() => qzSubmit()); await p.waitForTimeout(300); await p.evaluate(() => _doSubmit()); await p.waitForTimeout(1200);
};
