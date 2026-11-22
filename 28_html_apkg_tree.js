// v47: uploaded question banks keep a properly arranged deck tree.
//  - HTML (nested FOLDER_TREE, as saved by question-bank pages): every question comes out, in its real folder, to any depth, by both import routes (the Import HTML screen and the main Import button).
//  - APKG (Anki): the empty "Default" deck goes, a flat deck is sorted by subject, and hierarchy that only lives in the tags becomes folders.
// Honest limit: the Anki side runs the app's real APKG code (zip, deck tree, MCQ detection, saving) on top of a stand-in for sql.js (apkg_fake.js). Real SQLite and real Anki files are not exercised here.
const L = require('./lib'); const A = require('./apkg_fake'); const fs = require('fs'); const path = require('path');
let FAILS = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const TREE = path.resolve(__dirname, 'data/marrow_tree.html');

const mk = async () => {
  const s = await L.boot({ vp: { width: 1100, height: 800 } }); const p = s.p; s.toasts = [];
  await p.exposeFunction('__t', m => s.toasts.push(String(m)));
  await p.evaluate(() => { const o = window.toast; window.toast = function (m) { try { __t(String(m)); } catch (e) { } return o.apply(this, arguments); }; _sdRequireFeature = () => true; });
  return s;
};
const treeOf = p => p.evaluate(() => { const o = {}; Object.keys(nodeByKey).forEach(k => o[k.split('\0').join(' › ')] = [nodeByKey[k].ownCount, nodeByKey[k].totalCount]); return o; });
const allQs = p => p.evaluate(async () => { const out = []; for (const k of Object.keys(nodeByKey)) { const qs = await loadQuestions(fileId, k); (qs || []).forEach(q => out.push({ k: k.split('\0').join(' › '), q: q.q, o: q.opts, c: q.correct })); } return out; });
const viaModal = async (p, file) => {
  await p.evaluate(() => openHTMLDeckTreeModal()); await p.waitForTimeout(300);
  await p.setInputFiles('#hdt-file', file); await p.waitForTimeout(400);
  await p.evaluate(() => runHTMLDeckTreeExtract()); await p.waitForTimeout(5000);
  const rows = await p.evaluate(() => _hdtRows.map(r => r._deckPath));
  await p.evaluate(() => runHTMLDeckTreeImport()); await p.waitForTimeout(3000);
  return rows;
};
const q = (t, o, ans) => ({ text: t, options: { A: o[0], B: o[1], C: o[2], D: o[3] }, ans, expl: 'x' });

