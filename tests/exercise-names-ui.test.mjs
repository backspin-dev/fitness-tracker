import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingExerciseSuggestions, setupExerciseNames } from '../exercise-names-ui.js';

function fixture(loadSuggestions = async () => []) {
  class Element {
    constructor(tag) {
      this.tag = tag; this.children = []; this.value = ''; this.attributes = new Map(); this.listeners = new Map();
      this.hidden = false; this.scrollTop = 0; this.clientTop = 0; this.heightLimit = 180; this.style = {};
    }
    get clientHeight() { return Math.min(this.heightLimit, Number.parseFloat(this.style.maxHeight) || this.heightLimit); }
    set clientHeight(value) { this.heightLimit = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
    async fire(type, props = {}) {
      if (type === 'focus') document.activeElement = this;
      if (type === 'blur' && document.activeElement === this) document.activeElement = props.relatedTarget ?? null;
      const event = { type, target: this, ...props, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
      for (const handler of this.listeners.get(type) ?? []) await handler(event);
      return event;
    }
    focus() { if (document.activeElement !== this) { document.activeElement = this; void this.fire('focus'); } }
    scrollIntoView() { throw new Error('Scrolling a suggestion must never move the page.'); }
    getBoundingClientRect() {
      if (this.rect) return this.rect;
      const index = /^exercise-suggestion-(\d+)$/.exec(this.id ?? '');
      const panel = nodes['exercise-suggestion-panel'];
      const top = nodes['exercise-name'].rect.bottom + 4;
      return index ? { top: top + Number(index[1]) * 45 - panel.scrollTop, height: 45 } : { top, height: panel.clientHeight };
    }
  }
  const ids = ['exercise-name', 'exercise-suggestion-panel', 'exercise-suggestions', 'exercise-suggestion-status', 'save-exercise'];
  const nodes = Object.fromEntries(ids.map(id => [id, Object.assign(new Element('div'), { id })]));
  nodes['exercise-name'].rect = { top: 250, bottom: 296, left: 24, width: 342, height: 46 };
  nodes['save-exercise'].rect = { top: 700, bottom: 748, left: 24, width: 342, height: 48 };
  Object.defineProperty(nodes['exercise-suggestion-panel'], 'scrollHeight', { get: () => nodes['exercise-suggestions'].children.length * 45 });
  const view = Object.assign(new Element('window'), { innerWidth: 390, innerHeight: 844 });
  view.visualViewport = Object.assign(new Element('viewport'), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 });
  const document = Object.assign(new Element('document'), {
    defaultView: view, activeElement: null, createElement: tag => new Element(tag),
    getElementById: id => { assert.ok(nodes[id], `Unexpected UI dependency: ${id}`); return nodes[id]; },
  });
  const ui = setupExerciseNames({ loadSuggestions, document });
  ui.open(null);
  return { nodes, ui, document, view, name: nodes['exercise-name'], panel: nodes['exercise-suggestion-panel'], list: nodes['exercise-suggestions'] };
}

test('suggestions stay short, put catalog exercises first and identify user-added names', () => {
  const community = [
    { exercise_key: 'ex:squat', exercise_name: 'Squat' },
    { exercise_key: 'custom:squat on mars', exercise_name: 'Squat on mars' },
    { exercise_key: 'custom:squat on mars', exercise_name: 'Squat on mars' },
  ];
  const choices = matchingExerciseSuggestions('squat', community, 8);
  assert.ok(choices.length <= 8);
  assert.equal(choices.filter(item => item.key === 'ex:squat').length, 1);
  assert.ok(choices.filter(item => !item.community).every(item => item.label.toLowerCase().includes('squat')));
  const own = matchingExerciseSuggestions('mars', community);
  assert.deepEqual(own, [{ key: 'custom:squat on mars', label: 'Squat on mars', community: true }]);
  assert.deepEqual(matchingExerciseSuggestions('', community), []);
});

test('corrected search stays relevant and public aliases cannot duplicate catalog suggestions', () => {
  const community = [
    { exercise_key: 'custom:dumbell row eigen variant', exercise_name: 'Dumbell row eigen variant' },
    { exercise_key: 'custom:reverse fly machine', exercise_name: 'Reverse fly machine' },
  ];
  const rows = matchingExerciseSuggestions('dumbel row', community);
  assert.ok(rows.some(item => item.key === 'ex:dumbbell-row'));
  assert.ok(rows.every(item => /row/iu.test(item.label)));
  const reverse = matchingExerciseSuggestions('reverse fly machine', community);
  assert.equal(reverse.filter(item => item.label === 'Reverse fly machine').length, 1);
  assert.equal(reverse.find(item => item.label === 'Reverse fly machine').community, false);
});

test('only matching input opens suggestions; empty and free-name input need no placeholder or selection', async () => {
  const { name, panel, list, nodes, ui } = fixture();
  assert.equal(panel.hidden, true); assert.equal(list.hidden, true);
  assert.deepEqual(Object.keys(ui), ['open']);
  assert.equal(panel.children.length, 0);
  name.value = 'squat'; await name.fire('input');
  assert.equal(panel.hidden, false);
  assert.ok(list.children.length >= 3 && list.children.length <= 6);
  assert.equal(name.value, 'squat'); assert.equal(name.getAttribute('aria-expanded'), 'true');
  assert.equal((await name.fire('keydown', { key: 'Enter' })).defaultPrevented, false);
  for (const value of ['Mijn compleet eigen oefening', '']) {
    name.value = value; await name.fire('input');
    assert.equal(panel.hidden, true); assert.equal(list.hidden, true);
    assert.equal(name.getAttribute('aria-expanded'), 'false');
    assert.equal(nodes['exercise-suggestion-status'].textContent, '');
    assert.equal(name.value, value);
    assert.equal((await name.fire('keydown', { key: 'Enter' })).defaultPrevented, false);
  }
});

test('keyboard selection is explicit, Escape closes only an open list, and editing starts closed', async () => {
  const { name, panel, list, ui } = fixture();
  name.value = 'Mijn press'; ui.open({ rankingKey: 'ex:bench-press' });
  assert.equal(panel.hidden, true); assert.equal(name.value, 'Mijn press');
  name.value = 'squat'; await name.fire('input');
  const label = list.children[0].children[0].textContent;
  assert.equal((await name.fire('keydown', { key: 'ArrowDown' })).defaultPrevented, true);
  assert.equal(name.getAttribute('aria-activedescendant'), list.children[0].id);
  assert.equal(list.children[0].getAttribute('aria-selected'), 'true');
  assert.equal((await name.fire('keydown', { key: 'Enter' })).defaultPrevented, true);
  assert.equal(name.value, label); assert.equal(panel.hidden, true); assert.equal(list.hidden, true);
  assert.equal(name.getAttribute('aria-activedescendant'), null);
  name.value = 'squat'; await name.fire('input');
  const escape = await name.fire('keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true); assert.equal(escape.stopped, true);
  assert.equal(panel.hidden, true); assert.equal(list.hidden, true);
  assert.equal((await name.fire('keydown', { key: 'Escape' })).defaultPrevented, false);
  assert.equal(name.value, 'squat');
  await name.fire('keydown', { key: 'ArrowUp' });
  assert.equal(list.children.at(-1).getAttribute('aria-selected'), 'true');
  assert.equal((await name.fire('keydown', { key: 'Tab' })).defaultPrevented, false);
  assert.equal(panel.hidden, true);
});

test('community names load once without typed queries; clicks select without submitting and blur closes', async () => {
  const calls = [];
  const { name, list, panel } = fixture(async (...args) => {
    calls.push(args); return [{ exercise_key: 'custom:example tiger squat', exercise_name: 'Example tiger squat' }];
  });
  await name.fire('focus'); await name.fire('focus');
  assert.deepEqual(calls, [[]]);
  name.value = 'tiger'; await name.fire('input');
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[1].textContent, 'Door gebruikers');
  assert.equal((await list.children[0].fire('mousedown')).defaultPrevented, true);
  await list.children[0].fire('click');
  assert.equal(name.value, 'Example tiger squat'); assert.equal(panel.hidden, true);
  name.value = 'squat'; await name.fire('input');
  await name.fire('blur'); assert.equal(panel.hidden, true); assert.equal(name.value, 'squat');
});

test('a touch choice survives input blur without preventing native list scrolling', async () => {
  const { name, list, panel, document } = fixture();
  await name.fire('focus'); name.value = 'squat'; await name.fire('input');
  const option = list.children[0], label = option.children[0].textContent;
  const down = await option.fire('pointerdown', { pointerId: 7, button: 0, clientX: 80, clientY: 320 });
  assert.equal(down.defaultPrevented, false);
  await name.fire('blur'); assert.equal(panel.hidden, false);
  await document.fire('pointerup', { pointerId: 7, target: option.children[0], clientX: 82, clientY: 321 });
  assert.equal(name.value, label); assert.equal(panel.hidden, true); assert.equal(document.activeElement, name);
  await option.fire('click'); assert.equal(name.value, label); assert.equal(panel.hidden, true);
});

test('scrolling, cancelling or releasing outside a touched suggestion does not select it', async () => {
  const { name, list, panel, document } = fixture();
  for (const ending of ['scroll', 'pointercancel', 'outside']) {
    await name.fire('focus'); name.value = 'squat'; await name.fire('input');
    const option = list.children[0];
    await option.fire('pointerdown', { pointerId: 1, button: 0, clientX: 80, clientY: 320 });
    await name.fire('blur');
    if (ending === 'scroll') panel.scrollTop = 30;
    await document.fire(ending === 'pointercancel' ? ending : 'pointerup', {
      pointerId: 1, target: ending === 'outside' ? document : option, clientX: 80, clientY: 320,
    });
    assert.equal(name.value, 'squat'); assert.equal(panel.hidden, true);
    await option.fire('click'); assert.equal(name.value, 'squat');
  }
});

test('keyboard movement scrolls only inside the bounded suggestion panel', async () => {
  const { name, panel, list } = fixture();
  panel.clientHeight = 90;
  name.value = 'squat'; await name.fire('input');
  await name.fire('keydown', { key: 'ArrowDown' });
  await name.fire('keydown', { key: 'ArrowDown' });
  assert.equal(panel.scrollTop, 0);
  await name.fire('keydown', { key: 'ArrowDown' });
  assert.equal(panel.scrollTop, 45);
  assert.equal(name.getAttribute('aria-activedescendant'), list.children[2].id);
  await name.fire('keydown', { key: 'ArrowUp' });
  await name.fire('keydown', { key: 'ArrowUp' });
  assert.equal(panel.scrollTop, 0);
});

test('dropdown uses native placement below the input, limiting its height to the visible viewport', async () => {
  const { name, panel, view } = fixture();
  name.value = 'squat'; await name.fire('input');
  assert.deepEqual(panel.style, { maxHeight: '180px' });
  assert.equal(panel.getBoundingClientRect().top, name.getBoundingClientRect().bottom + 4);
  view.visualViewport.height = 400;
  await view.visualViewport.fire('resize');
  assert.deepEqual(panel.style, { maxHeight: '100px' });
  assert.equal(panel.getBoundingClientRect().top, 300);
  view.visualViewport.offsetTop = 50;
  await view.visualViewport.fire('scroll');
  assert.deepEqual(panel.style, { maxHeight: '150px' });
  name.rect = { top: 180, bottom: 226, left: 30, width: 342, height: 46 };
  await view.fire('scroll');
  assert.deepEqual(panel.style, { maxHeight: '180px' });
  assert.equal(panel.getBoundingClientRect().top, 230);
  name.rect.top = 450; name.rect.bottom = 496;
  await view.fire('scroll'); assert.equal(panel.hidden, true);
  assert.equal(panel.style.top, undefined);
});

test('edit suggestions stay below and scroll in the space before Save; add dialogs allow a taller list', async () => {
  const { name, panel, nodes, view } = fixture();
  name.rect = { top: 359, bottom: 407, left: 24, width: 342, height: 48 };
  nodes['save-exercise'].rect = { top: 461, bottom: 509, left: 24, width: 342, height: 48 };
  name.value = 'squat'; await name.fire('input');
  assert.deepEqual(panel.style, { maxHeight: '46px' });
  assert.equal(panel.getBoundingClientRect().top, 411);
  assert.ok(panel.getBoundingClientRect().top + panel.clientHeight < nodes['save-exercise'].rect.top);
  await name.fire('keydown', { key: 'ArrowDown' });
  await name.fire('keydown', { key: 'ArrowDown' });
  assert.equal(panel.scrollTop, 44);
  assert.equal(panel.getBoundingClientRect().top, 411);
  nodes['save-exercise'].rect = { top: 650, bottom: 698, left: 24, width: 342, height: 48 };
  await view.fire('resize');
  assert.deepEqual(panel.style, { maxHeight: '180px' });
  assert.equal(panel.getBoundingClientRect().top, 411);
  view.visualViewport.height = 405;
  await view.visualViewport.fire('resize');
  assert.equal(panel.hidden, true);
  assert.equal(panel.style.top, undefined);
  assert.equal(name.value, 'squat');
});
