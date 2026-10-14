import { EXERCISE_CATALOG, normalizeExerciseName, resolveRankingExercise, suggestExercises } from './exercise-catalog.js';

// Een korte lijst helpt bij kiezen; vrij typen blijft altijd mogelijk.
export function matchingExerciseSuggestions(value, publicNames = [], limit = 6) {
  const query = normalizeExerciseName(value);
  if (!query) return [];
  const found = suggestExercises(value, limit).slice(0, limit).map(item => ({ key: item.key, label: item.label, community: false }));
  const seen = new Set(found.map(item => item.key));
  for (const item of publicNames) {
    if (found.length >= limit) break;
    if (typeof item.exercise_key !== 'string' || typeof item.exercise_name !== 'string' ||
        seen.has(item.exercise_key) || !normalizeExerciseName(item.exercise_name).includes(query)) continue;
    found.push({ key: item.exercise_key, label: item.exercise_name, community: true });
    seen.add(item.exercise_key);
  }
  return found;
}

// Geen getypte zoektermen naar de server: de openbare namen worden eenmaal geladen.
export function setupExerciseNames({ loadSuggestions, document = globalThis.document }) {
  const $ = id => document.getElementById(id);
  const name = $('exercise-name'), select = $('exercise-ranking');
  const panel = $('exercise-suggestion-panel'), list = $('exercise-suggestions');
  let initialKey = '', publicNames = [], requested = false, showing = false, matches = [], active = -1;
  const auto = document.createElement('option'); auto.value = '';
  select.replaceChildren(auto, ...EXERCISE_CATALOG.map(item => {
    const option = document.createElement('option'); option.value = item.key; option.textContent = item.label; return option;
  }));
  function highlight(index) {
    active = index;
    [...list.children].forEach((option, position) => option.setAttribute('aria-selected', String(position === active)));
    if (active >= 0 && !panel.hidden) {
      name.setAttribute('aria-activedescendant', `exercise-suggestion-${active}`);
      list.children[active]?.scrollIntoView?.({ block: 'nearest' });
    } else name.removeAttribute('aria-activedescendant');
  }
  function hideSuggestions() {
    showing = false; panel.hidden = true; name.setAttribute('aria-expanded', 'false'); highlight(-1);
    $('exercise-suggestion-status').textContent = '';
  }
  function choose(item) {
    name.value = item.label;
    // Een gekozen suggestie gebruikt zijn eigen herkenning, geen eerdere override.
    select.value = ''; refresh(); hideSuggestions(); name.focus();
  }
  function refresh() {
    const value = name.value.trim();
    $('exercise-ranking-options').hidden = !value;
    let automatic = value;
    if (value) {
      try {
        automatic = resolveRankingExercise({ name: value }).label;
        const resolved = resolveRankingExercise({ name: value, rankingKey: select.value || undefined });
        $('exercise-ranking-summary').textContent = `Ranglijst: ${resolved.label}`;
      } catch { $('exercise-ranking-summary').textContent = 'Naam in de ranglijst'; }
    }
    auto.textContent = value ? `Automatisch: ${automatic}` : 'Automatisch';
    matches = matchingExerciseSuggestions(value, publicNames);
    list.replaceChildren(...matches.map((item, index) => {
      const option = document.createElement('div'); option.id = `exercise-suggestion-${index}`;
      option.className = 'exercise-suggestion'; option.setAttribute('role', 'option'); option.tabIndex = -1;
      const label = document.createElement('span'); label.textContent = item.label; option.append(label);
      if (item.community) {
        const source = document.createElement('small'); source.textContent = 'Door gebruikers'; option.append(source);
      }
      // Behoud invoerfocus bij een tik; dit blokkeert het scrollen op touchscreens niet.
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choose(item));
      return option;
    }));
    panel.hidden = !showing || !matches.length;
    name.setAttribute('aria-expanded', String(!panel.hidden));
    highlight(panel.hidden ? -1 : Math.min(active, matches.length - 1));
    $('exercise-suggestion-status').textContent = panel.hidden ? '' : `${matches.length} oefensuggesties.`;
  }
  name.addEventListener('input', () => { showing = true; active = -1; refresh(); });
  name.addEventListener('blur', hideSuggestions);
  select.addEventListener('change', refresh);
  name.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      showing = true; refresh();
      if (!matches.length) return;
      event.preventDefault();
      highlight(active < 0 ? event.key === 'ArrowDown' ? 0 : matches.length - 1 :
        (active + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
    } else if (event.key === 'Enter' && !panel.hidden && active >= 0) {
      event.preventDefault(); choose(matches[active]);
    } else if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault(); event.stopPropagation(); hideSuggestions();
    } else if (event.key === 'Tab') hideSuggestions();
  });
  name.addEventListener('focus', async () => {
    if (requested) return;
    requested = true;
    try { publicNames = await loadSuggestions(); refresh(); }
    catch { /* Offline blijven de catalogussuggesties en vrije invoer werken. */ }
  });
  return {
    open(exercise) {
      initialKey = exercise?.rankingKey || ''; select.value = initialKey;
      showing = false; active = -1;
      $('exercise-ranking-options').open = false; refresh();
    },
    getRankingKey: () => select.value || undefined,
    hasChanged: () => select.value !== initialKey,
  };
}
