import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReminder, validateReminder, isReminderDue, confirmBackup, snoozeReminder, hasTrainingData,
} from '../backup-reminder.js';
import {
  createState, commitWorkout, exportBackup, validateState, setBodyWeight,
  loadState, saveState, loadBackupReminder, saveBackupReminder,
} from '../data.js';

const workout = [{ id: 'press', name: 'Press', weight: 25, reps: 12 }];

test('a new or existing user starts a fresh 14-calendar-day period', () => {
  const reminder = createReminder('2026-10-13');
  assert.deepEqual(reminder, { version: 1, startedOn: '2026-10-13', confirmedOn: null, snoozedUntil: null });
  assert.equal(isReminderDue(reminder, '2026-10-12'), false);
  assert.equal(isReminderDue(reminder, '2026-10-13'), false);
  assert.equal(isReminderDue(reminder, '2026-10-26'), false);
  assert.equal(isReminderDue(reminder, '2026-10-27'), true);
  assert.equal(isReminderDue(reminder, '2026-11-27'), true);
});

test('the 14-day boundary survives spring and autumn DST, leap days and year boundaries', () => {
  for (const [start, previous, due] of [
    ['2026-03-22', '2026-04-04', '2026-04-05'],
    ['2026-10-18', '2026-10-31', '2026-11-01'],
    ['2024-02-20', '2024-03-04', '2024-03-05'],
    ['2026-12-25', '2027-01-07', '2027-01-08'],
  ]) {
    const reminder = createReminder(start);
    assert.equal(isReminderDue(reminder, previous), false, `${start}: day 13`);
    assert.equal(isReminderDue(reminder, due), true, `${start}: day 14`);
  }
});

test('only explicit confirmation resets the period and it leaves the old metadata untouched', () => {
  const reminder = createReminder('2026-10-01');
  const before = JSON.stringify(reminder);
  const state = commitWorkout(createState(), '2026-10-01', 'push', workout);
  exportBackup(state); // Een bestand aanbieden of een bewaarvenster annuleren bevestigt niets.
  assert.equal(isReminderDue(reminder, '2026-10-16'), true);
  const confirmed = confirmBackup(reminder, '2026-10-16');
  assert.equal(confirmed.confirmedOn, '2026-10-16');
  assert.equal(confirmed.startedOn, '2026-10-01');
  assert.equal(isReminderDue(confirmed, '2026-10-29'), false);
  assert.equal(isReminderDue(confirmed, '2026-10-30'), true);
  assert.equal(JSON.stringify(reminder), before);
});

test('snooze lasts exactly three calendar days without marking a backup as saved', () => {
  const reminder = createReminder('2026-03-01');
  const snoozed = snoozeReminder(reminder, '2026-03-28');
  assert.equal(snoozed.snoozedUntil, '2026-03-31');
  assert.equal(snoozed.confirmedOn, null);
  assert.equal(isReminderDue(snoozed, '2026-03-30'), false);
  assert.equal(isReminderDue(snoozed, '2026-03-31'), true);
  assert.equal(reminder.snoozedUntil, null);
  const snoozedAgain = snoozeReminder(snoozed, '2026-03-31');
  assert.equal(isReminderDue(snoozedAgain, '2026-04-02'), false);
  assert.equal(isReminderDue(snoozedAgain, '2026-04-03'), true);
  const confirmed = confirmBackup(snoozedAgain, '2026-04-01');
  assert.equal(confirmed.snoozedUntil, null);
  assert.equal(isReminderDue(confirmed, '2026-04-14'), false);
  assert.equal(isReminderDue(confirmed, '2026-04-15'), true);
});

test('an early snooze does not shorten the original 14-day period', () => {
  const reminder = snoozeReminder(createReminder('2026-10-01'), '2026-10-02');
  assert.equal(isReminderDue(reminder, '2026-10-05'), false);
  assert.equal(isReminderDue(reminder, '2026-10-15'), true);
});

