import test from 'node:test';
import assert from 'node:assert/strict';
import { createExerciseSets, setupExerciseOrder, parseSetValue } from '../workout-ui.js';
import { getExerciseSets, setExerciseSets, reorderWorkout } from '../data.js';

function environment() {
  const document = { activeElement: null, createElement: tag => new Element(tag) };
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.listeners = new Map(); this.attributes = new Map(); this.dataset = {}; this.style = {};
      this.disabled = false; this.className = ''; this.value = '';
      this.classList = {
        add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
        contains: name => this.className.split(' ').includes(name),
      };
    }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children.forEach(node => { node.parentElement = null; }); this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    addEventListener(type, handler, capture = false) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ handler, capture });
    }
    async fire(type, props = {}) {
      const event = { target: this, defaultPrevented: false, stopped: false, ...props,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
      for (const { handler } of this.listeners.get(type) ?? []) await handler(event);
      return event;
    }
    matches(selector) {
      if (selector === 'input,button') return ['INPUT', 'BUTTON'].includes(this.tagName);
      if (selector === '[data-exercise-id]') return !!this.dataset.exerciseId;
      if (selector === '[data-drag-exercise]') return !!this.dataset.dragExercise;
      const match = /^\[data-drag-exercise="([^"]+)"\]$/.exec(selector);
      return match ? this.dataset.dragExercise === match[1] : false;
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    contains(child) { return this === child || this.children.some(node => node.contains(child)); }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    blur() { document.activeElement = null; void this.fire('blur'); }
    setPointerCapture(id) { this.captured = id; }
    releasePointerCapture(id) { if (this.captured === id) this.captured = null; }
    getBoundingClientRect() { return this.rect ?? { top: 0, height: 0 }; }
  }
  return { document };
}

function setFixture(values = [{ weight: 20, reps: 12 }, { weight: 25, reps: 9 }], editable = true) {
  const { document } = environment();
  let current = setExerciseSets({ id: 'squat', name: 'Squat' }, values), allowRemove = false;
  const changes = [], confirmations = [], notices = [];
  const ui = createExerciseSets(current, {
    document, canEdit: () => editable, getExercise: () => current,
    onChange: next => { changes.push(next); current = next; },
    confirmRemove: async (...args) => { confirmations.push(args); return allowRemove; },
    toast: message => notices.push(message),
  });
  return { ui, document, changes, confirmations, notices, current: () => current,
    allowRemove: () => { allowRemove = true; }, rows: () => ui.children[1].children,
    add: ui.children[2], input: (set, field) => ui.children[1].children[set].children[field === 'weight' ? 1 : 2].children[1] };
}

test('editing a set keeps every other set unchanged and preserves the focused input', async () => {
  const f = setFixture(), weight = f.input(1, 'weight'), reps = f.input(1, 'reps');
  weight.focus(); await weight.fire('focus'); weight.value = '27,5'; await weight.fire('input');
  assert.deepEqual(getExerciseSets(f.current()), [{ weight: 20, reps: 12 }, { weight: 27.5, reps: 9 }]);
  assert.equal(f.input(1, 'weight'), weight); assert.equal(f.document.activeElement, weight);
  reps.value = '8'; await reps.fire('input');
  assert.deepEqual(getExerciseSets(f.current()), [{ weight: 20, reps: 12 }, { weight: 27.5, reps: 8 }]);
  const first = f.input(0, 'weight'); first.value = '22'; await first.fire('input');
  assert.deepEqual(getExerciseSets(f.current()), [{ weight: 22, reps: 12 }, { weight: 27.5, reps: 8 }]);
  assert.equal(f.input(1, 'reps'), reps);
});

test('invalid values are not saved and blur restores the saved set value', async () => {
  const f = setFixture(), weight = f.input(0, 'weight');
  for (const value of ['', '-1', '2001', '20,123', 'abc']) {
    weight.value = value; await weight.fire('input'); assert.equal(weight.getAttribute('aria-invalid'), 'true');
  }
  assert.equal(f.changes.length, 0); await weight.fire('blur');
  assert.equal(weight.value, '20'); assert.equal(weight.getAttribute('aria-invalid'), null);
  assert.equal(f.notices.length, 1);
  assert.equal(parseSetValue('1,25', 'weight'), 1.25); assert.equal(parseSetValue('2.5', 'reps'), null);
});

