/* StudyDeck v39 — install, offline, updates, quiz resume, one-hand layout, quick keys.
 * Additive only: nothing here replaces app logic. Every hook is guarded, so a missing
 * function or blocked storage simply turns that one feature off. */
(function () {
  'use strict';
  if (window.__sdV39) return;
  window.__sdV39 = true;

  var doc = document, root = doc.documentElement;
  var isHttp = /^https?:$/.test(location.protocol);
  function $(id) { return doc.getElementById(id); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function say(msg, type) { try { if (typeof toast === 'function') toast(msg, type || ''); } catch (e) {} }
  function appVisible() { var w = $('sd-app-wrapper'); return !!w && w.style.display !== 'none'; }
  function quizActive() { var q = $('sq'); return !!q && !q.classList.contains('hidden'); }
  function homeVisible() { var h = $('shome'); return !!h && !h.classList.contains('hidden'); }
  function typing(t) {
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable;
  }
  function el(html) { var d = doc.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ───────────── 1. One-hand layout ───────────── */
  function savedAppearance() { try { return JSON.parse(lsGet('sd-appearance') || '{}') || {}; } catch (e) { return {}; } }
  function setLayoutMode(mode) {
    mode = mode === 'onehand' ? 'onehand' : 'auto';
    root.setAttribute('data-layout', mode);
    var a = $('lay-auto'), b = $('lay-onehand');
    if (a) a.classList.toggle('on', mode === 'auto');
    if (b) b.classList.toggle('on', mode === 'onehand');
    try { if (typeof saveAppearancePref === 'function') saveAppearancePref('layout', mode); } catch (e) {}
  }
  window.setLayoutMode = setLayoutMode;
  root.setAttribute('data-layout', savedAppearance().layout === 'onehand' ? 'onehand' : 'auto');

  function injectLayoutRow() {
    var tog = $('tog-motion');
    if (!tog || $('sg-layout')) return;
    var row = tog.closest('.set-row');
    if (!row) return;
    var mode = root.getAttribute('data-layout');
    var node = el('<div class="set-row"><div><div class="sr-lbl">Layout</div><div class="sr-sub">One-hand moves the main buttons within thumb reach</div></div>' +
      '<div class="seg-grp" id="sg-layout"><button class="seg' + (mode === 'auto' ? ' on' : '') + '" id="lay-auto" type="button">Standard</button>' +
      '<button class="seg' + (mode === 'onehand' ? ' on' : '') + '" id="lay-onehand" type="button">One-hand</button></div></div>');
    row.insertAdjacentElement('afterend', node);
    $('lay-auto').addEventListener('click', function () { setLayoutMode('auto'); });
    $('lay-onehand').addEventListener('click', function () { setLayoutMode('onehand'); });
  }
  /* "Reset appearance" should also reset the layout. */
  if (typeof window.resetAppearance === 'function' && !window.__sdResetWrapped) {
    window.__sdResetWrapped = true;
    var origReset = window.resetAppearance;
    window.resetAppearance = function () { var r = origReset.apply(this, arguments); setLayoutMode('auto'); setAmoled(false); return r; };
  }

  /* ───────────── 1b. True black (AMOLED) ───────────── */
  var themeMeta = doc.querySelector('meta[name="theme-color"]');
  var metaOrig = themeMeta ? themeMeta.getAttribute('content') : null;
  function syncThemeColor() {
    if (!themeMeta) return;
    var on = root.getAttribute('data-amoled') === '1' && root.getAttribute('data-theme') !== 'light';
    themeMeta.setAttribute('content', on ? '#000000' : metaOrig);
  }
  function setAmoled(on) {
    on = !!on;
    if (on) root.setAttribute('data-amoled', '1'); else root.removeAttribute('data-amoled');
    var cb = $('tog-amoled'); if (cb) cb.checked = on;
    syncThemeColor();
    try { if (typeof saveAppearancePref === 'function') saveAppearancePref('amoled', on); } catch (e) {}
  }
  window.setAmoled = setAmoled;
  if (savedAppearance().amoled === true) root.setAttribute('data-amoled', '1');
  try { new MutationObserver(syncThemeColor).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-amoled'] }); } catch (e) {}
  syncThemeColor();
  function injectAmoledRow() {
    var dark = $('tmode-dark');
    if (!dark || $('tog-amoled')) return;
    var row = dark.closest('.set-row');
    if (!row) return;
    var node = el('<div class="set-row"><div><div class="sr-lbl">True black</div><div class="sr-sub">Pure black background for AMOLED screens. Dark theme only.</div></div>' +
      '<label class="tog"><input type="checkbox" id="tog-amoled"><span class="tsl"></span></label></div>');
    row.insertAdjacentElement('afterend', node);
    var cb = $('tog-amoled'); cb.checked = root.getAttribute('data-amoled') === '1';
    cb.addEventListener('change', function () { setAmoled(cb.checked); });
  }

  /* ───────────── 2. Docks (one small card above the bottom bar) ───────────── */
  var dockEl = null, docks = {}, PRIORITY = { update: 3, resume: 2, backup: 1.5, install: 1 };
  var OVERLAYS = '.modal-ov, .sheet-overlay, .cmodal-ov, .gsearch-ov, .palette-ov, .note-modal-ov, .sd-modal-ov, #neet-ov';
  function overlayOpen() {
    var n = doc.querySelectorAll(OVERLAYS);
    for (var i = 0; i < n.length; i++) {
      var cs = getComputedStyle(n[i]);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && n[i].getClientRects().length) return true;
    }
    return false;
  }
  function dockAllowed(key) {
    if (!appVisible()) return false;
    if (overlayOpen()) return false;
    if (key === 'update') return !quizActive();
    return homeVisible() && !quizActive();
  }
  function renderDock() {
    var best = null;
    Object.keys(docks).forEach(function (k) {
      if (dockAllowed(k) && (!best || PRIORITY[k] > PRIORITY[best])) best = k;
    });
    if (!best) { if (dockEl) { dockEl.remove(); dockEl = null; dockEl_key = null; } return; }
    var d = docks[best];
    if (dockEl && dockEl_key === best && dockEl.__sig === d.sig) return;
    if (dockEl) dockEl.remove();
    dockEl_key = best;
    dockEl = el('<div id="sd-dock" role="status" aria-live="polite"><div class="dk-txt"><div class="dk-t">' + esc(d.title) + '</div><div class="dk-s">' + esc(d.sub || '') + '</div></div><div class="dk-act"></div></div>');
    dockEl.__sig = d.sig;
    var box = dockEl.querySelector('.dk-act');
    d.actions.forEach(function (a) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'dk-btn' + (a.primary ? ' pri' : '') + (a.icon ? ' ic' : '');
      b.textContent = a.label;
      if (a.aria) b.setAttribute('aria-label', a.aria);
      b.addEventListener('click', function () { a.fn(); });
      box.appendChild(b);
    });
    doc.body.appendChild(dockEl);
  }
  var dockEl_key = null;
  function setDock(key, cfg) { cfg.sig = JSON.stringify([cfg.title, cfg.sub]); docks[key] = cfg; renderDock(); }
  function clearDock(key) { delete docks[key]; renderDock(); }
  setInterval(renderDock, 1200);

  /* ───────────── 3. Service worker, updates, install ───────────── */
  var swState = { reg: null, status: isHttp ? 'pending' : 'file', build: '', deferred: null, installed: false };
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function offerUpdate(reg) {
    setDock('update', {
      title: 'A new version is ready',
      sub: 'Update now. Your progress is saved.',
      actions: [
        { label: 'Later', fn: function () { clearDock('update'); } },
        { label: 'Update', primary: true, fn: function () {
          var w = reg.waiting;
          if (w) w.postMessage({ type: 'SKIP_WAITING' }); else location.reload();
        } }
      ]
    });
  }
  function refreshSettingsStatus() {
    var pill = $('ao-offline-pill'), sub = $('ao-offline-sub'), ver = $('ao-ver-sub'), upd = $('ao-update-btn');
    if (!pill) return;
    var map = {
      ready: ['Ready', 'ok', 'Decks and the app open without internet.'],
      pending: ['Setting up', 'warn', 'Reload once to finish turning on offline use.'],
      file: ['This file', 'off', 'Opened as a local file. Offline use is built in; install needs the hosted link.'],
      failed: ['Not set up', 'off', 'sw.js was not found next to index.html.']
    };
    var m = map[swState.status] || map.pending;
    pill.textContent = m[0]; pill.className = 'ao-pill ' + m[1]; sub.textContent = m[2];
    ver.textContent = swState.build ? 'Build ' + swState.build : (swState.status === 'file' ? 'Single-file copy' : 'Checking…');
    if (upd) upd.disabled = !swState.reg;
    var ib = $('ao-install-btn'), isub = $('ao-install-sub');
    if (ib && isub) {
      if (standalone || swState.installed) { ib.style.display = 'none'; isub.textContent = 'Installed on this device.'; }
      else if (swState.deferred) { ib.style.display = ''; isub.textContent = 'Add StudyDeck to your home screen or desktop.'; }
      else if (isIOS) { ib.style.display = 'none'; isub.textContent = 'In Safari tap Share, then Add to Home Screen.'; }
      else { ib.style.display = 'none'; isub.textContent = isHttp ? 'Use your browser menu: Install app.' : 'Open the hosted link to install.'; }
    }
  }
  function initServiceWorker() {
    if (!isHttp || !('serviceWorker' in navigator)) { refreshSettingsStatus(); return; }
    /* Use the real manifest file when hosted (the embedded one stays as the fallback for local files). */
    var link = doc.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', 'manifest.webmanifest');
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return; reloading = true; location.reload();
    });
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'VERSION') { swState.build = e.data.build; refreshSettingsStatus(); }
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      swState.reg = reg;
      swState.status = navigator.serviceWorker.controller ? 'ready' : 'pending';
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(reg);
        });
      });
      navigator.serviceWorker.ready.then(function (r) {
        swState.status = 'ready';
        var a = r.active || navigator.serviceWorker.controller;
        if (a) a.postMessage({ type: 'GET_VERSION' });
        refreshSettingsStatus();
      });
      doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible') reg.update().catch(function () {}); });
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
      refreshSettingsStatus();
    }).catch(function () { swState.status = 'failed'; refreshSettingsStatus(); });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    swState.deferred = e;
    refreshSettingsStatus();
    var last = parseInt(lsGet('sd-v39-install-ask') || '0', 10);
    if (!standalone && Date.now() - last > 14 * 864e5) {
      setDock('install', {
        title: 'Install StudyDeck',
        sub: 'Opens like an app and works offline.',
        actions: [
          { label: 'Not now', fn: function () { lsSet('sd-v39-install-ask', String(Date.now())); clearDock('install'); } },
          { label: 'Install', primary: true, fn: doInstall }
        ]
      });
    }
  });
  function doInstall() {
    var p = swState.deferred;
    if (!p) return;
    p.prompt();
    p.userChoice.then(function (c) {
      lsSet('sd-v39-install-ask', String(Date.now()));
      swState.deferred = null; clearDock('install'); refreshSettingsStatus();
      if (c && c.outcome === 'accepted') say('Installing StudyDeck…', 'success');
    }).catch(function () {});
  }
  window.addEventListener('appinstalled', function () { swState.installed = true; swState.deferred = null; clearDock('install'); refreshSettingsStatus(); });

  /* Ask the browser to keep local data (decks, progress) from being cleared when storage runs low. */
  function updatePersistUi() {
    var sub = $('ao-persist-sub'), btn = $('ao-persist-btn');
    if (!sub) return;
    if (!(navigator.storage && navigator.storage.persisted)) { sub.textContent = 'Not supported in this browser.'; if (btn) btn.style.display = 'none'; return; }
    navigator.storage.persisted().then(function (p) {
      sub.textContent = p ? 'Protected. The browser will not clear your decks or progress.' : 'Not protected yet. Tap Protect, and also keep a backup.';
      if (btn) btn.style.display = p ? 'none' : '';
    }).catch(function () {});
  }
  function requestPersist(quiet) {
    if (!(navigator.storage && navigator.storage.persist)) return;
    navigator.storage.persist().then(function (ok) {
      updatePersistUi();
      if (!quiet) say(ok ? 'Your data is now protected on this device' : 'The browser did not allow it. Keep a backup too.', ok ? 'success' : '');
    }).catch(function () {});
  }

  function injectAppGroup() {
    if ($('sg-appoffline')) return;
    var groups = doc.querySelectorAll('#sset .sg'), anchor = null;
    for (var i = 0; i < groups.length; i++) {
      var l = groups[i].querySelector('.sg-lbl');
      if (l && /Appearance/.test(l.textContent)) { anchor = groups[i]; break; }
    }
    if (!anchor) return;
    var g = el('<div class="sg collapsed" id="sg-appoffline"><div class="sg-lbl" onclick="toggleSetGroup(this)">📲 App &amp; Offline<span class="sg-chev">▾</span></div><div class="sg-body">' +
      '<div class="set-row"><div><div class="sr-lbl">Install app</div><div class="sr-sub" id="ao-install-sub"></div></div><button type="button" class="set-act set-ok" id="ao-install-btn" style="display:none">Install</button></div>' +
      '<div class="set-row"><div><div class="sr-lbl">Offline use</div><div class="sr-sub" id="ao-offline-sub"></div></div><span class="ao-pill" id="ao-offline-pill"></span></div>' +
      '<div class="set-row"><div><div class="sr-lbl">Updates</div><div class="sr-sub" id="ao-ver-sub"></div></div><button type="button" class="set-act" id="ao-update-btn">Check</button></div>' +
      '<div class="set-row"><div><div class="sr-lbl">Backup</div><div class="sr-sub" id="ao-backup-sub"></div></div><button type="button" class="set-act set-ok" id="ao-backup-btn">Back up now</button></div>' +
      '<div class="set-row"><div><div class="sr-lbl">Keep data safe</div><div class="sr-sub" id="ao-persist-sub"></div></div><button type="button" class="set-act" id="ao-persist-btn">Protect</button></div>' +
      '<div class="set-row"><div><div class="sr-lbl">Quick keys</div><div class="sr-sub">Ctrl/⌘+K or / opens search. Alt+1 to 5 switch tabs.</div></div></div>' +
      '</div></div>');
    anchor.insertAdjacentElement('afterend', g);
    $('ao-install-btn').addEventListener('click', doInstall);
    $('ao-persist-btn').addEventListener('click', function () { requestPersist(false); });
    $('ao-backup-btn').addEventListener('click', function () { if (typeof exportAllData === 'function') exportAllData(); });
    $('ao-update-btn').addEventListener('click', function () {
      var reg = swState.reg; if (!reg) return;
      var b = $('ao-update-btn'); b.disabled = true; b.textContent = 'Checking…';
      reg.update().then(function () {
        setTimeout(function () {
          b.disabled = false; b.textContent = 'Check';
          if (reg.waiting) offerUpdate(reg); else say('You have the latest version', 'success');
        }, 1200);
      }).catch(function () { b.disabled = false; b.textContent = 'Check'; say('Could not check. Are you online?'); });
    });
    refreshSettingsStatus(); updatePersistUi(); refreshBackupUi();
  }

  /* ───────────── 4. Resume an unfinished quiz ───────────── */
  var RESUME_KEY = 'quiz', RESUME_MAX_AGE = 14 * 864e5;
  var lastStart = { title: '', node: null }, finished = false, saveTimer = null;
  function userKey() {
    try { var d = JSON.parse(lsGet('sd_auth_v1') || 'null'); return String((d && (d.email || d.uid || d.user || d.id)) || ''); } catch (e) { return ''; }
  }
  function openDb() {
    return new Promise(function (res, rej) {
      try {
        var r = indexedDB.open('sd-v39', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
  }
  function kv(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', mode), out;
        try { out = fn(tx.objectStore('kv')); } catch (e) { rej(e); return; }
        tx.oncomplete = function () { db.close(); res(out && out.result); };
        tx.onerror = tx.onabort = function () { db.close(); rej(tx.error); };
      });
    });
  }
  function kvGet(k) { return kv('readonly', function (s) { return s.get(k); }); }
  function kvSet(k, v) { return kv('readwrite', function (s) { return s.put(v, k); }); }
  function kvDel(k) { return kv('readwrite', function (s) { return s.delete(k); }); }

  function resumable() {
    try {
      return quizActive() && Array.isArray(roundQ) && roundQ.length > 0 && qi < roundQ.length &&
        !isNeetMode && !isGlobalTimer && !currentTestId && !finished;
    } catch (e) { return false; }
  }
  function answeredCount() { var n = 0; for (var i = 0; i < qUserAns.length; i++) if (qUserAns[i] !== -1) n++; return n; }
  function snapshot() {
    return {
      v: 1, user: userKey(), ts: Date.now(),
      title: lastStart.title || 'Practice quiz',
      pathKey: lastStart.node ? lastStart.node.pathKey : null,
      qs: roundQ, qi: qi, sc: sc, streak: streak, maxSt: maxSt, ncorr: ncorr,
      qStatus: qStatus.slice(), qUserAns: qUserAns.slice(),
      res: roundRes.map(function (r) { return r ? { ui: r.ui, ok: r.ok } : null; }),
      elapsed: Date.now() - qStart, answered: answeredCount()
    };
  }
  function saveNow() {
    if (!resumable()) return;
    if (qi === 0 && answeredCount() === 0) return;
    var snap; try { snap = snapshot(); } catch (e) { return; }
    kvSet(RESUME_KEY, snap).catch(function () {
      try { kvSet(RESUME_KEY, JSON.parse(JSON.stringify(snap))).catch(function () {}); } catch (e) {}
    });
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); }
  function clearSaved() { clearTimeout(saveTimer); kvDel(RESUME_KEY).catch(function () {}); clearDock('resume'); }

  function wrapGlobal(name, make) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__sdWrapped) return;
    var w = make(orig); w.__sdWrapped = true; window[name] = w;
  }
  /* Same as wrapGlobal, but it also wraps a function that an earlier fix already wrapped (the new wrapper runs outermost). */
  function wrapMore(name, make) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__sdMore) return;
    var w = make(orig); w.__sdWrapped = true; w.__sdMore = true; window[name] = w;
  }
  wrapGlobal('startQuizWithQ', function (orig) {
    return function (qs, title, node) { lastStart = { title: title || '', node: node || null }; finished = false; return orig.apply(this, arguments); };
  });
  wrapGlobal('renderQ', function (orig) {
    return function () { var r = orig.apply(this, arguments); saveSoon(); return r; };
  });
  wrapGlobal('endQuiz', function (orig) {
    return function () { finished = true; clearSaved(); return orig.apply(this, arguments); };
  });
  /* A tapped answer waits 280 ms before it locks in. Moving on inside that window (Save & Next, Mark, Back, the palette,
     Clear, Submit) used to leave it unsaved or store it on the next question. Lock it in first, then move. */
  ['qzSaveNext', 'qzReviewNext', 'qzBack', 'palJumpTo', 'palGoTo', 'qzClearAns', 'qzSubmit', '_doSubmit'].forEach(function (n) {
    wrapGlobal(n, function (orig) {
      return function () {
        try { if (typeof _pendingAnswerIdx !== 'undefined' && _pendingAnswerIdx >= 0 && typeof _lockAnswer === 'function') _lockAnswer(_pendingAnswerIdx); } catch (e) {}
        return orig.apply(this, arguments);
      };
    });
  });
  /* The player's own quiz options (how many questions, timer, shuffle, subtopics, explanations, difficulty rating) are kept in
     `cfg`. A Custom test, a NEET PG mock and a test retry overwrite cfg for their own run and never put it back, so the next
     practice quiz started with the test's numbers (10 questions, no shuffle) while the sheet still showed what the player had
     picked; Shuffle, Subtopics and Difficulty rating were also never written down at all. The player's choices live in `mine`
     (saved with the other quiz defaults) and are put back before any practice quiz starts. */
  var QKEYS = ['count', 'timer', 'shuffle', 'subs', 'exp', 'rateDiff'];
  var CTRL = { 'tog-sh': 'shuffle', 'qm-sh': 'shuffle', 'tog-sub': 'subs', 'qm-sub-tog': 'subs', 'tog-diff': 'rateDiff', 'qm-diff': 'rateDiff', 'tog-ex': 'exp', 'qm-ex': 'exp' };
  var mine = null;
  function ensureMine() {
    if (mine) return mine;
    mine = {}; QKEYS.forEach(function (k) { mine[k] = cfg[k]; });
    try {
      var s = JSON.parse(localStorage.getItem('sd-quiz-opts') || '{}');
      ['shuffle', 'subs', 'rateDiff'].forEach(function (k) { if (typeof s[k] === 'boolean') mine[k] = s[k]; });
      var pr = JSON.parse(localStorage.getItem('sd-app-prefs') || '{}');
      if (typeof pr.autoExp === 'boolean') mine.exp = pr.autoExp;
    } catch (e) {}
    return mine;
  }
  function saveMine() {
    try {
      var s = JSON.parse(localStorage.getItem('sd-quiz-opts') || '{}');
      ['count', 'timer', 'shuffle', 'subs', 'rateDiff'].forEach(function (k) { s[k] = mine[k]; });
      localStorage.setItem('sd-quiz-opts', JSON.stringify(s));
    } catch (e) {}
  }
  function syncControls() {
    ensureMine();
    var set = function (id, v) { var e = doc.getElementById(id); if (e && e.checked !== !!v) e.checked = !!v; };
    Object.keys(CTRL).forEach(function (id) { set(id, mine[CTRL[id]]); });
    ['count', 'timer'].forEach(function (k) {
      doc.querySelectorAll('[onclick^="pickSeg(this,\'' + k + '\'"],[onclick^="pickCfg(this,\'' + k + '\'"]').forEach(function (b) {
        var m = (b.getAttribute('onclick') || '').match(/,\s*(-?\d+)\s*\)/); if (m) b.classList.toggle('on', +m[1] === mine[k]);
      });
    });
  }
  function practiceReset() {
    try {
      ensureMine(); QKEYS.forEach(function (k) { cfg[k] = mine[k]; });
      if (typeof currentTestId !== 'undefined' && !currentTestId) { isNeetMode = false; isGlobalTimer = false; currentTestType = 'neet'; }
      syncControls();
    } catch (e) {}
  }
  ['executeNeetTest', 'executeCustomTest', 'retryTest'].forEach(function (n) {
    wrapGlobal(n, function (orig) { return function () { try { ensureMine(); } catch (e) {} return orig.apply(this, arguments); }; });
  });
  ['openQuizModal', 'startQuiz', 'startQuizFromStarred', 'startDailyPlanQuiz', 'startWeakAreaQuiz', 'startMarksWeightedWeakQuiz', 'startDiagnosticQuiz', 'startConceptLinkQuiz'].forEach(function (n) {
    wrapGlobal(n, function (orig) { return function () { practiceReset(); return orig.apply(this, arguments); }; });
  });
  ['pickSeg', 'pickCfg'].forEach(function (n) {
    wrapGlobal(n, function (orig) {
      return function (el, key, val) {
        var r = orig.apply(this, arguments);
        try { if (key === 'count' || key === 'timer') { ensureMine()[key] = val; saveMine(); syncControls(); } } catch (e) {}
        return r;
      };
    });
  });
  wrapGlobal('navTo', function (orig) {
    return function (w) { var r = orig.apply(this, arguments); if (w === 'set') { try { syncControls(); } catch (e) {} } return r; };
  });
  doc.addEventListener('change', function (ev) {
    var k = ev.target && CTRL[ev.target.id]; if (!k) return;
    try { ensureMine()[k] = !!ev.target.checked; saveMine(); syncControls(); } catch (e) {}
  });
  try { practiceReset(); } catch (e) {}

  /* Browse draws from a snapshot (browseQ) taken when the screen opens. Editing, adding or deleting a question saved it correctly
     but the list (and its "N questions" line) kept showing the old snapshot until you left and came back, so a deleted question
     stayed on screen. The snapshot is rebuilt from the saved questions right after each of those actions. */
  async function refreshBrowse() {
    var br = doc.getElementById('sbrowse'); if (!br || br.classList.contains('hidden')) return;
    var node = (typeof browseNodePK !== 'undefined' && browseNodePK && typeof nodeByKey !== 'undefined') ? nodeByKey[browseNodePK] : null;
    if (node) {
      browseQ = await collectQ(node, true);
      if (typeof setTb === 'function') setTb('Browse · ' + node.name, browseQ.length.toLocaleString() + ' questions', function () { navTo('lib'); renderLib(); });
    } else {
      var all = {};
      (function walk(ns) { (ns || []).forEach(function (n) { (qCache[n.pathKey] || []).forEach(function (q) { if (q && q.sid) all[q.sid] = q; }); walk(n.children); }); })(rootNodes);
      browseQ = browseQ.filter(function (q) { return all[q.sid]; }).map(function (q) { return all[q.sid]; });
    }
    renderBrowse();
  }
  ['saveQ', 'deleteQ'].forEach(function (n) {
    wrapGlobal(n, function (orig) {
      return async function () { var r = await orig.apply(this, arguments); try { await refreshBrowse(); } catch (e) {} return r; };
    });
  });

  /* ── Import report ──
   * The CSV and Excel readers used to leave out a row with fewer than two options, and to give any missing or unreadable
   * correct letter the answer A, without telling anyone. The build patch (1q–1r) now notes those row numbers in __sdImp;
   * this shows them once the import has finished, so a wrong answer key does not go unnoticed. */
  function rowList(a) { return a.slice(0, 8).join(', ') + (a.length > 8 ? ' and ' + (a.length - 8) + ' more' : ''); }
  function importNotice(info) {
    if (!info || !((info.nokey && info.nokey.length) || (info.skip && info.skip.length))) return;
    var parts = [], nk = info.nokey || [], sk = info.skip || [];
    if (nk.length) parts.push(nk.length + (nk.length === 1 ? ' question has no readable correct letter and is set to A' : ' questions have no readable correct letter and are set to A') + ' (row ' + rowList(nk) + ')');
    if (sk.length) parts.push(sk.length + (sk.length === 1 ? ' row was left out' : ' rows were left out') + ', a question needs at least 2 options (row ' + rowList(sk) + ')');
    var prev = doc.querySelector('.toast'), head = prev && /Imported/.test(prev.textContent) ? prev.textContent.replace(/^[^A-Za-z0-9]+/, '').replace(/[!.\s]+$/, '') : 'Imported';
    doc.querySelectorAll('.toast').forEach(function (x) { x.remove(); });
    var t = doc.createElement('div');
    t.className = 'toast warning'; t.setAttribute('role', 'status'); t.style.cursor = 'pointer';
    t.textContent = head + '. Check your file: ' + parts.join('. ') + '. Tap to close.';
    function bye() { t.style.animation = 'toastOut .25s ease forwards'; setTimeout(function () { t.remove(); }, 250); }
    t.addEventListener('click', bye); doc.body.appendChild(t); setTimeout(bye, 20000);
  }
  ['importCSV', 'importXLS'].forEach(function (n) {
    wrapGlobal(n, function (orig) {
      return async function () {
        window.__sdImp = { nokey: [], skip: [] };
        var r = await orig.apply(this, arguments);
        try { importNotice(window.__sdImp); } catch (e) {}
        return r;
      };
    });
  });

  /* ── Quiz leftovers ──
   * "Tapped wrong? Undo" lives three seconds and "Last question. Press Submit." about as long. If you submitted or left the quiz
   * in that time they stayed on top of the results, and Undo then rewrote the score of a finished quiz. They end with the quiz. */
  function dropQuizLeftovers() {
    try { if (typeof _hideUndoBar === 'function') _hideUndoBar(); } catch (e) {}
    doc.querySelectorAll('.toast').forEach(function (t) { if (/^(✅ Last question|🔖 Marked for review)/.test(t.textContent)) t.remove(); });
  }
  ['qzSubmit', '_doSubmit'].forEach(function (n) {
    wrapMore(n, function (orig) { return function () { dropQuizLeftovers(); return orig.apply(this, arguments); }; });
  });
  (function () {
    var sq = $('sq'); if (!sq || !window.MutationObserver) return;
    new MutationObserver(function () { if (sq.classList.contains('hidden') || sq.style.display === 'none') dropQuizLeftovers(); })
      .observe(sq, { attributes: true, attributeFilter: ['class', 'style'] });
  })();

  /* ── The end button says what it does ──
   * A practice round ended with "Submit Exam", the same wording as a timed test. Practice now says "Finish quiz". */
  wrapMore('renderQ', function (orig) {
    return function () {
      var r = orig.apply(this, arguments);
      try {
        var b = $('qzb-submit');
        if (b) {
          var want = (typeof currentTestId !== 'undefined' && currentTestId) ? '⏹ Submit Exam' : '⏹ Finish quiz';
          if (b.textContent.trim() !== want) b.textContent = want;
        }
      } catch (e) {}
      return r;
    };
  });

  /* ── Progress is kept after every answer ──
   * The resume point was only written when you moved to the next question or the page was hidden. Answer one question and tap
   * Home, and nothing was kept. It is now written the moment each answer is locked in. */
  wrapMore('_lockAnswer', function (orig) {
    return function () { var r = orig.apply(this, arguments); clearTimeout(saveTimer); saveNow(); return r; };
  });

  /* ── First run ──
   * With no questions at all, Home showed a daily plan for nothing ("Pathology 2Q weak") and "Start Today's Plan" answered with
   * "Couldn't match today's plan to your loaded deck". With no decks the plan card is one clear next step instead. */
  var planHasFiles = null;
  function firstRunCard() {
    var w = $('daily-plan-wrap'); if (!w) return;
    w.innerHTML = '<div class="ana-card sd-firstrun" style="border-color:var(--p);padding:14px">' +
      '<div class="ana-card-hdr" style="margin-bottom:6px"><div class="ana-card-t">📚 Add your questions to begin</div></div>' +
      '<div style="font-size:13px;color:var(--t2);line-height:1.55;margin-bottom:12px">Open an APKG, CSV or Excel file, or start a blank deck. Your daily plan, streak and analytics start once you finish a practice round.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="est-cta" onclick="document.getElementById(\'fi\').click()">📂 Open a file</button>' +
      '<button class="est-cta" style="background:var(--card2);color:var(--t);border:1px solid var(--bdr2);box-shadow:none" onclick="openNewDeckModal()">🌱 Create blank deck</button></div></div>';
  }
  /* ── Reviews due today ──
   * Flashcards are scheduled (spaced repetition) but nothing on Home said a review was waiting. A chip at the top of the plan area
   * counts the cards whose review date has passed, straight from the saved review data (nothing is loaded for it), and opens them
   * as one flashcard session. Only the open deck file can be loaded cheaply, so cards that belong to another deck are reported. */
  function dueCount() {
    var d, n = 0, now = Date.now();
    try { d = _loadSRSData(); } catch (e) { return 0; }
    for (var k in d) { var c = d[k]; if (c && c.dueDate > 0 && c.dueDate <= now) n++; }
    return n;
  }
  function dueChip() {
    var w = $('daily-plan-wrap'); if (!w || w.querySelector('.sd-firstrun')) return;
    var old = w.querySelector('.sd-duechip'); if (old) old.remove();
    var n = dueCount(); if (!n) return;
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'sd-duechip';
    b.setAttribute('aria-label', n + (n === 1 ? ' flashcard is' : ' flashcards are') + ' due for review. Open them.');
    b.innerHTML = '<span class="sd-dc-ic" aria-hidden="true">📅</span><span class="sd-dc-tx"><b>' + n + (n === 1 ? ' flashcard' : ' flashcards') + ' due</b><small>Review them before you forget</small></span><span class="sd-dc-go">Review ›</span>';
    b.onclick = openDueFlashcards;
    w.insertBefore(b, w.firstChild);
  }
  async function openDueFlashcards() {
    if (typeof _sdRequireFeature === 'function' && !_sdRequireFeature('flashcards', 'Flashcards')) return;
    if (typeof ensureDeckLoaded === 'function' && !(await ensureDeckLoaded())) return;
    var all = [], seen = {}, srs = _loadSRSData(), now = Date.now(), i, j, part;
    for (i = 0; i < rootNodes.length; i++) {
      part = await collectQ(rootNodes[i], true);
      for (j = 0; j < part.length; j++) { var q = part[j]; if (q.sid && !seen[q.sid] && srs[q.sid] && srs[q.sid].dueDate > 0 && srs[q.sid].dueDate <= now) { seen[q.sid] = 1; all.push(q); } }
    }
    var total = dueCount();
    if (!all.length) { toast('Your due cards are in another deck. Open that deck from the Library to review them.', 'error'); return; }
    if (all.length < total) toast(all.length + ' due in this deck. ' + (total - all.length) + ' more are in other decks.');
    openFlashcard({ name: 'Due today', pathKey: '__due__', __due: all });
  }
  wrapMore('getQuestionsForNode', function (orig) {
    return function (n) { return n && n.__due ? Promise.resolve(n.__due) : orig.apply(this, arguments); };
  });
  wrapMore('renderDailyPlanCard', function (orig) {
    return function () {
      var self = this, args = arguments, r = orig.apply(self, args);
      if (planHasFiles === false) firstRunCard(); else dueChip();
      if (typeof getAllFiles === 'function') {
        getAllFiles().then(function (f) {
          var had = planHasFiles; planHasFiles = !!(f && f.length);
          if (!planHasFiles) firstRunCard();
          else { if (had === false) orig.apply(self, args); dueChip(); }
        }).catch(function () {});
      }
      return r;
    };
  });

  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') { clearTimeout(saveTimer); saveNow(); } });
  window.addEventListener('pagehide', function () { clearTimeout(saveTimer); saveNow(); });

  function findNode(list, key) {
    if (!list || !key) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].pathKey === key) return list[i];
      var f = findNode(list[i].children, key);
      if (f) return f;
    }
    return null;
  }
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    var d = Math.round(h / 24); return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function resumeQuiz(d) {
    var node = null;
    try { node = findNode(rootNodes, d.pathKey); } catch (e) {}
    var oldShuffle = cfg.shuffle, oldCount = cfg.count;
    cfg.shuffle = false; cfg.count = d.qs.length;
    try { startQuizWithQ(d.qs, d.title, node); }
    finally { cfg.shuffle = oldShuffle; cfg.count = oldCount; }
    qi = Math.min(d.qi, roundQ.length - 1); sc = d.sc; streak = d.streak; maxSt = d.maxSt; ncorr = d.ncorr;
    qStatus = d.qStatus.slice(); qUserAns = d.qUserAns.slice();
    roundRes = d.res.map(function (r, i) { return r ? { q: roundQ[i], ui: r.ui, ok: r.ok } : null; });
    qStart = Date.now() - (d.elapsed || 0);
    renderQ();
    clearDock('resume');
    say('Back at question ' + (qi + 1), 'success');
  }
  function checkResume() {
    if (!appVisible() || quizActive()) return;
    kvGet(RESUME_KEY).then(function (d) {
      if (!d || d.v !== 1 || !d.qs || !d.qs.length) { clearDock('resume'); return; }
      if (Date.now() - d.ts > RESUME_MAX_AGE || d.user !== userKey()) { kvDel(RESUME_KEY).catch(function () {}); clearDock('resume'); return; }
      setDock('resume', {
        title: 'Continue ' + d.title,
        sub: 'Question ' + (d.qi + 1) + ' of ' + d.qs.length + ' · ' + d.answered + ' answered · ' + ago(d.ts),
        actions: [
          { label: '✕', icon: true, aria: 'Discard this quiz', fn: function () { kvDel(RESUME_KEY).catch(function () {}); clearDock('resume'); } },
          { label: 'Resume', primary: true, fn: function () { resumeQuiz(d); } }
        ]
      });
    }).catch(function () {});
  }
  setInterval(function () { if (homeVisible() && !docks.resume) checkResume(); }, 2500);

  /* ───────────── 5. Quick keys ───────────── */
  doc.addEventListener('keydown', function (e) {
    if (!appVisible()) return;
    var key = e.key;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (key === 'k' || key === 'K')) {
      if (typeof openGSearch === 'function') {
        e.preventDefault();
        var gsOpen = false; try { gsOpen = !!_gsearchOpen; } catch (err) {}
        if (!gsOpen) openGSearch();
      }
      return;
    }
    /* Alt+1..5 switches tabs, even while a text box has focus (Alt+digit does not type anything). */
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^Digit[1-5]$/.test(e.code || '') && !quizActive() && typeof navTo === 'function') {
      e.preventDefault();
      try { if (typeof closeGSearch === 'function' && _gsearchOpen) closeGSearch(); } catch (err) {}
      navTo(['home', 'lib', 'tests', 'ana', 'set'][parseInt(e.code.slice(5), 10) - 1]);
      return;
    }
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (key === '/' && typeof openGSearch === 'function') { e.preventDefault(); openGSearch(); }
  }, true);

  /* ───────────── 6. Connection notices ───────────── */
  window.addEventListener('offline', function () { if (appVisible()) say('You are offline. Your decks and progress still work.'); });
  window.addEventListener('online', function () { if (appVisible()) say('Back online', 'success'); });

  /* ───────────── 6b. Backup reminder ─────────────
   * Decks and progress live only in this browser. Remember when the last full backup was made
   * (the app's own Export button) and nudge when it is old. */
  var BK_LAST = 'sd-v39-last-backup', BK_SNOOZE = 'sd-v39-backup-snooze', BK_SEEN = 'sd-v39-first-seen';
  if (!lsGet(BK_SEEN)) lsSet(BK_SEEN, String(Date.now()));
  wrapGlobal('dlBlob', function (orig) {
    return function (blob, name) {
      var r = orig.apply(this, arguments);
      if (/^StudyDeck_backup_/.test(String(name))) {
        lsSet(BK_LAST, String(Date.now())); lsSet(BK_SNOOZE, '0');
        clearDock('backup'); refreshBackupUi();
      }
      return r;
    };
  });
  function backupAgeText() {
    var last = parseInt(lsGet(BK_LAST) || '0', 10);
    if (!last) return 'No backup yet';
    var d = Math.floor((Date.now() - last) / 864e5);
    return d < 1 ? 'Last backup: today' : 'Last backup: ' + d + (d === 1 ? ' day ago' : ' days ago');
  }
  function refreshBackupUi() {
    var sub = $('ao-backup-sub');
    if (sub) sub.textContent = backupAgeText() + '. Saves all decks and progress to one file.';
  }
  function hasDecks() { try { return Array.isArray(rootNodes) && rootNodes.length > 0; } catch (e) { return false; } }
  function backupDue() {
    if (!hasDecks()) return false;
    if (Date.now() < (parseInt(lsGet(BK_SNOOZE) || '0', 10))) return false;
    var last = parseInt(lsGet(BK_LAST) || '0', 10);
    if (last) return Date.now() - last > 14 * 864e5;
    return Date.now() - parseInt(lsGet(BK_SEEN) || String(Date.now()), 10) > 3 * 864e5;
  }
  function checkBackup() {
    if (!homeVisible() || quizActive()) return;
    if (!backupDue()) { if (docks.backup) clearDock('backup'); return; }
    if (docks.backup) return;
    setDock('backup', {
      title: 'Back up your progress',
      sub: backupAgeText() + '. Your decks live only in this browser.',
      actions: [
        { label: 'Later', fn: function () { lsSet(BK_SNOOZE, String(Date.now() + 3 * 864e5)); clearDock('backup'); } },
        { label: 'Back up', primary: true, fn: function () { if (typeof exportAllData === 'function') exportAllData(); } }
      ]
    });
  }
  setInterval(checkBackup, 3000);

  /* ───────────── 6c. Accessibility ─────────────
   * Names for controls that only have a visible label nearby, and spoken toast messages.
   * Only adds attributes; nothing visible changes. */
  var live = el('<div class="sd-sr" id="sd-live" role="status" aria-live="polite"></div>');
  var liveErr = el('<div class="sd-sr" id="sd-live-err" role="alert" aria-live="assertive"></div>');
  doc.body.appendChild(live); doc.body.appendChild(liveErr);
  wrapGlobal('toast', function (orig) {
    return function (msg, type) {
      var r = orig.apply(this, arguments);
      var box = type === 'error' ? liveErr : live;
      box.textContent = '';
      setTimeout(function () { box.textContent = String(msg == null ? '' : msg); }, 40);
      return r;
    };
  });
  function nearLabel(e) {
    var row = e.closest('.set-row,.nd-field');
    var l = row && row.querySelector('.sr-lbl,.nd-lbl,label');
    return l ? l.textContent.replace(/[*★]/g, '').replace(/\s+/g, ' ').trim() : '';
  }
  function a11yPass() {
    doc.querySelectorAll('input:not([type=hidden]):not([aria-label]):not([aria-labelledby]),textarea:not([aria-label]):not([aria-labelledby]),select:not([aria-label]):not([aria-labelledby])').forEach(function (e) {
      if (e.labels && e.labels.length) return;
      var ph = (e.getAttribute('placeholder') || '').replace(/[^A-Za-z0-9 ,.'()\-]/g, '').replace(/\s+/g, ' ').trim();
      var t = (e.classList.contains('dse-search-inp') || e.type === 'search') && ph ? ph : (nearLabel(e) || e.getAttribute('title') || ph);
      t = String(t || '').replace(/^[^A-Za-z0-9]+/, '').trim();
      if (t && e.type === 'password' && !/key/i.test(t)) t += ' API key';
      if (t) e.setAttribute('aria-label', t);
    });
    doc.querySelectorAll('button:not([aria-label])').forEach(function (b) {
      var txt = (b.textContent || '').trim();
      if (b.id === 'tb-back') { b.setAttribute('aria-label', 'Back'); return; }
      if (b.classList.contains('tb-act') && /getElementById\(.fi.\)/.test(b.getAttribute('onclick') || '')) { b.setAttribute('aria-label', 'Open file'); return; }
      if (b.classList.contains('set-act') && (txt === '+' || txt === '−' || txt === '-')) {
        var what = txt === '+' ? 'Increase' : 'Decrease', lbl = nearLabel(b);
        b.setAttribute('aria-label', lbl ? what + ' ' + lbl.toLowerCase() : what);
      }
    });
    var ov = $('pal-ov'); if (ov && !ov.hasAttribute('aria-hidden')) ov.setAttribute('aria-hidden', 'true');
    var nav = $('bnav'); if (nav && !nav.hasAttribute('aria-label')) nav.setAttribute('aria-label', 'Main');
  }
  var a11yTimer = null;
  function a11ySoon() { clearTimeout(a11yTimer); a11yTimer = setTimeout(a11yPass, 400); }
  try { new MutationObserver(a11ySoon).observe(doc.body, { childList: true, subtree: true }); } catch (e) {}
  a11yPass();

  /* ───────────── 7. Home catch-up ─────────────
   * If Home was drawn before the layout hook was installed, the tabs never got built and the old
   * Quick Actions layout stayed. Draw Home once more (up to 3 times) so the tabs appear. */
  var homeTries = 0;
  setInterval(function () {
    if (homeTries >= 3 || !appVisible() || !homeVisible() || typeof renderHome !== 'function') return;
    var hb = doc.querySelector('.home-body');
    if (!hb || !hb.children.length || hb.querySelector(':scope > .sd-tabbar')) return;
    homeTries++;
    try { renderHome(); } catch (e) {}
  }, 1500);

  /* ───────────── 8. Libraries load after the app is up ─────────────
   * JSZip, sql.js, fzstd and hls.js used to be plain <script> tags in the page body. A browser stops
   * reading the page at such a tag until the server answers, so one slow or blocked CDN froze the whole
   * app at start. They are now fetched here once the app is idle (so the offline copy is still saved),
   * and the few features that use them (APKG import, Excel+ZIP export, HLS video) wait for them. */
  var LIB_URL = {
    zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    sql: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js',
    zstd: 'https://cdn.jsdelivr.net/npm/fzstd@0.1.0/umd/index.js',
    hls: 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js'
  };
  var LIB_GLOBAL = { zip: 'JSZip', sql: 'initSqlJs', zstd: 'fzstd', hls: 'Hls' };
  var libP = {};
  function loadLib(name) {
    if (window[LIB_GLOBAL[name]]) return Promise.resolve();
    if (libP[name]) return libP[name];
    libP[name] = new Promise(function (resolve) {
      var s = doc.createElement('script');
      s.src = LIB_URL[name]; s.async = true;
      s.onload = function () { resolve(); };
      /* A failed load is forgotten, so the next use tries again; the app's own "not loaded" message still shows. */
      s.onerror = function () { delete libP[name]; try { s.remove(); } catch (e) {} resolve(); };
      doc.head.appendChild(s);
    });
    return libP[name];
  }
  function needLibs(names) { return Promise.all(names.map(loadLib)); }
  ['parseAPKG', 'parseAPKGFlash'].forEach(function (n) {
    wrapGlobal(n, function (orig) {
      return function () { var self = this, a = arguments; return needLibs(['zip', 'sql', 'zstd']).then(function () { return orig.apply(self, a); }); };
    });
  });
  wrapGlobal('exportXLSXZip', function (orig) {
    return function () { var self = this, a = arguments; return needLibs(['zip']).then(function () { return orig.apply(self, a); }); };
  });
  ['openVideoModal', '_mountInlineVideo'].forEach(function (n) {
    wrapGlobal(n, function (orig) {
      return function () {
        var self = this, a = arguments, hls = false;
        for (var i = 0; i < a.length; i++) if (typeof a[i] === 'string' && a[i].indexOf('.m3u8') > -1) hls = true;
        if (!hls || window.Hls) return orig.apply(self, a);
        needLibs(['hls']).then(function () { orig.apply(self, a); });
      };
    });
  });
  function preloadLibs() {
    needLibs(['zip', 'sql', 'zstd']).then(function () { setTimeout(function () { loadLib('hls'); }, 2500); });
  }
  function whenIdle() { (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(preloadLibs, { timeout: 5000 }); }
  if (doc.readyState === 'complete') whenIdle(); else window.addEventListener('load', whenIdle, { once: true });

  /* ───────────── start ───────────── */
  injectLayoutRow();
  injectAmoledRow();
  injectAppGroup();
  initServiceWorker();
  /* Ask to keep data once the person has actually used the app (Chromium grants this without a prompt). */
  var chromium = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.some(function (b) { return /Chromium/.test(b.brand); }));
  if (isHttp && (standalone || chromium)) setTimeout(function () { requestPersist(true); }, 8000);
  setTimeout(checkResume, 1800);
})();

