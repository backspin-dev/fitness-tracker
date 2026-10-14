import { createState, localDate, getWorkout, getPreviousWorkout, commitWorkout, loadState, saveState, validateState, exportBackup, ensureRecoveryBackup, setExerciseRanking } from './data.js';
import { setupGroups } from './groups-ui.js';
import { setupProgress } from './progress-ui.js';
import { hasTrainingData } from './backup-reminder.js';
import { setupRecovery } from './recovery-ui.js';
import { setupLeaderboard } from './leaderboard-ui.js';
import { setupExerciseNames } from './exercise-names-ui.js';

const $ = id => document.getElementById(id);
function groupInfo(id = split) { return state.groups.find(group => group.id === id); }
const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
let state = createState(), split = 'push', date = localDate(), loaded = false;
let savedState = state;
let saveQueue = Promise.resolve(), revision = 0, pending = 0, failed = false;
let editId = null, toastTimer, waitingWorker = null, releaseEditor = null;
let knownToday = localDate(), importing = false;
let exporting = false;
let ownsEditor = false, recoverableLoadError = false;

function textNode(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function prettyDate(value) { return dateFormat.format(new Date(`${value}T12:00:00`)); }
function numberText(value) { return String(value).replace('.', ','); }
function parseValue(value, field) {
  const raw = value.trim();
  const pattern = field === 'sets' ? /^\d{1,2}$/ : field === 'reps' ? /^\d{1,3}$/ : /^\d{1,4}(?:[.,]\d{1,2})?$/;
  if (!pattern.test(raw)) return null;
  const number = Number(raw.replace(',', '.'));
  return Number.isFinite(number) && number >= (field === 'sets' ? 1 : 0) && number <= (field === 'sets' ? 99 : field === 'reps' ? 999 : 2000) ? number : null;
}
function setStatus(message, error = false) {
  const dot = textNode('span', '', 'status-dot');
  if (error) dot.classList.add('status-error');
  $('save-status').replaceChildren(dot, document.createTextNode(message));
}
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3800);
}
function showError(message) { $('app-error').textContent = message; $('app-error').hidden = false; }
function queueSave() {
  const currentRevision = ++revision;
  const snapshot = validateState(state);
  pending++;
  setStatus('Opslaan…');
  saveQueue = saveQueue.catch(() => {}).then(() => saveState(snapshot)).then(async () => {
    savedState = snapshot;
    if (currentRevision === revision) {
      failed = false;
      $('app-error').hidden = true;
      setStatus('Bewaard op dit apparaat');
    }
    if ($('settings-dialog').open) await recovery.refresh();
    leaderboard.onSaved();
    return true;
  }).catch(() => {
    if (currentRevision === revision) {
      failed = true;
      setStatus('Niet opgeslagen', true);
      showError('Opslaan lukt niet. Je wijzigingen staan nog op dit scherm. Maak via Instellingen een back-up voordat je de app sluit. Probeer daarna opnieuw.');
    }
    return false;
  }).finally(() => { pending--; });
  return saveQueue;
}
function changeWorkout(workout, rerender = true, base = state) {
  if (!loaded || importing) return Promise.resolve(false);
  try {
    state = commitWorkout(base, date, split, workout);
    const saved = queueSave();
    if (rerender) render();
    else updateContext();
    return saved;
  } catch (error) { showError(error.message); return Promise.resolve(false); }
}
function updateMetric(id, field, value) {
  const workout = getWorkout(state, date, split);
  const exercise = workout.find(item => item.id === id);
  if (!exercise || exercise[field] === value) return;
  exercise[field] = value;
  changeWorkout(workout, false);
}
function updateContext() {
  const today = localDate();
  $('workout-date').max = today;
  $('workout-date').value = date;
  $('date-label').textContent = date === today ? 'Vandaag' : 'Training';
  $('next-day').disabled = date >= today;
  $('previous-day').disabled = date <= '1900-01-01';
  const workout = getWorkout(state, date, split);
  const recorded = Object.hasOwn(state.sessions, `${date}:${split}`);
  const previous = recorded ? null : getPreviousWorkout(state, date, split);
  $('source-note').hidden = !previous || !workout.length;
  $('source-note').textContent = previous ? `Klaargezet vanuit je laatste ${groupInfo().name}-training · ${prettyDate(previous.date)}` : '';
  $('exercise-count').textContent = `${workout.length} oefening${workout.length === 1 ? '' : 'en'}`;
  $('history-note').hidden = date === today;
  $('history-note').textContent = recorded
    ? 'Je bewerkt de opgeslagen training op deze datum. Andere opgeslagen trainingen blijven behouden.'
    : 'Op deze datum staat nog geen training. De oefeningen staan alvast klaar; pas ze aan of bewaar deze training.';
  $('record-workout').hidden = recorded || !workout.length;
  $('workout-hint').textContent = recorded ? 'Elke wijziging wordt automatisch bewaard.' : previous ? 'Je vorige oefeningen, gewichten, sets en reps staan klaar. Alleen aanpassen wat verandert.' : 'Stel je oefeningen één keer in. De volgende keer staan ze klaar.';
}
function makeMetric(exercise, field) {
  const wrap = document.createElement('div');
  wrap.className = `metric-${field}`;
  const label = textNode('label', field === 'weight' ? 'GEWICHT · KG' : field === 'sets' ? 'SETS' : 'REPS', 'metric-label');
  const inputId = `value-${exercise.id}-${field}`;
  label.htmlFor = inputId;
  const stepper = document.createElement('div'); stepper.className = 'stepper';
  const minus = textNode('button', '−'), plus = textNode('button', '+');
  const fieldName = field === 'weight' ? 'Gewicht' : field === 'sets' ? 'Sets' : 'Reps';
  minus.setAttribute('aria-label', `${fieldName} verlagen voor ${exercise.name}`);
  plus.setAttribute('aria-label', `${fieldName} verhogen voor ${exercise.name}`);
  const input = document.createElement('input');
  input.type = 'text'; input.id = inputId; input.value = numberText(exercise[field]);
  input.inputMode = field === 'weight' ? 'decimal' : 'numeric';
  input.autocomplete = 'off'; input.maxLength = field === 'weight' ? 7 : field === 'sets' ? 2 : 3;
  input.setAttribute('aria-label', `${fieldName} voor ${exercise.name}`);
  input.addEventListener('focus', () => input.select());
  input.addEventListener('input', () => {
    const value = parseValue(input.value, field);
    input.setAttribute('aria-invalid', String(value === null));
    if (value !== null) updateMetric(exercise.id, field, value);
  });
  input.addEventListener('blur', () => {
    const saved = getWorkout(state, date, split).find(item => item.id === exercise.id);
    if (!saved) return;
    if (parseValue(input.value, field) === null) toast(field === 'weight' ? 'Vul een gewicht van 0 tot 2.000 kg in.' : field === 'sets' ? 'Vul een heel aantal sets van 1 tot 99 in.' : 'Vul een heel aantal reps van 0 tot 999 in.');
    input.value = numberText(saved[field]); input.removeAttribute('aria-invalid');
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
  function step(direction) {
    const current = getWorkout(state, date, split).find(item => item.id === exercise.id);
    if (!current) return;
    const value = Math.max(field === 'sets' ? 1 : 0, Math.min(field === 'weight' ? 2000 : field === 'sets' ? 99 : 999, Math.round((current[field] + direction * (field === 'weight' ? 0.5 : 1)) * 100) / 100));
    input.value = numberText(value); input.removeAttribute('aria-invalid'); updateMetric(exercise.id, field, value);
  }
  minus.addEventListener('click', () => step(-1)); plus.addEventListener('click', () => step(1));
  stepper.append(minus, input, plus); wrap.append(label, stepper); return wrap;
}
function render() {
  document.querySelectorAll('main button, main input').forEach(item => { item.disabled = false; });
  if (!groupInfo()) split = state.groups.find(group => !group.archived).id;
  $('split-title').textContent = groupInfo().name;
  $('split-description').textContent = groupInfo().archived ? 'Verborgen onderdeel · eerdere trainingen' : groupInfo().description || 'Jouw oefeningen, op jouw manier';
  const visibleGroups = state.groups.filter(group => !group.archived || group.id === split);
  $('split-tabs').replaceChildren(...visibleGroups.map(group => {
    const button = textNode('button', group.name);
    button.id = `tab-${group.id}`; button.dataset.split = group.id;
    button.title = group.name; button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'workout-panel');
    button.setAttribute('aria-selected', String(group.id === split));
    button.tabIndex = group.id === split ? 0 : -1;
    return button;
  }));
  $('workout-panel').setAttribute('aria-labelledby', `tab-${split}`);
  const workout = getWorkout(state, date, split);
  const cards = workout.map((exercise, index) => {
    const card = document.createElement('article'); card.className = 'exercise-card';
    const top = document.createElement('div'); top.className = 'exercise-top';
    const edit = textNode('button', '···', 'edit-exercise');
    edit.setAttribute('aria-label', `${exercise.name} bewerken of verwijderen`);
    edit.addEventListener('click', () => openExercise(exercise));
    top.append(textNode('span', String(index + 1).padStart(2, '0'), 'exercise-number'), textNode('h3', exercise.name, 'exercise-name'), edit);
    const metrics = document.createElement('div'); metrics.className = 'metrics';
    metrics.append(makeMetric(exercise, 'weight'), makeMetric(exercise, 'sets'), makeMetric(exercise, 'reps'));
    card.append(top, metrics); return card;
  });
  $('exercise-list').replaceChildren(...cards);
  $('empty-state').hidden = !!workout.length;
  updateContext();
  if (!loaded) document.querySelectorAll('main button, main input').forEach(item => { item.disabled = true; });
}
function selectDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > localDate() || value < '1900-01-01') { updateContext(); return; }
  if (Number.isNaN(new Date(`${value}T12:00:00`).getTime())) { updateContext(); return; }
  date = value; render();
}
function moveDate(amount) {
  const target = new Date(`${date}T12:00:00`); target.setDate(target.getDate() + amount); selectDate(localDate(target));
}
function openExercise(exercise = null) {
  if (!loaded) return;
  editId = exercise?.id ?? null;
  $('exercise-dialog-title').textContent = exercise ? 'Oefening bewerken' : 'Oefening toevoegen';
  $('exercise-name').value = exercise?.name ?? '';
  $('exercise-weight').value = numberText(exercise?.weight ?? 0);
  $('exercise-reps').value = String(exercise?.reps ?? 0);
  $('exercise-sets').value = String(exercise?.sets ?? 1);
  $('delete-exercise').hidden = !exercise;
  $('save-exercise').textContent = exercise ? 'Wijzigingen bewaren' : 'Toevoegen';
  $('exercise-error').hidden = true;
  exerciseNames.open(exercise);
  $('exercise-dialog').showModal(); $('exercise-name').focus();
}
function confirmAction(title, message, action) {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog');
    $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-ok').textContent = action;
    const done = result => { dialog.close(); $('confirm-ok').onclick = null; $('confirm-cancel').onclick = null; dialog.oncancel = null; resolve(result); };
    $('confirm-ok').onclick = () => done(true); $('confirm-cancel').onclick = () => done(false);
    dialog.oncancel = event => { event.preventDefault(); done(false); };
    dialog.showModal(); $('confirm-cancel').focus();
  });
}

