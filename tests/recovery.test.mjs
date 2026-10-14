import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RECOVERY_BACKUPS, cleanRecoveryEntries, updateRecoveryEntries } from '../recovery.js';
import {
  createState, commitWorkout, validateState, saveState, loadState,
  ensureRecoveryBackup, listRecoveryBackups, loadRecoveryBackup, exportBackup,
} from '../data.js';

const trained = reps => commitWorkout(createState(), '2000-01-01', 'push', [
  { id: 'test', name: 'Test', weight: 20, reps, sets: 3 },
]);
const update = (raw, snapshot, date, other = {}) => updateRecoveryEntries(raw, {
  snapshot, now: new Date(`${date}T12:00:00Z`), ...other,
}, validateState);

test('daily recovery stores the latest changed logbook and ignores UI-only changes', () => {
  const first = trained(8);
  let copies = update(undefined, first, '2026-10-01');
  assert.equal(copies.length, 1);
  assert.equal(copies[0].reason, 'daily');
  const uiOnly = { ...first, ui: { date: '2001-01-01', split: 'legs' } };
  assert.deepEqual(update(copies, uiOnly, '2026-10-02'), copies);
  const reordered = { ...first, routines: { legs: first.routines.legs, pull: first.routines.pull, push: first.routines.push } };
  assert.deepEqual(update(copies, reordered, '2026-10-02'), copies);
  copies = update(copies, trained(10), '2026-10-01');
  assert.equal(copies.length, 1);
  assert.equal(copies[0].state.sessions['2000-01-01:push'][0].reps, 10);
  copies[0].state.sessions['2000-01-01:push'][0].reps = 99;
  assert.equal(first.sessions['2000-01-01:push'][0].reps, 8);
});

test('recovery retention is bounded to the seven latest copies', () => {
  let copies = [];
  for (let day = 1; day <= 10; day++) copies = update(copies, trained(day), `2026-10-${String(day).padStart(2, '0')}`);
  assert.equal(copies.length, MAX_RECOVERY_BACKUPS);
  assert.equal(copies[0].date, '2026-10-10');
  assert.equal(copies.at(-1).date, '2026-10-04');
  assert.equal(new Set(copies.map(copy => copy.id)).size, MAX_RECOVERY_BACKUPS);
});

test('imports and restores preserve the replaced state before updating today’s daily copy', () => {
  const before = trained(8);
  const imported = trained(12);
  let copies = update([], before, '2026-10-01');
  copies = update(copies, imported, '2026-10-01', { previous: before, reason: 'import' });
  assert.equal(copies.length, 2);
  assert.equal(copies.find(copy => copy.reason === 'import').state.sessions['2000-01-01:push'][0].reps, 8);
  assert.equal(copies.find(copy => copy.reason === 'daily').state.sessions['2000-01-01:push'][0].reps, 12);
  copies = update(copies, before, '2026-10-01', { previous: imported, reason: 'restore' });
  assert.equal(copies.length, 2);
  assert.equal(copies.find(copy => copy.reason === 'restore').state.sessions['2000-01-01:push'][0].reps, 12);
  assert.ok(copies.some(copy => copy.state.sessions['2000-01-01:push'][0].reps === 8));
  assert.equal(new Set(copies.map(copy => JSON.stringify(copy.state.sessions))).size, 2);
});

test('restoring the oldest of seven copies keeps the restored current and replaced current represented', () => {
  let copies = [];
  for (let day = 1; day <= 7; day++) copies = update(copies, trained(day), `2026-10-${String(day).padStart(2, '0')}`);
  const oldest = copies.at(-1).state;
  copies = update(copies, oldest, '2026-10-08', { previous: trained(7), reason: 'restore' });
  assert.equal(copies.length, MAX_RECOVERY_BACKUPS);
  assert.equal(copies[0].reason, 'daily');
  assert.equal(copies[0].date, '2026-10-08');
  assert.equal(copies[0].state.sessions['2000-01-01:push'][0].reps, 1);
  assert.equal(copies[1].reason, 'restore');
  assert.equal(copies[1].state.sessions['2000-01-01:push'][0].reps, 7);
  assert.equal(new Set(copies.map(copy => JSON.stringify(copy.state.sessions))).size, MAX_RECOVERY_BACKUPS);
});