/* ══════════════════════════════════════════════════════════════════════════════════════════════════
 * v46 — reliable subject matching and fair random picking for the NEET PG mock and Custom Test.
 *
 * Why: (1) a subject was matched to EVERY folder whose path contained its name, and on a tie the last one won,
 *          so "Anatomy" with 5 chapter folders was mapped to its last chapter only (12 of 66 questions);
 *      (2) the whole pool was shuffled uniformly, so a chapter could get 0 questions and another 8, and "Fresh Questions"
 *          never looked at which questions you had already seen;
 *      (3) several screens shuffled with sort(() => Math.random() - .5), which is not a fair shuffle.
 * Now: the shallowest folder named after the subject is used (so the whole subject is covered), every chapter is
 * visited once before any chapter is visited twice (bigger chapters then get more, by square-root weight),
 * and within a chapter the questions you have not seen come first. All randomness comes from crypto.getRandomValues.
 * The call sites in the page are guarded: if this block failed to load, the old behaviour is used.
 * ════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__sdPick) return;
  window.__sdPick = true;
  var SEP = ' › ';

  /* ── random numbers: uniform in (0,1), from the browser's secure generator ── */
  var rbuf = null, ri = 0;
  function rnd() {
    try {
      if (!rbuf || ri >= rbuf.length) { rbuf = rbuf || new Uint32Array(256); crypto.getRandomValues(rbuf); ri = 0; }
      return (rbuf[ri++] + 0.5) / 4294967296;
    } catch (e) { return Math.random() || 1e-9; }
  }
  window._sdRnd = rnd;

  /* ── subject names: whole words only ("Environmental health" is not ENT, "Student notes" is not ENT) ──
   * A keyword matches a whole word or phrase of the folder name; a keyword ending in * matches the start of a word. */
  var STOP = { and: 1, of: 1, the: 1, for: 1 };
  function words(s) { return String(s == null ? '' : s).toLowerCase().replace(/&/g, ' ').split(/[^a-z0-9]+/).filter(function (t) { return t && !STOP[t]; }); }
  function kwHit(hay, toks, w, stem) {
    if (!w) return false;
    if (stem) { for (var i = 0; i < toks.length; i++) if (toks[i].indexOf(w) === 0) return true; return false; }
    return hay.indexOf(' ' + w + ' ') >= 0;
  }
  /* More names for each subject than the page's own keyword list has: spellings, abbreviations, and word beginnings (marked *). */
  var EXTRA = {
    anatomy: 'anatom*,anat,embryology,histology,neuroanatomy',
    physiology: 'physiology,physiolog*',
    biochemistry: 'biochem*,medical biochemistry',
    pathology: 'patholog*,histopathology',
    pharmacology: 'pharmac*,pharm',
    microbiology: 'microbiolog*,bacteriology,virology,mycology,parasitology,immunology',
    forensic: 'forensic*,forensic medicine,toxicology',
    psm: 'community medicine,preventive social medicine,social medicine,epidemiology,biostatistics',
    ent: 'ear nose throat,otorhinolaryngolog*,otolaryngolog*,orl',
    ophthalmology: 'ophthalm*,opthalm*,ophtha',
    surgery: 'surgic*',
    obsgyn: 'obstetric*,gynecolog*,gynaecolog*,gynaecology,obg,ob gyn,obs gyn',
    medicine: 'gen medicine',
    pediatrics: 'pediatric*,paediatric*,child health,neonatology',
    anaesthesia: 'anaesthesiolog*,anesthesiolog*,anes',
    radiology: 'radiolog*,radiodiag*,radiotherapy',
    psychiatry: 'psychiatr*,mental health',
    ortho: 'orthop*',
    dermatology: 'dermatolog*,derma'
  };
  var compiled = null;
  function kwObj(k) { var stem = /\*$/.test(k), w = words(String(k).replace(/\*$/, '')).join(' '); return { w: w, stem: stem, len: w.length }; }
  function compile() {
    if (compiled) return compiled;
    if (typeof NEET_SUBJECTS === 'undefined') return null;
    compiled = NEET_SUBJECTS.map(function (s) {
      var list = (s.kw || []).concat(EXTRA[s.id] ? EXTRA[s.id].split(',') : []);
      return { id: s.id, kws: list.map(kwObj).filter(function (k) { return k.w; }) };
    });
    return compiled;
  }
  /* The subject ids a folder name belongs to, best match first. Two subjects are returned only when both are named
   * ("Anatomy & Physiology"); "Forensic Medicine" is Forensic only, because the longer phrase wins over "medicine". */
  function subjsOfName(text) {
    var c = compile(), toks = words(text);
    if (!c || !toks.length) return [];
    var hay = ' ' + toks.join(' ') + ' ', found = [], top = 0;
    c.forEach(function (s) {
      var b = 0;
      s.kws.forEach(function (k) { if (k.len > b && kwHit(hay, toks, k.w, k.stem)) b = k.len; });
      if (b) { found.push({ id: s.id, b: b }); if (b > top) top = b; }
    });
    return found.filter(function (x) { return x.b >= top * 0.6; }).sort(function (a, b) { return b.b - a.b; }).map(function (x) { return x.id; });
  }
  window._sdSubjsOfName = subjsOfName;
  /* Used by the weak-area, diagnostic and daily-plan quizzes: does this deck name belong to the subject that owns this keyword list? */
  window._sdKwHit = function (name, list) {
    var owner = (typeof NEET_SUBJECTS !== 'undefined') ? NEET_SUBJECTS.filter(function (s) { return s.kw === list; })[0] : null;
    if (owner) return subjsOfName(name).indexOf(owner.id) >= 0;
    var toks = words(name), hay = ' ' + toks.join(' ') + ' ';
    return (list || []).some(function (raw) { var k = kwObj(raw); return kwHit(hay, toks, k.w, k.stem); });
  };
  /* Which folder holds this subject? The SHALLOWEST folder named after it (so the whole subject, all chapters, is used);
   * among equals the bigger one. A folder that another subject already took is skipped. */
  window._sdSubjNode = function (subj, opts, used) {
    var c = [];
    (opts || []).forEach(function (op, idx) {
      var nd = nodeByKey[op.pathKey];
      if (!nd || subjsOfName(nd.name).indexOf(subj.id) < 0) return;
      c.push({ k: op.pathKey, depth: (nd.parts || [nd.name]).length, n: op.count || 0, i: idx, used: used && used.has(op.pathKey) ? 1 : 0 });
    });
    c.sort(function (a, b) { return a.used - b.used || a.depth - b.depth || b.n - a.n || a.i - b.i; });
    return c.length && !c[0].used ? c[0].k : '';
  };

  /* ── what has been used before: one pass over the saved tests (neet + custom) ── */
  var usageP = null, usageAt = 0, usageNow = null;
  function usage() {
    if (usageP && Date.now() - usageAt < 4000) return usageP;
    usageAt = Date.now();
    usageP = (async function () {
      var m = new Map(), recs = [];
      try { recs = await getAllTestRecords(); } catch (e) {}
      recs = (recs || []).filter(function (r) { return r && (r.type === 'neet' || r.type === 'custom') && r.questionIds && r.questionIds.length; })
        .sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
      recs.forEach(function (r, idx) {
        var res = {};
        (r.resultIds || []).forEach(function (x) { if (x && x.sid) res[x.sid] = x; });
        r.questionIds.forEach(function (x) {
          var sid = x && (x.sid || (typeof x === 'string' ? x : null)); if (!sid) return;
          var u = m.get(sid); if (!u) { u = { n: 0, recent: false, bad: null }; m.set(sid, u); }
          u.n++; if (idx < 2) u.recent = true;
          if (u.bad === null) u.bad = !!r.attempted && (!res[sid] || !res[sid].ok);   // how the newest test went
        });
      });
      usageNow = m; return m;
    })();
    return usageP;
  }
  /* how likely a question is to be picked: never used = 1, used once 1/16, twice 1/81 …, so unseen questions come first and the
   * least-used come next; in one of the last two tests x0.5; got it wrong or skipped it last time x1.6 (weak spots come back sooner) */
  function weightOf(q, use) {
    var u = use.get(q.sid); if (!u) return 1;
    var w = Math.pow(1 + u.n, -4);
    if (u.recent) w *= 0.5;
    if (u.bad) w *= 1.6;
    return Math.max(w, 0.0005);
  }

  /* ── collect a subject's questions and remember which chapter (leaf folder) each one belongs to ── */
  var chapOf = new WeakMap(), chapBySid = new Map();
  window._sdCollect = async function (node, excl) {
    var all = await collectQ(node), leaf = new Map();
    (function walk(n) {
      var qs = qCache[n.pathKey];
      if (qs) for (var i = 0; i < qs.length; i++) { var q = qs[i]; if (q && q.sid && !leaf.has(q.sid)) leaf.set(q.sid, n.pathKey); }
      (n.children || []).forEach(walk);
    })(node);
    /* folders that belong to ANOTHER subject (e.g. "Medicine > Dermatology" when Dermatology has its own folder) are left out */
    var ex = (excl || []).filter(function (k) { return k && k !== node.pathKey && k.indexOf(node.pathKey + SEP) === 0; });
    if (chapBySid.size > 60000) chapBySid.clear();
    var out = [];
    all.forEach(function (q) {
      var k = leaf.get(q.sid) || node.pathKey;
      if (ex.length && ex.some(function (e) { return k === e || k.indexOf(e + SEP) === 0; })) return;
      chapOf.set(q, k); chapBySid.set(q.sid, k); out.push(q);
    });
    return out;
  };

  /* ── the fair order: take the first N of this list and you get a spread sample ──
   * 1. inside each chapter: unseen questions first, then the least recently used (weighted random, Efraimidis–Spirakis);
   * 2. one question from every chapter before any chapter gets a second (bigger chapters tend to come first);
   * 3. then a smooth weighted round-robin with weight = sqrt(chapter size), from a random starting phase,
   *    so big chapters give more questions than small ones, but never all of them. */
  window._sdSpread = async function (a) {
    if (!a || a.length < 3) return a && a.sdShuffle ? a.sdShuffle() : a;
    var use = await usage(), groups = new Map();
    a.forEach(function (q) { var k = chapOf.get(q) || '_'; var g = groups.get(k); if (!g) { g = []; groups.set(k, g); } g.push(q); });
    var strata = [];
    groups.forEach(function (list, k) {
      var keyed = list.map(function (q) { return { q: q, k: Math.log(rnd()) / weightOf(q, use) }; });
      keyed.sort(function (x, y) { return y.k - x.k; });
      var w = Math.sqrt(list.length);
      strata.push({ k: k, items: keyed.map(function (x) { return x.q; }), w: w, c: 0, rk: Math.log(rnd()) / w });
    });
    var out = [];
    strata.sort(function (x, y) { return y.rk - x.rk; });
    strata.forEach(function (s) { out.push(s.items.shift()); });
    var live = strata.filter(function (s) { return s.items.length; }), W = 0;
    live.forEach(function (s) { W += s.w; });
    live.forEach(function (s) { s.c = rnd() * W; });
    while (live.length) {
      var tot = 0, best = null;
      for (var i = 0; i < live.length; i++) { var s = live[i]; tot += s.w; s.c += s.w; if (!best || s.c > best.c) best = s; }
      best.c -= tot; out.push(best.items.shift());
      if (!best.items.length) live = live.filter(function (s) { return s !== best; });
    }
    return out;
  };

  /* ── after the test is built: say what it covers ── */
  window._sdMixToast = function (t) {
    var snap = usageNow;
    usageP = null;                                   // a new test record now exists: the next test must see it
    try {
      var subj = {}, ch = {}, fresh = 0, n = 0;
      (t || []).forEach(function (q) {
        if (q._subj) subj[q._subj] = 1;
        var k = chapBySid.get(q.sid); if (k) ch[k] = 1;
        if (snap && !snap.has(q.sid)) fresh++;
        n++;
      });
      var ns = Object.keys(subj).length, nc = Object.keys(ch).length;
      if (!n || (nc < 2 && !fresh)) return;
      var msg = '🎯 ' + n + ' questions';
      if (ns > 1) msg += ' · ' + ns + ' subjects';
      if (nc > 1) msg += ' · ' + nc + ' chapters';
      if (fresh && snap && snap.size) msg += ' · ' + fresh + ' new to you';
      if (typeof toast === 'function') toast(msg);
    } catch (e) {}
  };

  /* ── NEET only: if a subject has fewer questions than the mock asks for, take the missing ones from subjects that have spare ── */
  window._sdFillShortfall = function (cfgs) {
    try {
      var rows = (cfgs || []).filter(function (c) { return c && c.enabled && c.pathKey; });
      var short = 0, spare = [], names = [], placed = 0;
      rows.forEach(function (c) {
        var cap = c.avail || 0, want = c.qCount || 0;
        if (cap && want > cap) { short += want - cap; c.qCount = cap; names.push(c.name); }
        else if (cap > want) spare.push({ c: c, room: cap - want });
      });
      while (short > 0 && spare.length) {
        var room = spare.reduce(function (s, x) { return s + x.room; }, 0), round = 0;
        if (!room) break;
        spare.forEach(function (x) {
          var add = Math.min(x.room, Math.max(1, Math.floor(short * x.room / room)), short - round);
          if (add > 0) { x.c.qCount += add; x.room -= add; round += add; }
        });
        if (!round) break;
        short -= round; placed += round;
        spare = spare.filter(function (x) { return x.room > 0; });
      }
      if (names.length && typeof toast === 'function') {
        toast(placed ? '⚖️ ' + names.join(', ') + (names.length > 1 ? ' have' : ' has') + ' fewer questions than the mock asks for. ' + placed + ' were taken from other subjects to keep the size.'
          : '⚠️ ' + names.join(', ') + (names.length > 1 ? ' have' : ' has') + ' fewer questions than the mock asks for.');
      }
      return { placed: placed, missing: short, names: names };
    } catch (e) { return { placed: 0, missing: 0, names: [] }; }
  };

})();

