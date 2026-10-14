import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, validateState, getWorkout, getPreviousWorkout, commitWorkout, localDate,
  exportBackup, loadState, saveState, applyPreset, addGroup, renameGroup, setGroupArchived,
  setBodyWeight, deleteBodyWeight, setExerciseRanking,
} from '../data.js';

const exercise = (overrides = {}) => ({ id: 'exercise-1', name: 'Test exercise', weight: 20, reps: 12, sets: 1, ...overrides });

test('new data is empty and export/import roundtrips independently', () => {
  const state = createState();
  assert.equal(state.schemaVersion, 4);
  assert.deepEqual(state.groups.map(group => [group.id, group.archived]), [['push', false], ['pull', false], ['legs', false]]);
  assert.deepEqual(state.routines, { push: [], pull: [], legs: [] });
  assert.deepEqual(state.sessions, {});
  assert.deepEqual(state.bodyWeights, {});
  const restored = validateState(JSON.parse(exportBackup(state)));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.routines, state.routines);
  assert.notEqual(restored.groups, state.groups);
});

const legacyExercise = (overrides = {}) => { const { sets, ...old } = exercise(overrides); return old; };
const legacyState = () => ({
  schemaVersion: 1,
  routines: { push: [legacyExercise({ weight: 32.5 })], pull: [], legs: [legacyExercise({ id: 'squat', name: 'Squat', weight: 50 })] },
  sessions: {
    '2000-01-03:push': [legacyExercise({ weight: 30 })],
    '2000-01-01:push': [legacyExercise({ weight: 25 })],
    '2000-01-02:pull': [],
  },
  ui: { date: '2000-01-03', split: 'pull' },
});

