/* Tickbox Tracker UI. Plain JavaScript, no framework. Pure rules live in core.js. */
(function () {
  'use strict';

  var C = window.TickboxCore;
  var $app = document.getElementById('app');
  var $layer = document.getElementById('layer');
  var $toast = document.getElementById('toast');
  var $dialog = document.getElementById('dialog');
  var $file = document.getElementById('file-input');

  var RESORT_DELAY = 1500;
  var SLIDE_MS = 300;
  var TOAST_MS = 5000;
  var UNDO_LIMIT = 50;

  // ================= Storage: one localStorage key per tracker, plus an index =================

  var INDEX_KEY = 'tickbox:index';
  var TRACKER_KEY = 'tickbox:tracker:';
  var memoryStore = {};
  var warnedStorage = false;

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return k in memoryStore ? memoryStore[k] : null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {
      memoryStore[k] = v;
      if (!warnedStorage) {
        warnedStorage = true;
        toast("Couldn't save on this device (storage is full or blocked). Changes last until you close the page.");
      }
    }
  }
  function lsDel(k) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    delete memoryStore[k];
  }

  var db = { ids: [], trackers: {} };

  function loadAll() {
    var raw = lsGet(INDEX_KEY);
    db.ids = [];
    db.trackers = {};
    if (raw === null) { seedSample(); return; }
    var idx = null;
    try { idx = JSON.parse(raw); } catch (e) { /* treat as empty */ }
    var ids = idx && Array.isArray(idx.trackers) ? idx.trackers : [];
    ids.forEach(function (id) {
      var t = readTracker(id);
      if (t && !db.trackers[id]) { db.ids.push(id); db.trackers[id] = t; }
    });
  }

  function readTracker(id) {
    var raw = lsGet(TRACKER_KEY + id);
    if (!raw) return null;
    try {
      var res = C.validateTracker(JSON.parse(raw));
      if (res.ok) { res.tracker.id = id; return res.tracker; }
    } catch (e) { /* unreadable */ }
    return null;
  }

  function saveIndex() { lsSet(INDEX_KEY, JSON.stringify({ schemaVersion: 1, trackers: db.ids })); }
  function saveTracker(t) { lsSet(TRACKER_KEY + t.id, JSON.stringify(t)); }

  function addTracker(t, at) {
    db.trackers[t.id] = t;
    if (at == null || at < 0 || at > db.ids.length) db.ids.push(t.id); else db.ids.splice(at, 0, t.id);
    saveTracker(t);
    saveIndex();
  }

  function removeTracker(id) {
    var i = db.ids.indexOf(id);
    if (i >= 0) db.ids.splice(i, 1);
    delete db.trackers[id];
    lsDel(TRACKER_KEY + id);
    saveIndex();
    return i;
  }

  function freshId(prefix, taken) {
    var id;
    do { id = C.newId(prefix); } while (taken(id));
    return id;
  }
  function newTrackerId() { return freshId('trk', function (id) { return !!db.trackers[id]; }); }
  function newRowId(t) { return freshId('row', function (id) { return t.rows.some(function (r) { return r.id === id; }); }); }
  function newColId(t) { return freshId('col', function (id) { return t.columns.some(function (c) { return c.id === id; }); }); }

  function seedSample() {
    var today = C.todayStr();
    var d = function (n) { return C.addDays(today, n); };
    var done = function (n) { return { state: 'done', due: null, doneOn: d(n), note: '' }; };
    var open = function (due) { return { state: 'open', due: due, doneOn: null, note: '' }; };
    addTracker({
      schemaVersion: 1,
      id: newTrackerId(),
      name: 'Sample: Market vendors',
      rowLabel: 'Vendor',
      settings: C.defaultSettings(),
      columns: [
        { id: 'col_1', name: 'Contract' },
        { id: 'col_2', name: 'Deposit' },
        { id: 'col_3', name: 'Stall plan' },
        { id: 'col_4', name: 'Final invoice' }
      ],
      rows: [
        { id: 'row_1', name: 'Alpha', note: '', manualOrder: 0,
          cells: { col_1: done(-9), col_2: done(-4), col_3: open(d(11)), col_4: open(d(21)) } },
        { id: 'row_2', name: 'Bravo', note: '', manualOrder: 1,
          cells: { col_1: done(-8), col_2: open(d(2)), col_3: { state: 'na', due: null, doneOn: null, note: '' }, col_4: open(d(21)) } },
        { id: 'row_3', name: 'Charlie', note: 'Sample data: delete this tracker whenever you like.', manualOrder: 2,
          cells: { col_1: done(-7), col_2: done(-5), col_3: done(-2), col_4: open(today) } },
        { id: 'row_4', name: 'Delta', note: '', manualOrder: 3,
          cells: { col_1: done(-12), col_2: done(-10), col_3: done(-6), col_4: done(-1) } }
      ]
    });
  }

  // ================= App state =================

  var state = {
    route: { view: 'home' },
    today: C.todayStr(),
    search: '',
    frozen: null,        // display order held still while a tick settles or a cell is edited
    lastDisplay: [],
    resortTimer: null,
    pendingResort: null,
    floating: null,
    undo: {},            // scope -> [{ label, run }]
    toastScope: null
  };

  function cur() { return state.route.view === 'grid' ? db.trackers[state.route.id] : null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function findRow(t, id) { for (var i = 0; i < t.rows.length; i++) if (t.rows[i].id === id) return t.rows[i]; return null; }
  function findCol(t, id) { for (var i = 0; i < t.columns.length; i++) if (t.columns[i].id === id) return t.columns[i]; return null; }
  function ensureCell(row, colId) {
    row.cells[colId] = C.normCell(row.cells[colId]);
    return row.cells[colId];
  }
  function trackerNames(exceptId) {
    return db.ids.filter(function (id) { return id !== exceptId; }).map(function (id) { return db.trackers[id].name; });
  }

  // ================= Undo =================

  function pushUndo(scope, label, run) {
    var stack = state.undo[scope] || (state.undo[scope] = []);
    stack.push({ label: label, run: run });
    if (stack.length > UNDO_LIMIT) stack.shift();
  }
  function trackerScope(t) { return 't:' + t.id; }
  function currentScope() { var t = cur(); return t ? trackerScope(t) : 'home'; }
  function lastUndo(scope) { var s = state.undo[scope]; return s && s.length ? s[s.length - 1] : null; }

  function undo(scope) {
    scope = scope || currentScope();
    var stack = state.undo[scope];
    if (!stack || !stack.length) return;
    var entry = stack.pop();
    closeFloating(false);
    hideToast();
    entry.run();
    toast('Undone: ' + entry.label);
  }

  /** Apply a change to a tracker with an undo snapshot, then save. */
  function mutate(t, label, fn) {
    var before = clone(t);
    fn(t);
    saveTracker(t);
    pushUndo(trackerScope(t), label, function () {
      db.trackers[before.id] = before;
      saveTracker(before);
      clearTimeout(state.resortTimer);
      state.frozen = null;
      renderAnimated();
    });
  }

  // ================= Small helpers =================

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lcFirst(s) { return s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s; }
  function reducedMotion() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function isSmall() { return window.matchMedia && matchMedia('(max-width: 640px)').matches; }
  function slug(s) { return (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tracker').slice(0, 60); }
  function joinNames(names) { return names.length <= 2 ? names.join(', ') : names[0] + ' +' + (names.length - 1) + ' more'; }

  var TICK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

  // ================= Routing =================

  function parseRoute() {
    var m = /^#\/t\/([\w-]+)/.exec(location.hash);
    if (m && db.trackers[m[1]]) return { view: 'grid', id: m[1] };
    return { view: 'home' };
  }

  function go(hash) {
    if (location.hash === hash) onRoute(); else location.hash = hash;
  }

  function onRoute() {
    var r = parseRoute();
    var changed = r.view !== state.route.view || r.id !== state.route.id;
    closeFloating(false);
    if (changed) {
      state.search = '';
      state.frozen = null;
      clearTimeout(state.resortTimer);
    }
    state.route = r;
    render();
    if (changed) window.scrollTo(0, 0);
  }

  // ================= Render =================

  function captureUi() {
    var snap = { focus: null, sel: null, values: {}, scroll: null };
    var a = document.activeElement;
    if (a && $app.contains(a) && a.dataset.fkey) {
      snap.focus = a.dataset.fkey;
      try { snap.sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* not a text input */ }
    }
    $app.querySelectorAll('input[data-fkey]').forEach(function (el) {
      if (el.type === 'text' || el.type === 'search') snap.values[el.dataset.fkey] = el.value;
    });
    var w = $app.querySelector('.grid-wrap');
    if (w) snap.scroll = [w.scrollTop, w.scrollLeft];
    return snap;
  }

  function restoreUi(snap) {
    Object.keys(snap.values).forEach(function (k) {
      var el = $app.querySelector('[data-fkey="' + k + '"]');
      if (el && k !== 'search') el.value = snap.values[k];
    });
    var w = $app.querySelector('.grid-wrap');
    if (w && snap.scroll) { w.scrollTop = snap.scroll[0]; w.scrollLeft = snap.scroll[1]; }
    if (snap.focus) {
      var el = $app.querySelector('[data-fkey="' + snap.focus + '"]');
      if (el) {
        el.focus({ preventScroll: true });
        if (snap.sel && snap.sel[0] != null) { try { el.setSelectionRange(snap.sel[0], snap.sel[1]); } catch (e) { /* ignore */ } }
      }
    }
  }

  function render() {
    var snap = captureUi();
    var t = cur();
    $app.innerHTML = t ? gridHtml(t) : homeHtml();
    document.title = t ? t.name + ' · Tickbox Tracker' : 'Trackers · Tickbox Tracker';
    restoreUi(snap);
  }

  function rowEls() { return $app.querySelectorAll('tr[data-row-id]'); }

  /** Re-render and slide rows from their old place to the new one. */
  function renderAnimated(followRowId) {
    var before = {};
    rowEls().forEach(function (tr) { before[tr.dataset.rowId] = tr.getBoundingClientRect().top; });
    render();
    if (!reducedMotion()) {
      var moved = [];
      rowEls().forEach(function (tr) {
        var old = before[tr.dataset.rowId];
        if (old == null) return;
        var dy = old - tr.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        tr.style.transition = 'none';
        tr.style.transform = 'translateY(' + dy + 'px)';
        moved.push(tr);
      });
      if (moved.length) {
        void $app.offsetHeight;
        moved.forEach(function (tr) {
          tr.style.transition = 'transform ' + SLIDE_MS + 'ms ease';
          tr.style.transform = '';
        });
        setTimeout(function () {
          moved.forEach(function (tr) { tr.style.transition = ''; });
        }, SLIDE_MS + 50);
      }
    }
    if (followRowId) scrollToRow(followRowId, false);
  }

  function scrollToRow(rowId, flash) {
    var wrap = $app.querySelector('.grid-wrap');
    var tr = $app.querySelector('tr[data-row-id="' + rowId + '"]');
    if (!wrap || !tr) return;
    var head = $app.querySelector('.grid thead');
    var headH = head ? head.offsetHeight : 0;
    var top = tr.offsetTop;
    var bottom = top + tr.offsetHeight;
    if (top - headH < wrap.scrollTop) wrap.scrollTop = Math.max(0, top - headH);
    else if (bottom > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = bottom - wrap.clientHeight;
    if (flash) {
      tr.classList.remove('flash');
      void tr.offsetWidth;
      tr.classList.add('flash');
    }
  }

  function focusKey(key) {
    var el = document.querySelector('[data-fkey="' + key + '"]');
    if (el) el.focus();
  }

  // ---------- Home ----------

  function countChips(c) {
    return '<span class="chip st-overdue' + (c.overdue ? '' : ' zero') + '">' + c.overdue + ' overdue</span>' +
      '<span class="chip st-today' + (c.today ? '' : ' zero') + '">' + c.today + ' due today</span>' +
      '<span class="chip st-soon' + (c.soon ? '' : ' zero') + '">' + c.soon + ' due soon</span>';
  }

  function homeHtml() {
    var u = lastUndo('home');
    var html = '<header class="bar"><h1>Trackers</h1><div class="bar-actions">' +
      '<button type="button" class="btn" data-act="undo" data-fkey="undo"' + (u ? ' title="Undo: ' + esc(u.label) + '"' : ' disabled') + '>Undo</button>' +
      '</div></header><main class="home">' +
      '<div class="home-actions">' +
      '<button type="button" class="btn primary" data-act="new-tracker" data-fkey="new">New tracker</button>' +
      '<button type="button" class="btn" data-act="import" data-fkey="import">Import</button>' +
      '<button type="button" class="btn" data-act="backup" data-fkey="backup"' + (db.ids.length ? '' : ' disabled') + '>Back up everything</button>' +
      '<button type="button" class="btn" data-act="restore" data-fkey="restore">Restore backup</button>' +
      '</div>';
    if (!db.ids.length) {
      html += '<div class="empty"><strong>No trackers yet</strong>Create your first tracker, or import a tracker file someone sent you.</div>';
    } else {
      html += '<ul class="tracker-list">';
      db.ids.forEach(function (id) {
        var t = db.trackers[id];
        var c = C.countStatuses(t, state.today);
        html += '<li class="tracker-item">' +
          '<a class="tracker-link" href="#/t/' + esc(id) + '" data-fkey="open:' + esc(id) + '">' +
          '<span class="tl-name">' + esc(t.name) + '</span>' +
          '<span class="tl-meta">' + t.rows.length + ' ' + esc(lcFirst(t.rowLabel)) + (t.rows.length === 1 ? '' : ' rows') +
          ' · ' + t.columns.length + (t.columns.length === 1 ? ' check' : ' checks') + '</span>' +
          '<span class="tl-counts">' + countChips(c) + '</span></a>' +
          '<button type="button" class="icon-btn" data-act="item-menu" data-id="' + esc(id) + '" data-fkey="menu:' + esc(id) + '" aria-haspopup="menu" aria-label="More for ' + esc(t.name) + '">⋯</button>' +
          '</li>';
      });
      html += '</ul>';
    }
    html += '<p class="home-foot">Your trackers are saved on this device only. Use “Back up everything” to keep a copy, and “Export tracker” or “Share template” to give one to someone else.</p></main>';
    return html;
  }

  // ---------- Grid ----------

  function displayList(t) {
    var sorted = C.sortRows(t, state.today);
    var infos = {};
    sorted.forEach(function (r) { infos[r.id] = C.analyzeRow(t, r, state.today); });
    var list;
    if (state.frozen) {
      var byId = {};
      sorted.forEach(function (r) { byId[r.id] = r; });
      list = [];
      state.frozen.forEach(function (f) {
        if (byId[f.id]) { list.push({ row: byId[f.id], group: f.group }); delete byId[f.id]; }
      });
      sorted.forEach(function (r) { if (byId[r.id]) list.push({ row: r, group: infos[r.id].group }); });
    } else {
      list = sorted.map(function (r) { return { row: r, group: infos[r.id].group }; });
    }
    return { list: list, infos: infos };
  }

  function gridHtml(t) {
    var auto = t.settings.autoSort;
    var dl = displayList(t);
    state.lastDisplay = dl.list.map(function (x) { return { id: x.row.id, group: x.group }; });
    var q = state.search.trim().toLowerCase();
    var hiddenComplete = 0;
    var visible = dl.list.filter(function (x) {
      if (q && x.row.name.toLowerCase().indexOf(q) < 0) return false;
      if (t.settings.hideComplete && x.group === 'complete') { hiddenComplete++; return false; }
      return true;
    });
    var counts = C.countStatuses(t, state.today);
    var u = lastUndo(trackerScope(t));
    var rowWord = lcFirst(t.rowLabel);

    var h = '<div class="grid-screen">';
    h += '<header class="bar">' +
      '<a class="icon-btn" href="#/" aria-label="All trackers" data-fkey="back">←</a>' +
      '<h1><button type="button" class="title-btn" data-act="rename-tracker" data-fkey="title" title="Rename tracker">' + esc(t.name) + '</button></h1>' +
      '<div class="bar-actions">' +
      '<button type="button" class="btn" data-act="undo" data-fkey="undo"' + (u ? ' title="Undo: ' + esc(u.label) + '"' : ' disabled') + '>Undo</button>' +
      '<button type="button" class="btn" data-act="tracker-menu" data-fkey="tmenu" aria-haspopup="menu">More</button>' +
      '</div></header>';
    h += '<div class="print-only print-head"><strong>' + esc(t.name) + '</strong><small>Printed ' + C.formatLong(state.today) +
      ' · ' + counts.overdue + ' overdue · ' + counts.today + ' due today · ' + counts.soon + ' due soon</small></div>';

    h += '<div class="summary" role="group" aria-label="Summary">' +
      summaryChip('overdue', counts.overdue, 'overdue') + '<span class="sep" aria-hidden="true">·</span>' +
      summaryChip('today', counts.today, 'due today') + '<span class="sep" aria-hidden="true">·</span>' +
      summaryChip('soon', counts.soon, 'due soon') + '</div>';

    h += '<div class="toolbar">' +
      '<input type="search" class="search" placeholder="Search ' + esc(rowWord) + ' names" aria-label="Search rows by name" data-fkey="search" value="' + esc(state.search) + '">' +
      '<label class="toggle"><input type="checkbox" data-change="autosort" data-fkey="autosort"' + (auto ? ' checked' : '') + '> Auto-sort by due date</label>' +
      '<label class="toggle"><input type="checkbox" data-change="hide" data-fkey="hide"' + (t.settings.hideComplete ? ' checked' : '') + '> Hide complete rows</label>' +
      '</div>';

    h += '<div class="grid-wrap"><table class="grid"><thead><tr>' +
      '<th scope="col" class="rowhead">' + esc(t.rowLabel) + '</th>';
    t.columns.forEach(function (col) {
      h += '<th scope="col" class="colhead" data-col="' + esc(col.id) + '"><div class="colhead-in">' +
        '<button type="button" class="grip" data-drag="col" data-id="' + esc(col.id) + '" data-fkey="cgrip:' + esc(col.id) + '" aria-label="Move column ' + esc(col.name) + ' (drag, or use left and right arrow keys)">⋯</button>' +
        '<button type="button" class="colname" data-act="col-menu" data-col="' + esc(col.id) + '" data-fkey="col:' + esc(col.id) + '" aria-haspopup="menu" title="' + esc(col.name) + '"><span class="clamp">' + esc(col.name) + '</span></button>' +
        '</div></th>';
    });
    h += '<th scope="col" class="addcol"><form class="inline-add" data-form="add-col">' +
      '<input type="text" data-fkey="add-col" placeholder="' + (t.columns.length ? 'Add column' : 'Add your first column') + '" aria-label="New column name" maxlength="80" autocomplete="off" enterkeyhint="done">' +
      '<button type="submit" class="btn small">Add</button></form></th>';
    h += '</tr></thead><tbody>';

    var span = t.columns.length + 1;
    if (!t.rows.length) {
      h += '<tr class="empty-row"><th scope="row" class="namecell" colspan="1"><strong>Add your first ' + esc(rowWord) + '</strong>Type a name in the box below.' +
        (t.columns.length ? '' : ' Add the checks each one needs at the right of the header.') + '</th><td colspan="' + span + '"></td></tr>';
    } else if (!visible.length) {
      h += '<tr class="empty-row"><th scope="row" class="namecell">' +
        (q ? 'No ' + esc(rowWord) + ' names match “' + esc(state.search.trim()) + '”.' : 'All rows are complete and hidden.') +
        '</th><td colspan="' + span + '"></td></tr>';
    }

    var shownCompleteHead = false;
    visible.forEach(function (x) {
      if (auto && x.group === 'complete' && !shownCompleteHead) {
        shownCompleteHead = true;
        h += '<tr class="group-head"><th scope="rowgroup">Complete</th><td colspan="' + span + '"></td></tr>';
      }
      h += rowHtml(t, x.row, dl.infos[x.row.id], x.group, auto);
    });
    if (hiddenComplete && visible.length) {
      h += '<tr class="empty-row no-print"><th scope="row" class="namecell">' + hiddenComplete +
        (hiddenComplete === 1 ? ' complete row hidden' : ' complete rows hidden') + '</th><td colspan="' + span + '"></td></tr>';
    }

    h += '<tr class="addrow"><th scope="row" class="namecell"><form class="inline-add" data-form="add-row">' +
      '<input type="text" data-fkey="add-row" placeholder="Add ' + esc(rowWord) + '" aria-label="New ' + esc(rowWord) + ' name" maxlength="120" autocomplete="off" enterkeyhint="done">' +
      '<button type="submit" class="btn small">Add</button></form></th><td colspan="' + span + '"></td></tr>';
    h += '</tbody></table></div></div>';
    return h;
  }

  function summaryChip(status, n, text) {
    return '<button type="button" class="chip st-' + status + (n ? '' : ' zero') + '" data-act="jump" data-status="' + status +
      '" data-fkey="jump:' + status + '"' + (n ? '' : ' disabled') + (n ? ' title="Go to the first row with this status"' : '') + '>' +
      n + ' ' + text + '</button>';
  }

  function rowHtml(t, row, info, group, auto) {
    var complete = info.group === 'complete';
    var badge = '';
    if (info.nextDue) {
      var names = info.drivingColIds.map(function (id) { return findCol(t, id).name; });
      var text = C.rowBadgeLabel(info.status, info.nextDue, state.today) + ' · ' + joinNames(names);
      badge = '<span class="badge st-' + info.status + '" title="' + esc(text) + '">' + esc(text) + '</span>';
    } else if (complete && t.columns.length) {
      badge = '<span class="badge st-complete">✓ Complete</span>';
    }
    var rid = esc(row.id);
    var h = '<tr data-row-id="' + rid + '" class="' + (complete ? 'is-complete' : '') + '">';
    h += '<th scope="row" class="namecell"><div class="namecell-in">';
    if (!auto) {
      h += '<button type="button" class="grip" data-drag="row" data-id="' + rid + '" data-fkey="rgrip:' + rid + '" aria-label="Move ' + esc(row.name) + ' (drag, or use up and down arrow keys)">⋮⋮</button>';
    }
    h += '<div class="name-main">' +
      '<button type="button" class="rowname" data-act="row-menu" data-row="' + rid + '" data-fkey="row:' + rid + '" aria-haspopup="menu">' + esc(row.name) + '</button>' +
      '<div class="row-sub"><span class="progress" aria-label="' + info.done + ' of ' + info.total + ' done">' + info.done + ' of ' + info.total + '</span>' + badge + '</div>' +
      (row.note ? '<div class="rownote" title="' + esc(row.note) + '">' + esc(row.note) + '</div>' : '') +
      '</div></div></th>';
    t.columns.forEach(function (col) { h += cellHtml(t, row, col, info); });
    h += '<td class="filler" aria-hidden="true"></td></tr>';
    return h;
  }

  function describeCell(st, c) {
    var d = c.due ? C.formatShort(c.due) : '';
    switch (st) {
      case 'overdue': return C.statusLabel(st, c.due, state.today) + ', was due ' + d;
      case 'today': return 'due today, ' + d;
      case 'soon': return 'due ' + C.statusLabel(st, c.due, state.today).toLowerCase() + ', ' + d;
      case 'later': return 'due ' + d;
      case 'done': return 'done' + (c.doneOn ? ' on ' + C.formatShort(c.doneOn) : '');
      case 'na': return 'not needed';
      default: return 'open, no due date';
    }
  }

  function cellHtml(t, row, col, info) {
    var c = C.normCell(row.cells[col.id]);
    var st = C.getCellStatus(c, state.today, t.settings.dueSoonDays);
    var driving = info.drivingColIds.indexOf(col.id) >= 0;
    var key = esc(row.id) + ':' + esc(col.id);
    var desc = describeCell(st, c) + (driving ? ', sets this row’s place' : '') + (c.note ? ', has a note' : '');
    var label = (st === 'overdue' || st === 'today' || st === 'soon') ? C.statusLabel(st, c.due, state.today) : '';
    var ptext = { done: 'Done', na: 'Not needed', open: 'Open', later: 'Due' }[st] || '';
    var h = '<td class="cell st-' + st + (driving ? ' driving' : '') + '" data-row="' + esc(row.id) + '" data-col="' + esc(col.id) + '">';
    if (c.note) h += '<span class="note-dot" aria-hidden="true" title="Has a note"></span>';
    h += '<div class="cell-in">' +
      '<button type="button" class="box" role="checkbox" aria-checked="' + (st === 'done') + '" data-act="toggle" data-fkey="box:' + key + '"' +
      ' aria-label="' + esc(col.name) + ' for ' + esc(row.name) + ': ' + esc(desc) + '">' +
      (st === 'done' ? TICK_SVG : st === 'na' ? DASH_SVG : '') + '</button>' +
      '<button type="button" class="cell-more" data-act="cell" data-fkey="more:' + key + '" aria-haspopup="dialog" aria-label="Due date and note for ' + esc(col.name) + ', ' + esc(row.name) + '">';
    if (st !== 'na' && c.due) h += '<span class="date">' + C.formatShort(c.due) + '</span>';
    else if (st !== 'na' && st !== 'done') h += '<span class="add-hint" aria-hidden="true">+ date</span>';
    if (label) h += '<span class="slabel">' + esc(label) + '</span>';
    if (ptext) h += '<span class="ptext">' + ptext + '</span>';
    h += '</button></div></td>';
    return h;
  }

  // ================= Re-sorting =================

  function freeze() { if (!state.frozen) state.frozen = state.lastDisplay.slice(); }

  function scheduleResort(rowId) {
    clearTimeout(state.resortTimer);
    state.resortTimer = setTimeout(function () { resortNow(rowId); }, RESORT_DELAY);
  }

  function resortNow(rowId) {
    clearTimeout(state.resortTimer);
    state.resortTimer = null;
    if (state.floating && state.floating.holdsOrder) { state.pendingResort = rowId || state.pendingResort || true; return; }
    state.frozen = null;
    if (cur()) renderAnimated(typeof rowId === 'string' ? rowId : null);
    else render();
  }

  // ================= Floating layer (popovers, menus, bottom sheets) =================

  function openFloating(html, anchor, opts) {
    closeFloating(false);
    var sheet = opts.sheet && isSmall();
    $layer.className = sheet ? 'sheet-mode' : '';
    $layer.innerHTML = '<div class="scrim" data-scrim></div><div class="floating ' + (opts.cls || '') + '" role="' + (opts.role || 'dialog') + '"' +
      (opts.role === 'menu' ? '' : ' aria-modal="true"') + ' aria-label="' + esc(opts.label || '') + '" tabindex="-1">' + html + '</div>';
    var fl = $layer.querySelector('.floating');
    if (!sheet && anchor) placeNear(fl, anchor);
    state.floating = { el: fl, holdsOrder: !!opts.holdsOrder, returnKey: opts.returnKey, onClose: opts.onClose };
    var first = opts.focus ? fl.querySelector(opts.focus) : fl.querySelector('button:not([disabled]), input, textarea');
    (first || fl).focus({ preventScroll: true });
    return fl;
  }

  function placeNear(fl, anchor) {
    var r = anchor.getBoundingClientRect();
    var w = fl.offsetWidth, h = fl.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(8, r.left), vw - w - 8);
    var top = r.bottom + 6;
    if (top + h > vh - 8) top = r.top - h - 6 >= 8 ? r.top - h - 6 : Math.max(8, vh - h - 8);
    fl.style.left = Math.max(8, left) + 'px';
    fl.style.top = top + 'px';
  }

  function closeFloating(restoreFocus) {
    var f = state.floating;
    if (!f) return;
    state.floating = null;
    $layer.innerHTML = '';
    $layer.className = '';
    if (f.onClose) f.onClose();
    if (restoreFocus !== false && f.returnKey) focusKey(f.returnKey);
    if (state.pendingResort) {
      var id = state.pendingResort;
      state.pendingResort = null;
      resortNow(id);
    }
  }

  $layer.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-scrim')) closeFloating();
  });

  $layer.addEventListener('keydown', function (e) {
    if (!state.floating) return;
    if (e.key === 'Escape') { e.preventDefault(); closeFloating(); return; }
    var fl = state.floating.el;
    if (e.key === 'Tab') {
      var items = Array.prototype.filter.call(fl.querySelectorAll('button, input, textarea, [tabindex="0"]'), function (el) {
        return !el.disabled && el.offsetParent !== null && el.tabIndex >= 0;
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (fl.classList.contains('menu') && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End')) {
      var mi = Array.prototype.slice.call(fl.querySelectorAll('.menu-item:not([disabled])'));
      var i = mi.indexOf(document.activeElement);
      e.preventDefault();
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = mi.length - 1;
      else i = (i + (e.key === 'ArrowDown' ? 1 : -1) + mi.length) % mi.length;
      mi[i].focus();
    }
  });

  window.addEventListener('resize', function () {
    if (state.floating && state.floating.el.classList.contains('menu')) closeFloating(false);
  });

  // ---------- Menus ----------

  function openMenu(anchor, titleHtml, items, returnKey) {
    var h = titleHtml ? '<div class="menu-title">' + titleHtml + '</div>' : '';
    items.forEach(function (it, i) {
      if (it === '-') { h += '<div class="menu-sep" role="separator"></div>'; return; }
      h += '<button type="button" role="menuitem" class="menu-item' + (it.danger ? ' danger' : '') + '" data-mi="' + i + '"' +
        (it.disabled ? ' disabled' : '') + '>' + esc(it.label) + '</button>';
    });
    var fl = openFloating(h, anchor, { cls: 'menu', role: 'menu', sheet: true, returnKey: returnKey, label: 'Menu' });
    fl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mi]');
      if (!b) return;
      var it = items[+b.dataset.mi];
      closeFloating(!it.keepFocusAway);
      it.run();
    });
  }

  // ---------- Calendar (week starts on Monday) ----------

  function Calendar(container, opts) {
    var selected = opts.selected || null;
    var focusDate = selected || state.today;
    var view = focusDate.slice(0, 7);

    function draw(focus) {
      var y = +view.slice(0, 4), m = +view.slice(5, 7) - 1;
      var first = view + '-01';
      var dow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
      var dim = C.daysInMonth(y, m);
      var weeks = Math.ceil((dow + dim) / 7);
      var start = C.addDays(first, -dow);
      if (focusDate.slice(0, 7) !== view) focusDate = first;
      var h = '<div class="cal-head"><button type="button" class="icon-btn" data-cal-nav="-1" aria-label="Previous month">‹</button>' +
        '<span class="cal-title" aria-live="polite">' + C.MONTHS_LONG[m] + ' ' + y + '</span>' +
        '<button type="button" class="icon-btn" data-cal-nav="1" aria-label="Next month">›</button></div>' +
        '<table role="grid" aria-label="' + C.MONTHS_LONG[m] + ' ' + y + '"><thead><tr>';
      ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(function (d, i) {
        h += '<th scope="col" abbr="' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i] + '">' + d + '</th>';
      });
      h += '</tr></thead><tbody>';
      for (var w = 0; w < weeks; w++) {
        h += '<tr>';
        for (var d = 0; d < 7; d++) {
          var ds = C.addDays(start, w * 7 + d);
          var other = ds.slice(0, 7) !== view;
          var cls = 'cal-day' + (other ? ' other' : '') + (ds === state.today ? ' is-today' : '') + (ds === selected ? ' is-selected' : '');
          h += '<td><button type="button" class="' + cls + '" data-cal-date="' + ds + '" tabindex="' + (ds === focusDate ? '0' : '-1') + '"' +
            ' aria-label="' + C.formatLong(ds) + (ds === state.today ? ', today' : '') + '"' +
            (ds === selected ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + +ds.slice(8) + '</button></td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table><div class="cal-foot">' +
        '<button type="button" class="btn small" data-cal-date="' + state.today + '">Today</button>' +
        '<button type="button" class="btn small" data-cal-date="' + C.addDays(state.today, 1) + '">Tomorrow</button>' +
        '<button type="button" class="btn small" data-cal-date="' + C.addDays(state.today, 7) + '">In a week</button>' +
        '</div>';
      container.innerHTML = h;
      if (focus) {
        var b = container.querySelector('.cal-day[data-cal-date="' + focusDate + '"]');
        if (b) b.focus();
      }
    }

    container.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cal-date]');
      if (b) {
        selected = b.dataset.calDate;
        focusDate = selected;
        view = selected.slice(0, 7);
        var wasDay = b.classList.contains('cal-day');
        draw(wasDay);
        opts.onPick(selected);
        return;
      }
      var n = e.target.closest('[data-cal-nav]');
      if (n) {
        view = shiftMonth(view, +n.dataset.calNav);
        draw(false);
      }
    });

    container.addEventListener('keydown', function (e) {
      var b = e.target.closest('.cal-day');
      if (!b) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      var ds = b.dataset.calDate;
      if (step) focusDate = C.addDays(ds, step);
      else if (e.key === 'PageUp' || e.key === 'PageDown') {
        var p = C.parseDate(ds);
        var nv = shiftMonth(ds.slice(0, 7), e.key === 'PageUp' ? -1 : 1);
        var maxD = C.daysInMonth(+nv.slice(0, 4), +nv.slice(5, 7) - 1);
        focusDate = nv + '-' + (Math.min(p.d, maxD) < 10 ? '0' : '') + Math.min(p.d, maxD);
      } else if (e.key === 'Home') focusDate = C.addDays(ds, -((new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8))).getUTCDay() + 6) % 7));
      else if (e.key === 'End') focusDate = C.addDays(ds, 6 - ((new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8))).getUTCDay() + 6) % 7));
      else return;
      e.preventDefault();
      view = focusDate.slice(0, 7);
      draw(true);
    });

    draw(false);
    return {
      set: function (v) {
        selected = v;
        if (v) { focusDate = v; view = v.slice(0, 7); }
        draw(false);
      }
    };
  }

  function shiftMonth(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + (m < 9 ? '0' : '') + (m + 1);
  }

  // ---------- Cell popover ----------

  function openCellPopover(rowId, colId) {
    var t = cur();
    var row = t && findRow(t, rowId), col = t && findCol(t, colId);
    if (!row || !col) return;
    var anchor = $app.querySelector('td.cell[data-row="' + rowId + '"][data-col="' + colId + '"]');
    freeze();
    var before = clone(t);
    var changed = false;
    var c0 = C.normCell(row.cells[colId]);

    var h = '<div class="pop-head"><h2>' + esc(col.name) + '<small>' + esc(row.name) + '</small></h2>' +
      '<button type="button" class="icon-btn" data-pop="close" aria-label="Close">×</button></div>' +
      '<div class="pop-row"><span class="pop-status" data-pop-status></span></div>' +
      '<div class="pop-row"><span>Due: <span class="pop-due" data-pop-due></span></span>' +
      '<button type="button" class="btn small" data-pop="clear">Clear date</button></div>' +
      '<div data-pop-cal class="cal"></div>' +
      '<label class="check-line"><input type="checkbox" data-pop="na"' + (c0.state === 'na' ? ' checked' : '') + '> Not needed</label>' +
      '<label class="field" style="margin:8px 0 0"><span>Note</span><textarea data-pop="note" maxlength="500" rows="2" placeholder="Optional short note">' + esc(c0.note) + '</textarea></label>';

    var fl = openFloating(h, anchor, {
      cls: 'cell-pop', sheet: true, holdsOrder: true, label: col.name + ', ' + row.name,
      returnKey: 'box:' + rowId + ':' + colId, focus: '.cal-day[tabindex="0"]',
      onClose: function () {
        if (changed) {
          var label = 'Edited ' + col.name + ' · ' + row.name;
          pushUndo(trackerScope(t), label, function () {
            db.trackers[before.id] = before;
            saveTracker(before);
            state.frozen = null;
            renderAnimated();
          });
          state.pendingResort = state.pendingResort || rowId;
        }
      }
    });

    function refresh() {
      var t2 = db.trackers[t.id];
      var r2 = t2 && findRow(t2, rowId);
      if (!r2) return;
      var c = C.normCell(r2.cells[colId]);
      var st = C.getCellStatus(c, state.today, t2.settings.dueSoonDays);
      fl.querySelector('[data-pop-status]').textContent = 'Status: ' +
        (st === 'done' ? 'Done' + (c.doneOn ? ' on ' + C.formatShort(c.doneOn) : '') : st === 'na' ? 'Not needed' :
          st === 'open' ? 'Open' : 'Open, ' + (C.statusLabel(st, c.due, state.today) || 'due later').toLowerCase());
      fl.querySelector('[data-pop-due]').textContent = c.due ? C.formatLong(c.due) : 'No date';
      fl.querySelector('[data-pop="clear"]').disabled = !c.due;
    }

    function apply(fn) {
      var t2 = db.trackers[t.id];
      var r2 = t2 && findRow(t2, rowId);
      if (!r2) return;
      fn(ensureCell(r2, colId));
      changed = true;
      saveTracker(t2);
      render();
      refresh();
    }

    var cal = Calendar(fl.querySelector('[data-pop-cal]'), {
      selected: c0.due,
      onPick: function (d) { apply(function (c) { c.due = d; }); }
    });
    refresh();
    if (!isSmall() && anchor) placeNear(fl, anchor); // re-place now the calendar has its full height
    if (state.floating) { var f = fl.querySelector('.cal-day[tabindex="0"]'); if (f) f.focus({ preventScroll: true }); }

    fl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pop]');
      if (!b) return;
      if (b.dataset.pop === 'close') closeFloating();
      if (b.dataset.pop === 'clear') { apply(function (c) { c.due = null; }); cal.set(null); }
    });
    fl.addEventListener('change', function (e) {
      if (e.target.dataset.pop === 'na') {
        var on = e.target.checked;
        apply(function (c) { c.state = on ? 'na' : 'open'; c.doneOn = null; });
      }
    });
    fl.addEventListener('input', function (e) {
      if (e.target.dataset.pop === 'note') {
        var v = e.target.value;
        apply(function (c) { c.note = v; });
      }
    });
  }

  // ================= Dialogs =================

  var dialogHandler = null;

  function openDialog(html, onSubmit, opts) {
    opts = opts || {};
    $dialog.innerHTML = '<form method="dialog" novalidate>' + html + '</form>';
    dialogHandler = onSubmit;
    if (typeof $dialog.showModal === 'function') { if (!$dialog.open) $dialog.showModal(); }
    else $dialog.setAttribute('open', '');
    var f = $dialog.querySelector(opts.focus || 'input, textarea, button[type="submit"]');
    if (f) { f.focus(); if (f.select && f.type === 'text') f.select(); }
    return $dialog.querySelector('form');
  }

  function closeDialog() {
    dialogHandler = null;
    if ($dialog.open) { if (typeof $dialog.close === 'function') $dialog.close(); else $dialog.removeAttribute('open'); }
  }

  $dialog.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!dialogHandler) { closeDialog(); return; }
    var res = dialogHandler(e.target);
    if (res !== false) closeDialog();
  });
  $dialog.addEventListener('click', function (e) {
    if (e.target.closest('[data-dialog-cancel]')) closeDialog();
    else if (e.target === $dialog) closeDialog(); // backdrop
  });
  $dialog.addEventListener('close', function () { dialogHandler = null; });

  function actions(okLabel, danger) {
    return '<div class="dialog-actions"><button type="button" class="btn" data-dialog-cancel>Cancel</button>' +
      '<button type="submit" class="btn ' + (danger ? 'danger' : 'primary') + '">' + esc(okLabel) + '</button></div>';
  }

  function showError(form, msg) {
    var el = form.querySelector('[data-error]');
    if (el) { el.textContent = msg; el.hidden = false; }
    return false;
  }

  function askText(o, cb) {
    var h = '<h2 id="dialog-title">' + esc(o.title) + '</h2>' +
      '<label class="field"><span>' + esc(o.label) + '</span>' +
      (o.multiline
        ? '<textarea name="v" maxlength="' + (o.max || 500) + '" placeholder="' + esc(o.placeholder || '') + '">' + esc(o.value || '') + '</textarea>'
        : '<input type="text" name="v" maxlength="' + (o.max || 120) + '" value="' + esc(o.value || '') + '" autocomplete="off" placeholder="' + esc(o.placeholder || '') + '">') +
      '</label><p class="error-text" data-error hidden></p>' + actions(o.ok || 'Save');
    openDialog(h, function (form) {
      var v = form.elements.v.value.trim();
      if (o.required !== false && !v) return showError(form, 'Please enter a name.');
      cb(v);
    });
  }

  function askConfirm(o, cb) {
    openDialog('<h2 id="dialog-title">' + esc(o.title) + '</h2><p>' + esc(o.message) + '</p>' + actions(o.ok || 'OK', o.danger),
      function () { cb(); }, { focus: '[data-dialog-cancel]' });
  }

  function showMessage(title, message) {
    openDialog('<h2 id="dialog-title">' + esc(title) + '</h2><p>' + esc(message) + '</p>' +
      '<div class="dialog-actions"><button type="submit" class="btn primary">OK</button></div>', function () { });
  }

  function askDate(title, hint, cb) {
    var picked = null;
    var form = openDialog('<h2 id="dialog-title">' + esc(title) + '</h2><p>' + esc(hint) + '</p>' +
      '<div class="cal" data-dcal></div><p><strong data-dpicked>No date picked</strong></p>' +
      '<p class="error-text" data-error hidden></p>' + actions('Set date'), function (f) {
      if (!picked) return showError(f, 'Pick a date first.');
      cb(picked);
    }, { focus: '.cal-day[tabindex="0"]' });
    Calendar(form.querySelector('[data-dcal]'), {
      selected: null,
      onPick: function (d) { picked = d; form.querySelector('[data-dpicked]').textContent = 'Due ' + C.formatLong(d); }
    });
    var f = form.querySelector('.cal-day[tabindex="0"]');
    if (f) f.focus();
  }

  function trackerForm(o, cb) {
    var h = '<h2 id="dialog-title">' + esc(o.title) + '</h2>' +
      '<label class="field"><span>Tracker name</span><input type="text" name="name" maxlength="80" autocomplete="off" value="' + esc(o.name || '') + '" placeholder="e.g. Monthly billing"></label>' +
      '<label class="field"><span>What is each row?</span><input type="text" name="rowLabel" maxlength="40" autocomplete="off" value="' + esc(o.rowLabel || '') + '" placeholder="e.g. Client, Task, Vendor"><small>Used as the heading of the first column.</small></label>';
    if (o.isNew) {
      h += '<label class="field"><span>First checks (columns)</span><textarea name="columns" placeholder="One per line, e.g.\nContract\nDeposit\nFinal invoice"></textarea><small>One per line. You can add, rename and reorder them later.</small></label>';
    } else {
      h += '<label class="field"><span>“Due soon” window (days)</span><input type="number" name="soon" min="0" max="14" step="1" inputmode="numeric" value="' + o.soon + '"><small>Open cells due within this many days get a pale yellow highlight. 0 to 14.</small></label>';
    }
    h += '<p class="error-text" data-error hidden></p>' + actions(o.isNew ? 'Create tracker' : 'Save');
    openDialog(h, function (form) {
      var name = form.elements.name.value.trim();
      if (!name) return showError(form, 'Please give the tracker a name.');
      var out = { name: name, rowLabel: form.elements.rowLabel.value.trim() || 'Item' };
      if (o.isNew) {
        out.columns = form.elements.columns.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      } else {
        var n = Number(form.elements.soon.value);
        if (form.elements.soon.value === '' || !isFinite(n) || n < 0 || n > 14 || Math.round(n) !== n) return showError(form, 'The due soon window must be a whole number from 0 to 14.');
        out.soon = n;
      }
      cb(out);
    });
  }

  // ================= Toast =================

  var toastTimer = null;
  function toast(msg, undoScope) {
    clearTimeout(toastTimer);
    state.toastScope = undoScope || null;
    $toast.innerHTML = '<span>' + esc(msg) + '</span>' + (undoScope ? '<button type="button" class="btn small" data-toast-undo>Undo</button>' : '');
    $toast.hidden = false;
    toastTimer = setTimeout(hideToast, undoScope ? TOAST_MS : 3000);
  }
  function hideToast() { clearTimeout(toastTimer); $toast.hidden = true; state.toastScope = null; }
  $toast.addEventListener('click', function (e) {
    if (e.target.closest('[data-toast-undo]')) {
      var scope = state.toastScope;
      hideToast();
      undo(scope);
    }
  });

  // ================= Files: export, template, backup, import =================

  function download(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function exportTracker(t) { download(slug(t.name) + '.tracker.json', t); toast('Exported “' + t.name + '”'); }
  function exportTemplate(t) { download(slug(t.name) + '.template.json', C.makeTemplate(t)); toast('Template downloaded for “' + t.name + '”'); }
  function backupAll() {
    download('tickbox-backup-' + state.today + '.json', {
      kind: 'tickbox-backup',
      schemaVersion: C.SCHEMA_VERSION,
      exportedOn: state.today,
      trackers: db.ids.map(function (id) { return db.trackers[id]; })
    });
    toast('Backed up ' + db.ids.length + (db.ids.length === 1 ? ' tracker' : ' trackers'));
  }

  function pickFile(cb) {
    $file.value = '';
    $file.onchange = function () {
      var f = $file.files && $file.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { cb(f.name, String(r.result)); };
      r.onerror = function () { showMessage("Couldn't import", 'The file “' + f.name + '” could not be read.'); };
      r.readAsText(f);
    };
    $file.click();
  }

  function importText(fileName, text) {
    var title = "Couldn't import “" + fileName + '”';
    var obj;
    try { obj = JSON.parse(text); } catch (e) {
      showMessage(title, "This isn't a tracker file. It could not be read as a tracker or backup.");
      return;
    }
    var list;
    if (obj && typeof obj === 'object' && obj.kind === 'tickbox-backup') {
      if (!Array.isArray(obj.trackers)) { showMessage(title, 'This backup file has no trackers in it.'); return; }
      list = obj.trackers;
    } else list = [obj];
    var results = list.map(C.validateTracker);
    for (var i = 0; i < results.length; i++) {
      if (!results[i].ok) {
        showMessage(title, (list.length > 1 ? 'Tracker ' + (i + 1) + ': ' : '') + results[i].error);
        return;
      }
    }
    var added = [];
    results.forEach(function (r) {
      var t = r.tracker;
      t.id = newTrackerId();
      t.name = C.importName(t.name, trackerNames());
      addTracker(t);
      added.push(t.id);
    });
    pushUndo('home', list.length === 1 ? 'Import of “' + results[0].tracker.name + '”' : 'Restore of ' + added.length + ' trackers', function () {
      added.forEach(removeTracker);
      go('#/');
    });
    if (added.length === 1) {
      var t = db.trackers[added[0]];
      go('#/t/' + t.id);
      toast('Imported “' + t.name + '”' + (t.rows.length ? '' : ' (template, no rows yet)'));
    } else {
      go('#/');
      render();
      toast(added.length ? 'Restored ' + added.length + ' trackers' : 'The backup was empty', added.length ? 'home' : null);
    }
  }

  // ================= Tracker actions =================

  function newTracker() {
    trackerForm({ title: 'New tracker', isNew: true }, function (v) {
      var t = {
        schemaVersion: 1, id: newTrackerId(), name: v.name, rowLabel: v.rowLabel,
        settings: C.defaultSettings(), columns: [], rows: []
      };
      v.columns.forEach(function (name) { t.columns.push({ id: newColId(t), name: name.slice(0, 80) }); });
      addTracker(t);
      pushUndo('home', 'New tracker “' + t.name + '”', function () { removeTracker(t.id); go('#/'); render(); });
      go('#/t/' + t.id);
      setTimeout(function () { focusKey('add-row'); }, 60);
    });
  }

  function renameTracker(t) {
    askText({ title: 'Rename tracker', label: 'Tracker name', value: t.name, max: 80 }, function (v) {
      if (v === t.name) return;
      if (state.route.view === 'grid') { mutate(t, 'Rename tracker', function () { t.name = v; }); render(); }
      else {
        var old = t.name;
        t.name = v;
        saveTracker(t);
        pushUndo('home', 'Rename to “' + v + '”', function () { var x = db.trackers[t.id]; if (x) { x.name = old; saveTracker(x); } render(); });
        render();
      }
    });
  }

  function duplicateTracker(t) {
    var copy = clone(t);
    copy.id = newTrackerId();
    copy.name = C.importName(t.name + ' (copy)', trackerNames());
    addTracker(copy, db.ids.indexOf(t.id) + 1);
    pushUndo('home', 'Duplicate of “' + t.name + '”', function () { removeTracker(copy.id); go('#/'); render(); });
    go('#/t/' + copy.id);
    toast('Made a copy: “' + copy.name + '”');
  }

  function deleteTracker(t) {
    askConfirm({
      title: 'Delete “' + t.name + '”?',
      message: 'This removes the tracker and all its rows, ticks, dates and notes from this device.',
      ok: 'Delete tracker', danger: true
    }, function () {
      var snapshot = clone(t);
      var at = removeTracker(t.id);
      pushUndo('home', 'Delete of “' + t.name + '”', function () { addTracker(snapshot, at); render(); });
      go('#/');
      render();
      toast('Deleted “' + t.name + '”', 'home');
    });
  }

  function trackerSettings(t) {
    trackerForm({ title: 'Tracker settings', name: t.name, rowLabel: t.rowLabel, soon: t.settings.dueSoonDays }, function (v) {
      mutate(t, 'Tracker settings', function () {
        t.name = v.name;
        t.rowLabel = v.rowLabel;
        t.settings.dueSoonDays = C.clampSoon(v.soon);
      });
      state.frozen = null;
      renderAnimated();
    });
  }

  function trackerMenuItems(t, fromHome) {
    var items = [];
    if (fromHome) items.push({ label: 'Open', run: function () { go('#/t/' + t.id); } });
    else items.push({ label: 'Tracker settings…', run: function () { trackerSettings(t); } });
    items.push({ label: 'Rename…', run: function () { renameTracker(t); } });
    items.push({ label: 'Duplicate', run: function () { duplicateTracker(t); } });
    if (!fromHome) items.push({ label: 'Print…', run: function () { setTimeout(function () { window.print(); }, 50); } });
    items.push('-');
    items.push({ label: 'Export tracker (full copy)', run: function () { exportTracker(t); } });
    items.push({ label: 'Share template (no rows)', run: function () { exportTemplate(t); } });
    items.push('-');
    items.push({ label: 'Delete tracker…', danger: true, run: function () { deleteTracker(t); } });
    return items;
  }

  // ================= Row and column actions =================

  function manualRows(t) {
    return t.rows.slice().sort(function (a, b) { return a.manualOrder - b.manualOrder; });
  }
  function renumber(rows) { rows.forEach(function (r, i) { r.manualOrder = i; }); }

  function addRow(t, name) {
    var row = null;
    mutate(t, 'Add ' + lcFirst(t.rowLabel) + ' “' + name + '”', function () {
      var max = t.rows.reduce(function (m, r) { return Math.max(m, r.manualOrder); }, -1);
      row = { id: newRowId(t), name: name, note: '', manualOrder: max + 1, cells: {} };
      t.rows.push(row);
    });
    state.frozen = null;
    render();
    var tr = $app.querySelector('tr.addrow');
    if (tr) tr.scrollIntoView({ block: 'nearest' });
  }

  function addColumn(t, name) {
    mutate(t, 'Add column “' + name + '”', function () { t.columns.push({ id: newColId(t), name: name }); });
    state.frozen = null;
    render();
    var w = $app.querySelector('.grid-wrap');
    if (w) w.scrollLeft = w.scrollWidth;
  }

  function moveRowManual(t, rowId, targetId, after) {
    var rows = manualRows(t);
    var src = rows.filter(function (r) { return r.id === rowId; })[0];
    if (!src || rowId === targetId) return;
    mutate(t, 'Move ' + src.name, function () {
      rows.splice(rows.indexOf(src), 1);
      var ti = rows.findIndex(function (r) { return r.id === targetId; });
      rows.splice(ti < 0 ? rows.length : ti + (after ? 1 : 0), 0, src);
      renumber(rows);
    });
    render();
  }

  function stepRow(t, rowId, dir) {
    var rows = manualRows(t);
    var i = rows.findIndex(function (r) { return r.id === rowId; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    moveRowManual(t, rowId, rows[j].id, dir > 0);
  }

  function moveColumn(t, colId, targetId, after) {
    var cols = t.columns;
    var src = findCol(t, colId);
    if (!src || colId === targetId) return;
    mutate(t, 'Move column ' + src.name, function () {
      cols.splice(cols.indexOf(src), 1);
      var ti = cols.findIndex(function (c) { return c.id === targetId; });
      cols.splice(ti < 0 ? cols.length : ti + (after ? 1 : 0), 0, src);
    });
    render();
  }

  function stepColumn(t, colId, dir) {
    var i = t.columns.findIndex(function (c) { return c.id === colId; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= t.columns.length) return;
    moveColumn(t, colId, t.columns[j].id, dir > 0);
  }

  function setDueForOpen(t, label, cellsFn, date) {
    var n = 0;
    mutate(t, label, function () {
      cellsFn().forEach(function (pair) {
        var c = ensureCell(pair[0], pair[1]);
        if (c.state === 'open') { c.due = date; n++; }
      });
    });
    state.frozen = null;
    renderAnimated();
    toast('Set ' + n + (n === 1 ? ' open cell' : ' open cells') + ' due ' + C.formatShort(date), trackerScope(t));
  }

  function rowMenu(t, rowId, anchor) {
    var row = findRow(t, rowId);
    if (!row) return;
    var auto = t.settings.autoSort;
    var rows = manualRows(t);
    var idx = rows.indexOf(row);
    var items = [
      { label: 'Rename…', run: function () {
        askText({ title: 'Rename ' + lcFirst(t.rowLabel), label: 'Name', value: row.name }, function (v) {
          mutate(t, 'Rename ' + row.name, function () { findRow(t, rowId).name = v; });
          render();
        });
      } },
      { label: row.note ? 'Edit note…' : 'Add note…', run: function () {
        askText({ title: 'Note for ' + row.name, label: 'Note', value: row.note, multiline: true, required: false, max: 500 }, function (v) {
          mutate(t, 'Note on ' + row.name, function () { findRow(t, rowId).note = v; });
          render();
        });
      } },
      { label: 'Set due date for all open cells…', disabled: !t.columns.length, run: function () {
        askDate('Due date for ' + row.name, 'Sets this date on every open cell in the row. Done and Not needed cells are left alone.', function (d) {
          setDueForOpen(t, 'Due dates for ' + row.name, function () {
            var r = findRow(t, rowId);
            return t.columns.map(function (c) { return [r, c.id]; });
          }, d);
        });
      } }
    ];
    if (!auto) {
      items.push({ label: 'Move up', disabled: idx <= 0, run: function () { stepRow(t, rowId, -1); focusKey('row:' + rowId); } });
      items.push({ label: 'Move down', disabled: idx >= rows.length - 1, run: function () { stepRow(t, rowId, 1); focusKey('row:' + rowId); } });
    }
    items.push('-');
    items.push({ label: 'Delete ' + lcFirst(t.rowLabel), danger: true, run: function () {
      mutate(t, 'Delete ' + row.name, function () { t.rows = t.rows.filter(function (r) { return r.id !== rowId; }); });
      state.frozen = null;
      renderAnimated();
      toast('Deleted “' + row.name + '”', trackerScope(t));
    } });
    var title = '<strong>' + esc(row.name) + '</strong>' + (row.note ? esc(row.note) : '');
    openMenu(anchor, title, items, 'row:' + rowId);
  }

  function colMenu(t, colId, anchor) {
    var col = findCol(t, colId);
    if (!col) return;
    var i = t.columns.indexOf(col);
    openMenu(anchor, '<strong>' + esc(col.name) + '</strong>', [
      { label: 'Rename…', run: function () {
        askText({ title: 'Rename column', label: 'Column name', value: col.name, max: 80 }, function (v) {
          mutate(t, 'Rename column ' + col.name, function () { findCol(t, colId).name = v; });
          render();
        });
      } },
      { label: 'Set due date for all open cells…', disabled: !t.rows.length, run: function () {
        askDate('Due date for ' + col.name, 'Sets this date on every open “' + col.name + '” cell. Done and Not needed cells are left alone.', function (d) {
          setDueForOpen(t, 'Due dates for ' + col.name, function () {
            return t.rows.map(function (r) { return [r, colId]; });
          }, d);
        });
      } },
      { label: 'Move left', disabled: i <= 0, run: function () { stepColumn(t, colId, -1); focusKey('col:' + colId); } },
      { label: 'Move right', disabled: i >= t.columns.length - 1, run: function () { stepColumn(t, colId, 1); focusKey('col:' + colId); } },
      '-',
      { label: 'Delete column', danger: true, run: function () {
        mutate(t, 'Delete column ' + col.name, function () {
          t.columns = t.columns.filter(function (c) { return c.id !== colId; });
          t.rows.forEach(function (r) { delete r.cells[colId]; });
        });
        state.frozen = null;
        renderAnimated();
        toast('Deleted column “' + col.name + '”', trackerScope(t));
      } }
    ], 'col:' + colId);
  }

  function toggleCell(t, rowId, colId) {
    var row = findRow(t, rowId), col = findCol(t, colId);
    if (!row || !col) return;
    var c = C.normCell(row.cells[colId]);
    if (c.state === 'na') { openCellPopover(rowId, colId); return; }
    var ticking = c.state !== 'done';
    freeze();
    var label = (ticking ? 'Ticked ' : 'Unticked ') + col.name + ' · ' + row.name;
    mutate(t, label, function () {
      var cell = ensureCell(row, colId);
      cell.state = ticking ? 'done' : 'open';
      cell.doneOn = ticking ? state.today : null;
    });
    render();
    scheduleResort(rowId);
    toast(label, trackerScope(t));
  }

  function jumpTo(t, status) {
    var soon = t.settings.dueSoonDays;
    var trs = rowEls();
    for (var i = 0; i < trs.length; i++) {
      var row = findRow(t, trs[i].dataset.rowId);
      for (var j = 0; j < t.columns.length; j++) {
        if (C.getCellStatus(row.cells[t.columns[j].id], state.today, soon) === status) {
          scrollToRow(row.id, true);
          var w = $app.querySelector('.grid-wrap');
          var td = trs[i].querySelector('td.cell[data-col="' + t.columns[j].id + '"]');
          var nameW = trs[i].querySelector('.namecell').offsetWidth;
          if (w && td && (td.offsetLeft - nameW < w.scrollLeft || td.offsetLeft + td.offsetWidth > w.scrollLeft + w.clientWidth)) {
            w.scrollLeft = Math.max(0, td.offsetLeft - nameW - 8);
          }
          var box = td && td.querySelector('.box');
          if (box) box.focus({ preventScroll: true });
          return;
        }
      }
    }
    if (state.search || t.settings.hideComplete) toast('No matching rows are shown. Clear the search to see them.');
  }

  // ================= Drag to reorder (rows when auto-sort is off, and columns) =================

  function startDrag(grip, e) {
    var t = cur();
    if (!t) return;
    var kind = grip.dataset.drag;
    var id = grip.dataset.id;
    var horiz = kind === 'col';
    var items = Array.prototype.slice.call($app.querySelectorAll(horiz ? 'th.colhead' : 'tr[data-row-id]'));
    var idOf = function (el) { return horiz ? el.dataset.col : el.dataset.rowId; };
    var src = items.filter(function (el) { return idOf(el) === id; })[0];
    if (!src) return;
    var wrap = $app.querySelector('.grid-wrap');
    var target = null, after = false, started = false;
    var x0 = e.clientX, y0 = e.clientY;
    var scrollTimer = null, lastEv = e;
    try { grip.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    function clearMarks() {
      items.forEach(function (el) { el.classList.remove('drop-before', 'drop-after'); });
    }
    function update(ev) {
      lastEv = ev;
      if (!started) {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 5) return;
        started = true;
        src.classList.add('dragging');
      }
      var pos = horiz ? ev.clientX : ev.clientY;
      clearMarks();
      target = null;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        var lo = horiz ? r.left : r.top, hi = horiz ? r.right : r.bottom;
        if (pos >= lo && pos < hi) {
          if (items[i] !== src) {
            target = items[i];
            after = pos > (lo + hi) / 2;
            target.classList.add(after ? 'drop-after' : 'drop-before');
          }
          break;
        }
      }
      // Scroll the grid when dragging near its edges.
      var wr = wrap.getBoundingClientRect();
      var edge = 40, speed = 0;
      var p = horiz ? ev.clientX : ev.clientY, a = horiz ? wr.left : wr.top, b = horiz ? wr.right : wr.bottom;
      if (p < a + edge) speed = -12; else if (p > b - edge) speed = 12;
      clearInterval(scrollTimer);
      if (speed) scrollTimer = setInterval(function () {
        if (horiz) wrap.scrollLeft += speed; else wrap.scrollTop += speed;
        update(lastEv);
      }, 30);
    }
    function end(commit) {
      clearInterval(scrollTimer);
      grip.removeEventListener('pointermove', update);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onCancel);
      clearMarks();
      src.classList.remove('dragging');
      if (commit && started && target) {
        if (horiz) moveColumn(t, id, idOf(target), after); else moveRowManual(t, id, idOf(target), after);
        focusKey((horiz ? 'cgrip:' : 'rgrip:') + id);
      }
    }
    function onUp() { end(true); }
    function onCancel() { end(false); }
    grip.addEventListener('pointermove', update);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onCancel);
  }

  // ================= Events =================

  $app.addEventListener('click', function (e) {
    var t = cur();
    var el = e.target.closest('[data-act]');
    if (!el) {
      var td = e.target.closest('td.cell');
      if (td && t) openCellPopover(td.dataset.row, td.dataset.col);
      return;
    }
    var act = el.dataset.act;
    var td2 = el.closest('td.cell');
    switch (act) {
      case 'toggle': toggleCell(t, td2.dataset.row, td2.dataset.col); break;
      case 'cell': openCellPopover(td2.dataset.row, td2.dataset.col); break;
      case 'row-menu': rowMenu(t, el.dataset.row, el); break;
      case 'col-menu': colMenu(t, el.dataset.col, el); break;
      case 'tracker-menu': openMenu(el, '<strong>' + esc(t.name) + '</strong>', trackerMenuItems(t, false), 'tmenu'); break;
      case 'rename-tracker': renameTracker(t); break;
      case 'jump': jumpTo(t, el.dataset.status); break;
      case 'undo': undo(); break;
      case 'new-tracker': newTracker(); break;
      case 'import': pickFile(importText); break;
      case 'restore': pickFile(importText); break;
      case 'backup': backupAll(); break;
      case 'item-menu': {
        var tr = db.trackers[el.dataset.id];
        if (tr) openMenu(el, '<strong>' + esc(tr.name) + '</strong>', trackerMenuItems(tr, true), 'menu:' + tr.id);
        break;
      }
    }
  });

  $app.addEventListener('change', function (e) {
    var t = cur();
    var k = e.target.dataset.change;
    if (!t || !k) return;
    var on = e.target.checked;
    if (k === 'autosort') {
      mutate(t, on ? 'Turn auto-sort on' : 'Turn auto-sort off', function () {
        t.settings.autoSort = on;
        if (!on) {
          // Keep rows where they are on screen as the new manual order.
          var pos = {};
          state.lastDisplay.forEach(function (x, i) { pos[x.id] = i; });
          t.rows.slice().sort(function (a, b) { return pos[a.id] - pos[b.id]; }).forEach(function (r, i) { r.manualOrder = i; });
        }
      });
      state.frozen = null;
      renderAnimated();
    } else if (k === 'hide') {
      mutate(t, on ? 'Hide complete rows' : 'Show complete rows', function () { t.settings.hideComplete = on; });
      render();
    }
  });

  $app.addEventListener('input', function (e) {
    if (e.target.dataset.fkey === 'search') { state.search = e.target.value; render(); }
  });

  $app.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = cur();
    var form = e.target;
    var input = form.querySelector('input');
    var v = input.value.trim();
    if (!t || !v) { input.focus(); return; }
    input.value = '';
    if (form.dataset.form === 'add-row') addRow(t, v.slice(0, 120));
    else if (form.dataset.form === 'add-col') addColumn(t, v.slice(0, 80));
    focusKey(form.dataset.form);
  });

  $app.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.grip');
    if (!g || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    startDrag(g, e);
  });

  $app.addEventListener('keydown', function (e) {
    var g = e.target.closest && e.target.closest('.grip');
    var t = cur();
    if (g && t) {
      var dir = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      var vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
      if (dir && vertical === (g.dataset.drag === 'row')) {
        e.preventDefault();
        if (g.dataset.drag === 'row') stepRow(t, g.dataset.id, dir); else stepColumn(t, g.dataset.id, dir);
        focusKey((g.dataset.drag === 'row' ? 'rgrip:' : 'cgrip:') + g.dataset.id);
        return;
      }
    }
    if (e.target.dataset && e.target.dataset.fkey === 'search' && e.key === 'Escape' && state.search) {
      state.search = '';
      e.target.value = '';
      render();
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || $dialog.open) return;
      e.preventDefault();
      undo();
    }
  });

  window.addEventListener('hashchange', onRoute);

  // Re-check the date and re-sort on focus, on return to the tab, and past midnight.
  function refreshDay(resort) {
    var now = C.todayStr();
    var changed = now !== state.today;
    state.today = now;
    if (changed || resort) {
      if (state.floating && state.floating.holdsOrder) { state.pendingResort = state.pendingResort || true; return; }
      clearTimeout(state.resortTimer);
      state.frozen = null;
      if (changed || cur()) render();
    }
  }
  function scheduleMidnight() {
    var n = new Date();
    var next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1);
    setTimeout(function () { refreshDay(true); scheduleMidnight(); }, Math.min(next - n, 2147483647));
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshDay(true); });
  window.addEventListener('focus', function () { refreshDay(true); });
  window.addEventListener('pageshow', function () { refreshDay(false); });
  setInterval(function () { refreshDay(false); }, 30000); // catches sleep and clock changes

  // Another tab changed the data: reload it.
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('tickbox:') !== 0) return;
    loadAll();
    if (state.route.view === 'grid' && !db.trackers[state.route.id]) { go('#/'); return; }
    if (!state.floating) render();
  });

  // ================= Start =================

  loadAll();
  state.route = parseRoute();
  if (location.hash.indexOf('#/t/') === 0 && state.route.view === 'home') history.replaceState(null, '', '#/');
  render();
  scheduleMidnight();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
    });
  }
})();