/* ══════════════════════════════════════════════════════════════════════════════════════════════════
 * v46 — sort an imported file into subject folders.
 *
 * What it does with a file that is not already organised by subject (a flat deck, or a "Subject" column only):
 *   1. a folder or path that already names a subject is left alone (only the spelling is tidied: "OBG" -> "Obs & Gynecology");
 *   2. a question with a Subject or Tags value that names a subject goes there;
 *   3. otherwise the question text (stem + options + explanation) is scored against a built-in word list for the 19 NEET PG
 *      subjects (single words, word beginnings and short phrases, each with a weight). The best subject wins only when it is
 *      clearly ahead of the second best;
 *   4. the unsure ones borrow the subject of their neighbours when the file is in subject order, or of the folder's majority;
 *   5. what is still unsure goes to an "Unsorted" folder for you to look at. A file that is not medical at all is left untouched.
 * Everything happens on the device. Turn it off in Settings. "Sort by subject" in a deck's More menu does the same to a deck you
 * have already imported (your answers, stars and notes stay with the questions).
 * ════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__sdSort) return;
  window.__sdSort = true;
  var SEP = ' › ', KEY = 'sd-auto-sort';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function say(m, kind) { try { if (typeof toast === 'function') toast(m, kind); } catch (e) {} }
  function autoOn() { return lsGet(KEY) !== 'off'; }
  window._sdAutoSortOn = autoOn;

  /* ── the word list: [strong (3 points), medium (2), weak (1)] per subject. "*" = any word starting like this. ── */
  var LEX = {
    anatomy: [
      'brachial plexus,circle of willis,cubital fossa,carpal tunnel,rotator cuff,femoral triangle,inguinal canal,adductor canal,popliteal fossa,pterygopalatine,cavernous sinus,foramen magnum,foramen ovale,foramen spinosum,foramen rotundum,superior orbital fissure,pes anserinus,snuffbox,thoracic duct,azygos,internal capsule,basal ganglia,cerebellar peduncle,corticospinal,spinothalamic,dorsal column,pharyngeal arch,branchial arch,neural crest,neural tube,notochord,primitive streak,erb s point,klumpke,root value,anatom*,embryolog*,histolog*,osteolog*,lymphatic drainage,nerve supply,erector spinae,scaphoid,ligament of,intercostal space,lesser sac,rectus sheath,inguinal ligament,deep inguinal ring,sciatic nerve,femoral nerve,radial nerve,ulnar nerve,median nerve,common peroneal,axillary nerve,musculocutaneous',
      'venous drainage,arterial supply,blood supply,scapula,humerus,clavicle,mandible,sphenoid,ethmoid,vertebra*,sacrum,coccyx,sternum,diaphragm,mediastinum,peritoneum,omentum,mesentery,axilla,axillary,deltoid,trapezius,latissimus,pectoralis,quadriceps,hamstring*,gluteus,gastrocnemius,tibialis,interossei,lumbrical*,thenar,dermatome*,myotome*,decussation,gyrus,sulcus,ventricle*,foramen,fissure,ligament*,bursa,plexus,vagus nerve,glossopharyngeal,hypoglossal,trigeminal,oculomotor,trochlear,abducens,phrenic,subclavian,brachiocephalic,dorsalis pedis,celiac trunk,blastocyst,zygote,morula,trophoblast,gastrulation,somite*,ectoderm,mesoderm,endoderm,pharyngeal pouch,mullerian,wolffian,goblet cells,pseudostratified,transitional epithelium,stratified squamous,simple columnar,tendon,fascia,aponeurosis,tarsal,carpal,metacarpal,insertion of,origin of,develops from,derived from',
      'relations,branches,supplied by,bone,muscle,nerve,artery,vein,gland'],
    physiology: [
      'cardiac output,stroke volume,frank starling,action potential,resting membrane potential,nernst,donnan,glomerular filtration,gfr,tubuloglomerular,juxtaglomerular,countercurrent,loop of henle,renal clearance,renal threshold,tubular maximum,oxygen dissociation,bohr effect,haldane,hering breuer,dead space,functional residual capacity,residual volume,tidal volume,vital capacity,lung compliance,surfactant,ventilation perfusion,minute ventilation,chemoreceptor*,baroreceptor*,pacemaker potential,cardiac cycle,jugular venous pulse,monosynaptic,stretch reflex,golgi tendon,muscle spindle,sliding filament,troponin,tropomyosin,motor unit,excitation contraction,length tension,sarcomere,physiolog*,homeostasis,tubular reabsorption,isovolumetric,gastric emptying,receptive relaxation,migrating motor complex,erythropoietin secretion,lh surge,organ of corti,rhodopsin,dark adaptation,critical closing pressure,oxygen carrying capacity,p50',
      'preload,afterload,contractility,ejection fraction,mean arterial pressure,peripheral resistance,venous return,coronary blood flow,cerebral blood flow,autoregulation,cardiac index,heart sounds,sa node,av node,purkinje,vasomotor,receptor potential,synapse,epsp,ipsp,saltatory,conduction velocity,erlanger gasser,sleep,eeg,rem sleep,reticular formation,thermoregulation,satiety,thirst,aldosterone,renin,angiotensin,gastric secretion,bile secretion,pancreatic secretion,peristalsis,deglutition,menstrual cycle,ovulation,spermatogenesis,lactation,puberty,cochlea,vestibular,olfaction,depolarization,repolarization,threshold potential,refractory period,osmolarity,tonicity,diffusion,osmosis,hypothalam*,pituitary,thyroid hormone,growth hormone,cortisol,insulin secretion,glucagon,parathyroid hormone,calcitonin,visual pathway,hearing,taste',
      'normal value,reflex,secretion,hormone,physiological,increase in,decrease in'],
    biochemistry: [
      'glycolysis,gluconeogenesis,glycogenolysis,glycogen storage,tca cycle,krebs cycle,citric acid cycle,pentose phosphate,hmp shunt,electron transport,oxidative phosphorylation,urea cycle,beta oxidation,ketone bodies,ketogenesis,lipogenesis,cholesterol synthesis,hmg coa,lipoprotein*,chylomicron*,apolipoprotein*,lcat,fatty acid synthesis,transamination,deamination,pyridoxal,thiamine,riboflavin,niacin,pantothenic,biotin,cobalamin,vitamin b12,vitamin c,scurvy,pellagra,beriberi,xerophthalmia,dna replication,okazaki,helicase,primase,dna polymerase,rna polymerase,reverse transcriptase,codon,anticodon,trna,mrna,rrna,lac operon,promoter,splicing,southern blot,northern blot,western blot,restriction enzyme*,frameshift,inborn error*,phenylketonuria,alkaptonuria,maple syrup,homocystinuria,tyrosinemia,galactosemia,fructose intolerance,lesch nyhan,gaucher,niemann pick,tay sachs,fabry,krabbe,hurler,hunter syndrome,pompe,von gierke,mccardle,cori disease,michaelis menten,lineweaver burk,vmax,competitive inhibition,isoenzyme*,coenzyme*,allosteric,heme synthesis,porphyria*,purine synthesis,glycosaminoglycan*,proteoglycan*,ramachandran,alpha helix,beta sheet,isoelectric,henderson hasselbalch,biochem*,limiting enzyme,rate limiting,essential amino acid*,essential fatty acid*',
      'amino acid*,collagen synthesis,enzyme*,substrate,cofactor,vitamin*,folate,folic acid,glucose,glycogen,cholesterol,triglyceride*,fatty acid*,ketone,nucleotide*,purine,pyrimidine,dna,rna,genome,gene expression,mutation,protein structure,denaturation,buffer,atp,nadh,fadh2,acetyl coa,pyruvate,lactate,oxaloacetate,glutamate,tyrosine,tryptophan,urea,uric acid,ammonia,signal transduction,second messenger,camp,g protein,insulin receptor,tyrosine kinase,membrane transport,glut4,pcr,genetics,chromosome*,polymorphism,epigenetic*,telomer*,transcription,translation,ribosome',
      'metabolism,biochemical,synthesis of,defect,deficiency of']
    ,
    pathology: [
      'reed sternberg,apoptosis,caseous necrosis,coagulative necrosis,liquefactive necrosis,fat necrosis,fibrinoid necrosis,dystrophic calcification,metastatic calcification,amyloidosis,amyloid,hyalinosis,metaplasia,dysplasia,anaplasia,neoplasia,carcinoma in situ,oncogene*,tumor suppressor,tumour suppressor,p53,rb gene,philadelphia chromosome,bcr abl,chemotaxis,margination,granuloma*,epithelioid,langhans,foreign body giant,granulation tissue,keloid,virchow,hyperemia,von willebrand,peripheral smear,blood film,psammoma,nutmeg,councilman,mallory,aschoff,libman sacks,patholog*,histopatholog*,cytolog*,immunohistochemistry,tumor marker*,tumour marker*,reed sternberg cells,smudge cells,auer rod*,howell jolly,heinz bod*,pappenheimer,basophilic stippling,schistocyte*,rouleaux,target cells,spur cells,crescent*,nodular glomerulosclerosis,kimmelstiel,hyaline arteriolosclerosis,onion skinning,starry sky,owl eye,signet ring,rosettes,pseudorosettes,homer wright,orphan annie,hobnail,mitotic,pleomorphism,desmoplasia,necrosis,infarct*',
      'thrombosis,embolism,inflammation,wound healing,hemostasis,platelet*,anemia,thalassemia*,sickle cell,spherocytosis,g6pd,aplastic,megaloblastic,leukemia*,lymphoma*,myeloma,hodgkin,burkitt,polycythemia,myelofibrosis,nephrotic,nephritic,iga nephropathy,minimal change,focal segmental,membranous,membranoproliferative,wilms,renal cell carcinoma,hepatocellular carcinoma,cirrhosis,barrett,crohn,ulcerative colitis,adenomatous polyp,lynch,carcinoid,fibroadenoma,phyllodes,ductal carcinoma,lobular carcinoma,seminoma,teratoma,yolk sac tumor,choriocarcinoma,hydatidiform,cystadenoma,granulosa cell,dysgerminoma,papillary carcinoma,medullary carcinoma,pheochromocytoma,neuroblastoma,retinoblastoma,osteosarcoma,ewing,chondrosarcoma,giant cell tumor,rhabdomyosarcoma,leiomyoma,liposarcoma,melanoma,basal cell carcinoma,squamous cell carcinoma,glioblastoma,meningioma,medulloblastoma,schwannoma,astrocytoma,ependymoma,hashimoto,sarcoidosis,atherosclerosis,aneurysm*,pneumoconiosis,silicosis,asbestosis,emphysema,bronchiectasis,metastasis,benign tumor,malignant tumor,carcinoma,sarcoma,adenoma,hyperplasia,hypertrophy,atrophy,edema,congestion,shock,dic,cd20,cd10,cd34,cd15,cd30,cd3,cd5',
      'histology,biopsy,lesion,gross,microscopy,stain,staining,cells,tumor,tumour']
    ,
    pharmacology: [
      'pharmacokinetic*,pharmacodynamic*,bioavailability,first pass,volume of distribution,half life,loading dose,maintenance dose,therapeutic index,zero order,first order kinetics,cytochrome p450,enzyme inducer*,enzyme inhibitor*,agonist,antagonist,partial agonist,inverse agonist,efficacy,potency,tachyphylaxis,plasma protein binding,drug interaction*,adverse effect*,side effect*,contraindicat*,mechanism of action,pharmacolog*,pharmacotherap*,therapeutic drug monitoring,steady state,clearance of drug,prodrug,cholinergic,anticholinergic,adrenergic,sympathomimetic,sympatholytic,alpha blocker*,beta blocker*,ace inhibitor*,calcium channel blocker*,antiarrhythmic*,antihypertensive*,diuretic*,anticoagulant*,antiplatelet*,thrombolytic*,antidiabetic*,sulfonylurea*,antithyroid,corticosteroid*,antibiotic*,antibacterial*,antifungal*,antiviral*,antiretroviral*,antimalarial*,anthelmintic*,anticonvulsant*,antiepileptic*,antipsychotic*,antidepressant*,anxiolytic*,sedative*,hypnotic*,opioid*,nsaid*,anticancer,chemotherapeutic*,immunosuppressant*,antiemetic*,proton pump inhibitor*,h2 blocker*,bronchodilator*,antihistamine*',
      'atropine,neostigmine,physostigmine,pralidoxime,adrenaline,noradrenaline,dobutamine,dopamine,isoprenaline,salbutamol,propranolol,atenolol,metoprolol,labetalol,carvedilol,prazosin,clonidine,nifedipine,amlodipine,verapamil,diltiazem,enalapril,ramipril,losartan,hydrochlorothiazide,furosemide,spironolactone,digoxin,amiodarone,lignocaine,warfarin,heparin,enoxaparin,aspirin,clopidogrel,atorvastatin,metformin,glimepiride,pioglitazone,levothyroxine,carbimazole,propylthiouracil,prednisolone,dexamethasone,hydrocortisone,penicillin,amoxicillin,ceftriaxone,vancomycin,gentamicin,amikacin,azithromycin,doxycycline,ciprofloxacin,levofloxacin,metronidazole,cotrimoxazole,linezolid,rifampicin,isoniazid,pyrazinamide,ethambutol,fluconazole,amphotericin,acyclovir,oseltamivir,zidovudine,chloroquine,artesunate,primaquine,albendazole,ivermectin,phenytoin,carbamazepine,valproate,lamotrigine,levetiracetam,phenobarbitone,haloperidol,clozapine,risperidone,olanzapine,lithium,fluoxetine,amitriptyline,diazepam,midazolam,morphine,fentanyl,tramadol,naloxone,paracetamol,ibuprofen,diclofenac,methotrexate,cyclophosphamide,cisplatin,vincristine,tamoxifen,imatinib,rituximab,omeprazole,ondansetron,domperidone,levodopa,carbidopa,bromocriptine,sumatriptan,montelukast,theophylline,ipratropium,tiotropium,sildenafil,finasteride,tamsulosin,oxytocin,misoprostol,mifepristone,clomiphene',
      'drug,drugs,dose,dosage,toxicity,indication,tablet,drug of choice,antidote*']
    ,
    microbiology: [
      'type i hypersensitivity,type ii hypersensitivity,type iii hypersensitivity,type iv hypersensitivity,type 1 hypersensitivity,type 2 hypersensitivity,type 3 hypersensitivity,type 4 hypersensitivity,gram positive,gram negative,gram stain,staphylococcus,streptococcus,pneumococcus,enterococcus,neisseria,clostridium,bacillus anthracis,corynebacterium,listeria,mycobacterium,nocardia,actinomyces,escherichia coli,e coli,klebsiella,salmonella,shigella,vibrio,pseudomonas,proteus,haemophilus,bordetella,brucella,yersinia,francisella,legionella,campylobacter,helicobacter,treponema,borrelia,leptospira,rickettsia,chlamydia,mycoplasma,spirochete*,candida,aspergillus,cryptococcus,histoplasma,mucor,dermatophyte*,plasmodium,entamoeba,giardia,leishmania,trypanosoma,toxoplasma,taenia,ascaris,ancylostoma,wuchereria,hepatitis b virus,hbsag,hiv,herpes simplex,varicella zoster,cytomegalovirus,epstein barr,rabies virus,poliovirus,influenza virus,rotavirus,dengue virus,adenovirus,measles virus,prion*,culture media,mcconkey,lowenstein jensen,selective media,transport media,autoclave,sterilization,disinfectant*,bacteriophage,plasmid,conjugation,transduction,bacterial genetics,exotoxin*,endotoxin*,virulence,microbiolog*,bacteriolog*,virolog*,mycolog*,parasitolog*,nosocomial,normal flora,antibiotic sensitivity,mrsa,esbl,coagulase,catalase,oxidase,urease,motility,capsule,spore*,flagella,pilus,pili,zoonosis,vector borne,life cycle,incubation period,culture,stain',
      'antibody,antibodies,immunoglobulin*,igm,iga,ige,igg,complement,mhc,hla,hypersensitivity,t cell*,b cell*,cytokine*,interleukin*,vaccine*,elisa,immunofluorescence,agglutination,widal,vdrl,immunolog*,antigen*,immune response,innate immunity,adaptive immunity,macrophage*,natural killer,transplant rejection,autoimmune,immunodeficiency,pcr',
      'bacteria,bacterial,virus,viral,fungus,fungal,parasite,infection,infections,organism,pathogen']
    ,
    forensic: [
      'forensic*,medicolegal,medico legal,postmortem,post mortem,rigor mortis,livor mortis,algor mortis,putrefaction,adipocere,mummification,time since death,autopsy,inquest,cause of death,asphyxia*,hanging,strangulation,smothering,drowning,throttling,firearm*,gunshot,ballistic*,abrasion,contusion,laceration,incised wound,stab wound,electrocution,poison*,toxicolog*,arsenic,mercury poisoning,lead poisoning,organophosphate*,datura,dhatura,oleander,snake bite,cyanide,methanol,carbon monoxide poisoning,opium,barbiturate*,alcohol intoxication,rape,sexual assault,sodomy,virginity,hymen,infanticide,dowry,medical negligence,euthanasia,ipc,crpc,culpable homicide,dying declaration,dactylography,fingerprint*,dna profiling,bite marks,age estimation,tattoo,blood stains,semen,expert witness,summons,subpoena,perjury,medical ethics,declaration of geneva,hippocratic,consumer protection act,mciu,exhumation,identification,medical jurisprudence,homicide,suicide,firing,wound',
      'injury,injuries,death,accident,negligence,consent,ethics,witness,toxic,overdose,antidote,criminal,legal,court,law',
      'poison,dead,body']
    ,
    psm: [
      'epidemiology,incidence,prevalence,attack rate,relative risk,odds ratio,attributable risk,case control,cohort study,cross sectional,randomized controlled trial,randomised controlled trial,sensitivity,specificity,predictive value,screening test,confounding,sampling,standard deviation,standard error,p value,chi square,t test,anova,normal distribution,biostatistics,vital statistics,infant mortality,maternal mortality,neonatal mortality,fertility rate,birth rate,life expectancy,demography,census,health indicator*,hdi,pqli,national health programme*,national health mission,ntep,nacp,nvbdcp,icds,nhm,rch,janani,immunization schedule,cold chain,vaccine vial monitor,iodine deficiency,balanced diet,anthropometry,sanitation,water purification,chlorination,bleaching powder,orthotolidine,hardness of water,occupational health,esi act,factories act,biomedical waste,health education,primary health care,alma ata,millennium development,sustainable development,health planning,phc,chc,subcentre,sub centre,asha,anganwadi,family planning,contraceptive*,pearl index,mtp act,pcpndt,sex ratio,disaster management,social medicine,preventive medicine,community medicine,levels of prevention,natural history of disease,iceberg,epidemic,endemic,pandemic,outbreak,herd immunity,quarantine,surveillance,sentinel,notifiable,insecticide*,anopheles,aedes,culex,vector control,rabies prophylaxis,tetanus prophylaxis,leprosy elimination,malaria control,tuberculosis control,hiv control,mean median mode,incubation',
      'screening,vaccination,vaccine,immunization,nutrition,malnutrition,protein energy,kwashiorkor,marasmus,bmi,mortality,morbidity,rate,ratio,proportion,survey,community,population,hygiene,environment*,occupation*,pollution,noise,lighting,ventilation,vitamin a prophylaxis,ors',
      'health,disease control,programme,program,scheme']
    ,
    ent: [
      'otitis media,otitis externa,cholesteatoma,tympanic membrane,tympanoplasty,mastoid*,otosclerosis,stapedectomy,meniere,vestibular schwannoma,acoustic neuroma,sensorineural,conductive hearing loss,audiometry,tympanometry,rinne,weber test,tinnitus,bppv,epistaxis,kiesselbach,little s area,nasal polyp*,sinusitis,deviated nasal septum,septoplasty,rhinitis,adenoid*,tonsil*,tonsillectomy,peritonsillar,quinsy,laryngeal,larynx,vocal cord*,vocal fold*,laryngomalacia,stridor,tracheostomy,laryngoscopy,glottis,supraglottic,subglottic,hoarseness,reinke,juvenile papillomatosis,nasopharyngeal,ludwig angina,parapharyngeal,retropharyngeal,otolaryng*,otorhinolaryng*,ear nose throat,facial nerve palsy,bell palsy,glomus,ossicle*,eustachian tube,cochlear implant,hearing aid,tuning fork,hearing loss,ent,ear,pinna,auricle,septum,turbinate*,pharynx,pharyngeal,tympanic,otalgia,otorrhea,rhinorrhea,anosmia,sinus',
      'vertigo,hearing,nose,nasal,throat,voice,swallowing,dysphagia,neck mass,thyroglossal,branchial cyst',
      'ear,nose']
    ,
    ophthalmology: [
      'cornea,corneal,keratitis,keratoconus,conjunctiva*,conjunctivitis,trachoma,pterygium,pinguecula,uveitis,iridocyclitis,cataract,phacoemulsification,aphakia,pseudophakia,glaucoma,intraocular pressure,tonometry,gonioscopy,optic disc,optic neuritis,papilledema,retinopathy,macula*,retinitis pigmentosa,retinal detachment,vitreous,strabismus,squint,amblyopia,nystagmus,diplopia,ptosis,proptosis,lacrimal,dacryocystitis,chalazion,hordeolum,stye,blepharitis,myopia,hypermetropia,astigmatism,presbyopia,refractive error*,visual acuity,snellen,perimetry,visual field*,fundus,fluorescein,ophthalm*,ophthalmoscopy,slit lamp,color blindness,ishihara,bitot,night blindness,enucleation,keratoplasty,eye bank,orbital cellulitis,anterior chamber,hypopyon,hyphema,fundoscopy,drusen,cotton wool spots,cherry red spot,eye',
      'retina,retinal,lens,iris,pupil*,orbit*,vision,blindness,visual,eyelid*,sclera,choroid,ocular,eyeball,tear',
      'light,sight']
    ,
    surgery: [
      'hernia*,inguinal hernia,femoral hernia,hernioplasty,appendicitis,appendicectomy,cholecystitis,cholelithiasis,cholecystectomy,choledocholithiasis,cholangitis,pancreatitis,pancreatic pseudocyst,whipple,esophageal carcinoma,achalasia,peptic ulcer perforation,perforated ulcer,gastrectomy,intestinal obstruction,volvulus,intussusception,mesenteric ischemia,diverticulitis,hemorrhoid*,haemorrhoid*,fissure in ano,fistula in ano,perianal abscess,pilonidal,rectal prolapse,colorectal,colostomy,ileostomy,peritonitis,parkland,skin graft,thyroidectomy,thyroid nodule,hyperparathyroidism,breast lump,mastectomy,fibroadenosis,thyroglossal cyst,cystic hygroma,parotid,salivary gland tumor*,pleomorphic adenoma,warthin,varicose veins,deep vein thrombosis,peripheral arterial disease,buerger,carotid endarterectomy,amputation,gangrene,necrotizing fasciitis,atls,tension pneumothorax,hemothorax,flail chest,cardiac tamponade,splenectomy,splenic injury,liver abscess,hydatid cyst,portal hypertension,esophageal varices,hydrocele,varicocele,testicular torsion,undescended testis,orchidopexy,hypospadias,phimosis,turp,pcnl,nephrectomy,urethral stricture,ercp,laparoscopy,laparotomy,anastomosis,suture*,surgical site infection,extradural hematoma,subdural hematoma,glasgow coma scale,esophageal atresia,hirschsprung,pyloric stenosis,biliary atresia,bariatric,transplant*,surgery,surgical,surgeon*,operation,incision,drain,laparoscopic,resection,stoma,abscess,fistula,sinus tract,ulcer',
      'trauma,burn,burns,wound,cellulitis,thyroid,goitre,breast,hematoma,aneurysm,gall stone*,gallstone*,pancreas,stomach,colon,rectum,anal,anus,bile duct,liver,spleen,kidney stone*,bladder,prostate,testis,penis,flap,graft',
      'mass,swelling,lump']
    ,
    obsgyn: [
      'gestational,antenatal,postnatal,puerperium,puerperal,partograph,cervical dilatation,effacement,fetal heart rate,cardiotocography,nonstress test,preeclampsia,pre eclampsia,eclampsia,hellp,gestational diabetes,placenta previa,placental abruption,abruptio,placenta accreta,vasa previa,postpartum hemorrhage,postpartum haemorrhage,retained placenta,uterine atony,ectopic pregnancy,molar pregnancy,abortion,miscarriage,threatened abortion,recurrent pregnancy loss,hyperemesis,rh isoimmunization,anti d,twin pregnancy,polyhydramnios,oligohydramnios,breech,forceps,vacuum extraction,cesarean,caesarean,episiotomy,shoulder dystocia,cord prolapse,amniotic fluid embolism,uterine rupture,obstetric*,gynecolog*,gynaecolog*,menstruation,amenorrhea,menorrhagia,dysmenorrhea,pcos,polycystic ovary,endometriosis,adenomyosis,fibroid*,endometrial hyperplasia,endometrial carcinoma,cervical cancer,cervical intraepithelial,pap smear,colposcopy,ovarian cyst,ovarian cancer,ca 125,infertility,ivf,ovulation induction,hysterectomy,hysteroscopy,prolapse uterus,uterine prolapse,pessary,menopause,iucd,copper t,oral contraceptive*,tubectomy,bacterial vaginosis,trichomonas,vaginitis,pelvic inflammatory,asherman,fetal growth restriction,iugr,quickening,naegele,bishop score,induction of labour,labour,labor,gravida,para,trimester,lmp,edd,pregnancy,pregnant,antepartum,intrapartum,postpartum,lactational amenorrhea,fetus,fetal,foetal,placenta,amniotic,uterus,uterine,cervix,cervical,ovary,ovarian,vagina,vaginal,vulva,endometri*',
      'oxytocin,misoprostol,carboprost,magnesium sulphate,clomiphene,estrogen,progesterone,menstrual,contraception,hrt,delivery,birth,gynae,women,woman,female',
      'obs,gyn']
    ,
    medicine: [
      'myocardial infarction,stemi,nstemi,unstable angina,heart failure,atrial fibrillation,ventricular tachycardia,hypertensive emergency,infective endocarditis,rheumatic fever,cardiomyopathy,pericarditis,aortic stenosis,mitral stenosis,mitral regurgitation,jvp,murmur*,ecg changes,copd,asthma,pneumonia,pulmonary embolism,pleural effusion,tuberculosis,interstitial lung disease,ards,respiratory failure,cor pulmonale,hepatic encephalopathy,ascites,spontaneous bacterial peritonitis,gi bleed,peptic ulcer disease,celiac disease,inflammatory bowel disease,irritable bowel,malabsorption,jaundice,hepatorenal,wilson disease,hemochromatosis,diabetes mellitus,dka,diabetic ketoacidosis,hhs,hypoglycemia,thyroid storm,hypothyroidism,hyperthyroidism,graves,cushing,addison,adrenal crisis,hyperaldosteronism,acromegaly,prolactinoma,siadh,diabetes insipidus,hyponatremia,hyperkalemia,hypokalemia,metabolic acidosis,respiratory alkalosis,acute kidney injury,chronic kidney disease,ckd,dialysis,renal tubular acidosis,stroke,tia,epilepsy,status epilepticus,meningitis,encephalitis,guillain barre,myasthenia gravis,parkinson,multiple sclerosis,alzheimer,huntington,motor neuron disease,peripheral neuropathy,migraine,subarachnoid hemorrhage,rheumatoid arthritis,sle,systemic lupus,scleroderma,vasculitis,gout,ankylosing spondylitis,thrombolysis,aids,opportunistic infection*,malaria,dengue,typhoid,leptospirosis,kala azar,sepsis,septic shock,pyrexia of unknown origin,icu,cpr,acls,internal medicine,general medicine,harrison,hypertension,angina,syncope,dyspnea,hemoptysis,clubbing,cyanosis,edema in',
      'treatment of choice,management of,investigation of choice,clinical features,diagnosis,prognosis,patient presents,presents with,complains of,examination reveals,on examination,symptoms,signs,fever,cough,chest pain,headache,weakness',
      'medicine,physician,ward,admitted']
    ,
    pediatrics: [
      'neonate*,newborn,neonatal,preterm,premature infant,low birth weight,apgar,neonatal jaundice,physiological jaundice,kernicterus,respiratory distress syndrome,hyaline membrane,bronchopulmonary dysplasia,necrotizing enterocolitis,neonatal sepsis,birth asphyxia,hypoxic ischemic encephalopathy,neonatal seizures,kangaroo mother care,breastfeeding,exclusive breastfeeding,complementary feeding,growth chart,growth velocity,developmental milestone*,milestone*,social smile,head holding,sitting without support,speech delay,developmental delay,cerebral palsy,autism,adhd,down syndrome,turner,klinefelter,fragile x,trisomy,congenital heart disease,tetralogy of fallot,vsd,asd,pda,coarctation,transposition,kawasaki,nephrotic syndrome in children,pyelonephritis in children,vesicoureteral,posterior urethral valves,infantile colic,imnci,severe acute malnutrition,sam,rickets,bcg,opv,pentavalent,mmr,febrile seizure*,bronchiolitis,croup,epiglottitis,pertussis,measles,mumps,rubella,chickenpox,hand foot mouth,scarlet fever,diphtheria,cystic fibrosis,sickle cell disease,thalassemia major,precocious puberty,short stature,congenital hypothyroidism,cah,congenital adrenal hyperplasia,pediatric*,paediatric*,infant*,child*,toddler*,adolescen*,school age,under five,fontanelle,tanner,ponderal,kwashiorkor',
      'immunization schedule,vaccination schedule,growth,weight for age,height for age,birth weight,gestational age,days old,weeks old,months old,year old child,year old boy,year old girl,baby,boy,girl',
      'age,months,year old']
    ,
    anaesthesia: [
      'anaesthesia,anesthesia,anaesthetic*,anesthetic*,anaesthesiolog*,anesthesiolog*,general anesthesia,spinal anesthesia,epidural,caudal block,nerve block,local anesthetic*,lignocaine toxicity,bupivacaine,ropivacaine,thiopentone,propofol,ketamine,etomidate,halothane,isoflurane,sevoflurane,desflurane,nitrous oxide,minimum alveolar concentration,mac,blood gas partition,succinylcholine,suxamethonium,rocuronium,vecuronium,atracurium,cisatracurium,sugammadex,malignant hyperthermia,laryngeal mask,lma,endotracheal,intubation,difficult airway,mallampati,rapid sequence induction,cormack lehane,capnography,pulse oximetry,anesthesia machine,bain circuit,mapleson,circle system,soda lime,vaporizer,fasting guidelines,asa grade,premedication,post operative nausea,pacu,awareness under anesthesia,post dural puncture headache,spinal headache,local anaesthetic systemic toxicity,airway management,mechanical ventilation,peep,oxygen therapy,hudson mask,venturi mask,induction agent*,muscle relaxant*,neuromuscular block*,depolarizing,non depolarizing,intravenous induction,regional anesthesia,spinal block,epidural block,brachial plexus block',
      'sedation,analgesia,pain management,airway,ventilator,ventilation,icu,critical care,resuscitation,cpr,bls',
      'anes,anaes']
    ,
    radiology: [
      'string of beads,bamboo spine,double bubble,ground glass,tram track,rib notching,sunburst,onion peel,codman triangle,soap bubble,thumb sign,steeple sign,hampton hump,westermark,kerley b,egg on string,snowman sign,cobra head,bird beak,apple core,football sign,lead pipe,thumbprinting,hida,dtpa,dmsa,mibg,technetium,iodine 131,radioiodine,contrast agent*,gadolinium,ionizing radiation,radiation dose,sievert,half value layer,aerb,alara,radiotherapy,brachytherapy,linear accelerator,radiosensitivity,radioresistant,radiolog*,radiodiag*,hsg,hysterosalpingography,barium swallow,barium meal,barium enema,ivp,intravenous urogram,micturating cystourethrogram,pet scan,pet ct,nuclear medicine,scintigraphy,bone scan,t1 weighted,t2 weighted,flair,dwi,radiograph*,radiographic,hyperdense,hypodense,hyperintense,hypointense,echogenic,anechoic,hypoechoic,lucent,opacity,radiopaque,radiolucent,sclerotic,lytic',
      'x ray,xray,ct scan,computed tomography,mri,magnetic resonance,ultrasound,sonography,usg,doppler,angiography,imaging,echocardiography,fluoroscopy,mammography,dexa',
      'scan,image,film,contrast']
    ,
    psychiatry: [
      'schizophrenia,delusion*,hallucination*,thought disorder,first rank symptoms,bipolar,mania,manic,major depressive,dysthymia,suicide risk,ssri,anxiety disorder*,panic disorder,generalized anxiety,phobia*,ocd,obsessive compulsive,ptsd,post traumatic stress,adjustment disorder,somatization,somatoform,conversion disorder,dissociative,hypochondriasis,personality disorder*,borderline,antisocial,narcissistic,schizoid,anorexia nervosa,bulimia,binge eating,substance use,alcohol dependence,delirium tremens,wernicke korsakoff,opioid dependence,intellectual disability,mental retardation,autism spectrum,conduct disorder,tourette,tic disorder,enuresis,insomnia,narcolepsy,sexual dysfunction,premature ejaculation,gender dysphoria,defense mechanism*,projection,repression,sublimation,reaction formation,psychotherapy,cbt,cognitive behavioural,psychoanalysis,freud,erikson,piaget,electroconvulsive,mental health act,neuroleptic malignant,extrapyramidal,tardive dyskinesia,serotonin syndrome,psychiatr*,psychosis,psychotic,mood disorder*,affective disorder,catatonia,capgras,cotard,de clerambault,depression,delirium,anxiety,mood,mental illness,mental disorder*,psych',
      'dementia,behaviour,behavior,thought,perception,affect,insight,judgement,hallucinat*,withdrawal,dependence,addiction',
      'mental,emotional']
    ,
    ortho: [
      'pott s spine,potts spine,spinal tuberculosis,trendelenburg,lachman,anterior drawer,posterior drawer,mcmurray,apley,fracture*,supracondylar,colles,smith fracture,monteggia,galeazzi,scaphoid fracture,neck of femur,intertrochanteric,slipped capital femoral,perthes,developmental dysplasia,ddh,clubfoot,ctev,scoliosis,kyphosis,spondylolisthesis,disc prolapse,sciatica,cauda equina,spinal cord injury,osteomyelitis,septic arthritis,pott spine,tb spine,osteoarthritis knee,dislocation*,shoulder dislocation,hip dislocation,bankart,hill sachs,rotator cuff tear,frozen shoulder,tennis elbow,golfer elbow,de quervain,trigger finger,dupuytren,carpal tunnel syndrome,ulnar neuropathy,ligament injury,acl,pcl,meniscus,meniscal tear,osteoid osteoma,osteochondroma,enchondroma,bone tumor*,osteoporosis,osteomalacia,paget disease of bone,compartment syndrome,volkmann,nonunion,malunion,delayed union,fat embolism,external fixator,intramedullary nail,plaster,traction,prosthesis,orthop*,ortho,arthroplasty,arthroscopy,osteotomy,bone grafting,callus,fixation,reduction,splint*,cast,limp,gait',
      'joint*,knee,hip,shoulder,elbow,wrist,ankle,spine,vertebral,bone,bones,limb',
      'pain,deformity']
    ,
    dermatology: [
      'psoriasis,lichen planus,eczema,atopic dermatitis,contact dermatitis,seborrheic dermatitis,urticaria,pemphigus,pemphigoid,dermatitis herpetiformis,erythema multiforme,stevens johnson,toxic epidermal necrolysis,vitiligo,melasma,acne,rosacea,alopecia,tinea,dermatophytosis,pityriasis,scabies,pediculosis,impetigo,folliculitis,leprosy,lepra reaction*,tuberculoid,lepromatous,hansen,syphilis,chancre,gonorrhea,chancroid,lymphogranuloma venereum,donovanosis,genital herpes,genital warts,molluscum,warts,cutaneous leishmaniasis,lupus vulgaris,discoid lupus,dermatomyositis,ichthyosis,epidermolysis bullosa,nikolsky,koebner,auspitz,wickham striae,actinic keratosis,bowen,mycosis fungoides,hyperpigmentation,hypopigmentation,onychomycosis,sexually transmitted,std,sti,derm*,dermat*,venereology,dvl,skin,rash*,papule*,macule*,vesicle*,bulla*,plaque*,pustule*,erythema,scaling,lichenification,excoriation,nail,hair loss,hirsutism,itching,pruritus',
      'cutaneous,epidermis,dermis,sebaceous,sweat gland,pigment*,topical,steroid cream,emollient,phototherapy,puva',
      'lesion,lesions,patch']
  };

  /* ── scoring ── */
  var STOP = { and: 1, of: 1, the: 1, for: 1 };
  function words(s) { return String(s == null ? '' : s).toLowerCase().replace(/&/g, ' ').split(/[^a-z0-9]+/).filter(function (t) { return t && !STOP[t]; }); }
  var U = null, ST = null;
  function build() {
    U = new Map(); ST = new Map();
    Object.keys(LEX).forEach(function (id) {
      LEX[id].forEach(function (str, ti) {
        var w = 3 - ti;
        str.split(',').forEach(function (t) {
          t = t.trim(); if (!t) return;
          var stem = /\*$/.test(t), key = words(t.replace(/\*$/, '')).join(' ');
          if (!key) return;
          var m = stem ? ST : U, a = m.get(key); if (!a) { a = []; m.set(key, a); }
          a.push([id, w]);
        });
      });
    });
  }
  function strip(h) { return String(h == null ? '' : h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ').slice(0, 2500); }
  /* scores every subject for one piece of text; a word counts in full the first time and half the second time */
  function score(text) {
    if (!U) build();
    var t = words(text), sc = {}, seen = {};
    function add(list, tok) {
      for (var i = 0; i < list.length; i++) {
        var id = list[i][0], k = id + '|' + tok, c = seen[k] = (seen[k] || 0) + 1;
        if (c <= 2) sc[id] = (sc[id] || 0) + list[i][1] * (c === 1 ? 1 : 0.5);
      }
    }
    for (var i = 0; i < t.length; i++) {
      var a = U.get(t[i]); if (a) add(a, t[i]);
      if (i + 1 < t.length) { var b2 = t[i] + ' ' + t[i + 1]; a = U.get(b2); if (a) add(a, b2); }
      if (i + 2 < t.length) { var b3 = t[i] + ' ' + t[i + 1] + ' ' + t[i + 2]; a = U.get(b3); if (a) add(a, b3); }
      if (i + 3 < t.length) { var b4 = t[i] + ' ' + t[i + 1] + ' ' + t[i + 2] + ' ' + t[i + 3]; a = U.get(b4); if (a) add(a, b4); }
      var w = t[i], top = Math.min(w.length, 24);
      for (var L = 3; L <= top; L++) { a = ST.get(w.slice(0, L)); if (a) add(a, 's:' + w.slice(0, L)); }
    }
    return sc;
  }
  function pick(sc) {
    var ids = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; });
    if (!ids.length) return { id: null, s1: 0, s2: 0 };
    return { id: ids[0], s1: sc[ids[0]], s2: ids[1] ? sc[ids[1]] : 0 };
  }
  /* one question -> subject id, or null when unsure. Needs a clear lead: at least 3 points, and 1.5x the runner-up. */
  /* The question text counts fully, the explanation (written about the right answer) a little less, and the four options
     much less, because the wrong options are deliberately taken from other topics. */
  function classifyQ(q) {
    var a = score(strip(q.q)), b = score((q.opts || []).map(strip).join(' . ')), c = score(strip(q.exp) + ' . ' + strip(q.ref)), sc = {}, k;
    for (k in a) sc[k] = (sc[k] || 0) + a[k];
    for (k in c) sc[k] = (sc[k] || 0) + 0.8 * c[k];
    for (k in b) sc[k] = (sc[k] || 0) + 0.35 * b[k];
    var r = pick(sc);
    return r.s1 >= 3 && r.s1 >= 1.5 * r.s2 ? r.id : null;
  }
  window._sdClassifyQ = classifyQ;
  window._sdScores = function (q) { var o = {}, a = score(strip(q.q)), b = score((q.opts || []).map(strip).join(' . ')), c = score(strip(q.exp) + ' . ' + strip(q.ref)); ['a','b','c'].forEach(function (n, i) { var x = [a, b, c][i]; o[n === 'a' ? 'stem' : n === 'b' ? 'opts' : 'exp'] = Object.keys(x).sort(function (m, n2) { return x[n2] - x[m]; }).slice(0, 3).map(function (k) { return k + ':' + x[k]; }).join(' '); }); return o; };

  /* ── names ── */
  function subjOf(id) { return (typeof NEET_SUBJECTS !== 'undefined' ? NEET_SUBJECTS : []).filter(function (s) { return s.id === id; })[0] || null; }
  function subjName(id) { var s = subjOf(id); return s ? s.name : id; }
  function namedSubj(text) { var ids = typeof _sdSubjsOfName === 'function' ? _sdSubjsOfName(text) : []; return ids.length === 1 ? ids[0] : (ids.length > 1 ? 'many' : null); }
  function tidy(part) {   // "OBG" -> "Obs & Gynecology" only when the whole folder name is just an alias of the subject
    var ids = typeof _sdSubjsOfName === 'function' ? _sdSubjsOfName(part) : [];
    if (ids.length !== 1) return part;
    var w = words(part).join(' '), s = subjOf(ids[0]);
    if (!s) return part;
    var known = (s.kw || []).map(function (k) { return words(k).join(' '); }).concat(['anatomy', 'physiology', 'biochemistry', 'pathology', 'pharmacology', 'microbiology', 'forensic medicine', 'community medicine', 'ent', 'ophthalmology', 'surgery', 'general surgery', 'medicine', 'general medicine', 'pediatrics', 'paediatrics', 'anaesthesia', 'anesthesia', 'radiology', 'psychiatry', 'orthopedics', 'orthopaedics', 'dermatology', 'obs gyn', 'obg', 'gynecology', 'gynaecology', 'obstetrics gynecology']);
    return known.indexOf(w) >= 0 ? s.name : part;
  }

  /* Anki decks often keep their structure only in hierarchical tags ("Anatomy::Upper_Limb"): the part that names a subject gives the subject folder,
     what follows it gives the chapter folder. */
  function tidyTag(t) { return String(t).replace(/^#+/, '').replace(/_/g, ' ').replace(/^\d+[.)\s-]+/, '').trim(); }
  function tagPath(q) {
    var t = String(q.tags || '').split(/[\s,;|]+/);
    for (var i = 0; i < t.length; i++) {
      if (t[i].indexOf('::') < 0) continue;
      var parts = t[i].split('::');
      for (var j = 0; j < parts.length; j++) { var id = namedSubj(tidyTag(parts[j])); if (id && id !== 'many') return { id: id, chap: parts.slice(j + 1, j + 3).map(tidyTag).filter(Boolean) }; }
    }
    return null;
  }

  /* ── arrange a {path: [questions]} map ── */
  function arrange(map, deckName) {
    var keys = Object.keys(map), out = {}, rep = { total: 0, structured: 0, byColumn: 0, byText: 0, byNeighbour: 0, unsorted: 0, subjects: 0, tidied: 0 };
    var loose = [];   // [{path, q}] questions whose path names no subject
    function put(k, q) { (out[k] || (out[k] = [])).push(q); }
    keys.forEach(function (k) {
      var qs = map[k] || [], parts = k.split(SEP).map(function (p) { return p.trim(); }).filter(Boolean);
      if (!parts.length) parts = [deckName || 'Imported Deck'];
      rep.total += qs.length;
      var hit = -1;
      for (var i = 0; i < parts.length; i++) { var n = namedSubj(parts[i]); if (n && n !== 'many') { hit = i; break; } }
      if (hit >= 0) {
        var np = parts.slice(), t = tidy(parts[hit]); if (t !== parts[hit]) { np[hit] = t; rep.tidied += qs.length; }
        rep.structured += qs.length; qs.forEach(function (q) { put(np.join(SEP), q); });
      } else qs.forEach(function (q) { loose.push({ path: parts.join(SEP), q: q }); });
    });
    var res = { map: out, changed: rep.tidied > 0, report: rep };
    if (loose.length < 5) { loose.forEach(function (x) { put(x.path, x.q); }); if (!res.changed) res.map = map; return res; }

    /* label every loose question: column, then text */
    var lab = loose.map(function (x) {
      var q = x.q, id = null, how = '', chap = null;
      var col = namedSubj(q.subject || ''); if (col && col !== 'many') { id = col; how = 'c'; }
      if (!id) { var tp = tagPath(q); if (tp) { id = tp.id; how = 'c'; chap = tp.chap; } }
      if (!id && q.tags) { var tg = namedSubj(String(q.tags).replace(/[,;|]/g, ' ')); if (tg && tg !== 'many') { id = tg; how = 'c'; } }
      if (!id) { id = classifyQ(q); if (id) how = 't'; }
      return { id: id, how: how, chap: chap };
    });
    /* sure ones vote for the unsure ones: first the folder's majority, then the nearest neighbours */
    var byPath = {};
    loose.forEach(function (x, i) { var b = byPath[x.path] || (byPath[x.path] = { n: 0, c: {} }); if (lab[i].id) { b.n++; b.c[lab[i].id] = (b.c[lab[i].id] || 0) + 1; } });
    Object.keys(byPath).forEach(function (p) {
      var b = byPath[p], ids = Object.keys(b.c).sort(function (a, c) { return b.c[c] - b.c[a]; });
      b.top = ids.length && b.n >= 8 && b.c[ids[0]] >= 0.8 * b.n ? ids[0] : null;
    });
    loose.forEach(function (x, i) {
      if (lab[i].id) return;
      var b = byPath[x.path];
      if (b && b.top) { lab[i] = { id: b.top, how: 'n' }; return; }
      var c = {}, n = 0;
      for (var d = 1; d <= 6; d++) {
        [i - d, i + d].forEach(function (j) { if (j >= 0 && j < loose.length && loose[j].path === x.path && lab[j].id && lab[j].how !== 'n') { c[lab[j].id] = (c[lab[j].id] || 0) + 1; n++; } });
      }
      var ids = Object.keys(c).sort(function (a, z) { return c[z] - c[a]; });
      if (ids.length && n >= 4 && c[ids[0]] >= 0.75 * n) lab[i] = { id: ids[0], how: 'n' };
    });
    var sure = lab.filter(function (l) { return l.id; }).length;
    if (sure < 0.5 * loose.length) { loose.forEach(function (x) { put(x.path, x.q); }); if (!res.changed) res.map = map; return res; }   // not a medical deck: leave it alone

    var order = {}, seq = [];
    (typeof NEET_SUBJECTS !== 'undefined' ? NEET_SUBJECTS : []).forEach(function (s, i) { order[s.id] = i; });
    var groups = {};   // path -> subject id (or '_') -> [q]
    loose.forEach(function (x, i) {
      var g = groups[x.path] || (groups[x.path] = {}), id = lab[i].id || '_', gk = id + (lab[i].chap && lab[i].chap.length ? '\u0001' + lab[i].chap.join(SEP) : '');
      (g[gk] || (g[gk] = [])).push(x.q);
      if (id === '_') rep.unsorted++; else if (lab[i].how === 'c') rep.byColumn++; else if (lab[i].how === 't') rep.byText++; else rep.byNeighbour++;
      if (id !== '_' && !x.q.subject) x.q.subject = subjName(id);
    });
    var made = {};
    Object.keys(groups).forEach(function (p) {
      var ord = function (gk) { var id = gk.split('\u0001')[0]; return id === '_' ? 999 : order[id]; };
      Object.keys(groups[p]).sort(function (a, b) { return ord(a) - ord(b) || (a < b ? -1 : a > b ? 1 : 0); }).forEach(function (gk) {
        var bits = gk.split('\u0001'), id = bits[0], pk = p + SEP + (id === '_' ? 'Unsorted' : subjName(id)) + (bits[1] ? SEP + bits[1] : '');
        groups[p][gk].forEach(function (q) { put(pk, q); });
        if (id !== '_') made[id] = 1;
      });
    });
    rep.subjects = Object.keys(made).length;
    res.map = out; res.changed = true;
    return res;
  }
  window._sdArrange = arrange;

  /* ── on import ── */
  var orig = window._buildDeckFromRows_map;
  if (typeof orig === 'function') {
    window._buildDeckFromRows_map = function (map, name) {
      var rep = null;
      try {
        if (autoOn() && map && Object.keys(map).length) { var r = arrange(map, name); if (r && r.changed) { map = r.map; rep = r.report; } }
      } catch (e) { console.warn('sort by subject skipped', e); }
      var p = orig.call(this, map, name);
      if (rep && p && typeof p.then === 'function') {
        return p.then(function (v) { setTimeout(function () { say(summary(rep)); }, 900); return v; });
      }
      return p;
    };
  }
  function summary(rep) {
    var moved = rep.byColumn + rep.byText + rep.byNeighbour;
    if (!moved && rep.tidied) return '🧭 Subject folders tidied';
    var m = '🧭 Sorted ' + moved + ' questions into ' + rep.subjects + ' subject' + (rep.subjects === 1 ? '' : 's');
    if (rep.unsorted) m += ' · ' + rep.unsorted + ' in "Unsorted" to check';
    return m + '. You can turn this off in Settings.';
  }

  /* ── a deck that is already imported ("Sort by subject" in its More menu), and a freshly imported Anki deck ── */
  async function restructure(fid, o) {
    o = o || {};
    try {
      var meta = await iGet('files', fid);
      if (!meta) { if (!o.silent) say('Deck not found.', 'error'); return 'none'; }
      var tree = restoreTree(meta.treeData), map = {}, total = 0, keys = Object.keys(tree.nodeByKey || {}), empties = 0;
      for (var i = 0; i < keys.length; i++) {
        if (!tree.nodeByKey[keys[i]].totalCount) empties++;
        var qs = await loadQuestions(fid, keys[i]);
        if (qs && qs.length) { map[keys[i].split('\0').join(SEP)] = qs; total += qs.length; }   // Anki decks join their folder names with a null character
      }
      if (!total) { if (!o.silent) say('This deck has no questions.', 'error'); return 'none'; }
      var names = Object.keys(map), renamed = false;
      if (o.root && names.length === 1 && /^default$/i.test(names[0])) { map[o.root] = map[names[0]]; delete map[names[0]]; renamed = true; }   // Anki's "Default" deck says nothing: use the file name
      var r = arrange(map, meta.name), rep = r.report;
      if (!r.changed && !(o.silent && (empties || renamed))) { if (!o.silent) say('Nothing to sort: this deck is already in subject folders, or it does not look like a medical question bank.'); return 'none'; }
      if (!o.silent) {
        var moved = rep.byColumn + rep.byText + rep.byNeighbour;
        var msg = 'Sort "' + meta.name + '" by subject?\n\n' + moved + ' of ' + total + ' questions will move into ' + rep.subjects + ' subject folders' + (rep.unsorted ? ', and ' + rep.unsorted + ' that could not be placed go to "Unsorted"' : '') +
          '.\n\nYour answers, stars, notes and test history stay with the questions. Best scores of the old folders start again.';
        if (!window.confirm(msg)) return 'none';
      }
      var newKeys = Object.keys(r.map), totalNew = 0;
      for (var a = 0; a < newKeys.length; a++) { await saveQuestions(fid, newKeys[a], r.map[newKeys[a]]); totalNew += r.map[newKeys[a]].length; }
      var nodeMap = {}, top = [];
      newKeys.forEach(function (pk) {
        var parts = pk.split(SEP);
        for (var d = 1; d <= parts.length; d++) {
          var k = parts.slice(0, d).join(SEP);
          if (!nodeMap[k]) {
            var nd = { name: parts[d - 1], parts: parts.slice(0, d), pathKey: k, children: [], ownQ: [], ownCount: 0, totalCount: 0 };
            nodeMap[k] = nd;
            if (d === 1) top.push(nd); else nodeMap[parts.slice(0, d - 1).join(SEP)].children.push(nd);
          }
          if (d === parts.length) { nodeMap[k].ownQ = r.map[pk]; nodeMap[k].ownCount = r.map[pk].length; }
        }
      });
      (function calc(list) { return list.reduce(function (s, n) { n.totalCount = n.ownCount + calc(n.children); return s + n.totalCount; }, 0); })(top);
      await saveFileMeta(fid, meta.name, totalNew, serializeTree(top));
      for (var b = 0; b < keys.length; b++) { if (!r.map[keys[b]]) await saveQuestions(fid, keys[b], []); }
      try { invalidateSidMapCache(); } catch (e) {}
      if (typeof fileId !== 'undefined' && fileId === fid) { qCache = {}; await loadSavedDeck(fid); }
      try { if (typeof invalidateFilesCache === 'function') invalidateFilesCache(); } catch (e) {}
      try { navTo('lib'); } catch (e) {}
      var done = r.changed ? summary(rep) : '🧭 Deck tree tidied' + (empties ? ': ' + empties + ' empty folder' + (empties === 1 ? '' : 's') + ' removed' : '');
      if (o.silent) setTimeout(function () { say(done); }, 700); else say(done.replace(' You can turn this off in Settings.', ''));
      return r.changed ? 'sorted' : 'tidied';
    } catch (e) { console.error(e); if (!o.silent) say('Could not sort this deck: ' + (e && e.message || e), 'error'); return 'none'; }
  }
  function sortFile(fid) { return restructure(fid, {}); }
  var apkgOrig = window.parseAPKG;
  if (typeof apkgOrig === 'function') {   // an Anki file: drop empty decks (Anki always keeps an empty "Default"), name a one-deck file after itself, sort a flat one by subject
    window.parseAPKG = async function () {
      var r = await apkgOrig.apply(this, arguments);
      try { if (autoOn() && typeof fileId !== 'undefined' && fileId && !(typeof _apkgRecovery !== 'undefined' && _apkgRecovery)) await restructure(fileId, { silent: true, root: fileName }); } catch (e) { console.warn('Anki deck tidy skipped', e); }
      return r;
    };
  }
  window._sdSortFile = sortFile;

  var moreOrig = window.openFileMoreMenu;
  if (typeof moreOrig === 'function') {
    window.openFileMoreMenu = function (fid, fname) {
      var r = moreOrig.apply(this, arguments);
      try {
        var ov = document.getElementById('file-more-ov'), body = ov && ov.querySelector('.sheet-body, .sheet-inner, .sheet');
        if (body && !body.querySelector('.sd-sortbtn')) {
          var b = document.createElement('button'); b.className = 'dp-fb sm sd-sortbtn'; b.type = 'button'; b.setAttribute('style', 'justify-content:flex-start;gap:10px;padding:12px 14px;font-size:13px;width:100%');
          b.innerHTML = '🧭 Sort by subject';
          b.addEventListener('click', function () { try { ov.remove(); } catch (e) {} sortFile(fid); });
          var del = body.querySelector('[onclick*="deleteDeck"]'), anchor = del ? del.closest('button') || del : null;
          if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(b, anchor); else body.appendChild(b);
        }
      } catch (e) {}
      return r;
    };
  }

  /* ── Settings: one switch ── */
  function injectRow() {
    if (document.getElementById('tog-autosort')) return true;
    var anchor = document.getElementById('sg-layout') || document.getElementById('tog-amoled') || document.getElementById('tog-motion');
    var row = anchor && anchor.closest('.set-row');
    if (!row) return false;
    var n = document.createElement('div'); n.className = 'set-row';
    n.innerHTML = '<div style="flex:1 1 auto;min-width:0;padding-right:10px"><div class="sr-lbl">Sort imports by subject</div><div class="sr-sub">Puts new files into subject folders. Unsure ones go to "Unsorted".</div></div><label class="tog" style="flex:none"><input type="checkbox" id="tog-autosort"><span class="tsl"></span></label>';
    row.insertAdjacentElement('afterend', n);
    var cb = document.getElementById('tog-autosort'); cb.checked = autoOn();
    cb.addEventListener('change', function () { lsSet(KEY, cb.checked ? 'on' : 'off'); say(cb.checked ? '🧭 New imports will be sorted by subject' : 'New imports will keep their own folders'); });
    return true;
  }
  if (!injectRow()) { var tries = 0, iv = setInterval(function () { if (injectRow() || ++tries > 40) clearInterval(iv); }, 250); }
})();
/* v47: after an answer, bring the verdict and the explanation into view. On a phone the question and four options fill the screen, so the result sat below the
   fold behind the bottom bar and the "Tapped wrong? Undo" pill, and had to be found by scrolling. */
