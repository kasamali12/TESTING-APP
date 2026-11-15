// Runs every NN_*.js check against index.html, one browser per file.
//   node run.js                 all checks
//   node run.js 07 12           only the checks whose file name starts with 07 or 12
//   APP=/path/to/page.html node run.js     test another build
// A check fails when it exits with a non-zero code or prints a line that starts with "FAIL ".
// A failing check is run once more before it counts, because a slow machine can miss a timing window.
const { spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const here = __dirname;
const app = path.resolve(process.env.APP || path.join(here, '..', 'index.html'));
if (!fs.existsSync(app)) { console.error('Cannot find the page to test: ' + app); process.exit(2); }
fs.mkdirSync(path.join(here, 'out'), { recursive: true });

const want = process.argv.slice(2);
const files = fs.readdirSync(here).filter(f => /^\d\d_.*\.js$/.test(f)).sort()
  .filter(f => !want.length || want.some(w => f.startsWith(w)));
if (!files.length) { console.error('No checks match ' + want.join(', ')); process.exit(2); }

function once(file) {
  const r = spawnSync(process.execPath, [file], { cwd: here, env: { ...process.env, APP: app }, encoding: 'utf8', timeout: 5 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split(/\r?\n/);
  const pass = lines.filter(l => /^PASS /.test(l)).length;
  const fails = lines.filter(l => /^FAIL /.test(l));
  const crashed = r.error || r.status !== 0;
  return { ok: !crashed && fails.length === 0, pass, fails, out, status: r.status, error: r.error && r.error.message };
}

console.log('Testing ' + app + ' (' + fs.statSync(app).size.toLocaleString('en-US') + ' bytes)\n');
let bad = 0, total = 0; const t0 = Date.now();
for (const f of files) {
  const t1 = Date.now(); let r = once(f), retried = false;
  if (!r.ok) { retried = true; r = once(f); }
  total += r.pass;
  const secs = ((Date.now() - t1) / 1000).toFixed(0).padStart(3) + 's';
  console.log((r.ok ? 'ok  ' : 'FAIL') + '  ' + f.padEnd(30) + String(r.pass).padStart(3) + ' checks' + secs + (retried && r.ok ? '  (passed on the second run)' : ''));
  if (!r.ok) {
    bad++;
    r.fails.slice(0, 8).forEach(l => console.log('        ' + l.slice(0, 220)));
    if (!r.fails.length) console.log('        ' + (r.error || 'exit code ' + r.status) + '\n' + r.out.split(/\r?\n/).slice(-12).map(l => '        ' + l.slice(0, 220)).join('\n'));
  }
}
console.log('\n' + (bad ? bad + ' of ' + files.length + ' checks failed' : 'All ' + files.length + ' checks passed') + ' · ' + total + ' assertions · ' + ((Date.now() - t0) / 1000 / 60).toFixed(1) + ' min');
process.exit(bad ? 1 : 0);
