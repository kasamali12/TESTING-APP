// A small stand-in for the Firebase Realtime Database rules engine: just enough of it to run the expressions used in firebase/database.rules.json
// (.read, .write, .validate, $wildcards, newData / data / root / now, hasChildren, isNumber, matches ...).
// It is NOT Google's engine. It lets the tests check that the rules accept exactly what the app writes and refuse bad rows; the final check is the
// "Rules Playground" in the Firebase console (see firebase/SETUP.md).
const norm = v => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { const n = norm(x); if (n !== null) o[i] = n; }); return Object.keys(o).length ? o : null; }   // arrays are stored as objects with numeric keys; empty ones vanish
  if (typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { const n = norm(v[k]); if (n !== null) o[k] = n; }); return Object.keys(o).length ? o : null; }
  return v;
};
class Snap {
  constructor(root, segs) { this.root = root; this.segs = segs; }
  val() { let n = this.root; for (const s of this.segs) { if (n === null || typeof n !== 'object' || !(s in n)) return null; n = n[s]; } return n; }
  child(p) { return new Snap(this.root, this.segs.concat(String(p).split('/').filter(Boolean))); }
  parent() { return new Snap(this.root, this.segs.slice(0, -1)); }
  exists() { return this.val() !== null; }
  hasChild(p) { return this.child(p).exists(); }
  hasChildren(a) { const v = this.val(); if (v === null || typeof v !== 'object') return false; return a ? a.every(k => k in v) : Object.keys(v).length > 0; }
  isNumber() { return typeof this.val() === 'number'; }
  isString() { return typeof this.val() === 'string'; }
  isBoolean() { return typeof this.val() === 'boolean'; }
}
String.prototype.matches = function (re) { return re.test(String(this)); };
String.prototype.beginsWith = function (x) { return String(this).startsWith(x); };
String.prototype.contains = function (x) { return String(this).includes(x); };

const put = (root, segs, v) => { const r = JSON.parse(JSON.stringify(root || {})); if (!segs.length) return norm(v) || {}; let n = r; for (let i = 0; i < segs.length - 1; i++) { if (n[segs[i]] === undefined || typeof n[segs[i]] !== 'object') n[segs[i]] = {}; n = n[segs[i]]; } const k = segs[segs.length - 1]; if (norm(v) === null) delete n[k]; else n[k] = norm(v); return r; };

exports.engine = (rules, now) => {
  const R = rules.rules, NOW = now || Date.now();
  const chain = segs => {     // the rule node at each depth, with the $variables seen so far
    const out = [{ node: R, vars: {}, depth: 0 }]; let cur = R, vars = {};
    for (let i = 0; i < segs.length; i++) {
      let key = null;
      if (cur && Object.prototype.hasOwnProperty.call(cur, segs[i]) && typeof cur[segs[i]] === 'object') key = segs[i];
      else if (cur) key = Object.keys(cur).find(k => k[0] === '$' && typeof cur[k] === 'object') || null;
      if (key === null) { out.push(null); cur = null; continue; }
      if (key[0] === '$') vars = Object.assign({}, vars, { [key]: segs[i] });
      cur = cur[key]; out.push({ node: cur, vars, depth: i + 1 });
    }
    return out;
  };
  const ev = (expr, oldRoot, newRoot, segs, vars) => {
    if (typeof expr === 'boolean') return expr;
    try { return !!new Function('newData', 'data', 'root', 'now', ...Object.keys(vars), 'return (' + expr + ');')(new Snap(newRoot, segs), new Snap(oldRoot, segs), new Snap(newRoot, []), NOW, ...Object.values(vars)); } catch (e) { return false; }
  };
  const walkNew = (root, segs, f) => { const s = new Snap(root, segs), v = s.val(); if (v === null) return; f(segs); if (typeof v === 'object') Object.keys(v).forEach(k => walkNew(root, segs.concat(k), f)); };
  const sv = v => (v && typeof v === 'object') ? (v['.sv'] === 'timestamp' ? NOW : Object.keys(v).reduce((o, k) => (o[k] = sv(v[k]), o), Array.isArray(v) ? [] : {})) : v;
  const judge = (db, nr, paths) => {
    for (const segs of paths) {
      const ch = chain(segs);
      if (!ch.some((c, d) => c && c.node['.write'] !== undefined && ev(c.node['.write'], db, nr, segs.slice(0, d), c.vars))) return { ok: false, why: 'no .write rule allows /' + segs.join('/') };
    }
    let bad = null;
    const check = p => { if (bad) return; const c = chain(p)[p.length]; if (c && c.node['.validate'] !== undefined && !ev(c.node['.validate'], db, nr, p, c.vars)) bad = '.validate failed at /' + p.join('/'); };
    for (const segs of paths) {
      for (let i = 0; i <= segs.length; i++) if (new Snap(nr, segs.slice(0, i)).exists()) check(segs.slice(0, i));   // the node written and every parent whose data changed
      walkNew(nr, segs, p => { if (p.length > segs.length) check(p); });                                              // and everything below it
    }
    return bad ? { ok: false, why: bad } : { ok: true };
  };
  return {
    canRead(db, path) { const segs = path.split('/').filter(Boolean); return chain(segs).some((c, d) => c && c.node['.read'] !== undefined && ev(c.node['.read'], db, db, segs.slice(0, d), c.vars)); },
    write(db, path, value) {
      const segs = path.split('/').filter(Boolean), nr = put(db, segs, value);
      return judge(db, nr, [segs]);
    },
    // A multi-path update, as the REST PATCH and the SDK's update() send it: { 'a/b': v, 'c': w, ... }. It is all-or-nothing, and every rule sees the data as it
    // will be once the WHOLE update has been applied (newData.parent().child(...) reads the other paths of the same update). {".sv":"timestamp"} becomes now.
    update(db, path, obj) {
      const base = path.split('/').filter(Boolean); let nr = db; const all = [];
      Object.keys(obj).forEach(k => { const segs = base.concat(k.split('/').filter(Boolean)); nr = put(nr, segs, sv(obj[k])); all.push(segs); });
      const r = judge(db, nr, all); if (r.ok) r.db = nr; return r;
    },
    apply: (db, path, value) => put(db, path.split('/').filter(Boolean), value),
  };
};
