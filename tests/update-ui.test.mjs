import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRequiredUpdates } from '../update-ui.js';

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  fire(type, props = {}) {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (const callback of [...(this.listeners.get(type) || [])]) callback(event);
    return event;
  }
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function settle() { for (let count = 0; count < 12; count++) await Promise.resolve(); }
function worker(state = 'installed') {
  const value = new Events(); value.state = state; value.messages = [];
  value.postMessage = message => value.messages.push(message);
  return value;
}
function fixture({ firstInstall = false, initialWaiting = true, safe = true, online = true, save = async () => true } = {}) {
  const document = new Events(), window = new Events(), workers = new Events(), registration = new Events();
  const dialog = new Events(), button = new Events(), message = {}, error = { hidden: true };
  const elements = { 'required-update-dialog': dialog, 'apply-required-update': button,
    'required-update-message': message, 'required-update-error': error };
  dialog.open = false; dialog.opens = 0;
  dialog.showModal = () => { dialog.open = true; dialog.opens++; };
  dialog.close = () => { dialog.open = false; document.fire('close', { target: dialog }); };
  button.focuses = 0; button.focus = () => { button.focuses++; };
  document.getElementById = id => elements[id]; document.visibilityState = 'visible';
  const timeouts = new Map(), intervals = new Map(); let timerId = 0;
  window.setTimeout = callback => { timeouts.set(++timerId, callback); return timerId; };
  window.clearTimeout = id => timeouts.delete(id);
  window.setInterval = (callback, delay) => { intervals.set(++timerId, { callback, delay }); return timerId; };
  window.clearInterval = id => intervals.delete(id);
  registration.waiting = initialWaiting ? worker() : null;
  registration.active = firstInstall ? null : worker('activated');
  registration.updates = 0; registration.update = async () => { registration.updates++; };
  workers.controller = firstInstall ? null : registration.active;
  const ready = deferred(); workers.ready = ready.promise;
  workers.registers = [];
  workers.register = async (...args) => { workers.registers.push(args); return registration; };
  const navigator = { serviceWorker: workers, onLine: online };
  const gates = [], statuses = [], order = []; let reloads = 0, saves = 0;
  const ui = setupRequiredUpdates({ document, window, navigator, canPrompt: () => safe,
    beforeUpdate: () => { saves++; order.push('save'); return save(); },
    onRequired: value => gates.push(value), onOfflineStatus: value => statuses.push(value),
    reload: () => { reloads++; order.push('reload'); },
  });
  return { ui, document, window, workers, registration, dialog, button, message, error, navigator, gates, statuses,
    timeouts, intervals, order, ready, saves: () => saves, reloads: () => reloads,
    safe: value => { safe = value; }, save: callback => { save = callback; },
    activate: () => { workers.controller = worker('activated'); registration.waiting = null; workers.fire('controllerchange'); },
  };
}

