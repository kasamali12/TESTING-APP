// v52: notifications. Every phone reads a notice board from Firebase (a card on Home, a list in Settings, a native Android notification through the APK builder's
// bridge when it is on); the admin writes notices from the admin panel. Runs against a fake Firebase (fakefb.js) that ENFORCES firebase/database.rules.json through
// the stand-in rules engine (rules_eval.js, not Google's engine). The real database is never contacted.
const L = require('./lib'); const F = require('./fakefb'); const R = require('./rules_eval'); const fs = require('fs'); const path = require('path');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const KEY = 'Kq7mZx2Rt9vLp4Wa', RAW = fs.readFileSync(path.join(__dirname, '../firebase/database.rules.json'), 'utf8');
const rules = JSON.parse(RAW.split('CHANGE_ME_NOTICE_KEY').join(KEY));
const SVV = { '.sv': 'timestamp' }, NOW = 1790000000000, E = R.engine(rules, NOW);
const OV = '#sd-notice-ov', H = 3600e3, D = 864e5;

(async () => {
  // ═══ 1. The rules (stand-in engine): only a writer who knows the key can write, and what is written is checked ═══
  const rec = (o = {}) => Object.assign({ t: 'Test series is live', b: 'Mock 5 opens at 8 pm', a: SVV }, o);
  const pub = (o, id = 'n1abcd2345') => ({ pub: { [id]: rec(o) }, ['w/' + KEY + '/t']: SVV });
  const U = (db, body) => E.update(db, 'studydeck_notice', body);
  const old = { studydeck_notice: { w: { [KEY]: { t: NOW - 5000 } }, pub: { n1abcd2345: { t: 'Old', a: NOW - 9000 } } } };
  ok('the placeholder appears exactly twice in the rules file (the console copy needs both replaced)', RAW.split('CHANGE_ME_NOTICE_KEY').length - 1 === 2);
  ok('a publish with the key (the notice list and a fresh timestamp, in one update) is accepted', U({}, pub()).ok, JSON.stringify(U({}, pub())));
  ok('the same publish on top of an older list is accepted (the old timestamp does not matter)', U(old, pub()).ok);
  ok('refused: the notice list alone, without writing the key', !U({}, { pub: { n1abcd2345: rec() } }).ok);
  ok('refused: the key is wrong', !U({}, { pub: { n1abcd2345: rec() }, 'w/WrongKeyWrongKey1/t': SVV }).ok);
  ok('refused: replaying, the key was stored with an older time and is not written again', !U(old, { pub: { n1abcd2345: rec() } }).ok && !E.write(old, 'studydeck_notice/pub/n9zzzzzzzz', rec()).ok);
  ok('refused: the key written with a made-up time instead of the server clock', !U({}, { pub: { n1abcd2345: rec() }, ['w/' + KEY + '/t']: NOW - 1 }).ok);
  ok('refused: anything else written under the key', !U({}, Object.assign(pub(), { ['w/' + KEY + '/x']: 1 })).ok);
  ok('refused: writing the whole notice node, or the root', !E.write({}, 'studydeck_notice', { pub: {} }).ok && !E.write({}, '', { studydeck_notice: {} }).ok);
  const bad = {
    'an empty title': { t: '' }, 'no title': { t: undefined }, 'a title of 81 letters': { t: 'x'.repeat(81) }, 'a number for a title': { t: 5 }, 'a message of 401 letters': { b: 'y'.repeat(401) },
    'a link without https (http)': { l: 'http://example.com/a' }, 'a javascript: link': { l: 'javascript:alert(1)' }, 'a link of 301 letters': { l: 'https://e.co/' + 'z'.repeat(290) },
    'an extra field': { z: 1 }, 'a time made of text': { a: 'now' }, 'a time ten minutes ahead': { a: NOW + 600000 },
  };
  Object.keys(bad).forEach(k => { const r = U({}, pub(bad[k])); ok('refused: ' + k, !r.ok, r.why); });
  ok('accepted: a title of 80 letters, a message of 400 and an https link of 300', U({}, pub({ t: 'x'.repeat(80), b: 'y'.repeat(400), l: 'https://e.co/' + 'z'.repeat(287) })).ok);
  ok('accepted: a notice with no message and no link', U({}, { pub: { n1abcd2345: { t: 'Hi', a: SVV } }, ['w/' + KEY + '/t']: SVV }).ok);
  ok('refused: ids that are not "n" plus 4 to 12 lower-case letters or digits', ['abc', 'N1abcd2345', 'n1', 'n' + 'a'.repeat(13), 'n1ab-cd2345'].every(id => !U({}, pub({}, id)).ok));
  ok('removing every notice needs the key too: accepted with it, refused without', U(old, { pub: null, ['w/' + KEY + '/t']: SVV }).ok && !U(old, { pub: null }).ok);
  ok('everyone can read the notice list; nobody can read the key node, the notice node or the root', E.canRead(old, 'studydeck_notice/pub') && E.canRead(old, 'studydeck_notice/pub/n1abcd2345') && !E.canRead(old, 'studydeck_notice/w') && !E.canRead(old, 'studydeck_notice/w/' + KEY) && !E.canRead(old, 'studydeck_notice') && !E.canRead(old, ''));
  ok('the leaderboard rules are untouched by the new block (a row is still refused at the notice paths)', !E.write({}, 'studydeck_rank/pub', { a: 1 }).ok);

  // ═══ browser helpers ═══
  const N = (id, t, b, age, l) => ({ [id]: Object.assign({ t, a: Date.now() - age }, b != null ? { b } : {}, l ? { l } : {}) });
  const seed = () => Object.assign({}, N('n1newest01', 'Mock 5 is live', 'Opens 8 pm tonight. Bring a pen.', 1 * H), N('n2script01', '<img src=x onerror=window.__xss=1>', '<b>bold?</b> &amp; "quotes"', 3 * H),
    N('n3jslink01', 'Link test', 'The link is not https', 5 * H, 'javascript:alert(1)'), N('n4weekold1', 'Notes added', 'Pharmacology notes are in', 2 * D, 'https://studydeck.example/notes'), N('n5monthold', 'Old news', 'Too old to count as new', 40 * D),
    N('bad', 'Bad id', 'must be dropped', 1 * H), { n6notitle1: { b: 'no title', a: Date.now() - H } }, { n7nodate01: { t: 'No date', b: 'x' } });
  const mk = async (o = {}) => {
    const s = await L.boot({ vp: o.vp || { width: 390, height: 844 }, mobile: true }), p = s.p;
    s.fb = await F.install(p, o.db || { studydeck_notice: { pub: seed() } }, { rules: o.noRules ? null : rules });
    s.nat = []; await p.exposeFunction('__nat', (a, b) => { s.nat.push([a, b]); });
    if (o.bridge) await p.evaluate(m => { window.FreeApp = { toast() { }, notify(t, b) { if (m === 'throw') throw new Error('no'); __nat(t, b); } }; }, o.bridge);
    if (!o.auto) await p.evaluate(() => localStorage.setItem('sd-notice-at', String(Date.now())));     // keeps the automatic first check out of the way
    return s;
  };
  const chk = async (p, force = true) => { await p.evaluate(f => _sdNotice.check(f), force); await p.waitForTimeout(150); };
  const gets = s => s.fb.log.filter(r => r.method === 'GET' && /studydeck_notice/.test(r.path)).length;
  const st = p => p.evaluate(() => ({ n: _sdNotice.state.list.length, ids: _sdNotice.state.list.map(x => x.id), un: _sdNotice.unread().length, err: _sdNotice.state.err, seen: localStorage.getItem('sd-notice-seen') }));
  const dock = p => p.evaluate(() => { const d = document.getElementById('sd-dock'); return d ? { t: d.querySelector('.dk-t').textContent, s: d.querySelector('.dk-s').textContent, b: [...d.querySelectorAll('button')].map(b => b.textContent) } : null; });
  const txt = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
  const act = async (p, a, id) => { await p.evaluate(([a, id]) => document.querySelector('#sd-notice-ov [data-a="' + a + '"]' + (id ? '[data-id="' + id + '"]' : '')).click(), [a, id]); await p.waitForTimeout(350); };
  const fill = async (p, o) => { for (const k of Object.keys(o)) { await p.fill('#nt-' + k, o[k]); } };
  const sane = (s, n) => ok(n + ': no page error', s.errs.length === 0, s.errs.join(' | '));

  // ═══ 2. A phone reads the board ═══
  let s = await mk(), p = s.p, t;
  await chk(p); t = await st(p);
  ok('only well-formed notices are kept (5 of 8: bad id, no title and no date are dropped), newest first', t.n === 5 && t.ids.join() === 'n1newest01,n2script01,n3jslink01,n4weekold1,n5monthold', t.ids.join());
  ok('"new" counts those not yet seen and under 30 days old (4 of 5)', t.un === 4);
  await p.waitForFunction(() => !!document.getElementById('sd-dock'), null, { timeout: 4000 }).catch(() => { });
  let d = await dock(p);
  ok('Home shows one card with the newest title and "+3 more", and the buttons Later and Read', !!d && /📣 Mock 5 is live/.test(d.t) && /Opens 8 pm tonight/.test(d.s) && /\+3 more/.test(d.s) && d.b.join() === 'Later,Read', JSON.stringify(d));
  await p.evaluate(() => { _sdDock.set('resume', { title: 'Resume quiz', sub: 'x', actions: [] }); }); await p.waitForTimeout(1500);
  ok('the notice card wins over a lower-priority card (resume quiz) and loses to an app update', /Mock 5/.test((await dock(p)).t));
  await p.evaluate(() => { _sdDock.set('update', { title: 'Update ready', sub: 'x', actions: [] }); }); await p.waitForTimeout(1500);
  ok('… but an app update still comes first', /Update ready/.test((await dock(p)).t));
  await p.evaluate(() => { _sdDock.clear('update'); _sdDock.clear('resume'); }); await p.waitForTimeout(1500);
  // Settings row
  await p.evaluate(() => navTo('set')); await p.waitForTimeout(700);
  ok('Settings has a Notifications row under Leaderboard, with "4 new" and a dot', await p.evaluate(() => { const r = document.getElementById('nt-set-row'), l = document.getElementById('rk-set-row'); return !!r && !!l && l.nextElementSibling === r && /4 new/.test(r.innerText) && document.getElementById('nt-set-dot').style.display === ''; }));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(1500);
  d = await dock(p);
  await p.evaluate(() => { [...document.querySelectorAll('#sd-dock button')].find(b => b.textContent === 'Read').click(); }); await p.waitForTimeout(500);
  ok('Read opens the Notifications screen (a dialog) with 5 cards, marked as read, and the Home card goes away', await p.evaluate(() => { const o = document.getElementById('sd-notice-ov'); return !!o && o.getAttribute('role') === 'dialog' && o.querySelectorAll('.nt-c').length === 5 && !document.getElementById('sd-dock'); }));
  t = await st(p);
  ok('the newest time is stored as "seen" and nothing is new any more', t.un === 0 && +t.seen > 0);
  ok('the 4 fresh ones are highlighted for this visit, the 40-day-old one is not', await p.evaluate(() => [...document.querySelectorAll('#sd-notice-ov .nt-c')].map(c => c.classList.contains('new')).join() === 'true,true,true,true,false'));
  ok('a title that looks like HTML is shown as text: no element made from it, nothing ran', await p.evaluate(() => !document.querySelector('#sd-notice-ov img') && !window.__xss && /<img src=x onerror=window\.__xss=1>/.test(document.querySelector('#sd-notice-ov').innerText) && /<b>bold\?<\/b>/.test(document.querySelector('#sd-notice-ov').innerText)));
  ok('an https link becomes an "Open studydeck.example" button that opens in a new tab without leaking the opener; a javascript: link is dropped', await p.evaluate(() => { const a = [...document.querySelectorAll('#sd-notice-ov a.nt-a')]; return a.length === 1 && a[0].getAttribute('href') === 'https://studydeck.example/notes' && a[0].target === '_blank' && /noopener/.test(a[0].rel) && /studydeck\.example/.test(a[0].textContent); }));
  ok('a non-admin sees no form and no Remove button, even when asked for the admin view', await p.evaluate(() => { _sdNotice.open({ admin: true }); return !document.getElementById('nt-t') && !document.querySelector('#sd-notice-ov [data-a="del"]') && !document.querySelector('#sd-notice-ov [data-a="send"]'); }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('Escape closes the screen', !(await p.evaluate(() => !!document.getElementById('sd-notice-ov'))));
  await p.evaluate(() => navTo('set')); await p.waitForTimeout(500);
  ok('the Settings row now says "No new messages" and the dot is gone', await p.evaluate(() => /No new messages/.test(document.getElementById('nt-set-sub').textContent) && document.getElementById('nt-set-dot').style.display === 'none'));
  await p.evaluate(() => { document.getElementById('nt-set-open').click(); }); await p.waitForTimeout(400);
  ok('the Open button of that row opens the same screen', await p.evaluate(() => !!document.getElementById('sd-notice-ov')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  sane(s, 'reading'); await s.b.close();

  // ═══ 3. Later, new messages, throttling, offline, refused ═══
  s = await mk(); p = s.p; await chk(p); await p.evaluate(() => navTo('home')); await p.waitForTimeout(1500);
  await p.evaluate(() => { [...document.querySelectorAll('#sd-dock button')].find(b => b.textContent === 'Later').click(); }); await p.waitForTimeout(400);
  t = await st(p);
  ok('Later marks everything as read and removes the card', t.un === 0 && !(await dock(p)));
  const n0 = gets(s);
  await chk(p, false); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(300);
  ok('looking again within 10 minutes asks Firebase nothing (app resumed, back online)', gets(s) === n0, gets(s) + ' vs ' + n0);
  await p.evaluate(() => localStorage.setItem('sd-notice-at', String(Date.now() - 11 * 60e3))); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(500);
  ok('after 10 minutes, coming back to the app checks once', gets(s) === n0 + 1);
  Object.assign(s.fb.db.studydeck_notice.pub, N('n8fresh001', 'Answer key posted', 'Check Mock 5 answers', 60e3)); await chk(p); await p.evaluate(() => navTo('home')); await p.waitForTimeout(1500);
  d = await dock(p);
  ok('a notice that arrives later brings the card back, alone ("1 new")', !!d && /Answer key posted/.test(d.t) && !/more/.test(d.s), JSON.stringify(d));
  await p.evaluate(() => { [...document.querySelectorAll('#sd-dock button')].find(b => b.textContent === 'Later').click(); });
  s.fb.state.fail = 503; await chk(p); t = await st(p);
  ok('when Firebase cannot be reached the saved list stays and the screen says so (no crash)', t.n === 6 && /Could not check/.test(t.err), t.err);
  s.fb.state.fail = 401; await chk(p); t = await st(p);
  ok('when the rules are not set up the screen points to SETUP.md', /not switched on/.test(t.err) && /SETUP\.md/.test(t.err), t.err);
  s.fb.state.fail = null; await chk(p); t = await st(p);
  ok('and it recovers by itself on the next successful check', t.err === '' && t.n === 6);
  await p.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })); const g1 = gets(s); await chk(p); t = await st(p);
  ok('offline: no request is made and the screen says "You are offline."', gets(s) === g1 && /offline/.test(t.err));
  await p.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }));
  // persists: the saved list is what the next start shows, with no network
  let kept = false;
  for (let i = 0; i < 4 && !kept; i++) {
    await p.evaluate(() => { localStorage.setItem('zz-sentinel', '1'); }); await p.reload(); await p.waitForTimeout(1700);
    kept = await p.evaluate(() => localStorage.getItem('zz-sentinel') === '1');
  }
  if (kept) {
    ok('after a restart the saved list is there before any network (6 notices, all read)', await p.evaluate(() => _sdNotice.state.list.length === 6 && _sdNotice.unread().length === 0));
  } else console.log('SKIP persistence after reload (test-browser quirk: localStorage lost on reload)');
  sane(s, 'later / offline'); await s.b.close();

  // one automatic look shortly after start, nothing repeating
  s = await mk({ auto: true }); p = s.p; await p.waitForTimeout(7500);
  ok('one automatic check shortly after the app starts, and none repeating after it', gets(s) === 1, 'GETs: ' + gets(s));
  await p.waitForTimeout(3000); ok('… still just one after 10 more seconds', gets(s) === 1);
  await s.b.close();

  // ═══ 4. Native notification through the APK builder's bridge ═══
  const hide = p => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
  const show = p => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); });
  s = await mk({ bridge: 'ok', db: { studydeck_notice: { pub: N('n1newest01', 'Mock 5 is live', 'Opens 8 pm tonight', 1 * H) } } }); p = s.p;
  await show(p); await chk(p);
  ok('app on screen: no native notification (the Home card is the notice)', s.nat.length === 0);
  await p.evaluate(() => localStorage.removeItem('sd-notice-seen')); await hide(p); await chk(p);
  ok('app not on screen and the bridge is on: one native notification, title and message', s.nat.length === 1 && s.nat[0][0] === 'Mock 5 is live' && s.nat[0][1] === 'Opens 8 pm tonight', JSON.stringify(s.nat));
  await chk(p); ok('the same notice is never announced twice', s.nat.length === 1);
  Object.assign(s.fb.db.studydeck_notice.pub, N('n2second01', 'Second', 'Two', 30 * 60e3), N('n3third001', 'Third', 'Three', 20 * 60e3)); await chk(p);
  ok('two new at once give one notification for the newest, "(+1 more)"', s.nat.length === 2 && s.nat[1][0] === 'Third' && /\(\+1 more\)/.test(s.nat[1][1]), JSON.stringify(s.nat[1]));
  sane(s, 'bridge'); await s.b.close();
  s = await mk({ db: { studydeck_notice: { pub: N('n1newest01', 'Mock 5 is live', 'x', H) } } }); p = s.p; await hide(p); await chk(p); t = await st(p);
  ok('without the bridge (a normal browser) nothing is attempted and nothing breaks', t.n === 1 && s.errs.length === 0);
  await s.b.close();
  s = await mk({ bridge: 'throw', db: { studydeck_notice: { pub: N('n1newest01', 'Mock 5 is live', 'x', H) } } }); p = s.p; await hide(p); await chk(p); await chk(p); t = await st(p);
  ok('a bridge that throws does not break the app and the notice is tried again next time', t.n === 1 && s.errs.length === 0 && (await p.evaluate(() => localStorage.getItem('sd-notice-native'))) === null);
  await s.b.close();

  // ═══ 5. The admin sends, removes, copies ═══
  s = await mk({ bridge: 'ok', db: { studydeck_notice: { pub: seed() } } }); p = s.p; await p.evaluate(() => { _sdSess.save({ type: 'admin' }); }); await chk(p);
  ok('the admin panel has a Notify tab right after Rankings', await p.evaluate(() => { const n = document.getElementById('sda-tab-n'), r = document.getElementById('sda-tab-r'); return !!n && !!r && r.nextElementSibling === n; }));
  await p.evaluate(() => document.getElementById('sda-tab-n').click()); await p.waitForTimeout(400);
  ok('it opens the admin screen: title, message, link, key (hidden while typing) and Send / Copy for push', await p.evaluate(() => { const e = id => document.getElementById(id); return !!e('nt-t') && !!e('nt-b') && !!e('nt-l') && e('nt-k').type === 'password' && !!document.querySelector('[data-a="send"]') && !!document.querySelector('[data-a="copy"]') && /Send notifications/.test(document.querySelector('#sd-notice-ov h2').textContent); }));
  ok('the screen says what the APK bridge offers (here: toast, notify) and has a test button', /APK bridge is on: toast, notify/.test(await txt(p, OV)) && await p.evaluate(() => !!document.querySelector('[data-a="test"]')));
  await act(p, 'test'); ok('the test button shows a native notification right now', s.nat.length === 1 && s.nat[0][0] === 'StudyDeck');
  // refusals before anything is sent
  const w0 = s.fb.writes().length;
  await act(p, 'send'); ok('an empty title is refused with a message', /Write a title first/.test(await txt(p, '#nt-msg')));
  await fill(p, { t: 'Mock 6 is open', b: 'Starts 8 pm tonight', l: 'http://not-secure.example' }); await act(p, 'send');
  ok('a link that is not https is refused', /https/.test(await txt(p, '#nt-msg')));
  await fill(p, { l: 'javascript:alert(1)' }); await act(p, 'send'); ok('a javascript: link is refused', /https/.test(await txt(p, '#nt-msg')));
  await fill(p, { l: '', k: 'abc' }); await act(p, 'send');
  ok('a missing or short key is refused with a message, and nothing was sent so far', /notice key/.test(await txt(p, '#nt-msg')) && s.fb.writes().length === w0);
  await fill(p, { k: 'WrongKeyWrongKey1' }); await act(p, 'send');
  ok('a wrong key is refused by Firebase and the screen says so; nothing was stored', /refused/.test(await txt(p, '#nt-msg')) && s.fb.state.denied.length === 1 && Object.keys(s.fb.db.studydeck_notice.pub).length === 8 && !s.fb.db.studydeck_notice.w);
  ok('the title, message and link stay in the form after a refusal', await p.evaluate(() => document.getElementById('nt-t').value === 'Mock 6 is open' && document.getElementById('nt-b').value === 'Starts 8 pm tonight'));
  await fill(p, { l: 'https://studydeck.example/mock6', k: KEY }); await act(p, 'send'); await p.waitForTimeout(400);
  const post = s.fb.writes().filter(w => w.method === 'PATCH').pop(), body = post ? JSON.parse(post.body) : {};
  ok('the right key is accepted: ONE request carries the notice list and the key with a server timestamp', !!post && post.path === 'studydeck_notice' && Object.keys(body).sort().join() === 'pub,w/' + KEY + '/t' && body['w/' + KEY + '/t']['.sv'] === 'timestamp', post && post.body.slice(0, 120));
  const pubNow = s.fb.db.studydeck_notice.pub, newId = Object.keys(pubNow).find(k => pubNow[k].t === 'Mock 6 is open');
  ok('the stored notice has the id format, text, https link and the SERVER time', !!newId && /^n[a-z0-9]{8}$/.test(newId) && pubNow[newId].b === 'Starts 8 pm tonight' && pubNow[newId].l === 'https://studydeck.example/mock6' && Math.abs(pubNow[newId].a - Date.now()) < 5000);
  ok('the 5 well-formed notices were carried over and the 3 damaged rows were left out: 6 in all', Object.keys(pubNow).length === 6, Object.keys(pubNow).join());
  ok('the rules never refused a request from the app so far, except the one wrong key', s.fb.state.denied.length === 1);
  ok('the form is cleared (key kept for the next one), the list shows the new notice first, and a Remove button is on every card', await p.evaluate(() => document.getElementById('nt-t').value === '' && document.getElementById('nt-k').value !== '' && /Mock 6 is open/.test(document.querySelector('#sd-notice-ov .nt-c').innerText) && document.querySelectorAll('#sd-notice-ov [data-a="del"]').length === document.querySelectorAll('#sd-notice-ov .nt-c').length));
  ok('the sender has already seen it (nothing new on the admin phone)', (await st(p)).un === 0);
  ok('the key is not kept anywhere on the phone: not in localStorage, sessionStorage or the saved list', await p.evaluate(k => { const all = []; for (const st of [localStorage, sessionStorage]) for (let i = 0; i < st.length; i++) all.push(st.key(i) + '=' + st.getItem(st.key(i))); return !all.join('\n').includes(k); }, KEY));
  // copy for push
  await p.evaluate(() => { window.__clip = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__clip = t; return Promise.resolve(); } } }); });
  await fill(p, { t: 'Reminder', b: 'Mock 6 at 8 pm' }); await act(p, 'copy');
  ok('Copy for push puts "title ⏎ message" on the clipboard, ready for the builder', (await p.evaluate(() => window.__clip)) === 'Reminder\nMock 6 at 8 pm' && /Copied/.test(await txt(p, '#nt-msg')));
  await fill(p, { t: '' }); await p.evaluate(() => { window.__clip = null; }); await act(p, 'copy'); ok('Copy for push needs a title', (await p.evaluate(() => window.__clip)) === null && /title/.test(await txt(p, '#nt-msg')));
  // remove: cancel first, then confirm
  const before = Object.keys(s.fb.db.studydeck_notice.pub).length; await p.evaluate(() => { window.confirm = () => false; }); const w1 = s.fb.writes().length; await act(p, 'del', 'n4weekold1');
  ok('Remove asks first; cancelling removes nothing and sends nothing', Object.keys(s.fb.db.studydeck_notice.pub).length === before && s.fb.writes().length === w1);
  await p.evaluate(() => { window.confirm = () => true; }); await act(p, 'del', 'n4weekold1'); await p.waitForTimeout(300);
  ok('confirming removes just that one for everyone and the screen updates', !s.fb.db.studydeck_notice.pub.n4weekold1 && Object.keys(s.fb.db.studydeck_notice.pub).length === before - 1 && !(await p.evaluate(() => /Notes added/.test(document.querySelector('#sd-notice-ov').innerText))));
  for (const id of Object.keys(s.fb.db.studydeck_notice.pub)) { await act(p, 'del', id); }
  ok('removing the last one empties the board (the notice list is deleted) and the screen says "No notifications yet"', !s.fb.db.studydeck_notice.pub && /No notifications yet/.test(await txt(p, '#nt-list')));
  ok('every one of those removals went through the rules (key written with each)', s.fb.state.denied.length === 1);
  sane(s, 'admin'); await s.b.close();

  // only the newest 20 are kept
  const many = {}; for (let i = 0; i < 20; i++) Object.assign(many, N('n' + String(i).padStart(2, '0') + 'many001', 'Notice ' + i, 'b', (i + 1) * H));
  s = await mk({ db: { studydeck_notice: { pub: many } } }); p = s.p; await p.evaluate(() => { _sdSess.save({ type: 'admin' }); }); await chk(p);
  await p.evaluate(() => _sdNotice.open({ admin: true })); await p.waitForTimeout(300); await fill(p, { t: 'Notice 21', k: KEY }); await act(p, 'send'); await p.waitForTimeout(300);
  const ids = Object.keys(s.fb.db.studydeck_notice.pub);
  ok('with 20 on the board a new one makes it 21 → the oldest drops off, 20 stay', ids.length === 20 && !ids.includes('n19many001') && Object.values(s.fb.db.studydeck_notice.pub).some(r => r.t === 'Notice 21'), ids.length + '');
  await s.b.close();

  // ═══ 6. Layout on a small phone ═══
  s = await mk({ vp: { width: 360, height: 740 }, bridge: 'ok' }); p = s.p; await p.evaluate(() => { _sdSess.save({ type: 'admin' }); }); await chk(p);
  await p.evaluate(() => _sdNotice.open({ admin: true })); await p.waitForTimeout(500);
  const lay = await p.evaluate(() => {
    const b = document.querySelector('#sd-notice-ov .rk-body'), btn = [...document.querySelectorAll('#sd-notice-ov button, #sd-notice-ov a.nt-a')].filter(x => x.offsetParent), small = btn.filter(x => x.getBoundingClientRect().height < 43.5).map(x => x.textContent.trim().slice(0, 20));
    const inputs = [...document.querySelectorAll('#sd-notice-ov input, #sd-notice-ov textarea')].map(x => parseFloat(getComputedStyle(x).fontSize));
    const wide = [...document.querySelectorAll('#sd-notice-ov *')].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length;
    return { over: b.scrollWidth > b.clientWidth + 1, small, minFont: Math.min(...inputs), wide, labels: [...document.querySelectorAll('#sd-notice-ov input, #sd-notice-ov textarea')].every(x => document.querySelector('label[for="' + x.id + '"]')) };
  });
  ok('360 px wide: no sideways scroll, nothing wider than the screen', !lay.over && lay.wide === 0, JSON.stringify(lay));
  ok('every button and link is at least 44 px tall', lay.small.length === 0, lay.small.join('|'));
  ok('inputs use 16 px text or more (no zoom on iPhone) and each has a label', lay.minFont >= 16 && lay.labels);
  ok('the screen has a name for screen readers and an accessible Back button', await p.evaluate(() => document.getElementById('sd-notice-ov').getAttribute('aria-label') === 'Notifications' && document.querySelector('#sd-notice-ov [data-a="x"]').getAttribute('aria-label') === 'Back'));
  await p.screenshot({ path: path.join(OUT, 'm34_admin.png') });
  await p.evaluate(() => { document.getElementById('sd-notice-ov').remove(); _sdSess.clear && _sdSess.clear(); }); await p.waitForTimeout(100);
  sane(s, 'layout'); await s.b.close();

  console.log(FAILS ? 'FAILED: ' + FAILS : 'ALL PASS'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
