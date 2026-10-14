import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, validateState, getWorkout, getPreviousWorkout, commitWorkout, localDate,
  exportBackup, loadState, saveState, applyPreset, addGroup, renameGroup, setGroupArchived,
  setBodyWeight, deleteBodyWeight,
} from '../data.js';

const exercise = (overrides = {}) => ({ id: 'exercise-1', name: 'Test exercise', weight: 20, reps: 12, ...overrides });

test('new data is empty and export/import roundtrips independently', () => {
  const state = createState();
  assert.equal(state.schemaVersion, 2);
  assert.deepEqual(state.groups.map(group => [group.id, group.archived]), [['push', false], ['pull', false], ['legs', false]]);
  assert.deepEqual(state.routines, { push: [], pull: [], legs: [] });
  assert.deepEqual(state.sessions, {});
  assert.deepEqual(state.bodyWeights, {});
  const restored = validateState(JSON.parse(exportBackup(state)));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.routines, state.routines);
  assert.notEqual(restored.groups, state.groups);
});

const legacyState = () => ({
  schemaVersion: 1,
  routines: { push: [exercise({ weight: 32.5 })], pull: [], legs: [exercise({ id: 'squat', name: 'Squat', weight: 50 })] },
  sessions: {
    '2000-01-03:push': [exercise({ weight: 30 })],
    '2000-01-01:push': [exercise({ weight: 25 })],
    '2000-01-02:pull': [],
  },
  ui: { date: '2000-01-03', split: 'pull' },
});

test('version 1 migrates all routines, history, ids and UI without changing its source', () => {
  const legacy = legacyState();
  const before = JSON.stringify(legacy);
  const migrated = validateState(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.routines, legacy.routines);
  assert.deepEqual(migrated.sessions, legacy.sessions);
  assert.deepEqual(migrated.ui, legacy.ui);
  assert.deepEqual(migrated.bodyWeights, {});
  assert.deepEqual(migrated.groups.map(group => group.id), ['push', 'pull', 'legs']);
  assert.ok(migrated.groups.every(group => !group.archived));
  assert.notEqual(migrated.routines.push[0], legacy.routines.push[0]);
  assert.notEqual(migrated.sessions['2000-01-03:push'][0], legacy.sessions['2000-01-03:push'][0]);
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(validateState(JSON.parse(exportBackup(legacy))), migrated);
  const withoutUi = legacyState();
  delete withoutUi.ui;
  assert.equal(validateState(withoutUi).ui, undefined);
});