test('version 1 migrates all routines, history, ids and UI without changing its source', () => {
  const legacy = legacyState();
  const before = JSON.stringify(legacy);
  const migrated = validateState(legacy);
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.routines, Object.fromEntries(Object.entries(legacy.routines).map(([id, list]) => [id, list.map(item => ({ ...item, sets: 1 }))])));
  assert.deepEqual(migrated.sessions, Object.fromEntries(Object.entries(legacy.sessions).map(([id, list]) => [id, list.map(item => ({ ...item, sets: 1 }))])));
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
  assert.equal(edited.schemaVersion, 4);
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
  const invalidStates = [null, [], {}, { ...createState(), schemaVersion: 5 },
    { ...createState(), extra: 'unexpected' }, { ...createState(), routines: { push: [], pull: [] } },
    { ...createState(), sessions: [] }, { ...createState(), ui: { date: '2024-02-30', split: 'push' } },
    { ...createState(), sessions: { '2024-02-30:push': [] } },
    { ...createState(), sessions: JSON.parse('{"__proto__": []}') }];
  for (const state of invalidStates) assert.throws(() => validateState(state), /Ongeldige/);
  for (const changes of [{ weight: NaN }, { weight: Infinity }, { weight: -1 }, { weight: '20' },
    { weight: 2001 }, { reps: 1.5 }, { reps: -1 }, { reps: Infinity }, { reps: '12' },
    { reps: 1000 }, { sets: 0 }, { sets: 100 }, { sets: 1.5 }, { sets: '3' }, { sets: NaN }, { sets: Infinity }, { name: '' }, { name: ' ' }, { name: 'x'.repeat(121) }, { id: '<script>' }, { extra: 1 }]) {
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
  assert.equal(restored.schemaVersion, 4);
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
  for (let i = 0; i < 150; i++) {
    const date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    oversized.sessions[`${date}:push`] = largeWorkout;
  }
  assert.throws(() => validateState(oversized), /groter dan 7 MB/);
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


test('version 2 migrates sets while preserving custom groups and body-weight history', () => {
  const source = addGroup(createState(), { id: 'custom', name: 'Custom' });
  source.schemaVersion = 2;
  source.routines.custom = [legacyExercise({ weight: 25, reps: 8 })];
  source.sessions['2000-01-01:custom'] = [legacyExercise({ weight: 25, reps: 8 })];
  source.bodyWeights['2000-01-01'] = 75;
  const before = JSON.stringify(source);
  const next = validateState(source);
  assert.equal(next.schemaVersion, 4);
  assert.equal(next.routines.custom[0].sets, 1);
  assert.equal(next.sessions['2000-01-01:custom'][0].sets, 1);
  assert.deepEqual(next.groups, source.groups);
  assert.deepEqual(next.bodyWeights, source.bodyWeights);
  assert.equal(getWorkout(source, '2000-01-02', 'custom')[0].sets, 1);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(validateState(JSON.parse(exportBackup(source))), next);
});

test('sets persist independently across previous workouts and backup roundtrips', () => {
  const first = commitWorkout(createState(), '2000-01-01', 'push', [exercise({ sets: 3, reps: 10 })]);
  const second = commitWorkout(first, '2000-01-02', 'push', [exercise({ sets: 4, reps: 8 })]);
  assert.equal(first.sessions['2000-01-01:push'][0].sets, 3);
  assert.equal(getWorkout(second, '2000-01-03', 'push')[0].sets, 4);
  assert.equal(getPreviousWorkout(second, '2000-01-03', 'push').exercises[0].sets, 4);
  assert.deepEqual(validateState(JSON.parse(exportBackup(second))), second);
  const missing = createState();
  missing.routines.push = [legacyExercise()];
  assert.throws(() => validateState(missing), /ontbrekende/);
  assert.equal(commitWorkout(createState(), '2000-01-01', 'push', [legacyExercise()]).sessions['2000-01-01:push'][0].sets, 1);
});


test('near-5 MiB version-2 backups migrate and export without sets crossing the current size bound', () => {
  const source = createState();
  source.schemaVersion = 2;
  const workout = Array.from({ length: 200 }, (_, i) => legacyExercise({ id: `ex-${i}`, name: 'x'.repeat(120) }));
  const perSessionBytes = new TextEncoder().encode(JSON.stringify(workout)).byteLength + 21;
  const sessionCount = Math.floor((5 * 1024 * 1024 - 1024) / perSessionBytes);
  for (let i = 0; i < sessionCount; i++) {
    const date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    source.sessions[`${date}:push`] = workout;
  }
  const oldBytes = new TextEncoder().encode(JSON.stringify(source)).byteLength;
  assert.ok(oldBytes < 5 * 1024 * 1024);
  assert.ok(oldBytes > 4.9 * 1024 * 1024);
  const migrated = validateState(source);
  const serialized = exportBackup(migrated);
  assert.ok(new TextEncoder().encode(serialized).byteLength > 5 * 1024 * 1024);
  assert.ok(new TextEncoder().encode(serialized).byteLength < 6 * 1024 * 1024);
  assert.deepEqual(validateState(JSON.parse(serialized)), migrated);
});


test('version 3 migrates to version 4 without changing sets or exercise identities', () => {
  const source = commitWorkout(createState(), '2000-01-01', 'push', [exercise({ sets: 4, reps: 8 })]);
  source.schemaVersion = 3;
  const before = JSON.stringify(source);
  const next = validateState(source);
  assert.equal(next.schemaVersion, 4);
  assert.deepEqual(next.sessions, source.sessions);
  assert.equal(next.sessions['2000-01-01:push'][0].sets, 4);
  assert.equal(JSON.stringify(source), before);
});

test('optional catalog overrides persist independently through previous workouts, renames and backups', () => {
  const first = commitWorkout(createState(), '2000-01-01', 'push', [exercise({ name: 'Mijn oefening', sets: 3, rankingKey: 'ex:bench-press' })]);
  const prefilling = getWorkout(first, '2000-01-02', 'push');
  assert.equal(prefilling[0].rankingKey, 'ex:bench-press');
  prefilling[0].name = 'Nieuwe naam';
  const renamed = commitWorkout(first, '2000-01-02', 'push', prefilling);
  assert.equal(getPreviousWorkout(renamed, '2000-01-03', 'push').exercises[0].rankingKey, 'ex:bench-press');
  assert.deepEqual(validateState(JSON.parse(exportBackup(renamed))), renamed);
  assert.equal(first.sessions['2000-01-01:push'][0].name, 'Mijn oefening');
  delete prefilling[0].rankingKey;
  const automatic = commitWorkout(renamed, '2000-01-03', 'push', prefilling);
  assert.equal(Object.hasOwn(automatic.sessions['2000-01-03:push'][0], 'rankingKey'), false);
  assert.equal(renamed.sessions['2000-01-02:push'][0].rankingKey, 'ex:bench-press');
  for (const rankingKey of [null, undefined, 1, '', 'custom:free name', 'ex:unknown', '__proto__']) {
    assert.throws(() => commitWorkout(createState(), '2000-01-01', 'push', [exercise({ rankingKey })]), /ranglijstoefening/);
  }
});


test('ranking corrections change only metadata across one exercise identity and can be cleared everywhere', () => {
  let source = commitWorkout(createState(), localDate(), 'push', [exercise({ name: 'Nieuwe naam', sets: 4, reps: 8 }), exercise({ id: 'other', rankingKey: 'ex:squat' })]);
  source = commitWorkout(source, '2000-01-01', 'push', [exercise({ name: 'Oude naam', weight: 10, sets: 2, reps: 10 })]);
  source = commitWorkout(source, '2000-01-02', 'push', [exercise({ name: 'Andere naam', weight: 15, sets: 3, reps: 12 })]);
  source = commitWorkout(source, '2000-01-01', 'pull', [exercise({ name: 'Zelfde ID ander onderdeel', rankingKey: 'ex:deadlift' })]);
  const before = JSON.stringify(source);
  const linked = setExerciseRanking(source, 'push', 'exercise-1', 'ex:bench-press');
  assert.equal(linked.routines.push[0].rankingKey, 'ex:bench-press');
  for (const [key, workout] of Object.entries(linked.sessions)) {
    if (key.endsWith(':push')) assert.equal(workout.find(item => item.id === 'exercise-1').rankingKey, 'ex:bench-press');
  }
  assert.equal(linked.sessions['2000-01-01:pull'][0].rankingKey, 'ex:deadlift');
  assert.equal(linked.routines.push[1].rankingKey, 'ex:squat');
  const stripped = structuredClone(linked);
  for (const workout of [stripped.routines.push, ...Object.entries(stripped.sessions).filter(([key]) => key.endsWith(':push')).map(([, workout]) => workout)]) {
    for (const item of workout) if (item.id === 'exercise-1') delete item.rankingKey;
  }
  assert.deepEqual(stripped, source);
  assert.equal(JSON.stringify(source), before);
  const automatic = setExerciseRanking(linked, 'push', 'exercise-1', null);
  assert.deepEqual(automatic, source);
  assert.deepEqual(validateState(JSON.parse(exportBackup(linked))), linked);
  for (const rankingKey of ['ex:unknown', 'custom:name', undefined, 1]) {
    assert.throws(() => setExerciseRanking(source, 'push', 'exercise-1', rankingKey), /ranglijstoefening/);
  }
  assert.throws(() => setExerciseRanking(source, 'missing', 'exercise-1', null), /bestaande trainingsgroep/);
  assert.throws(() => setExerciseRanking(source, 'push', 'missing', null), /bestaande oefening/);
  assert.equal(JSON.stringify(source), before);
});

test('near-6 MiB version-3 backups migrate without adding unused ranking metadata', () => {
  const source = createState();
  source.schemaVersion = 3;
  const workout = Array.from({ length: 200 }, (_, i) => exercise({ id: `ex-${i}`, name: 'x'.repeat(120) }));
  const perSessionBytes = new TextEncoder().encode(JSON.stringify(workout)).byteLength + 21;
  const sessionCount = Math.floor((6 * 1024 * 1024 - 1024) / perSessionBytes);
  for (let i = 0; i < sessionCount; i++) {
    const date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    source.sessions[`${date}:push`] = workout;
  }
  const oldBytes = new TextEncoder().encode(JSON.stringify(source)).byteLength;
  assert.ok(oldBytes < 6 * 1024 * 1024);
  assert.ok(oldBytes > 5.9 * 1024 * 1024);
  const migrated = validateState(source);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(new TextEncoder().encode(exportBackup(migrated)).byteLength, oldBytes);
  assert.equal(Object.hasOwn(migrated.sessions['2000-01-01:push'][0], 'rankingKey'), false);
  assert.deepEqual(validateState(JSON.parse(exportBackup(migrated))), migrated);
});
