// v48: (1) the answered question card in the dark and true-black themes uses a warm sepia tone (switchable, light theme untouched),
//      (2) the word "Marrow" is gone from the HTML-import labels (Home button, import screen title, drop zone) and the help texts of that flow.
const L = require('./lib');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const Q = [{ q: 'Identify the nerve passing around the marked structure.', opts: ['Common peroneal nerve', 'Sural nerve', 'Tibial nerve', 'Femoral nerve'], correct: 0, exp: 'The structure marked in the given image is the neck of fibula.<br><br>The nerve passing around the neck of fibula is the <b>common peroneal nerve</b>.<br>• Injury causes foot drop', subject: 'anatomy', tags: 'Lower limb', mcqId: 'ME6804' }, { q: 'Second?', opts: ['a', 'b', 'c', 'd'], correct: 1, exp: 'x', subject: 'anatomy' }];
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const warm = c => c[0] > c[2] && c[1] >= c[2];     // red ≥ green ≥ blue, red above blue: a brown / cream rather than a blue-grey

async function card(opts) {
  const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true, file: opts && opts.file }); const p = s.p;
  await p.evaluate(([t, a]) => { const r = document.documentElement; r.setAttribute('data-theme', t); if (a) r.setAttribute('data-amoled', '1'); else r.removeAttribute('data-amoled'); }, [opts.theme, !!opts.amoled]);
  await p.evaluate(qs => { cfg.shuffle = false; cfg.count = 2; cfg.exp = true; startQuizWithQ(JSON.parse(JSON.stringify(qs)), 'Anatomy', null); }, Q); await p.waitForTimeout(600);
  await p.evaluate(() => doAnswer(1)); await p.waitForTimeout(1500);
  return { s, p };
}
const read = p => p.evaluate(() => {
  const cs = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; }, v = n => getComputedStyle(document.querySelector('#qz-outer')).getPropertyValue(n).trim(), root = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return { attr: document.documentElement.getAttribute('data-sepia'), card: cs('#qb > div', 'backgroundColor'), cardText: cs('#qb > div', 'color'), box: cs('#qb .exp-box', 'backgroundColor'), body: cs('#qb .exp-body', 'color'), outer: cs('#qz-outer', 'backgroundColor'),
    muted: v('--m'), t: v('--t'), t2: v('--t2'), g: v('--g'), r: v('--r'), rootG: root('--g'), rootR: root('--r'), rootCard: root('--card'), overflowX: document.documentElement.scrollWidth - innerWidth, qbKids: document.querySelectorAll('#qb > div').length };
});
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };

(async () => {
  // ── 1. sepia, dark theme ──
  { const { s, p } = await card({ theme: 'dark', amoled: false }); const R = await read(p);
    ok('dark: sepia is on by default', R.attr === '1', R.attr);
    ok('dark: the answered card is a warm brown, not the cool blue-grey (' + R.card + ')', warm(rgb(R.card)) && rgb(R.card)[2] < rgb(R.card)[0], R.card);
    ok('dark: the explanation box and the text are warm too (' + R.box + ' / ' + R.body + ')', warm(rgb(R.box)) && warm(rgb(R.body)), R.box + ' ' + R.body);
    ok('dark: the question screen background is warm as well (' + R.outer + ')', warm(rgb(R.outer)), R.outer);
    const bg = rgb(R.card), c1 = contrast(rgb(R.cardText), bg), c2 = contrast(hex(R.t2), bg), c3 = contrast(hex(R.muted), bg);
    ok('dark: text contrast on the card: main ≥ 7, explanation ≥ 7, small grey text ≥ 4.5 (' + c1.toFixed(1) + ' / ' + c2.toFixed(1) + ' / ' + c3.toFixed(1) + ')', c1 >= 7 && c2 >= 7 && c3 >= 4.5);
    ok('dark: the green / red answer colours and the accent are the same as in the rest of the app', R.g === R.rootG && R.r === R.rootR, R.g + ' ' + R.r);
    ok('dark: the other screens keep the cool colours (Home card colour still ' + R.rootCard + ')', /^#131A21$/i.test(R.rootCard), R.rootCard);
    ok('dark: nothing overflows sideways and there is still one question card', R.overflowX <= 0 && R.qbKids === 1, R.overflowX + ' / ' + R.qbKids);
    // the switch in Settings
    await p.evaluate(() => navTo('set')); await p.waitForTimeout(500);
    const row = await p.evaluate(() => { const cb = document.getElementById('tog-sepia'); if (!cb) return null; const t = cb.closest('.set-row'), a = document.getElementById('tog-amoled').closest('.set-row'); return { checked: cb.checked, after: t.previousElementSibling === a, label: t.querySelector('.sr-lbl').textContent, h: Math.round(t.getBoundingClientRect().height), tapH: Math.round((cb.closest('.tog') || cb).getBoundingClientRect().height) }; });
    ok('Settings: a "Sepia tone" switch sits right under "True black", switched on', !!row && row.checked && row.after && row.label === 'Sepia tone', JSON.stringify(row));
    await p.evaluate(() => { const cb = document.getElementById('tog-sepia'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });
    ok('switching it off removes the tone at once', await p.evaluate(() => document.documentElement.getAttribute('data-sepia') === null));
    await p.evaluate(() => navTo('home')); await p.waitForTimeout(200);
    await p.evaluate(qs => { cfg.shuffle = false; cfg.count = 2; cfg.exp = true; startQuizWithQ(JSON.parse(JSON.stringify(qs)), 'Anatomy', null); }, Q); await p.waitForTimeout(500); await p.evaluate(() => doAnswer(1)); await p.waitForTimeout(1200);
    const R2 = await read(p); ok('off: the card is back to the cool blue-grey (' + R2.card + ')', !warm(rgb(R2.card)) && rgb(R2.card)[2] > rgb(R2.card)[0], R2.card);
    ok('the choice is saved and kept after a reload', await p.evaluate(() => JSON.parse(localStorage.getItem('sd-appearance') || '{}').sepia === false));
    await p.reload(); await p.waitForTimeout(1200);
    ok('after the reload it is still off', await p.evaluate(() => document.documentElement.getAttribute('data-sepia') === null));
    await p.evaluate(() => resetAppearance()); await p.waitForTimeout(300);
    ok('"Reset appearance" puts the sepia tone back on (the default)', await p.evaluate(() => document.documentElement.getAttribute('data-sepia') === '1'));
    ok('no page errors (dark)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close(); }

  // ── 2. sepia, true black ──
  { const { s, p } = await card({ theme: 'dark', amoled: true }); const R = await read(p);
    ok('true black: the screen stays pure black (' + R.outer + ')', /rgb\(0, 0, 0\)|rgba\(0, 0, 0/.test(R.outer), R.outer);
    ok('true black: the card is a very dark warm brown (' + R.card + ')', warm(rgb(R.card)) && rgb(R.card).every(x => x <= 24), R.card);
    const bg = rgb(R.card); const c1 = contrast(rgb(R.cardText), bg), c3 = contrast(hex(R.muted), bg);
    ok('true black: text contrast main ≥ 7, small grey text ≥ 4.5 (' + c1.toFixed(1) + ' / ' + c3.toFixed(1) + ')', c1 >= 7 && c3 >= 4.5);
    ok('true black: the answer colours are unchanged', R.g === R.rootG && R.r === R.rootR);
    ok('no page errors (true black)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close(); }

  // ── 3. light theme never changes ──
  { const { s, p } = await card({ theme: 'light', amoled: false }); const R = await read(p);
    ok('light: the card is plain white as before (' + R.card + ')', rgb(R.card).every(x => x >= 250), R.card);
    ok('light: the explanation box is not tinted brown (' + R.box + ')', !(rgb(R.box)[0] - rgb(R.box)[2] > 12), R.box);
    ok('no page errors (light)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close(); }

  // ── 4. no "Marrow" in the HTML-import labels ──
  { const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p;
    const home = await p.evaluate(() => { const b = document.querySelector('#shome .qa-tree-wide[onclick*="openHTMLDeckTreeModal"]'); return b ? b.querySelector('.qa-lbl').textContent : null; });
    ok('Home button says "Import HTML"', home === 'Import HTML', home);
    await p.evaluate(() => openHTMLDeckTreeModal()); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const ov = document.getElementById('html-tree-ov'), dz = document.getElementById('hdt-drop-zone'); return { vis: getComputedStyle(ov).display !== 'none', all: ov.innerText, drop: dz ? dz.innerText : null, title: [...ov.querySelectorAll('div')].some(d => d.children.length === 0 && d.textContent.trim() === 'Import HTML') ? 'Import HTML' : null }; });
    ok('the import screen opens', m.vis);
    ok('import screen title is "Import HTML"', m.title === 'Import HTML', m.title);
    ok('drop zone says "Drop HTML file here"', /Drop HTML file here/.test(m.drop || ''), m.drop);
    ok('nowhere on the import screen does it say "Marrow"', !/marrow/i.test(m.all), m.all.slice(0, 200));
    // every other visible or hidden text in the app: only the "not affiliated" disclaimers and the TriPath source names may still say Marrow
    const left = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }); let n; while ((n = w.nextNode())) { if (/marrow/i.test(n.nodeValue)) out.push(n.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 90)); } return out; });
    ok('the only places that still name Marrow are the "not affiliated" disclaimers and the TriPath planner line (' + left.length + ')', left.every(t => /not affiliated|PrepLadder X/i.test(t)), JSON.stringify(left));
    const src = require('fs').readFileSync(process.env.APP, 'utf8');
    ok('the file itself has none of the old labels', !/Import Marrow HTML|Drop Marrow HTML|Marrow HTML import|From Marrow \/ DAMS|No Marrow data found|Scanning Marrow globals|Try another Marrow export/.test(src));
    ok('no page errors (labels)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close(); }

  console.log(FAILS ? FAILS + ' FAILED' : 'ALL PASSED'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
