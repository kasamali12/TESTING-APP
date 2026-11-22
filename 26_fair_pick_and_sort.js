// v46: (1) NEET mock and Custom Test pick questions at random but cover EVERY chapter of every subject, and prefer questions you have not seen;
//      (2) an imported file with no subject folders is sorted into subject folders by the app; a file that already has them is left alone.
// The sorting accuracy is measured on data/subject_mix.csv (152 questions, 8 per subject, shuffled), which was written for this check,
// so treat that number as a floor on easy cases, not as a promise for every question bank.
const L = require('./lib'); const fs = require('fs'); const path = require('path');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const MIX = path.resolve('data/subject_mix.csv'), MULTI = path.resolve('data/multi_subject.csv'), GENERAL = path.resolve('data/general_quiz.csv');
const LABELS = JSON.parse(fs.readFileSync(path.resolve('data/subject_mix.labels.json'), 'utf8')); const truth = {}; LABELS.forEach(l => truth[l.q] = l.subject);
const FOLDER = { anatomy: /anatomy/i, physiology: /physiology/i, biochemistry: /biochem/i, pathology: /patholog/i, pharmacology: /pharmac/i, microbiology: /microbio/i, forensic: /forensic/i, psm: /community/i, ent: /\bENT\b/, ophthalmology: /ophthal/i, surgery: /surgery/i, obsgyn: /obs/i, medicine: /general medicine/i, pediatrics: /pediatr/i, anaesthesia: /anaesth/i, radiology: /radiolog/i, psychiatry: /psychiat/i, ortho: /orthop/i, dermatology: /dermatol/i };

function parseCsv(text) {   // small CSV reader: quoted fields, doubled quotes, line breaks inside quotes
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
async function load(p, file) {
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300);
  await p.setInputFiles('#fi-import', file);
  await p.waitForFunction(() => /Imported \d+ questions|\d+ Deck|\d+ deck/i.test(document.body.innerText), null, { timeout: 20000 }); await p.waitForTimeout(2200);
}
async function spy(p) { const t = []; await p.exposeFunction('__toast', m => t.push(String(m))); await p.evaluate(() => { const o = window.toast; window.toast = function (m) { try { __toast(String(m)); } catch (e) {} return o.apply(this, arguments); }; }); return t; }
const tree = p => p.evaluate(async () => { const out = []; for (const k of Object.keys(nodeByKey)) { const n = nodeByKey[k]; out.push({ key: k, own: n.ownCount, total: n.totalCount, qs: n.ownCount ? (await loadQuestions(fileId, k)).map(q => q.q) : [] }); } return out; });
const chapMap = p => p.evaluate(async () => { const chap = {}; for (const pk of Object.keys(nodeByKey)) { const qs = await loadQuestions(fileId, pk); (qs || []).forEach(q => { chap[q.sid] = pk; }); } return chap; });

