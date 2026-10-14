import { normalizeExerciseName, detectExercise, exerciseSearchScore, suggestExercises } from './exercise-catalog.js';

// Een korte lijst helpt bij kiezen; vrij typen blijft altijd mogelijk.
export function matchingExerciseSuggestions(value, publicNames = [], limit = 6) {
  const query = normalizeExerciseName(value);
  if (!query) return [];
  const found = suggestExercises(value, limit).slice(0, limit).map(item => ({ key: item.key, label: item.label, community: false }));
  const seen = new Set(found.map(item => item.key));
  for (const item of publicNames) {
    if (found.length >= limit) break;
    if (typeof item.exercise_key !== 'string' || typeof item.exercise_name !== 'string' ||
        seen.has(item.exercise_key) || detectExercise(item.exercise_name) || !Number.isFinite(exerciseSearchScore(value, item.exercise_name))) continue;
    found.push({ key: item.exercise_key, label: item.exercise_name, community: true });
    seen.add(item.exercise_key);
  }
  return found;
}

// Geen getypte zoektermen naar de server: de openbare namen worden eenmaal geladen.
export function setupExerciseNames({ loadSuggestions, document = globalThis.document }) {
  const $ = id => document.getElementById(id);
  const name = $('exercise-name'), panel = $('exercise-suggestion-panel'), list = $('exercise-suggestions');
  const view = document.defaultView;
  let publicNames = [], requested = false, showing = false, matches = [], active = -1;
  let pointer = null, suppressClick = null;

  function positionPanel() {
    if (panel.hidden || !view) return;
    const viewport = view.visualViewport;
    const leftEdge = viewport?.offsetLeft || 0, topEdge = viewport?.offsetTop || 0;
    const width = viewport?.width || view.innerWidth, height = viewport?.height || view.innerHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const rect = name.getBoundingClientRect(), gap = 4;
    if (rect.bottom <= topEdge || rect.top >= topEdge + height) { hideSuggestions(); return; }
    const below = Math.max(0, topEdge + height - rect.bottom - gap);
    const above = Math.max(0, rect.top - topEdge - gap);
    const panelWidth = Math.min(rect.width, Math.max(0, width - 16));
    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${Math.max(leftEdge + 8, Math.min(rect.left, leftEdge + width - panelWidth - 8))}px`;
    const desiredHeight = Math.min(180, panel.scrollHeight || 180);
    const saveRect = $('save-exercise').getBoundingClientRect();
    const belowTop = rect.bottom + gap;
    const coversSave = saveRect.top < belowTop + Math.min(desiredHeight, below) && saveRect.bottom > belowTop;
    // Vrije invoer moet direct te bewaren blijven, ook in het korte bewerkvenster.
    const openAbove = (coversSave && above >= desiredHeight) || (below < desiredHeight && above > below);
    const maxHeight = Math.min(180, openAbove ? above : below);
    if (maxHeight <= 0) { hideSuggestions(); return; }
    panel.style.maxHeight = `${maxHeight}px`;
    const renderedHeight = Math.min(desiredHeight, maxHeight);
    panel.style.top = `${openAbove ? Math.max(topEdge, rect.top - gap - renderedHeight) : rect.bottom + gap}px`;
  }
  function highlight(index) {
    active = index;
    [...list.children].forEach((option, position) => option.setAttribute('aria-selected', String(position === active)));
    if (active >= 0 && !list.hidden) {
      name.setAttribute('aria-activedescendant', `exercise-suggestion-${active}`);
      // Scroll uitsluitend binnen het keuzemenu, nooit het formulier.
      const option = list.children[active];
      const optionRect = option.getBoundingClientRect(), panelRect = panel.getBoundingClientRect();
      const top = optionRect.top - panelRect.top + panel.scrollTop - panel.clientTop;
      const bottom = top + optionRect.height;
      if (top < panel.scrollTop) panel.scrollTop = top;
      else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
    } else name.removeAttribute('aria-activedescendant');
  }
  function visibility() {
    const visible = showing && matches.length > 0;
    panel.hidden = !visible; list.hidden = !visible;
    name.setAttribute('aria-expanded', String(visible));
    $('exercise-suggestion-status').textContent = visible ? `${matches.length} oefensuggesties.` : '';
    positionPanel();
  }
  function hideSuggestions() {
    showing = false; pointer = null; visibility(); highlight(-1); panel.scrollTop = 0;
  }
  function choose(item) {
    name.value = item.label;
    hideSuggestions(); name.focus({ preventScroll: true });
  }
  function refresh() {
    matches = matchingExerciseSuggestions(name.value.trim(), publicNames);
    list.replaceChildren(...matches.map((item, index) => {
      const option = document.createElement('div'); option.id = `exercise-suggestion-${index}`;
      option.className = 'exercise-suggestion'; option.setAttribute('role', 'option'); option.tabIndex = -1;
      const label = document.createElement('span'); label.textContent = item.label; option.append(label);
      if (item.community) {
        const source = document.createElement('small'); source.textContent = 'Door gebruikers'; option.append(source);
      }
      // Houd een tik beschikbaar na blur, maar laat vegen door de lijst normaal werken.
      option.addEventListener('pointerdown', event => {
        if (event.button > 0 || event.isPrimary === false) return;
        suppressClick = null;
        pointer = { id: event.pointerId, option, item, x: event.clientX, y: event.clientY, scrollTop: panel.scrollTop };
      });
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => {
        if (suppressClick === option) { suppressClick = null; return; }
        choose(item);
      });
      return option;
    }));
    visibility();
    highlight(list.hidden ? -1 : Math.min(active, matches.length - 1));
  }
  function finishPointer(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const interaction = pointer; pointer = null; suppressClick = interaction.option;
    if (event.type !== 'pointercancel' && interaction.option.contains(event.target) &&
        Math.abs(event.clientX - interaction.x) < 8 && Math.abs(event.clientY - interaction.y) < 8 &&
        panel.scrollTop === interaction.scrollTop) choose(interaction.item);
    else if (document.activeElement !== name) hideSuggestions();
  }
  document.addEventListener('pointerup', finishPointer);
  document.addEventListener('pointercancel', finishPointer);
  view?.addEventListener('scroll', positionPanel, true);
  view?.addEventListener('resize', positionPanel);
  view?.visualViewport?.addEventListener('resize', positionPanel);
  view?.visualViewport?.addEventListener('scroll', positionPanel);
  name.addEventListener('input', () => { pointer = null; showing = true; active = -1; panel.scrollTop = 0; refresh(); });
  name.addEventListener('blur', () => { if (!pointer) hideSuggestions(); });
  name.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      showing = true; refresh();
      if (!matches.length) return;
      event.preventDefault();
      highlight(active < 0 ? event.key === 'ArrowDown' ? 0 : matches.length - 1 :
        (active + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
    } else if (event.key === 'Enter' && !list.hidden && active >= 0) {
      event.preventDefault(); choose(matches[active]);
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault(); event.stopPropagation(); hideSuggestions();
    } else if (event.key === 'Tab') hideSuggestions();
  });
  name.addEventListener('focus', async () => {
    if (requested) return;
    requested = true;
    try {
      publicNames = await loadSuggestions();
      if (!pointer) refresh();
    } catch { /* Offline blijven de catalogussuggesties en vrije invoer werken. */ }
  });
  return {
    open() {
      pointer = null; suppressClick = null;
      showing = false; active = -1; panel.scrollTop = 0; refresh();
    },
  };
}
