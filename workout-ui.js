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
  return cards.filter(card => {
    const rect = card.getBoundingClientRect();
    return clientY > rect.top + rect.height / 2;
  }).length;
}

// Gebruik het werkelijk zichtbare scherm; de vaste bewaarregel is geen scrollrand.
export function exerciseDragViewport(window, footer) {
  const top = Math.max(0, window.visualViewport?.offsetTop ?? 0);
  let bottom = top + (window.visualViewport?.height ?? window.innerHeight);
  const rect = footer?.getBoundingClientRect();
  if (rect?.height > 0 && rect.bottom > top && rect.top > top && rect.top < bottom) bottom = rect.top;
  return { top, bottom, edge: Math.min(110, Math.max(64, (bottom - top) * 0.22)) };
}

const saveStyles = (node, names) => Object.fromEntries(names.map(name => [name, node.style[name] ?? '']));

// Bestaande kaarten blijven in de DOM: geen dubbele invoer-ID's of gekopieerde spelers.
// Alleen een lege placeholder verhuist. Het model verandert uitsluitend bij loslaten.
export function setupExerciseOrder({ list, canEdit, onMove, announce, window = globalThis.window,
  document = list.ownerDocument ?? globalThis.document }) {
  let active = null, frame = null, ignoreClick = null;
  const cards = () => [...list.children].filter(card => card.dataset.exerciseId);
  const viewport = () => exerciseDragViewport(window, document.querySelector('.status-footer'));
  const cancelAnimations = drag => { drag.animations.forEach(animation => animation.cancel()); drag.animations = []; };

  function measureLayout() {
    if (!active) return;
    active.layout = new Map(cards().filter(card => card !== active.card).map(card => {
      const rect = card.getBoundingClientRect();
      return [card, { top: rect.top + window.scrollY, height: rect.height }];
    }));
    const rect = active.placeholder.getBoundingClientRect();
    const values = [...active.layout.values(), { top: rect.top + window.scrollY, height: rect.height }];
    active.compactTop = Math.min(...values.map(value => value.top));
    active.compactBottom = Math.max(...values.map(value => value.top + value.height));
  }

  function positionPlaceholder(index) {
    if (!active || index === active.targetIndex) return;
    const rest = cards().filter(card => card !== active.card);
    const before = new Map(rest.map(card => [card, card.getBoundingClientRect().top]));
    cancelAnimations(active);
    list.insertBefore(active.placeholder, rest[index] ?? null);
    active.targetIndex = index;
    measureLayout();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (const card of rest) {
      const distance = before.get(card) - (active.layout.get(card).top - window.scrollY);
      if (Math.abs(distance) > 1 && card.animate) {
        active.animations.push(card.animate([
          { transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' },
        ], { duration: 160, easing: 'ease-out' }));
      }
    }
  }

  function preview() {
    if (!active?.dragging) return;
    const bounds = viewport();
    const y = Math.max(bounds.top, Math.min(bounds.bottom, active.y));
    const index = [...active.layout.values()].filter(rect => y > rect.top - window.scrollY + rect.height / 2).length;
    positionPlaceholder(index);
    const maxTop = Math.max(bounds.top + 4, bounds.bottom - active.height - 4);
    active.card.style.top = `${Math.max(bounds.top + 4, Math.min(maxTop, active.y - active.grabOffset))}px`;
  }

  function scroll(time) {
    frame = null;
    if (!active?.dragging) return;
    const bounds = viewport();
    const now = Number.isFinite(time) ? time : (active.frameTime ?? 0) + 16.7;
    const elapsed = active.frameTime === undefined ? 1 : Math.min(2, Math.max(0.25, (now - active.frameTime) / 16.7));
    active.frameTime = now;
    const fromTop = active.y - bounds.top, fromBottom = bounds.bottom - active.y;
    const direction = fromTop < bounds.edge ? -1 : fromBottom < bounds.edge ? 1 : 0;
    if (direction) {
      const distance = direction < 0 ? fromTop : fromBottom;
      const intensity = Math.max(0, Math.min(1, (bounds.edge - distance) / bounds.edge));
      const speed = (2 + 16 * intensity) * elapsed;
      // De oorspronkelijke lijsthoogte voorkomt verspringen, maar is geen sleepgebied.
      const minScroll = Math.max(0, active.compactTop - bounds.top - 24);
      const maxScroll = Math.max(0, active.compactBottom - bounds.bottom + 24);
      const available = direction < 0 ? Math.max(0, window.scrollY - minScroll) : Math.max(0, maxScroll - window.scrollY);
      if (available > 0) window.scrollBy(0, direction * Math.min(speed, available));
    }
    preview();
    frame = window.requestAnimationFrame(scroll);
  }

  function startDrag() {
    const drag = active, rect = drag.card.getBoundingClientRect();
    drag.dragging = true;
    drag.cardStyles = saveStyles(drag.card, ['position', 'top', 'left', 'width', 'transform']);
    drag.listStyles = saveStyles(list, ['minHeight', 'overflowAnchor', 'paddingTop']);
    list.style.minHeight = `${Math.ceil(list.getBoundingClientRect().height)}px`;
    list.style.overflowAnchor = 'none';
    list.classList.add('is-reordering');
    // Alle oefenkoppen zijn tijdens het slepen compact; sets en open video's blijven intact.
    const compact = drag.card.getBoundingClientRect();
    drag.height = compact.height;
    drag.grabOffset = Math.max(0, Math.min(compact.height, drag.startY - rect.top));
    drag.placeholder = document.createElement('div');
    drag.placeholder.className = 'exercise-order-placeholder';
    drag.placeholder.setAttribute('aria-hidden', 'true');
    drag.placeholder.style.height = `${compact.height}px`;
    list.insertBefore(drag.placeholder, drag.card);
    drag.card.classList.add('is-dragging');
    Object.assign(drag.card.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, transform: 'none' });
    drag.handle.setAttribute('aria-pressed', 'true');
    // Behoud de geselecteerde kop bij de vinger wanneer eerdere lange kaarten inklappen.
    const padding = Number.parseFloat(window.getComputedStyle?.(list).paddingTop ?? list.style.paddingTop) || 0;
    window.scrollBy(0, drag.placeholder.getBoundingClientRect().top - rect.top);
    // Bovenaan kan de pagina niet verder terugscrollen. Houd dan dezelfde kop
    // met tijdelijke ruimte op zijn plek, zodat 6 px bewegen geen sprong geeft.
    const remaining = rect.top - drag.placeholder.getBoundingClientRect().top;
    if (remaining > 0.5) list.style.paddingTop = `${padding + remaining}px`;
    measureLayout();
    frame = window.requestAnimationFrame(scroll);
  }

  function finish(commit) {
    if (!active) return;
    const ended = active;
    const shouldCommit = commit && ended.dragging && canEdit();
    const desiredTop = ended.dragging ? ended.card.getBoundingClientRect().top : null;
    active = null;
    if (ended.dragging) ignoreClick = ended.id;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    cancelAnimations(ended);
    if (ended.dragging) {
      ended.placeholder.remove();
      list.classList.remove('is-reordering');
      Object.assign(list.style, ended.listStyles);
      ended.card.classList.remove('is-dragging');
      Object.assign(ended.card.style, ended.cardStyles);
    }
    ended.handle.setAttribute('aria-pressed', 'false');
    try { ended.handle.releasePointerCapture(ended.pointerId); } catch {}
    if (shouldCommit && ended.targetIndex !== ended.fromIndex) {
      onMove(ended.id, ended.targetIndex);
      announce(`${ended.name} verplaatst naar plek ${ended.targetIndex + 1}.`);
    }
    if (ended.dragging) {
      const handle = list.querySelector(`[data-drag-exercise="${ended.id}"]`);
      if (shouldCommit && handle) {
        const top = handle.closest('[data-exercise-id]').getBoundingClientRect().top;
        window.scrollBy(0, top - desiredTop);
        handle.focus({ preventScroll: true });
      } else window.scrollBy(0, ended.scrollY - window.scrollY);
    }
  }
  list.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-drag-exercise]');
    if (!handle || !canEdit() || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    const card = handle.closest('[data-exercise-id]');
    if (!card || !list.contains(card)) return;
    event.preventDefault(); finish(false); ignoreClick = null;
    handle.focus({ preventScroll: true });
    active = { handle, card, id: card.dataset.exerciseId, name: card.dataset.exerciseName,
      fromIndex: cards().indexOf(card), targetIndex: cards().indexOf(card), startY: event.clientY, y: event.clientY,
      scrollY: window.scrollY, width: window.innerWidth, pointerId: event.pointerId, dragging: false, animations: [] };
    try { handle.setPointerCapture(event.pointerId); } catch {}
  });
  list.addEventListener('pointermove', event => {
    if (!active || active.pointerId !== event.pointerId) return;
    active.y = event.clientY;
    if (!active.dragging && Math.abs(active.y - active.startY) >= 6) startDrag();
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
    if (event.key === 'Escape' && active) { event.preventDefault(); finish(false); return; }
    if (active || !['ArrowUp', 'ArrowDown'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !canEdit()) return;
    const handle = event.target.closest('[data-drag-exercise]');
    const card = handle?.closest('[data-exercise-id]');
    if (!handle || !card || !list.contains(card)) return;
    const currentCards = cards(), fromIndex = currentCards.indexOf(card);
    if (fromIndex < 0) return;
    event.preventDefault();
    const targetIndex = fromIndex + (event.key === 'ArrowUp' ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= currentCards.length) return;
    const id = card.dataset.exerciseId, name = card.dataset.exerciseName;
    onMove(id, targetIndex);
    announce(`${name} verplaatst naar plek ${targetIndex + 1}.`);
    list.querySelector(`[data-drag-exercise="${id}"]`)?.focus({ preventScroll: true });
  });
  // De iPhone-adresbalk mag tijdens scrollen van hoogte veranderen. Alleen een
  // andere breedte maakt de gemeten kaartindeling ongeldig.
  window.addEventListener?.('resize', () => { if (active && window.innerWidth !== active.width) finish(false); });
  return { cancel: () => finish(false) };
}
