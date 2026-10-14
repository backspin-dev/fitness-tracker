import { localDate, setBodyWeight, deleteBodyWeight } from './data.js';
import { listExerciseSeries, bodyWeightSeries, weeklyTrainingCounts, trainingSummary, latestWorkoutComparison, renderLineChart, renderBarChart } from './stats.js';

export function setupProgress({ getState, canEdit, changeState, confirmAction, toast }) {
  const $ = id => document.getElementById(id);
  const saveError = 'Je wijzigingen zijn nog niet opgeslagen. Ze staan wel op dit scherm. Maak via Instellingen een back-up voordat je de app sluit.';
  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const numberFormat = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });
  const prettyDate = date => dateFormat.format(new Date(`${date}T12:00:00`));
  const number = value => numberFormat.format(value);
  let tab = 'exercise', metric = 'weight', selectedExercise = '', selectedGroup = '', saving = false;
  function node(tag, text, className) {
    const el = document.createElement(tag); el.textContent = text;
    if (className) el.className = className; return el;
  }
  function delta(value, unit) { return `${value > 0 ? '+' : ''}${number(value)} ${unit}`; }
  function table(container, headings, rows) {
    const table = document.createElement('table'); table.className = 'measurement-table';
    const head = document.createElement('thead'), tr = document.createElement('tr');
    for (const label of headings) { const th = node('th', label); th.scope = 'col'; tr.append(th); }
    head.append(tr); const body = document.createElement('tbody');
    for (const values of rows) { const row = document.createElement('tr'); values.forEach(value => row.append(node('td', value))); body.append(row); }
    table.append(head, body); container.replaceChildren(rows.length ? table : node('p', 'Nog geen metingen.', 'chart-note'));
  }
  function renderExercise() {
    const series = listExerciseSeries(getState());
    if (!series.some(item => item.key === selectedExercise)) selectedExercise = series[0]?.key || '';
    const options = series.map(item => { const option = node('option', `${item.name} · ${item.groupName}`); option.value = item.key; return option; });
    if (!options.length) { const option = node('option', 'Nog geen oefeningen bewaard'); option.value = ''; options.push(option); }
    $('exercise-series').replaceChildren(...options); $('exercise-series').value = selectedExercise; $('exercise-series').disabled = !series.length;
    $('chart-weight').setAttribute('aria-pressed', String(metric === 'weight')); $('chart-reps').setAttribute('aria-pressed', String(metric === 'reps'));
    const current = series.find(item => item.key === selectedExercise), points = current?.points.filter(point => point.date <= localDate()) || [];
    const unit = metric === 'weight' ? 'kg' : 'reps', first = points[0], last = points.at(-1);
    $('exercise-summary').textContent = last ? `${number(last[metric])} ${unit} op ${prettyDate(last.date)}${points.length > 1 ? ` · ${delta(Math.round((last[metric] - first[metric]) * 100) / 100, unit)} sinds je eerste meting` : ' · je eerste meting'}` : 'Bewaar een training om je voortgang te zien.';
    renderLineChart($('exercise-chart'), points.map(point => ({ date: point.date, value: point[metric] })), { label: `${current?.name || 'Oefening'}: ${metric === 'weight' ? 'gewicht' : 'reps'}`, unit });
    table($('exercise-measurements'), ['Datum', 'Kg', 'Reps'], points.slice(-20).reverse().map(point => [prettyDate(point.date), number(point.weight), number(point.reps)]));
  }
  function renderBody() {
    const points = bodyWeightSeries(getState()).filter(point => point.date <= localDate()), first = points[0], last = points.at(-1);
    $('body-summary').textContent = last ? `${number(last.value)} kg op ${prettyDate(last.date)}${points.length > 1 ? ` · ${delta(Math.round((last.value - first.value) * 100) / 100, 'kg')} sinds je eerste weging` : ' · je eerste weging'}` : 'Voeg je eerste weging toe. Eén meting per dag is genoeg.';
    renderLineChart($('body-chart'), points, { label: 'Lichaamsgewicht', unit: 'kg' });
    const rows = points.slice(-20).reverse().map(point => {
      const button = node('button', '', 'history-item');
      button.append(node('span', prettyDate(point.date)), node('strong', `${number(point.value)} kg`));
      button.setAttribute('aria-label', `Weging ${prettyDate(point.date)} bewerken`);
      button.onclick = () => { $('body-date').value = point.date; fillBodyForm(); $('body-weight').focus(); };
      return button;
    });
    $('body-measurements').replaceChildren(...(rows.length ? rows : [node('p', 'Nog geen wegingen.', 'chart-note')]));
    $('body-date').max = localDate();
    document.querySelectorAll('#body-form input, #body-form button').forEach(el => { el.disabled = !canEdit() || saving; });
  }
  function fillBodyForm() {
    const value = getState().bodyWeights[$('body-date').value];
    $('body-weight').value = value === undefined ? '' : String(value).replace('.', ',');
    $('body-edit-note').textContent = value === undefined ? 'Je kunt een eerdere datum kiezen om een weging toe te voegen.' : 'Er staat al een weging op deze datum. Bewaren past die meting aan.';
    $('delete-body').hidden = value === undefined;
    $('body-error').hidden = true;
  }
  function renderTraining() {
    const state = getState();
    if (selectedGroup && !state.groups.some(group => group.id === selectedGroup)) selectedGroup = '';
    const all = node('option', 'Alle onderdelen'); all.value = '';
    const options = state.groups.map(group => { const option = node('option', `${group.name}${group.archived ? ' (verborgen)' : ''}`); option.value = group.id; return option; });
    $('training-group').replaceChildren(all, ...options); $('training-group').value = selectedGroup;
    const summary = trainingSummary(state, localDate(), selectedGroup || null);
    $('training-summary').replaceChildren(...[[summary.last28Days, 'afgelopen 28 dagen'], [summary.total, 'totaal opgeslagen']].map(([value, label]) => { const card = node('div', '', 'summary-tile'); card.append(node('strong', number(value)), node('span', label)); return card; }));
    renderBarChart($('training-chart'), weeklyTrainingCounts(state, localDate(), 8, selectedGroup || null), { label: 'Opgeslagen trainingen per week', unit: 'trainingen' });
    const comparison = selectedGroup ? latestWorkoutComparison(state, selectedGroup, localDate()) : null;
    if (!selectedGroup) { $('training-comparison').replaceChildren(node('p', 'Kies een onderdeel om je laatste training met de vorige te vergelijken.', 'settings-copy')); return; }
    if (!comparison) { $('training-comparison').replaceChildren(node('p', 'Nog geen training opgeslagen voor dit onderdeel.', 'settings-copy')); return; }
    const heading = node('h3', `Laatste training · ${prettyDate(comparison.date)}`, 'small-heading');
    const note = node('p', comparison.previousDate ? `Verschil met ${prettyDate(comparison.previousDate)}.` : 'Na je volgende training zie je hier de verschillen.', 'chart-note');
    const rows = comparison.rows.map(item => {
      const row = node('div', '', 'comparison-row');
      row.append(node('strong', item.name), node('span', `${number(item.weight)} kg × ${item.reps} reps`));
      row.append(node('small', item.weightDelta === null ? 'Nog geen eerdere meting' : `${delta(item.weightDelta, 'kg')} · ${delta(item.repsDelta, 'reps')}`));
      return row;
    });
    $('training-comparison').replaceChildren(heading, note, ...rows);
  }
  function render() {
    document.querySelectorAll('[data-progress]').forEach(button => {
      const selected = button.dataset.progress === tab;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      $(`progress-${button.dataset.progress}`).hidden = !selected;
    });
    if (tab === 'exercise') renderExercise(); else if (tab === 'body') renderBody(); else renderTraining();
  }
  $('progress-button').onclick = () => {
    $('body-date').value = localDate(); fillBodyForm(); render(); $('progress-dialog').showModal();
  };
  document.querySelectorAll('[data-progress]').forEach(button => {
    button.onclick = () => { tab = button.dataset.progress; render(); };
    button.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const keys = ['exercise', 'body', 'training'], i = keys.indexOf(tab);
      tab = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1) : keys[(i + (event.key === 'ArrowRight' ? 1 : 2)) % keys.length];
      render(); $(`progress-tab-${tab}`).focus();
    };
  });
  $('exercise-series').onchange = event => { selectedExercise = event.target.value; renderExercise(); };
  $('chart-weight').onclick = () => { metric = 'weight'; renderExercise(); };
  $('chart-reps').onclick = () => { metric = 'reps'; renderExercise(); };
  $('training-group').onchange = event => { selectedGroup = event.target.value; renderTraining(); };
  $('body-date').onchange = fillBodyForm;
  $('body-form').onsubmit = async event => {
    event.preventDefault(); if (!canEdit() || saving) return;
    const raw = $('body-weight').value.trim(), day = $('body-date').value;
    if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(raw) || !day || day > localDate()) { $('body-error').textContent = 'Vul een geldig gewicht en een datum tot en met vandaag in.'; $('body-error').hidden = false; return; }
    saving = true; $('body-error').hidden = true;
    try {
      const next = setBodyWeight(getState(), day, Number(raw.replace(',', '.')));
      renderBody();
      if (await changeState(next)) { fillBodyForm(); toast('Weging bewaard.'); }
      else { $('body-error').textContent = saveError; $('body-error').hidden = false; }
    } catch (error) { $('body-error').textContent = error.message; $('body-error').hidden = false; }
    finally { saving = false; renderBody(); }
  };
  $('delete-body').onclick = async () => {
    if (!canEdit() || saving) return;
    const day = $('body-date').value;
    if (!await confirmAction('Weging verwijderen?', `De meting van ${prettyDate(day)} wordt verwijderd.`, 'Verwijderen')) return;
    saving = true; $('body-error').hidden = true;
    try {
      if (await changeState(deleteBodyWeight(getState(), day))) { fillBodyForm(); toast('Weging verwijderd.'); }
      else { $('body-error').textContent = saveError; $('body-error').hidden = false; }
    }
    catch (error) { $('body-error').textContent = error.message; $('body-error').hidden = false; }
    finally { saving = false; renderBody(); }
  };
  return { refresh() { if ($('progress-dialog').open) { render(); fillBodyForm(); } } };
}
