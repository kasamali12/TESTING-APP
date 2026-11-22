// v50: the StudyDeck Pack (.sdpack) — a small, fast, battery-light export with a one-tap import.
//   export: valid ZIP, text compressed, every image stored once as raw bytes, smaller than JSON, no long freezes, no timers left running
//   import: every question comes back identical (images, tags, folder tree), progress/tests/difficulty restored, existing decks never overwritten
//   safety: a cut-off or damaged file gives a plain message and leaves nothing behind; non-pack ZIPs and newer packs are explained; the old v38 JSON backup now restores
//   devices: Share button only where the phone can share files; works without CompressionStream (stored entries); sepia dark theme
const L = require('./lib'); const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const OUT = path.resolve('out') + '/'; fs.mkdirSync(OUT, { recursive: true });
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

// ── helpers ──
const py = (code, ...args) => { const r = spawnSync('python3', ['-I', '-c', code, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout; };
const zipInfo = f => JSON.parse(py(`import zipfile,json,sys
z=zipfile.ZipFile(sys.argv[1]); bad=z.testzip()
d={'bad':bad,'sizes':{i.filename:[i.file_size,i.compress_size,i.compress_type] for i in z.infolist()}}
d['manifest']=json.loads(z.read('manifest.json')); d['meta']=json.loads(z.read('meta.json')); print(json.dumps(d))`, f));
const damage = (src, dst, entry, how) => py(`import zipfile,sys,struct
src,dst,name,how=sys.argv[1:5]; data=bytearray(open(src,'rb').read()); i=zipfile.ZipFile(src).getinfo(name)
o=i.header_offset; nl,el=struct.unpack('<HH',data[o+26:o+30]); st=o+30+nl+el
if how=='flip': data[st+i.compress_size//2]^=0xFF
open(dst,'wb').write(data)`, src, dst, entry, how);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const waitToast = async (p, re, ms = 40000) => { await p.waitForFunction(r => new RegExp(r).test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ')), re.source, { timeout: ms }); return toasts(p); };
const grab = async (p, fn) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), fn()]); const f = OUT + 'pk32_' + Date.now() + '_' + d.suggestedFilename(); await d.saveAs(f); return { file: f, name: d.suggestedFilename(), size: fs.statSync(f).size }; };
const boot = async o => { const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true, ...(o || {}) }); await s.p.evaluate(() => navTo('lib')); await s.p.waitForTimeout(300); return s; };
const counts = p => p.evaluate(async () => ({ files: (await iAll('files')).length, q: (await iAll('questions')).length, scores: (await iAll('scores')).length }));
const importFile = (p, f) => p.setInputFiles('#fi-import', f);

// builds a deck through the app's own storage functions: images repeat (stored once in a pack), one question has the pack's own marker characters in its text
const BUILD = async a => {
  let sd = a.seed; const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const words = 'nerve supplies muscle artery vein bone lymph drainage branch origin insertion action clinical feature syndrome lesion injury palsy sign test'.split(' ');
  const sent = n => { const o = []; for (let i = 0; i < n; i++) o.push(words[Math.floor(rnd() * words.length)]); return o.join(' '); };
  const pic = (n, mime) => { const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = Math.floor(rnd() * 256); let s = ''; for (let i = 0; i < n; i += 8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 8000)); return 'data:' + mime + ';base64,' + btoa(s); };
  const pics = []; for (let i = 0; i < a.imgs; i++) pics.push(pic(6000 + i * 37, i % 3 === 0 ? 'image/png' : 'image/jpeg'));
  const svg = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
  const fid = 'f' + a.tag + Date.now(), tree = [{ name: 'Anatomy', pathKey: 'Anatomy', children: [] }];
  for (let c = 0; c < a.chapters; c++) {
    const qs = [];
    for (let i = 0; i < a.per; i++) {
      const n = c * a.per + i;
      qs.push({ q: (n === 7 ? 'Literal marker ⟦i0⟧ stays text. ' : '') + 'Q' + n + ': ' + sent(14) + '?', opts: [sent(4), sent(4), sent(4), sent(4)], correct: n % 4, exp: sent(40) + (n % 97 === 3 ? ' <img src="' + svg + '"> and <img src="' + pics[0] + '">' : ''), subject: 'anatomy', tags: 'T' + (n % 20) + ',Ünïcode ✓', sid: a.tag + n, mcqId: 'ME' + n, qImg: n % 25 === 0 ? pics[(n / 25) % a.imgs] : undefined });
    }
    await saveQuestions(fid, 'Anatomy\x00Chapter ' + c, qs); tree[0].children.push({ name: 'Chapter ' + c, pathKey: 'Anatomy\x00Chapter ' + c, children: [] });
  }
  await saveFileMeta(fid, a.name, a.chapters * a.per, tree); fileId = fid; fileName = a.name;
  return { fid, uniq: new Set([...pics, svg]).size };
};
const DUMP = async fid => { const f = (await iAll('files')).find(x => x.key === fid), q = (await iAll('questions')).filter(r => r.key.startsWith(fid + '__')).sort((x, y) => x.key < y.key ? -1 : 1).map(r => ({ k: r.key.slice(fid.length), q: r.questions })); return { f: f && { name: f.name, total: f.total, at: f.at, tree: f.treeData }, q }; };