test('an existing waiting update requires an explicit apply after saving and cannot be dismissed', async () => {
  const f = fixture(), waiting = f.registration.waiting;
  await f.ui.start();
  assert.deepEqual(f.workers.registers, [['./sw.js', { scope: './', updateViaCache: 'none' }]]);
  assert.equal(f.ui.isRequired(), true); assert.deepEqual(f.gates, [true]);
  assert.equal(f.dialog.open, true); assert.equal(f.button.focuses, 1);
  assert.equal(f.dialog.fire('cancel').defaultPrevented, true);
  f.dialog.close(); assert.equal(f.dialog.open, true);
  assert.equal(f.saves(), 0); assert.equal(f.reloads(), 0); assert.deepEqual(waiting.messages, []);
  f.button.fire('click'); await settle();
  assert.equal(f.saves(), 1); assert.deepEqual(waiting.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(f.reloads(), 0); assert.equal(f.button.disabled, true);
  f.activate(); await settle();
  assert.equal(f.reloads(), 1); assert.deepEqual(f.order, ['save', 'save', 'reload']);
});

test('a first installation and its initial controller claim never create an update gate', async () => {
  const f = fixture({ firstInstall: true, initialWaiting: false });
  await f.ui.start();
  const installing = worker('installing'); f.registration.installing = installing; f.registration.fire('updatefound');
  installing.state = 'installed'; f.registration.waiting = installing; installing.fire('statechange');
  f.activate(); f.ready.resolve(); await settle();
  assert.equal(f.ui.isRequired(), false); assert.equal(f.dialog.open, false);
  assert.equal(f.saves(), 0); assert.equal(f.reloads(), 0); assert.deepEqual(f.gates, []);
  assert.equal(f.statuses.at(-1), 'Klaar voor offline gebruik');
});

test('a first-install window that remains open still detects a later release', async () => {
  const f = fixture({ firstInstall: true, initialWaiting: false }); await f.ui.start();
  f.activate(); await settle(); assert.equal(f.ui.isRequired(), false);
  const next = worker('installing'); f.registration.installing = next; f.registration.fire('updatefound');
  next.state = 'installed'; f.registration.waiting = next; next.fire('statechange');
  assert.equal(f.ui.isRequired(), true); assert.equal(f.dialog.open, true);
  assert.equal(f.reloads(), 0); assert.deepEqual(next.messages, []);
});

test('a controller replaced while registration is pending is detected even if its event was missed', async () => {
  const f = fixture({ initialWaiting: false, safe: false }), registration = deferred();
  f.workers.register = () => registration.promise;
  const started = f.ui.start();
  f.workers.controller = worker('activated'); // Event occurred before listeners were attached.
  registration.resolve(f.registration); await started; await settle();
  assert.equal(f.ui.isRequired(), true); assert.equal(f.reloads(), 0);
  f.safe(true); f.ui.refresh(); await settle(); assert.equal(f.reloads(), 1);
});

test('a subsequently installed worker is discovered once even before registration.waiting is updated', async () => {
  const f = fixture({ initialWaiting: false }); await f.ui.start();
  const installing = worker('installing'); f.registration.installing = installing; f.registration.fire('updatefound');
  assert.equal(f.ui.isRequired(), false);
  installing.state = 'installed'; installing.fire('statechange');
  assert.equal(f.ui.isRequired(), true); assert.equal(f.dialog.open, true);
  f.registration.waiting = installing; installing.fire('statechange'); f.ui.refresh();
  assert.deepEqual(f.gates, [true]); assert.equal(f.dialog.opens, 1);
  assert.deepEqual(installing.messages, []);
});

test('new editing is gated immediately but an existing form can finish before the mandatory dialog opens', async () => {
  const f = fixture({ safe: false }); await f.ui.start();
  assert.equal(f.ui.isRequired(), true); assert.equal(f.dialog.open, false);
  f.button.fire('click'); await settle(); assert.equal(f.saves(), 0);
  f.safe(true); f.document.fire('close');
  assert.equal(f.dialog.open, true); assert.equal(f.saves(), 0); assert.equal(f.reloads(), 0);
});

test('duplicate apply clicks cannot activate or reload ahead of a pending local save', async () => {
  const pending = deferred(), f = fixture({ save: () => pending.promise }), waiting = f.registration.waiting;
  await f.ui.start(); f.button.fire('click'); f.button.fire('click'); f.button.fire('click'); await settle();
  assert.equal(f.saves(), 1); assert.equal(f.button.disabled, true);
  assert.deepEqual(waiting.messages, []); assert.equal(f.reloads(), 0);
  pending.resolve(true); await settle();
  assert.deepEqual(waiting.messages, [{ type: 'SKIP_WAITING' }]);
  f.button.fire('click'); await settle(); assert.equal(f.saves(), 1);
  f.activate(); await settle(); assert.equal(f.reloads(), 1);
  f.workers.fire('controllerchange'); await settle(); assert.equal(f.reloads(), 1);
});

test('a failed or thrown save keeps the update blocking with a retry and never exposes an exception', async () => {
  for (const save of [async () => false, async () => { throw new Error('secret database detail'); }]) {
    const f = fixture({ save }), waiting = f.registration.waiting;
    await f.ui.start(); f.button.fire('click'); await settle();
    assert.equal(f.dialog.open, true); assert.equal(f.ui.isRequired(), true);
    assert.equal(f.error.hidden, false); assert.match(f.error.textContent, /opgeslagen/);
    assert.doesNotMatch(f.error.textContent, /secret/); assert.equal(f.button.disabled, false);
    assert.equal(f.button.textContent, 'Opnieuw proberen');
    assert.deepEqual(waiting.messages, []); assert.equal(f.reloads(), 0);
    f.save(async () => true); f.button.fire('click'); await settle();
    assert.deepEqual(waiting.messages, [{ type: 'SKIP_WAITING' }]); assert.equal(f.error.hidden, true);
  }
});

test('another window activating an update waits for the open form, then flushes before reloading', async () => {
  const pending = deferred(), f = fixture({ safe: false, initialWaiting: false, save: () => pending.promise });
  await f.ui.start(); f.activate(); await settle();
  assert.equal(f.ui.isRequired(), true); assert.equal(f.dialog.open, false);
  assert.equal(f.saves(), 0); assert.equal(f.reloads(), 0);
  f.safe(true); f.document.fire('close'); await settle();
  assert.equal(f.dialog.open, true); assert.equal(f.saves(), 1); assert.equal(f.reloads(), 0);
  pending.resolve(true); await settle();
  assert.deepEqual(f.order, ['save', 'reload']); assert.equal(f.reloads(), 1);
});

test('a controller change while saving cannot bypass the pending write', async () => {
  const pending = deferred(), f = fixture({ save: () => pending.promise }), waiting = f.registration.waiting;
  await f.ui.start(); f.button.fire('click'); await settle(); f.activate(); await settle();
  assert.equal(f.saves(), 1); assert.equal(f.reloads(), 0); assert.deepEqual(waiting.messages, []);
  pending.resolve(true); await settle();
  assert.equal(f.reloads(), 1); assert.deepEqual(f.order, ['save', 'reload']);
  assert.deepEqual(waiting.messages, []);
});

test('a failed save after another window activated the worker does not reload the old document', async () => {
  const f = fixture({ initialWaiting: false, save: async () => false }); await f.ui.start();
  f.activate(); await settle();
  assert.equal(f.dialog.open, true); assert.equal(f.error.hidden, false); assert.equal(f.reloads(), 0);
  for (let count = 0; count < 5; count++) {
    f.ui.refresh(); await f.ui.check(); f.window.fire('focus'); await settle();
  }
  assert.equal(f.saves(), 1, 'root save-finally refreshes and foreground checks must not automatically retry failed storage');
  f.save(async () => true); f.button.fire('click'); await settle();
  assert.equal(f.reloads(), 1); assert.deepEqual(f.order, ['save', 'save', 'reload']);
});

test('an apply error requires a manual retry even when another window subsequently activates the update', async () => {
  const f = fixture({ save: async () => false }); await f.ui.start(); f.button.fire('click'); await settle();
  assert.equal(f.saves(), 1); f.activate(); await settle(); f.ui.refresh(); await settle();
  assert.equal(f.saves(), 1); assert.equal(f.reloads(), 0); assert.equal(f.error.hidden, false);
  f.save(async () => true); f.button.fire('click'); await settle(); assert.equal(f.reloads(), 1);
});

test('an installed waiting update can be applied offline without a fresh network check', async () => {
  const f = fixture({ online: false }), waiting = f.registration.waiting;
  await f.ui.start(); assert.equal(f.registration.updates, 0);
  assert.equal(f.dialog.open, true); f.button.fire('click'); await settle();
  assert.deepEqual(waiting.messages, [{ type: 'SKIP_WAITING' }]);
  f.activate(); await settle(); assert.equal(f.reloads(), 1);
});

test('startup, foreground, online, focus and visible timer checks share one in-flight request', async () => {
  const request = deferred(), f = fixture({ initialWaiting: false });
  f.registration.update = () => { f.registration.updates++; return request.promise; };
  const started = f.ui.start(); await settle(); assert.equal(f.registration.updates, 1);
  f.window.fire('focus'); f.window.fire('online'); f.document.fire('visibilitychange');
  const timer = [...f.intervals.values()][0]; assert.equal(timer.delay, 300000); timer.callback();
  await settle(); assert.equal(f.registration.updates, 1);
  request.resolve(); await started; await settle();
  f.document.visibilityState = 'hidden'; timer.callback(); f.window.fire('focus'); await settle();
  assert.equal(f.registration.updates, 1);
  f.document.visibilityState = 'visible'; f.document.fire('visibilitychange'); await settle();
  assert.equal(f.registration.updates, 2);
  f.navigator.onLine = false; f.window.fire('focus'); timer.callback(); await settle();
  assert.equal(f.registration.updates, 2);
});

test('a hidden document gates a new controller but waits until visible to reload', async () => {
  const f = fixture({ initialWaiting: false }); await f.ui.start(); f.document.visibilityState = 'hidden';
  f.activate(); await settle(); assert.equal(f.ui.isRequired(), true);
  assert.equal(f.dialog.open, false); assert.equal(f.saves(), 0); assert.equal(f.reloads(), 0);
  f.document.visibilityState = 'visible'; f.document.fire('visibilitychange'); await settle();
  assert.equal(f.reloads(), 1);
});

test('activation failure offers retry without freeing the gate or reloading', async () => {
  const f = fixture(), waiting = f.registration.waiting; await f.ui.start();
  f.button.fire('click'); await settle();
  assert.equal(f.timeouts.size, 1); [...f.timeouts.values()][0]();
  assert.equal(f.ui.isRequired(), true); assert.equal(f.error.hidden, false); assert.equal(f.button.disabled, false);
  assert.equal(f.reloads(), 0); f.button.fire('click'); await settle();
  assert.equal(waiting.messages.length, 2); f.activate(); await settle(); assert.equal(f.reloads(), 1);
});

test('network discovery errors keep the local app usable and later checks still work', async () => {
  const f = fixture({ initialWaiting: false });
  f.registration.update = async () => { throw new Error('offline'); };
  assert.equal(await f.ui.start(), true); assert.equal(f.ui.isRequired(), false);
  assert.equal(f.dialog.open, false); assert.equal(f.statuses.at(-1), 'Klaar voor offline gebruik');
  f.registration.waiting = worker(); await f.ui.check();
  assert.equal(f.dialog.open, true); assert.equal(f.ui.isRequired(), true);
});

test('disposing removes event checks, timers and any pending activation without reloading', async () => {
  const f = fixture(); await f.ui.start(); f.button.fire('click'); await settle(); f.ui.dispose();
  assert.equal(f.intervals.size, 0); assert.equal(f.timeouts.size, 0);
  const checks = f.registration.updates;
  f.window.fire('focus'); f.window.fire('online'); f.document.fire('visibilitychange'); f.activate(); await settle();
  assert.equal(f.registration.updates, checks); assert.equal(f.reloads(), 0);
});
