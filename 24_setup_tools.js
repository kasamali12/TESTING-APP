// v44: the two set-up tools (database address, admin password) work on the built page and change nothing else
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { spawnSync } = require('child_process');
const SRC = path.resolve(process.env.APP || path.join(__dirname, '..', 'index.html')); const TOOLS = path.join(__dirname, '..', 'tools');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const run = (tool, args, env) => spawnSync('python3', [path.join(TOOLS, tool), ...args], { encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-tools-')); const f = path.join(dir, 'index.html'); fs.copyFileSync(SRC, f);
  const orig = fs.readFileSync(f, 'utf8');
  const fb = s => (s.match(/FB:(["'])(https:\/\/[^"']+)\1/) || [])[2];
  const NEW = 'https://studydeck-test-default-rtdb.europe-west1.firebasedatabase.app';

  let r = run('set_firebase.py', [f, '--show']);
  ok('--show prints the address the page uses and changes nothing', r.status === 0 && r.stdout.includes(fb(orig)) && fs.readFileSync(f, 'utf8') === orig, r.stdout.trim().slice(0, 80));
  for (const bad of ['http://x-default-rtdb.firebaseio.com', 'https://evil.example.com', 'https://my-default-rtdb.firebaseio.com/studydeck_users', 'my-default-rtdb.firebaseio.com', 'https://a.firebaseio.com.evil.com']) {
    r = run('set_firebase.py', [f, bad]);
    ok('refuses "' + bad + '"', r.status !== 0 && fs.readFileSync(f, 'utf8') === orig);
  }
  r = run('set_firebase.py', [f, NEW + '/']);
  let now = fs.readFileSync(f, 'utf8');
  ok('accepts a real-looking address (a trailing slash is dropped)', r.status === 0 && fb(now) === NEW, r.stderr.trim());
  ok('only the address changed', now.replace(NEW, fb(orig)) === orig);
  r = run('set_firebase.py', [f, NEW]); ok('running it again with the same address changes nothing', r.status !== 0 && fs.readFileSync(f, 'utf8') === now);

  // the page really uses the new address
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 780 } }); const seen = [];
  await c.route('**/*', rt => { const u = rt.request().url(); if (/^(file|data|blob|about):/.test(u)) return rt.continue(); seen.push(u); if (u.startsWith(NEW + '/')) return rt.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); return rt.abort(); });
  await c.addInitScript(() => { try { localStorage.setItem('sd_terms_v2', '1'); localStorage.setItem('sd_intro_v2', '1'); } catch (e) {} });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + f, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.evaluate(() => { _sdDB_R(); _sdPay_R(); }); await p.waitForTimeout(600);
  ok('sign-in list and payment settings are read from the new address', seen.includes(NEW + '/studydeck_users.json') && seen.includes(NEW + '/studydeck_settings.json'), JSON.stringify(seen.filter(u => /json/.test(u))));
  ok('nothing is sent to the old address', !seen.some(u => u.startsWith(fb(orig))), '');
  ok('the page loads without errors', errs.length === 0, errs.join(' ; '));
  await b.close();

  // admin password tool
  const PW = 'Tool-Test-Pass-2026'; fs.copyFileSync(SRC, f);
  r = run('set_admin_password.py', [f, '--password-env', 'SD_PW'], { SD_PW: 'short' });
  ok('a short password is refused', r.status !== 0 && fs.readFileSync(f, 'utf8') === orig);
  r = run('set_admin_password.py', [f, '--password-env', 'SD_PW'], { SD_PW: PW });
  now = fs.readFileSync(f, 'utf8'); const pat = /AH:"([0-9a-f]{64})",AS:"([0-9a-f]{32})",AI:(\d+)/;
  const m = now.match(pat), m0 = orig.match(/AH:"([0-9a-f]{64})",AS:"([0-9a-f]{32})",AI:(?:15e4|150000)/);
  ok('it finds the admin hash in the built page and writes a new salted hash', r.status === 0 && m && m0 && m[1] !== m0[1] && m[2] !== m0[2] && m[3] === '150000', r.stdout.trim() + r.stderr.trim());
  ok('the password itself is not written anywhere', !now.includes(PW));
  ok('nothing else in the page changed', now.replace(pat, '').length === orig.replace(/AH:"[0-9a-f]{64}",AS:"[0-9a-f]{32}",AI:(?:15e4|150000)/, '').length && now.replace(pat, '') === orig.replace(/AH:"[0-9a-f]{64}",AS:"[0-9a-f]{32}",AI:(?:15e4|150000)/, ''));
  const expect = require('crypto').pbkdf2Sync(PW, Buffer.from(m[2], 'hex'), 150000, 32, 'sha256').toString('hex');
  ok('the stored hash is PBKDF2-SHA256 of that password with that salt (so the sign-in form will accept it)', m[1] === expect);
  ok('the page is still under the 2 MB limit', Buffer.byteLength(now) < 2000000, String(Buffer.byteLength(now)));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})();
