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
