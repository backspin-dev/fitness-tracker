import { getExerciseSets, setExerciseSet, addExerciseSet, removeExerciseSet } from './data.js';

export function parseSetValue(value, field) {
  const raw = value.trim();
  const pattern = field === 'reps' ? /^\d{1,3}$/ : /^\d{1,4}(?:[.,]\d{1,2})?$/;
  if (!pattern.test(raw)) return null;
  const number = Number(raw.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 && number <= (field === 'reps' ? 999 : 2000) ? number : null;
}

const numberText = value => String(value).replace('.', ',');

// Alleen toevoegen/verwijderen vernieuwt de setrijen. Typen bewaart focus en selectie.
export function createExerciseSets(exercise, {
  getExercise, onChange, confirmRemove, toast, canEdit = () => true, document = globalThis.document,
}) {
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const section = make('div', undefined, 'exercise-sets');
  const heading = make('div', undefined, 'set-heading');
  heading.setAttribute('aria-hidden', 'true');
  heading.append(make('span', 'SET'), make('span', 'KG'), make('span', 'REPS'), make('span', ''));
  const rows = make('div', undefined, 'set-rows');
  const add = make('button', '+ Set toevoegen', 'add-set');
  add.type = 'button';
  section.append(heading, rows, add);

  function metric(index, field, initial) {
    const stepper = make('div', undefined, 'stepper');
    const minus = make('button', '−'), plus = make('button', '+');
    minus.type = plus.type = 'button';
    const label = `${field === 'weight' ? 'Gewicht in kg' : 'Reps'}, set ${index + 1}, ${exercise.name}`;
    minus.setAttribute('aria-label', `${label} verlagen`);
    plus.setAttribute('aria-label', `${label} verhogen`);
    const input = make('input');
    input.type = 'text'; input.value = numberText(initial);
    input.id = `value-${exercise.id}-${index}-${field}`;
    input.inputMode = field === 'weight' ? 'decimal' : 'numeric';
    input.autocomplete = 'off'; input.maxLength = field === 'weight' ? 7 : 3;
    input.setAttribute('aria-label', label);
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const value = parseSetValue(input.value, field);
      input.setAttribute('aria-invalid', String(value === null));
      const current = getExercise();
      if (canEdit() && current && value !== null && getExerciseSets(current)[index]?.[field] !== value) {
        onChange(setExerciseSet(current, index, { [field]: value }));
      }
    });
    input.addEventListener('blur', () => {
      const saved = getExercise();
      if (!saved) return;
      const value = getExerciseSets(saved)[index]?.[field];
      if (value === undefined) return;
      if (parseSetValue(input.value, field) === null) toast(field === 'weight' ? 'Vul een gewicht van 0 tot 2.000 kg in.' : 'Vul een heel aantal reps van 0 tot 999 in.');
      input.value = numberText(value); input.removeAttribute('aria-invalid');
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
    const step = direction => {
      const current = getExercise();
      if (!canEdit() || !current) return;
      const old = getExerciseSets(current)[index]?.[field];
      if (old === undefined) return;
      const value = Math.max(0, Math.min(field === 'weight' ? 2000 : 999, Math.round((old + direction * (field === 'weight' ? 0.5 : 1)) * 100) / 100));
      onChange(setExerciseSet(current, index, { [field]: value }));
      input.value = numberText(getExerciseSets(getExercise())[index][field]);
      input.removeAttribute('aria-invalid');
    };
    minus.addEventListener('click', () => step(-1)); plus.addEventListener('click', () => step(1));
    stepper.append(minus, input, plus);
    return stepper;
  }

  function renderRows() {
    const current = getExercise() ?? exercise;
    const values = getExerciseSets(current);
    rows.replaceChildren(...values.map((set, index) => {
      const row = make('div', undefined, 'set-row');
      row.setAttribute('role', 'group'); row.setAttribute('aria-label', `Set ${index + 1} van ${current.name}`);
      const remove = make('button', '×', 'remove-set');
      remove.type = 'button'; remove.disabled = values.length === 1 || !canEdit();
      remove.setAttribute('aria-label', `Set ${index + 1} van ${current.name} verwijderen`);
      remove.title = values.length === 1 ? 'Er blijft altijd één set staan' : 'Set verwijderen';
      remove.addEventListener('click', async () => {
        if (!canEdit() || getExercise()?.sets <= 1) return;
        if (!await confirmRemove(index + 1, current.name)) return;
        const latest = getExercise();
        if (!canEdit() || !latest || latest.sets <= 1 || index >= latest.sets) return;
        onChange(removeExerciseSet(latest, index)); renderRows();
        add.focus({ preventScroll: true });
      });
      row.append(make('span', String(index + 1), 'set-number'), metric(index, 'weight', set.weight), metric(index, 'reps', set.reps), remove);
      if (!canEdit()) row.querySelectorAll('input,button').forEach(node => { node.disabled = true; });
      return row;
    }));
    add.disabled = !canEdit() || values.length >= 99;
    add.setAttribute('aria-label', `Set toevoegen aan ${current.name}`);
  }
  add.addEventListener('click', () => {
    const current = getExercise();
    if (!canEdit() || !current || current.sets >= 99) return;
    onChange(addExerciseSet(current)); renderRows();
    // De knop blijft bestaan en behoudt zijn focus. De nieuwe set kopieert de vorige.
  });
  renderRows();
  return section;
}

export function dropIndexAtY(cards, clientY) {
  return cards.filter(card => clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2).length;
}

// Pointer Events werken op touch en desktop. Alleen het handvat begint een drag.
export function setupExerciseOrder({ list, canEdit, onMove, announce, window = globalThis.window }) {
  let active = null, frame = null, ignoreClick = null;
  const cards = () => [...list.children].filter(card => card.dataset.exerciseId);
  const clearMarkers = () => cards().forEach(card => card.classList.remove('drop-before', 'drop-after'));
  function preview() {
    if (!active?.dragging) return;
    const rest = cards().filter(card => card !== active.card);
    active.targetIndex = dropIndexAtY(rest, active.y);
    active.card.style.transform = `translateY(${active.y - active.startY + window.scrollY - active.scrollY}px)`;
    clearMarkers();
    if (active.targetIndex < rest.length) rest[active.targetIndex].classList.add('drop-before');
    else rest.at(-1)?.classList.add('drop-after');
  }
  function scroll() {
    frame = null;
    if (!active?.dragging) return;
    const edge = 75;
    const delta = active.y < edge ? -Math.ceil((edge - active.y) / 6) : active.y > window.innerHeight - edge ? Math.ceil((active.y - window.innerHeight + edge) / 6) : 0;
    if (delta) { window.scrollBy(0, Math.max(-14, Math.min(14, delta))); preview(); }
    frame = window.requestAnimationFrame(scroll);
  }
  function finish(commit) {
    if (!active) return;
    const ended = active; active = null;
    if (ended.dragging) ignoreClick = ended.id;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null; clearMarkers();
    ended.card.classList.remove('is-dragging'); ended.card.style.transform = '';
    ended.handle.setAttribute('aria-pressed', 'false');
    try { ended.handle.releasePointerCapture(ended.pointerId); } catch {}
    if (commit && ended.dragging && ended.targetIndex !== ended.fromIndex && canEdit()) {
      onMove(ended.id, ended.targetIndex);
      announce(`${ended.name} verplaatst naar plek ${ended.targetIndex + 1}.`);
      list.querySelector(`[data-drag-exercise="${ended.id}"]`)?.focus({ preventScroll: true });
    }
  }
  list.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-drag-exercise]');
    if (!handle || !canEdit() || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    const card = handle.closest('[data-exercise-id]');
    if (!card || !list.contains(card)) return;
    event.preventDefault(); finish(false); ignoreClick = null;
    active = { handle, card, id: card.dataset.exerciseId, name: card.dataset.exerciseName, fromIndex: cards().indexOf(card), targetIndex: cards().indexOf(card), startY: event.clientY, y: event.clientY, scrollY: window.scrollY, pointerId: event.pointerId, dragging: false };
    try { handle.setPointerCapture(event.pointerId); } catch {}
  });
  list.addEventListener('pointermove', event => {
    if (!active || active.pointerId !== event.pointerId) return;
    active.y = event.clientY;
    if (!active.dragging && Math.abs(active.y - active.startY) >= 6) {
      active.dragging = true; active.card.classList.add('is-dragging');
      active.handle.setAttribute('aria-pressed', 'true');
      frame = window.requestAnimationFrame(scroll);
    }
    if (active.dragging) { event.preventDefault(); preview(); }
  });
  list.addEventListener('pointerup', event => { if (active?.pointerId === event.pointerId) finish(true); });
  list.addEventListener('pointercancel', event => { if (active?.pointerId === event.pointerId) finish(false); });
  list.addEventListener('lostpointercapture', event => { if (active?.pointerId === event.pointerId) finish(false); });
  list.addEventListener('click', event => {
    if (ignoreClick && event.detail !== 0 && event.target.closest('[data-drag-exercise]')?.dataset.dragExercise === ignoreClick) {
      ignoreClick = null; event.preventDefault(); event.stopPropagation();
    }
  }, true);
  list.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) { event.preventDefault(); finish(false); }
  });
  return { cancel: () => finish(false) };
}