document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('split-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-split]'); if (!button || !loaded || importing) return;
  split = button.dataset.split; render();
});
$('split-tabs').addEventListener('keydown', event => {
  if (!loaded || importing || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const keys = state.groups.filter(group => !group.archived || group.id === split).map(group => group.id), index = keys.indexOf(split);
  split = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1) : keys[(index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
  render(); $(`tab-${split}`).focus();
});
$('workout-date').addEventListener('change', event => selectDate(event.target.value));
$('previous-day').addEventListener('click', () => moveDate(-1));
$('next-day').addEventListener('click', () => moveDate(1));
$('add-exercise').addEventListener('click', () => openExercise());
$('record-workout').addEventListener('click', async () => { if (await changeWorkout(getWorkout(state, date, split))) toast('Training bewaard.'); });
$('exercise-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!loaded || importing) return;
  const name = $('exercise-name').value.trim(), weight = parseValue($('exercise-weight').value, 'weight'), reps = parseValue($('exercise-reps').value, 'reps');
  const sets = parseValue($('exercise-sets').value, 'sets');
  if (!name || weight === null || reps === null || sets === null) {
    $('exercise-error').textContent = 'Vul een naam, gewicht van 0–2.000 kg, 1–99 sets en 0–999 reps in.';
    $('exercise-error').hidden = false; return;
  }
  const workout = getWorkout(state, date, split);
  const exercise = { id: editId || crypto.randomUUID(), name, weight, reps, sets };
  const rankingKey = exerciseNames.getRankingKey();
  if (rankingKey) exercise.rankingKey = rankingKey;
  let base = state;
  try { if (editId && exerciseNames.hasChanged()) base = setExerciseRanking(state, split, editId, rankingKey || null); }
  catch (error) { $('exercise-error').textContent = error.message; $('exercise-error').hidden = false; return; }
  if (editId) workout[workout.findIndex(item => item.id === editId)] = exercise; else workout.push(exercise);
  changeWorkout(workout, true, base); $('exercise-dialog').close();
});
$('delete-exercise').addEventListener('click', async () => {
  if (await confirmAction('Oefening verwijderen?', 'Deze oefening verdwijnt uit deze training. Eerdere opgeslagen trainingen blijven bewaard.', 'Verwijderen')) {
    changeWorkout(getWorkout(state, date, split).filter(item => item.id !== editId)); $('exercise-dialog').close();
  }
});
$('settings-button').addEventListener('click', () => { recovery.refresh(); $('settings-dialog').showModal(); });
$('history-button').addEventListener('click', () => {
  const items = Object.entries(state.sessions).sort(([a], [b]) => b.localeCompare(a)).map(([key, workout]) => {
    const [day, type] = key.split(':'); const button = document.createElement('button'); button.className = 'history-item';
    const description = document.createElement('div'); description.append(textNode('strong', `${groupInfo(type).name} · ${prettyDate(day)}`), textNode('small', `${workout.length} oefening${workout.length === 1 ? '' : 'en'}`));
    button.append(description, textNode('span', '›')); button.addEventListener('click', () => { split = type; date = day; render(); $('history-dialog').close(); }); return button;
  });
  $('history-list').replaceChildren(...(items.length ? items : [textNode('p', 'Nog geen trainingen bewaard. Je eerste wijziging wordt automatisch opgeslagen.', 'settings-copy')]));
  $('history-dialog').showModal();
});
$('export-backup').addEventListener('click', exportFile);
async function exportFile() {
  if (exporting || importing) return;
  exporting = true; $('export-backup').disabled = true;
  try {
  const json = exportBackup(state);
  const file = new File([json], `fitness-backup-${localDate()}.json`, { type: 'application/json' });
  function downloadFile() {
    const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = file.name;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('backup-message').textContent = 'Je back-up is aangeboden als download. Bewaar het bestand in Bestanden of je eigen iCloud Drive.';
  }
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Fitness back-up' });
      $('backup-message').textContent = 'Back-up aangeboden aan het deelmenu. Bewaar het bestand op een plek die je terugvindt.';
    } else {
      downloadFile();
    }
  } catch (error) {
    if (error.name === 'AbortError') { $('backup-message').textContent = 'Export geannuleerd. Je automatische lokale kopieën blijven bewaard.'; return; }
    downloadFile();
  }
  } catch { $('backup-message').textContent = 'Exporteren is niet gelukt. Probeer het opnieuw.'; }
  finally { exporting = false; $('export-backup').disabled = false; }
}
$('import-backup').addEventListener('click', () => { if (loaded) $('import-file').click(); });
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 7 * 1024 * 1024) throw new Error('Het bestand is groter dan 7 MB.');
    const imported = validateState(JSON.parse(await file.text()));
    const count = Object.values(imported.routines).reduce((sum, list) => sum + list.length, 0);
    const sessions = Object.keys(imported.sessions).length;
    const weighings = Object.keys(imported.bodyWeights).length;
    if (!await confirmAction('Gegevens importeren?', `Dit bestand bevat ${count} oefening${count === 1 ? '' : 'en'}, ${sessions} opgeslagen training${sessions === 1 ? '' : 'en'} en ${weighings} weging${weighings === 1 ? '' : 'en'}. Het vervangt je huidige gegevens. De huidige opgeslagen gegevens blijven automatisch als lokale kopie bewaard.`, 'Importeren')) return;
    importing = true;
    $('main').inert = true;
    $('settings-dialog').inert = true;
    await saveQueue;
    if (failed) throw new Error('Bewaar of exporteer eerst je huidige wijzigingen voordat je gegevens vervangt.');
    await saveState(imported, { protectCurrent: 'import' });
    state = savedState = imported; split = imported.ui?.split || imported.groups.find(group => !group.archived).id; date = localDate(); failed = false;
    $('app-error').hidden = true; render(); progress.refresh(); setStatus('Bewaard op dit apparaat');
    $('backup-message').textContent = 'Import gelukt. Je gegevens zijn op dit apparaat bewaard.';
    $('settings-dialog').close(); toast('Je oefeningen staan klaar.');
  } catch (error) { $('backup-message').textContent = `Import niet uitgevoerd. ${error instanceof SyntaxError ? 'Dit is geen geldig JSON-bestand.' : error.message}`; }
  finally { importing = false; $('main').inert = false; $('settings-dialog').inert = false; await recovery.refresh(); leaderboard.onSaved(); }
});
$('update-button').addEventListener('click', async () => {
  await saveQueue; if (failed || !waitingWorker) return;
  if (await confirmAction('App bijwerken?', 'Je opgeslagen trainingen blijven bewaard. De app wordt opnieuw geopend.', 'Bijwerken')) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }
});
window.addEventListener('beforeunload', event => { if (pending || failed || importing) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => releaseEditor?.());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
function handleNewDay() {
  if (document.visibilityState !== 'visible' || !loaded) return;
  const today = localDate();
  if (today !== knownToday) {
    if (date === knownToday) {
      if (document.querySelector('dialog[open]') || document.activeElement?.tagName === 'INPUT') return;
      date = today;
    }
    knownToday = today;
    render();
  }
}
document.addEventListener('visibilitychange', handleNewDay);
window.addEventListener('focus', handleNewDay);
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', handleNewDay));
setInterval(handleNewDay, 60000);

async function prepareOffline() {
  if (!('serviceWorker' in navigator)) { $('offline-status').textContent = 'Offline gebruik niet beschikbaar'; return; }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const offerUpdate = () => { waitingWorker = navigator.serviceWorker.controller ? registration.waiting : null; $('update-button').hidden = !waitingWorker; };
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (['installed', 'activated'].includes(worker.state)) offerUpdate(); });
    });
    await navigator.serviceWorker.ready;
    offerUpdate();
    $('offline-status').textContent = 'Klaar voor offline gebruik';
  } catch { $('offline-status').textContent = 'Offline laden is nog niet gelukt'; }
}
function changeState(next, options = {}) {
  if (!loaded || importing) return Promise.resolve(false);
  state = validateState(next);
  if (options.selectFromState) split = state.ui.split;
  if (options.today) date = localDate();
  state.ui = { split, date };
  const saved = queueSave(); render(); return saved;
}
const groups = setupGroups({ getState: () => state, canEdit: () => loaded && !importing, changeState, confirmAction, toast });
const progress = setupProgress({ getState: () => state, canEdit: () => loaded && !importing, changeState, confirmAction, toast });
const leaderboard = setupLeaderboard({ getState: () => savedState, canEdit: () => loaded && !importing, toast });
const exerciseNames = setupExerciseNames({ loadSuggestions: () => leaderboard.getExerciseSuggestions() });
const recovery = setupRecovery({ canEdit: () => ownsEditor && (loaded || recoverableLoadError) && !importing, canPreserveCurrent: () => loaded, confirmAction, toast, restoreState: async snapshot => {
  if (!ownsEditor || (!loaded && !recoverableLoadError) || importing || exporting) return false;
  importing = true; $('main').inert = true; $('settings-dialog').inert = true;
  try {
    await saveQueue;
    if (failed) throw new Error('Bewaar of exporteer eerst je huidige wijzigingen voordat je een kopie terugzet.');
    const restored = validateState(snapshot);
    await saveState(restored, { protectCurrent: 'restore' });
    state = savedState = restored; split = state.ui?.split || state.groups.find(group => !group.archived).id; date = localDate();
    loaded = true; recoverableLoadError = false; failed = false; $('app-error').hidden = true;
    $('import-backup').disabled = false; $('export-backup').disabled = false;
    render(); progress.refresh(); setStatus('Bewaard op dit apparaat'); return true;
  } finally { importing = false; $('main').inert = false; $('settings-dialog').inert = false; leaderboard.onSaved(); }
} });

