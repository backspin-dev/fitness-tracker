import { createState, localDate, getWorkout, getPreviousWorkout, commitWorkout, loadState, saveState, validateState, exportBackup, loadBackupReminder, saveBackupReminder } from './data.js';
import { setupGroups } from './groups-ui.js';
import { setupProgress } from './progress-ui.js';
import { createReminder, isReminderDue, confirmBackup, snoozeReminder, hasTrainingData } from './backup-reminder.js';

const $ = id => document.getElementById(id);
function groupInfo(id = split) { return state.groups.find(group => group.id === id); }
const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
let state = createState(), split = 'push', date = localDate(), loaded = false;
let saveQueue = Promise.resolve(), revision = 0, pending = 0, failed = false;
let editId = null, toastTimer, waitingWorker = null, releaseEditor = null;
let knownToday = localDate(), importing = false;
let backupReminder = null, reminderReady = false, reminderError = false, exporting = false;
let reminderQueue = Promise.resolve();

function updateBackupReminder() {
  const today = localDate();
  $('backup-reminder').hidden = !loaded || !hasTrainingData(state) || !backupReminder || !isReminderDue(backupReminder, today);
  $('reminder-status').textContent = reminderError
    ? 'De herinnering kon niet worden bewaard of geladen. Je kunt hieronder zelf een back-up opslaan.'
    : !loaded ? 'Open de app in één tabblad om je herinnering bij te houden.'
    : backupReminder?.confirmedOn ? `Laatste back-up door jou bevestigd: ${prettyDate(backupReminder.confirmedOn)}. Herinnering na 14 dagen.`
    : 'Je krijgt na 14 dagen een herinnering zodra je de app opent. Je kunt ook nu al een back-up opslaan.';
  $('reminder-export').disabled = exporting || importing;
  $('reminder-snooze').disabled = exporting || importing;
}
function persistBackupReminder(next) {
  backupReminder = next;
  reminderQueue = reminderQueue.catch(() => {}).then(() => saveBackupReminder(next)).then(() => {
    reminderError = false; return true;
  }).catch(() => { reminderError = true; return false; }).finally(updateBackupReminder);
  updateBackupReminder();
  return reminderQueue;
}
function ensureBackupReminder() {
  if (loaded && reminderReady && !backupReminder && hasTrainingData(state)) return persistBackupReminder(createReminder(localDate()));
  updateBackupReminder();
  return Promise.resolve(true);
}
async function prepareBackupReminder() {
  try {
    backupReminder = await loadBackupReminder(); reminderReady = true;
    await ensureBackupReminder();
  } catch { reminderError = true; updateBackupReminder(); }
}

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
  if (!(field === 'reps' ? /^\d{1,3}$/ : /^\d{1,4}(?:[.,]\d{1,2})?$/).test(raw)) return null;
  const number = Number(raw.replace(',', '.'));
  return Number.isFinite(number) && number <= (field === 'reps' ? 999 : 2000) ? number : null;
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
    if (currentRevision === revision) {
      failed = false;
      $('app-error').hidden = true;
      setStatus('Bewaard op dit apparaat');
    }
    await ensureBackupReminder();
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
function changeWorkout(workout, rerender = true) {
  if (!loaded || importing) return Promise.resolve(false);
  try {
    state = commitWorkout(state, date, split, workout);
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
  $('workout-hint').textContent = recorded ? 'Elke wijziging wordt automatisch bewaard.' : previous ? 'Je vorige oefeningen, gewichten en reps staan klaar. Alleen aanpassen wat verandert.' : 'Stel je oefeningen één keer in. De volgende keer staan ze klaar.';
}
function makeMetric(exercise, field) {
  const wrap = document.createElement('div');
  const label = textNode('label', field === 'weight' ? 'GEWICHT · KG' : 'REPS', 'metric-label');
  const inputId = `value-${exercise.id}-${field}`;
  label.htmlFor = inputId;
  const stepper = document.createElement('div'); stepper.className = 'stepper';
  const minus = textNode('button', '−'), plus = textNode('button', '+');
  const fieldName = field === 'weight' ? 'Gewicht' : 'Reps';
  minus.setAttribute('aria-label', `${fieldName} verlagen voor ${exercise.name}`);
  plus.setAttribute('aria-label', `${fieldName} verhogen voor ${exercise.name}`);
  const input = document.createElement('input');
  input.type = 'text'; input.id = inputId; input.value = numberText(exercise[field]);
  input.inputMode = field === 'weight' ? 'decimal' : 'numeric';
  input.autocomplete = 'off'; input.maxLength = field === 'weight' ? 7 : 3;
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
    if (parseValue(input.value, field) === null) toast(field === 'weight' ? 'Vul een gewicht van 0 tot 2.000 kg in.' : 'Vul een heel aantal reps van 0 tot 999 in.');
    input.value = numberText(saved[field]); input.removeAttribute('aria-invalid');
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
  function step(direction) {
    const current = getWorkout(state, date, split).find(item => item.id === exercise.id);
    if (!current) return;
    const value = Math.max(0, Math.min(field === 'weight' ? 2000 : 999, Math.round((current[field] + direction * (field === 'weight' ? 0.5 : 1)) * 100) / 100));
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
    metrics.append(makeMetric(exercise, 'weight'), makeMetric(exercise, 'reps'));
    card.append(top, metrics); return card;
  });
  $('exercise-list').replaceChildren(...cards);
  $('empty-state').hidden = !!workout.length;
  updateContext();
  updateBackupReminder();
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
  $('delete-exercise').hidden = !exercise;
  $('save-exercise').textContent = exercise ? 'Wijzigingen bewaren' : 'Toevoegen';
  $('exercise-error').hidden = true;
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
  const name = $('exercise-name').value.trim(), weight = parseValue($('exercise-weight').value, 'weight'), reps = parseValue($('exercise-reps').value, 'reps');
  if (!name || weight === null || reps === null) {
    $('exercise-error').textContent = 'Vul een naam, een gewicht van 0–2.000 kg en een heel aantal reps van 0–999 in.';
    $('exercise-error').hidden = false; return;
  }
  const workout = getWorkout(state, date, split);
  const exercise = { id: editId || crypto.randomUUID(), name, weight, reps };
  if (editId) workout[workout.findIndex(item => item.id === editId)] = exercise; else workout.push(exercise);
  changeWorkout(workout); $('exercise-dialog').close();
});
$('delete-exercise').addEventListener('click', async () => {
  if (await confirmAction('Oefening verwijderen?', 'Deze oefening verdwijnt uit deze training. Eerdere opgeslagen trainingen blijven bewaard.', 'Verwijderen')) {
    changeWorkout(getWorkout(state, date, split).filter(item => item.id !== editId)); $('exercise-dialog').close();
  }
});
$('settings-button').addEventListener('click', () => { updateBackupReminder(); $('settings-dialog').showModal(); });
$('history-button').addEventListener('click', () => {
  const items = Object.entries(state.sessions).sort(([a], [b]) => b.localeCompare(a)).map(([key, workout]) => {
    const [day, type] = key.split(':'); const button = document.createElement('button'); button.className = 'history-item';
    const description = document.createElement('div'); description.append(textNode('strong', `${groupInfo(type).name} · ${prettyDate(day)}`), textNode('small', `${workout.length} oefening${workout.length === 1 ? '' : 'en'}`));
    button.append(description, textNode('span', '›')); button.addEventListener('click', () => { split = type; date = day; render(); $('history-dialog').close(); }); return button;
  });
  $('history-list').replaceChildren(...(items.length ? items : [textNode('p', 'Nog geen trainingen bewaard. Je eerste wijziging wordt automatisch opgeslagen.', 'settings-copy')]));
  $('history-dialog').showModal();
});
$('reminder-snooze').addEventListener('click', async () => {
  if (!loaded || importing || exporting || !backupReminder) return;
  if (await persistBackupReminder(snoozeReminder(backupReminder, localDate()))) toast('We herinneren je over 3 dagen opnieuw.');
});
$('reminder-export').addEventListener('click', () => {
  if (!loaded || importing || exporting) return;
  $('settings-dialog').showModal(); exportFile();
});
$('export-backup').addEventListener('click', exportFile);
async function exportFile() {
  if (exporting || importing) return;
  exporting = true; $('export-backup').disabled = true; updateBackupReminder();
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
    if (error.name === 'AbortError') { $('backup-message').textContent = 'Back-up geannuleerd. De herinnering blijft staan.'; return; }
    downloadFile();
  }
  // A share/download result does not prove that the user kept the file.
  if (loaded && hasTrainingData(state) && await confirmAction('Back-up bewaard?', 'Heb je het bestand opgeslagen in Bestanden of je eigen iCloud Drive? Bevestig pas als het daar staat. Dan herinneren we je over 14 dagen opnieuw.', 'Ja, bewaard')) {
    const saved = await persistBackupReminder(confirmBackup(backupReminder || createReminder(localDate()), localDate()));
    $('backup-message').textContent = saved ? 'Bevestigd. Over 14 dagen verschijnt de volgende herinnering wanneer je de app opent.' : 'Back-up bevestigd, maar de herinneringsdatum kon niet worden bewaard.';
  }
  } catch { $('backup-message').textContent = 'Back-up maken is niet gelukt. Probeer het opnieuw. De herinnering is niet aangepast.'; }
  finally { exporting = false; $('export-backup').disabled = false; updateBackupReminder(); }
}
$('import-backup').addEventListener('click', () => { if (loaded) $('import-file').click(); });
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Het bestand is groter dan 5 MB.');
    const imported = validateState(JSON.parse(await file.text()));
    const count = Object.values(imported.routines).reduce((sum, list) => sum + list.length, 0);
    const sessions = Object.keys(imported.sessions).length;
    const weighings = Object.keys(imported.bodyWeights).length;
    if (!await confirmAction('Gegevens importeren?', `Dit bestand bevat ${count} oefeningen in je schema’s en ${sessions} bewaarde trainingen en ${weighings} wegingen. Het vervangt je huidige gegevens op dit apparaat. Bewaar die eerst als back-up als je ze wilt houden.`, 'Importeren')) return;
    importing = true;
    $('main').inert = true;
    $('settings-dialog').inert = true;
    await saveQueue;
    await saveState(imported);
    state = imported; split = imported.ui?.split || imported.groups.find(group => !group.archived).id; date = localDate(); failed = false;
    $('app-error').hidden = true; render(); progress.refresh(); setStatus('Bewaard op dit apparaat');
    $('backup-message').textContent = 'Import gelukt. Je gegevens zijn op dit apparaat bewaard.';
    $('settings-dialog').close(); toast('Je oefeningen staan klaar.');
  } catch (error) { $('backup-message').textContent = `Import niet uitgevoerd. ${error instanceof SyntaxError ? 'Dit is geen geldig JSON-bestand.' : error.message}`; }
  finally { importing = false; $('main').inert = false; $('settings-dialog').inert = false; await ensureBackupReminder(); }
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
  updateBackupReminder();
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
    state = await loadState() || createState(); split = state.ui?.split || state.groups.find(group => !group.archived).id; loaded = canEdit;
    render();
    if (canEdit) await prepareBackupReminder();
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
    showError(`Je gegevens konden niet worden geladen. Er wordt niets overschreven. Sluit andere tabbladen en probeer opnieuw. ${error.message}`);
    setStatus('Opslag niet beschikbaar', true); $('import-backup').disabled = true; $('export-backup').disabled = true;
  }
  prepareOffline();
}
init();
