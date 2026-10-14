import { localDate } from './data.js';
import { createLeaderboardClient, aggregateExerciseScores } from './leaderboard.js';
import { EXERCISE_CATALOG } from './exercise-catalog.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './leaderboard-config.js';

// Los van de lokale opslagflow: netwerkfouten blokkeren lokaal opslaan nooit.
export function renderLeaderboardRows(container, scores) {
  const document = container.ownerDocument, number = new Intl.NumberFormat('nl-NL');
  const rows = scores.map((score, index) => {
    const row = document.createElement('div'); row.className = 'comparison-row';
    const name = document.createElement('strong'); name.textContent = `${index + 1}. ${score.display_name}`;
    const value = document.createElement('span'); value.textContent = `${number.format(score.total_reps)} reps`;
    row.append(name, value); return row;
  });
  if (!rows.length) {
    const empty = document.createElement('p'); empty.className = 'settings-copy';
    empty.textContent = 'Nog geen scores voor deze oefening.'; rows.push(empty);
  }
  container.replaceChildren(...rows);
}

export function setupLeaderboard({ getState, canEdit, toast, navigation }) {
  const client = createLeaderboardClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
  const number = new Intl.NumberFormat('nl-NL');
  let saving = false, loading = false, syncTimer, selectedExercise = '', userSelected = false, remoteExercises = [], loadSequence = 0, editingName = false;
  const node = (tag, text, className) => {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  };
  const nameDialog = node('dialog'); nameDialog.id = 'leaderboard-name-dialog'; nameDialog.setAttribute('aria-labelledby', 'leaderboard-name-title');
  const nameTitle = node('h2', 'Hoe heet je?'); nameTitle.id = 'leaderboard-name-title';
  const notice = node('p', 'Je naam, ranglijstoefeningen en totale reps per oefening zijn openbaar. Je volledige trainingslogboek blijft op dit toestel.', 'settings-copy');
  const nameForm = node('form'), nameLabel = node('label', 'Jouw naam', 'field-label'); nameLabel.htmlFor = 'leaderboard-first-name';
  const nameInput = node('input', undefined, 'text-input'); nameInput.id = 'leaderboard-first-name'; nameInput.type = 'text';
  nameInput.maxLength = 24; nameInput.required = true; nameInput.autocomplete = 'nickname'; nameInput.placeholder = 'Jouw naam';
  const nameStart = node('button', 'Starten', 'primary full'); nameStart.type = 'submit';
  const nameCancel = node('button', 'Annuleren', 'secondary full'); nameCancel.type = 'button'; nameCancel.hidden = true;
  nameCancel.onclick = () => nameDialog.close();
  const nameError = node('p', '', 'field-error'); nameError.setAttribute('role', 'alert'); nameError.hidden = true;
  nameForm.append(nameLabel, nameInput, nameError, nameStart, nameCancel); nameDialog.append(nameTitle, notice, nameForm); document.body.append(nameDialog);
  nameDialog.addEventListener('cancel', event => { if (!editingName || saving) event.preventDefault(); });
  nameDialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (!editingName || saving)) { event.preventDefault(); event.stopPropagation(); }
  });
  nameDialog.addEventListener('close', () => {
    if (!client.isJoined() && canEdit()) queueMicrotask(() => {
      if (!nameDialog.open && !client.isJoined() && canEdit()) openName();
    });
  });

  const page = node('section'); page.id = 'leaderboard-page'; page.className = 'app-page'; page.hidden = true;
  page.setAttribute('data-app-page', 'ranglijst'); page.setAttribute('aria-labelledby', 'leaderboard-title');
  const heading = node('div', undefined, 'page-heading'), title = node('h2', 'Ranglijst'); title.id = 'leaderboard-title';
  const back = node('a', '←', 'back-link icon-button'); back.href = '#/training'; back.setAttribute('aria-label', 'Terug naar training'); heading.append(title, back);
  const exerciseLabel = node('label', 'Oefening', 'field-label'); exerciseLabel.htmlFor = 'leaderboard-exercise';
  const exercise = node('select', undefined, 'text-input'); exercise.id = 'leaderboard-exercise';
  const own = node('div', undefined, 'summary-tile'), ownTotal = node('strong'), ownLabel = node('span'); own.append(ownTotal, ownLabel);
  const boardHeading = node('h3', 'Top 50', 'small-heading'), rows = node('div'); rows.id = 'leaderboard-list';
  const refresh = node('button', 'Vernieuwen', 'secondary full'); refresh.type = 'button';
  const error = node('p', '', 'field-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  page.append(heading, exerciseLabel, exercise, own, boardHeading, rows, refresh, error); document.getElementById('app-content').append(page);
  const editName = document.getElementById('edit-player-name');

  function scores() { return aggregateExerciseScores(getState(), localDate()); }
  function options(preferAvailable = false) {
    const local = scores(), all = new Map();
    remoteExercises.forEach(item => all.set(item.exercise_key, item)); local.forEach(item => all.set(item.exercise_key, item));
    const selectedKnown = EXERCISE_CATALOG.find(item => item.key === selectedExercise);
    if (selectedKnown && !all.has(selectedExercise)) all.set(selectedExercise, { exercise_key: selectedKnown.key, exercise_name: selectedKnown.label });
    if (!all.size) {
      const fallback = EXERCISE_CATALOG.find(item => item.key === 'ex:squat');
      all.set(fallback.key, { exercise_key: fallback.key, exercise_name: fallback.label });
    }
    if (!userSelected && preferAvailable && !local.length && remoteExercises.length) selectedExercise = remoteExercises[0].exercise_key;
    if (!selectedExercise || !all.has(selectedExercise)) selectedExercise = local[0]?.exercise_key || remoteExercises[0]?.exercise_key || 'ex:squat';
    exercise.replaceChildren(...[...all.values()].sort((a, b) => a.exercise_name.localeCompare(b.exercise_name, 'nl')).map(item => {
      const option = node('option', item.exercise_name); option.value = item.exercise_key; return option;
    }));
    exercise.value = selectedExercise;
    const selectedName = all.get(selectedExercise)?.exercise_name || 'deze oefening';
    ownTotal.textContent = `${number.format(local.find(item => item.exercise_key === selectedExercise)?.total_reps ?? 0)} reps`;
    ownLabel.textContent = 'Jouw totaal'; boardHeading.textContent = `Top 50 · ${selectedName}`;
  }
  function controls() {
    nameInput.disabled = nameStart.disabled = !canEdit() || saving || !client.configured;
    nameCancel.disabled = saving;
    nameStart.textContent = saving ? 'Even bewaren…' : editingName ? 'Naam bewaren' : 'Starten';
    if (editName) editName.disabled = !canEdit() || saving || !client.configured;
    refresh.disabled = loading || !client.configured;
  }
  function openName(edit = false) {
    if (!canEdit() || saving) return;
    editingName = edit; nameTitle.textContent = edit ? 'Jouw naam' : 'Hoe heet je?'; nameCancel.hidden = !edit;
    nameInput.value = client.getDisplayName(); nameError.hidden = true; controls();
    if (!nameDialog.open) nameDialog.showModal(); nameInput.focus();
  }
  function ensureName() {
    if (!canEdit() || client.isJoined()) return false;
    if (!nameDialog.open) openName();
    return true;
  }
  function failed(cause) { error.textContent = cause.message || 'De ranglijst is nu niet bereikbaar.'; error.hidden = false; }
  async function load(updateExercises = true) {
    if (!client.configured) return;
    const sequence = ++loadSequence; loading = true; controls(); rows.replaceChildren(node('p', 'Laden…', 'settings-copy'));
    try {
      if (updateExercises) {
        const directory = await client.getExercises();
        if (sequence !== loadSequence) return;
        remoteExercises = directory; options(true);
      }
      const result = await client.getScores(selectedExercise);
      if (sequence === loadSequence) renderLeaderboardRows(rows, result);
    } catch (cause) {
      if (sequence === loadSequence) { rows.replaceChildren(); failed(cause); }
    } finally { if (sequence === loadSequence) { loading = false; controls(); } }
  }
  async function sync() {
    if (!client.configured || !client.isJoined() || !canEdit() || saving) return;
    try {
      const result = await client.sync(scores());
      if (navigation.isCurrent('ranglijst') && !result.skipped) { error.hidden = true; options(); await load(false); }
    } catch (cause) { if (navigation.isCurrent('ranglijst')) failed(cause); }
  }
  function onSaved() {
    controls();
    if (!canEdit() || ensureName() || !client.configured) return;
    if (navigation.isCurrent('ranglijst')) options();
    clearTimeout(syncTimer); syncTimer = setTimeout(() => { void sync(); }, 3000);
  }
  nameForm.onsubmit = async event => {
    event.preventDefault(); if (!canEdit() || saving || !client.configured) return;
    saving = true; nameError.hidden = true; controls();
    try {
      await client.join(nameInput.value, scores()); nameDialog.close(); toast('Naam bewaard.');
    } catch (cause) {
      const savedName = nameInput.value.trim().replace(/\s+/gu, ' ');
      if (client.isJoined() && client.getDisplayName() === savedName) {
        nameDialog.close(); toast('Naam bewaard. Je scores worden bijgewerkt zodra er verbinding is.');
      } else { nameError.textContent = cause.message || 'Je naam kon niet worden bewaard.'; nameError.hidden = false; }
    } finally {
      saving = false; controls(); onSaved();
      if (client.isJoined() && !nameDialog.open && navigation.isCurrent('ranglijst')) { error.hidden = true; options(); void load(); }
    }
  };
  if (editName) editName.onclick = () => { if (canEdit()) openName(true); };
  exercise.onchange = () => { selectedExercise = exercise.value; userSelected = true; error.hidden = true; options(); void load(false); };
  refresh.onclick = async () => { error.hidden = true; await sync(); await load(); };
  navigation.onOpen('ranglijst', () => {
    if (ensureName()) return;
    error.hidden = true; options(); controls(); void load(); void sync();
  });
  globalThis.addEventListener('online', onSaved);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onSaved(); });
  return { onSaved, getExerciseSuggestions: () => client.getExercises() };
}