(function () {
  if (window.__sdReveal) return; window.__sdReveal = 1;
  function reveal(tries) {
    try {
      var box = document.querySelector('#qb .exp-box'), sc = document.getElementById('qz-main'); if (!sc) return;
      if (!box) { if ((tries || 0) < 12) setTimeout(function () { reveal((tries || 0) + 1); }, 100); return; }   /* the result block is drawn a moment after the tap */
      var bar = document.getElementById('qz-actionbar'), r = box.getBoundingClientRect(), s = sc.getBoundingClientRect();
      var limit = bar ? Math.min(bar.getBoundingClientRect().top, s.bottom) : s.bottom, h = limit - s.top; if (h < 120) return;
      if (r.top < s.top + h * 0.5) return;                       /* the verdict is already in the upper half: leave the page where it is */
      var top = sc.scrollTop + (r.top - s.top) - h * 0.36;       /* leave the last options above it, so the answer picked stays in sight when it can */
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      sc.scrollTo({ top: Math.max(0, top), behavior: calm ? 'auto' : 'smooth' });
    } catch (e) {}
  }
  var o = window.doAnswer;
  if (typeof o === 'function') window.doAnswer = function () { var r = o.apply(this, arguments); setTimeout(reveal, 60); return r; };
})();
/* v47b — HTML question banks keep their real folder tree.
   Marrow-style files hold the whole bank as one JSON value (FOLDER_TREE, TESTS_LIST, APP_DATA …). The old readers cut that value into pieces with a
   lazy regular expression, so a nested bank came out as a few loose questions with the tree lost. This reads the value as written: it finds the
   matching closing bracket, parses it, and walks it to any depth, so every folder name becomes a level of the deck tree. Nothing in the file is run. */
