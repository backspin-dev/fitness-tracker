// Fitnessgegevens blijven in IndexedDB op dit apparaat. Geen netwerkverzoeken.
export const SPLITS = Object.freeze(['push', 'pull', 'legs']);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_WORKOUT_EXERCISES = 200;
const MAX_SESSIONS = 20000;
const MAX_TOTAL_EXERCISES = 50000;
const DATABASE = 'fitness-tracker';
const STORE = 'state';
const KEY = 'current';

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

function splitKey(value) {
  if (!SPLITS.includes(value)) invalid('kies Push, Pull of Legs.');
  return value;
}

function exercises(value) {
  if (!Array.isArray(value) || value.length > MAX_WORKOUT_EXERCISES) {
    invalid(`een training mag maximaal ${MAX_WORKOUT_EXERCISES} oefeningen bevatten.`);
  }
  const seen = new Set();
  return value.map(item => {
    record(item, 'een oefening', ['id', 'name', 'weight', 'reps']);
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
    return { id: item.id, name: item.name.trim(), weight: item.weight, reps: item.reps };
  });
}

export function localDate(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) invalid('de datum is ongeldig.');
  return dateKey(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
}

export function createState() {
  return {
    schemaVersion: 1,
    routines: { push: [], pull: [], legs: [] },
    sessions: {},
    ui: { split: 'push', date: localDate() },
  };
}

export function validateState(input) {
  record(input, 'de back-up', ['schemaVersion', 'routines', 'sessions', 'ui'], ['schemaVersion', 'routines', 'sessions']);
  if (input.schemaVersion !== 1) invalid('deze back-upversie wordt niet ondersteund.');
  record(input.routines, 'de schema’s', SPLITS);
  if (!input.sessions || typeof input.sessions !== 'object' || Array.isArray(input.sessions) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input.sessions))) {
    invalid('de trainingsgeschiedenis moet een object zijn.');
  }
  const entries = Object.entries(input.sessions);
  if (entries.length > MAX_SESSIONS) invalid('de back-up bevat te veel trainingen.');
  const result = { schemaVersion: 1, routines: {}, sessions: {} };
  let count = 0;
  for (const split of SPLITS) {
    result.routines[split] = exercises(input.routines[split]);
    count += result.routines[split].length;
  }
  for (const [key, value] of entries) {
    const match = /^(\d{4}-\d{2}-\d{2}):(push|pull|legs)$/.exec(key);
    if (!match) invalid('de trainingsgeschiedenis bevat een ongeldige sleutel.');
    dateKey(match[1]);
    result.sessions[key] = exercises(value);
    count += result.sessions[key].length;
    if (count > MAX_TOTAL_EXERCISES) invalid('de back-up bevat te veel oefeningen.');
  }
  if (Object.hasOwn(input, 'ui')) {
    record(input.ui, 'de scherminstellingen', ['split', 'date']);
    result.ui = { split: splitKey(input.ui.split), date: dateKey(input.ui.date) };
  }
  // Dezelfde opmaak als exportBackup: iedere export past ook door de importlimiet.
  if (new TextEncoder().encode(JSON.stringify(result, null, 2)).byteLength > MAX_BYTES) {
    invalid('de back-up is groter dan 5 MB.');
  }
  return result;
}

export function getPreviousWorkout(state, date, split) {
  dateKey(date);
  splitKey(split);
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
    exercises: exercises(state.sessions[`${previousDate}:${split}`]),
  };
}

export function getWorkout(state, date, split) {
  const key = `${dateKey(date)}:${splitKey(split)}`;
  if (Object.hasOwn(state.sessions, key)) return exercises(state.sessions[key]);
  const previous = getPreviousWorkout(state, date, split);
  // Een bewust leeggemaakte vorige training blijft leeg.
  return previous ? previous.exercises : exercises(state.routines[split]);
}

export function commitWorkout(state, date, split, workout) {
  const key = `${dateKey(date)}:${splitKey(split)}`;
  const next = validateState(state);
  next.sessions[key] = exercises(workout);
  // Een oude training aanpassen verandert het schema voor vandaag niet.
  if (date === localDate()) next.routines[split] = exercises(workout);
  next.ui = { split, date };
  return validateState(next);
}

export function exportBackup(state) {
  return JSON.stringify(validateState(state), null, 2);
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

export async function saveState(state) {
  const snapshot = validateState(state);
  await transaction('readwrite', store => store.put(snapshot, KEY));
}
