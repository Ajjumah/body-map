// Unit tests for the sort and status rules (build document, section 3 and 8).
// Run with: node --test tickbox/tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

const { getCellStatus, sortRows, analyzeRow, countStatuses, daysBetween, addDays } = core;
const TODAY = '2026-10-09';

const open = (due) => ({ state: 'open', due: due || null, doneOn: null, note: '' });
const done = (due) => ({ state: 'done', due: due || null, doneOn: '2026-10-02', note: '' });
const na = (due) => ({ state: 'na', due: due || null, doneOn: null, note: '' });

function tracker(columns, rows, settings) {
  return {
    schemaVersion: 1,
    id: 'trk_test',
    name: 'Test',
    rowLabel: 'Vendor',
    settings: Object.assign({ autoSort: true, dueSoonDays: 3, hideComplete: false }, settings),
    columns: columns.map((name, i) => ({ id: 'col_' + (i + 1), name })),
    rows: rows.map(([name, cells], i) => ({
      id: 'row_' + (i + 1),
      name,
      note: '',
      manualOrder: i,
      cells: Object.fromEntries(cells.map((c, j) => [ 'col_' + (j + 1), c ]).filter(([, c]) => c)),
    })),
  };
}

const names = (rows) => rows.map((r) => r.name);

// The worked example from section 3, with today as 9 October.
function workedExample() {
  return tracker(['Contract', 'Deposit', 'Stall plan', 'Final invoice'], [
    ['Alpha', [done(), done(), open('2026-10-20'), open('2026-10-30')]],
    ['Bravo', [done(), open('2026-10-14'), na(), open('2026-10-30')]],
    ['Charlie', [done(), done(), done(), open('2026-10-09')]],
    ['Delta', [done(), done(), done(), done()]],
  ]);
}

test('dates: whole calendar days, across month, year and DST boundaries', () => {
  assert.equal(daysBetween('2026-10-09', '2026-10-09'), 0);
  assert.equal(daysBetween('2026-10-09', '2026-10-12'), 3);
  assert.equal(daysBetween('2026-10-12', '2026-10-09'), -3);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // EU DST change
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2); // leap year
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(core.formatShort('2026-10-09'), '9 Oct');
  assert.equal(core.isValidDate('2026-02-30'), false);
  assert.equal(core.todayStr(new Date(2026, 9, 9, 23, 59)), '2026-10-09');
  assert.equal(core.todayStr(new Date(2026, 9, 10, 0, 0)), '2026-10-10');
});

test('getCellStatus: every status', () => {
  assert.equal(getCellStatus(open('2026-10-06'), TODAY, 3), 'overdue');
  assert.equal(getCellStatus(open('2026-10-08'), TODAY, 3), 'overdue');
  assert.equal(getCellStatus(open('2026-10-09'), TODAY, 3), 'today');
  assert.equal(getCellStatus(open('2026-10-10'), TODAY, 3), 'soon');
  assert.equal(getCellStatus(open('2026-10-12'), TODAY, 3), 'soon');
  assert.equal(getCellStatus(open('2026-10-13'), TODAY, 3), 'later');
  assert.equal(getCellStatus(open(), TODAY, 3), 'open');
  assert.equal(getCellStatus(undefined, TODAY, 3), 'open', 'missing cell is Open with no date');
  assert.equal(getCellStatus(done('2026-10-01'), TODAY, 3), 'done');
  assert.equal(getCellStatus(na(), TODAY, 3), 'na');
});

test('getCellStatus: due soon window follows the setting (0 to 14)', () => {
  assert.equal(getCellStatus(open('2026-10-10'), TODAY, 0), 'later');
  assert.equal(getCellStatus(open('2026-10-23'), TODAY, 14), 'soon');
  assert.equal(getCellStatus(open('2026-10-24'), TODAY, 14), 'later');
  assert.equal(getCellStatus(open('2026-10-24'), TODAY, 99), 'later', 'clamped to 14');
});

test('acceptance: a "Not needed" cell with a past date never counts as overdue', () => {
  assert.equal(getCellStatus(na('2026-09-01'), TODAY, 3), 'na');
  const t = tracker(['A', 'B'], [['Row', [na('2026-09-01'), open()]]]);
  const info = analyzeRow(t, t.rows[0], TODAY);
  assert.equal(info.nextDue, null);
  assert.equal(info.group, 'open');
  assert.equal(countStatuses(t, TODAY).overdue, 0);
});

