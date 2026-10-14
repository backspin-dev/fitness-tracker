// Fitnessgegevens blijven in IndexedDB op dit apparaat. Geen netwerkverzoeken.
import { validateReminder } from './backup-reminder.js';
import { cleanRecoveryEntries, updateRecoveryEntries } from './recovery.js';
import { EXERCISE_CATALOG } from './exercise-catalog.js';

export const SPLITS = Object.freeze(['push', 'pull', 'legs']);
const MAX_BYTES = 7 * 1024 * 1024;
const MAX_WORKOUT_EXERCISES = 200;
const MAX_SESSIONS = 20000;
const MAX_TOTAL_EXERCISES = 50000;
const MAX_GROUPS = 24;
const MAX_BODY_WEIGHTS = 20000;
const GROUP_DEFAULTS = Object.freeze({
  push: { id: 'push', name: 'Push', description: 'Borst, schouders en triceps', archived: false },
  pull: { id: 'pull', name: 'Pull', description: 'Rug en biceps', archived: false },
  legs: { id: 'legs', name: 'Legs', description: 'Benen en billen', archived: false },
  full: { id: 'full', name: 'Full body', description: 'Je hele lichaam', archived: false },
  upper: { id: 'upper', name: 'Upper body', description: 'Bovenlichaam', archived: false },
  lower: { id: 'lower', name: 'Lower body', description: 'Onderlichaam', archived: false },
});
const PRESETS = Object.freeze({ ppl: SPLITS, full: ['full'], 'upper-lower': ['upper', 'lower'] });
const DATABASE = 'fitness-tracker';
const STORE = 'state';
const KEY = 'current';
const REMINDER_KEY = 'backup-reminder';
const RECOVERY_KEY = 'local-recovery';
const RANKING_KEYS = new Set(EXERCISE_CATALOG.map(item => item.key));

function invalid(message) {
  throw new Error(`Ongeldige trainingsgegevens: ${message}`);
}

function record(value, label, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    invalid(`${label} moet een object zijn.`);
  }
  if (Object.keys(value).some(key => !allowed.includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) {
    invalid(`${label} bevat ontbrekende of onbekende velden.`);
  }
}

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid('gebruik een datum in de vorm JJJJ-MM-DD.');
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ||
      Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200) {
    invalid('de datum bestaat niet of valt buiten 1900–2200.');
  }
  return value;
}

function groupId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value) ||
      value === 'prototype' || Object.hasOwn(Object.prototype, value)) {
    invalid('elke trainingsgroep moet een veilige id van 1 tot 64 tekens hebben.');
  }
  return value;
}

function splitKey(value, state) {
  groupId(value);
  const exists = state.schemaVersion === 1 ? SPLITS.includes(value) : state.groups.some(group => group.id === value);
  if (!exists) invalid('kies een bestaande trainingsgroep.');
  return value;
}

function groupName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 40) {
    invalid('een trainingsgroep moet een naam van 1 tot 40 tekens hebben.');
  }
  return value.trim();
}

function groups(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_GROUPS) {
    invalid(`gebruik 1 tot ${MAX_GROUPS} trainingsgroepen.`);
  }
  const seen = new Set();
  const result = value.map(group => {
    record(group, 'een trainingsgroep', ['id', 'name', 'description', 'archived']);
    const id = groupId(group.id);
    if (seen.has(id)) invalid('trainingsgroepen moeten unieke ids hebben.');
    seen.add(id);
    if (typeof group.description !== 'string' || group.description.length > 100) {
      invalid('een groepsomschrijving mag maximaal 100 tekens bevatten.');
    }
    if (typeof group.archived !== 'boolean') invalid('de archiefstatus moet waar of onwaar zijn.');
    return { id, name: groupName(group.name), description: group.description.trim(), archived: group.archived };
  });
  if (!result.some(group => !group.archived)) invalid('houd minstens één trainingsgroep actief.');
  return result;
}

function bodyWeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 500) {
    invalid('lichaamsgewicht moet een getal tussen 1 en 500 kg zijn.');
  }
  return value;
}

function dictionary(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    invalid(`${label} moet een object zijn.`);
  }
}