(async () => {
  const A = { name: 'Anatomy: Pack Test', chapters: 24, per: 100, imgs: 12, seed: 11, tag: 'a' };
  const files = {};

  // ═══ 1. export from the app ═══
  const s1 = await boot(); const p1 = s1.p;
  const built = await p1.evaluate(BUILD, A); const orig = await p1.evaluate(DUMP, built.fid);
  ok('test deck built (' + orig.q.reduce((a, r) => a + r.q.length, 0) + ' questions, ' + built.uniq + ' different pictures)', orig.q.reduce((a, r) => a + r.q.length, 0) === 2400);
  await p1.evaluate(() => { window.__iv = []; const o = window.setInterval; window.setInterval = function (f, d) { window.__iv.push(d); return o.apply(this, arguments); }; window.__long = 0; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long = Math.max(window.__long, e.duration))).observe({ entryTypes: ['longtask'] }); } catch (e) { } });
  await p1.evaluate(() => { openExportPicker(); }); await p1.waitForSelector('#expfmt-ov:not(.hidden)', { timeout: 5000 });
  const pick = await p1.evaluate(() => { const o = document.querySelector('#expfmt-ov .exp-fmt-body'), c = [...o.children].map(e => e.id), r = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().height : 0; }; return { order: c.slice(0, 3), h1: r('efmt-sdpack'), h2: r('efmt-sdpackall'), json: (document.querySelector('#efmt-json .efc-badge') || {}).textContent, txt: document.getElementById('efmt-sdpack').textContent }; });
  ok('the export menu offers StudyDeck Pack first, then the all-decks backup', pick.order[0] === 'efmt-sdpack' && pick.order[1] === 'efmt-sdpackall', pick.order.join(','));
  ok('both new cards are big enough to tap (' + Math.round(pick.h1) + ' / ' + Math.round(pick.h2) + ' px)', pick.h1 >= 44 && pick.h2 >= 44);
  ok('JSON is now labelled as the large option, not the recommended one', pick.json === 'Large file', pick.json);
  ok('the card text only promises what is true (compressed, photos once)', /up to 5×/.test(pick.txt) && /once/.test(pick.txt) && !/fastest/i.test(pick.txt));
  const t0 = Date.now(); const dPack = await grab(p1, () => p1.click('#efmt-sdpack')); const wall = Date.now() - t0; files.pack = dPack.file;
  const done = await waitToast(p1, /Pack saved/);
  ok('tapping the card downloads <deck>.sdpack', dPack.name === 'Anatomy__Pack_Test.sdpack', dPack.name);
  ok('the finished message says how many questions, the size and the time', /2,400 questions/.test(done) && /(MB|KB)/.test(done) && /\d\.\d s/.test(done), done);
  const info = zipInfo(dPack.file), M = info.manifest, imgEntries = Object.keys(info.sizes).filter(n => /^i\//.test(n)), qEntries = Object.keys(info.sizes).filter(n => /^q\//.test(n));
  ok('the file is a normal ZIP that Python reads and whose checksums all pass', info.bad === null);
  ok('manifest names the app, version, deck and counts', M.app === 'studydeck' && M.v === 3 && M.kind === 'deck' && M.qs === 2400 && M.decks.length === 1 && M.decks[0].name === A.name, JSON.stringify({ v: M.v, kind: M.kind, qs: M.qs }));
  ok('questions are split in pieces under ~1 MB each (' + qEntries.length + ' pieces)', qEntries.length >= 2 && qEntries.every(n => info.sizes[n][0] < 1000000));
  ok('text is compressed (deflate) and at least 4× smaller than its plain size', qEntries.every(n => info.sizes[n][2] === 8) && qEntries.reduce((a, n) => a + info.sizes[n][0], 0) / qEntries.reduce((a, n) => a + info.sizes[n][1], 0) > 4);
  ok('every picture is stored once, as raw bytes (' + imgEntries.length + ' files for ' + built.uniq + ' different pictures)', imgEntries.length === built.uniq && imgEntries.filter(n => M.imgs[+n.slice(2)] !== 'image/svg+xml').every(n => info.sizes[n][2] === 0));
  ok('pictures are the real size: base64 text turned back into bytes (3/4 of the text)', imgEntries.some(n => info.sizes[n][0] >= 6000 && info.sizes[n][0] < 6200));
  const dJson = await grab(p1, () => p1.evaluate(() => { _exportDeckKey = window.__fid || fileId; return exportJSON(); })); await p1.waitForTimeout(300);
  ok('the pack is smaller than the JSON export of the same deck (' + (dPack.size / 1048576).toFixed(2) + ' MB vs ' + (dJson.size / 1048576).toFixed(2) + ' MB)', dPack.size < dJson.size * 0.8);
  const lt = await p1.evaluate(() => Math.round(window.__long)), iv = await p1.evaluate(() => window.__iv.slice());
  ok('the screen never froze for more than a quarter second while packing (longest ' + lt + ' ms)', lt < 250);
  ok('packing finished quickly (' + wall + ' ms for 2,400 questions)', wall < 15000);
  ok('export leaves no repeating timer running in the background', iv.length === 0, JSON.stringify(iv));
  files.json = dJson.file;

  // ═══ 2. the same pack opens in a fresh app, everything identical ═══
  const s2 = await boot(); const p2 = s2.p;
  await p2.evaluate(() => { window.__iv = []; const o = window.setInterval; window.setInterval = function (f, d) { window.__iv.push(d); return o.apply(this, arguments); }; });
  const ti = Date.now(); await importFile(p2, dPack.file); const msg2 = await waitToast(p2, /Imported \d/); const impMs = Date.now() - ti;
  ok('one tap on the file imports it: "' + msg2.slice(0, 90) + '"', /Imported 2,400 questions · 1 deck/.test(msg2));
  const back = await p2.evaluate(DUMP, built.fid);
  ok('same deck name, count and folder tree', back.f && back.f.name === A.name && back.f.total === 2400 && typeof back.f.at === 'number' && JSON.stringify(back.f.tree) === JSON.stringify(orig.f.tree), JSON.stringify([back.f, orig.f]).slice(0, 700));
  ok('all ' + back.q.length + ' chapters are back', back.q.length === orig.q.length && back.q.length === 24);
  ok('every question, option, tag, picture and explanation is identical', JSON.stringify(back.q) === JSON.stringify(orig.q));
  const spot = back.q.flatMap(r => r.q);
  ok('text that looks like the pack\'s own picture marker is kept as text', spot.some(q => q.q.indexOf('Literal marker ⟦i0⟧ stays text.') === 0) && spot.filter(q => q.qImg).length === 96);
  ok('after import the library is shown with the new deck', await p2.evaluate(() => { const l = document.getElementById('slib'); return !!l && !l.classList.contains('hidden') && /Anatomy: Pack Test/.test(document.body.innerText); }));
  ok('importing took ' + impMs + ' ms and started no repeating timer', impMs < 15000 && (await p2.evaluate(() => window.__iv.length)) === 0);
  // the same file again: a copy is added, nothing is overwritten
  await p2.evaluate(() => navTo('lib')); await p2.waitForTimeout(300); await p2.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await importFile(p2, dPack.file); await waitToast(p2, /Imported \d/);
  const twice = await p2.evaluate(async () => (await iAll('files')).map(f => f.name).sort());
  ok('the same deck imported twice becomes "(2)" and the first one stays untouched', twice.length === 2 && twice[0] === A.name && twice[1] === A.name + ' (2)', JSON.stringify(twice));
  ok('the first copy is still identical', JSON.stringify((await p2.evaluate(DUMP, built.fid)).q) === JSON.stringify(orig.q));
  // renamed file: detected by its content, not its name
  fs.copyFileSync(dPack.file, OUT + 'pk32_renamed.zip'); fs.copyFileSync(dPack.file, OUT + 'pk32_renamed.bin');
  const s2b = await boot(); await importFile(s2b.p, OUT + 'pk32_renamed.zip'); const m2b = await waitToast(s2b.p, /Imported \d|not a StudyDeck/);
  ok('a pack renamed to .zip still opens', /Imported 2,400 questions/.test(m2b), m2b.slice(0, 80));
  await s2b.b.close();
  const s2c = await boot(); await importFile(s2c.p, OUT + 'pk32_renamed.bin'); const m2c = await waitToast(s2c.p, /Imported \d|Please|Unsupported|not/);
  ok('a pack renamed to .bin still opens', /Imported 2,400 questions/.test(m2c), m2c.slice(0, 80));
  await s2c.b.close();
  ok('no page errors (export + import)', s1.errs.length === 0 && s2.errs.length === 0, s1.errs.concat(s2.errs).join(' | '));

  // ═══ 3. full backup: all decks + progress ═══
  const B = { name: 'Pharmacology', chapters: 3, per: 40, imgs: 4, seed: 5, tag: 'b' };
  const built2 = await p1.evaluate(BUILD, B);
  await p1.evaluate(async ([a, b]) => {
    await iPut('scores', { key: a + '__stars', val: ['a5', 'a9'] }); await iPut('scores', { key: a + '__sess', val: [{ at: 1700000000000, n: 20, right: 15 }] }); await iPut('scores', { key: a + '__Anatomy\x00Chapter 1', val: { right: 7, total: 10 } });
    await iPut('scores', { key: b + '__stars', val: ['b3'] }); await iPut('difficulty', { key: 'a5', val: 2 }); await iPut('difficulty', { key: 'b3', val: 1 }); await iPut('tests', { key: 'test_1', name: 'Mock 1', score: 123, at: 1700000000000 });
    localStorage.setItem('sd-srs-data', JSON.stringify({ a5: { lastSeen: 100, box: 3 } })); localStorage.setItem('sd-xp', '777'); localStorage.setItem('sd-my-neet-category', 'OBC');
    localStorage.setItem('sd-rank-me', JSON.stringify({ name: 'Secret', uid: 'u123' })); localStorage.setItem('sd-auth-session', 'tok_abc'); localStorage.setItem('sd-pin', '4321');
  }, [built.fid, built2.fid]);
  await p1.evaluate(() => navTo('set')); await p1.waitForTimeout(300);
  const dAll = await grab(p1, () => p1.evaluate(() => document.querySelector('button[onclick="exportAllData()"]').click())); files.all = dAll.file;
  ok('Settings → Export full backup now saves one small .sdpack', /^StudyDeck_backup_\d{4}-\d{2}-\d{2}\.sdpack$/.test(dAll.name), dAll.name);
  await waitToast(p1, /Pack saved/);
  const ia = zipInfo(dAll.file);
  ok('the backup is a valid ZIP with both decks', ia.bad === null && ia.manifest.kind === 'all' && ia.manifest.decks.length === 2 && ia.manifest.qs === 2400 + 120);
  ok('progress is inside: stars, sessions, scores, difficulty and test results', ia.meta.scores.some(s => /__stars$/.test(s.key)) && ia.meta.scores.some(s => /__sess$/.test(s.key)) && ia.meta.scores.length === 4 && ia.meta.diff.length === 2 && ia.meta.tests.length === 1, JSON.stringify({ sc: ia.meta.scores.length, d: ia.meta.diff.length, t: ia.meta.tests.length }));
  ok('only learning settings are saved (spaced-repetition data, XP, NEET category)', JSON.stringify(Object.keys(ia.meta.ls).sort()) === JSON.stringify(['sd-my-neet-category', 'sd-srs-data', 'sd-xp']), Object.keys(ia.meta.ls).join(','));
  const raw = py(`import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); print(z.read('meta.json').decode()+z.read('manifest.json').decode())`, dAll.file);
  ok('nothing private leaves the phone: no login, PIN or leaderboard identity in the file', !/sd-rank|sd-auth|tok_abc|4321|u123|Secret/.test(raw));

  // restore on a fresh device
  const s3 = await boot(); const p3 = s3.p; await importFile(p3, dAll.file); const m3 = await waitToast(p3, /Imported \d|damaged/);
  ok('backup restores: "' + m3.slice(0, 120) + '"', /Imported 2,520 questions · 2 decks/.test(m3) && /1 test result( |$)/.test(m3) && !/1 test results/.test(m3));
  const R = await p3.evaluate(async ids => { const sc = await iAll('scores'), g = k => (sc.find(x => x.key === k) || {}).val; return { stars: g(ids[0] + '__stars'), sess: g(ids[0] + '__sess'), ch: g(ids[0] + '__Anatomy\x00Chapter 1'), st2: g(ids[1] + '__stars'), diff: (await iAll('difficulty')).map(d => d.key + ':' + d.val).sort(), tests: (await iAll('tests')).map(t => t.name), ls: ['sd-srs-data', 'sd-xp', 'sd-my-neet-category', 'sd-rank-me', 'sd-auth-session', 'sd-pin'].map(k => localStorage.getItem(k)) }; }, [built.fid, built2.fid]);
  ok('stars, session history and chapter scores are back for each deck', JSON.stringify(R.stars) === '["a5","a9"]' && R.sess && R.sess[0].right === 15 && R.ch && R.ch.right === 7 && JSON.stringify(R.st2) === '["b3"]', JSON.stringify(R).slice(0, 500));
  ok('difficulty marks and test results are back', JSON.stringify(R.diff) === '["a5:2","b3:1"]' && R.tests[0] === 'Mock 1', JSON.stringify(R.diff));
  ok('learning settings are back and private keys were never created', R.ls[0] && JSON.parse(R.ls[0]).a5.box === 3 && R.ls[1] === '777' && R.ls[2] === 'OBC' && R.ls[3] === null && R.ls[4] === null && R.ls[5] === null);
  const b2 = await p3.evaluate(DUMP, built2.fid), o2 = await p1.evaluate(DUMP, built2.fid);
  ok('second deck is identical too', JSON.stringify(b2) === JSON.stringify(o2) && b2.q.length === 3);
  // merge, never overwrite: progress made on the new device before restoring again is kept
  await p3.evaluate(async fid => { await iPut('scores', { key: fid + '__stars', val: ['mine'] }); }, built.fid); await p3.evaluate(() => { navTo('lib'); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await p3.waitForTimeout(300);
  await importFile(p3, dAll.file); const m3b = await waitToast(p3, /Imported \d|damaged|already/);
  const kept = await p3.evaluate(async fid => ({ stars: ((await iAll('scores')).find(x => x.key === fid + '__stars') || {}).val, files: (await iAll('files')).length }), built.fid);
  ok('restoring a backup over existing decks keeps what is already there (' + m3b.slice(0, 60) + ')', /^Nothing new: 2 decks already here \(kept\)\.?/.test(m3b) && JSON.stringify(kept.stars) === '["mine"]' && kept.files === 2, JSON.stringify(kept));
  ok('no page errors (backup + restore)', s3.errs.length === 0, s3.errs.join(' | '));
  await s3.b.close();

  // ═══ 4. the old full backup (.json, version v38) can finally be restored ═══
  const dOld = await grab(p1, () => p1.evaluate(() => _sdPack.legacyBackup())); files.old = dOld.file;
  ok('the old JSON backup is still available as a fallback and is a .json file', /^StudyDeck_backup_.*\.json$/.test(dOld.name) && /"version": "v38"/.test(fs.readFileSync(dOld.file, 'utf8').slice(0, 200)));
  const s4 = await boot(); const p4 = s4.p; await importFile(p4, dOld.file); const m4 = await waitToast(p4, /Imported \d|damaged|Error|backup has no/);
  ok('the old backup restores: "' + m4.slice(0, 90) + '"', /Imported 2,520 questions · 2 decks/.test(m4));
  const R4 = await p4.evaluate(async ids => ({ a: (await iAll('questions')).filter(r => r.key.startsWith(ids[0] + '__')).length, stars: ((await iAll('scores')).find(x => x.key === ids[0] + '__stars') || {}).val, diff: (await iAll('difficulty')).length }), [built.fid]);
  ok('questions, stars and difficulty are all there', R4.a === 24 && JSON.stringify(R4.stars) === '["a5","a9"]' && R4.diff === 2, JSON.stringify(R4));
  ok('the questions are identical', JSON.stringify((await p4.evaluate(DUMP, built.fid)).q) === JSON.stringify(orig.q));
  await s4.b.close();

  // ═══ 5. damaged, cut-off and foreign files ═══
  const bytes = fs.readFileSync(dAll.file);
  const cut = OUT + 'pk32_cut.sdpack'; fs.writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.6)));
  const s5 = await boot(); await importFile(s5.p, cut); const m5 = await waitToast(s5.p, /Imported|incomplete|damaged|Please|Unsupported/, 15000).catch(() => toasts(s5.p));
  ok('a file that was cut short says so in plain words (' + m5.slice(0, 70) + ')', /incomplete or damaged/.test(m5) && !/not a StudyDeck/.test(m5));
  ok('a cut-off file leaves nothing behind', JSON.stringify(await counts(s5.p)) === '{"files":0,"q":0,"scores":0}', JSON.stringify(await counts(s5.p)));
  await s5.b.close();
  const q1 = Object.keys(ia.sizes || info.sizes).find(n => n === 'q/1.json'); const flipText = OUT + 'pk32_flip_text.sdpack'; damage(dPack.file, flipText, q1, 'flip');
  const s6 = await boot(); await importFile(s6.p, flipText); const m6 = await waitToast(s6.p, /Imported|damaged|incomplete/);
  ok('damage inside a later piece of questions is caught: "' + m6.slice(0, 80) + '"', /damaged|cut short/.test(m6) && !/Imported/.test(m6));
  ok('the pieces that were already written are removed again (no half-imported deck)', JSON.stringify(await counts(s6.p)) === '{"files":0,"q":0,"scores":0}', JSON.stringify(await counts(s6.p)));
  await s6.b.close();
  const pic = imgEntries.find(n => info.sizes[n][2] === 0 && info.sizes[n][0] > 5000); const flipImg = OUT + 'pk32_flip_img.sdpack'; damage(dPack.file, flipImg, pic, 'flip');
  const s7 = await boot(); await importFile(s7.p, flipImg); const m7 = await waitToast(s7.p, /Imported|damaged|incomplete/);
  ok('a changed picture is caught by its checksum: "' + m7.slice(0, 80) + '"', /damaged|cut short/.test(m7) && JSON.stringify(await counts(s7.p)) === '{"files":0,"q":0,"scores":0}');
  await s7.b.close();
  // a ZIP that is not a pack, and a pack from the future
  const foreign = OUT + 'pk32_foreign.zip', future = OUT + 'pk32_future.sdpack';
  py(`import zipfile,sys,json
zipfile.ZipFile(sys.argv[1],'w').writestr('notes.txt','hello')
z=zipfile.ZipFile(sys.argv[2],'w'); z.writestr('manifest.json',json.dumps({'app':'studydeck','v':9,'kind':'deck','decks':[],'chunks':0,'imgs':[]})); z.writestr('meta.json','{}')`, foreign, future);
  const s8 = await boot(); await importFile(s8.p, foreign); const m8 = await waitToast(s8.p, /not a StudyDeck pack|Imported/);
  ok('a ZIP that is not a StudyDeck pack is explained (it used to hit a function that did not exist)', /not a StudyDeck pack/.test(m8), m8.slice(0, 120));
  await s8.p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); await importFile(s8.p, future); const m8b = await waitToast(s8.p, /newer StudyDeck|Imported/);
  ok('a pack from a newer version asks for an update instead of guessing', /newer StudyDeck/.test(m8b), m8b.slice(0, 100));
  ok('neither file changed anything', JSON.stringify(await counts(s8.p)) === '{"files":0,"q":0,"scores":0}');
  ok('no page errors (damaged and foreign files)', s5.errs.length + s6.errs.length + s7.errs.length + s8.errs.length === 0, s5.errs.concat(s6.errs, s7.errs, s8.errs).join(' | '));
  await s8.b.close();

  // ═══ 6. phones: Share button, sepia dark theme ═══
  await p1.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.removeAttribute('data-amoled'); window.__shared = null; navigator.canShare = () => false; navigator.share = async d => { window.__shared = d; }; });
  await p1.evaluate(async fid => { _exportDeckKey = fid; await _sdPack.export('deck'); }, built.fid); await p1.waitForTimeout(500);
  ok('no Share button when the phone cannot share files', await p1.evaluate(() => !document.getElementById('sdp-bar')));
  await p1.evaluate(() => { navigator.canShare = d => !!(d && d.files && d.files.length); });
  await p1.evaluate(async fid => { _exportDeckKey = fid; await _sdPack.export('deck'); }, built.fid); await p1.waitForSelector('#sdp-bar', { timeout: 8000 });
  const bar = await p1.evaluate(() => { const b = document.getElementById('sdp-bar'), g = b.querySelector('.sdp-go'), x = b.querySelector('.sdp-x'), r = e => e.getBoundingClientRect(); return { bg: getComputedStyle(b).backgroundColor, go: [r(g).width, r(g).height], x: [r(x).width, r(x).height], text: b.textContent, fits: r(b).left >= 0 && r(b).right <= innerWidth, role: b.getAttribute('role'), label: x.getAttribute('aria-label') }; });
  ok('a Share bar appears when the phone can share files, with 44 px buttons that fit the screen', bar.go[1] >= 44 && bar.go[0] >= 44 && bar.x[0] >= 44 && bar.x[1] >= 44 && bar.fits, JSON.stringify(bar.go) + ' ' + JSON.stringify(bar.x));
  ok('the bar is announced to screen readers and the close button is labelled', bar.role === 'status' && bar.label === 'Close');
  ok('in the dark theme the bar is the warm sepia brown, not blue-grey (' + bar.bg + ')', rgb(bar.bg)[0] > rgb(bar.bg)[2] && rgb(bar.bg)[1] >= rgb(bar.bg)[2]);
  await p1.click('#sdp-bar .sdp-go'); await p1.waitForTimeout(300);
  const shared = await p1.evaluate(() => window.__shared && { n: window.__shared.files.length, name: window.__shared.files[0].name, type: window.__shared.files[0].type, size: window.__shared.files[0].size });
  ok('Share hands the .sdpack file itself to the phone\'s share sheet', shared && shared.n === 1 && /\.sdpack$/.test(shared.name) && shared.size > 1000, JSON.stringify(shared));
  await p1.click('#sdp-bar .sdp-x'); ok('Close removes the bar', await p1.evaluate(() => !document.getElementById('sdp-bar')));

  // ═══ 7. old browsers without CompressionStream ═══
  const s9 = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); await s9.c.addInitScript(() => { delete window.CompressionStream; delete window.DecompressionStream; });
  const p9 = await s9.c.newPage(); const e9 = []; p9.on('pageerror', e => e9.push(e.message)); p9.on('dialog', d => d.accept());
  await p9.goto('file://' + path.resolve(process.env.APP || '../index.html')); await p9.waitForTimeout(1600); await p9.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; navTo('lib'); });
  ok('the test page really has no CompressionStream', await p9.evaluate(() => typeof CompressionStream === 'undefined' && _sdPack.support.compress === false));
  const small = await p9.evaluate(BUILD, { name: 'Small', chapters: 2, per: 30, imgs: 3, seed: 3, tag: 'c' }); const so = await p9.evaluate(DUMP, small.fid);
  const dS = await grab(p9, () => p9.evaluate(() => { _exportDeckKey = fileId; return _sdPack.export('deck'); })); const iS = zipInfo(dS.file);
  ok('without compression the pack is still a valid ZIP (entries are stored)', iS.bad === null && Object.values(iS.sizes).every(v => v[2] === 0) && iS.manifest.qs === 60);
  await p9.evaluate(async fid => { for (const s of ['files', 'questions', 'scores']) for (const r of await iAll(s)) await iDel(s, r.key); invalidateFilesCache(); }, small.fid);
  await importFile(p9, dS.file); const m9 = await waitToast(p9, /Imported \d|damaged|cannot/);
  ok('and it opens again on the same browser, identical', /Imported 60 questions/.test(m9) && JSON.stringify((await p9.evaluate(DUMP, small.fid)).q) === JSON.stringify(so.q), m9.slice(0, 80));
  await p9.evaluate(async () => { for (const s of ['files', 'questions', 'scores']) for (const r of await iAll(s)) await iDel(s, r.key); invalidateFilesCache(); }); await p9.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await importFile(p9, dPack.file); const m9b = await waitToast(p9, /Imported \d|damaged|cannot open compressed/);
  ok('a compressed pack on such a browser says to update the browser and writes nothing', /cannot open compressed packs/.test(m9b) && JSON.stringify(await counts(p9)) === '{"files":0,"q":0,"scores":0}', m9b.slice(0, 100));
  ok('no page errors (fallback)', e9.length === 0, e9.join(' | '));
  await s9.b.close();

  // ═══ 8. battery: the app's own repeating checks stop in the background ═══
  const s10 = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); await s10.c.addInitScript(() => { const act = new Map(); window.__act = act; const si = window.setInterval, ci = window.clearInterval; window.setInterval = function (f, d) { const id = si.apply(this, arguments); act.set(id, d); return id; }; window.clearInterval = function (id) { act.delete(id); return ci.apply(this, arguments); }; });
  const p10 = await s10.c.newPage(); const e10 = []; p10.on('pageerror', e => e10.push(e.message)); p10.on('dialog', d => d.accept());
  await p10.goto('file://' + path.resolve(process.env.APP || '../index.html')); await p10.waitForTimeout(1800); await p10.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; navTo('home'); });
  const layer = () => p10.evaluate(() => [...window.__act.values()].filter(d => [1200, 1500, 2500, 3000].indexOf(d) >= 0).sort().join(','));
  const on = await layer(); ok('on screen the dock, resume, backup and start-up checks run (' + on + ')', /1200/.test(on) && /2500/.test(on) && /3000/.test(on));
  await p10.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('in the background none of them has a timer any more', (await layer()) === '', await layer());
  await p10.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('back on screen they start again', /1200/.test(await layer()) && /2500/.test(await layer()) && /3000/.test(await layer()), await layer());
  await p10.waitForFunction(() => ![...window.__act.values()].some(d => d === 1500), null, { timeout: 30000 }).catch(() => { });
  const after = await layer(); ok('the start-up catch-up timer removes itself after a few seconds (left: ' + after + ')', !/1500/.test(after) && /1200/.test(after));
  ok('no page errors (timers)', e10.length === 0, e10.join(' | ')); await s10.b.close();

  ok('no page errors (share, themes)', s1.errs.length === 0, s1.errs.join(' | '));
  await s1.b.close(); console.log('FAILS ' + FAILS); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
