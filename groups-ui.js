import { applyPreset, addGroup, renameGroup, setGroupArchived } from './data.js';

export function setupGroups({ getState, canEdit, changeState, confirmAction, toast }) {
  const $ = id => document.getElementById(id);
  const saveError = 'Je wijzigingen zijn nog niet opgeslagen. Ze staan wel op dit scherm. Maak via Instellingen een back-up voordat je de app sluit.';
  let renameId = null, busy = false;
  function element(tag, text, className) {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  async function apply(makeState, options = {}) {
    if (!canEdit() || busy) return false;
    busy = true; $('groups-error').hidden = true;
    try {
      const saved = await changeState(makeState(getState()), options);
      if (!saved) { $('groups-error').textContent = saveError; $('groups-error').hidden = false; }
      render(); return saved;
    } catch (error) {
      $('groups-error').textContent = error.message; $('groups-error').hidden = false; return false;
    } finally { busy = false; }
  }
  function render() {
    const state = getState(), activeCount = state.groups.filter(group => !group.archived).length;
    const active = [], hidden = [];
    for (const group of state.groups) {
      const row = element('div', '', 'group-row');
      row.append(element('span', group.name, 'group-label'));
      const controls = element('div', '', 'group-actions');
      if (!group.archived) {
        const rename = element('button', 'Naam', 'text-button');
        rename.setAttribute('aria-label', `${group.name} hernoemen`); rename.disabled = !canEdit();
        rename.onclick = () => {
          if (!canEdit() || busy) return;
          renameId = group.id; $('rename-group-name').value = group.name; $('rename-group-error').hidden = true;
          $('rename-group-dialog').showModal(); $('rename-group-name').focus();
        };
        controls.append(rename);
      }
      const archive = element('button', group.archived ? 'Terugzetten' : 'Verbergen', 'text-button');
      archive.setAttribute('aria-label', `${group.name} ${group.archived ? 'terugzetten' : 'verbergen'}`);
      archive.disabled = !canEdit() || (!group.archived && activeCount === 1);
      archive.onclick = () => apply(state => setGroupArchived(state, group.id, !group.archived), { selectFromState: true });
      controls.append(archive); row.append(controls); (group.archived ? hidden : active).push(row);
    }
    $('group-list').replaceChildren(...active); $('hidden-group-list').replaceChildren(...hidden);
    $('hidden-groups').hidden = !hidden.length;
    $('group-name').disabled = !canEdit(); $('group-form').querySelector('button').disabled = !canEdit();
    document.querySelectorAll('[data-preset]').forEach(button => { button.disabled = !canEdit(); });
  }
  $('groups-button').onclick = () => { $('groups-error').hidden = true; render(); $('groups-dialog').showModal(); };
  document.querySelectorAll('[data-preset]').forEach(button => {
    button.onclick = async () => {
      if (!canEdit() || busy) return;
      if (!await confirmAction('Schema gebruiken?', `${button.textContent} wordt je actieve indeling. Andere onderdelen worden verborgen; hun oefeningen en eerdere trainingen blijven bewaard.`, 'Gebruiken')) return;
      if (await apply(state => applyPreset(state, button.dataset.preset), { selectFromState: true, today: true })) {
        $('groups-dialog').close(); toast('Je schema staat klaar.');
      }
    };
  });
  $('group-form').onsubmit = async event => {
    event.preventDefault();
    const name = $('group-name').value.trim();
    if (await apply(state => addGroup(state, { id: `g-${crypto.randomUUID()}`, name }), { selectFromState: true, today: true })) {
      $('group-name').value = ''; toast('Onderdeel toegevoegd.');
    }
  };
  $('rename-group-form').onsubmit = async event => {
    event.preventDefault(); if (!canEdit() || busy || !renameId) return;
    busy = true; $('rename-group-error').hidden = true;
    try {
      const next = renameGroup(getState(), renameId, $('rename-group-name').value.trim());
      if (await changeState(next)) { $('rename-group-dialog').close(); render(); }
      else { $('rename-group-error').textContent = saveError; $('rename-group-error').hidden = false; }
    } catch (error) { $('rename-group-error').textContent = error.message; $('rename-group-error').hidden = false; }
    finally { busy = false; }
  };
  return { render };
}
