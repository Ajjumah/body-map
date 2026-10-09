/*
 * Tickbox Tracker core: pure functions for dates, cell status, row sorting,
 * and tracker file validation. No DOM, no storage. Loaded as a classic script
 * in the browser (window.TickboxCore) and with require() in the unit tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TickboxCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // ---------- Dates (YYYY-MM-DD strings, local calendar days) ----------

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Today's date on this device, as YYYY-MM-DD in local time. */
  function todayStr(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(s) {
    var m = typeof s === 'string' && DATE_RE.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo - 1)) return null;
    return { y: y, m: mo - 1, d: d };
  }

  function isValidDate(s) { return parseDate(s) !== null; }

  function daysInMonth(y, m) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]; }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  // Day number for a calendar date. Date.UTC is used only as day arithmetic on
  // the calendar fields, so no time zone or DST shift can creep in.
  function dayNumber(s) {
    var p = parseDate(s);
    return p ? Math.round(Date.UTC(p.y, p.m, p.d) / 86400000) : NaN;
  }

  /** Whole days from a to b (b - a). */
  function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }

  function addDays(s, n) {
    var p = parseDate(s);
    var d = new Date(Date.UTC(p.y, p.m, p.d + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  /** "9 Oct" */
  function formatShort(s) {
    var p = parseDate(s);
    return p ? p.d + ' ' + MONTHS[p.m] : '';
  }

  /** "9 Oct 2026" */
  function formatLong(s) {
    var p = parseDate(s);
    return p ? p.d + ' ' + MONTHS[p.m] + ' ' + p.y : '';
  }

  // ---------- Cell status ----------

  var STATUS = {
    OVERDUE: 'overdue',
    TODAY: 'today',
    SOON: 'soon',
    LATER: 'later',
    OPEN: 'open', // open, no due date
    DONE: 'done',
    NA: 'na'
  };

  var HIGHLIGHT_RANK = { overdue: 0, today: 1, soon: 2, later: 3 };

  /** A missing cell entry means Open with no due date. */
  function normCell(cell) {
    return {
      state: cell && (cell.state === 'done' || cell.state === 'na') ? cell.state : 'open',
      due: cell && isValidDate(cell.due) ? cell.due : null,
      doneOn: cell && isValidDate(cell.doneOn) ? cell.doneOn : null,
      note: cell && typeof cell.note === 'string' ? cell.note : ''
    };
  }

  /**
   * Status of one cell: overdue | today | soon | later | open | done | na.
   * "Due soon" means 1..dueSoonDays days ahead (inclusive).
   */
  function getCellStatus(cell, today, dueSoonDays) {
    var c = normCell(cell);
    if (c.state === 'na') return STATUS.NA;
    if (c.state === 'done') return STATUS.DONE;
    if (!c.due) return STATUS.OPEN;
    var diff = daysBetween(today, c.due);
    if (diff < 0) return STATUS.OVERDUE;
    if (diff === 0) return STATUS.TODAY;
    if (diff <= clampSoon(dueSoonDays)) return STATUS.SOON;
    return STATUS.LATER;
  }

  function clampSoon(n) {
    n = Math.round(Number(n));
    if (!isFinite(n)) return 3;
    return Math.max(0, Math.min(14, n));
  }

  /** Active cell: Open and has a due date. */
  function isActive(cell) {
    var c = normCell(cell);
    return c.state === 'open' && !!c.due;
  }

  // ---------- Row analysis ----------

  var GROUP = { DUE: 'due', OPEN: 'open', COMPLETE: 'complete' };

  /**
   * Everything the UI needs to know about one row:
   *  nextDue        earliest due date among active cells (or null)
   *  drivingColIds  columns of the active cells holding nextDue
   *  group          due | open | complete
   *  status         status of the driving cell(s), or null
   *  done / total   progress, counting cells that are not "Not needed"
   */
  function analyzeRow(tracker, row, today) {
    var cols = tracker.columns || [];
    var soon = tracker.settings ? tracker.settings.dueSoonDays : 3;
    var nextDue = null, driving = [], open = 0, done = 0, total = 0;
    for (var i = 0; i < cols.length; i++) {
      var c = normCell(row.cells && row.cells[cols[i].id]);
      if (c.state === 'na') continue;
      total++;
      if (c.state === 'done') { done++; continue; }
      open++;
      if (!c.due) continue;
      if (nextDue === null || c.due < nextDue) { nextDue = c.due; driving = [cols[i].id]; }
      else if (c.due === nextDue) driving.push(cols[i].id);
    }
    var group;
    if (nextDue) group = GROUP.DUE;
    else if (open > 0 || cols.length === 0) group = GROUP.OPEN;
    else group = GROUP.COMPLETE;
    return {
      nextDue: nextDue,
      drivingColIds: driving,
      group: group,
      status: nextDue ? getCellStatus({ state: 'open', due: nextDue }, today, soon) : null,
      done: done,
      total: total
    };
  }

  function manualCompare(a, b) {
    var ma = typeof a.manualOrder === 'number' ? a.manualOrder : Infinity;
    var mb = typeof b.manualOrder === 'number' ? b.manualOrder : Infinity;
    return ma === mb ? 0 : ma < mb ? -1 : 1;
  }

  var GROUP_RANK = { due: 0, open: 1, complete: 2 };

  /**
   * Rows in display order (a new array; the tracker is not changed).
   *  1. rows with a next due date, earliest first (overdue > today > upcoming)
   *  2. rows with open cells but no due dates, in manual order
   *  3. complete rows (every cell Done or Not needed), in manual order
   * Ties keep manual order. With autoSort off, everything is in manual order.
   */
  function sortRows(tracker, today) {
    var rows = (tracker.rows || []).map(function (row, idx) {
      return { row: row, idx: idx, info: analyzeRow(tracker, row, today) };
    });
    var auto = !tracker.settings || tracker.settings.autoSort !== false;
    rows.sort(function (a, b) {
      if (auto) {
        var g = GROUP_RANK[a.info.group] - GROUP_RANK[b.info.group];
        if (g) return g;
        if (a.info.group === GROUP.DUE && a.info.nextDue !== b.info.nextDue) {
          return a.info.nextDue < b.info.nextDue ? -1 : 1;
        }
      }
      return manualCompare(a.row, b.row) || a.idx - b.idx;
    });
    return rows.map(function (r) { return r.row; });
  }

  /** Counts of cells by status across the tracker, for summaries. */
  function countStatuses(tracker, today) {
    var counts = { overdue: 0, today: 0, soon: 0, later: 0, open: 0, done: 0, na: 0 };
    var soon = tracker.settings ? tracker.settings.dueSoonDays : 3;
    (tracker.rows || []).forEach(function (row) {
      (tracker.columns || []).forEach(function (col) {
        counts[getCellStatus(row.cells && row.cells[col.id], today, soon)]++;
      });
    });
    return counts;
  }

  // ---------- Labels ----------

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /** Short label shown in a cell for highlighted statuses. */
  function statusLabel(status, due, today) {
    switch (status) {
      case STATUS.OVERDUE: return plural(-daysBetween(today, due), 'day') + ' late';
      case STATUS.TODAY: return 'Today';
      case STATUS.SOON: return daysBetween(today, due) === 1 ? 'Tomorrow' : 'In ' + daysBetween(today, due) + ' days';
      case STATUS.DONE: return 'Done';
      case STATUS.NA: return 'Not needed';
      default: return '';
    }
  }

  /** Badge text for the row's driving status, e.g. "Due today". */
  function rowBadgeLabel(status, due, today) {
    switch (status) {
      case STATUS.OVERDUE: return statusLabel(status, due, today);
      case STATUS.TODAY: return 'Due today';
      case STATUS.SOON: return daysBetween(today, due) === 1 ? 'Due tomorrow' : 'Due in ' + daysBetween(today, due) + ' days';
      case STATUS.LATER: return 'Due ' + formatShort(due);
      default: return '';
    }
  }

  // ---------- IDs ----------

  function newId(prefix) {
    var s = '';
    for (var i = 0; i < 8; i++) s += Math.floor(Math.random() * 36).toString(36);
    return prefix + '_' + s;
  }

  // ---------- Tracker files (validation, templates) ----------

  function defaultSettings() { return { autoSort: true, dueSoonDays: 3, hideComplete: false }; }

  function fail(msg) { return { ok: false, error: msg }; }

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  /**
   * Check that obj is a tracker (or template) object and return a clean copy.
   * Returns { ok: true, tracker } or { ok: false, error }.
   */
  function validateTracker(obj) {
    var NOT = "This isn't a tracker file. ";
    if (!isObj(obj)) return fail(NOT + 'It does not contain a tracker.');
    if (obj.schemaVersion !== SCHEMA_VERSION) {
      if (typeof obj.schemaVersion === 'number' && obj.schemaVersion > SCHEMA_VERSION) {
        return fail('This tracker file was made by a newer version of the app.');
      }
      return fail(NOT + 'It does not have the tracker details this app needs.');
    }
    if (typeof obj.name !== 'string' || !obj.name.trim()) return fail(NOT + 'The tracker has no name.');
    if (!Array.isArray(obj.columns)) return fail(NOT + 'It has no list of columns.');
    if (!Array.isArray(obj.rows)) return fail(NOT + 'It has no list of rows.');

    var s = isObj(obj.settings) ? obj.settings : {};
    var out = {
      schemaVersion: SCHEMA_VERSION,
      id: typeof obj.id === 'string' && obj.id ? obj.id : newId('trk'),
      name: obj.name.trim(),
      rowLabel: typeof obj.rowLabel === 'string' && obj.rowLabel.trim() ? obj.rowLabel.trim() : 'Item',
      settings: {
        autoSort: s.autoSort !== false,
        dueSoonDays: s.dueSoonDays === undefined ? 3 : clampSoon(s.dueSoonDays),
        hideComplete: s.hideComplete === true
      },
      columns: [],
      rows: []
    };

    var colIds = {};
    for (var i = 0; i < obj.columns.length; i++) {
      var col = obj.columns[i];
      if (!isObj(col) || typeof col.id !== 'string' || !col.id || typeof col.name !== 'string') {
        return fail(NOT + 'Column ' + (i + 1) + ' is missing an id or name.');
      }
      if (colIds[col.id]) return fail(NOT + 'Two columns share the id "' + col.id + '".');
      colIds[col.id] = true;
      out.columns.push({ id: col.id, name: col.name });
    }

    var rowIds = {};
    for (var r = 0; r < obj.rows.length; r++) {
      var row = obj.rows[r];
      if (!isObj(row) || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string') {
        return fail(NOT + 'Row ' + (r + 1) + ' is missing an id or name.');
      }
      if (rowIds[row.id]) return fail(NOT + 'Two rows share the id "' + row.id + '".');
      rowIds[row.id] = true;
      var cells = {};
      if (row.cells !== undefined && !isObj(row.cells)) return fail(NOT + 'Row "' + row.name + '" has bad cells.');
      var src = row.cells || {};
      for (var key in src) {
        if (!Object.prototype.hasOwnProperty.call(src, key) || !colIds[key]) continue;
        var c = src[key];
        if (!isObj(c)) return fail(NOT + 'A cell in row "' + row.name + '" is not valid.');
        if (c.state !== undefined && c.state !== 'open' && c.state !== 'done' && c.state !== 'na') {
          return fail(NOT + 'A cell in row "' + row.name + '" has an unknown state "' + c.state + '".');
        }
        if (c.due != null && !isValidDate(c.due)) return fail(NOT + 'A cell in row "' + row.name + '" has a bad due date.');
        if (c.doneOn != null && !isValidDate(c.doneOn)) return fail(NOT + 'A cell in row "' + row.name + '" has a bad done date.');
        cells[key] = normCell(c);
      }
      out.rows.push({
        id: row.id,
        name: row.name,
        note: typeof row.note === 'string' ? row.note : '',
        manualOrder: typeof row.manualOrder === 'number' && isFinite(row.manualOrder) ? row.manualOrder : r,
        cells: cells
      });
    }
    return { ok: true, tracker: out };
  }

  /** Same object with no rows. */
  function makeTemplate(tracker) {
    var t = JSON.parse(JSON.stringify(tracker));
    t.rows = [];
    return t;
  }

  /** Name for an imported tracker: adds " (imported)" if the name is taken. */
  function importName(name, existingNames) {
    var taken = {};
    existingNames.forEach(function (n) { taken[n.toLowerCase()] = true; });
    if (!taken[name.toLowerCase()]) return name;
    var candidate = name + ' (imported)';
    for (var i = 2; taken[candidate.toLowerCase()]; i++) candidate = name + ' (imported ' + i + ')';
    return candidate;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    MONTHS: MONTHS,
    MONTHS_LONG: MONTHS_LONG,
    STATUS: STATUS,
    GROUP: GROUP,
    HIGHLIGHT_RANK: HIGHLIGHT_RANK,
    todayStr: todayStr,
    parseDate: parseDate,
    isValidDate: isValidDate,
    daysBetween: daysBetween,
    daysInMonth: daysInMonth,
    addDays: addDays,
    formatShort: formatShort,
    formatLong: formatLong,
    normCell: normCell,
    getCellStatus: getCellStatus,
    isActive: isActive,
    analyzeRow: analyzeRow,
    sortRows: sortRows,
    countStatuses: countStatuses,
    statusLabel: statusLabel,
    rowBadgeLabel: rowBadgeLabel,
    clampSoon: clampSoon,
    newId: newId,
    defaultSettings: defaultSettings,
    validateTracker: validateTracker,
    makeTemplate: makeTemplate,
    importName: importName
  };
});
