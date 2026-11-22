// Test helper: a stand-in for the Firebase Realtime Database REST endpoint. Every request to firebaseio.com is answered here from memory,
// so a test can never reach the real database. Supports GET / PUT / PATCH / DELETE on "<path>.json" and records what was sent.
// PATCH is a multi-path update like the real one: every key is a path ("w/abc/t"), null deletes, {".sv":"timestamp"} becomes the server time.
// install(page, db, { rules }) also enforces a rules file (through rules_eval.js, a stand-in for Google's engine): refused requests answer 401 and are listed in state.denied.
exports.install = async (p, db, opts) => {
  opts = opts || {};
  const log = []; db = db || {};
  const walk = (segs, make) => { let n = db; for (let i = 0; i < segs.length; i++) { if (n == null || typeof n !== 'object') return undefined; if (!(segs[i] in n)) { if (!make) return undefined; n[segs[i]] = {}; } n = n[segs[i]]; } return n; };
  const state = { fail: null, now: () => Date.now(), denied: [] };    // fail: a status code makes every request fail · now(): the server clock · denied: requests the rules refused
  const sv = v => (v && typeof v === 'object') ? (v['.sv'] === 'timestamp' ? state.now() : Object.keys(v).reduce((o, k) => (o[k] = sv(v[k]), o), Array.isArray(v) ? [] : {})) : v;
  const eng = () => opts.rules ? require('./rules_eval').engine(opts.rules, state.now()) : null;
  const setAt = (ks, v) => { if (v === null || v === undefined) { const par = walk(ks.slice(0, -1), false); if (par && typeof par === 'object') delete par[ks[ks.length - 1]]; } else walk(ks.slice(0, -1), true)[ks[ks.length - 1]] = v; };
  await p.route(/firebaseio\.com/, async route => {
    const req = route.request(), u = new URL(req.url()), method = req.method();
    const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,PATCH,DELETE,OPTIONS', 'content-type': 'application/json' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    const segs = decodeURIComponent(u.pathname).replace(/^\/+/, '').replace(/\.json$/, '').split('/').filter(Boolean);
    const body = req.postData() || '';
    log.push({ method, path: segs.join('/'), body });
    if (state.fail) return route.fulfill({ status: state.fail, headers: H, body: JSON.stringify({ error: 'x' }) });
    const refuse = why => { state.denied.push({ method, path: segs.join('/'), why }); return route.fulfill({ status: 401, headers: H, body: JSON.stringify({ error: 'Permission denied' }) }); };
    if (method === 'GET') { if (eng() && !eng().canRead(db, segs.join('/'))) return refuse('read'); const n = walk(segs, false); return route.fulfill({ status: 200, headers: H, body: JSON.stringify(n === undefined ? null : n) }); }
    if (method === 'DELETE') { if (eng()) { const r = eng().write(db, segs.join('/'), null); if (!r.ok) return refuse(r.why); } const par = walk(segs.slice(0, -1), false); if (par && typeof par === 'object') delete par[segs[segs.length - 1]]; return route.fulfill({ status: 200, headers: H, body: 'null' }); }
    if (method === 'PUT' || method === 'PATCH') {
      const v = JSON.parse(body || 'null');
      if (eng()) { const r = method === 'PUT' ? eng().write(db, segs.join('/'), sv(v)) : eng().update(db, segs.join('/'), v); if (!r.ok) return refuse(r.why); }
      if (method === 'PUT') setAt(segs, sv(v)); else Object.keys(v || {}).forEach(k => setAt(segs.concat(k.split('/').filter(Boolean)), sv(v[k])));
      return route.fulfill({ status: 200, headers: H, body: JSON.stringify(sv(v)) });
    }
    return route.fulfill({ status: 405, headers: H, body: '{}' });
  });
  return { db, log, state, writes: () => log.filter(r => r.method !== 'GET') };
};
