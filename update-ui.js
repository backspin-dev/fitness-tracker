const DEFAULT_INTERVAL = 5 * 60 * 1000;
const SAVE_ERROR = 'Je wijzigingen konden nog niet worden opgeslagen. Probeer opnieuw of maak eerst een back-up.';
const APPLY_ERROR = 'Bijwerken is nog niet gelukt. Probeer opnieuw. Je gegevens blijven op dit apparaat.';

// The worker owns a complete offline shell. Discovery only blocks new work;
// activation/reload must wait for existing forms and local writes to finish.
export function setupRequiredUpdates({
  document = globalThis.document,
  window = globalThis.window,
  navigator = globalThis.navigator,
  canPrompt = () => true,
  beforeUpdate = async () => true,
  onRequired = () => {},
  onOfflineStatus = () => {},
  reload = () => window.location.reload(),
  interval = DEFAULT_INTERVAL,
} = {}) {
  const dialog = document.getElementById('required-update-dialog');
  const button = document.getElementById('apply-required-update');
  const message = document.getElementById('required-update-message');
  const error = document.getElementById('required-update-error');
  const workers = navigator?.serviceWorker;
  let shellController = workers?.controller || null;
  const listeners = [], watched = new Set();
  let registration = null, waiting = null, required = false, disposed = false;
  let startPromise = null, checkPromise = null, flushPromise = null;
  let controllerUpdated = false, controllerReloadAttempted = false, applying = false, reloading = false;
  let timer = null, activationTimer = null;

  function listen(target, type, callback, options) {
    target?.addEventListener(type, callback, options);
    listeners.push(() => target?.removeEventListener(type, callback, options));
  }
  function visible() { return document.visibilityState !== 'hidden'; }
  function safeToPrompt() {
    if (!visible()) return false;
    try { return !!canPrompt(); } catch { return false; }
  }
  function setRequired() {
    if (required || disposed) return;
    required = true;
    onRequired(true);
  }
  function showError(text) {
    // A failed local write can itself schedule another root refresh. Retrying
    // automatically there would produce an endless save/error loop.
    controllerReloadAttempted = true;
    error.textContent = text;
    error.hidden = false;
    applying = false;
    button.disabled = false;
    button.textContent = 'Opnieuw proberen';
    message.textContent = 'Een update is nodig om verder te gaan.';
  }
  function clearActivationTimer() {
    if (activationTimer !== null) window.clearTimeout(activationTimer);
    activationTimer = null;
  }
  function finishReload() {
    if (disposed || reloading) return;
    clearActivationTimer();
    reloading = true;
    message.textContent = 'De app wordt bijgewerkt…';
    reload();
  }
  function refresh() {
    if (disposed || !required || !safeToPrompt()) return;
    if (!dialog.open) {
      message.textContent = 'Een update is nodig om verder te gaan. Je trainingen blijven bewaard.';
      dialog.showModal();
      button.focus();
    }
    // Another window may have activated the worker already. Never keep an old
    // document running against that new shell: save safely, then reload.
    if (controllerUpdated && !controllerReloadAttempted && !applying && !flushPromise && !reloading) {
      controllerReloadAttempted = true;
      void apply();
    }
  }
  function observe(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    listen(worker, 'statechange', () => {
      if (worker.state === 'installed') discover(worker);
      else discover();
    });
  }
  function discoverController() {
    const controller = workers?.controller;
    if (!controller) return;
    // The first claim belongs to initial installation. Remember that baseline
    // so a later release is still detected in this same long-lived window.
    if (!shellController) { shellController = controller; return; }
    if (controller === shellController || controllerUpdated) return;
    controllerUpdated = true;
    clearActivationTimer();
    setRequired();
    if (!flushPromise) applying = false;
  }
  function discover(installed = null) {
    if (disposed || !registration) return;
    discoverController();
    observe(registration.installing);
    observe(registration.waiting);
    if (shellController) {
      const candidate = registration.waiting || (installed?.state === 'installed' ? installed : null);
      if (candidate && candidate.state !== 'redundant') waiting = candidate;
      if (waiting || controllerUpdated) setRequired();
    }
    refresh();
  }
  async function apply() {
    if (disposed || !required || !safeToPrompt() || reloading || flushPromise || (applying && !controllerUpdated)) return false;
    // A manual retry may start a fresh activation attempt after an error.
    controllerReloadAttempted = controllerUpdated;
    applying = true;
    clearActivationTimer();
    button.disabled = true;
    error.hidden = true;
    message.textContent = 'Je wijzigingen worden bewaard…';
    const job = (async () => {
      let saved = false;
      try { saved = await beforeUpdate(); } catch { /* A failed save must never reload the page. */ }
      if (disposed) return false;
      if (!saved) { showError(SAVE_ERROR); return false; }
      if (controllerUpdated) { finishReload(); return true; }
      if (!waiting || waiting.state === 'redundant') { showError(APPLY_ERROR); return false; }
      try {
        message.textContent = 'De app wordt bijgewerkt…';
        waiting.postMessage({ type: 'SKIP_WAITING' });
        // A cached waiting worker works offline too. If activation fails, keep
        // the required dialog visible with a retry instead of trapping a spinner.
        activationTimer = window.setTimeout(() => {
          activationTimer = null;
          if (!controllerUpdated && !reloading) showError(APPLY_ERROR);
        }, 15000);
        return true;
      } catch { showError(APPLY_ERROR); return false; }
    })();
    flushPromise = job;
    try { return await job; }
    finally {
      flushPromise = null;
      // controllerchange can happen while beforeUpdate is awaiting the queue.
      if (controllerUpdated && applying && !reloading && !disposed) void apply();
    }
  }
  async function check() {
    refresh();
    if (disposed || !registration || !visible() || navigator.onLine === false) return false;
    if (checkPromise) return checkPromise;
    const job = (async () => {
      try { await registration.update(); return true; }
      catch { return false; }
      finally { discover(); }
    })();
    checkPromise = job;
    try { return await job; }
    finally { checkPromise = null; }
  }
  function start() {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      if (!workers) { onOfflineStatus('Offline gebruik niet beschikbaar'); return false; }
      try {
        registration = await workers.register('./sw.js', { scope: './', updateViaCache: 'none' });
        if (disposed) return false;
        listen(registration, 'updatefound', () => { observe(registration.installing); discover(); });
        listen(workers, 'controllerchange', () => {
          discoverController();
          refresh();
        });
        discover();
        if (registration.active) onOfflineStatus('Klaar voor offline gebruik');
        else workers.ready?.then(() => {
          if (!disposed) { onOfflineStatus('Klaar voor offline gebruik'); discover(); }
        }).catch(() => {});
        await check();
        return true;
      } catch {
        if (!disposed) onOfflineStatus('Offline laden is nog niet gelukt');
        return false;
      }
    })();
    return startPromise;
  }
  listen(button, 'click', () => { void apply(); });
  listen(dialog, 'cancel', event => { if (required) event.preventDefault(); });
  listen(document, 'close', () => refresh(), true);
  listen(window, 'focus', () => { void check(); });
  listen(window, 'online', () => { void check(); });
  listen(document, 'visibilitychange', () => { if (visible()) void check(); });
  timer = window.setInterval(() => { if (visible()) void check(); }, interval);

  return {
    start, check, refresh,
    isRequired: () => required,
    isApplying: () => applying || reloading,
    dispose() {
      disposed = true;
      window.clearInterval(timer);
      clearActivationTimer();
      listeners.splice(0).forEach(remove => remove());
    },
  };
}
