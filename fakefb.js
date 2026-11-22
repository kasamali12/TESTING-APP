// Test helper: a stand-in for the Firebase Realtime Database REST endpoint. Every request to firebaseio.com is answered here from memory,
// so a test can never reach the real database. Supports GET / PUT / PATCH / DELETE on "<path>.json" and records what was sent.
exports.install = async (p, db) => {
  const log = []; db = db || {};
  const walk = (segs, make) => { let n = db; for (let i = 0; i < segs.length; i++) { if (n == null || typeof n !== 'object') return undefined; if (!(segs[i] in n)) { if (!make) return undefined; n[segs[i]] = {}; } n = n[segs[i]]; } return n; };
  const state = { fail: null };    // set to a status code to make every request fail
  await p.route(/firebaseio\.com/, async route => {
    const req = route.request(), u = new URL(req.url()), method = req.method();
    const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,PATCH,DELETE,OPTIONS', 'content-type': 'application/json' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    const segs = decodeURIComponent(u.pathname).replace(/^\/+/, '').replace(/\.json$/, '').split('/').filter(Boolean);
    const body = req.postData() || '';
    log.push({ method, path: segs.join('/'), body });
    if (state.fail) return route.fulfill({ status: state.fail, headers: H, body: JSON.stringify({ error: 'x' }) });
    if (method === 'GET') { const n = walk(segs, false); return route.fulfill({ status: 200, headers: H, body: JSON.stringify(n === undefined ? null : n) }); }
    if (method === 'DELETE') { const par = walk(segs.slice(0, -1), false); if (par && typeof par === 'object') delete par[segs[segs.length - 1]]; return route.fulfill({ status: 200, headers: H, body: 'null' }); }
    if (method === 'PUT' || method === 'PATCH') {
      const v = JSON.parse(body || 'null'), par = walk(segs.slice(0, -1), true), k = segs[segs.length - 1];
      if (method === 'PUT') par[k] = v; else par[k] = Object.assign(par[k] || {}, v);
      return route.fulfill({ status: 200, headers: H, body: JSON.stringify(v) });
    }
    return route.fulfill({ status: 405, headers: H, body: '{}' });
  });
  return { db, log, state, writes: () => log.filter(r => r.method !== 'GET') };
};
