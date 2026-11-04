import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, validateState, commitWorkout, startTraining, getWorkout, localDate } from '../data.js';
import { trainingSummary } from '../stats.js';
import { totalSavedReps, aggregateExerciseScores } from '../leaderboard.js';

const exercise = (name, reps, weight) => ({ id: name.toLowerCase().replaceAll(' ', '-'), name, reps, weight, sets: 1 });
const nextDay = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDate(date); };

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
