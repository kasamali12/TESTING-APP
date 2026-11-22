// v44: sign-in accounts. Passwords are stored hashed, old plain-text accounts are upgraded, recovery sets a new password instead of
// showing the old one, and a failed download of the user list can never overwrite the accounts. The database is a fake that lives
// in this file; nothing here talks to a real Firebase project.
const { chromium } = require('playwright'); const path = require('path'); const crypto = require('crypto');
const FILE = path.resolve(process.env.APP || path.join(__dirname, '..', 'index.html'));
let FAILS = 0, t; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const legacy = (o) => Object.assign({ id: 'u-legacy', name: 'Legacy Lee', mobile: '9000000001', email: 'legacy@example.com', password: 'oldpass1', college: 'Test College', city: 'Pune', status: 'approved', passkey: 'SD-AAAA-BBBB-CCCC', message: null, blocked: false, registeredAt: '2026-01-01T00:00:00.000Z' }, o || {});

(async () => {
  const b = await chromium.launch();
  let db, mode, puts, gets;
  const fresh = async (users) => {
    db = { studydeck_users: users && users.length ? { users } : null }; mode = 'ok'; puts = 0; gets = 0;
    const c = await b.newContext({ viewport: { width: 390, height: 780 } });
    await c.route('**/*', r => {
      const u = r.request().url();
      if (/^(file|data|blob|about):/.test(u)) return r.continue();
      const m = u.match(/firebaseio\.com\/([a-z_]+)\.json/);
      if (!m) return r.abort();
      if (mode === 'down') return r.abort();
      if (mode === 'denied') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Permission denied"}' });
      if (r.request().method() === 'PUT') { puts++; db[m[1]] = JSON.parse(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(db[m[1]]) }); }
      gets++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(db[m[1]] === undefined ? null : db[m[1]]) });
    });
    await c.addInitScript(() => { try { localStorage.setItem('sd_terms_v2', '1'); localStorage.setItem('sd_intro_v2', '1'); localStorage.removeItem('sd_auth_v1'); } catch (e) {} });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + FILE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    return { c, p, errs };
  };
  const users = () => (db.studydeck_users && db.studydeck_users.users) || [];
  const showLogin = p => p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = ''; _SDA.view = 'login'; _SDA.render(); });
  const signIn = async (p, email, pw, passkey) => {
    await showLogin(p); if (passkey) { await p.evaluate(() => _SDA.setLC('passkey')); }
    await p.fill('#sd-li-email', email); await p.fill('#sd-li-cred', pw);
    await p.evaluate(() => { _SDA.doLogin(); }); await p.waitForTimeout(1300);
    return p.evaluate(() => { const e = document.getElementById('sd-li-err'); let s = null; try { s = JSON.parse(localStorage.getItem('sd_auth_v1')); } catch (x) {} return { err: e && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : '', session: s && s.type }; });
  };

  // ── 1. old account with a readable password ──
  let s = await fresh([legacy()]); let p = s.p;
  ok('the hash function gives the standard PBKDF2-SHA256 answer', await p.evaluate(() => _sdHashPw('correct horse', '00112233445566778899aabbccddeeff')) === 'pbkdf2$150000$00112233445566778899aabbccddeeff$' + crypto.pbkdf2Sync('correct horse', Buffer.from('00112233445566778899aabbccddeeff', 'utf8'), 150000, 32, 'sha256').toString('hex'));
  let r = await signIn(p, 'legacy@example.com', 'wrong-password');
  ok('a wrong password is refused', /Incorrect email or password/.test(r.err) && !r.session, JSON.stringify(r));
  ok('and nothing was written for a refused sign-in', puts === 0 && users()[0].password === 'oldpass1');
  r = await signIn(p, 'legacy@example.com', 'oldpass1');
  ok('the old password still signs the person in', !r.err && r.session === 'user', JSON.stringify(r));
  let u = users()[0];
  ok('and that sign-in upgrades the stored password to a salted hash', /^pbkdf2\$150000\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(u.passHash || '') && u.password === undefined, JSON.stringify(Object.keys(u)));
  ok('the readable password is nowhere in the database any more', !JSON.stringify(db).includes('oldpass1'));
  await p.evaluate(() => localStorage.removeItem('sd_auth_v1'));
  r = await signIn(p, 'legacy@example.com', 'oldpass1x');
  ok('after the upgrade a wrong password is still refused', /Incorrect email or password/.test(r.err), JSON.stringify(r));
  await p.evaluate(() => localStorage.removeItem('sd_auth_v1'));
  r = await signIn(p, 'legacy@example.com', 'oldpass1');
  ok('and the right one still works (checked against the hash)', !r.err && r.session === 'user', JSON.stringify(r));
  await p.evaluate(() => localStorage.removeItem('sd_auth_v1'));
  r = await signIn(p, 'legacy@example.com', 'SD-AAAA-BBBB-CCCC', true);
  ok('passkey sign-in is unchanged', !r.err && r.session === 'user', JSON.stringify(r));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.c.close();

  // ── 2. new sign-up ──
  s = await fresh([legacy()]); p = s.p;
  const register = async (email, mobile, pw) => {
    await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = ''; _SDA.goReg(); });
    await p.fill('#sd-r-name', 'New Person'); await p.fill('#sd-r-mobile', mobile); await p.fill('#sd-r-email', email); await p.fill('#sd-r-password', pw); await p.fill('#sd-r-college', 'Some College'); await p.fill('#sd-r-city', 'Delhi');
    await p.evaluate(() => { _SDA.doRegNext(); }); await p.waitForTimeout(1300);
    return p.evaluate(() => { const e = document.querySelector('.sd-err-box'); return e && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : ''; });
  };
  let msg = await register('new@example.com', '9111111111', 'brand-new-pw');
  u = users().find(x => x.email === 'new@example.com');
  ok('sign-up stores the person with a hash and no readable password', !!u && /^pbkdf2\$/.test(u.passHash || '') && u.password === undefined && u.status === 'payment_pending', msg || JSON.stringify(u && Object.keys(u)));
  ok('the other account was kept', users().some(x => x.email === 'legacy@example.com') && users().length === 2);
  ok('the new password is not in the database in any form but the hash', !JSON.stringify(db).includes('brand-new-pw'));
  await p.evaluate(() => localStorage.removeItem('sd_auth_v1'));
  r = await signIn(p, 'new@example.com', 'brand-new-pw');
  ok('the new person can sign in with that password', !r.err && r.session === 'user', JSON.stringify(r));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.c.close();

  // ── 3. a failed download must not overwrite the accounts ──
  s = await fresh([legacy(), legacy({ id: 'u2', email: 'two@example.com', mobile: '9000000002', name: 'Two', password: 'pw-two-2' })]); p = s.p;
  const before = JSON.stringify(db);
  mode = 'down'; puts = 0;
  msg = await register('third@example.com', '9222222222', 'third-pw-1');
  ok('sign-up with no connection says so', /Could not reach the server/.test(msg), msg);
  ok('and writes nothing (the accounts are not replaced by a list of one)', puts === 0 && JSON.stringify(db) === before);
  mode = 'denied'; puts = 0;
  msg = await register('third@example.com', '9222222222', 'third-pw-1');
  ok('a "permission denied" answer is also an error, not an empty list', /Could not reach the server/.test(msg) && puts === 0 && JSON.stringify(db) === before, msg);
  mode = 'down'; r = await signIn(p, 'legacy@example.com', 'oldpass1');
  ok('sign-in with no connection says so instead of "incorrect password"', /Could not reach the server/.test(r.err) && puts === 0, JSON.stringify(r));
  mode = 'ok';
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.c.close();

  // ── 4. the very first sign-up on an empty database still works ──
  s = await fresh([]); p = s.p;
  msg = await register('first@example.com', '9333333333', 'first-pw-12');
  ok('an empty database is not treated as an error: the first sign-up is saved', users().length === 1 && users()[0].email === 'first@example.com', msg);
  await s.c.close();

  // ── 5. recovery sets a new password instead of showing the old one ──
  s = await fresh([legacy(), legacy({ id: 'u3', email: 'rec@example.com', mobile: '9000000003', name: 'Rec Person', password: 'forgotten-1' })]); p = s.p;
  await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = ''; _SDA.goForgot(); });
  await p.fill('#sd-f-name', 'Rec Person'); await p.fill('#sd-f-mobile', '9000000003'); await p.fill('#sd-f-email', 'rec@example.com'); await p.fill('#sd-f-college', 'Test College'); await p.fill('#sd-f-city', 'Pune');
  await p.evaluate(() => { _SDA.doVerify(); }); await p.waitForTimeout(900);
  t = await p.evaluate(() => ({ view: _SDA.view, shown: document.body.innerText.includes('forgotten-1'), oldBox: !!document.getElementById('sd-rv-pass'), newBox: !!document.getElementById('sd-rv-newpw') }));
  ok('after identity check the old password is not shown and a new-password box is', t.view === 'recovery' && !t.shown && !t.oldBox && t.newBox, JSON.stringify(t));
  await p.fill('#sd-rv-newpw', '123'); await p.evaluate(() => { _SDA.doResetPw(); }); await p.waitForTimeout(500);
  ok('a too-short new password is refused', /Min\. 6/.test(await p.evaluate(() => document.getElementById('sd-rv-newpw-msg').textContent)) && puts === 0);
  await p.fill('#sd-rv-newpw', 'fresh-start-9'); await p.evaluate(() => { _SDA.doResetPw(); }); await p.waitForTimeout(1300);
  u = users().find(x => x.id === 'u3');
  ok('a valid new password is saved as a hash', /^pbkdf2\$/.test(u.passHash || '') && u.password === undefined && !JSON.stringify(db).includes('fresh-start-9') && !JSON.stringify(db).includes('forgotten-1'));
  ok('the other account was not touched', users().find(x => x.id === 'u-legacy').password === 'oldpass1');
  await p.evaluate(() => localStorage.removeItem('sd_auth_v1'));
  r = await signIn(p, 'rec@example.com', 'forgotten-1'); ok('the forgotten password no longer works', /Incorrect email or password/.test(r.err), JSON.stringify(r));
  await p.evaluate(() => localStorage.removeItem('sd_auth_v1'));
  r = await signIn(p, 'rec@example.com', 'fresh-start-9'); ok('the new one does', !r.err && r.session === 'user', JSON.stringify(r));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.c.close();

  // ── 6. the admin panel secures every old account in one go ──
  s = await fresh([legacy(), legacy({ id: 'u4', email: 'four@example.com', mobile: '9000000004', password: 'plain-four' }), legacy({ id: 'u5', email: 'five@example.com', mobile: '9000000005', password: undefined, passHash: 'pbkdf2$150000$' + 'ab'.repeat(16) + '$' + 'cd'.repeat(32) })]); p = s.p;
  puts = 0;
  await p.evaluate(() => _sdMigratePw(_SDA)); await p.waitForTimeout(2500);
  ok('every readable password in the list is replaced by a hash', users().filter(x => x.password !== undefined).length === 0 && users().filter(x => /^pbkdf2\$/.test(x.passHash || '')).length === 3 && !JSON.stringify(db).includes('plain-four') && !JSON.stringify(db).includes('oldpass1'), JSON.stringify(users().map(x => Object.keys(x).filter(k => /pass/.test(k)))));
  ok('an account that was already hashed keeps its hash', users().find(x => x.id === 'u5').passHash === 'pbkdf2$150000$' + 'ab'.repeat(16) + '$' + 'cd'.repeat(32));
  ok('it was one write, not one per account', puts === 1, 'writes: ' + puts);
  ok('opening the admin panel starts that clean-up', await p.evaluate(() => _SDA.startAdminPoll.toString().includes('_sdMigratePw')));
  ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.c.close();

  await b.close(); console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})();
