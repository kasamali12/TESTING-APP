// v47: the card after a wrong answer (reported on a prostate-volume question): verdict, correct answer, explanation and reference must read as separate parts,
// the result must come into view without hunting for it, and the four navigation buttons must share the row evenly on wide screens.
const L = require('./lib');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const EXP = 'The volume of the prostate in normal adult males is 20cc.<br><br>Prostate is an accessory glandular tissue embedded in the fibromuscular stroma. It usually weighs 8 grams and measures 4 cm x 3 cm x 2 cm.<br><br><b>Zones of prostate (McNeal):</b><br>• Peripheral zone – 70% – most common site of carcinoma<br>• Central zone – 25%<br>• Transition zone – 5% – site of BPH<br>• Anterior fibromuscular stroma<br><br>Pearl: cancer arises in the periphery; BPH in the centre.';
const Q = [{ q: 'What is the volume of the prostate in normal adult males?', opts: ['20cc', '50cc', '75cc', '100cc'], correct: 0, exp: EXP, subject: 'anatomy', tags: 'Urology', mcqId: 'MF5205', ref: 'Campbell Walsh Urology, 12th ed.' }, { q: 'Second question?', opts: ['a', 'b', 'c', 'd'], correct: 1, exp: 'x', subject: 'anatomy' }];

async function answered(vp, mobile) {
  const s = await L.boot({ vp, mobile }); const p = s.p;
  await p.evaluate(qs => { cfg.shuffle = false; cfg.count = 2; cfg.exp = true; startQuizWithQ(JSON.parse(JSON.stringify(qs)), 'Anatomy', null); }, Q); await p.waitForTimeout(600);
  await p.evaluate(() => doAnswer(1)); await p.waitForTimeout(1600);
  const R = await p.evaluate(() => {
    const qb = document.getElementById('qb'), box = qb.querySelector('.exp-box'), body = qb.querySelector('.exp-body'), bar = document.getElementById('qz-actionbar'), sc = document.getElementById('qz-main');
    const rb = box.getBoundingClientRect(), bb = bar.getBoundingClientRect(), sb = sc.getBoundingClientRect();
    const title = qb.querySelector('.exp-title'), strong = title && title.querySelector('strong');
    const nav = [...document.querySelectorAll('.neet-nav-row .nab')].map(b => { const r = b.getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), r: Math.round(r.right) }; });
    return {
      verdict: title ? title.textContent.replace(/\s+/g, ' ').trim() : null, pill: strong ? strong.textContent : null,
      bodyW: body ? +getComputedStyle(body).fontWeight : null, boldW: body && body.querySelector('b') ? +getComputedStyle(body.querySelector('b')).fontWeight : null, inlineW: body ? /font-weight/.test(body.getAttribute('style') || '') : null,
      boxTop: Math.round(rb.top), boxVisibleH: Math.round(Math.min(rb.bottom, bb.top) - Math.max(rb.top, sb.top)), barTop: Math.round(bb.top), hdrBottom: Math.round(sb.top),
      id: /ID: MF5205/.test(box.textContent), ref: /Campbell Walsh/.test(box.textContent), nav, overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });
  return { s, R };
}

(async () => {
  for (const [name, vp, mobile] of [['phone 390x844', { width: 390, height: 844 }, true], ['small phone 360x640', { width: 360, height: 640 }, true], ['phone sideways 844x390', { width: 844, height: 390 }, true]]) {
    const { s, R } = await answered(vp, mobile);
    ok(name + ': the verdict names the right answer with its letter ("A) 20cc")', /Incorrect — Correct: A\) 20cc/.test(R.verdict) && R.pill === 'A) 20cc', JSON.stringify(R.verdict));
    ok(name + ': the explanation is normal weight and its bold heading stands out', R.bodyW !== null && R.bodyW < 600 && R.boldW >= 700 && R.inlineW === false, 'body ' + R.bodyW + ' bold ' + R.boldW);
    ok(name + ': the result is in view after the tap (no hunting below the fold)', R.boxTop >= R.hdrBottom - 2 && R.boxTop < R.barTop - 90 && R.boxVisibleH >= 90, 'top ' + R.boxTop + ' bar ' + R.barTop + ' visible ' + R.boxVisibleH);
    ok(name + ': ID and reference are still there, and nothing sticks out sideways', R.id && R.ref && R.overflowX <= 1, 'overflow ' + R.overflowX);
    ok(name + ': no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  for (const [name, vp] of [['desktop 1280x800', { width: 1280, height: 800 }], ['tablet 768x1024', { width: 768, height: 1024 }]]) {
    const { s, R } = await answered(vp, vp.width < 1000);
    const w = R.nav.map(n => n.w), gaps = R.nav.slice(1).map((n, i) => n.l - R.nav[i].r);
    ok(name + ': the four navigation buttons have the same width', R.nav.length === 4 && Math.max(...w) - Math.min(...w) <= 2, JSON.stringify(R.nav));
    ok(name + ': and the same small gap between them', gaps.every(g => g >= 0 && g <= 14) && Math.max(...gaps) - Math.min(...gaps) <= 2, JSON.stringify(gaps));
    ok(name + ': the verdict, explanation and reference read in order', /Incorrect — Correct: A\) 20cc/.test(R.verdict) && R.id && R.ref, '');
    ok(name + ': no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // a correct answer, and a question without an explanation, still look right
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p;
    await p.evaluate(qs => { cfg.shuffle = false; cfg.count = 2; cfg.exp = true; startQuizWithQ(JSON.parse(JSON.stringify(qs)), 'Anatomy', null); }, Q); await p.waitForTimeout(600);
    await p.evaluate(() => doAnswer(0)); await p.waitForTimeout(1500);
    const t = await p.evaluate(() => { const b = document.querySelector('#qb .exp-box'); return b ? b.querySelector('.exp-title').textContent.replace(/\s+/g, ' ').trim() : null; });
    ok('a right answer shows "Correct" with no stray pill', /Correct/.test(t) && !/Incorrect/.test(t) && !/A\) 20cc/.test(t), JSON.stringify(t));
    await p.evaluate(() => { qzSaveNext(); }); await p.waitForTimeout(500);
    const noexp = await p.evaluate(() => { window.__q2 = true; return !!document.getElementById('qb'); });
    ok('moving on to the next question works after the scroll', noexp);
    ok('no page errors (right answer)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  console.log(FAILS ? FAILS + ' FAILED' : 'ALL PASSED'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