test('legacy data supports reads and upgrades on the next immutable edit', () => {
  const legacy = legacyState();
  assert.equal(getWorkout(legacy, '2000-01-04', 'push')[0].weight, 30);
  assert.equal(getPreviousWorkout(legacy, '2000-01-04', 'push').date, '2000-01-03');
  const edited = commitWorkout(legacy, '2000-01-04', 'push', [exercise({ weight: 35 })]);
  assert.equal(edited.schemaVersion, 2);
  assert.equal(edited.sessions['2000-01-04:push'][0].weight, 35);
  assert.equal(legacy.sessions['2000-01-04:push'], undefined);
  assert.throws(() => validateState({ ...legacy, bodyWeights: {} }), /onbekende velden/);
  assert.throws(() => validateState({ ...legacy, sessions: { '2000-01-01:custom': [] } }), /bestaande trainingsgroep/);
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

test('each split continues from its own latest earlier training across days', () => {
  let state = createState();
  state = commitWorkout(state, '2000-04-01', 'push', [exercise({ name: 'Press', weight: 25, reps: 10 })]);
  state = commitWorkout(state, '2000-04-02', 'pull', [exercise({ name: 'Row', weight: 30, reps: 12 })]);
  state = commitWorkout(state, '2000-04-03', 'legs', [exercise({ name: 'Squat', weight: 50, reps: 8 })]);
  assert.deepEqual(getWorkout(state, '2000-04-04', 'push'), [exercise({ name: 'Press', weight: 25, reps: 10 })]);
  assert.deepEqual(getWorkout(state, '2000-04-04', 'pull'), [exercise({ name: 'Row', weight: 30, reps: 12 })]);
  assert.deepEqual(getWorkout(state, '2000-04-04', 'legs'), [exercise({ name: 'Squat', weight: 50, reps: 8 })]);

  state = commitWorkout(state, '2000-04-04', 'push', [exercise({ name: 'Press', weight: 27.5, reps: 11 })]);
  assert.deepEqual(getPreviousWorkout(state, '2000-04-07', 'push'), {
    date: '2000-04-04', exercises: [exercise({ name: 'Press', weight: 27.5, reps: 11 })],
  });
  assert.equal(getWorkout(state, '2000-04-07', 'pull')[0].weight, 30);
  assert.equal(getWorkout(state, '2000-04-07', 'legs')[0].weight, 50);
});

test('previous means the latest chronological date strictly before the target, not insertion order', () => {
  let state = createState();
  for (const [date, weight] of [['2000-06-10', 10], ['2000-06-15', 15], ['2000-06-01', 1], ['2000-06-12', 12]]) {
    state = commitWorkout(state, date, 'push', [exercise({ weight })]);
  }
  assert.equal(getPreviousWorkout(state, '2000-06-20', 'push').date, '2000-06-15');
  assert.equal(getPreviousWorkout(state, '2000-06-15', 'push').date, '2000-06-12');
  assert.equal(getPreviousWorkout(state, '2000-06-11', 'push').date, '2000-06-10');
  assert.equal(getWorkout(state, '2000-06-13', 'push')[0].weight, 12);
  assert.equal(getPreviousWorkout(state, '2000-06-01', 'push'), null);
  assert.equal(getPreviousWorkout(state, '2000-06-20', 'pull'), null);
});

test('an existing snapshot for today wins over the previous workout, including an empty snapshot', () => {
  let state = commitWorkout(createState(), '2000-01-01', 'push', [exercise({ weight: 10 })]);
  state = commitWorkout(state, localDate(), 'push', [exercise({ weight: 25 })]);
  assert.equal(getWorkout(state, localDate(), 'push')[0].weight, 25);
  assert.equal(getPreviousWorkout(state, localDate(), 'push').exercises[0].weight, 10);
  state = commitWorkout(state, localDate(), 'push', []);
  assert.deepEqual(getWorkout(state, localDate(), 'push'), []);
});

test('an intentionally empty previous workout takes precedence over older workouts and routine seeds', () => {
  let state = createState();
  state.routines.push = [exercise({ weight: 99 })];
  state = commitWorkout(state, '2000-01-01', 'push', [exercise({ weight: 10 })]);
  state = commitWorkout(state, '2000-01-02', 'push', []);
  assert.deepEqual(getPreviousWorkout(state, '2000-01-03', 'push'), { date: '2000-01-02', exercises: [] });
  assert.deepEqual(getWorkout(state, '2000-01-03', 'push'), []);
  assert.equal(getWorkout(state, '1999-12-31', 'push')[0].weight, 99);
});

test('previous workout reads create no sessions and all returned exercises are independent copies', () => {
  const state = commitWorkout(createState(), '2000-01-01', 'pull', [exercise({ weight: 25 })]);
  const before = JSON.stringify(state);
  const previous = getPreviousWorkout(state, '2000-01-03', 'pull');
  previous.exercises[0].weight = 99;
  previous.exercises.push(exercise({ id: 'new-exercise' }));
  const nextWorkout = getWorkout(state, '2000-01-03', 'pull');
  nextWorkout[0].reps = 8;
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(Object.keys(state.sessions), ['2000-01-01:pull']);
  const next = commitWorkout(state, '2000-01-03', 'pull', nextWorkout);
  assert.equal(next.sessions['2000-01-01:pull'][0].reps, 12);
  assert.equal(next.sessions['2000-01-03:pull'][0].reps, 8);
  nextWorkout[0].reps = 1;
  assert.equal(next.sessions['2000-01-03:pull'][0].reps, 8);
});

test('validation rejects malformed backups and dangerous numeric values', () => {
  const invalidStates = [null, [], {}, { ...createState(), schemaVersion: 3 },
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
  assert.throws(() => getWorkout(createState(), localDate(), 'other'), /trainingsgroep/);
  assert.throws(() => getPreviousWorkout(createState(), '2023-02-29', 'push'), /datum/);
  assert.throws(() => getPreviousWorkout(createState(), localDate(), 'other'), /trainingsgroep/);
});

test('valid fractional weights, leap dates, zero values and trimming survive validation', () => {
  const state = commitWorkout(createState(), '2024-02-29', 'legs', [exercise({ weight: 2.5, reps: 0, name: '  Test  ' })]);
  assert.equal(state.sessions['2024-02-29:legs'][0].name, 'Test');
  assert.equal(state.sessions['2024-02-29:legs'][0].weight, 2.5);
  assert.equal(state.sessions['2024-02-29:legs'][0].reps, 0);
});

test('custom groups can be renamed and archived without losing or changing their workouts', () => {
  const original = createState();
  const added = addGroup(original, { id: 'day-A_1', name: '  Eigen dag  ' });
  assert.equal(added.ui.split, 'day-A_1');
  assert.deepEqual(added.groups.at(-1), { id: 'day-A_1', name: 'Eigen dag', description: '', archived: false });
  assert.deepEqual(added.routines['day-A_1'], []);
  assert.equal(original.groups.length, 3);
  const trained = commitWorkout(added, '2000-02-01', 'day-A_1', [exercise({ name: 'Deadlift', weight: 60 })]);
  const renamed = renameGroup(trained, 'day-A_1', 'Kracht');
  assert.equal(renamed.groups.at(-1).name, 'Kracht');
  assert.equal(trained.groups.at(-1).name, 'Eigen dag');
  assert.deepEqual(renamed.sessions, trained.sessions);
  const archived = setGroupArchived(renamed, 'day-A_1', true);
  assert.equal(archived.ui.split, 'push');
  assert.equal(archived.groups.at(-1).archived, true);
  assert.equal(getWorkout(archived, '2000-02-01', 'day-A_1')[0].weight, 60);
  assert.equal(getPreviousWorkout(archived, '2000-02-02', 'day-A_1').date, '2000-02-01');
  const amended = commitWorkout(archived, '2000-02-01', 'day-A_1', [exercise({ weight: 65 })]);
  assert.equal(getWorkout(amended, '2000-02-02', 'day-A_1')[0].weight, 65);
  const restored = setGroupArchived(amended, 'day-A_1', false);
  assert.equal(restored.groups.at(-1).archived, false);
  assert.equal(restored.sessions['2000-02-01:day-A_1'][0].weight, 65);
  assert.equal(archived.sessions['2000-02-01:day-A_1'][0].weight, 60);
});

test('presets reuse group identities and custom names while preserving all routines and history', () => {
  let state = validateState(legacyState());
  state = addGroup(state, { id: 'full', name: 'Mijn hele lichaam' });
  state.groups.find(group => group.id === 'full').description = 'Eigen omschrijving';
  state.routines.full = [exercise({ weight: 40 })];
  state = commitWorkout(state, '2000-02-01', 'full', [exercise({ weight: 35 })]);
  const before = JSON.stringify(state);
  const full = applyPreset(state, 'full');
  assert.deepEqual(full.groups.filter(group => !group.archived).map(group => group.id), ['full']);
  assert.equal(full.ui.split, 'full');
  assert.equal(full.groups[0].name, 'Mijn hele lichaam');
  assert.equal(full.groups[0].description, 'Eigen omschrijving');
  assert.deepEqual(full.routines, state.routines);
  assert.deepEqual(full.sessions, state.sessions);
  assert.equal(JSON.stringify(state), before);

  const upperLower = applyPreset(full, 'upper-lower');
  assert.deepEqual(upperLower.groups.filter(group => !group.archived).map(group => group.id), ['upper', 'lower']);
  assert.equal(upperLower.ui.split, 'upper');
  assert.deepEqual(upperLower.routines.upper, []);
  assert.deepEqual(upperLower.routines.lower, []);
  assert.equal(upperLower.groups.length, 6);
  assert.deepEqual(upperLower.sessions, full.sessions);
  const ppl = applyPreset(upperLower, 'ppl');
  assert.deepEqual(ppl.groups.filter(group => !group.archived).map(group => group.id), ['push', 'pull', 'legs']);
  assert.equal(ppl.ui.split, 'push');
  assert.deepEqual(ppl.routines.push, state.routines.push);
  const fullAgain = applyPreset(ppl, 'full');
  assert.equal(fullAgain.groups.length, 6);
  assert.equal(fullAgain.groups[0].name, 'Mijn hele lichaam');
  assert.deepEqual(fullAgain.routines.full, state.routines.full);
  assert.deepEqual(fullAgain.sessions, state.sessions);
  assert.deepEqual(getWorkout(fullAgain, '2000-02-02', 'full'), state.sessions['2000-02-01:full']);
});

test('archiving never removes the final active group and duplicate ids never overwrite data', () => {
  const state = applyPreset(createState(), 'full');
  const before = JSON.stringify(state);
  assert.throws(() => setGroupArchived(state, 'full', true), /minstens één/);
  assert.throws(() => setGroupArchived(state, 'full', 'true'), /archiefstatus/);
  assert.throws(() => addGroup(state, { id: 'full', name: 'Overwrite' }), /bestaat al/);
  assert.throws(() => renameGroup(state, 'missing', 'Name'), /bestaande trainingsgroep/);
  assert.throws(() => setGroupArchived(state, 'missing', true), /bestaande trainingsgroep/);
  assert.throws(() => applyPreset(state, 'constructor'), /bestaand trainingsschema/);
  assert.equal(JSON.stringify(state), before);
});

test('group ids and map references are strictly validated, including prototype-related ids', () => {
  const state = createState();
  for (const id of ['__proto__', 'prototype', 'constructor', 'toString', 'hasOwnProperty', '', 'with:colon', 'with space', 'x'.repeat(65)]) {
    assert.throws(() => addGroup(state, { id, name: 'Unsafe' }), /veilige id/);
  }
  for (const name of ['', ' ', 'x'.repeat(41), null]) {
    assert.throws(() => addGroup(state, { id: 'valid', name }), /naam/);
    assert.throws(() => renameGroup(state, 'push', name), /naam/);
  }
  const alteredGroup = changes => ({ ...state, groups: [{ ...state.groups[0], ...changes }, ...state.groups.slice(1)] });
  for (const malformed of [
    { ...state, groups: [] },
    { ...state, groups: [...state.groups, { ...state.groups[0] }] },
    { ...state, groups: state.groups.map(group => ({ ...group, archived: true })) },
    alteredGroup({ id: '__proto__' }), alteredGroup({ name: '' }), alteredGroup({ archived: 1 }),
    alteredGroup({ description: null }), alteredGroup({ description: 'x'.repeat(101) }),
    alteredGroup({ unknown: true }),
    { ...state, routines: { push: [], pull: [] } },
    { ...state, routines: { ...state.routines, unknown: [] } },
    { ...state, routines: JSON.parse('{"push":[],"pull":[],"legs":[],"__proto__":[]}') },
    { ...state, sessions: { '2000-01-01:unknown': [] } },
    { ...state, sessions: { '2000-01-01:constructor': [] } },
    { ...state, ui: { split: 'unknown', date: '2000-01-01' } },
    { ...state, bodyWeights: [] },
    { ...state, bodyWeights: JSON.parse('{"__proto__": 75}') },
  ]) assert.throws(() => validateState(malformed), /Ongeldige trainingsgegevens/);

  const archivedSelection = setGroupArchived(state, 'pull', true);
  archivedSelection.ui.split = 'pull';
  assert.equal(validateState(archivedSelection).ui.split, 'pull');
});

test('the 24-group bound includes archived groups and failed presets do not partially mutate state', () => {
  let state = createState();
  for (let i = 0; i < 21; i++) state = addGroup(state, { id: `custom-${i}`, name: `Custom ${i}` });
  const before = JSON.stringify(state);
  assert.equal(state.groups.length, 24);
  assert.throws(() => addGroup(state, { id: 'too-many', name: 'Extra' }), /1 tot 24/);
  assert.throws(() => applyPreset(state, 'full'), /1 tot 24/);
  assert.equal(JSON.stringify(state), before);
  const existingOnly = applyPreset(state, 'ppl');
  assert.equal(existingOnly.groups.length, 24);
  assert.equal(existingOnly.groups.filter(group => !group.archived).length, 3);
});

test('body-weight measurements roundtrip independently of exercise weights and survive presets', () => {
  const trained = commitWorkout(createState(), '2000-01-01', 'push', [exercise({ weight: 25 })]);
  const first = setBodyWeight(trained, '2000-01-01', 78.25);
  const second = setBodyWeight(first, '2000-01-02', 77.9);
  const corrected = setBodyWeight(second, '2000-01-01', 78.1);
  assert.deepEqual(corrected.bodyWeights, { '2000-01-01': 78.1, '2000-01-02': 77.9 });
  assert.equal(first.bodyWeights['2000-01-01'], 78.25);
  assert.deepEqual(trained.bodyWeights, {});
  assert.equal(corrected.sessions['2000-01-01:push'][0].weight, 25);
  const switched = applyPreset(corrected, 'full');
  const restored = validateState(JSON.parse(exportBackup(switched)));
  assert.deepEqual(restored.bodyWeights, corrected.bodyWeights);
  assert.equal(restored.schemaVersion, 2);
  const removed = deleteBodyWeight(restored, '2000-01-01');
  assert.deepEqual(removed.bodyWeights, { '2000-01-02': 77.9 });
  assert.deepEqual(deleteBodyWeight(removed, '2000-01-01'), removed);
  assert.equal(restored.bodyWeights['2000-01-01'], 78.1);
});

test('body-weight entries require finite numeric kg, valid dates and at most 20,000 measurements', () => {
  const state = createState();
  for (const weight of [0, 0.99, 500.01, -1, Infinity, NaN, '75', null]) {
    assert.throws(() => setBodyWeight(state, '2000-01-01', weight), /lichaamsgewicht/);
    assert.throws(() => validateState({ ...state, bodyWeights: { '2000-01-01': weight } }), /lichaamsgewicht/);
  }
  assert.equal(setBodyWeight(state, '2000-01-01', 1).bodyWeights['2000-01-01'], 1);
  assert.equal(setBodyWeight(state, '2000-01-01', 500).bodyWeights['2000-01-01'], 500);
  assert.throws(() => setBodyWeight(state, '2001-02-29', 75), /datum/);
  assert.throws(() => deleteBodyWeight(state, 'bad-date'), /datum/);
  const measurements = {};
  for (let i = 0; i < 20000; i++) {
    measurements[new Date(Date.UTC(1900, 0, i + 1)).toISOString().slice(0, 10)] = 75;
  }
  const full = validateState({ ...state, bodyWeights: measurements });
  assert.equal(Object.keys(full.bodyWeights).length, 20000);
  assert.equal(setBodyWeight(full, '1900-01-01', 76).bodyWeights['1900-01-01'], 76);
  assert.throws(() => setBodyWeight(full, '2000-01-01', 75), /te veel gewichtsmetingen/);
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