test('worked example: Charlie 1st, Bravo 2nd, Alpha 3rd, Delta complete', () => {
  const t = workedExample();
  assert.deepEqual(names(sortRows(t, TODAY)), ['Charlie', 'Bravo', 'Alpha', 'Delta']);
  const [alpha, bravo, charlie, delta] = t.rows.map((r) => analyzeRow(t, r, TODAY));
  assert.equal(alpha.nextDue, '2026-10-20');
  assert.equal(bravo.nextDue, '2026-10-14');
  assert.deepEqual(charlie.drivingColIds, ['col_4']);
  assert.equal(charlie.status, 'today');
  assert.equal(delta.nextDue, null);
  assert.equal(delta.group, 'complete');
  assert.equal(bravo.done, 1);
  assert.equal(bravo.total, 3, 'progress ignores Not needed cells');
});

test('worked example: ticking Charlie\'s Final invoice drops it to Complete and Bravo moves to the top', () => {
  const t = workedExample();
  t.rows[2].cells.col_4 = done('2026-10-09');
  assert.deepEqual(names(sortRows(t, TODAY)), ['Bravo', 'Alpha', 'Charlie', 'Delta']);
  assert.equal(analyzeRow(t, t.rows[2], TODAY).group, 'complete');
});

test('acceptance: setting row 3, column 4 due today moves row 3 to the top as the driving cell', () => {
  const t = tracker(['A', 'B', 'C', 'D'], [
    ['Row 1', [open('2026-10-11')]],
    ['Row 2', [open('2026-10-10')]],
    ['Row 3', [open('2026-10-20')]],
    ['Row 4', [open()]],
  ]);
  assert.deepEqual(names(sortRows(t, TODAY)), ['Row 2', 'Row 1', 'Row 3', 'Row 4']);
  t.rows[2].cells.col_4 = open(TODAY);
  assert.deepEqual(names(sortRows(t, TODAY)), ['Row 3', 'Row 2', 'Row 1', 'Row 4']);
  const info = analyzeRow(t, t.rows[2], TODAY);
  assert.deepEqual(info.drivingColIds, ['col_4']);
  assert.equal(getCellStatus(t.rows[2].cells.col_4, TODAY, 3), 'today');
});

test('acceptance: overdue above due today above due tomorrow', () => {
  const t = tracker(['A'], [
    ['Tomorrow', [open('2026-10-10')]],
    ['Today', [open('2026-10-09')]],
    ['Overdue', [open('2026-10-08')]],
  ]);
  assert.deepEqual(names(sortRows(t, TODAY)), ['Overdue', 'Today', 'Tomorrow']);
});

test('acceptance: ticking a driving cell re-sorts by the next open due date', () => {
  const t = tracker(['A', 'B'], [
    ['First', [open('2026-10-09'), open('2026-10-25')]],
    ['Second', [open('2026-10-12')]],
  ]);
  assert.deepEqual(names(sortRows(t, TODAY)), ['First', 'Second']);
  t.rows[0].cells.col_1 = done('2026-10-09');
  assert.equal(analyzeRow(t, t.rows[0], TODAY).nextDue, '2026-10-25');
  assert.deepEqual(names(sortRows(t, TODAY)), ['Second', 'First']);
});

test('acceptance: a row with every cell Done or Not needed moves to the Complete group', () => {
  const t = tracker(['A', 'B', 'C'], [
    ['Finished', [done(), na('2026-01-01'), done()]],
    ['Undated', [open()]],
    ['Dated', [open('2026-11-01')]],
  ]);
  assert.equal(analyzeRow(t, t.rows[0], TODAY).group, 'complete');
  assert.deepEqual(names(sortRows(t, TODAY)), ['Dated', 'Undated', 'Finished']);
});

test('acceptance: two cells in one row with the same earliest date are both driving cells', () => {
  const t = tracker(['A', 'B', 'C'], [['Row', [open('2026-10-11'), open('2026-10-20'), open('2026-10-11')]]]);
  assert.deepEqual(analyzeRow(t, t.rows[0], TODAY).drivingColIds, ['col_1', 'col_3']);
});

