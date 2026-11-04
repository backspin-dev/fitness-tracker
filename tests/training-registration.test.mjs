import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, validateState, commitWorkout, startTraining, getWorkout, localDate, hasTrainingOnDate, isRecordedWorkout } from '../data.js';
import { trainingSummary } from '../stats.js';
import { totalSavedReps, aggregateExerciseScores } from '../leaderboard.js';

const exercise = (name, reps, weight) => ({ id: name.toLowerCase().replaceAll(' ', '-'), name, reps, weight, sets: 1 });
const nextDay = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDate(date); };
const previousDay = () => { const date = new Date(); date.setDate(date.getDate() - 1); return localDate(date); };

test('een eerdere lege dag blijft ongestart tot expliciete start en telt alleen het laatst gekozen onderdeel', () => {
  const today = localDate(), yesterday = previousDay();
  let state = createState();
  state.routines.push = [exercise('Bench press', 8, 30)];
  state.routines.pull = [exercise('Dumbbell row', 9, 20)];
  const original = JSON.stringify(state);
  assert.equal(hasTrainingOnDate(state, yesterday), false);
  assert.equal(getWorkout(state, yesterday, 'push')[0].reps, 8);
  assert.equal(JSON.stringify(state), original, 'Bekijken van een schema verandert niets.');
  assert.equal(trainingSummary(state, today).total, 0);
  state = startTraining(state, yesterday, 'push');
  assert.equal(hasTrainingOnDate(state, yesterday), true);
  assert.equal(trainingSummary(state, today).total, 1);
  assert.equal(totalSavedReps(state, today), 8);
  state = startTraining(state, yesterday, 'pull');
  state = validateState(JSON.parse(JSON.stringify(state)));
  assert.equal(state.trainingTracking.from, today, 'Historische migratiegrens verandert niet.');
  assert.equal(trainingSummary(state, today).total, 1);
  assert.equal(totalSavedReps(state, today), 9);
  assert.equal(isRecordedWorkout(state, `${yesterday}:push`, today), false);
  assert.equal(isRecordedWorkout(state, `${yesterday}:pull`, today), true);
  assert.equal(state.sessions[`${yesterday}:push`][0].reps, 8, 'Niet-geselecteerde data blijft bewaard.');
  assert.throws(() => startTraining(state, nextDay(), 'push'), /toekomst/);
});

test('bestaande historische groepen blijven behouden als een andere eerdere dag wordt gestart', () => {
  const today = localDate(), yesterday = previousDay();
  let legacy = createState();
  legacy.sessions['2000-01-01:push'] = [exercise('Bench press', 5, 20)];
  legacy.sessions['2000-01-01:pull'] = [exercise('Dumbbell row', 7, 15)];
  legacy.schemaVersion = 5; delete legacy.trainingTracking;
  let state = validateState(legacy);
  assert.equal(hasTrainingOnDate(state, '2000-01-01'), true);
  assert.equal(hasTrainingOnDate(state, yesterday), false);
  assert.equal(trainingSummary(state, today).total, 2);
  state = startTraining(state, yesterday, 'legs');
  assert.equal(trainingSummary(state, today).total, 3);
  assert.equal(totalSavedReps(state, today), 12);
  assert.equal(isRecordedWorkout(state, '2000-01-01:push'), true);
  assert.equal(isRecordedWorkout(state, '2000-01-01:pull'), true);
  assert.equal(state.sessions['2000-01-01:push'][0].reps, 5);
  assert.equal(state.sessions['2000-01-01:pull'][0].reps, 7);
});

test('concepten tellen pas na start, de laatste gekozen groep telt en overleeft export', () => {
  const day = localDate();
  let state = createState();
  state = commitWorkout(state, day, 'push', [exercise('Bench press', 8, 30)]);
  state = commitWorkout(state, day, 'pull', [exercise('Dumbbell row', 12, 20)]);
  assert.equal(trainingSummary(state, day).total, 0);
  assert.equal(totalSavedReps(state, day), 0);
  state = startTraining(state, day, 'push');
  assert.equal(trainingSummary(state, day).total, 0);
  assert.equal(totalSavedReps(state, day), 0);
  state = startTraining(state, day, 'pull');
  state = validateState(JSON.parse(JSON.stringify(state)));
  assert.equal(trainingSummary(state, day).total, 0);
  assert.equal(trainingSummary(state, nextDay()).total, 1);
  assert.equal(totalSavedReps(state, nextDay()), 12);
  assert.deepEqual(aggregateExerciseScores(state, nextDay()).map(row => [row.total_reps, row.max_weight]), [[12, 20]]);
  assert.equal(getWorkout(state, day, 'push')[0].reps, 8);
  assert.equal(state.trainingTracking.days[day], 'pull');
});

test('wissel naar een klaargezet schema telt dit ook zonder een oefening te wijzigen', () => {
  const day = localDate();
  let state = createState();
  state.routines.pull = [exercise('Dumbbell row', 9, 20)];
  state = startTraining(state, day, 'push');
  assert.equal(trainingSummary(state, nextDay()).total, 1, 'Een expliciet gestarte lege training telt ook na de dagwisseling.');
  state = startTraining(state, day, 'pull');
  assert.equal(trainingSummary(state, nextDay()).total, 1);
  assert.equal(totalSavedReps(state, nextDay()), 9);
});

test('na de dagwisseling blijft de laatste keuze geregistreerd en is de nieuwe dag niet gestart', () => {
  const now = new Date(), day = localDate(now);
  const next = new Date(now); next.setDate(next.getDate() + 1);
  const tomorrow = localDate(next);
  let state = createState();
  state.routines.pull = [exercise('Dumbbell row', 9, 20)];
  state = startTraining(state, day, 'push');
  state = startTraining(state, day, 'pull');
  state = validateState(JSON.parse(JSON.stringify(state)));
  assert.equal(trainingSummary(state, tomorrow).total, 1);
  assert.equal(state.trainingTracking.days[day], 'pull');
  assert.equal(Object.hasOwn(state.trainingTracking.days, tomorrow), false);
});

test('migratie bewaart bestaande trainingen inclusief huidige dag en telt nieuwe concepten niet', () => {
  const day = localDate();
  let old = createState();
  old.sessions[`2000-01-01:push`] = [exercise('Bench press', 7, 20)];
  old.sessions[`${day}:pull`] = [exercise('Dumbbell row', 5, 15)];
  old.schemaVersion = 5;
  delete old.trainingTracking;
  let state = validateState(old);
  assert.equal(trainingSummary(state, day).total, 2);
  state = commitWorkout(state, day, 'push', [exercise('Bench press', 8, 30)]);
  assert.equal(trainingSummary(state, day).total, 2);
  assert.equal(totalSavedReps(state, day), 12);
  state = startTraining(state, day, 'push');
  assert.equal(trainingSummary(state, day).total, 1);
  assert.equal(trainingSummary(state, nextDay()).total, 2);
  assert.equal(totalSavedReps(state, nextDay()), 15);
  assert.equal(state.sessions[`${day}:pull`][0].reps, 5);
});
