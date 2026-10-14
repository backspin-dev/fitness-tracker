import { listRecoveryBackups, loadRecoveryBackup } from './data.js';

export function setupRecovery({ canEdit, canPreserveCurrent, confirmAction, restoreState, toast }) {
  const $ = id => document.getElementById(id);
  const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
  const labels = { daily: 'Automatische dagkopie', import: 'Vóór importeren', restore: 'Vóór terugzetten' };
  let busy = false, refreshVersion = 0;
  async function refresh() {
    const version = ++refreshVersion;
    try {
      const copies = await listRecoveryBackups();
      if (version !== refreshVersion) return;
      $('recovery-status').textContent = copies.length
        ? `Laatste automatische kopie: ${dateFormat.format(new Date(copies[0].createdAt))}. ${copies.length} van maximaal 7 kopieën op dit apparaat.`
        : 'Je eerste wijziging maakt automatisch een lokale kopie.';
      const rows = copies.map(copy => {
        const button = document.createElement('button'); button.className = 'history-item';
        const text = document.createElement('div'), title = document.createElement('strong'), subtitle = document.createElement('small');
        title.textContent = dateFormat.format(new Date(copy.createdAt)); subtitle.textContent = labels[copy.reason];
        text.append(title, subtitle); const action = document.createElement('span'); action.textContent = '›'; button.append(text, action);
        button.setAttribute('aria-label', `${labels[copy.reason]} van ${title.textContent} terugzetten`);
        button.disabled = !canEdit() || busy;
        button.onclick = async () => {
          if (!canEdit() || busy) return;
          busy = true; $('recovery-error').hidden = true;
          try {
            const snapshot = await loadRecoveryBackup(copy.id);
            if (!snapshot) throw new Error('Deze kopie is niet meer beschikbaar. Open de lijst opnieuw.');
            const explanation = canPreserveCurrent() ? 'De huidige opgeslagen gegevens blijven als herstelkopie beschikbaar.' : 'Daarmee vervang je de huidige onleesbare invoer.';
            if (!await confirmAction('Lokale kopie terugzetten?', `Je gaat terug naar ${title.textContent}. ${explanation}`, 'Terugzetten')) return;
            if (await restoreState(snapshot)) toast('Lokale kopie teruggezet.');
          } catch (error) { $('recovery-error').textContent = error.message; $('recovery-error').hidden = false; }
          finally { busy = false; await refresh(); }
        };
        return button;
      });
      $('recovery-list').replaceChildren(...rows);
      $('recovery-copies').hidden = !copies.length;
    } catch {
      if (version === refreshVersion) $('recovery-status').textContent = 'Lokale kopieën konden niet worden geladen. Je kunt hieronder een JSON exporteren.';
    }
  }
  return { refresh };
}