test('invalid recovery metadata and individual corrupt states are dropped without blocking a valid copy', () => {
  const good = update([], trained(8), '2026-10-01')[0];
  const raw = [null, {}, { ...good, id: 'bad-state', state: { nonsense: true } },
    { ...good, id: 'bad-date', date: '2026-02-30' }, { ...good, id: 'bad-time', createdAt: 'bad' },
    { ...good, id: 'bad-reason', reason: 'network' }, good, { ...good }];
  assert.deepEqual(cleanRecoveryEntries(raw, validateState), [good]);
  assert.equal(update(raw, trained(10), '2026-10-02').length, 2);
  assert.equal(update({ broken: true }, trained(10), '2026-10-02').length, 1);
});

// Klein transactioneel IndexedDB-model: writes zijn pas zichtbaar na oncomplete.
function fakeIndexedDB() {
  const saved = new Map();
  let failPutKey;
  const api = {
    saved,
    failNextPut(key) { failPutKey = key; },
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => true },
          close() {},
          transaction() {
            const staged = new Map(saved);
            let pending = 0;
            let finished = false;
            const tx = {
              error: null,
              objectStore() { return store; },
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
                saved.clear();
                for (const [key, value] of staged) saved.set(key, value);
                tx.oncomplete?.();
              });
            };
            const operation = (kind, key, value) => {
              const result = {};
              pending++;
              queueMicrotask(() => {
                if (finished) return;
                if (kind === 'put' && failPutKey === key) {
                  failPutKey = undefined;
                  result.error = tx.error = new Error('QuotaExceededError');
                  result.onerror?.();
                  tx.abort();
                  return;
                }
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
        request.onsuccess?.();
      });
      return request;
    },
  };
  return api;
}

test('saving current state and recovery is atomic; recovery failures reject and roll back both', async () => {
  const original = globalThis.indexedDB;
  const storage = fakeIndexedDB();
  globalThis.indexedDB = storage;
  try {
    const first = trained(8);
    await saveState(first);
    assert.deepEqual(await loadState(), first);
    const firstCopies = await listRecoveryBackups();
    assert.equal(firstCopies.length, 1);
    assert.equal(Object.hasOwn(firstCopies[0], 'state'), false);
    const before = structuredClone(storage.saved);
    storage.failNextPut('local-recovery');
    await assert.rejects(saveState(trained(12)), /QuotaExceededError/);
    assert.deepEqual(storage.saved, before);
    assert.deepEqual(await loadState(), first);
    await ensureRecoveryBackup(first);
    assert.deepEqual(await listRecoveryBackups(), firstCopies);
    const loaded = await loadRecoveryBackup(firstCopies[0].id);
    loaded.sessions['2000-01-01:push'][0].reps = 99;
    assert.equal((await loadRecoveryBackup(firstCopies[0].id)).sessions['2000-01-01:push'][0].reps, 8);
    assert.equal(await loadRecoveryBackup('missing'), null);
    assert.equal(Object.hasOwn(JSON.parse(exportBackup(first)), 'local-recovery'), false);
    await saveState(trained(12), { protectCurrent: 'import' });
    const protectedCopies = await listRecoveryBackups();
    const protectedId = protectedCopies.find(copy => copy.reason === 'import').id;
    assert.equal((await loadRecoveryBackup(protectedId)).sessions['2000-01-01:push'][0].reps, 8);
    assert.equal((await loadState()).sessions['2000-01-01:push'][0].reps, 12);
    storage.saved.set('local-recovery', [{ corrupt: true }]);
    await saveState(first);
    assert.equal((await listRecoveryBackups()).length, 1);
    assert.deepEqual(await loadState(), first);
    storage.saved.set('current', { corrupt: true });
    await saveState(trained(14), { protectCurrent: 'restore' });
    assert.equal((await loadState()).sessions['2000-01-01:push'][0].reps, 14);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