function exercises(value, allowLegacy = false) {
  if (!Array.isArray(value) || value.length > MAX_WORKOUT_EXERCISES) {
    invalid(`een training mag maximaal ${MAX_WORKOUT_EXERCISES} oefeningen bevatten.`);
  }
  const seen = new Set();
  return value.map(item => {
    record(item, 'een oefening', ['id', 'name', 'weight', 'reps', 'sets', 'rankingKey'],
      allowLegacy ? ['id', 'name', 'weight', 'reps'] : ['id', 'name', 'weight', 'reps', 'sets']);
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || seen.has(item.id)) {
      invalid('elke oefening moet een unieke, geldige id hebben.');
    }
    seen.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120) {
      invalid('een oefening moet een naam van 1 tot 120 tekens hebben.');
    }
    if (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight < 0 || item.weight > 2000) {
      invalid('gewicht moet een getal tussen 0 en 2.000 kg zijn.');
    }
    if (typeof item.reps !== 'number' || !Number.isInteger(item.reps) || item.reps < 0 || item.reps > 999) {
      invalid('reps moet een heel getal tussen 0 en 999 zijn.');
    }
    const sets = allowLegacy && !Object.hasOwn(item, 'sets') ? 1 : item.sets;
    if (typeof sets !== 'number' || !Number.isInteger(sets) || sets < 1 || sets > 99) {
      invalid('sets moet een heel getal tussen 1 en 99 zijn.');
    }
    const result = { id: item.id, name: item.name.trim(), weight: item.weight, reps: item.reps, sets };
    if (Object.hasOwn(item, 'rankingKey')) {
      if (typeof item.rankingKey !== 'string' || !RANKING_KEYS.has(item.rankingKey)) {
        invalid('kies een bekende ranglijstoefening of gebruik de automatische naamkoppeling.');
      }
      result.rankingKey = item.rankingKey;
    }
    return result;
  });
}

export function localDate(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) invalid('de datum is ongeldig.');
  return dateKey(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
}

export function createState() {
  return {
    schemaVersion: 4,
    groups: SPLITS.map(id => ({ ...GROUP_DEFAULTS[id] })),
    routines: { push: [], pull: [], legs: [] },
    sessions: {},
    bodyWeights: {},
    ui: { split: 'push', date: localDate() },
  };
}

export function validateState(input) {
  dictionary(input, 'de back-up');
  const legacy = input.schemaVersion === 1;
  const legacySets = [1, 2].includes(input.schemaVersion);
  if (![1, 2, 3, 4].includes(input.schemaVersion)) invalid('deze back-upversie wordt niet ondersteund.');
  const fields = legacy ? ['schemaVersion', 'routines', 'sessions'] :
    ['schemaVersion', 'groups', 'routines', 'sessions', 'bodyWeights'];
  record(input, 'de back-up', [...fields, 'ui'], fields);
  // Versie 1 kende alleen PPL. Versies 1 en 2 krijgen één set: oude reptotalen blijven gelijk.
  const migratedGroups = legacy ? SPLITS.map(id => ({ ...GROUP_DEFAULTS[id] })) : groups(input.groups);
  const ids = migratedGroups.map(group => group.id);
  record(input.routines, 'de schema’s', ids);
  dictionary(input.sessions, 'de trainingsgeschiedenis');
  const entries = Object.entries(input.sessions);
  if (entries.length > MAX_SESSIONS) invalid('de back-up bevat te veel trainingen.');
  const result = { schemaVersion: 4, groups: migratedGroups, routines: {}, sessions: {}, bodyWeights: {} };
  let count = 0;
  for (const split of ids) {
    result.routines[split] = exercises(input.routines[split], legacySets);
    count += result.routines[split].length;
  }
  for (const [key, value] of entries) {
    const match = /^(\d{4}-\d{2}-\d{2}):([a-zA-Z0-9_-]{1,64})$/.exec(key);
    if (!match) invalid('de trainingsgeschiedenis bevat een ongeldige sleutel.');
    dateKey(match[1]);
    splitKey(match[2], result);
    result.sessions[key] = exercises(value, legacySets);
    count += result.sessions[key].length;
    if (count > MAX_TOTAL_EXERCISES) invalid('de back-up bevat te veel oefeningen.');
  }
  if (!legacy) {
    dictionary(input.bodyWeights, 'de gewichtsmetingen');
    const weights = Object.entries(input.bodyWeights);
    if (weights.length > MAX_BODY_WEIGHTS) invalid('de back-up bevat te veel gewichtsmetingen.');
    for (const [date, value] of weights) result.bodyWeights[dateKey(date)] = bodyWeight(value);
  }
  if (Object.hasOwn(input, 'ui')) {
    record(input.ui, 'de scherminstellingen', ['split', 'date']);
    result.ui = { split: splitKey(input.ui.split, result), date: dateKey(input.ui.date) };
  }
  // Compacte exports houden ook grote oude back-ups binnen de importlimiet.
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BYTES) {
    invalid('de back-up is groter dan 7 MB.');
  }
  return result;
}