(function () {
  if (window._sdMarrowStatic) return;
  var NAMES = ['FOLDER_TREE', 'TESTS_LIST', 'APP_DATA', 'questionBank', 'marrowData', 'QUESTIONS', 'quizData', 'deckData', 'examData', 'qBank'];
  var SKIP_ROOT = /^(root|all|home|library|marrow|folders?|tests?|data|\/)$/i;
  var LIST_KEYS = ['folders', 'subfolders', 'children', 'chapters', 'subjects', 'sections', 'topics', 'tests', 'lessons', 'modules', 'items', 'questions'];
  var LETTERS = 'ABCD';

  function isQ(o) { return o && typeof o === 'object' && !Array.isArray(o) && (o.text || o.question || o.stem) && (o.options || o.choices || o.ans !== undefined); }
  function clean(s) { return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\s*›\s*/g, ' - ').trim(); }

  /* the text of one bracketed value, found by matching brackets (quotes and escapes respected) */
  function block(src, start) {
    var open = src.charAt(start), close = open === '[' ? ']' : '}', depth = 0, inStr = false, quote = '', i, ch;
    for (i = start; i < src.length; i++) {
      ch = src.charAt(i);
      if (inStr) { if (ch === '\\') i++; else if (ch === quote) inStr = false; continue; }
      if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') { depth--; if (depth === 0) return ch === close ? src.slice(start, i + 1) : null; }
    }
    return null;
  }
  function parse(txt) {
    try { return JSON.parse(txt); } catch (e) { }
    try { return JSON.parse(txt.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { }   // a stray trailing comma is the usual reason a hand-edited file is not strict JSON
    return null;
  }

  /* every question under a node, with the names of the folders it sits in */
  function walk(node, path, out, depth, top) {
    if (!node || typeof node !== 'object' || depth > 60) return;
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) walk(node[i], path, out, depth + 1, top); return; }
    if (isQ(node)) { out.push({ raw: node, path: path }); return; }
    var here = path, add = [];
    ['subject', 'Subject', 'chapter', 'Chapter', 'module', 'topic', 'Topic', 'lesson', 'subtopic', 'SubTopic'].forEach(function (k) { if (typeof node[k] === 'string' && node[k].trim()) add.push(clean(node[k])); });
    var nm = node.name || node.title || node.label;
    if (!add.length && typeof nm === 'string' && nm.trim() && !(top && SKIP_ROOT.test(nm.trim()))) add.push(clean(nm));
    add = add.filter(function (x, i) { return x && x !== path[path.length - 1] && add.indexOf(x) === i; });
    if (add.length) here = path.concat(add);
    var seen = {};
    LIST_KEYS.forEach(function (k) { if (node[k] && typeof node[k] === 'object') { seen[k] = 1; walk(node[k], here, out, depth + 1, false); } });
    for (var k in node) { if (!seen[k] && node[k] && typeof node[k] === 'object') walk(node[k], here, out, depth + 1, false); }
  }

  /* an answer that is given as a number or as the option's own words, not as a letter ("Atropine" must not be read as option A) */
  function letterOf(raw, flat) {
    var a = raw.ans !== undefined ? raw.ans : raw.correct_answer !== undefined ? raw.correct_answer : raw.correct;
    if (typeof a === 'number' && a >= 0 && a < 4) return LETTERS.charAt(a);
    if (typeof a === 'string' && a.trim() && !/^\s*(option\s*)?[A-Da-d]\s*[).:]?\s*$/.test(a)) {
      var t = clean(a).toLowerCase();
      for (var i = 0; i < 4; i++) { var o = clean(flat['Option ' + LETTERS.charAt(i)] || '').toLowerCase(); if (o && o === t) return LETTERS.charAt(i); }
    }
    return flat['Correct Letter'] || '';
  }

  window._sdMarrowStatic = function (html) {
    try {
      if (typeof html !== 'string' || html.length < 40 || typeof _htmlFlattenMarrowData !== 'function') return [];
      var found = [], done = {};
      NAMES.forEach(function (nm) {
        var re = new RegExp('(?:^|[^\\w$])' + nm + '\\s*=\\s*([\\[{])', 'g'), m;
        while ((m = re.exec(html))) {
          var at = m.index + m[0].length - 1;
          if (done[at]) continue; done[at] = 1;
          var txt = block(html, at); if (!txt) continue;
          var val = parse(txt); if (val) walk(val, [], found, 0, true);
        }
      });
      if (!found.length) return [];
      var out = [], seen = {};
      found.forEach(function (f) {
        var rows = _htmlFlattenMarrowData(f.raw, '', '', '', ''); if (!rows.length) return;
        var r = rows[0], p = f.path, key = p.join('\u0001') + '\u0002' + String(r.Question || '').slice(0, 200);
        if (seen[key]) return; seen[key] = 1;
        r.Subject = p[0] || ''; r.Chapter = p[1] || ''; r.Topic = p[2] || ''; r.SubTopic = p.slice(3).join(' › ');
        r['Deck Path'] = p.join(' › ');
        r['Correct Letter'] = letterOf(f.raw, r);
        r['Correct Answer'] = r['Correct Letter'] ? (r['Option ' + r['Correct Letter']] || '') : '';
        out.push(r);
      });
      return out;
    } catch (e) { console.warn('static Marrow read skipped', e); return []; }
  };
})();
/* v47c — Leaderboard and daily performance for all students (Firebase Realtime Database, plain REST).
   Opt-in. A student who joins shares a display name (and, if they tick it, their college) plus counts: tests, marks, questions, accuracy, streak and the last 7 days.
   Never shared: email, phone, password, question text, answers, notes. Each student writes only their own node (studydeck_rank/sum/<id>), never the shared user list.
   Everything read back is range-checked and escaped. Marks are the NEET PG scheme (+4 right, -1 wrong) worked out from each test's saved answers.
   Honest limit: without Firebase sign-in the database cannot tell who is writing, so a determined person could post made-up numbers (see README, "Leaderboard"). */