test('adding copies the latest set, removing needs confirmation and always leaves a set', async () => {
  const f = setFixture();
  await f.add.fire('click');
  assert.deepEqual(getExerciseSets(f.current()), [{ weight: 20, reps: 12 }, { weight: 25, reps: 9 }, { weight: 25, reps: 9 }]);
  assert.equal(f.ui.children[2], f.add);
  await f.rows()[1].children[3].fire('click'); assert.equal(f.current().sets, 3);
  assert.deepEqual(f.confirmations[0], [2, 'Squat']);
  f.allowRemove(); await f.rows()[1].children[3].fire('click');
  assert.deepEqual(getExerciseSets(f.current()), [{ weight: 20, reps: 12 }, { weight: 25, reps: 9 }]);
  await f.rows()[1].children[3].fire('click');
  assert.equal(f.current().sets, 1); assert.equal(f.rows()[0].children[3].disabled, true);
  await f.rows()[0].children[3].fire('click'); assert.equal(f.current().sets, 1);
});

test('set controls respect limits and read-only mode', async () => {
  const f = setFixture([{ weight: 2000, reps: 0 }]);
  await f.rows()[0].children[1].children[2].fire('click');
  await f.rows()[0].children[2].children[0].fire('click');
  assert.deepEqual(getExerciseSets(f.current()), [{ weight: 2000, reps: 0 }]);
  const max = setFixture(Array.from({ length: 99 }, () => ({ weight: 5, reps: 5 })));
  assert.equal(max.add.disabled, true); await max.add.fire('click'); assert.equal(max.current().sets, 99);
  const read = setFixture(undefined, false);
  assert.ok(read.ui.querySelectorAll('input,button').every(node => node.disabled));
  read.input(0, 'weight').value = '30'; await read.input(0, 'weight').fire('input');
  await read.add.fire('click'); assert.equal(read.changes.length, 0);
});

function orderFixture({ editable = true, rerender = false } = {}) {
  const { document } = environment(), list = document.createElement('div');
  let workout = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase(), weight: 10, reps: 8, sets: 1 }));
  const handles = [], cards = [], inputs = [], moves = [], notices = [], callbacks = new Map();
  const window = { scrollY: 0, innerHeight: 500,
    requestAnimationFrame: callback => { const id = callbacks.size + 1; callbacks.set(id, callback); return id; },
    cancelAnimationFrame: id => callbacks.delete(id),
    scrollBy: (x, y) => { window.scrollY += y; },
  };
  function renderCards() {
    list.replaceChildren(); handles.length = cards.length = inputs.length = 0;
    for (const [index, exercise] of workout.entries()) {
      const card = document.createElement('article'); card.dataset.exerciseId = exercise.id; card.dataset.exerciseName = exercise.name;
      card.rect = { top: index * 100, height: 90 };
      const handle = document.createElement('button'); handle.dataset.dragExercise = exercise.id;
      const input = document.createElement('input'); card.append(handle, input); list.append(card);
      handles.push(handle); cards.push(card); inputs.push(input);
    }
  }
  renderCards();
  const ui = setupExerciseOrder({ list, window, canEdit: () => editable,
    onMove: (id, target) => { moves.push([id, target]); workout = reorderWorkout(workout, id, target); if (rerender) renderCards(); },
    announce: message => notices.push(message),
  });
  const fire = (type, target, y, props = {}) => list.fire(type, { target, pointerId: 7, clientY: y, button: 0, isPrimary: true, ...props });
  return { ui, list, document, handles, cards, inputs, moves, notices, callbacks, window, fire, workout: () => workout };
}

test('touch and mouse dragging start only from the handle and save the final order once', async () => {
  const f = orderFixture();
  assert.equal((await f.fire('pointerdown', f.inputs[0], 40)).defaultPrevented, false);
  await f.fire('pointermove', f.inputs[0], 270); await f.fire('pointerup', f.inputs[0], 270);
  assert.equal(f.moves.length, 0);
  await f.fire('pointerdown', f.handles[0], 40, { pointerType: 'touch' });
  await f.fire('pointermove', f.handles[0], 270, { pointerType: 'touch' });
  assert.equal(f.moves.length, 0); assert.equal(f.cards[0].classList.contains('is-dragging'), true);
  assert.equal(f.cards[3].classList.contains('drop-before'), true);
  await f.fire('pointerup', f.handles[0], 270);
  assert.deepEqual(f.moves, [['a', 2]]); assert.deepEqual(f.workout().map(x => x.id), ['b', 'c', 'a', 'd']);
  assert.equal(f.cards[0].style.transform, ''); assert.equal(f.cards[0].classList.contains('is-dragging'), false);
  assert.equal(f.notices.length, 1); assert.equal(f.callbacks.size, 0);
  const click = await f.list.fire('click', { target: f.handles[0], detail: 1 });
  assert.equal(click.defaultPrevented, true); assert.equal(click.stopped, true);
});