(async () => {
  // ── HTML: the nested Marrow bank, through the Import HTML screen ──
  {
    const s = await mk(), p = s.p; const rows = await viaModal(p, TREE); const t = await treeOf(p), qs = await allQs(p);
    ok('HTML tree (Import HTML screen): all 18 questions come out, not 2', rows.length === 18 && qs.length === 18, rows.length + ' rows, ' + qs.length + ' saved');
    ok('four levels deep survive: Anatomy › Upper limb › Brachial plexus › Roots and trunks holds 3', (t['Anatomy › Upper limb › Brachial plexus › Roots and trunks'] || [])[0] === 3, JSON.stringify(t['Anatomy › Upper limb › Brachial plexus › Roots and trunks']));
    ok('the folders above it add up (Brachial plexus 5, Upper limb 10, Anatomy 15)', (t['Anatomy › Upper limb › Brachial plexus'] || [])[1] === 5 && (t['Anatomy › Upper limb'] || [])[1] === 10 && (t['Anatomy'] || [])[1] === 15, JSON.stringify([t['Anatomy › Upper limb › Brachial plexus'], t['Anatomy › Upper limb'], t['Anatomy']]));
    ok('Physiology is its own subject folder, not mixed into Anatomy', (t['Physiology'] || [])[1] === 3 && (t['Physiology › Cardiovascular › Cardiac cycle'] || [])[0] === 3);
    const first = qs.find(x => /Brachial plexus question 1:/.test(x.q));
    ok('answers stay correct (right option first, marked right)', first && first.c === 0 && /Right 1/.test(first.o[0]), first && JSON.stringify([first.c, first.o]));
    ok('no page errors', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  // ── HTML: the same file through the main Import button ──
  {
    const s = await mk(), p = s.p; await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300);
    await p.setInputFiles('#fi-import', TREE); await p.waitForFunction(() => Object.keys(nodeByKey).length > 8, null, { timeout: 20000 }).catch(() => { }); await p.waitForTimeout(800);
    const t = await treeOf(p), qs = await allQs(p);
    ok('HTML tree (main Import): 18 questions and the same tree', qs.length === 18 && (t['Anatomy › Upper limb › Brachial plexus › Cords and branches'] || [])[0] === 2 && (t['Physiology › Cardiovascular › Cardiac cycle'] || [])[0] === 3, qs.length + ' saved; ' + Object.keys(t).length + ' folders');
    ok('no page errors (main Import)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  // ── HTML: awkward but common files ──
  {
    const tree = { name: 'root', folders: [{ name: 'Pharmacology', folders: [{ name: 'Autonomic', tests: [{ title: 'Cholinergics', questions: [
      q('Drug of choice for a myasthenic crisis is?', ['Neostigmine', 'Atropine', 'Dopamine', 'Digoxin'], 0),
      q('The antidote for organophosphate poisoning is?', ['Naloxone', 'Flumazenil', 'Atropine', 'Vitamin K'], 'Atropine'),
      q('Third stem for the numeric answer case?', ['p', 'q', 'r', 's'], 3)] }] }] }] };
    fs.writeFileSync(path.join(OUT, 'm28_wrapper.html'), '<html><body><script>\nvar FOLDER_TREE = ' + JSON.stringify(tree).replace('"expl":"x"}', '"expl":"x",}') + ';\n</script></body></html>');
    fs.writeFileSync(path.join(OUT, 'm28_flat.html'), '<html><body><script>\nconst QUESTIONS = ' + JSON.stringify([q('Flat question one about nothing in particular?', ['a1', 'b1', 'c1', 'd1'], 'B'), q('Flat question two about nothing in particular?', ['a2', 'b2', 'c2', 'd2'], 'C')]) + ';\n</script></body></html>');
    const s = await mk(), p = s.p; const rows = await viaModal(p, path.join(OUT, 'm28_wrapper.html')); const t = await treeOf(p), qs = await allQs(p);
    ok('a generic "root" wrapper is not made into a folder; a trailing comma is forgiven', rows.length === 3 && rows.every(r => r === 'Pharmacology › Autonomic › Cholinergics') && !Object.keys(t).some(k => /^root/i.test(k)), JSON.stringify(rows));
    const byQ = f => qs.find(x => f.test(x.q));
    ok('an answer written as the option\'s own words is found (Atropine = C, not "A" for its first letter)', (byQ(/organophosphate/) || {}).c === 2, JSON.stringify((byQ(/organophosphate/) || {}).c));
    ok('an answer written as a number counts from zero', (byQ(/numeric answer/) || {}).c === 3);
    ok('no page errors (wrapper)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
    const s2 = await mk(), p2 = s2.p; const rows2 = await viaModal(p2, path.join(OUT, 'm28_flat.html')); const qs2 = await allQs(p2);
    ok('a bank with no folders at all stays one deck named after the file', rows2.length === 2 && rows2.every(r => r === 'm28_flat') && qs2.length === 2, JSON.stringify(rows2));
    ok('and its letter answers are right (B, C)', qs2.map(x => x.c).sort().join() === '1,2', JSON.stringify(qs2.map(x => x.c)));
    ok('no page errors (flat)', s2.errs.length === 0, s2.errs.join(' ; ')); await s2.b.close();
  }
  // ── APKG ──
  const FLAT = ['Which nerve is injured in fracture of the surgical neck of the humerus?', 'Rate limiting enzyme of glycolysis is phosphofructokinase', 'Reed-Sternberg cells are characteristic of Hodgkin lymphoma', 'Drug of choice for anaphylaxis is adrenaline', 'Negri bodies are seen in rabies virus infection', 'Rigor mortis first appears in the eyelids', 'Cherry red spot at the macula is seen in central retinal artery occlusion', 'Drug of choice for eclamptic seizures is magnesium sulphate'];
  const scen = {
    tree: () => { const d = { 1: 'Default', 10: 'NEET PG', 11: 'NEET PG::Anatomy', 12: 'NEET PG::Anatomy::Upper limb', 13: 'NEET PG::Anatomy::Lower limb', 14: 'NEET PG::Physiology', 15: 'NEET PG::Physiology::Cardio' }, n = [];
      for (let i = 0; i < 4; i++) n.push(A.note(12, 'Upper limb stem')); for (let i = 0; i < 3; i++) n.push(A.note(13, 'Lower limb stem')); for (let i = 0; i < 2; i++) n.push(A.note(11, 'Anatomy parent stem')); for (let i = 0; i < 3; i++) n.push(A.note(15, 'Cardio stem')); return { d, n }; },
    flat: () => { const n = []; for (let r = 0; r < 3; r++) FLAT.forEach(x => n.push(A.note(1, x))); return { d: { 1: 'Default' }, n }; },
    tags: () => { const n = [], tg = ['Anatomy::Upper_Limb', 'Anatomy::Lower_Limb', 'Physiology::Cardiovascular', 'Pathology::Neoplasia']; for (let r = 0; r < 4; r++) tg.forEach(x => n.push(A.note(1, x.replace('::', ' ') + ' stem', 'marrow ' + x))); return { d: { 1: 'Marrow Export' }, n }; },
  };
  const runApkg = async (name, opts = {}) => {
    const s = await mk(), p = s.p; const { d, n } = scen[name](); const decks = {}; Object.keys(d).forEach(id => decks[id] = { id: +id, name: d[id] });
    if (opts.off) await p.evaluate(() => localStorage.setItem('sd-auto-sort', 'off'));
    await A.build(p, { models: A.MODELS, decks, notes: n }, 'Marrow_' + name + '.apkg');
    await p.evaluate(() => parseAPKG(window.__apkgFile)); await p.waitForTimeout(2800);
    s.tree = await treeOf(p); s.qs = await allQs(p); s.notes = n.length; return s;
  };
  {
    const s = await runApkg('tree'), t = s.tree, keys = Object.keys(t);
    ok('Anki tree: the empty "Default" deck is gone and no folder is empty', !keys.some(k => /^Default$/i.test(k)) && keys.every(k => t[k][1] > 0), JSON.stringify(keys));
    ok('Anki tree: the folders you built keep their questions (Upper limb 4, Lower limb 3, Cardio 3)', (t['NEET PG › Anatomy › Upper limb'] || [])[0] === 4 && (t['NEET PG › Anatomy › Lower limb'] || [])[0] === 3 && (t['NEET PG › Physiology › Cardio'] || [])[0] === 3, JSON.stringify(t));
    ok('Anki tree: nothing lost or doubled (12 notes, 12 questions)', s.qs.length === s.notes && new Set(s.qs.map(x => x.q)).size === s.notes, s.qs.length + '/' + s.notes);
    ok('Anki tree: the user is told what was tidied', s.toasts.some(m => /tidied|empty/i.test(m)), JSON.stringify(s.toasts.slice(-2)));
    ok('no page errors (Anki tree)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    const s = await runApkg('flat'), t = s.tree, keys = Object.keys(t);
    ok('Anki flat deck: "Default" becomes the file name and nothing is empty', !keys.some(k => /^Default/i.test(k)) && keys.some(k => /^Marrow_flat/.test(k) || /^Marrow flat/.test(k)), JSON.stringify(keys));
    const subj = keys.filter(k => k.split(' › ').length === 2);
    ok('Anki flat deck: sorted into subject folders (Biochemistry, Pathology, Pharmacology, …)', ['Biochemistry', 'Pathology', 'Pharmacology', 'Microbiology', 'Forensic Medicine', 'Ophthalmology'].every(n => subj.some(k => k.endsWith(' › ' + n))), JSON.stringify(subj));
    ok('Anki flat deck: all 24 questions are still there', s.qs.length === 24 && new Set(s.qs.map(x => x.q)).size === 24, String(s.qs.length));
    ok('Anki flat deck: the right answer stays marked right after the move', s.qs.every(x => x.c === 0), JSON.stringify(s.qs.map(x => x.c)));
    ok('no page errors (Anki flat)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    const s = await runApkg('tags'), t = s.tree;
    ok('Anki tags: "Anatomy::Upper_Limb" becomes Anatomy › Upper Limb (4 questions)', (t['Marrow Export › Anatomy › Upper Limb'] || [])[0] === 4 && (t['Marrow Export › Anatomy › Lower Limb'] || [])[0] === 4 && (t['Marrow Export › Physiology › Cardiovascular'] || [])[0] === 4 && (t['Marrow Export › Pathology › Neoplasia'] || [])[0] === 4, JSON.stringify(t));
    ok('Anki tags: 16 questions, none lost', s.qs.length === 16, String(s.qs.length));
    ok('no page errors (Anki tags)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  {
    const s = await runApkg('tree', { off: true }), keys = Object.keys(s.tree);
    ok('with "Sort uploads by subject" switched off, the Anki deck is left exactly as it came', keys.some(k => /^Default$/i.test(k)) && s.qs.length === s.notes, JSON.stringify(keys));
    ok('no page errors (switch off)', s.errs.length === 0, s.errs.join(' ; ')); await s.b.close();
  }
  console.log(FAILS ? FAILS + ' FAILED' : 'ALL PASSED'); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