export function getPreviousWorkout(state, date, split) {
  dateKey(date);
  splitKey(split, state);
  let previousDate = null;
  for (const key of Object.keys(state.sessions)) {
    if (key.slice(11) !== split) continue;
    const candidateDate = dateKey(key.slice(0, 10));
    if (candidateDate < date && (previousDate === null || candidateDate > previousDate)) {
      previousDate = candidateDate;
    }
  }
  if (previousDate === null) return null;
  return {
    date: previousDate,
    exercises: exercises(state.sessions[`${previousDate}:${split}`], state.schemaVersion < 3),
  };
}

export function getWorkout(state, date, split) {
  const key = `${dateKey(date)}:${splitKey(split, state)}`;
  if (Object.hasOwn(state.sessions, key)) return exercises(state.sessions[key], state.schemaVersion < 3);
  const previous = getPreviousWorkout(state, date, split);
  // Een bewust leeggemaakte vorige training blijft leeg.
  return previous ? previous.exercises : exercises(state.routines[split], state.schemaVersion < 3);
}

export function commitWorkout(state, date, split, workout) {
  const next = validateState(state);
  const key = `${dateKey(date)}:${splitKey(split, next)}`;
  next.sessions[key] = exercises(workout, true);
  // Een oude training aanpassen verandert het schema voor vandaag niet.
  if (date === localDate()) next.routines[split] = exercises(workout, true);
  next.ui = { split, date };
  return validateState(next);
}

export function setExerciseRanking(state, group, exerciseId, rankingKey) {
  if (rankingKey !== null && (typeof rankingKey !== 'string' || !RANKING_KEYS.has(rankingKey))) {
    invalid('kies een bekende ranglijstoefening of gebruik de automatische naamkoppeling.');
  }
  if (typeof exerciseId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(exerciseId)) {
    invalid('kies een bestaande oefening.');
  }
  const next = validateState(state);
  splitKey(group, next);
  let found = false;
  const update = workout => {
    for (const exercise of workout) {
      if (exercise.id !== exerciseId) continue;
      found = true;
      if (rankingKey === null) delete exercise.rankingKey;
      else exercise.rankingKey = rankingKey;
    }
  };
  update(next.routines[group]);
  for (const [key, workout] of Object.entries(next.sessions)) {
    if (key.slice(11) === group) update(workout);
  }
  if (!found) invalid('kies een bestaande oefening.');
  return validateState(next);
}

export function exportBackup(state) {
  return JSON.stringify(validateState(state));
}

export function applyPreset(state, presetId) {
  if (typeof presetId !== 'string' || !Object.hasOwn(PRESETS, presetId)) invalid('kies een bestaand trainingsschema.');
  const next = validateState(state);
  const ids = PRESETS[presetId];
  const selected = ids.map(id => {
    const existing = next.groups.find(group => group.id === id);
    if (existing) return { ...existing, archived: false };
    next.routines[id] = [];
    return { ...GROUP_DEFAULTS[id] };
  });
  const archived = next.groups.filter(group => !ids.includes(group.id)).map(group => ({ ...group, archived: true }));
  next.groups = [...selected, ...archived];
  next.ui = { split: ids[0], date: next.ui?.date ?? localDate() };
  return validateState(next);
}

export function addGroup(state, group) {
  record(group, 'de nieuwe trainingsgroep', ['id', 'name']);
  const id = groupId(group.id);
  const next = validateState(state);
  if (next.groups.some(existing => existing.id === id)) invalid('deze trainingsgroep bestaat al.');
  next.groups.push({ id, name: groupName(group.name), description: '', archived: false });
  next.routines[id] = [];
  next.ui = { split: id, date: next.ui?.date ?? localDate() };
  return validateState(next);
}

export function renameGroup(state, id, name) {
  const next = validateState(state);
  splitKey(id, next);
  next.groups.find(group => group.id === id).name = groupName(name);
  return validateState(next);
}

export function setGroupArchived(state, id, archived) {
  if (typeof archived !== 'boolean') invalid('de archiefstatus moet waar of onwaar zijn.');
  const next = validateState(state);
  splitKey(id, next);
  next.groups.find(group => group.id === id).archived = archived;
  const active = next.groups.find(group => !group.archived);
  if (!active) invalid('houd minstens één trainingsgroep actief.');
  if (archived && next.ui?.split === id) next.ui.split = active.id;
  return validateState(next);
}

