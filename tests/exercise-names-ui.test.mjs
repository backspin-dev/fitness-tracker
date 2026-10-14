import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingExerciseSuggestions, setupExerciseNames } from '../exercise-names-ui.js';

function fixture(loadSuggestions = async () => []) {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.value = ''; this.attributes = new Map(); this.listeners = new Map(); this.hidden = false; this.scrollTop = 0; this.clientTop = 0; this.clientHeight = 180; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
    async fire(type, props = {}) {
      const event = { ...props, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
      for (const handler of this.listeners.get(type) ?? []) await handler(event);
      return event;
    }
    focus() { if (document.activeElement !== this) { document.activeElement = this; void this.fire('focus'); } }
    scrollIntoView() { throw new Error('Scrolling a suggestion must never move the page.'); }
    getBoundingClientRect() {
      const index = /^exercise-suggestion-(\d+)$/.exec(this.id ?? '');
      return index ? { top: 300 + Number(index[1]) * 45 - nodes['exercise-suggestion-panel'].scrollTop, height: 45 } : { top: 300, height: 180 };
    }
  }
  const ids = ['exercise-name', 'exercise-ranking', 'exercise-suggestion-panel', 'exercise-suggestions',
    'exercise-ranking-options', 'exercise-ranking-summary', 'exercise-suggestion-status'];
  const nodes = Object.fromEntries(ids.map(id => [id, Object.assign(new Element('div'), { id })]));
  const document = { createElement: tag => new Element(tag), getElementById: id => nodes[id] };
  const ui = setupExerciseNames({ loadSuggestions, document });
  ui.open(null);
  return { nodes, ui, name: nodes['exercise-name'], panel: nodes['exercise-suggestion-panel'], list: nodes['exercise-suggestions'] };
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

test('corrected search stays relevant and public aliases cannot duplicate catalog suggestions',()=>{
 const community=[
  {exercise_key:'custom:dumbell row eigen variant',exercise_name:'Dumbell row eigen variant'},
  {exercise_key:'custom:reverse fly machine',exercise_name:'Reverse fly machine'},
 ];
 const rows=matchingExerciseSuggestions('dumbel row',community);
 assert.ok(rows.some(item=>item.key==='ex:dumbbell-row'));
 assert.ok(rows.every(item=>/row/iu.test(item.label)));
 const reverse=matchingExerciseSuggestions('reverse fly machine',community);
 assert.equal(reverse.filter(item=>item.label==='Reverse fly machine').length,1);
 assert.equal(reverse.find(item=>item.label==='Reverse fly machine').community,false);
});

test('typing shows matching exercises without requiring a choice or intercepting free-name Enter', async () => {
  const { name, panel, list, ui } = fixture();
  assert.equal(panel.hidden, false);
  assert.equal(list.hidden, true);
  name.value = 'squat'; await name.fire('input');
  assert.equal(panel.hidden, false);
  assert.ok(list.children.length >= 3 && list.children.length <= 6);
  assert.equal(name.value, 'squat');
  assert.equal(name.getAttribute('aria-expanded'), 'true');
  assert.equal((await name.fire('keydown', { key: 'Enter' })).defaultPrevented, false);
  assert.equal(ui.getRankingKey(), undefined);
  name.value = 'Mijn compleet eigen oefening'; await name.fire('input');
  assert.equal(panel.hidden, false);
  assert.equal(list.hidden, true);
  assert.equal(name.value, 'Mijn compleet eigen oefening');
  assert.equal((await name.fire('keydown', { key: 'Enter' })).defaultPrevented, false);
});

test('keyboard selection is explicit, Escape only closes an open list and opening an edit preserves its override', async () => {
  const { name, panel, list, nodes, ui } = fixture();
  name.value = 'Mijn press'; ui.open({ rankingKey: 'ex:bench-press' });
  assert.equal(panel.hidden, false);
  assert.equal(list.hidden, true);
  assert.equal(ui.getRankingKey(), 'ex:bench-press');
  name.value = 'squat'; await name.fire('input');
  const label = list.children[0].children[0].textContent;
  assert.equal((await name.fire('keydown', { key: 'ArrowDown' })).defaultPrevented, true);
  assert.equal(name.getAttribute('aria-activedescendant'), list.children[0].id);
  assert.equal(list.children[0].getAttribute('aria-selected'), 'true');
  assert.equal((await name.fire('keydown', { key: 'Enter' })).defaultPrevented, true);
  assert.equal(name.value, label); assert.equal(panel.hidden, false); assert.equal(list.hidden, true);
  assert.equal(ui.getRankingKey(), undefined); assert.equal(ui.hasChanged(), true);
  assert.match(nodes['exercise-ranking-summary'].textContent, /Ranglijst: /);
  name.value = 'squat'; await name.fire('input');
  const escape = await name.fire('keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true); assert.equal(escape.stopped, true);
  assert.equal(panel.hidden, false);
  assert.equal(list.hidden, true);
  assert.equal((await name.fire('keydown', { key: 'Escape' })).defaultPrevented, false);
  assert.equal(name.value, 'squat');
});

test('community names load once without typed queries and tapping selects text without submitting', async () => {
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
  assert.equal(name.value, 'Example tiger squat'); assert.equal(panel.hidden, false); assert.equal(list.hidden, true);
  await name.fire('blur'); assert.equal(name.value, 'Example tiger squat');
});


test('empty, matching and custom input keep the suggestion and ranking slots in place', async () => {
  const { name, panel, list, nodes } = fixture();
  const ranking = nodes['exercise-ranking-options'];
  assert.equal(panel.hidden, false); assert.equal(ranking.hidden, false);
  assert.equal(ranking.getAttribute('data-empty'), 'true');
  for (const value of ['s', 'squat', 'Squat', 'Mijn vrije oefening', '']) {
    name.value = value; await name.fire('input');
    assert.equal(panel.hidden, false); assert.equal(ranking.hidden, false);
    assert.equal(ranking.getAttribute('data-empty'), String(!value));
    const placeholder = panel.children.at(-1);
    assert.equal(placeholder.hidden, !list.hidden);
    if (!value) assert.equal(placeholder.textContent, 'Typ een oefening voor suggesties.');
    if (value === 'Mijn vrije oefening') assert.equal(placeholder.textContent, 'Geen suggesties. Je kunt deze naam gebruiken.');
  }
  await name.fire('blur');
  assert.equal(panel.hidden, false); assert.equal(list.hidden, true);
});

test('keyboard movement scrolls only inside the fixed suggestion panel', async () => {
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
