import test from 'node:test';
import assert from 'node:assert/strict';
import { commitWorkout, getWorkout } from '../data.js';
import {
  listExerciseSeries, exerciseSetSummary, exerciseRepSummary, bodyWeightSeries, trainingSummary, weeklyTrainingCounts,
  latestWorkoutComparison, renderLineChart, renderBarChart,
} from '../stats.js';

const exercise = (overrides = {}) => ({ id: 'lift-1', name: 'Example lift', weight: 20, reps: 10, sets: 1, ...overrides });
const state = (overrides = {}) => ({
  schemaVersion: 5,
  groups: [
    { id: 'push', name: 'Push', description: '', archived: false },
    { id: 'old-pull', name: 'Old pull', description: '', archived: true },
  ],
  routines: { push: [exercise()], 'old-pull': [] },
  sessions: {}, bodyWeights: {}, ...overrides,
});

test('empty saved data never turns routines into workouts or exercise progress', () => {
  const input = state({ sessions: { '2024-04-01:push': [] } });
  assert.deepEqual(listExerciseSeries(input), []);
  assert.deepEqual(trainingSummary(input, '2024-04-02'), { total: 0, last28Days: 0, lastDate: null });
  assert.deepEqual(bodyWeightSeries(input), []);
  assert.deepEqual(weeklyTrainingCounts(input, '2024-04-02', 2), [
    { date: '2024-03-25', value: 0 }, { date: '2024-04-01', value: 0 },
  ]);
  assert.equal(latestWorkoutComparison(input, 'push', '2024-04-02'), null);
});

test('exercise series use stable IDs across renames and never merge equal names or groups', () => {
  const input = state({ sessions: {
    '2024-03-09:push': [exercise({ name: 'Renamed lift', weight: 25, sets: 3 })],
    '2024-03-01:push': [exercise(), exercise({ id: 'lift-2' })],
    '2024-03-02:old-pull': [exercise({ weight: 30 })],
  } });
  const before = JSON.stringify(input);
  const result = listExerciseSeries(input);
  assert.equal(result.length, 3);
  assert.deepEqual(result.find(item => item.key === 'push:lift-1'), {
    key: 'push:lift-1', name: 'Renamed lift', groupName: 'Push', points: [
      { date: '2024-03-01', weight: 20, reps: 10, sets: 1, setDetails: [{ weight: 20, reps: 10 }], totalReps: 10, volume: 200 },
      { date: '2024-03-09', weight: 25, reps: 10, sets: 3, setDetails: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }], totalReps: 30, volume: 750 },
    ],
  });
  assert.equal(result.find(item => item.key === 'old-pull:lift-1').groupName, 'Old pull');
  result[0].points[0].weight = 999;
  result[0].points[0].setDetails[0].reps = 999;
  assert.equal(JSON.stringify(input), before);
});

test('rep totals multiply sets and handle legacy data, zero reps and future entries', () => {
  assert.deepEqual(exerciseRepSummary([], '2024-04-02'), { totalReps: 0, trainingCount: 0 });
  const points = [
    { date: '2024-03-31', weight: 20, reps: 12 },
    { date: '2024-04-01', weight: 25, reps: 0, sets: 4 },
    { date: '2024-04-02', weight: 20, reps: 8, sets: 3 },
    { date: '2024-04-03', weight: 20, reps: 100, sets: 99 },
  ];
  const before = JSON.stringify(points);
  assert.deepEqual(exerciseRepSummary(points, '2024-04-02'), { totalReps: 36, trainingCount: 3 });
  assert.equal(JSON.stringify(points), before);
  assert.throws(() => exerciseRepSummary([], '2023-02-29'), /datum/);
  assert.throws(() => exerciseRepSummary(points, '2 april 2024'), /datum/);
});

test('different sets retain every value and use one real heaviest set for both chart metrics', () => {
  const input = exercise({ weight: 20, reps: 12, sets: 4,
    setValues: [null, { weight: 30, reps: 5 }, { weight: 30, reps: 8 }, { reps: 0 }] });
  const before = JSON.stringify(input);
  const result = exerciseSetSummary(input);
  assert.deepEqual(result, {
    weight: 30, reps: 8, sets: 4,
    setDetails: [{ weight: 20, reps: 12 }, { weight: 30, reps: 5 }, { weight: 30, reps: 8 }, { weight: 20, reps: 0 }],
    totalReps: 25, volume: 630,
  });
  assert.notEqual(result.reps, 12, 'The most reps from a lighter set must not become reps at 30 kg.');
  result.setDetails[1].weight = 999;
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(exerciseSetSummary(exercise({ weight: 0, reps: 0, sets: 2, setValues: [null, { reps: 5 }] })), {
    weight: 0, reps: 5, sets: 2, setDetails: [{ weight: 0, reps: 0 }, { weight: 0, reps: 5 }], totalReps: 5, volume: 0,
  });
});

