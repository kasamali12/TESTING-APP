// v45: a dialog taller than the screen scrolls inside it (the Export dialog used to sit half above the screen with nothing to scroll),
// and no dialog in the app is cut off by the screen edge without being scrollable.
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const SIZES = [['small phone 360x640', 360, 640, true], ['short phone 375x560', 375, 560, true], ['phone 390x844', 390, 844, true], ['phone sideways 844x390', 844, 390, true], ['laptop 1280x720', 1280, 720, false]];

(async () => {
  for (const [name, w, h, mobile] of SIZES) {
    const s = await L.boot({ vp: { width: w, height: h }, mobile }); const p = s.p; await L.importCsv(p);
    await p.evaluate(() => openExportPicker()); await p.waitForTimeout(900);
    const geo = () => p.evaluate(() => {
      const m = document.querySelector('#expfmt-ov .exp-fmt-modal'), r = e => e.getBoundingClientRect();
      const cancel = r(m.querySelector('.exp-fmt-cancel')), lastCard = [...m.querySelectorAll('.exp-fmt-card')].pop(), deck = r(m.querySelector('.exp-deck-label')), title = r(m.querySelector('.exp-fmt-title')), box = r(m);
      return { vh: innerHeight, top: Math.round(box.top), bottom: Math.round(box.bottom), scrollTop: Math.round(m.scrollTop), scrollable: m.scrollHeight > m.clientHeight + 1, titleTop: Math.round(title.top), deckTop: Math.round(deck.top), lastCardBottom: Math.round(r(lastCard).bottom), cancelBottom: Math.round(cancel.bottom), cancelTop: Math.round(cancel.top) };
    });
    let g = await geo();
    ok(name + ': the dialog fits on the screen (nothing above the top edge)', g.top >= 0 && g.bottom <= g.vh + 1 && g.titleTop >= 0, JSON.stringify(g));
    ok(name + ': the title and the "Select Deck" picker are in view when it opens', g.titleTop >= 0 && g.deckTop >= 0 && g.deckTop < g.vh, 'title ' + g.titleTop + ' picker ' + g.deckTop);
    if (g.scrollable) {
      const cx = Math.round(w / 2), cy = Math.round(g.top + (g.bottom - g.top) / 2);
      await p.mouse.move(cx, cy); await p.mouse.wheel(0, 3000); await p.waitForTimeout(500);
      const g2 = await geo();
      ok(name + ': scrolling with the wheel moves the dialog content', g2.scrollTop > 0, 'scrollTop ' + g2.scrollTop);
      ok(name + ': the last format and Cancel can be reached by scrolling', g2.cancelBottom <= g2.vh + 1 && g2.lastCardBottom <= g2.cancelTop + 1 && g2.cancelTop >= 0, JSON.stringify(g2));
      ok(name + ': the title stays in view while scrolled', g2.titleTop >= 0 && g2.titleTop < 60, 'title top ' + g2.titleTop);
      const hit = await p.evaluate(() => { const c = document.querySelector('#expfmt-ov .exp-fmt-cancel'), b = c.getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e === c; });
      ok(name + ': Cancel is really on top and tappable there', hit);
      await p.click('#expfmt-ov .exp-fmt-cancel'); await p.waitForTimeout(300);
      ok(name + ': tapping Cancel closes the dialog', await p.evaluate(() => document.getElementById('expfmt-ov').classList.contains('hidden')));
    } else ok(name + ': it fits without scrolling', true);
    ok(name + ': no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }

  // a real finger drag (touch events), not just the mouse wheel
  {
    const s = await L.boot({ vp: { width: 360, height: 640 }, mobile: true }); const p = s.p; await L.importCsv(p);
    await p.evaluate(() => openExportPicker()); await p.waitForTimeout(1200);
    const cdp = await p.context().newCDPSession(p), top = () => p.evaluate(() => document.querySelector('#expfmt-ov .exp-fmt-modal').scrollTop);
    const swipe = async (y0, y1) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: y0 }] });
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: y0 + (y1 - y0) * i / 12 }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
    };
    const a = await top(); await swipe(330, 60); const b = await top(); await swipe(120, 400); const c = await top();
    ok('phone 360x640: dragging a finger up scrolls the Export dialog, dragging down scrolls it back', b > a + 100 && c < b, a + ' -> ' + b + ' -> ' + c);
    ok('phone 360x640: no page errors while touch scrolling', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }

  // every dialog in the app, at the two tightest sizes
  for (const [name, w, h] of [['small phone 360x640', 360, 640], ['phone sideways 844x390', 844, 390]]) {
    const s = await L.boot({ vp: { width: w, height: h }, mobile: true }); const p = s.p; await L.importCsv(p);
    const ids = await p.evaluate(() => [...document.querySelectorAll('[id$="-ov"], [id$="-overlay"], .modal-ov, .sheet-overlay, .cmodal-ov')].filter(e => e.id && !e.closest('#sd-auth-ov')).map(e => e.id).filter((v, i, a) => a.indexOf(v) === i));
    const bad = [];
    for (const id of ids) {
      const r = await p.evaluate(id => {
        const ov = document.getElementById(id); if (!ov) return null; const keep = [ov.className, ov.getAttribute('style')];
        ov.classList.remove('hidden'); ['open', 'show', 'active', 'visible'].forEach(c => ov.classList.add(c)); ov.style.removeProperty('display');
        const restore = () => { ov.className = keep[0]; keep[1] === null ? ov.removeAttribute('style') : ov.setAttribute('style', keep[1]); };
        if (getComputedStyle(ov).display === 'none' || getComputedStyle(ov).visibility === 'hidden' || ov.getBoundingClientRect().height < 50) { restore(); return { skip: true }; }
        const out = [...ov.children].filter(c => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 40).map(c => { const b = c.getBoundingClientRect(); return { cls: (c.className || c.id || c.tagName).toString().slice(0, 40), cut: (b.top < -1 || b.bottom > innerHeight + 1) && !/(auto|scroll)/.test(getComputedStyle(c).overflowY) }; });
        restore(); return { out };
      }, id);
      if (r && !r.skip) r.out.filter(o => o.cut).forEach(o => bad.push(id + ' > ' + o.cls));
    }
    ok(name + ': none of the ' + ids.length + ' dialogs is cut off by the screen edge without being scrollable', ids.length >= 25 && bad.length === 0, bad.join(' ; '));
    await s.b.close();
  }
  console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})();
