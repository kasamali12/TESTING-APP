// v50: an export over 48 MB is split into connected files of at most 48 MB each, and Import joins them again.
//   A. the real 48 MB limit, with a 72 MB library of pictures
//   B. many parts (small limit): header, order, one-by-one / all-at-once / missing / cut-short / damaged / two sets / JSON and HTML exports
//   C. the "Connected files" panel: tap size, Share, close, sepia, no timers
const L = require('./lib'); const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const OUT = path.resolve('out') + '/'; fs.mkdirSync(OUT, { recursive: true });
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const py = (code, ...args) => { const r = spawnSync('python3', ['-I', '-c', code, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout; };
const zipInfo = f => JSON.parse(py(`import zipfile,json,sys
z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({'bad':z.testzip(),'qs':json.loads(z.read('manifest.json'))['qs'],'n':len(z.namelist())}))`, f));
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const waitToast = async (p, re, ms = 40000) => { await p.waitForFunction(r => new RegExp(r).test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ')), re.source, { timeout: ms }); return toasts(p); };
const clearToasts = p => p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
const boot = async o => { const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true, ...(o || {}) }); await s.p.evaluate(() => navTo('lib')); await s.p.waitForTimeout(300); return s; };
const counts = p => p.evaluate(async () => ({ files: (await iAll('files')).length, q: (await iAll('questions')).length }));
const ZERO = '{"files":0,"q":0}';
const importFiles = (p, f) => p.setInputFiles('#fi-import', f);
// download collector: every file the page saves
const collect = p => { const dl = []; p.on('download', async d => { const f = OUT + 'pk33_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + d.suggestedFilename(); await d.saveAs(f); dl.push({ name: d.suggestedFilename(), file: f, size: fs.statSync(f).size }); }); return dl; };
const until = async (p, fn, ms = 60000) => { const t = Date.now(); while (!fn() && Date.now() - t < ms) await p.waitForTimeout(100); await p.waitForTimeout(200); };
const head = f => { const b = fs.readFileSync(f), i = b.indexOf('\n\n'); return { j: JSON.parse(b.slice(8, i).toString()), hl: i + 2, size: b.length, magic: b.slice(0, 8).toString(), b }; };

const BUILD = async a => {
  let sd = a.seed; const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const words = 'nerve supplies muscle artery vein bone lymph drainage branch origin insertion action clinical feature syndrome lesion injury palsy sign test'.split(' ');
  const sent = n => { const o = []; for (let i = 0; i < n; i++) o.push(words[Math.floor(rnd() * words.length)]); return o.join(' '); };
  const pic = n => { const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = Math.floor(rnd() * 256); let s = ''; for (let i = 0; i < n; i += 8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 8000)); return 'data:image/jpeg;base64,' + btoa(s); };
  const pics = []; for (let i = 0; i < a.imgs; i++) pics.push(pic(6000 + i * 37));
  const fid = 'f' + a.tag + Date.now(), tree = [{ name: 'Anatomy', pathKey: 'Anatomy', children: [] }];
  for (let c = 0; c < a.chapters; c++) {
    const qs = []; for (let i = 0; i < a.per; i++) { const n = c * a.per + i; qs.push({ q: 'Q' + n + ': ' + sent(14) + '?', opts: [sent(4), sent(4), sent(4), sent(4)], correct: n % 4, exp: sent(40), subject: 'anatomy', tags: 'T' + (n % 20), sid: a.tag + n, mcqId: 'ME' + n, qImg: n % 25 === 0 ? pics[(n / 25) % a.imgs] : undefined }); }
    await saveQuestions(fid, 'Anatomy\x00Chapter ' + c, qs); tree[0].children.push({ name: 'Chapter ' + c, pathKey: 'Anatomy\x00Chapter ' + c, children: [] });
  }
  await saveFileMeta(fid, a.name, a.chapters * a.per, tree); fileId = fid; fileName = a.name; return fid;
};
const BIG = async a => {   // distinct random pictures: they cannot be compressed, so the file is really as big as the pictures
  const fid = 'fbig' + Date.now(); const rnd = n => { const u = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(u.subarray(i, Math.min(n, i + 65536))); return u; };
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 8000)); return btoa(s); };
  for (let c = 0; c < a.chapters; c++) { const qs = []; for (let i = 0; i < a.per; i++) { const n = c * a.per + i; qs.push({ q: 'Big ' + n + '?', opts: ['a', 'b', 'c', 'd'], correct: 0, exp: 'e', sid: 'g' + n, qImg: 'data:image/jpeg;base64,' + b64(rnd(a.bytes)) }); } await saveQuestions(fid, 'Big\x00Ch ' + c, qs); }
  await saveFileMeta(fid, a.name, a.chapters * a.per, []); fileId = fid; fileName = a.name; return fid;
};
const FP = async fid => { const rows = (await iAll('questions')).filter(r => r.key.startsWith(fid + '__')).sort((x, y) => x.key < y.key ? -1 : 1); return rows.map(r => { const s = JSON.stringify(r.questions); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return r.key.slice(fid.length) + ':' + (h >>> 0) + ':' + s.length; }); };
const DUMP = async fid => (await iAll('questions')).filter(r => r.key.startsWith(fid + '__')).sort((x, y) => x.key < y.key ? -1 : 1).map(r => ({ k: r.key.slice(fid.length), q: r.questions }));
const freshPanel = p => p.evaluate(() => { const e = document.getElementById('sdp-parts'); if (e) e.remove(); });
const byPart = (a, b) => (+a.name.match(/part(\d+)of/)[1]) - (+b.name.match(/part(\d+)of/)[1]);
const wipe = async p => { await p.evaluate(async () => { for (const s of ['files', 'questions', 'scores']) for (const r of await iAll(s)) await iDel(s, r.key); invalidateFilesCache(); }); };

(async () => {
  // ═══ A. the real limit: a 72 MB library of pictures ═══
  const s1 = await boot(); const p1 = s1.p; const dl1 = collect(p1);
  const fidBig = await p1.evaluate(BIG, { name: 'Big images', chapters: 8, per: 9, bytes: 1000000 }); const fpBig = await p1.evaluate(FP, fidBig);
  await p1.evaluate(() => { window.__iv = []; const o = window.setInterval; window.setInterval = function (f, d) { window.__iv.push(d); return o.apply(this, arguments); }; });
  await p1.evaluate(() => openExportPicker()); await p1.waitForSelector('#expfmt-ov:not(.hidden)'); await p1.click('#efmt-sdpack');
  await p1.waitForSelector('#sdp-parts', { timeout: 120000 }); await p1.waitForTimeout(500);
  const pa = await p1.evaluate(() => { const e = document.getElementById('sdp-parts'); return { rows: e.querySelectorAll('.sdp-row').length, text: e.querySelector('.sdp-h').textContent, hint: e.querySelector('.sdp-hint').textContent }; });
  ok('a 72 MB export does not download by itself: a "Connected files" panel opens (' + pa.text + ')', pa.rows === 2 && /split into 2 connected files/.test(pa.text) && /over 48 MB/.test(pa.text));
  ok('nothing was saved yet, and the finished message names the files', dl1.length === 0 && /Pack ready/.test(await toasts(p1)) && /2 connected files \(max 48 MB each\)/.test(await toasts(p1)), await toasts(p1));
  await p1.click('#sdp-parts .sdp-one[data-i="0"]'); await until(p1, () => dl1.length >= 1); await p1.click('#sdp-parts .sdp-one[data-i="1"]'); await until(p1, () => dl1.length >= 2);
  const parts = dl1.slice().sort((a, b) => a.name < b.name ? -1 : 1);
  ok('two files, named part1of2 and part2of2', parts.length === 2 && /^Big_images_part1of2\.sdpack$/.test(parts[0].name) && /^Big_images_part2of2\.sdpack$/.test(parts[1].name), parts.map(p => p.name).join(','));
  ok('no file is over 48 MB (48,000,000 bytes): ' + parts.map(p => p.size).join(' + '), parts.every(p => p.size <= 48000000));
  ok('the first file is filled right up to the limit, not cut small', parts[0].size >= 47900000 && parts[1].size > 20000000);
  const h0 = head(parts[0].file), h1 = head(parts[1].file);
  ok('each file starts with its own label: same set, part 1/2 and 2/2, sizes that add up', h0.magic === 'SDPART1 ' && h0.j.set === h1.j.set && h0.j.n === 1 && h1.j.n === 2 && h0.j.of === 2 && h0.j.len + h1.j.len === h0.j.tot && h0.size === h0.hl + h0.j.len && h1.size === h1.hl + h1.j.len);
  ok('the panel says all files are saved', /All 2 files saved/.test(await p1.evaluate(() => document.querySelector('#sdp-parts .sdp-st').textContent)));
  // joined by hand the parts are one ordinary pack that Python accepts
  fs.writeFileSync(OUT + 'pk33_joined.sdpack', Buffer.concat([h0.b.subarray(h0.hl), h1.b.subarray(h1.hl)]));
  const zi = zipInfo(OUT + 'pk33_joined.sdpack'); ok('joined by hand the bytes are one valid ZIP pack with all 72 pictures', zi.bad === null && zi.qs === 72 && zi.n >= 72, JSON.stringify(zi));
  // import: both files at once
  const s2 = await boot(); const p2 = s2.p; const t0 = Date.now();
  await importFiles(p2, [parts[1].file, parts[0].file]); const m2 = await waitToast(p2, /Imported \d|damaged|do not belong|cut short/, 120000);
  ok('choosing both files together (even in the wrong order) imports them: "' + m2.slice(0, 70) + '" in ' + Math.round((Date.now() - t0) / 1000) + ' s', /Imported 72 questions · 1 deck/.test(m2));
  const fp2 = await p2.evaluate(FP, fidBig); ok('all 72 pictures and questions are identical (' + fp2.length + ' chapters)', JSON.stringify(fp2) === JSON.stringify(fpBig) && fp2.length === 8);
  ok('no page errors (72 MB export and import)', s1.errs.length === 0 && s2.errs.length === 0, s1.errs.concat(s2.errs).join(' | '));
  await s2.b.close();
  await p1.evaluate(async fid => { for (const s of ['files', 'questions']) for (const r of await iAll(s)) if (String(r.key).startsWith(fid)) await iDel(s, r.key); invalidateFilesCache(); }, fidBig); await p1.evaluate(() => document.getElementById('sdp-parts') && document.getElementById('sdp-parts').remove());
  dl1.length = 0;

  // ═══ B. many parts (the limit is lowered so a small deck needs 6 or more) ═══
  const D = { name: 'Anatomy: Parts Test', chapters: 24, per: 100, imgs: 12, seed: 21, tag: 'p' };
  const fid = await p1.evaluate(BUILD, D); const orig = await p1.evaluate(DUMP, fid);
  await p1.evaluate(() => { _sdPack.cfg.limit = 60000; });
  await p1.evaluate(() => { _exportDeckKey = fileId; _sdPack.export('deck'); }); await p1.waitForSelector('#sdp-parts', { timeout: 20000 });
  const nP = await p1.evaluate(() => document.querySelectorAll('#sdp-parts .sdp-one').length);
  ok('with a 60 KB limit the same deck needs ' + nP + ' connected files', nP >= 5);
  await p1.click('#sdp-parts .sdp-all'); await until(p1, () => dl1.length >= nP, 30000);
  ok('"Save all" saves every file (' + dl1.length + ' of ' + nP + ')', dl1.length === nP);
  const set = dl1.slice().sort(byPart);
  ok('every file is within the limit and their names run part1of' + nP + ' … part' + nP + 'of' + nP, set.every(f => f.size <= 60000) && set.every((f, i) => f.name === 'Anatomy__Parts_Test_part' + (i + 1) + 'of' + nP + '.sdpack'), set.map(f => f.size).join(','));
  const hs = set.map(f => head(f.file));
  ok('labels agree: one set id, consecutive numbers, sizes add up', hs.every((h, i) => h.j.set === hs[0].j.set && h.j.n === i + 1 && h.j.of === nP && h.size === h.hl + h.j.len) && hs.reduce((a, h) => a + h.j.len, 0) === hs[0].j.tot);
  fs.writeFileSync(OUT + 'pk33_joined2.sdpack', Buffer.concat(hs.map(h => h.b.subarray(h.hl)))); const zi2 = zipInfo(OUT + 'pk33_joined2.sdpack');
  ok('joined by hand: a valid ZIP pack with 2,400 questions', zi2.bad === null && zi2.qs === 2400);

  // all at once, shuffled
  const shuffled = set.map(f => f.file).reverse(); const sa = await boot(); await importFiles(sa.p, shuffled); const ma = await waitToast(sa.p, /Imported \d|do not belong|cut short|damaged/);
  ok('all files together, in reverse order: "' + ma.slice(0, 60) + '"', /Imported 2,400 questions · 1 deck/.test(ma));
  ok('the deck is identical', JSON.stringify(await sa.p.evaluate(DUMP, fid)) === JSON.stringify(orig));
  await sa.b.close();

  // one by one, in a strange order: nothing is imported until the last one arrives
  const sb = await boot(); const order = [2, 0, set.length - 1].concat([...Array(set.length).keys()].filter(i => i !== 0 && i !== 2 && i !== set.length - 1)); let firstMsg = '', preCount = null, lastMsg = '';
  for (let k = 0; k < order.length; k++) {
    await clearToasts(sb.p); await importFiles(sb.p, set[order[k]].file);
    if (k < order.length - 1) { const m = await waitToast(sb.p, /Got \d+ of \d+ files/); if (k === 0) firstMsg = m; if (k === order.length - 2) preCount = await counts(sb.p); } else lastMsg = await waitToast(sb.p, /Imported \d/);
  }
  ok('one file at a time: the first answer says how many are still needed (' + firstMsg.slice(0, 80) + ')', new RegExp('Got 1 of ' + nP + ' files\\. Still needed: part').test(firstMsg));
  ok('until the last file is chosen, nothing is imported', JSON.stringify(preCount) === ZERO, JSON.stringify(preCount));
  ok('the last file completes it: "' + lastMsg.slice(0, 50) + '" and the deck is identical', /Imported 2,400 questions/.test(lastMsg) && JSON.stringify(await sb.p.evaluate(DUMP, fid)) === JSON.stringify(orig));
  await sb.b.close();

  // one file missing, then added later
  const sc = await boot(); const without = set.filter((f, i) => i !== 3).map(f => f.file); await importFiles(sc.p, without); const mc = await waitToast(sc.p, /Still needed/);
  ok('a missing file is named: "' + mc.slice(0, 90) + '"', new RegExp('Got ' + (nP - 1) + ' of ' + nP + ' files\\. Still needed: part 4\\.').test(mc), mc);
  ok('and nothing is imported meanwhile', JSON.stringify(await counts(sc.p)) === ZERO); await clearToasts(sc.p);
  await importFiles(sc.p, set[3].file); const mc2 = await waitToast(sc.p, /Imported \d|cut short/); ok('adding the missing file later finishes the import', /Imported 2,400 questions/.test(mc2) && JSON.stringify(await sc.p.evaluate(DUMP, fid)) === JSON.stringify(orig), mc2.slice(0, 60));
  await sc.b.close();

  // a part that was cut short, then replaced by a good copy
  const sd = await boot(); const cutf = OUT + 'pk33_cut_part2.sdpack'; fs.writeFileSync(cutf, hs[1].b.subarray(0, Math.floor(hs[1].size * 0.6)));
  await importFiles(sd.p, set.map((f, i) => i === 1 ? cutf : f.file)); const md = await waitToast(sd.p, /cut short|Imported|Still needed/);
  ok('a part that was cut short is named and refused: "' + md.slice(0, 100) + '"', /Part 2 of \d+ is cut short/.test(md), md);
  ok('nothing is imported', JSON.stringify(await counts(sd.p)) === ZERO); await clearToasts(sd.p);
  await importFiles(sd.p, set[1].file); const md2 = await waitToast(sd.p, /Imported \d|cut short/);
  ok('the good copy of that part completes the set (the others were remembered)', /Imported 2,400 questions/.test(md2), md2.slice(0, 60)); await sd.b.close();

  // a part with a changed byte: the pack's own checks catch it and nothing is kept
  const se = await boot(); const bad = Buffer.from(hs[2].b); bad[Math.floor(bad.length * 0.5)] ^= 0xff; const badf = OUT + 'pk33_flip_part3.sdpack'; fs.writeFileSync(badf, bad);
  await importFiles(se.p, set.map((f, i) => i === 2 ? badf : f.file)); const me = await waitToast(se.p, /damaged|cut short|Imported \d/);
  ok('a changed byte inside a part is caught: "' + me.slice(0, 90) + '"', /damaged|cut short/.test(me) && !/Imported/.test(me));
  ok('and the half-imported deck is removed again', JSON.stringify(await counts(se.p)) === ZERO); await se.b.close();

  // parts of two different exports chosen together
  await freshPanel(p1); dl1.length = 0; await p1.evaluate(() => { _exportDeckKey = fileId; _sdPack.export('deck'); }); await p1.waitForSelector('#sdp-parts', { timeout: 20000 });
  await p1.click('#sdp-parts .sdp-all'); await until(p1, () => dl1.length >= nP, 30000); const set2 = dl1.slice();
  const sf = await boot(); await importFiles(sf.p, set.map(f => f.file).concat(set2.map(f => f.file))); await sf.p.waitForFunction(() => iAll('files').then(f => f.length >= 2), null, { timeout: 60000 }); await sf.p.waitForTimeout(500);
  const two = await sf.p.evaluate(async () => (await iAll('files')).map(f => f.name).sort());
  ok('two exports chosen together are told apart by their set id: both import, the second as "(2)"', two.length === 2 && two[0] === D.name && two[1] === D.name + ' (2)', JSON.stringify(two)); await sf.b.close();

  // regular files are untouched: two ordinary packs chosen together import the first one, as before
  await p1.evaluate(() => { _sdPack.cfg.limit = 48000000; }); await freshPanel(p1); dl1.length = 0;
  const single = await p1.evaluate(async () => { _exportDeckKey = fileId; const r = await _sdPack.export('deck'); return { parts: r.parts }; }); await until(p1, () => dl1.length >= 1);
  ok('under the limit nothing changes: one normal download and no panel', single.parts === 1 && dl1.length === 1 && /\.sdpack$/.test(dl1[0].name) && !/_part\d/.test(dl1[0].name) && !(await p1.evaluate(() => !!document.getElementById('sdp-parts'))), dl1.map(d => d.name).join(','));
  const sg = await boot(); await importFiles(sg.p, [dl1[0].file, dl1[0].file]); const mg = await waitToast(sg.p, /Imported \d/); ok('two normal packs chosen together: the first is imported, nothing breaks', /Imported 2,400 questions · 1 deck/.test(mg) && (await sg.p.evaluate(async () => (await iAll('files')).length)) === 1); await sg.b.close();

  // other exports are split too: JSON and the HTML study sheet
  await p1.evaluate(() => { _sdPack.cfg.limit = 400000; });
  await freshPanel(p1); dl1.length = 0; await p1.evaluate(() => { _exportDeckKey = fileId; exportJSON(); }); await p1.waitForSelector('#sdp-parts', { timeout: 20000 });
  const nJ = await p1.evaluate(() => document.querySelectorAll('#sdp-parts .sdp-one').length); await p1.click('#sdp-parts .sdp-all'); await until(p1, () => dl1.length >= nJ, 30000);
  ok('a JSON export of 2,400 questions is split too (' + nJ + ' files under 400 KB)', nJ >= 5 && dl1.length === nJ && dl1.every(f => f.size <= 400000) && /^Anatomy__Parts_Test_part1of\d+\.sdpack$/.test(dl1.slice().sort(byPart)[0].name), dl1.map(f => f.name + ':' + f.size).join(' '));
  const sh = await boot(); await importFiles(sh.p, dl1.map(f => f.file)); const mh = await waitToast(sh.p, /Imported|Error|not|damaged/, 40000);
  const nq = await sh.p.evaluate(async () => (await iAll('questions')).reduce((a, r) => a + (r.questions || []).length, 0));
  ok('the JSON parts join and open as the original deck again (' + nq + ' questions): "' + mh.slice(0, 60) + '"', nq === 2400);
  await sh.b.close();
  await clearToasts(p1); await freshPanel(p1);
  dl1.length = 0; await p1.evaluate(() => { _sdPack.cfg.limit = 1e9; }); await p1.evaluate(() => { _exportDeckKey = fileId; exportHTML(); }); await until(p1, () => dl1.length >= 1, 20000); const whole = dl1[0];
  await p1.evaluate(() => { _sdPack.cfg.limit = 400000; }); dl1.length = 0; await freshPanel(p1); await p1.evaluate(() => { _exportDeckKey = fileId; exportHTML(); }); await p1.waitForSelector('#sdp-parts', { timeout: 20000 });
  const nH = await p1.evaluate(() => document.querySelectorAll('#sdp-parts .sdp-one').length); await p1.click('#sdp-parts .sdp-all'); await until(p1, () => dl1.length >= nH, 30000); const hp = dl1.slice();
  ok('an HTML study sheet bigger than the limit is split as well (' + nH + ' files)', nH >= 2 && hp.every(f => f.size <= 400000) && whole.size > 400000, whole.size + ' bytes whole');
  dl1.length = 0; const sj = await boot(); const dlj = collect(sj.p); await importFiles(sj.p, hp.map(f => f.file)); await until(sj.p, () => dlj.length >= 1, 20000);
  ok('choosing the parts of an HTML export joins them and saves the original file back, byte for byte', dlj.length === 1 && dlj[0].name === whole.name && fs.readFileSync(dlj[0].file).equals(fs.readFileSync(whole.file)), (dlj[0] || {}).name + ' vs ' + whole.name);
  await sj.b.close();

  // ═══ C. the panel itself ═══
  await p1.evaluate(() => { _sdPack.cfg.limit = 60000; document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.removeAttribute('data-amoled'); window.__shared = null; navigator.canShare = () => false; navigator.share = async d => { window.__shared = d; }; });
  await p1.evaluate(() => { document.getElementById('sdp-parts') && document.getElementById('sdp-parts').remove(); _exportDeckKey = fileId; _sdPack.export('deck'); }); await p1.waitForSelector('#sdp-parts', { timeout: 20000 });
  ok('no Share button when the phone cannot share files', await p1.evaluate(() => !document.querySelector('#sdp-parts .sdp-sh')));
  await p1.evaluate(() => { navigator.canShare = d => !!(d && d.files && d.files.length); document.getElementById('sdp-parts').remove(); _exportDeckKey = fileId; _sdPack.export('deck'); }); await p1.waitForSelector('#sdp-parts .sdp-sh', { timeout: 20000 });
  const ui = await p1.evaluate(() => { const e = document.getElementById('sdp-parts'), r = x => x.getBoundingClientRect(), b = [...e.querySelectorAll('button')].map(x => Math.round(r(x).height) + 'x' + Math.round(r(x).width)), bs = [...e.querySelectorAll('button')]; return { bg: getComputedStyle(e).backgroundColor, small: bs.filter(x => r(x).height < 44 || r(x).width < 44).length, fits: r(e).left >= 0 && r(e).right <= innerWidth && r(e).bottom <= innerHeight, role: e.getAttribute('role'), label: e.getAttribute('aria-label'), live: e.querySelector('.sdp-st').getAttribute('aria-live'), x: e.querySelector('.sdp-x').getAttribute('aria-label'), n: bs.length, scroll: e.scrollHeight > e.clientHeight ? getComputedStyle(e).overflowY : 'fits' }; });
  ok('every button in the panel is at least 44 px (' + ui.n + ' buttons)', ui.small === 0 && ui.n >= 8);
  ok('the panel fits the screen, is labelled for screen readers and scrolls if it is long', ui.fits && ui.role === 'region' && ui.label === 'Connected files' && ui.live === 'polite' && ui.x === 'Close' && (ui.scroll === 'fits' || ui.scroll === 'auto'), JSON.stringify(ui));
  ok('in the dark theme the panel is warm sepia brown, not blue-grey (' + ui.bg + ')', rgb(ui.bg)[0] > rgb(ui.bg)[2]);
  await p1.click('#sdp-parts .sdp-sh'); await p1.waitForTimeout(300); const sh2 = await p1.evaluate(() => window.__shared && { n: window.__shared.files.length, names: window.__shared.files.map(f => f.name) });
  ok('Share hands all the files to the share sheet at once', sh2 && sh2.n === nP && sh2.names.every(n => /_part\d+of\d+\.sdpack$/.test(n)), JSON.stringify(sh2));
  await p1.evaluate(() => { window.__cf = []; window.confirm = m => { window.__cf.push(m); return false; }; });
  await p1.click('#sdp-parts .sdp-x'); await p1.waitForTimeout(300);
  const dlg = await p1.evaluate(() => window.__cf.slice());
  ok('closing before everything is saved asks first, and "Cancel" keeps the panel', dlg.length === 1 && /not saved yet/.test(dlg[0]) && await p1.evaluate(() => !!document.getElementById('sdp-parts')), dlg[0]);
  await p1.evaluate(() => { window.confirm = () => true; }); await p1.click('#sdp-parts .sdp-x'); await p1.waitForTimeout(300);
  ok('"OK" closes it', await p1.evaluate(() => !document.getElementById('sdp-parts')));
  // a full backup in parts: the "backed up" reminder is only cleared when every file is saved
  await p1.evaluate(() => { localStorage.removeItem('sd-v39-last-backup'); }); dl1.length = 0;
  await p1.evaluate(() => { _sdPack.export('all'); }); await p1.waitForSelector('#sdp-parts', { timeout: 20000 });
  const nAll = await p1.evaluate(() => document.querySelectorAll('#sdp-parts .sdp-one').length);
  ok('a full backup needs several files too (' + nAll + ')', nAll >= 5);
  for (let i = 0; i < nAll - 1; i++) await p1.click('#sdp-parts .sdp-one[data-i="' + i + '"]'); await until(p1, () => dl1.length >= nAll - 1);
  ok('with one file still unsaved the backup is not counted as done', (await p1.evaluate(() => localStorage.getItem('sd-v39-last-backup'))) === null && /(\d+) of \d+ saved/.test(await p1.evaluate(() => document.querySelector('#sdp-parts .sdp-st').textContent)));
  await p1.click('#sdp-parts .sdp-one[data-i="' + (nAll - 1) + '"]'); await until(p1, () => dl1.length >= nAll);
  ok('saving the last file counts it as backed up', /^\d+$/.test(await p1.evaluate(() => localStorage.getItem('sd-v39-last-backup') || '')) && dl1.every(f => /^StudyDeck_backup_\d{4}-\d{2}-\d{2}_part\d+of\d+\.sdpack$/.test(f.name)), dl1.map(f => f.name)[0]);
  const iv = await p1.evaluate(() => window.__iv.slice()); ok('the panel starts no repeating timer', iv.length === 0, JSON.stringify(iv));
  ok('no page errors (parts)', s1.errs.length === 0, s1.errs.join(' | '));
  await s1.b.close(); console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