test('cancel, Escape, foreign pointers and small taps never reorder exercises', async () => {
  for (const end of ['pointercancel', 'lostpointercapture', 'Escape']) {
    const f = orderFixture(); await f.fire('pointerdown', f.handles[0], 40);
    await f.fire('pointermove', f.handles[0], 260);
    if (end === 'Escape') await f.list.fire('keydown', { key: 'Escape' }); else await f.fire(end, f.handles[0], 260);
    assert.equal(f.moves.length, 0); assert.equal(f.cards[0].style.transform, '');
  }
  const f = orderFixture(); await f.fire('pointerdown', f.handles[0], 40);
  await f.fire('pointermove', f.handles[0], 270, { pointerId: 8 }); await f.fire('pointerup', f.handles[0], 42);
  assert.equal(f.moves.length, 0);
});

test('a mobile drag near the edge scrolls, while ordinary input interaction never starts scrolling', async () => {
  const f = orderFixture(); await f.fire('pointerdown', f.inputs[0], 40);
  await f.fire('pointermove', f.inputs[0], 490); assert.equal(f.callbacks.size, 0);
  await f.fire('pointerdown', f.handles[0], 40); await f.fire('pointermove', f.handles[0], 490);
  const [id, callback] = f.callbacks.entries().next().value; f.callbacks.delete(id); callback();
  assert.ok(f.window.scrollY > 0); f.ui.cancel(); assert.equal(f.callbacks.size, 0);
  assert.equal(f.moves.length, 0);
});

test('arrow keys on the handle move one exercise and restore focus to its new handle after rendering', async () => {
  const f = orderFixture({ rerender: true }), originalHandle = f.handles[1];
  originalHandle.focus();
  const down = await f.list.fire('keydown', { target: originalHandle, key: 'ArrowDown' });
  assert.equal(down.defaultPrevented, true);
  assert.deepEqual(f.moves, [['b', 2]]);
  assert.deepEqual(f.workout().map(item => item.id), ['a', 'c', 'b', 'd']);
  assert.equal(f.document.activeElement, f.handles[2]);
  assert.notEqual(f.document.activeElement, originalHandle);
  assert.deepEqual(f.notices, ['B verplaatst naar plek 3.']);
  await f.list.fire('keydown', { target: f.handles[2], key: 'ArrowUp' });
  assert.deepEqual(f.workout().map(item => item.id), ['a', 'b', 'c', 'd']);
  assert.equal(f.document.activeElement, f.handles[1]);
  assert.deepEqual(f.moves, [['b', 2], ['b', 1]]);
});

test('keyboard ordering respects boundaries and leaves inputs, modified arrows and read-only controls alone', async () => {
  const f = orderFixture();
  for (const [target, key] of [[f.handles[0], 'ArrowUp'], [f.handles[3], 'ArrowDown']]) {
    assert.equal((await f.list.fire('keydown', { target, key })).defaultPrevented, true);
  }
  for (const props of [
    { target: f.inputs[1], key: 'ArrowDown' },
    { target: f.handles[1], key: 'ArrowLeft' },
    ...['altKey', 'ctrlKey', 'metaKey', 'shiftKey'].map(modifier => ({ target: f.handles[1], key: 'ArrowDown', [modifier]: true })),
  ]) assert.equal((await f.list.fire('keydown', props)).defaultPrevented, false);
  assert.equal(f.moves.length, 0); assert.equal(f.notices.length, 0);
  const read = orderFixture({ editable: false });
  assert.equal((await read.list.fire('keydown', { target: read.handles[1], key: 'ArrowDown' })).defaultPrevented, false);
  assert.equal(read.moves.length, 0);
});

test('arrow keys cannot commit or interfere with an active pointer drag', async () => {
  const f = orderFixture();
  await f.fire('pointerdown', f.handles[0], 40); await f.fire('pointermove', f.handles[0], 270);
  assert.equal((await f.list.fire('keydown', { target: f.handles[0], key: 'ArrowDown' })).defaultPrevented, false);
  assert.equal(f.moves.length, 0); assert.equal(f.cards[0].classList.contains('is-dragging'), true);
  await f.list.fire('keydown', { target: f.handles[0], key: 'Escape' });
  assert.equal(f.moves.length, 0); assert.equal(f.cards[0].classList.contains('is-dragging'), false);
});