test('individual set reps and volume survive saved edits, prefilling and future filtering', () => {
  const original = state();
  const workout = [exercise({ reps: 12, sets: 3, setValues: [null, { weight: 25, reps: 8 }, { reps: 0 }] })];
  const first = commitWorkout(original, '2024-04-01', 'push', workout);
  const second = commitWorkout(first, '2024-04-02', 'push', [exercise({ weight: 30, reps: 10, sets: 2, setValues: [null, { reps: 7 }] })]);
  const edited = commitWorkout(second, '2024-04-02', 'push', [exercise({ weight: 30, reps: 10, sets: 2, setValues: [null, { reps: 9 }] })]);
  const future = commitWorkout(edited, '2024-04-03', 'push', [exercise({ reps: 999, sets: 99 })]);
  const points = listExerciseSeries(future)[0].points;
  assert.deepEqual(exerciseRepSummary(points, '2024-04-02'), { totalReps: 39, trainingCount: 2 });
  assert.deepEqual(points.slice(0, 2).map(point => point.volume), [440, 570]);
  assert.deepEqual(getWorkout(first, '2024-04-02', 'push'), workout);
  assert.equal(second.sessions['2024-04-02:push'][0].setValues[1].reps, 7);
  assert.equal(original.sessions['2024-04-01:push'], undefined);
});

test('comparison uses heaviest-set changes alongside total reps across varying sets', () => {
  const input = state({ sessions: {
    '2024-04-01:push': [exercise({ weight: 20, reps: 12, sets: 3, setValues: [null, { weight: 30, reps: 8 }, { reps: 10 }] })],
    '2024-04-02:push': [exercise({ name: 'Renamed', weight: 25, reps: 15, sets: 2, setValues: [null, { weight: 35, reps: 6 }] })],
  } });
  const before = JSON.stringify(input), row = latestWorkoutComparison(input, 'push', '2024-04-02').rows[0];
  assert.equal(row.name, 'Renamed');
  assert.deepEqual([row.weight, row.reps, row.totalReps, row.volume], [35, 6, 21, 585]);
  assert.deepEqual([row.weightDelta, row.repsDelta, row.setsDelta, row.totalRepsDelta, row.volumeDelta], [5, -2, -1, -9, -95]);
  row.setDetails[0].reps = 0;
  assert.equal(JSON.stringify(input), before);
});

test('rep totals follow exercise identity after renaming and keep equal names and other groups separate', () => {
  const input = state({ sessions: {
    '2024-04-01:push': [exercise({ reps: 12, sets: 3 }), exercise({ id: 'lift-2', reps: 30, sets: 2 })],
    '2024-04-02:push': [exercise({ name: 'New lift name', reps: 8, sets: 4 })],
    '2024-04-02:old-pull': [exercise({ reps: 50, sets: 5 })],
  } });
  const before = JSON.stringify(input);
  const series = listExerciseSeries(input);
  assert.equal(series.find(item => item.key === 'push:lift-1').name, 'New lift name');
  const totals = Object.fromEntries(series.map(item => [item.key, exerciseRepSummary(item.points, '2024-04-02')]));
  assert.deepEqual(totals, {
    'push:lift-1': { totalReps: 68, trainingCount: 2 },
    'push:lift-2': { totalReps: 60, trainingCount: 1 },
    'old-pull:lift-1': { totalReps: 250, trainingCount: 1 },
  });
  assert.equal(JSON.stringify(input), before);
});

test('editing a saved training replaces its sets and reps instead of accumulating each edit', () => {
  const original = state();
  const first = commitWorkout(original, '2024-04-01', 'push', [exercise({ reps: 10, sets: 3 })]);
  const second = commitWorkout(first, '2024-04-02', 'push', [exercise({ reps: 12, sets: 3 })]);
  const edited = commitWorkout(second, '2024-04-02', 'push', [exercise({ reps: 15, sets: 4 })]);
  assert.deepEqual(exerciseRepSummary(listExerciseSeries(edited)[0].points, '2024-04-02'), {
    totalReps: 90, trainingCount: 2,
  });
  assert.equal(second.sessions['2024-04-02:push'][0].reps, 12);
  assert.equal(second.sessions['2024-04-02:push'][0].sets, 3);
  assert.deepEqual(original.sessions, {});
});

