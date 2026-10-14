// Alleen kalenderdagen: tijdzones en zomer-/wintertijd veranderen de termijn niet.
const DAY_MS = 24 * 60 * 60 * 1000;
const FIELDS = ['version', 'startedOn', 'confirmedOn', 'snoozedUntil'];

function invalid(message) {
  throw new Error(`Ongeldige back-upherinnering: ${message}`);
}

function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid('gebruik een datum in de vorm JJJJ-MM-DD.');
  }
  const instant = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== value ||
      Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200) {
    invalid('de datum bestaat niet of valt buiten 1900–2200.');
  }
  return instant.getTime() / DAY_MS;
}

function addDays(value, count) {
  const result = new Date((calendarDay(value) + count) * DAY_MS).toISOString().slice(0, 10);
  calendarDay(result);
  return result;
}

export function createReminder(today) {
  calendarDay(today);
  return { version: 1, startedOn: today, confirmedOn: null, snoozedUntil: null };
}

export function validateReminder(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).some(key => !FIELDS.includes(key)) ||
      FIELDS.some(key => !Object.hasOwn(value, key))) {
    invalid('de herinneringsinstellingen bevatten ontbrekende of onbekende velden.');
  }
  if (value.version !== 1) invalid('deze versie wordt niet ondersteund.');
  calendarDay(value.startedOn);
  if (value.confirmedOn !== null) {
    calendarDay(value.confirmedOn);
    if (value.confirmedOn < value.startedOn) invalid('de bevestigingsdatum ligt vóór de startdatum.');
  }
  if (value.snoozedUntil !== null) calendarDay(value.snoozedUntil);
  return {
    version: 1,
    startedOn: value.startedOn,
    confirmedOn: value.confirmedOn,
    snoozedUntil: value.snoozedUntil,
  };
}

export function isReminderDue(reminder, today) {
  const valid = validateReminder(reminder);
  const day = calendarDay(today);
  const baseline = calendarDay(valid.confirmedOn ?? valid.startedOn);
  return day >= baseline + 14 &&
    (valid.snoozedUntil === null || day >= calendarDay(valid.snoozedUntil));
}

export function confirmBackup(reminder, today) {
  calendarDay(today);
  return validateReminder({ ...validateReminder(reminder), confirmedOn: today, snoozedUntil: null });
}

export function snoozeReminder(reminder, today) {
  return { ...validateReminder(reminder), snoozedUntil: addDays(today, 3) };
}

export function hasTrainingData(state) {
  return Object.values(state?.routines ?? {}).some(workout => Array.isArray(workout) && workout.length > 0) ||
    Object.values(state?.sessions ?? {}).some(workout => Array.isArray(workout) && workout.length > 0) ||
    Object.keys(state?.bodyWeights ?? {}).length > 0;
}
