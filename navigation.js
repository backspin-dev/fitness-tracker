const TITLES = { training: 'Fitness — jouw training', statistieken: 'Statistieken — Fitness', ranglijst: 'Ranglijst — Fitness', gegevens: 'Jouw gegevens — Fitness' };

export function pageFromHash(hash) {
  const page = typeof hash === 'string' ? hash.replace(/^#\//u, '') : '';
  return Object.hasOwn(TITLES, page) ? page : 'training';
}

// Hashpagina's werken ook offline en onder de GitHub Pages-subdirectory.
export function setupNavigation({ document = globalThis.document, window = globalThis.window, canNavigate = () => true } = {}) {
  const callbacks = new Map(), positions = new Map();
  let current = null, started = false, historyIndex = 0, restoringHistory = false;
  const entry = index => ({ ...window.history.state, fitnessPageIndex: index });
  function render(page, focus = true) {
    if (page === current) return;
    if (current) positions.set(current, window.scrollY || 0);
    current = page;
    for (const section of document.querySelectorAll('[data-app-page]')) section.hidden = section.dataset.appPage !== page;
    for (const link of document.querySelectorAll('[data-page-link]')) {
      if (link.getAttribute('href') === `#/${page}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = TITLES[page];
    const footer = document.querySelector('.status-footer');
    if (footer) footer.hidden = page !== 'training';
    for (const callback of callbacks.get(page) || []) callback();
    const section = [...document.querySelectorAll('[data-app-page]')].find(node => node.dataset.appPage === page);
    if (focus) {
      const heading = section?.querySelector('h2, h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    }
    window.scrollTo({ top: positions.get(page) || 0, left: 0, behavior: 'auto' });
  }
  function open(page, { replace = false } = {}) {
    if (!Object.hasOwn(TITLES, page) || !canNavigate()) return false;
    if (started && page === current) return true;
    const hash = `#/${page}`;
    if (!replace) historyIndex++;
    window.history[replace ? 'replaceState' : 'pushState'](entry(historyIndex), '', hash);
    if (started) render(page);
    return true;
  }
  function fromHistory() {
    if (!started) return;
    const targetIndex = window.history.state?.fitnessPageIndex;
    if (restoringHistory && targetIndex !== historyIndex) return;
    restoringHistory = false;
    if (!canNavigate()) {
      if (Number.isInteger(targetIndex) && targetIndex !== historyIndex) { restoringHistory = true; window.history.go(historyIndex - targetIndex); }
      else if (window.location.hash !== `#/${current}`) window.history.replaceState(entry(historyIndex), '', `#/${current}`);
      return;
    }
    if (Number.isInteger(targetIndex)) historyIndex = targetIndex;
    const page = pageFromHash(window.location.hash);
    if (window.location.hash !== `#/${page}`) window.history.replaceState(entry(historyIndex), '', `#/${page}`);
    render(page);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#/"]');
    if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); open(pageFromHash(link.getAttribute('href')));
  });
  window.addEventListener('hashchange', fromHistory);
  window.addEventListener('popstate', fromHistory);
  return {
    open,
    onOpen(page, callback) {
      if (!Object.hasOwn(TITLES, page)) throw new Error('Onbekende pagina.');
      const listeners = callbacks.get(page) || []; listeners.push(callback); callbacks.set(page, listeners);
      if (started && current === page) callback();
    },
    isCurrent: page => current === page,
    start() {
      if (started) return;
      started = true;
      const page = pageFromHash(window.location.hash);
      historyIndex = Number.isInteger(window.history.state?.fitnessPageIndex) ? window.history.state.fitnessPageIndex : 0;
      window.history.replaceState(entry(historyIndex), '', `#/${page}`); render(page, false);
    },
  };
}
