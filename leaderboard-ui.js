import { localDate } from './data.js';
import { createLeaderboardClient, totalSavedReps } from './leaderboard.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './leaderboard-config.js';

// Afzonderlijk van de lokale opslagflow: een netwerkfout mag opslaan nooit blokkeren.
export function renderLeaderboardRows(container, scores) {
  const document = container.ownerDocument;
  const number = new Intl.NumberFormat('nl-NL');
  const rows = scores.map((score, index) => {
    const row = document.createElement('div'); row.className = 'comparison-row';
    const name = document.createElement('strong'); name.textContent = `${index + 1}. ${score.display_name}`;
    const value = document.createElement('span'); value.textContent = `${number.format(score.total_reps)} reps`;
    row.append(name, value); return row;
  });
  if (!rows.length) {
    const empty = document.createElement('p'); empty.className = 'settings-copy';
    empty.textContent = 'Nog geen scores. Doe mee met de eerste training.'; rows.push(empty);
  }
  container.replaceChildren(...rows);
}

export function setupLeaderboard({ getState, canEdit, toast }) {
  const client = createLeaderboardClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
  const number = new Intl.NumberFormat('nl-NL');
  let saving = false, loading = false, syncTimer;
  const node = (tag, text, className) => {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  };
  const dialog = node('dialog'); dialog.id = 'leaderboard-dialog'; dialog.className = 'progress-dialog';
  dialog.setAttribute('aria-labelledby', 'leaderboard-title');
  const heading = node('div', undefined, 'dialog-heading'), title = node('h2', 'Ranglijst'); title.id = 'leaderboard-title';
  const close = node('button', '×', 'icon-button'); close.type = 'button'; close.setAttribute('aria-label', 'Sluiten');
  close.onclick = () => dialog.close(); heading.append(title, close);
  const intro = node('p', 'Hoeveel reps heb je in totaal gedaan? Tel mee met je opgeslagen sets × reps.', 'settings-copy');
  const own = node('div', undefined, 'summary-tile');
  const ownTotal = node('strong'), ownLabel = node('span'); own.append(ownTotal, ownLabel);
  const form = node('form');
  const label = node('label', 'Jouw naam', 'field-label'); label.htmlFor = 'leaderboard-name';
  const name = node('input', undefined, 'text-input'); name.id = 'leaderboard-name'; name.type = 'text'; name.maxLength = 24;
  name.required = true; name.autocomplete = 'nickname'; name.placeholder = 'Kies een bijnaam'; name.value = client.getDisplayName();
  const privacy = node('p', 'Je naam en totaalscore zijn openbaar. Meedoen werkt per toestel. Je volledige trainingslogboek blijft lokaal.', 'chart-note');
  const submit = node('button', 'Meedoen', 'primary full'); submit.type = 'submit';
  const stop = node('button', 'Stoppen met delen', 'secondary full'); stop.type = 'button';
  const status = node('p', '', 'chart-note'); status.setAttribute('role', 'status');
  const error = node('p', '', 'field-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  form.append(label, name, privacy, submit, stop, status, error);
  const boardHeading = node('h3', 'Top 50 · totaal reps', 'small-heading');
  const rows = node('div'); rows.id = 'leaderboard-list';
  const refresh = node('button', 'Vernieuwen', 'secondary full'); refresh.type = 'button';
  const note = node('p', 'Een speelse ranglijst met zelf ingevulde scores. Namen kunnen vaker voorkomen. Gewicht en uitvoering worden niet vergeleken.', 'chart-note');
  const identity = node('p', 'Wissel je van toestel of wis je websitegegevens? Dan geldt opnieuw meedoen als een nieuwe deelnemer, ook met dezelfde naam.', 'chart-note');
  dialog.append(heading, intro, own, form, boardHeading, rows, refresh, note, identity); document.body.append(dialog);
  function total() { return totalSavedReps(getState(), localDate()); }
  function controls() {
    name.disabled = submit.disabled = !canEdit() || saving || !client.configured;
    stop.hidden = !client.isJoined() && !client.hasPendingLeave();
    stop.disabled = !canEdit() || saving || !client.configured;
    stop.textContent = client.hasPendingLeave() ? 'Stoppen opnieuw proberen' : 'Stoppen met delen';
    refresh.disabled = loading || !client.configured;
    submit.textContent = saving ? 'Even bewaren…' : client.requiresRejoin() ? 'Opnieuw meedoen' : client.isJoined() ? 'Naam bewaren' : 'Meedoen';
    ownTotal.textContent = `${number.format(total())} reps`;
    ownLabel.textContent = client.isJoined() ? `${client.getDisplayName()} · jouw totaal op dit toestel` : 'Jouw totaal op dit toestel';
    if (!client.configured) status.textContent = 'De ranglijst wordt nog aangesloten. Je eigen totaalscore staat hierboven.';
  }
  function failed(cause) { error.textContent = cause.message || 'De ranglijst is nu niet bereikbaar.'; error.hidden = false; }
  async function load() {
    if (!client.configured || loading) return;
    loading = true; controls();
    try { renderLeaderboardRows(rows, await client.getScores()); }
    catch (cause) { failed(cause); }
    finally { loading = false; controls(); }
  }
  async function sync() {
    if (!client.configured || (!client.isJoined() && !client.hasPendingLeave()) || !canEdit() || saving) return;
    const stopping = client.hasPendingLeave();
    if (stopping) { saving = true; controls(); }
    try {
      const result = await client.sync(total());
      if (dialog.open) {
        error.hidden = true; status.textContent = result.left ? 'Je naam en score zijn verborgen.' : 'Je actuele totaalscore staat online.'; controls(); await load();
      }
    } catch (cause) {
      if (dialog.open) { failed(cause); status.textContent = client.hasPendingLeave() ? 'Stoppen is lokaal bewaard. Je naam en score worden verborgen zodra er verbinding is.' : 'Je lokale trainingen zijn bewaard. De score wordt later opnieuw geprobeerd.'; controls(); }
    } finally { if (stopping) { saving = false; controls(); } }
  }
  function onSaved() {
    if (!client.configured || (!client.isJoined() && !client.hasPendingLeave()) || !canEdit()) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(() => { void sync(); }, 3000);
  }
  form.onsubmit = async event => {
    event.preventDefault(); if (!canEdit() || saving || !client.configured) return;
    saving = true; error.hidden = true; status.textContent = ''; controls();
    try {
      await client.join(name.value, total()); name.value = client.getDisplayName();
      status.textContent = 'Je totaalscore wordt vanaf nu automatisch bijgewerkt.'; toast('Naam en score bewaard.');
      await load();
    } catch (cause) { failed(cause); }
    finally { saving = false; controls(); onSaved(); }
  };
  stop.onclick = async () => {
    if (!canEdit() || saving || !client.configured) return;
    saving = true; error.hidden = true; status.textContent = ''; controls();
    try {
      await client.leave(); status.textContent = 'Je naam en score zijn verborgen. Je kunt later weer meedoen.';
      toast('Gestopt met delen.'); await load();
    } catch (cause) {
      failed(cause); status.textContent = 'Stoppen is lokaal bewaard. Je naam en score worden verborgen zodra er verbinding is.';
    } finally { saving = false; controls(); onSaved(); }
  };
  refresh.onclick = async () => { error.hidden = true; await sync(); await load(); };
  const button = document.getElementById('leaderboard-button');
  if (button) button.onclick = () => {
    name.value = client.getDisplayName(); error.hidden = true;
    status.textContent = client.hasPendingLeave() ? 'Stoppen wordt opnieuw geprobeerd zodra er verbinding is.' : client.isJoined() ? 'Je totaalscore wordt tijdens gebruik automatisch bijgewerkt.' : 'Vul een naam in en tik op Meedoen.';
    controls(); dialog.showModal(); void load(); void sync();
  };
  globalThis.addEventListener('online', onSaved);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onSaved(); });
  return { onSaved };
}