(function () {
  if (window.__sdRank) return; window.__sdRank = 1;
  var ROOT = 'studydeck_rank', LS_ME = 'sd-rank-me', LS_SENT = 'sd-rank-sent', LS_UI = 'sd-rank-ui', KIND = { neet: 'n', custom: 'c' };
  var S = { per: 'today', kind: 'all', met: 'marks', board: null, bad: 0, at: 0, err: '', users: null, q: '', sort: 'marks', open: null, edit: false, shown: 30, mine: null, adm: false, busy: '' };
  try { var u0 = JSON.parse(localStorage.getItem(LS_UI) || '{}'); ['per', 'kind', 'met'].forEach(function (k) { if (u0[k]) S[k] = u0[k]; }); } catch (e) { }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }
  function me() { try { return JSON.parse(lsGet(LS_ME) || 'null'); } catch (e) { return null; } }
  function acct() { try { return (typeof _SDA !== 'undefined' && _SDA.user) || null; } catch (e) { return null; } }
  function uid() { try { var u = acct(); if (u && u.id) return String(u.id); var s = _sdSess.load(); return s && s.type === 'user' && s.userId ? String(s.userId) : ''; } catch (e) { return ''; } }
  function isAdmin() { try { var s = _sdSess.load(); return !!(s && s.type === 'admin'); } catch (e) { return false; } }
  function say(m, t) { try { toast(m, t); } catch (e) { } }
  function dk(i) { return dateKey(new Date(Date.now() - i * 864e5)); }
  function pct(r, q) { return q > 0 ? Math.round(r * 100 / q) : 0; }
  function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }
  function ago(ms) { if (!ms) return '—'; var s = Math.max(0, (Date.now() - ms) / 1000); return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; }
  function dlabel(d) { try { return new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (e) { return d; } }
  function firstName(n) { var p = String(n || '').trim().split(/\s+/); return (p[0] || 'Student') + (p[1] ? ' ' + p[1].charAt(0).toUpperCase() + '.' : ''); }

  /* ── 1. This device's numbers (nothing is stored twice: they are worked out from the tests and quizzes already kept here) ── */
  async function local() {
    var rec = [], ses = [], days = {}, all = { n: [0, 0, 0], c: [0, 0, 0], q: [0, 0] }, best = null, last = null, i;
    try { rec = (await getAllTestRecords()) || []; } catch (e) { }
    try { (await iAll('scores')).forEach(function (r) { if (r && /__sess$/.test(r.key || '') && Array.isArray(r.val)) ses = ses.concat(r.val); }); } catch (e) { }
    var D = function (d) { return days[d] || (days[d] = { n: [0, 0, 0], c: [0, 0, 0], q: [0, 0] }); };
    ses.forEach(function (s) { if (!s || typeof s.date !== 'string') return; var t = Math.min(+s.total || 0, 500), r = Math.min(+s.score || 0, t); if (t <= 0) return; var d = D(s.date); d.q[0] += t; d.q[1] += r; all.q[0] += t; all.q[1] += r; });
    rec.forEach(function (r) {
      var k = r && r.attempted && KIND[r.type]; if (!k) return;
      var tot = Math.min(+r.total || 0, 500); if (tot <= 0) return;
      var ok = Math.min(+r.ncorr || 0, tot), wrong = 0;
      if (Array.isArray(r.resultIds)) r.resultIds.forEach(function (x) { if (x && x.ui != null && x.ui !== -1 && !x.ok) wrong++; });
      wrong = Math.min(wrong, tot - ok);
      var m = ok * 4 - wrong, x = tot * 4, d = D(r.date || dateKey(new Date(r.timestamp || Date.now())));
      d[k][0]++; d[k][1] += m; d[k][2] += x; all[k][0]++; all[k][1] += m; all[k][2] += x;
      if (k === 'n' && (!best || m / x > best[0] / best[1])) best = [m, x];
      if (!last || (r.timestamp || 0) > last[0]) last = [r.timestamp || 0, k, m, x, String(r.title || '').slice(0, 30)];
    });
    var seen = {}; ses.forEach(function (s) { if (s && s.date) seen[s.date] = 1; }); Object.keys(days).forEach(function (d) { seen[d] = 1; });
    var st = 0; i = seen[dk(0)] ? 0 : 1; while (seen[dk(i)] && st < 5000) { st++; i++; }
    var d7 = {}; for (i = 0; i < 7; i++) if (days[dk(i)]) d7[dk(i)] = days[dk(i)];
    return { days: days, all: all, best: best, last: last, streak: st, d7: d7 };
  }
  function pack(L, m) { var o = { n: m.n, u: Date.now(), s: L.streak, a: L.all, d: L.d7 }; if (m.showC && m.c) o.c = m.c; if (L.best) o.b = L.best; if (L.last) o.l = L.last; return o; }

  /* ── 2. Talking to Firebase ── */
  function url(p) { return _SDA_CONF.FB + '/' + ROOT + '/' + p + '.json'; }
  async function jget(p) { var r = await fetch(url(p), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'The database does not allow the leaderboard yet (see README, Leaderboard).' : 'Network error ' + r.status); return r.json(); }
  async function jsend(p, method, body) { var r = await fetch(url(p), { method: method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); if (!r.ok) throw new Error('Network error ' + r.status); }

  /* ── 3. Everything read back is checked: a made-up or broken entry is dropped, not shown ── */
  function clean(o, cap) {
    if (!o || typeof o !== 'object') return null; var r = { q: [0, 0], n: [0, 0, 0], c: [0, 0, 0] }, q = o.q, a, k, i;
    if (q !== undefined) { if (!Array.isArray(q) || q.length < 2) return null; r.q = [+q[0], +q[1]]; if (!(r.q[0] >= 0 && r.q[0] <= cap && r.q[1] >= 0 && r.q[1] <= r.q[0])) return null; }
    for (i = 0; i < 2; i++) { k = 'nc'.charAt(i); a = o[k]; if (a === undefined) continue; if (!Array.isArray(a) || a.length < 3) return null; a = [+a[0], +a[1], +a[2]]; if (!(a[0] >= 0 && a[0] <= cap / 30 && a[2] >= 0 && a[2] <= 2000 * a[0] && a[1] <= a[2] && a[1] >= -a[2] / 4)) return null; r[k] = a; }
    return r;
  }
  function sane(e) {
    if (!e || typeof e !== 'object' || typeof e.n !== 'string' || !e.n.trim() || e.n.length > 40) return null;
    var a = clean(e.a, 3e5), d = {}, k, c; if (!a) return null;
    if (e.d) { if (typeof e.d !== 'object') return null; for (k in e.d) { if (!/^\d{4}-\d\d-\d\d$/.test(k)) continue; c = clean(e.d[k], 3000); if (!c) return null; d[k] = c; } }
    var b = Array.isArray(e.b) && +e.b[1] > 0 && +e.b[1] <= 4000 && +e.b[0] <= +e.b[1] ? [+e.b[0], +e.b[1]] : null, l = Array.isArray(e.l) && e.l.length >= 5 ? [+e.l[0] || 0, e.l[1] === 'c' ? 'c' : 'n', +e.l[2] || 0, +e.l[3] || 0, String(e.l[4]).slice(0, 30)] : null;
    return { n: e.n.trim().slice(0, 24), c: typeof e.c === 'string' ? e.c.slice(0, 40) : '', u: +e.u || 0, s: Math.min(Math.max(+e.s || 0, 0), 5000), a: a, d: d, b: b, l: l };
  }
  async function fetchBoard() {
    var raw = await jget('sum'), b = {}, bad = 0;
    if (raw && typeof raw === 'object') Object.keys(raw).forEach(function (id) { var e = sane(raw[id]); if (e) b[id] = e; else bad++; });
    S.board = b; S.bad = bad; S.at = Date.now(); S.err = '';
  }

  /* ── 4. Sending this student's numbers (own node only, only when something changed) ── */
  var tmr = 0, busy = false;
  function mx(a, b) { return a.map(function (v, i) { return b && b[i] != null ? Math.max(v, b[i]) : v; }); }
  async function merge(o, id) {   // the row already online may hold work done on another device or before data was cleared: keep the larger figures
    var e; try { e = sane(await jget('sum/' + encodeURIComponent(id))); } catch (x) { return o; }
    if (!e) return o;
    ['n', 'c', 'q'].forEach(function (k) { o.a[k] = mx(o.a[k], e.a[k]); });
    Object.keys(e.d).forEach(function (d) { if (d < dk(6)) return; var x = o.d[d] || (o.d[d] = { n: [0, 0, 0], c: [0, 0, 0], q: [0, 0] }); ['n', 'c', 'q'].forEach(function (k) { x[k] = mx(x[k], e.d[d][k]); }); });
    o.s = Math.max(o.s, e.s); if (e.b && (!o.b || e.b[0] / e.b[1] > o.b[0] / o.b[1])) o.b = e.b; if (e.l && (!o.l || e.l[0] > o.l[0])) o.l = e.l;
    return o;
  }
  async function sync(force) {
    var m = me(), id = uid(); if (!m || !m.uid || m.uid !== id || busy) return 'off';
    busy = true;
    try {
      var o = pack(await local(), m), sig = JSON.stringify([o.n, o.c, o.s, o.a, o.d, o.b, o.l]);
      if (!force && lsGet(LS_SENT) === sig) return 'same';
      o = await merge(o, id);
      await jsend('sum/' + encodeURIComponent(id), 'PUT', o); lsSet(LS_SENT, sig); return 'ok';
    } finally { busy = false; }
  }
  function sched(ms) { clearTimeout(tmr); tmr = setTimeout(function () { sync().catch(function () { lsSet(LS_SENT, null); }); }, ms || 1500); }
  var eq = window.endQuiz;
  if (typeof eq === 'function') window.endQuiz = async function () { var r = await eq.apply(this, arguments); try { sched(2500); } catch (e) { } return r; };
  window.addEventListener('online', function () { if (me()) sched(1500); });
  setTimeout(function () { if (me()) sched(100); }, 6000);

  /* ── 5. Ranking ── */
  function rows(board, per, kind, met) {
    var ds = per === 'today' ? [dk(0)] : per === 'week' ? [0, 1, 2, 3, 4, 5, 6].map(dk) : null, out = [];
    Object.keys(board).forEach(function (id) {
      var e = board[id], src = ds ? ds.map(function (d) { return e.d[d]; }).filter(Boolean) : [e.a], o = { id: id, e: e, t: 0, m: 0, x: 0, q: 0, r: 0 };
      src.forEach(function (s) { ['n', 'c'].forEach(function (k) { if (kind === 'all' || kind === k) { o.t += s[k][0]; o.m += s[k][1]; o.x += s[k][2]; } }); o.q += s.q[0]; o.r += s.q[1]; });
      o.acc = o.q ? o.r / o.q : 0; out.push(o);
    });
    var act = out.filter(function (o) { return o.t > 0 || o.q > 0; }), min = per === 'today' ? 10 : 20;
    var list = act.filter(function (o) { return met === 'marks' ? o.t > 0 : met === 'q' ? o.q > 0 : o.q >= min; });
    var key = function (o) { return met === 'marks' ? o.m : met === 'q' ? o.q : o.acc; };
    list.sort(function (a, b) { return key(b) - key(a) || b.acc - a.acc || b.q - a.q || (a.e.n < b.e.n ? -1 : 1); });
    list.forEach(function (o, i) { o.v = key(o); o.pos = i > 0 && list[i - 1].v === o.v && list[i - 1].acc === o.acc ? list[i - 1].pos : i + 1; });
    var Q = 0, R = 0, T = 0, M = 0; act.forEach(function (o) { Q += o.q; R += o.r; T += o.t; M += o.m; });
    return { list: list, active: act.length, q: Q, acc: pct(R, Q), avgM: T ? M / T : 0, tests: T };
  }

  /* ── 6. Screen ── */
  var ov = null;
  function chip(a, on, label) { return '<button class="rk-c' + (on ? ' on' : '') + '" data-a="' + a + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + label + '</button>'; }
  function valOf(o, met) { return met === 'marks' ? fmt(o.m) : met === 'q' ? fmt(o.q) : pct(o.r, o.q) + '%'; }
  function subOf(o, met) { return (met !== 'marks' ? o.t + ' test' + (o.t === 1 ? '' : 's') + ' · ' : '') + (met === 'marks' ? o.t + ' test' + (o.t === 1 ? '' : 's') + ' · ' + fmt(o.q) + ' q · ' + pct(o.r, o.q) + '%' : met === 'q' ? pct(o.r, o.q) + '% right' : fmt(o.q) + ' questions'); }
  function head() {
    var m = me(), id = uid();
    if (S.adm) return '';
    if (!id) return '<div class="rk-card"><b>Sign in first</b><div class="rk-sub">The leaderboard uses your StudyDeck account, so sign in to join.</div></div>';
    if (!m || m.uid !== id) {
      var a = acct() || {}, nm = firstName(a.name);
      return '<div class="rk-card rk-join"><div class="rk-big">🏆 Join the leaderboard</div><div class="rk-sub">See how your marks and daily practice compare with other students. You choose what shows.</div>' +
        '<label class="rk-l" for="rk-name">Name shown to others</label><input class="rk-in" id="rk-name" maxlength="24" value="' + esc(nm) + '" autocomplete="off">' +
        (a.college ? '<label class="rk-ck"><input type="checkbox" id="rk-col"> Also show my college (' + esc(a.college) + ')</label>' : '') +
        '<div class="rk-fine"><b>Shared:</b> that name, tests taken, marks, questions, accuracy, streak, last 7 days.<br><b>Never shared:</b> email, phone, password, questions, answers, notes.<br>You can leave any time and your row is deleted.</div>' +
        '<button class="rk-btn" data-a="join">Join and share my scores</button></div>';
    }
    if (S.edit) return '<div class="rk-card"><label class="rk-l" for="rk-name">Name shown to others</label><input class="rk-in" id="rk-name" maxlength="24" value="' + esc(m.n) + '">' +
      ((acct() || {}).college ? '<label class="rk-ck"><input type="checkbox" id="rk-col"' + (m.showC ? ' checked' : '') + '> Show my college (' + esc((acct() || {}).college) + ')</label>' : '') +
      '<div class="rk-row2"><button class="rk-btn" data-a="save">Save</button><button class="rk-btn ghost" data-a="edit">Cancel</button><button class="rk-btn danger" data-a="leave">Leave leaderboard</button></div></div>';
    var v = S.board && rows(S.board, S.per, S.kind, S.met), mine = v && v.list.filter(function (o) { return o.id === id; })[0];
    var line = !S.board ? 'Loading…' : mine ? '<b>#' + mine.pos + '</b> of ' + v.list.length + ' · ' + valOf(mine, S.met) + (S.met === 'marks' ? ' marks' : S.met === 'q' ? ' questions' : ' accuracy') : 'No result for you in this view yet. Take a test or quiz to appear.';
    var gap = mine && mine.pos > 1 ? (function () { var up = v.list.filter(function (o) { return o.pos < mine.pos; }).pop(); if (!up) return ''; var dv = S.met === 'acc' ? pct(up.r, up.q) - pct(mine.r, mine.q) : up.v - mine.v; return '<div class="rk-sub">' + (dv > 0 ? (S.met === 'acc' ? dv + ' points' : fmt(dv) + (S.met === 'marks' ? ' marks' : ' questions')) + ' behind #' + up.pos + ' (' + esc(up.e.n) + ')' : 'Level with #' + up.pos + ' (' + esc(up.e.n) + '); accuracy breaks the tie') + '</div>'; })() : '';
    return '<div class="rk-card rk-me"><div class="rk-row2"><div style="flex:1;min-width:0"><div class="rk-sub">You are sharing as <b>' + esc(m.n) + '</b></div><div class="rk-big">' + line + '</div>' + gap + '</div><button class="rk-btn ghost sm" data-a="edit">Edit</button></div></div>';
  }
  function board() {
    var warn = S.err && S.board ? '<div class="rk-card rk-sub">⚠️ ' + esc(S.err) + ' Showing the last copy from ' + ago(S.at) + '.</div>' : '';
    if (!S.board) return S.err ? '<div class="rk-card"><b>Can\'t reach the leaderboard</b><div class="rk-sub">' + esc(S.err) + '</div><button class="rk-btn" data-a="refresh" style="margin-top:10px">Try again</button></div>' : '<div class="rk-card rk-sub">Loading the leaderboard…</div>';
    var v = rows(S.board, S.per, S.kind, S.met), id = uid(), per = { today: 'today', week: 'in the last 7 days', all: 'so far' }[S.per];
    var h = warn + '<div class="rk-seg" role="group" aria-label="Period">' + chip('per:today', S.per === 'today', 'Today') + chip('per:week', S.per === 'week', 'This week') + chip('per:all', S.per === 'all', 'All time') + '</div>' +
      '<div class="rk-chips" role="group" aria-label="Tests">' + chip('kind:all', S.kind === 'all', 'All tests') + chip('kind:n', S.kind === 'n', 'NEET mock') + chip('kind:c', S.kind === 'c', 'Custom test') + '</div>' +
      '<div class="rk-chips" role="group" aria-label="Rank by"><span class="rk-sub" style="align-self:center">Rank by</span>' + chip('met:marks', S.met === 'marks', 'Marks') + chip('met:q', S.met === 'q', 'Questions') + chip('met:acc', S.met === 'acc', 'Accuracy') + '</div>' +
      '<div class="rk-stats"><div><b>' + v.active + '</b><span>active ' + (S.per === 'today' ? 'today' : S.per === 'week' ? 'this week' : 'students') + '</span></div><div><b>' + fmt(v.q) + '</b><span>questions</span></div><div><b>' + v.acc + '%</b><span>accuracy</span></div><div><b>' + fmt(v.avgM) + '</b><span>avg marks / test</span></div></div>';
    if (S.bad && S.adm) h += '<div class="rk-sub" style="margin:6px 2px">' + S.bad + ' entr' + (S.bad === 1 ? 'y' : 'ies') + ' with impossible numbers hidden.</div>';
    if (!v.list.length) return h + '<div class="rk-card rk-sub">' + (S.met === 'acc' ? 'Accuracy needs at least ' + (S.per === 'today' ? 10 : 20) + ' questions. ' : '') + 'Nobody has a result ' + per + ' for this view yet.</div>';
    h += '<ol class="rk-list">';
    v.list.slice(0, S.shown).forEach(function (o) {
      h += '<li><button class="rk-r' + (o.id === id ? ' me' : '') + '" data-a="row:' + esc(o.id) + '"><span class="rk-pos">' + ({ 1: '🥇', 2: '🥈', 3: '🥉' }[o.pos] || o.pos) + '</span><span class="rk-nm"><b>' + esc(o.e.n) + '</b>' + (o.e.c ? '<small>' + esc(o.e.c) + '</small>' : '') + '</span><span class="rk-v"><b>' + valOf(o, S.met) + '</b><small>' + subOf(o, S.met) + '</small></span></button></li>';
    });
    h += '</ol>';
    if (v.list.length > S.shown) h += '<button class="rk-btn ghost" data-a="more" style="width:100%">Show more (' + (v.list.length - S.shown) + ' left)</button>';
    return h;
  }
  function mineSec() {
    var L = S.mine; if (!L) return '';
    var d = [], i, mx = 1; for (i = 0; i < 14; i++) { var x = L.days[dk(i)]; if (x) { d.push([dk(i), x]); mx = Math.max(mx, x.q[0]); } }
    var h = '<h3 class="rk-h3">My daily performance</h3>';
    if (!d.length) return h + '<div class="rk-card rk-sub">Take a quiz or mock test and your last 14 days will show up here, saved on this device.</div>';
    h += '<div class="rk-card"><div class="rk-sub" style="margin-bottom:8px">Streak: <b>' + L.streak + '</b> day' + (L.streak === 1 ? '' : 's') + (L.best ? ' · best NEET mock <b>' + fmt(L.best[0]) + '/' + fmt(L.best[1]) + '</b>' : '') + '</div>';
    d.forEach(function (p) {
      var x = p[1], t = x.n[0] + x.c[0], m = x.n[1] + x.c[1];
      h += '<div class="rk-day"><span class="rk-dl">' + esc(dlabel(p[0])) + '</span><span class="rk-bar"><i style="width:' + Math.max(4, Math.round(x.q[0] * 100 / mx)) + '%"></i></span><span class="rk-dv"><b>' + fmt(x.q[0]) + '</b> q · ' + pct(x.q[1], x.q[0]) + '%' + (t ? ' · ' + t + ' test' + (t === 1 ? '' : 's') + ' · ' + fmt(m) + ' marks' : '') + '</span></div>';
    });
    return h + '</div>';
  }
  function sheet() {
    var id = S.open, e = S.board && S.board[id]; if (!e) return '';
    var d = [], i, mx = 1; for (i = 6; i >= 0; i--) { var x = e.d[dk(i)] || { q: [0, 0], n: [0, 0, 0], c: [0, 0, 0] }; d.push([dk(i), x]); mx = Math.max(mx, x.q[0]); }
    var a = e.a, t = a.n[0] + a.c[0], m = a.n[1] + a.c[1], u = S.adm && S.users && S.users.filter(function (z) { return String(z.id) === id; })[0];
    var h = '<div class="rk-sh" data-a="close"><div class="rk-shc" role="dialog" aria-label="' + esc(e.n) + '"><div class="rk-row2"><div style="flex:1;min-width:0"><div class="rk-big">' + esc(e.n) + '</div>' + (e.c ? '<div class="rk-sub">' + esc(e.c) + '</div>' : '') + '<div class="rk-sub">Last updated ' + ago(e.u) + '</div></div><button class="rk-ib" data-a="close" aria-label="Close">✕</button></div>' +
      (u ? '<div class="rk-sub" style="margin-top:6px">' + esc(u.email || '') + ' · ' + esc(u.mobile || '') + '</div>' : '') +
      '<div class="rk-stats"><div><b>' + t + '</b><span>tests</span></div><div><b>' + fmt(m) + '</b><span>marks</span></div><div><b>' + fmt(a.q[0]) + '</b><span>questions</span></div><div><b>' + pct(a.q[1], a.q[0]) + '%</b><span>accuracy</span></div></div>' +
      '<div class="rk-sub">Streak <b>' + e.s + '</b> day' + (e.s === 1 ? '' : 's') + (e.b ? ' · best NEET mock <b>' + fmt(e.b[0]) + '/' + fmt(e.b[1]) + '</b>' : '') + '</div>' +
      (e.l ? '<div class="rk-sub">Last test: ' + esc(e.l[4] || (e.l[1] === 'c' ? 'Custom test' : 'NEET mock')) + ' · <b>' + fmt(e.l[2]) + '/' + fmt(e.l[3]) + '</b> · ' + ago(e.l[0]) + '</div>' : '') +
      '<h3 class="rk-h3">Last 7 days</h3>';
    d.forEach(function (p) { var x = p[1]; h += '<div class="rk-day"><span class="rk-dl">' + esc(dlabel(p[0])) + '</span><span class="rk-bar"><i style="width:' + (x.q[0] ? Math.max(4, Math.round(x.q[0] * 100 / mx)) : 0) + '%"></i></span><span class="rk-dv">' + (x.q[0] ? '<b>' + fmt(x.q[0]) + '</b> q · ' + pct(x.q[1], x.q[0]) + '%' : '—') + '</span></div>'; });
    if (S.adm) h += '<button class="rk-btn danger" data-a="rm:' + esc(id) + '" style="margin-top:12px">Remove from leaderboard</button>';
    return h + '</div></div>';
  }
  function admin() {
    var us = S.users || [], b = S.board || {}, q = S.q.toLowerCase(), now = dk(0), today = 0, joined = 0;
    var list = us.map(function (u) { var e = b[String(u.id)]; if (e) { joined++; if (e.d[now]) today++; } return { u: u, e: e }; }).filter(function (r) { return !q || (r.u.name + ' ' + r.u.email + ' ' + r.u.mobile + ' ' + (r.u.college || '') + ' ' + (r.u.city || '')).toLowerCase().indexOf(q) >= 0; });
    var val = function (r) { var a = r.e && r.e.a; return !a ? -1 : S.sort === 'marks' ? a.n[1] + a.c[1] : S.sort === 'q' ? a.q[0] : S.sort === 'last' ? r.e.u : 0; };
    list.sort(function (x, y) { return S.sort === 'name' ? (String(x.u.name).toLowerCase() < String(y.u.name).toLowerCase() ? -1 : 1) : val(y) - val(x); });
    var h = '<div class="rk-stats"><div><b>' + us.length + '</b><span>registered</span></div><div><b>' + joined + '</b><span>on leaderboard</span></div><div><b>' + today + '</b><span>active today</span></div><div><b>' + (S.bad || 0) + '</b><span>hidden (bad data)</span></div></div>' +
      '<div class="rk-row2" style="margin:8px 0"><input class="rk-in" id="rk-q" placeholder="Search name, email, mobile, college" value="' + esc(S.q) + '" style="flex:1;margin:0"><button class="rk-btn ghost sm" data-a="csv">Download CSV</button></div>' +
      '<div class="rk-chips">' + chip('sort:marks', S.sort === 'marks', 'Marks') + chip('sort:q', S.sort === 'q', 'Questions') + chip('sort:last', S.sort === 'last', 'Last active') + chip('sort:name', S.sort === 'name', 'Name') + '</div><ol class="rk-list">';
    list.slice(0, S.shown).forEach(function (r) {
      var a = r.e && r.e.a, t = a ? a.n[0] + a.c[0] : 0;
      h += '<li><button class="rk-r a' + (r.e ? '' : ' off') + '" data-a="' + (r.e ? 'row:' + esc(String(r.u.id)) : 'noop') + '"><span class="rk-nm"><b>' + esc(r.u.name) + '</b><small>' + esc(r.u.email || '') + '</small><small>' + esc(r.u.mobile || '') + (r.u.college ? ' · ' + esc(r.u.college) : '') + '</small></span><span class="rk-v">' + (r.e ? '<b>' + fmt(a.n[1] + a.c[1]) + ' marks</b><small>' + t + ' tests · ' + fmt(a.q[0]) + ' q · ' + pct(a.q[1], a.q[0]) + '% · ' + ago(r.e.u) + '</small>' : '<small>Not on leaderboard</small>') + '</span></button></li>';
    });
    h += '</ol>' + (list.length > S.shown ? '<button class="rk-btn ghost" data-a="more" style="width:100%">Show more (' + (list.length - S.shown) + ' left)</button>' : '') +
      '<button class="rk-btn danger" data-a="clear" style="margin-top:14px">Clear the whole leaderboard</button>';
    return h;
  }
  function paint() {
    if (!ov) return; var body = ov.querySelector('#rk-body'), st = body.scrollTop;
    body.innerHTML = (S.adm ? '<div class="rk-card rk-sub">Admin view: every registered student, with their leaderboard numbers.</div>' : '') + head() + (S.adm ? admin() : board() + mineSec()) +
      '<div class="rk-fine" style="margin:10px 2px 0">' + (S.at ? 'Updated ' + ago(S.at) + '. ' : '') + 'Days follow the app\'s day (new day at 5:30 am India time). Marks use the NEET PG scheme, +4 right, −1 wrong. Scores are reported by each student\'s device.</div>' + sheet();
    body.scrollTop = st;
    var l = ov.querySelector('#rk-set'); if (l) l.textContent = '';
  }
  async function refresh() {
    try { if (S.adm) { var d = await _sdDB_R(); S.users = (d && d.users) || []; } await fetchBoard(); } catch (e) { S.err = String(e && e.message || e); if (!S.board) S.board = null; }
    S.mine = await local(); paint(); setSettingsSub();
  }
  async function act(a, el) {
    var p = a.split(':'), k = p[0], v = p.slice(1).join(':');
    if (k === 'per' || k === 'kind' || k === 'met' || k === 'sort') { S[k] = v; S.shown = 30; if (k !== 'sort') lsSet(LS_UI, JSON.stringify({ per: S.per, kind: S.kind, met: S.met })); paint(); }
    else if (k === 'row') { S.open = v; paint(); }
    else if (k === 'close') { if (!el || el === ov.querySelector('.rk-sh') || el.classList.contains('rk-ib')) { S.open = null; paint(); } }
    else if (k === 'more') { S.shown += 40; paint(); }
    else if (k === 'refresh') { S.err = ''; S.board = null; paint(); refresh(); }
    else if (k === 'edit') { S.edit = !S.edit; paint(); }
    else if (k === 'join' || k === 'save') {
      var n = (ov.querySelector('#rk-name').value || '').replace(/\s+/g, ' ').trim().slice(0, 24), c = ov.querySelector('#rk-col');
      if (n.length < 2) { say('Please enter a name of at least 2 letters.', 'error'); return; }
      var m = { uid: uid(), n: n, showC: !!(c && c.checked), c: String((acct() || {}).college || '').slice(0, 40), at: (me() || {}).at || Date.now() };
      lsSet(LS_ME, JSON.stringify(m)); S.edit = false; lsSet(LS_SENT, null);
      try { await sync(true); say(k === 'join' ? '🏆 You are on the leaderboard' : 'Saved'); } catch (e) { say('Saved on this device. It will be sent when you are online.', 'error'); sched(15000); }
      refresh();
    }
    else if (k === 'leave') {
      if (!window.confirm('Leave the leaderboard? Your row is deleted for everyone. Your own results on this device stay.')) return;
      try { await jsend('sum/' + encodeURIComponent(uid()), 'DELETE'); } catch (e) { say('Could not reach the leaderboard to delete your row. Try again online.', 'error'); return; }
      lsSet(LS_ME, null); lsSet(LS_SENT, null); S.edit = false; refresh();
    }
    else if (k === 'rm') {
      if (!window.confirm('Remove this student from the leaderboard?')) return;
      try { await jsend('sum/' + encodeURIComponent(v), 'DELETE'); S.open = null; refresh(); } catch (e) { alert('Could not remove: ' + e.message); }
    }
    else if (k === 'clear') {
      if (!window.confirm('Delete EVERY row on the leaderboard? Students will reappear the next time their app syncs.')) return;
      try { await jsend('sum', 'DELETE'); refresh(); } catch (e) { alert('Could not clear: ' + e.message); }
    }
    else if (k === 'csv') csv();
  }
  function cell(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function csv() {
    var b = S.board || {}, hd = ['Name', 'Email', 'Mobile', 'College', 'City', 'Status', 'On leaderboard', 'Tests', 'Marks', 'Questions', 'Accuracy %', 'Streak', 'Last active'];
    var out = [hd.map(cell).join(',')];
    (S.users || []).forEach(function (u) { var e = b[String(u.id)], a = e && e.a; out.push([u.name, u.email, u.mobile, u.college, u.city, u.status, e ? 'yes' : 'no', a ? a.n[0] + a.c[0] : '', a ? a.n[1] + a.c[1] : '', a ? a.q[0] : '', a ? pct(a.q[1], a.q[0]) : '', e ? e.s : '', e && e.u ? new Date(e.u).toISOString() : ''].map(cell).join(',')); });
    var f = document.createElement('a'); f.href = URL.createObjectURL(new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv' })); f.download = 'studydeck_leaderboard_' + dk(0) + '.csv'; document.body.appendChild(f); f.click(); setTimeout(function () { URL.revokeObjectURL(f.href); f.remove(); }, 500);
  }
  function close() { if (!ov) return; document.removeEventListener('keydown', onKey, true); clearInterval(ov._iv); ov.remove(); ov = null; S.open = null; S.edit = false; }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); if (S.open) { S.open = null; paint(); } else close(); } }
  function open(o) {
    if (ov) close(); S.adm = !!(o && o.admin); S.shown = 30; S.q = ''; S.err = '';
    ov = document.createElement('div'); ov.id = 'sd-rank-ov'; ov.className = 'rk' + (S.adm ? ' adm' : ''); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Leaderboard');
    ov.innerHTML = '<div class="rk-top"><button class="rk-ib" data-a="x" aria-label="Back">‹</button><h2>' + (S.adm ? 'Student rankings' : 'Leaderboard') + '</h2><button class="rk-ib" data-a="refresh" aria-label="Refresh">↻</button></div><div class="rk-body" id="rk-body"></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { var t = e.target.closest('[data-a]'); if (!t) return; var a = t.getAttribute('data-a'); if (a === 'x') close(); else if (a !== 'noop') { if (a === 'close' && e.target.closest('.rk-shc') && !e.target.closest('.rk-ib')) return; act(a, t); } });
    ov.addEventListener('input', function (e) { if (e.target.id === 'rk-q') { S.q = e.target.value; S.shown = 30; var f = e.target.selectionStart; paint(); var i = ov.querySelector('#rk-q'); if (i) { i.focus(); try { i.setSelectionRange(f, f); } catch (_) { } } } });
    document.addEventListener('keydown', onKey, true);
    ov._iv = setInterval(function () { if (!S.edit && !S.open && document.visibilityState === 'visible') refresh(); }, 60000);
    paint(); ov.querySelector('.rk-ib').focus(); refresh();
  }
  window._sdRankOpen = open;
  window._sdRank = { local: local, rows: rows, sane: sane, sync: sync, fetchBoard: fetchBoard, state: S };

  /* ── 7. Where it is reached from: Home, Settings, and the admin panel ── */
  function setSettingsSub() { var s = document.getElementById('rk-set-sub'), m = me(); if (s) s.textContent = m && m.uid === uid() ? 'Sharing as ' + m.n : 'Not joined'; }
  function inject() {
    var done = 0;
    [['rk-home', '.sd-tabpanel[data-tab="progress"] > .home-sec-label', 'afterend'], ['rk-home2', '#shome .qa-tree-wide', 'afterend']].forEach(function (x) {
      var h = document.querySelector(x[1]);
      if (h && !document.getElementById(x[0])) {
        var b = document.createElement('button'); b.className = 'qa-card qa-tree-wide'; b.id = x[0]; b.setAttribute('onclick', '_sdRankOpen()');
        b.innerHTML = '<span class="qa-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg></span><div class="qa-tree-text"><span class="qa-lbl">Leaderboard</span><span class="qa-sub">Marks, ranks and daily performance of all students</span></div><span class="qa-arr">›</span>';
        h.insertAdjacentElement(x[2], b); done++;
      } else if (h) done++;
    });
    var anchor = document.getElementById('tog-autosort') || document.getElementById('tog-amoled') || document.getElementById('tog-motion'), row = anchor && anchor.closest('.set-row');
    if (row && !document.getElementById('rk-set-row')) {
      var n = document.createElement('div'); n.className = 'set-row'; n.id = 'rk-set-row';
      n.innerHTML = '<div style="flex:1 1 auto;min-width:0;padding-right:10px"><div class="sr-lbl">Leaderboard</div><div class="sr-sub" id="rk-set-sub">Not joined</div></div><button class="dp-fb sm" id="rk-set-open" style="flex:none;min-height:44px;min-width:64px">Open</button>';
      row.insertAdjacentElement('afterend', n); n.querySelector('button').addEventListener('click', function () { open(); }); setSettingsSub(); done++;
    } else if (row) done++;
    var tab = document.getElementById('sda-tab-s');
    if (tab && !document.getElementById('sda-tab-r')) { var t = document.createElement('button'); t.className = 'sda-tab'; t.id = 'sda-tab-r'; t.innerHTML = '<span class="sda-tab-ic">🏆</span>Rankings'; t.addEventListener('click', function () { open({ admin: true }); }); tab.insertAdjacentElement('afterend', t); done++; } else if (tab) done++;
    return done >= 4;
  }
  var nv = window.navTo;
  if (typeof nv === 'function') window.navTo = function () { var r = nv.apply(this, arguments); try { setSettingsSub(); setTimeout(inject, 120); } catch (e) { } return r; };
  if (!inject()) { var tries = 0, iv = setInterval(function () { if (inject() || ++tries > 60) clearInterval(iv); }, 500); }
})();
/* v48: "Sepia tone" for the question screen in the dark and true-black themes.
   The colours live in layouts.css (html[data-sepia="1"] re-points the colour variables for #qz-outer only). This file is just the switch: it reads and saves the choice
   (default: on), shows the row in Settings under "True black", and puts the default back when "Reset appearance" is pressed. */