async function init() {
  render();
  try {
    let canEdit = true;
    if (navigator.locks) {
      canEdit = await new Promise(resolve => {
        navigator.locks.request('fitness-tracker-editor', { ifAvailable: true }, async lock => {
          resolve(!!lock);
          if (lock) await new Promise(release => { releaseEditor = release; });
        }).catch(() => resolve(false));
      });
    }
    ownsEditor = canEdit;
    state = savedState = await loadState() || createState(); split = state.ui?.split || state.groups.find(group => !group.archived).id; loaded = canEdit;
    render();
    if (canEdit) {
      try { await ensureRecoveryBackup(state); }
      catch { $('recovery-status').textContent = 'De automatische kopie kon niet worden gemaakt. Je kunt hieronder een JSON exporteren.'; }
    }
    if (!canEdit) {
      showError('De tracker staat al open in een ander tabblad. Sluit dat tabblad en laad deze pagina opnieuw om te wijzigen.');
      setStatus('Geopend als leesweergave'); $('import-backup').disabled = true;
    } else setStatus(hasTrainingData(state) ? 'Bewaard op dit apparaat' : 'Alleen op dit apparaat');
    if (navigator.storage?.persist) {
      navigator.storage.persist().then(persistent => {
        $('storage-info').textContent = persistent ? 'Blijvende opslag is toegestaan. Maak daarnaast een back-up voor verlies of wissen van je toestel.' : 'Je browser garandeert geen blijvende opslag. Maak daarom regelmatig een back-up.';
      }).catch(() => {});
    }
  } catch (error) {
    recoverableLoadError = ownsEditor;
    showError(`Je gegevens konden niet worden geladen. Er wordt niets overschreven. Open Instellingen om een lokale kopie terug te zetten, of probeer opnieuw. ${error.message}`);
    setStatus('Opslag niet beschikbaar', true); $('import-backup').disabled = true; $('export-backup').disabled = true;
    await recovery.refresh();
  }
  leaderboard.onSaved(); prepareOffline();
}
init();
