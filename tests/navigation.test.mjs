import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFromHash, setupNavigation } from '../navigation.js';

function environment(hash = '') {
  const events = new Map(), clicks = new Map(), calls = [], scrolls = [];
  const pages = ['training', 'statistieken', 'ranglijst', 'gegevens'].map(page => ({
    dataset: { appPage: page }, hidden: page !== 'training',
    querySelector: () => ({ setAttribute() {}, focus(options) { calls.push(['focus', page, options]); } }),
  }));
  const links = pages.map(page => {
    const attributes = new Map([['href', `#/${page.dataset.appPage}`]]);
    return { getAttribute: name => attributes.get(name), setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name) };
  });
  const footer = { hidden: false };
  const document = { title: '', querySelectorAll: selector => selector === '[data-app-page]' ? pages : links,
    querySelector: () => footer, addEventListener: (name, fn) => clicks.set(name, fn) };
  const window = { scrollY: 0, location: { hash }, addEventListener: (name, fn) => events.set(name, fn),
    scrollTo(options) { scrolls.push(options.top); this.scrollY = options.top; },
    history: Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (state, _title, value) => {
      calls.push([method, value]); window.location.hash = value; window.history.state = state;
    }])) };
  window.history.go = delta => calls.push(['go', delta]);
  return { document, window, events, clicks, calls, pages, links, footer, scrolls };
}

test('known hash pages and invalid links resolve without a server route', () => {
  assert.equal(pageFromHash('#/ranglijst'), 'ranglijst');
  assert.equal(pageFromHash('#/statistieken'), 'statistieken');
  for (const value of ['', '#unknown', '#/__proto__', null]) assert.equal(pageFromHash(value), 'training');
});

test('direct page startup shows one page, activates its menu link and runs its handler once', () => {
  const env = environment('#/ranglijst'), navigation = setupNavigation(env);
  let renders = 0; navigation.onOpen('ranglijst', () => renders++); navigation.start(); navigation.start();
  assert.equal(renders, 1); assert.equal(env.document.title, 'Ranglijst — Fitness');
  assert.deepEqual(env.pages.map(page => page.hidden), [true, true, false, true]);
  assert.equal(env.links[2].getAttribute('aria-current'), 'page'); assert.equal(env.footer.hidden, true);
  assert.equal(env.calls.filter(call => call[0] === 'pushState').length, 0);
});

test('page navigation and browser back preserve training scroll and do not duplicate page renders', () => {
  const env = environment(), navigation = setupNavigation(env);
  let stats = 0; navigation.onOpen('statistieken', () => stats++); navigation.start();
  env.window.scrollY = 410; navigation.open('statistieken');
  assert.equal(stats, 1); assert.equal(env.scrolls.at(-1), 0);
  navigation.open('statistieken'); assert.equal(stats, 1);
  env.window.location.hash = '#/training'; env.window.history.state = { fitnessPageIndex: 0 }; env.events.get('popstate')(); env.events.get('hashchange')();
  assert.equal(navigation.isCurrent('training'), true); assert.equal(env.scrolls.at(-1), 410);
  assert.equal(env.footer.hidden, false); assert.equal(env.pages.filter(page => !page.hidden).length, 1);
});

test('blocked browser back returns to the current history entry without overwriting the earlier page', () => {
  const env = environment(), state = { busy: false };
  const navigation = setupNavigation({ ...env, canNavigate: () => !state.busy }); navigation.start(); navigation.open('statistieken');
  state.busy = true; env.window.location.hash = '#/training'; env.window.history.state = { fitnessPageIndex: 0 };
  env.events.get('popstate')();
  assert.deepEqual(env.calls.at(-1), ['go', 1]); assert.equal(navigation.isCurrent('statistieken'), true);
  env.events.get('hashchange')(); assert.equal(env.calls.filter(call => call[0] === 'go').length, 1);
  env.window.location.hash = '#/statistieken'; env.window.history.state = { fitnessPageIndex: 1 }; env.events.get('popstate')();
  state.busy = false; env.window.location.hash = '#/training'; env.window.history.state = { fitnessPageIndex: 0 }; env.events.get('popstate')();
  assert.equal(navigation.isCurrent('training'), true);
});

test('busy imports keep navigation and URL unchanged, then ordinary menu links work', () => {
  const env = environment(), state = { busy: false };
  const navigation = setupNavigation({ ...env, canNavigate: () => !state.busy }); navigation.start();
  state.busy = true; assert.equal(navigation.open('gegevens'), false); assert.equal(env.window.location.hash, '#/training');
  env.window.location.hash = '#/ranglijst'; env.events.get('hashchange')(); assert.equal(env.window.location.hash, '#/training');
  state.busy = false;
  const event = { button: 0, target: { closest: () => env.links[3] }, preventDefault() { this.prevented = true; } };
  env.clicks.get('click')(event); assert.equal(event.prevented, true); assert.equal(navigation.isCurrent('gegevens'), true);
});
