// Browse editing: note, mark done, edit, add, delete question; then delete the whole deck and re-import
const L = require('./lib'); let FAILS = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) FAILS++; };
(async () => {
  const { b, p, errs } = await L.boot(); await L.importCsv(p);
  const open = async () => { await p.evaluate(() => navTo('lib')); await p.waitForTimeout(300); await p.evaluate(() => { [...document.querySelectorAll('#slib button')].find(x => /📖 Browse/.test(x.textContent)).click(); }); await p.waitForTimeout(700); };
  const qtexts = () => p.evaluate(() => [...document.querySelectorAll('#sbrowse .bq .bq-q')].map(x => x.textContent.trim()));
  await open();
  // mark done
  await p.evaluate(() => document.querySelectorAll('#sbrowse .bq .bq-mark-btn')[0].click()); await p.waitForTimeout(400);
  const cnt = await p.evaluate(() => document.getElementById('sbrowse').innerText.replace(/\s+/g, ' ').slice(0, 120));
  ok('Mark Done moves the question to Done (1) / New (11)', /1\s*✅ Done/.test(cnt) && /11\s*🆕 New/.test(cnt), cnt);
  // edit
  await p.evaluate(() => document.querySelectorAll('#sbrowse .bq .bq-edit')[2].click()); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('ed-q').value = 'EDITED: what is the median nerve root value?'; document.getElementById('edoi1').value = 'C5-T1 (edited)'; });
  await p.evaluate(() => saveQ()); await p.waitForTimeout(800);
  let t = await qtexts(); ok('edited text shows up in Browse', t.some(x => /EDITED: what is the median/.test(x)), t.slice(0, 4).join(' | '));
  // add MCQ
  const addBtn = await p.evaluate(() => { const b = [...document.querySelectorAll('#sbrowse button')].find(x => /Add MCQ/.test(x.textContent)); return b ? (b.getAttribute('onclick') || 'listener') : null; }); console.log('add button:', addBtn);
  await p.evaluate(() => { [...document.querySelectorAll('#sbrowse button')].find(x => /Add MCQ/.test(x.textContent)).click(); }); await p.waitForTimeout(500);
  const blank = await p.evaluate(() => ({ q: document.getElementById('ed-q').value, vis: !document.getElementById('ed-ov').classList.contains('hidden') }));
  ok('Add MCQ opens an empty editor', blank.vis && blank.q === '', JSON.stringify(blank));
  await p.evaluate(() => { document.getElementById('ed-q').value = 'ADDED: Which bone is the longest?'; ['Femur', 'Tibia', 'Humerus', 'Fibula'].forEach((v, i) => document.getElementById('edoi' + i).value = v); document.getElementById('ed-exp').value = 'Femur is the longest bone.'; const r = document.querySelector('#ed-ov input[type=radio][value="0"], #ed-ov [onclick*="setEdCorrect(0"]'); r && r.click(); });
  await p.evaluate(() => saveQ()); await p.waitForTimeout(900);
  t = await qtexts(); ok('added question appears (13 total)', t.length === 13 && t.some(x => /ADDED: Which bone/.test(x)), t.length + '');
  // persists after reload
  await p.reload(); await p.waitForTimeout(1700); await p.evaluate(() => { document.getElementById('sd-auth-ov').style.display = 'none'; document.getElementById('sd-app-wrapper').style.display = ''; });
  await p.evaluate(() => navTo('lib')); await p.waitForTimeout(500); await p.evaluate(() => { const id = (document.querySelector('#slib [onclick*="loadSavedDeck"]').getAttribute('onclick').match(/loadSavedDeck\('([^']+)'/) || [])[1]; return loadSavedDeck(id); }); await p.waitForTimeout(1200);
  await open(); t = await qtexts();
  ok('edit + added question survive a reload', t.length === 13 && t.some(x => /EDITED/.test(x)) && t.some(x => /ADDED/.test(x)), t.length + '');
  ok('"Mark Done" survives a reload', await p.evaluate(() => /1\s*✅ Done/.test(document.getElementById('sbrowse').innerText.replace(/\s+/g, ' '))));
  // delete the added one
  await p.evaluate(() => { const i = [...document.querySelectorAll('#sbrowse .bq .bq-q')].findIndex(x => /ADDED/.test(x.textContent)); document.querySelectorAll('#sbrowse .bq .bq-edit')[i].click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => deleteQ()); await p.waitForTimeout(900); t = await qtexts();
  ok('delete question removes it (back to 12)', t.length === 12 && !t.some(x => /ADDED/.test(x)), t.length + '');
  ok('deck count on the library follows (12 questions)', await (async () => { await p.evaluate(() => navTo('lib')); await p.waitForTimeout(500); return p.evaluate(() => /12\s*(Q|questions)|Anatomy Basics[^|]*12/.test(document.getElementById('slib').innerText.replace(/\s+/g, ' '))); })());
  // delete the whole deck
  const fid = await p.evaluate(() => fileId);
  await p.evaluate(id => deleteDeck(id), fid); await p.waitForTimeout(700);
  const dd = await p.evaluate(() => ({ title: document.getElementById('deldeck-title').textContent, sub: document.getElementById('deldeck-sub').textContent }));
  ok('delete dialog names the deck and its question count', /mcqs/.test(dd.title) && /36/.test(dd.sub), JSON.stringify(dd));
  await p.evaluate(() => confirmDeleteDeck('wipe')); await p.waitForTimeout(1500);
  ok('deck is gone from storage', await p.evaluate(async () => (await iAll('files')).length === 0 && (await iAll('questions')).length === 0), await p.evaluate(async () => (await iAll('files')).length + ' files, ' + (await iAll('questions')).length + ' q-docs'));
  await p.evaluate(() => navTo('home')); await p.waitForTimeout(600);
  ok('Home still renders after deleting everything', (await L.visible(p)).includes('shome'));
  await L.importCsv(p);
  ok('importing again works', await p.evaluate(() => /Anatomy Basics/.test(document.getElementById('slib').innerText)));
  ok('no page or console errors', errs.length === 0, errs.join(' ; '));
  console.log('FAILS', FAILS); await b.close(); process.exit(FAILS ? 1 : 0);
})();