test('reminders need exercises or body-weight measurements, including weight-only usage', () => {
  const empty = createState();
  assert.equal(hasTrainingData(empty), false);
  assert.equal(hasTrainingData({ ...empty, sessions: { '2026-10-01:push': [] } }), false);
  assert.equal(hasTrainingData({ ...empty, routines: { ...empty.routines, push: workout } }), true);
  assert.equal(hasTrainingData(commitWorkout(empty, '2026-10-01', 'pull', workout)), true);
  assert.equal(hasTrainingData(setBodyWeight(empty, '2026-10-01', 75.5)), true);
});

test('malformed reminder data is rejected and valid metadata is copied', () => {
  const reminder = createReminder('2026-10-01');
  assert.deepEqual(validateReminder(reminder), reminder);
  assert.notEqual(validateReminder(reminder), reminder);
  for (const malformed of [
    null, [], {}, { ...reminder, version: 2 }, { ...reminder, extra: 1 },
    { ...reminder, startedOn: '2026-02-29' }, { ...reminder, confirmedOn: undefined },
    { ...reminder, confirmedOn: '2026-09-30' }, { ...reminder, snoozedUntil: '2026-13-01' },
    { ...reminder, startedOn: '2026-10-01T00:00:00Z' },
  ]) assert.throws(() => validateReminder(malformed), /Ongeldige back-upherinnering/);
  assert.throws(() => isReminderDue(reminder, '2026-02-30'), /datum/);
  assert.throws(() => snoozeReminder(reminder, 'bad date'), /datum/);
  assert.throws(() => confirmBackup(reminder, '2026-09-30'), /bevestigingsdatum/);
});

// Kleine transactionele opslagadapter: chained requests houden de transactie
// actief en writes worden pas zichtbaar wanneer alle requests voltooid zijn.
function memoryIndexedDB(records) {
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const staged = new Map(records);
            let pending = 0, finished = false;
            const tx = {
              objectStore: () => store,
              abort() {
                if (finished) return;
                finished = true;
                queueMicrotask(() => tx.onabort?.());
              },
            };
            const complete = () => {
              if (pending || finished) return;
              queueMicrotask(() => {
                if (pending || finished) return;
                finished = true;
                records.clear();
                for (const [key, value] of staged) records.set(key, value);
                tx.oncomplete?.();
              });
            };
            const operation = (kind, key, value) => {
              const result = {};
              pending++;
              queueMicrotask(() => {
                if (finished) return;
                if (kind === 'put') staged.set(key, structuredClone(value));
                result.result = kind === 'get' ? structuredClone(staged.get(key)) : key;
                result.onsuccess?.();
                pending--;
                complete();
              });
              return result;
            };
            const store = {
              transaction: tx,
              get: key => operation('get', key),
              put: (value, key) => operation('put', key, value),
            };
            return tx;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
}

test('reminder storage is isolated from legacy workout storage and backup imports/exports', async () => {
  const original = globalThis.indexedDB;
  const legacy = {
    schemaVersion: 1, routines: { push: workout, pull: [], legs: [] },
    sessions: { '2026-10-01:push': workout }, ui: { date: '2026-10-01', split: 'push' },
  };
  const state = validateState(legacy);
  const records = new Map([['current', structuredClone(legacy)]]);
  globalThis.indexedDB = memoryIndexedDB(records);
  try {
    assert.equal(await loadBackupReminder(), null);
    assert.deepEqual(await loadState(), state);
    assert.equal((await loadState()).schemaVersion, 4);
    const backupBefore = exportBackup(state);
    const reminder = createReminder('2026-10-13');
    await saveBackupReminder(reminder);
    assert.deepEqual(await loadBackupReminder(), reminder);
    assert.deepEqual(await loadState(), state);
    assert.equal(exportBackup(await loadState()), backupBefore);
    assert.deepEqual([...records.keys()].sort(), ['backup-reminder', 'current']);

    const imported = validateState(JSON.parse(JSON.stringify(legacy)));
    await saveState(imported);
    assert.equal(records.get('current').schemaVersion, 4);
    assert.deepEqual(await loadBackupReminder(), reminder);
    assert.equal(Object.hasOwn(imported, 'backupReminder'), false);
    records.set('backup-reminder', { broken: true });
    await assert.rejects(loadBackupReminder(), /Ongeldige back-upherinnering/);
    assert.deepEqual(await loadState(), state);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
