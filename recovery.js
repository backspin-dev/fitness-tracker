// Alleen lokale herstelkopieën. Geen bestanden, netwerk of achtergrondtaken.
export const MAX_RECOVERY_BACKUPS = 7;
const REASONS = ['daily', 'import', 'restore'];

function calendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function contentKey(state) {
  // Een andere gekozen datum of tab is geen wijziging aan het logboek.
  const { ui, ...content } = state;
  // De volgorde van datums in een JSON-object verandert de inhoud niet.
  for (const key of ['routines', 'sessions', 'bodyWeights']) {
    content[key] = Object.fromEntries(Object.entries(content[key]).sort(([a], [b]) => a.localeCompare(b)));
  }
  return JSON.stringify(content);
}

export function cleanRecoveryEntries(raw, validate) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set();
  const valid = [];
  for (const entry of raw.slice(0, 100)) {
    try {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
          typeof entry.id !== 'string' || !entry.id || entry.id.length > 160 || ids.has(entry.id) ||
          typeof entry.createdAt !== 'string' || !REASONS.includes(entry.reason) || !validDate(entry.date)) continue;
      const created = new Date(entry.createdAt);
      if (Number.isNaN(created.getTime()) || created.toISOString() !== entry.createdAt) continue;
      const state = validate(entry.state);
      ids.add(entry.id);
      valid.push({ id: entry.id, createdAt: entry.createdAt, reason: entry.reason, date: entry.date, state });
    } catch { /* Een beschadigde kopie blokkeert andere kopieën of opslaan niet. */ }
  }
  return valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_RECOVERY_BACKUPS);
}

export function updateRecoveryEntries(raw, { snapshot, previous = null, reason, now = new Date() }, validate) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Ongeldige datum voor de herstelkopie.');
  if (reason !== undefined && !['import', 'restore'].includes(reason)) throw new Error('Ongeldige herstelreden.');
  const state = validate(snapshot);
  const currentKey = contentKey(state);
  const date = calendarDate(now);
  const createdAt = now.toISOString();
  let entries = cleanRecoveryEntries(raw, validate);
  if (previous && reason) {
    const previousState = validate(previous);
    const previousKey = contentKey(previousState);
    if (previousKey !== currentKey) {
      // Maak vóór vervangen een aparte kopie, ook als vandaag al automatisch bewaard is.
      entries = entries.filter(entry => contentKey(entry.state) !== previousKey);
      let suffix = 0;
      let id;
      do { id = `before-${reason}:${createdAt}:${suffix++}`; } while (entries.some(entry => entry.id === id));
      entries.unshift({ id, createdAt, reason, date, state: previousState });
    }
  }
  if (reason || !entries.some(entry => contentKey(entry.state) === currentKey)) {
    // Bij import/herstel wordt current altijd de nieuwste kopie: ook een oude
    // teruggezette kopie mag niet door de retentielimiet verdwijnen.
    entries = entries.filter(entry => contentKey(entry.state) !== currentKey &&
      (entry.reason !== 'daily' || entry.date !== date));
    entries.unshift({ id: `daily:${date}`, createdAt, reason: 'daily', date, state });
  }
  return cleanRecoveryEntries(entries, validate);
}