test('rows with no due dates keep manual order, below all dated rows', () => {
  const t = tracker(['A'], [
    ['N1', [open()]],
    ['D1', [open('2026-12-01')]],
    ['N2', []],
    ['N3', [open()]],
  ]);
  t.rows[0].manualOrder = 5; // N1 goes after N3 in manual order
  assert.deepEqual(names(sortRows(t, TODAY)), ['D1', 'N2', 'N3', 'N1']);
});

test('ties on the same date keep the user\'s manual order', () => {
  const t = tracker(['A'], [
    ['B', [open('2026-10-15')]],
    ['A', [open('2026-10-15')]],
    ['C', [open('2026-10-15')]],
  ]);
  t.rows[0].manualOrder = 2;
  t.rows[1].manualOrder = 0;
  t.rows[2].manualOrder = 1;
  assert.deepEqual(names(sortRows(t, TODAY)), ['A', 'C', 'B']);
});

test('auto-sort off keeps manual order (highlights still computed)', () => {
  const t = workedExample();
  t.settings.autoSort = false;
  assert.deepEqual(names(sortRows(t, TODAY)), ['Alpha', 'Bravo', 'Charlie', 'Delta']);
  assert.equal(analyzeRow(t, t.rows[2], TODAY).status, 'today');
});

test('sortRows does not change the tracker', () => {
  const t = workedExample();
  const before = JSON.stringify(t);
  sortRows(t, TODAY);
  assert.equal(JSON.stringify(t), before);
});

test('cells for columns that no longer exist are ignored', () => {
  const t = tracker(['A'], [['Row', [done()]]]);
  t.rows[0].cells.col_gone = open('2026-01-01');
  assert.equal(analyzeRow(t, t.rows[0], TODAY).group, 'complete');
});

test('a new day changes status without other changes (midnight roll-over)', () => {
  const t = tracker(['A'], [['Row', [open('2026-10-09')]]]);
  assert.equal(analyzeRow(t, t.rows[0], '2026-10-09').status, 'today');
  assert.equal(analyzeRow(t, t.rows[0], '2026-10-10').status, 'overdue');
});

test('labels', () => {
  assert.equal(core.statusLabel('overdue', '2026-10-06', TODAY), '3 days late');
  assert.equal(core.statusLabel('overdue', '2026-10-08', TODAY), '1 day late');
  assert.equal(core.statusLabel('today', TODAY, TODAY), 'Today');
  assert.equal(core.statusLabel('soon', '2026-10-10', TODAY), 'Tomorrow');
  assert.equal(core.statusLabel('soon', '2026-10-11', TODAY), 'In 2 days');
  assert.equal(core.rowBadgeLabel('today', TODAY, TODAY), 'Due today');
  assert.equal(core.rowBadgeLabel('later', '2026-10-20', TODAY), 'Due 20 Oct');
});

test('validateTracker: round trip of a full copy is exact', () => {
  const t = workedExample();
  const res = core.validateTracker(JSON.parse(JSON.stringify(t)));
  assert.equal(res.ok, true);
  assert.deepEqual(res.tracker, t);
});

test('validateTracker: plain errors for files that are not trackers', () => {
  assert.equal(core.validateTracker(null).ok, false);
  assert.equal(core.validateTracker([]).ok, false);
  assert.equal(core.validateTracker({ hello: 'world' }).ok, false);
  assert.match(core.validateTracker({ schemaVersion: 2, name: 'x', columns: [], rows: [] }).error, /newer version/);
  const bad = workedExample();
  bad.rows[0].cells.col_1.state = 'maybe';
  assert.match(core.validateTracker(bad).error, /unknown state/);
  const badDate = workedExample();
  badDate.rows[0].cells.col_3.due = '20 Oct';
  assert.match(core.validateTracker(badDate).error, /bad due date/);
});

test('template: same object with no rows, valid on import', () => {
  const tpl = core.makeTemplate(workedExample());
  assert.deepEqual(tpl.rows, []);
  assert.equal(tpl.columns.length, 4);
  assert.deepEqual(tpl.settings, { autoSort: true, dueSoonDays: 3, hideComplete: false });
  assert.equal(core.validateTracker(tpl).ok, true);
});

test('importName adds "(imported)" only when the name clashes', () => {
  assert.equal(core.importName('Billing', ['Vendors']), 'Billing');
  assert.equal(core.importName('Billing', ['billing']), 'Billing (imported)');
  assert.equal(core.importName('Billing', ['Billing', 'Billing (imported)']), 'Billing (imported 2)');
});
