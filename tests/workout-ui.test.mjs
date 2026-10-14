import test from 'node:test';
import assert from 'node:assert/strict';
import { createExerciseSets, setupExerciseOrder, parseSetValue, exerciseDragViewport } from '../workout-ui.js';
import { getExerciseSets, setExerciseSets, reorderWorkout } from '../data.js';

function environment() {
  const document = { activeElement: null, createElement: tag => new Element(tag), querySelector: () => null };
  class Element {
    constructor(tag) {
      this.ownerDocument = document; this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.listeners = new Map(); this.attributes = new Map(); this.dataset = {}; this.style = {};
      this.disabled = false; this.className = ''; this.value = '';
      this.classList = {
        add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
        contains: name => this.className.split(' ').includes(name),
      };
    }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
    insertBefore(node, reference) {
      node.remove();
      const index = reference === null ? this.children.length : this.children.indexOf(reference);
      assert.ok(index >= 0); node.parentElement = this; this.children.splice(index, 0, node);
    }
    remove() {
      if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
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
    getBoundingClientRect() { return typeof this.rect === 'function' ? this.rect() : this.rect ?? { top: 0, bottom: 0, height: 0 }; }
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

function orderFixture({ editable = true, rerender = false, heights = [90, 90, 90, 90], compact = 90,
  initialScroll = 0, listTop = 0, visualViewport, footerTop, animate = false } = {}) {
  const { document } = environment(), list = document.createElement('div');
  let workout = heights.map((height, index) => ({ id: String.fromCharCode(97 + index), name: String.fromCharCode(65 + index),
    weight: 10, reps: 8, sets: 1, ...(index === 1 ? { sets: 2, setValues: [null, { weight: 15, reps: 6 }] } : {}) }));
  const handles = [], cards = [], inputs = [], moves = [], notices = [], callbacks = new Map(), animations = [];
  let nextFrame = 0, frameTime = 0;
  const windowListeners = new Map();
  const window = { scrollY: initialScroll, innerHeight: 500, innerWidth: 390, visualViewport,
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    requestAnimationFrame: callback => { callbacks.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => callbacks.delete(id),
    scrollBy: (x, y) => { window.scrollY = Math.max(0, window.scrollY + y); },
  };
  const flowHeight = node => node.dataset.exerciseId ? (list.classList.contains('is-reordering') ? compact : node.expandedHeight) : Number.parseFloat(node.style.height);
  const flow = () => list.children.filter(node => node.style.position !== 'fixed');
  const flowTop = node => listTop + (Number.parseFloat(list.style.paddingTop) || 0) + flow().slice(0, flow().indexOf(node)).reduce((sum, previous) => sum + flowHeight(previous) + 10, 0);
  list.rect = () => ({ top: listTop - window.scrollY, left: 20, width: 350,
    height: Math.max(Number.parseFloat(list.style.minHeight) || 0, (Number.parseFloat(list.style.paddingTop) || 0) + flow().reduce((sum, node) => sum + flowHeight(node) + 10, 0)) });
  const originalCreate = document.createElement;
  document.createElement = tag => {
    const node = originalCreate(tag);
    node.rect = () => {
      const height = flowHeight(node), top = flowTop(node) - window.scrollY;
      return { top, bottom: top + height, height, left: 20, width: 350 };
    };
    return node;
  };
  if (footerTop !== undefined) document.querySelector = selector => selector === '.status-footer'
    ? { getBoundingClientRect: () => ({ top: footerTop, bottom: 500, height: 500 - footerTop }) } : null;
  function renderCards() {
    list.replaceChildren(); handles.length = cards.length = inputs.length = 0;
    for (const exercise of workout) {
      const card = document.createElement('article'); card.dataset.exerciseId = exercise.id; card.dataset.exerciseName = exercise.name;
      card.expandedHeight = heights[exercise.id.charCodeAt(0) - 97];
      card.rect = () => {
        const height = list.classList.contains('is-reordering') ? compact : card.expandedHeight;
        const top = card.style.position === 'fixed' ? Number.parseFloat(card.style.top) : flowTop(card) - window.scrollY;
        return { top, bottom: top + height, height, left: 20, width: 350 };
      };
      if (animate) card.animate = (frames, options) => {
        const animation = { card, frames, options, cancelled: false, cancel() { this.cancelled = true; } };
        animations.push(animation); return animation;
      };
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
  const tick = (count = 1) => {
    for (let n = 0; n < count; n++) {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id); callback(frameTime += 16.7);
    }
  };
  return { ui, list, document, handles, cards, inputs, moves, notices, callbacks, window, fire, tick, animations,
    resize: () => windowListeners.get('resize')?.(), workout: () => workout };
}

test('touch and mouse dragging start only from the handle and save the final order once', async () => {
  const f = orderFixture();
  assert.equal((await f.fire('pointerdown', f.inputs[0], 40)).defaultPrevented, false);
  await f.fire('pointermove', f.inputs[0], 270); await f.fire('pointerup', f.inputs[0], 270);
  assert.equal(f.moves.length, 0);
  await f.fire('pointerdown', f.handles[0], 40, { pointerType: 'touch' });
  await f.fire('pointermove', f.handles[0], 270, { pointerType: 'touch' });
  assert.equal(f.moves.length, 0); assert.equal(f.cards[0].classList.contains('is-dragging'), true);
  assert.equal(f.list.children.indexOf(f.list.children.find(node => node.className === 'exercise-order-placeholder')), 3);
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
  const f = orderFixture({ heights: Array(10).fill(300), compact: 90 }); await f.fire('pointerdown', f.inputs[0], 40);
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

test('compact dragging keeps a lower tall-card header anchored when scrolling cannot go above zero', async () => {
  const f = orderFixture({ heights: [300, 650, 450, 200], compact: 70, listTop: 220 });
  f.window.innerHeight = 844;
  const original = structuredClone(f.workout()), source = f.cards[1], originalTop = source.getBoundingClientRect().top;
  await f.fire('pointerdown', f.handles[1], originalTop + 20);
  await f.fire('pointermove', f.handles[1], originalTop + 26);
  const placeholder = f.list.children.find(node => node.className === 'exercise-order-placeholder');
  assert.equal(placeholder.getBoundingClientRect().top, originalTop);
  assert.equal(f.window.scrollY, 0);
  assert.ok(Number.parseFloat(f.list.style.paddingTop) > 0);
  assert.equal(source.captured, undefined); assert.equal(f.handles[1].captured, 7);
  assert.deepEqual(f.workout(), original); assert.equal(f.moves.length, 0);
  await f.fire('pointerup', f.handles[1], originalTop + 26);
  assert.equal(f.moves.length, 0); assert.equal(f.list.style.paddingTop, '');
  assert.deepEqual(f.workout(), original);
});

test('starting far down a tall workout keeps the selected header visible and cancel restores the exact scroll and nodes', async () => {
  const f = orderFixture({ heights: Array(8).fill(400), compact: 70, initialScroll: 2500, listTop: 220 });
  const originalNodes = [...f.list.children], original = structuredClone(f.workout());
  const handle = f.handles[6], top = f.cards[6].getBoundingClientRect().top;
  await f.fire('pointerdown', handle, top + 20); await f.fire('pointermove', handle, top + 26);
  const placeholder = f.list.children.find(node => node.className === 'exercise-order-placeholder');
  assert.equal(placeholder.getBoundingClientRect().top, top);
  assert.ok(f.window.scrollY < 2500); assert.equal(handle.captured, 7);
  await f.fire('pointermove', handle, 80);
  f.ui.cancel();
  assert.equal(f.window.scrollY, 2500); assert.deepEqual(f.list.children, originalNodes);
  assert.deepEqual(f.workout(), original); assert.equal(f.moves.length, 0);
  assert.equal(f.list.style.minHeight, ''); assert.equal(f.list.style.overflowAnchor, '');
  assert.equal(f.list.classList.contains('is-reordering'), false);
});

test('compact neighbours shift immediately, support reversing direction and commit only the final drop', async () => {
  const f = orderFixture({ heights: [350, 650, 150, 450], compact: 70, animate: true, rerender: true });
  const original = structuredClone(f.workout()), handle = f.handles[0], source = f.cards[0], next = f.cards[1];
  await f.fire('pointerdown', handle, 30); await f.fire('pointermove', handle, 130);
  assert.equal(next.getBoundingClientRect().top, 0);
  assert.equal(handle.parentElement, source); assert.equal(source.parentElement, f.list);
  assert.equal(handle.captured, 7); assert.ok(f.animations.length > 0);
  assert.deepEqual(f.workout(), original);
  await f.fire('pointermove', handle, 210); await f.fire('pointermove', handle, 320);
  const placeholder = f.list.children.find(node => node.className === 'exercise-order-placeholder');
  assert.equal(f.list.children.at(-1), placeholder);
  await f.fire('pointermove', handle, 110);
  assert.equal(f.moves.length, 0);
  await f.fire('pointerup', handle, 110);
  assert.deepEqual(f.moves, [['a', 1]]);
  assert.deepEqual(f.workout(), reorderWorkout(original, 'a', 1));
  assert.equal(f.document.activeElement.dataset.dragExercise, 'a');
  assert.ok(f.animations.every(animation => animation.cancelled));
  assert.equal(f.callbacks.size, 0);
});

test('a stationary finger scrolls above the footer using the visual viewport, and stops at the real compact rows', async () => {
  const f = orderFixture({ heights: Array(10).fill(300), compact: 70,
    visualViewport: { offsetTop: 35, height: 405 }, footerTop: 420 });
  await f.fire('pointerdown', f.handles[0], 30); await f.fire('pointermove', f.handles[0], 380);
  f.tick(2); const afterTwo = f.window.scrollY;
  assert.ok(afterTwo > 0);
  f.tick(80);
  assert.ok(f.window.scrollY > afterTwo);
  assert.ok(f.window.scrollY <= 394, 'the 3,100px height lock must not create an empty scroll area');
  const settled = f.window.scrollY; f.tick(20); assert.equal(f.window.scrollY, settled);
  assert.equal(f.moves.length, 0);
  f.ui.cancel(); assert.equal(f.window.scrollY, 0); assert.equal(f.callbacks.size, 0);
});

test('visible drag bounds ignore a footer outside the visual viewport and respect a footer covering its edge', () => {
  const window = { innerHeight: 900, visualViewport: { offsetTop: 40, height: 420 } };
  assert.deepEqual(exerciseDragViewport(window, { getBoundingClientRect: () => ({ top: 850, bottom: 900, height: 50 }) }),
    { top: 40, bottom: 460, edge: 92.4 });
  assert.deepEqual(exerciseDragViewport(window, { getBoundingClientRect: () => ({ top: 410, bottom: 900, height: 490 }) }),
    { top: 40, bottom: 410, edge: 81.4 });
});

test('a drag upward scrolls continuously, while read-only pointer handles cannot start a drag', async () => {
  const f = orderFixture({ heights: Array(10).fill(300), compact: 70, initialScroll: 1000 });
  const handle = f.handles[4], top = f.cards[4].getBoundingClientRect().top;
  await f.fire('pointerdown', handle, top + 20); await f.fire('pointermove', handle, 35);
  const start = f.window.scrollY; f.tick(3);
  assert.ok(f.window.scrollY < start); f.ui.cancel(); assert.equal(f.window.scrollY, 1000);
  const read = orderFixture({ editable: false });
  await read.fire('pointerdown', read.handles[0], 40); await read.fire('pointermove', read.handles[0], 400);
  assert.equal(read.callbacks.size, 0); assert.equal(read.moves.length, 0);
  assert.equal(read.list.classList.contains('is-reordering'), false);
});

test('browser toolbar height changes preserve dragging, while an orientation width change cancels safely', async () => {
  const f = orderFixture({ heights: [350, 650, 150, 450], compact: 70 });
  const original = structuredClone(f.workout());
  await f.fire('pointerdown', f.handles[0], 30); await f.fire('pointermove', f.handles[0], 130);
  f.window.innerHeight = 450; f.resize();
  assert.equal(f.list.classList.contains('is-reordering'), true); assert.equal(f.callbacks.size, 1);
  f.window.innerWidth = 844; f.resize();
  assert.equal(f.list.classList.contains('is-reordering'), false); assert.equal(f.callbacks.size, 0);
  assert.equal(f.moves.length, 0); assert.deepEqual(f.workout(), original);
});