test('opening a routine or prefilling the previous training does not add reps to saved totals', () => {
  const input = state();
  assert.deepEqual(getWorkout(input, '2024-04-01', 'push'), [exercise()]);
  assert.deepEqual(listExerciseSeries(input), []);
  const saved = commitWorkout(input, '2024-04-01', 'push', [exercise({ reps: 12, sets: 3 })]);
  const before = JSON.stringify(saved);
  assert.deepEqual(getWorkout(saved, '2024-04-02', 'push'), [exercise({ reps: 12, sets: 3 })]);
  assert.deepEqual(exerciseRepSummary(listExerciseSeries(saved)[0].points, '2024-04-02'), {
    totalReps: 36, trainingCount: 1,
  });
  assert.equal(JSON.stringify(saved), before);
});

test('body weights are actual independent date-sorted observations, without gap filling', () => {
  const input = state({ bodyWeights: { '2024-03-10': 81.2, '2024-02-29': 81.5 } });
  const result = bodyWeightSeries(input);
  assert.deepEqual(result, [{ date: '2024-02-29', value: 81.5 }, { date: '2024-03-10', value: 81.2 }]);
  result[0].value = 50;
  assert.equal(input.bodyWeights['2024-02-29'], 81.5);
});

test('summary includes 28 calendar dates, excludes future and empty sessions, and counts saved groups separately', () => {
  const input = state({ sessions: {
    '2024-02-01:push': [exercise()], // 28 days before today: outside the window.
    '2024-02-02:push': [exercise()], // 27 days before today: included.
    '2024-02-29:push': [exercise()],
    '2024-02-29:old-pull': [exercise()],
    '2024-02-28:push': [],
    '2024-03-01:push': [exercise()],
  } });
  assert.deepEqual(trainingSummary(input, '2024-02-29'), { total: 4, last28Days: 3, lastDate: '2024-02-29' });
  assert.deepEqual(trainingSummary(input, '2024-02-29', 'push'), { total: 3, last28Days: 2, lastDate: '2024-02-29' });
  assert.deepEqual(trainingSummary(input, '2024-02-29', 'missing'), { total: 0, last28Days: 0, lastDate: null });
});

test('weekly counts use Mondays across the year boundary and include archived groups', () => {
  const input = state({ sessions: {
    '2023-12-24:push': [exercise()],
    '2023-12-25:push': [exercise()],
    '2023-12-31:push': [exercise()],
    '2024-01-01:push': [exercise()],
    '2024-01-01:old-pull': [exercise()],
    '2024-01-02:push': [],
    '2024-01-04:push': [exercise()],
  } });
  assert.deepEqual(weeklyTrainingCounts(input, '2024-01-03', 2), [
    { date: '2023-12-25', value: 2 }, { date: '2024-01-01', value: 2 },
  ]);
  assert.deepEqual(weeklyTrainingCounts(input, '2024-01-03', 2, 'push'), [
    { date: '2023-12-25', value: 2 }, { date: '2024-01-01', value: 1 },
  ]);
  assert.equal(weeklyTrainingCounts(input, '2023-12-31', 1)[0].date, '2023-12-25');
  assert.equal(weeklyTrainingCounts(input, '2024-01-01', 1)[0].date, '2024-01-01');
});

test('calendar buckets ignore local daylight-saving changes and accept leap day', () => {
  const input = state({ sessions: {
    '2024-03-25:push': [exercise()], '2024-03-31:push': [exercise()], '2024-04-01:push': [exercise()],
  } });
  assert.deepEqual(weeklyTrainingCounts(input, '2024-04-01', 2), [
    { date: '2024-03-25', value: 2 }, { date: '2024-04-01', value: 1 },
  ]);
  assert.equal(weeklyTrainingCounts(input, '2024-02-29', 1)[0].date, '2024-02-26');
  assert.throws(() => trainingSummary(input, '2023-02-29'), /datum/);
  assert.throws(() => weeklyTrainingCounts(input, '2024-04-01', 0), /weken/);
  assert.throws(() => weeklyTrainingCounts(input, '2024-04-01', 1.5), /weken/);
});

test('comparison finds the latest two nonempty workouts, matches IDs after rename and compares sets', () => {
  const input = state({ sessions: {
    '2024-04-12:old-pull': [exercise({ weight: 100 })],
    '2024-04-10:old-pull': [exercise({ name: 'New name', weight: 20.3, reps: 8, sets: 3 }), exercise({ id: 'new-lift', weight: 5, sets: 2 })],
    '2024-04-09:old-pull': [],
    '2024-04-07:old-pull': [exercise({ weight: 20.1, reps: 10, sets: 4 }), exercise({ id: 'removed-lift' })],
    '2024-04-10:push': [exercise({ weight: 999 })],
  } });
  assert.deepEqual(latestWorkoutComparison(input, 'old-pull', '2024-04-11'), {
    date: '2024-04-10', previousDate: '2024-04-07', rows: [
      { name: 'New name', weight: 20.3, reps: 8, sets: 3,
        setDetails: [{ weight: 20.3, reps: 8 }, { weight: 20.3, reps: 8 }, { weight: 20.3, reps: 8 }], totalReps: 24, volume: 487.2,
        weightDelta: 0.2, repsDelta: -2, setsDelta: -1, totalRepsDelta: -16, volumeDelta: -316.8 },
      { name: 'Example lift', weight: 5, reps: 10, sets: 2, setDetails: [{ weight: 5, reps: 10 }, { weight: 5, reps: 10 }], totalReps: 20, volume: 100,
        weightDelta: null, repsDelta: null, setsDelta: null, totalRepsDelta: null, volumeDelta: null },
    ],
  });
  const single = latestWorkoutComparison(input, 'push', '2024-04-11');
  assert.equal(single.previousDate, null);
  assert.equal(single.rows[0].weightDelta, null);
  assert.equal(single.rows[0].setsDelta, null);
});

