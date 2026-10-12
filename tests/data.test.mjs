import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, validateState, getWorkout, commitWorkout, localDate, exportBackup, loadState, saveState } from '../data.js';

const exercise = (overrides = {}) => ({ id: 'exercise-1', name: 'Test exercise', weight: 20, reps: 12, ...overrides });

test('new data is empty and export/import roundtrips independently', () => {
  const state = createState();
  assert.deepEqual(state.routines, { push: [], pull: [], legs: [] });
  assert.deepEqual(state.sessions, {});
  const restored = validateState(JSON.parse(exportBackup(state)));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.routines, state.routines);
});

test('today updates the default routine but preserves earlier snapshots', () => {
  const empty = createState();
  const earlier = '2000-01-01';
  const today = localDate();
  const historical = commitWorkout(empty, earlier, 'push', [exercise({ weight: 10 })]);
  const current = commitWorkout(historical, today, 'push', [exercise({ weight: 30 })]);
  const removed = commitWorkout(current, today, 'push', []);
  assert.equal(current.routines.push[0].weight, 30);
  assert.equal(current.sessions[`${earlier}:push`][0].weight, 10);
  assert.deepEqual(removed.routines.push, []);
  assert.deepEqual(removed.sessions[`${today}:push`], []);
  assert.equal(removed.sessions[`${earlier}:push`][0].weight, 10);
  assert.deepEqual(empty.sessions, {});
  assert.equal(current.routines.push.length, 1);
});

test('editing a historical or future workout leaves the current routine alone', () => {
  const current = commitWorkout(createState(), localDate(), 'pull', [exercise({ weight: 25 })]);
  const past = commitWorkout(current, '2000-01-01', 'pull', [exercise({ weight: 15 })]);
  const future = commitWorkout(past, '2199-01-01', 'pull', [exercise({ weight: 35 })]);
  assert.equal(future.routines.pull[0].weight, 25);
  assert.equal(future.sessions['2000-01-01:pull'][0].weight, 15);
  assert.equal(future.sessions['2199-01-01:pull'][0].weight, 35);
});

test('opening a date only returns an independent copy and creates no history', () => {
  const state = commitWorkout(createState(), localDate(), 'legs', [exercise()]);
  const before = JSON.stringify(state);
  const workout = getWorkout(state, '2001-01-01', 'legs');
  workout[0].weight = 50;
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.keys(state.sessions).length, 1);
  const saved = getWorkout(state, localDate(), 'legs');
  saved[0].name = 'Changed';
  assert.equal(state.sessions[`${localDate()}:legs`][0].name, 'Test exercise');
});

test('validation rejects malformed backups and dangerous numeric values', () => {
  const invalidStates = [null, [], {}, { ...createState(), schemaVersion: 2 },
    { ...createState(), extra: 'unexpected' }, { ...createState(), routines: { push: [], pull: [] } },
    { ...createState(), sessions: [] }, { ...createState(), ui: { date: '2024-02-30', split: 'push' } },
    { ...createState(), sessions: { '2024-02-30:push': [] } },
    { ...createState(), sessions: JSON.parse('{"__proto__": []}') }];
  for (const state of invalidStates) assert.throws(() => validateState(state), /Ongeldige/);
  for (const changes of [{ weight: NaN }, { weight: Infinity }, { weight: -1 }, { weight: '20' },
    { weight: 2001 }, { reps: 1.5 }, { reps: -1 }, { reps: Infinity }, { reps: '12' },
    { reps: 1000 }, { name: '' }, { name: ' ' }, { name: 'x'.repeat(121) }, { id: '<script>' }, { extra: 1 }]) {
    assert.throws(() => commitWorkout(createState(), localDate(), 'push', [exercise(changes)]), /Ongeldige/);
  }
  assert.throws(() => commitWorkout(createState(), localDate(), 'push', [exercise(), exercise()]), /unieke/);
  assert.throws(() => getWorkout(createState(), '2023-02-29', 'push'), /datum/);
  assert.throws(() => getWorkout(createState(), localDate(), 'other'), /Push/);
});

test('valid fractional weights, leap dates, zero values and trimming survive validation', () => {
  const state = commitWorkout(createState(), '2024-02-29', 'legs', [exercise({ weight: 2.5, reps: 0, name: '  Test  ' })]);
  assert.equal(state.sessions['2024-02-29:legs'][0].name, 'Test');
  assert.equal(state.sessions['2024-02-29:legs'][0].weight, 2.5);
  assert.equal(state.sessions['2024-02-29:legs'][0].reps, 0);
});

test('workout counts and total backup size are bounded', () => {
  assert.throws(() => commitWorkout(createState(), localDate(), 'push',
    Array.from({ length: 201 }, (_, i) => exercise({ id: `ex-${i}` }))), /maximaal/);
  const oversized = createState();
  const largeWorkout = Array.from({ length: 200 }, (_, i) => exercise({ id: `ex-${i}`, name: '💪'.repeat(50) }));
  for (let i = 0; i < 120; i++) {
    const date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    oversized.sessions[`${date}:push`] = largeWorkout;
  }
  assert.throws(() => validateState(oversized), /groter dan 5 MB/);
});

test('local dates use local calendar components, not a UTC conversion', () => {
  const date = new Date(2026, 9, 12, 0, 1);
  assert.equal(localDate(date), '2026-10-12');
  assert.throws(() => localDate(new Date('invalid')), /datum/);
});

test('missing browser storage reports an error instead of pretending to save', async () => {
  assert.equal(globalThis.indexedDB, undefined);
  await assert.rejects(loadState(), /Opslag is niet beschikbaar/);
  await assert.rejects(saveState(createState()), /Opslag is niet beschikbaar/);
});