(async () => {
  // ───────── A. random picking that covers every chapter ─────────
  {
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; await load(p, MULTI);
    const R = await p.evaluate(async () => {
      const chap = {}; for (const pk of Object.keys(nodeByKey)) { (await loadQuestions(fileId, pk) || []).forEach(q => { chap[q.sid] = pk; }); }
      const allChaps = [...new Set(Object.values(chap))].filter(c => c.split(' › ').length === 3);
      window.startQuizWithQ = async qs => { window.__cap = qs; };
      openNeetTest(); await new Promise(r => setTimeout(r, 1300));
      const map = neetSubjCfg.filter(c => c.pathKey).map(c => ({ id: c.id, pk: c.pathKey, avail: c.avail, q: c.qCount }));
      const tests = [], seen = new Set(); let prev = new Set();
      for (let k = 0; k < 6; k++) {
        window.__cap = null; await executeNeetTest(); await new Promise(r => setTimeout(r, 450));
        const qs = window.__cap || [], ids = qs.map(q => q.sid), ch = new Set(ids.map(i => chap[i])), anat = qs.filter(q => q._subj === 'anatomy');
        tests.push({ size: ids.length, uniq: new Set(ids).size, chapters: ch.size, repeats: ids.filter(i => prev.has(i)).length, anatUpper: anat.filter(q => /Upper limb/.test(chap[q.sid])).length, anat: anat.length, lower: anat.filter(q => /Lower limb/.test(chap[q.sid])).length });
        ids.forEach(i => seen.add(i)); prev = new Set(ids); await new Promise(r => setTimeout(r, 300));
      }
      return { map, tests, chapters: allChaps.length, distinct: seen.size };
    });
    console.log('  mapping: ' + R.map.map(m => m.id + '→' + m.pk + ' (' + m.avail + ')').join('  '));
    ok('each NEET subject is mapped to its WHOLE folder (all chapters), not to one chapter', R.map.length === 4 && R.map.every(m => m.pk.split(' › ').length === 2) && R.map.find(m => m.id === 'anatomy').avail === 72, JSON.stringify(R.map.map(m => m.pk + ':' + m.avail)));
    ok('the deck has 20 chapters in 4 subjects', R.chapters === 20, 'chapters ' + R.chapters);
    ok('every one of 6 mocks covers all 20 chapters', R.tests.every(t => t.chapters === 20), R.tests.map(t => t.chapters).join(','));
    ok('no question appears twice inside a mock', R.tests.every(t => t.size === t.uniq && t.size === 48), R.tests.map(t => t.size + '/' + t.uniq).join(','));
    ok('a mock is not mostly the same questions as the previous one (unseen come first)', R.tests.slice(1).every(t => t.repeats <= 12), 'repeats ' + R.tests.slice(1).map(t => t.repeats).join(','));
    ok('six mocks reach well over 150 different questions (the old shuffle stayed near 100)', R.distinct >= 170, 'distinct ' + R.distinct + ' of 252');
    ok('the small Lower limb chapter (6 questions) is in every mock', R.tests.every(t => t.lower >= 1), R.tests.map(t => t.lower).join(','));
    ok('the 30-question Upper limb chapter does not take over Anatomy (under half of its picks)', R.tests.every(t => t.anatUpper / t.anat < 0.5), R.tests.map(t => t.anatUpper + '/' + t.anat).join(' '));
    ok('no page errors (mapping and picking)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // Custom Test, selected chapters, previous-test retry, and a subject that is short of questions
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; await load(p, MULTI); const toasts = await spy(p);
    const R = await p.evaluate(async () => {
      const chap = {}; for (const pk of Object.keys(nodeByKey)) { (await loadQuestions(fileId, pk) || []).forEach(q => { chap[q.sid] = pk; }); }
      window.startQuizWithQ = async qs => { window.__cap = qs; };
      const out = { runs: [] };
      await openCustomTest(); await new Promise(r => setTimeout(r, 1300));
      out.enabled = ctSubjCfg.filter(c => c.enabled && c.pathKey).length;
      for (let k = 0; k < 4; k++) { window.__cap = null; await executeCustomTest(); await new Promise(r => setTimeout(r, 500)); const qs = window.__cap || []; out.runs.push({ n: qs.length, chapters: new Set(qs.map(q => chap[q.sid])).size, perSubj: Object.fromEntries(['anatomy', 'physiology', 'pathology', 'pharmacology'].map(id => [id, qs.filter(q => q._subj === id).length])) }); }
      // chapter selection: only two Anatomy chapters
      const a = ctSubjCfg.find(c => c.id === 'anatomy'); const picks = Object.keys(chap).filter(sid => /Anatomy › (Upper limb|Thorax)$/.test(chap[sid])); const two = [...new Set(picks.map(s2 => chap[s2]))];
      ctSubjCfg.forEach(c => { c.enabled = c.id === 'anatomy'; }); a.selectedChapters = two; a.qCount = 12;
      window.__cap = null; await executeCustomTest(); await new Promise(r => setTimeout(r, 500));
      const qs = window.__cap || []; out.sel = { n: qs.length, chapters: [...new Set(qs.map(q => chap[q.sid]))].sort(), want: two.sort(), allIn: qs.every(q => two.includes(chap[q.sid])) };
      // retry the previous test
      const prev = window.__cap.map(q => q.sid).sort().join(','); const tid = currentTestId;
      testQSource = 'previous'; sourceTestId = tid; window.__cap = null; await executeCustomTest(); await new Promise(r => setTimeout(r, 500));
      out.retry = { same: (window.__cap || []).map(q => q.sid).sort().join(',') === prev, n: (window.__cap || []).length }; testQSource = 'fresh';
      return out;
    });
    ok('Custom Test: all 4 subjects are on by default', R.enabled === 4, 'enabled ' + R.enabled);
    ok('Custom Test: each of 4 runs covers all 20 chapters', R.runs.every(r => r.chapters === 20), R.runs.map(r => r.chapters).join(','));
    ok('Custom Test: the per-subject counts are exactly what was asked', R.runs.every(r => Object.values(r.perSubj).every(v => v === R.runs[0].perSubj.anatomy) && r.n === 4 * R.runs[0].perSubj.anatomy), JSON.stringify(R.runs[0]));
    ok('Custom Test: picking only some chapters still works and stays inside them, using both', R.sel.n === 12 && R.sel.allIn && R.sel.chapters.length === 2, JSON.stringify(R.sel));
    ok('Custom Test: "retry previous questions" gives the same questions back', R.retry.same && R.retry.n === 12, JSON.stringify(R.retry));
    ok('no page errors (custom test)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // a subject that asks for more than it has: the missing questions move to subjects that have spare, and the mock keeps its size
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; await load(p, MULTI); const toasts = await spy(p);
    const R = await p.evaluate(async () => {
      window.startQuizWithQ = async qs => { window.__cap = qs; };
      openNeetTest(); await new Promise(r => setTimeout(r, 1300));
      neetSubjCfg.forEach(c => { c.qCount = c.id === 'anatomy' ? 100 : 12; });
      window.__cap = null; await executeNeetTest(); await new Promise(r => setTimeout(r, 600));
      const qs = window.__cap || []; const by = {}; qs.forEach(q => { by[q._subj] = (by[q._subj] || 0) + 1; });
      return { n: qs.length, by, uniq: new Set(qs.map(q => q.sid)).size };
    });
    ok('a short subject (asks 100, has 72) is topped up from the others so the mock keeps its size', R.n === 136 && R.by.anatomy === 72 && R.uniq === 136, JSON.stringify(R));
    ok('and the person is told about it', toasts.some(t => /fewer questions than the mock asks for/.test(t)), JSON.stringify(toasts.slice(-3)));
    ok('the mock also tells how wide it reaches (subjects and chapters)', toasts.some(t => /chapters/.test(t) && /subjects/.test(t)), JSON.stringify(toasts.slice(-3)));
    ok('no page errors (shortfall)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // the shuffle itself
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p;
    const R = await p.evaluate(() => {
      const c = {}; const N = 12000; for (let i = 0; i < N; i++) { const k = [0, 1, 2].sdShuffle().join(''); c[k] = (c[k] || 0) + 1; }
      const a = [1, 2, 3, 4, 5], b = a.sdShuffle();
      return { c, N, same: b === a && b.length === 5 && [...b].sort().join('') === '12345', typeofShuffle: typeof [].sdShuffle, enumerable: Object.keys([1]).length };
    });
    const vals = Object.values(R.c);
    ok('the new shuffle gives all 6 orders of 3 items about equally often (12,000 shuffles)', vals.length === 6 && vals.every(v => v / R.N > 0.15 && v / R.N < 0.185), JSON.stringify(R.c));
    ok('it shuffles in place and returns the array (as the old sort did), keeps the same items, and does not show up in for-in loops', R.same && R.typeofShuffle === 'function' && R.enumerable === 1);
    ok('no page errors (shuffle)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // folder names -> subjects
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p;
    const cases = [['Anatomy', ['anatomy']], ['Anatomy Basics', ['anatomy']], ['NEET PG › Anatomy › Upper limb', ['anatomy']], ['Environmental health', []], ['Student notes', []], ['Management of shock', []], ['Microscopy', []], ['Micronutrients', []], ['Psychology', []], ['Treatment', []], ['Imported Deck', []], ['Grand Test 1', []],
      ['Forensic Medicine', ['forensic']], ['Forensic Medicine & Toxicology', ['forensic']], ['Community Medicine', ['psm']], ['PSM', ['psm']], ['General Medicine', ['medicine']], ['Internal Medicine PYQ', ['medicine']], ['Obs/Gyn', ['obsgyn']], ['OBG', ['obsgyn']], ['Gynaecology & Obstetrics', ['obsgyn']], ['Ear Nose Throat', ['ent']], ['ENT', ['ent']], ['Eye', ['ophthalmology']], ['Paediatrics', ['pediatrics']], ['Anaesthesiology', ['anaesthesia']], ['Radiodiagnosis', ['radiology']], ['Orthopaedics', ['ortho']], ['DVL', ['dermatology']], ['Micro', ['microbiology']], ['General Surgery', ['surgery']]];
    const got = await p.evaluate(c => c.map(([n]) => window._sdSubjsOfName(n)), cases);
    const bad = cases.filter((c, i) => JSON.stringify(got[i]) !== JSON.stringify(c[1])).map((c, i) => c[0] + ' → ' + JSON.stringify(got[cases.indexOf(c)]));
    ok('folder-name matching: ' + cases.length + ' names (aliases found, look-alikes like "Microscopy" and "Environmental health" ignored)', bad.length === 0, bad.join(' ; '));
    ok('no page errors (names)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }

  // ───────── B. sorting an imported file into subject folders ─────────
  {
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; const toasts = await spy(p); await load(p, MIX);
    const t = await tree(p); let right = 0, wrong = 0, uns = 0, tot = 0, seenSubj = new Set();
    t.forEach(n => n.qs.forEach(q => { tot++; if (/› Unsorted$/.test(n.key)) uns++; else { const want = truth[q]; if (want && FOLDER[want].test(n.key)) { right++; seenSubj.add(want); } else wrong++; } }));
    console.log('  sorted ' + (right + wrong) + ' of ' + tot + ': ' + right + ' right, ' + wrong + ' wrong, ' + uns + ' in Unsorted, ' + seenSubj.size + ' subjects');
    ok('a flat file of 152 mixed questions keeps all of them', tot === 152 && t[0].total === 152, 'total ' + tot);
    ok('it makes a folder for every subject that is in the file (19)', seenSubj.size === 19, 'subjects ' + seenSubj.size);
    ok('at least 75% of the questions are placed with confidence', (right + wrong) / tot >= 0.75, ((right + wrong) / tot * 100).toFixed(0) + '%');
    ok('and at least 90% of the placed ones are in the right subject (own test data: a floor, not a promise)', right / (right + wrong) >= 0.9, (right / (right + wrong) * 100).toFixed(1) + '%');
    ok('questions it is unsure about go to an "Unsorted" folder, not to a guess', uns > 0 && uns <= 40 && t.some(n => /› Unsorted$/.test(n.key)), 'unsorted ' + uns);
    ok('a summary toast says what happened and how to turn it off', toasts.some(m => /Sorted \d+ questions into \d+ subjects/.test(m) && /Settings/.test(m)), JSON.stringify(toasts.slice(-2)));
    ok('the folders carry the standard subject names', ['Anatomy', 'Physiology', 'Pathology', 'Pharmacology'].every(nm => t.some(n => new RegExp('› ' + nm + '$').test(n.key))), t.map(n => n.key.split(' › ').pop()).join(', '));
    await p.evaluate(() => openNeetTest()); await p.waitForTimeout(1300);
    const mapped = await p.evaluate(() => neetSubjCfg.filter(c => c.pathKey).length);
    ok('the NEET mock then finds all 19 subjects by itself', mapped === 19, 'mapped ' + mapped);
    ok('no page errors (auto-sort)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // a file that already has subject folders: nothing moves
    const on = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); await load(on.p, MULTI); const a = (await tree(on.p)).map(n => n.key + ':' + n.own).sort(); await on.b.close();
    const off = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); await off.p.evaluate(() => localStorage.setItem('sd-auto-sort', 'off')); await load(off.p, MULTI); const b = (await tree(off.p)).map(n => n.key + ':' + n.own).sort(); await off.b.close();
    ok('a file that already has subject / chapter folders is left exactly as it was', JSON.stringify(a) === JSON.stringify(b) && !a.some(k => /Unsorted/.test(k)), a.length + ' folders');
  }
  {
    // not a medical file, and a tiny file: untouched
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; const toasts = await spy(p); await load(p, GENERAL);
    const t = await tree(p);
    ok('a general-knowledge quiz (30 questions) is left as one deck, with no Unsorted folder', t.length === 1 && t[0].own === 30 && !toasts.some(m => /Sorted \d+ questions/.test(m)), t.map(n => n.key + ':' + n.own).join(' | '));
    ok('no page errors (non-medical)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    const rows = fs.readFileSync(MIX, 'utf8').split(/\r?\n/); const small = path.resolve('out/mix_small.csv'); fs.mkdirSync('out', { recursive: true });
    fs.writeFileSync(small, rows.slice(0, 5).join('\n') + '\n');
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; await load(p, small); const t = await tree(p);
    ok('a file with fewer than 5 questions is not sorted', t.length === 1 && t[0].own === 4, t.map(n => n.key + ':' + n.own).join(' | '));
    await s.b.close();
  }
  {
    // a Subject column is believed first, and aliases become the standard names
    const alias = { anatomy: 'Anatomy', physiology: 'Physiology', biochemistry: 'Biochem', pathology: 'Pathology', pharmacology: 'Pharmacology', microbiology: 'Microbiology', forensic: 'Forensic Medicine & Toxicology', psm: 'PSM', ent: 'Otorhinolaryngology', ophthalmology: 'Ophthalmology', surgery: 'Surgery', obsgyn: 'OBG', medicine: 'Medicine', pediatrics: 'Paediatrics', anaesthesia: 'Anaesthesiology', radiology: 'Radiodiagnosis', psychiatry: 'Psychiatry', ortho: 'Orthopaedics', dermatology: 'DVL' };
    const rows = parseCsv(fs.readFileSync(MIX, 'utf8')); const hdr = rows[0].concat(['Subject']); const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const body = rows.slice(1).map(r => r.concat([alias[truth[r[0]]]]).map(esc).join(',')); const f = path.resolve('out/mix_subject_col.csv');
    fs.writeFileSync(f, hdr.map(esc).join(',') + '\n' + body.join('\n') + '\n');
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; await load(p, f); const t = await tree(p);
    let right = 0, tot = 0; t.forEach(n => n.qs.forEach(q => { tot++; if (FOLDER[truth[q]].test(n.key)) right++; }));
    ok('with a Subject column every question goes where the column says, even with short names (OBG, DVL, PSM)', tot === 152 && right === 152 && !t.some(n => /Unsorted/.test(n.key)), right + '/' + tot);
    ok('and the folders get the standard names', t.some(n => /› Obs & Gynecology$/.test(n.key)) && t.some(n => /› Dermatology/.test(n.key)) && t.some(n => /› Community Medicine$/.test(n.key)), t.map(n => n.key.split(' › ').pop()).join(', '));
    ok('no page errors (subject column)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // the Settings switch
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; await p.evaluate(() => navTo('set')); await p.waitForTimeout(1500);
    const has = await p.evaluate(() => !!document.getElementById('tog-autosort'));
    ok('Settings has a "Sort imports by subject" switch, on by default, and it is on screen', has && await p.evaluate(() => { const c = document.getElementById('tog-autosort'), r = c.closest('.set-row') || c.parentElement, b = r.getBoundingClientRect(); return c.checked && b.height > 20 && b.width > 200 && r.offsetParent !== null; }));
    await p.evaluate(() => document.getElementById('tog-autosort').click()); await p.waitForTimeout(300);
    ok('turning it off is remembered', await p.evaluate(() => localStorage.getItem('sd-auto-sort')) === 'off');
    await load(p, MIX); const t = await tree(p);
    ok('with it off, a flat file stays one flat deck', t.length === 1 && t[0].own === 152, t.map(n => n.key + ':' + n.own).join(' | '));
    ok('no page errors (switch)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    // sorting a deck that is already in the library
    const s = await L.boot({ vp: { width: 390, height: 844 }, mobile: true }); const p = s.p; let dialogs = []; p.on('dialog', d => dialogs.push(d.message()));
    await p.evaluate(() => localStorage.setItem('sd-auto-sort', 'off')); await load(p, MIX);
    const before = await p.evaluate(async () => { const k = Object.keys(nodeByKey).find(x => nodeByKey[x].ownCount), qs = await loadQuestions(fileId, k), pick = qs.slice(0, 5).map(q => qSid(q.q, q.opts)); await iPut('scores', { key: fileId + '__stars', val: pick }); return { fid: fileId, nm: fileName, stars: pick }; });
    await p.evaluate(([f, n]) => openFileMoreMenu(f, n), [before.fid, before.nm]); await p.waitForTimeout(400);
    ok('the file menu has a "Sort by subject" button', await p.evaluate(() => !!document.querySelector('#file-more-ov .sd-sortbtn')));
    await p.click('#file-more-ov .sd-sortbtn'); await p.waitForTimeout(3500);
    ok('it asks before changing anything and says what will move', dialogs.length === 1 && /will move into \d+ subject folders/.test(dialogs[0]) && /stars, notes and test history stay/.test(dialogs[0]), JSON.stringify(dialogs[0]));
    const t = await tree(p), n = t.reduce((a, x) => a + x.own, 0);
    ok('the deck is now in subject folders and no question is lost', t.length >= 20 && n === 152, 'folders ' + t.length + ' questions ' + n);
    const kept = await p.evaluate(async b => { let found = 0; for (const k of Object.keys(nodeByKey)) { if (!nodeByKey[k].ownCount) continue; (await loadQuestions(b.fid, k)).forEach(q => { if (b.stars.includes(qSid(q.q, q.opts))) found++; }); } const st = await iGet('scores', b.fid + '__stars'); return { found, saved: st && st.val ? st.val.length : 0 }; }, before);
    ok('starred questions are still starred after they moved folders', kept.found === 5 && kept.saved === 5, JSON.stringify(kept));
    const meta = await p.evaluate(async fid => { const f = await iGet('files', fid); return f.total || f.totalQ || f.count; }, before.fid);
    ok('the library shows the same number of questions', meta === 152, 'meta ' + meta);
    await p.evaluate(fid => _sdSortFile(fid), before.fid); await p.waitForTimeout(1500);
    ok('running it again finds nothing left to sort and asks nothing', dialogs.length === 1);
    ok('no page errors (sort existing deck)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  console.log(FAILS ? FAILS + ' FAILED' : 'ALL PASSED'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
