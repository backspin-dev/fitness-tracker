import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISE_CATALOG, normalizeExerciseName, detectExercise, resolveRankingExercise, suggestExercises,
} from '../exercise-catalog.js';

const key = name => resolveRankingExercise({ name }).key;

test('normalization handles compatibility text, case, spacing and punctuation without removing words', () => {
  assert.equal(normalizeExerciseName('  ＢＥＮＣＨ  —  Press!!! '), 'bench press');
  assert.equal(normalizeExerciseName('Bench (press) / MACHINE'), 'bench press machine');
  assert.equal(normalizeExerciseName('  Élévation latérale  '), 'élévation latérale');
  assert.equal(normalizeExerciseName(null), '');
  assert.notEqual(normalizeExerciseName('Élévation'), normalizeExerciseName('Elevation'));
});

test('only explicit curated aliases unite spelling and plural variants', () => {
  for (const name of ['Squat', 'Squats', ' SQUATS!! ', 'Ｓｑｕａｔｓ']) assert.equal(key(name), 'ex:squat');
  assert.equal(key('BenchPress'), 'ex:bench-press');
  assert.equal(key('Bench.Press'), 'ex:bench-press');
  assert.equal(key('BenchPressMachine'), 'ex:bench-press-machine');
  assert.equal(key('Pull ups'), 'ex:pull-up');
  assert.equal(key('Skullcrushers'), 'ex:skull-crusher');
  assert.equal(detectExercise('Squatted'), null);
  assert.equal(detectExercise('Super squats'), null);
});

test('equipment, position and exercise variants never merge through generic stripping', () => {
  const benchKeys = ['Bench press', 'Bench press machine', 'Dumbbell bench press', 'Incline bench press', 'Incline dumbbell bench press'].map(key);
  assert.equal(new Set(benchKeys).size, benchKeys.length);
  assert.notEqual(key('Squat'), key('Front squat'));
  assert.notEqual(key('Front squat'), key('Back squat'));
  assert.notEqual(key('Shoulder press machine'), key('Dumbbell shoulder press'));
  assert.notEqual(key('Triceps pushdown bar'), key('Triceps pushdown rope'));
  assert.notEqual(key('Seated leg curl'), key('Lying leg curl'));
  assert.equal(detectExercise('Smith bench press'), null);
  assert.notEqual(key('Smith bench press'), key('Bench press'));
});

test('the original exercise labels are covered by explicit catalog aliases', () => {
  const expected = {
    'Chest press apparaat': 'ex:chest-press-machine',
    'Incline bench': 'ex:incline-bench-press',
    'Fly machine': 'ex:chest-fly-machine',
    'Shoulder press machine': 'ex:shoulder-press-machine',
    'Side raises dumbbell': 'ex:dumbbell-lateral-raise',
    'Tricep push down bar': 'ex:triceps-pushdown-bar',
    Skullcrushers: 'ex:skull-crusher',
  };
  for (const [name, expectedKey] of Object.entries(expected)) assert.equal(key(name), expectedKey);
});

test('unknown names get their own exact normalized list with deterministic labels and no generic stemming', () => {
  assert.deepEqual(resolveRankingExercise({ name: '  Mijn-Eigen   OEFENING! ' }), {
    key: 'custom:mijn eigen oefening', label: 'Mijn eigen oefening',
  });
  assert.deepEqual(resolveRankingExercise({ name: 'mijn eigen oefening' }), resolveRankingExercise({ name: 'MIJN EIGEN OEFENING!!!' }));
  assert.notEqual(key('Hammer curl'), key('Hammer curls'));
  assert.notEqual(key('Eigen oefening machine'), key('Eigen oefening'));
  assert.notEqual(key('Eigen oefening dumbbell'), key('Eigen oefening barbell'));
  assert.equal(detectExercise('Onbekende oefening'), null);
});

test('symbol-only names remain free and do not block a ranking; compatibility expansion stays within key bound', () => {
  assert.deepEqual(resolveRankingExercise({ name: ' 🏋️ ' }), { key: 'custom:🏋️', label: '🏋️' });
  assert.equal(key('!!!'), 'custom:!!!');
  assert.notEqual(key('🏋️'), key('🤸'));
  const expanded = resolveRankingExercise({ name: 'ﷺ'.repeat(120) });
  assert.ok(expanded.key.length <= 4096);
  assert.ok(expanded.key.length > 120);
});