export function setBodyWeight(state, date, weight) {
  const next = validateState(state);
  next.bodyWeights[dateKey(date)] = bodyWeight(weight);
  return validateState(next);
}

export function deleteBodyWeight(state, date) {
  const next = validateState(state);
  delete next.bodyWeights[dateKey(date)];
  return validateState(next);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Opslag is niet beschikbaar in deze browser. Open de app in Safari.'));
      return;
    }
    let settled = false;
    let request;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    try {
      request = globalThis.indexedDB.open(DATABASE, 1);
    } catch (error) {
      fail(error);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onblocked = () => fail(new Error('Sluit andere tabbladen van deze app en probeer opnieuw.'));
    request.onerror = () => fail(request.error || new Error('De lokale opslag kon niet worden geopend.'));
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

async function transaction(mode, run) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let tx;
      let request;
      try {
        tx = database.transaction(STORE, mode);
        request = run(tx.objectStore(STORE));
      } catch (error) {
        if (tx) tx.abort();
        reject(error);
        return;
      }
      // Alleen een voltooide transactie geldt als opgeslagen.
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || request.error || new Error('Opslaan is afgebroken. Probeer opnieuw.'));
      tx.onerror = () => { /* onabort geeft de fout door na het terugdraaien. */ };
    });
  } finally {
    database.close();
  }
}

export async function loadState() {
  const saved = await transaction('readonly', store => store.get(KEY));
  return saved === undefined ? null : validateState(saved);
}

function recoveryTransaction(snapshot, protectCurrent, writeCurrent) {
  return transaction('readwrite', store => {
    // Lees en schrijf binnen één transactie: een opslagfout draait ook current terug.
    const copiesRequest = store.get(RECOVERY_KEY);
    const currentRequest = protectCurrent ? store.get(KEY) : null;
    const result = { result: undefined, error: null };
    let copiesReady = false;
    let currentReady = !currentRequest;
    const write = () => {
      if (!copiesReady || !currentReady) return;
      try {
        let previous = null;
        if (currentRequest?.result !== undefined) {
          // Beschadigde oude gegevens mogen een geldige import niet blokkeren.
          try { previous = validateState(currentRequest.result); } catch { /* geen herstelbare toestand */ }
        }
        const copies = updateRecoveryEntries(copiesRequest.result, {
          snapshot, previous, reason: protectCurrent, now: new Date(),
        }, validateState);
        store.put(copies, RECOVERY_KEY);
        if (writeCurrent) store.put(snapshot, KEY);
      } catch (error) {
        result.error = error;
        store.transaction.abort();
      }
    };
    copiesRequest.onsuccess = () => { copiesReady = true; write(); };
    if (currentRequest) currentRequest.onsuccess = () => { currentReady = true; write(); };
    return result;
  });
}

export async function saveState(state, { protectCurrent } = {}) {
  if (protectCurrent !== undefined && !['import', 'restore'].includes(protectCurrent)) {
    throw new Error('Kies import of restore voor een beschermde herstelkopie.');
  }
  await recoveryTransaction(validateState(state), protectCurrent, true);
}

// Bestaande logboeken krijgen ook zonder een nieuwe training een lokale herstelkopie.
export async function ensureRecoveryBackup(state) {
  await recoveryTransaction(validateState(state), undefined, false);
}

export async function listRecoveryBackups() {
  const saved = await transaction('readonly', store => store.get(RECOVERY_KEY));
  return cleanRecoveryEntries(saved, validateState).map(({ state, ...metadata }) => metadata);
}

export async function loadRecoveryBackup(id) {
  const saved = await transaction('readonly', store => store.get(RECOVERY_KEY));
  const entry = cleanRecoveryEntries(saved, validateState).find(copy => copy.id === id);
  return entry ? validateState(entry.state) : null;
}

// Apparaatinstellingen staan los van trainingen en gaan nooit mee in een back-up.
export async function loadBackupReminder() {
  const saved = await transaction('readonly', store => store.get(REMINDER_KEY));
  return saved === undefined ? null : validateReminder(saved);
}

export async function saveBackupReminder(reminder) {
  const snapshot = validateReminder(reminder);
  await transaction('readwrite', store => store.put(snapshot, REMINDER_KEY));
}
