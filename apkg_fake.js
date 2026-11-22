// Test helper: builds a small .apkg whose "database" is JSON, and a stand-in for sql.js that reads that JSON, so the real parseAPKG code above the
// database (zip, deck tree, MCQ detection, saving) runs without the sql.js download. It does NOT test sql.js itself or real Anki files.
const fs = require('fs'); const JSZIP = '/opt/npm-tools/node_modules/jszip/dist/jszip.min.js';
exports.FAKE_SQL = () => {
  window.__fakeSql = true;
  class DB {
    constructor(bytes) { this.c = JSON.parse(new TextDecoder().decode(bytes)); }
    exec(sql) {
      const c = this.c;
      if (/FROM sqlite_master/.test(sql)) return [{ values: [['col'], ['notes'], ['cards']] }];
      if (/SELECT models FROM col/.test(sql)) return [{ values: [[JSON.stringify(c.models)]] }];
      if (/SELECT decks FROM col/.test(sql)) return [{ values: [[JSON.stringify(c.decks)]] }];
      if (/SELECT did,COUNT/.test(sql)) { const o = {}; c.notes.forEach(n => o[n.did] = (o[n.did] || 0) + 1); return [{ values: Object.entries(o) }]; }
      if (/FROM notes n/.test(sql)) return [{ values: c.notes.map(n => [n.fields.join('\x1f'), n.tags || '', String(n.mid), String(n.did)]) }];
      if (/SELECT COUNT\(\*\) FROM notes/.test(sql)) return [{ values: [[c.notes.length]] }];
      if (/SELECT nid,did FROM cards/.test(sql)) return [{ values: c.notes.map((n, i) => [i + 1, n.did]) }];
      if (/SELECT id,flds,tags,mid FROM notes/.test(sql)) return [{ values: c.notes.map((n, i) => [i + 1, n.fields.join('\x1f'), n.tags || '', String(n.mid)]) }];
      return [];
    }
    close() {}
  }
  SQL = { Database: DB };
};
exports.build = async (p, coll, name) => {
  await p.addScriptTag({ path: JSZIP });
  await p.evaluate(exports.FAKE_SQL);
  return p.evaluate(async ([coll, name]) => {
    const z = new JSZip(); z.file('collection.anki2', JSON.stringify(coll)); z.file('media', '{}');
    const blob = await z.generateAsync({ type: 'blob' }); const f = new File([blob], name, { type: 'application/octet-stream' });
    window.__apkgFile = f; return f.size;
  }, [coll, name]);
};
// a Marrow-like note type and helpers
exports.MODELS = { 1: { flds: ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation', 'ID'].map(name => ({ name })) } };
let n = 0;
exports.note = (did, stem, tags) => { n++; return { did, mid: 1, tags: tags || '', fields: [stem + ' (' + n + ')', 'Right ' + n, 'Wrong b', 'Wrong c', 'Wrong d', 'A', 'Because ' + n + '.', 'MF' + (1000 + n)] }; };