test('capitalization preserves the canonical key even when Unicode uppercase expands a letter', () => {
  for (const name of ['ß test', 'ı test', 'ſ test', 'éigen oefening', '🏋️']) {
    const resolved = resolveRankingExercise({ name });
    assert.equal(`custom:${normalizeExerciseName(resolved.label)}`, resolved.key);
  }
  assert.deepEqual(resolveRankingExercise({ name: 'ß test' }), { key: 'custom:ß test', label: 'ß test' });
  assert.deepEqual(resolveRankingExercise({ name: 'ı test' }), { key: 'custom:ı test', label: 'ı test' });
  assert.deepEqual(resolveRankingExercise({ name: 'Mijn Eigen Oefening' }), { key: 'custom:mijn eigen oefening', label: 'Mijn eigen oefening' });
});

test('an explicit known override survives renames, while clearing it restores automatic matching', () => {
  const exercise = { name: 'Mijn press', rankingKey: 'ex:bench-press' };
  assert.deepEqual(resolveRankingExercise(exercise), { key: 'ex:bench-press', label: 'Bench press' });
  exercise.name = 'Heel andere naam';
  assert.equal(resolveRankingExercise(exercise).key, 'ex:bench-press');
  delete exercise.rankingKey;
  assert.equal(resolveRankingExercise(exercise).key, 'custom:heel andere naam');
  assert.equal(resolveRankingExercise({ name: 'Squats', rankingKey: 'ex:unknown' }).key, 'ex:squat');
  assert.equal(resolveRankingExercise({ name: 'Squats', rankingKey: null }).key, 'ex:squat');
});

test('suggestions search labels and aliases locally, stay bounded and do not change the catalog', () => {
  assert.equal(suggestExercises('').length, 0);
  assert.equal(suggestExercises('press').length, 8);
  assert.ok(suggestExercises('push down').some(item => item.key === 'ex:triceps-pushdown-bar'));
  assert.ok(suggestExercises('apparaat').length > 0);
  assert.equal(suggestExercises('unknown phrase').length, 0);
  assert.ok(Object.isFrozen(EXERCISE_CATALOG));
  assert.ok(EXERCISE_CATALOG.every(item => Object.isFrozen(item) && Object.isFrozen(item.aliases)));
  const aliases = new Map();
  for (const item of EXERCISE_CATALOG) {
    for (const alias of [item.label, ...item.aliases]) {
      const normalized = normalizeExerciseName(alias);
      assert.ok(!aliases.has(normalized) || aliases.get(normalized) === item.key);
      aliases.set(normalized, item.key);
    }
  }
});


test('the researched catalog covers practical equipment and squat variations while retaining free names', () => {
  assert.equal(EXERCISE_CATALOG.length, 150);
  assert.equal(new Set(EXERCISE_CATALOG.map(item => item.key)).size, EXERCISE_CATALOG.length);
  const squatSuggestions = suggestExercises('squat');
  assert.equal(squatSuggestions.length, 8);
  assert.ok(squatSuggestions.some(item => item.key === 'ex:back-squat'));
  assert.ok(squatSuggestions.some(item => item.key === 'ex:front-squat'));
  assert.ok(squatSuggestions.some(item => item.key === 'ex:goblet-squat'));
  assert.ok(squatSuggestions.some(item => item.key === 'ex:jump-squat'));
  for (const [query, expected] of [
    ['squat dumbbell', 'ex:dumbbell-sumo-squat'],
    ['bulgarian', 'ex:bulgarian-split-squat'],
    ['sumo', 'ex:sumo-squat'],
    ['step up', 'ex:dumbbell-step-up'],
    ['tricep', 'ex:triceps-pushdown-bar'],
    ['chest machine', 'ex:chest-press-machine'],
    ['trx', 'ex:trx-row'],
    ['kettlebell', 'ex:kettlebell-front-squat'],
  ]) assert.ok(suggestExercises(query).some(item => item.key === expected), query);
  assert.notEqual(key('Dumbbell front squat'), key('Kettlebell front squat'));
  assert.notEqual(key('Bodyweight squat'), key('Back squat'));
  assert.notEqual(key('Leg press calf raise'), key('Standing calf raise machine'));
  assert.notEqual(key('Dumbbell hammer curl'), key('Cable biceps curl'));
  assert.equal(key('Mijn volledig eigen oefening'), 'custom:mijn volledig eigen oefening');
});