(function () {
  'use strict';
  if (window.__sdSepia) return; window.__sdSepia = true;
  var root = document.documentElement;
  function saved() { try { var a = JSON.parse(localStorage.getItem('sd-appearance') || '{}') || {}; return a.sepia === false ? false : true; } catch (e) { return true; } }
  function apply(on) { if (on) root.setAttribute('data-sepia', '1'); else root.removeAttribute('data-sepia'); var cb = document.getElementById('tog-sepia'); if (cb) cb.checked = !!on; }
  function setSepia(on) {
    on = !!on; apply(on);
    try { if (typeof saveAppearancePref === 'function') saveAppearancePref('sepia', on); } catch (e) { }
  }
  window.setSepia = setSepia;
  apply(saved());
  function inject() {
    var a = document.getElementById('tog-amoled'), row = a && a.closest('.set-row');
    if (!row) return false;
    if (document.getElementById('tog-sepia')) return true;
    var n = document.createElement('div'); n.className = 'set-row'; n.id = 'sepia-row';
    n.innerHTML = '<div><div class="sr-lbl">Sepia tone</div><div class="sr-sub">Warm, low-glare question screen in dark themes</div></div><label class="tog"><input type="checkbox" id="tog-sepia"><span class="tsl"></span></label>';
    row.insertAdjacentElement('afterend', n);
    var cb = document.getElementById('tog-sepia'); cb.checked = root.getAttribute('data-sepia') === '1';
    cb.addEventListener('change', function () { setSepia(cb.checked); });
    return true;
  }
  var ra = window.resetAppearance;
  if (typeof ra === 'function') window.resetAppearance = function () { var r = ra.apply(this, arguments); try { setSepia(true); } catch (e) { } return r; };
  var nv = window.navTo;
  if (typeof nv === 'function') window.navTo = function () { var r = nv.apply(this, arguments); try { setTimeout(inject, 140); } catch (e) { } return r; };
  if (!inject()) { var tries = 0, iv = setInterval(function () { if (inject() || ++tries > 60) clearInterval(iv); }, 500); }
})();