test('old exercises without sets count as one set in series, totals and comparisons', () => {
  const oldExercise = { id: 'lift-1', name: 'Example lift', weight: 20, reps: 12 };
  const input = state({ sessions: {
    '2024-04-01:push': [oldExercise],
    '2024-04-02:push': [exercise({ reps: 10, sets: 3 })],
  } });
  const points = listExerciseSeries(input)[0].points;
  assert.equal(points[0].sets, 1);
  assert.deepEqual(exerciseRepSummary(points, '2024-04-02'), { totalReps: 42, trainingCount: 2 });
  assert.equal(latestWorkoutComparison(input, 'push', '2024-04-02').rows[0].setsDelta, 2);
  const legacy = latestWorkoutComparison(state({ sessions: {
    '2024-04-01:push': [oldExercise], '2024-04-02:push': [oldExercise],
  } }), 'push', '2024-04-02').rows[0];
  assert.equal(legacy.sets, 1);
  assert.equal(legacy.setsDelta, 0);
  assert.equal(Object.hasOwn(oldExercise, 'sets'), false);
});

// Minimal document object: test emitted SVG geometry and safe text creation
// without adding DOM libraries to this dependency-free app.
class Element {
  constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
}
function container() {
  const document = {
    createElement: tag => new Element(tag, document),
    createElementNS: (namespace, tag) => new Element(tag, document),
  };
  return new Element('div', document);
}

test('line chart spacing reflects calendar dates and input is never mutated', () => {
  const target = container();
  const points = [{ date: '2024-01-11', value: 30 }, { date: '2024-01-01', value: 10 }, { date: '2024-01-02', value: 20 }];
  const before = JSON.stringify(points);
  const svg = renderLineChart(target, points, { label: 'Gewicht', unit: 'kg' });
  const coords = svg.children.find(node => node.tagName === 'polyline').attributes.points.split(' ').map(point => point.split(',').map(Number));
  assert(Math.abs((coords[1][0] - coords[0][0]) / (coords[2][0] - coords[0][0]) - 0.1) < 1e-10);
  assert.match(svg.attributes['aria-label'], /Gewicht \(kg\)/);
  assert.equal(JSON.stringify(points), before);
});

test('line chart supports empty, zero and single-point series without fabricated line segments', () => {
  const target = container();
  assert.equal(renderLineChart(target, []), null);
  assert.match(target.children[0].textContent, /Nog geen gegevens/);
  const svg = renderLineChart(target, [{ date: '2024-02-29', value: 0 }], { label: '<script>name</script>' });
  assert.equal(svg.children.filter(node => node.tagName === 'circle').length, 1);
  assert.equal(svg.children.filter(node => node.tagName === 'polyline').length, 0);
  assert.equal(svg.children.find(node => node.tagName === 'title').textContent, '<script>name</script>');
  assert.equal(target.children.length, 1);
  assert(!JSON.stringify(svg.attributes).includes('NaN'));
  assert.throws(() => renderLineChart(target, [{ date: '2024-02-30', value: 10 }]), /datum/);
  assert.throws(() => renderLineChart(target, [{ date: '2024-02-29', value: NaN }]), /getal/);
});

test('weekly bars retain true zeroes and use a zero baseline', () => {
  const target = container();
  const svg = renderBarChart(target, [{ date: '2024-04-01', value: 0 }, { date: '2024-04-08', value: 2 }], { label: 'Trainingen' });
  const bars = svg.children.filter(node => node.tagName === 'rect');
  assert.equal(bars.length, 1);
  assert.equal(Number(bars[0].attributes.y) + Number(bars[0].attributes.height), 201);
  assert(svg.children.some(node => node.tagName === 'text' && node.textContent === '0'));
  assert.throws(() => renderBarChart(target, [{ date: '2024-04-01', value: -1 }]), /Trainingstellingen/);
});
