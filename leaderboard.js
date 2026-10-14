// Na naambevestiging worden alleen alias, ranglijstoefeningen, totale reps en zwaarste gewicht gedeeld.
import { EXERCISE_CATALOG, normalizeExerciseName, resolveRankingExercise } from './exercise-catalog.js';
import { getExerciseSets } from './data.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCORE_MODE = 'exercise-v2';

export function normalizeDisplayName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
  if (!name || [...name].length > 24 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new Error('Kies een naam van 1 tot 24 tekens.');
  }
  return name;
}

function score(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Deze totaalscore is ongeldig.');
  return value;
}

function maxWeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 2000) {
    throw new Error('Dit zwaarste gewicht is ongeldig.');
  }
  return value;
}

function exerciseReps(exercise) {
  // Oude berekeningen konden alleen reps bevatten; gewicht beïnvloedt deze score nooit.
  return getExerciseSets({ weight: 0, ...exercise }).reduce((total, set) => total + set.reps, 0);
}

export function totalSavedReps(state, today) {
  const date = new Date(`${today}T00:00:00Z`);
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== today) {
    throw new Error('Gebruik een geldige datum.');
  }
  let total = 0;
  for (const [key, exercises] of Object.entries(state.sessions ?? {})) {
    const match = /^(\d{4}-\d{2}-\d{2}):[^:]+$/.exec(key);
    if (!match || match[1] > today || !Array.isArray(exercises)) continue;
    for (const exercise of exercises) {
      total += exerciseReps(exercise);
    }
  }
  return score(total);
}

export function aggregateExerciseScores(state, today) {
  totalSavedReps(state, today); // Dezelfde datum-, sets- en repsvalidatie; routines tellen nooit mee.
  const totals = new Map(), latest = new Map();
  const workouts = Object.entries(state.sessions ?? {}).filter(([key, exercises]) => {
    const match = /^(\d{4}-\d{2}-\d{2}):[^:]+$/.exec(key);
    return match && match[1] <= today && Array.isArray(exercises);
  }).sort(([a], [b]) => a.localeCompare(b));
  const identity = (key, exercise, index) => exercise.id ? `${key.slice(11)}:${exercise.id}` : `${key}:${index}`;
  for (const [key, exercises] of workouts) exercises.forEach((exercise, index) => latest.set(identity(key, exercise, index), exercise));
  for (const [key, exercises] of workouts) {
    for (const [index, exercise] of exercises.entries()) {
      const { key: exerciseKey, label } = resolveRankingExercise(latest.get(identity(key, exercise, index)));
      const item = totals.get(exerciseKey) ?? { exercise_key: exerciseKey, exercise_name: label, total_reps: 0, max_weight: 0 };
      for (const set of getExerciseSets({ weight: 0, ...exercise })) {
        item.total_reps = score(item.total_reps + set.reps);
        if (set.reps > 0) item.max_weight = Math.max(item.max_weight, maxWeight(set.weight));
      }
      totals.set(exerciseKey, item);
    }
  }
  return [...totals.values()].sort((a, b) => a.exercise_key.localeCompare(b.exercise_key));
}

function checkedScores(values) {
  if (!Array.isArray(values) || values.length > 5000) throw new Error('Deze oefenscores zijn ongeldig.');
  const totals = new Map();
  for (const value of values) {
    if (!value || typeof value.exercise_key !== 'string' || typeof value.exercise_name !== 'string' ||
        !value.exercise_name.trim() || value.exercise_name.length > 4096 || value.exercise_key.length > 4096 ||
        /\p{Cc}/u.test(value.exercise_name)) throw new Error('Deze ranglijstoefening is ongeldig.');
    const known = EXERCISE_CATALOG.find(item => item.key === value.exercise_key);
    if (!known && value.exercise_key !== `custom:${normalizeExerciseName(value.exercise_name)}`) throw new Error('Deze ranglijstoefening is ongeldig.');
    const resolved = resolveRankingExercise({ name: value.exercise_name, ...(known ? { rankingKey: known.key } : {}) });
    const item = totals.get(resolved.key) ?? { exercise_key: resolved.key, exercise_name: resolved.label, total_reps: 0, max_weight: 0 };
    item.total_reps = score(item.total_reps + score(value.total_reps));
    item.max_weight = Math.max(item.max_weight, maxWeight(value.max_weight));
    totals.set(resolved.key, item);
  }
  return [...totals.values()].sort((a, b) => a.exercise_key.localeCompare(b.exercise_key));
}

function publicExercise(row) {
  if (typeof row?.exercise_key !== 'string' || !/^(?:ex:|custom:).+$/u.test(row.exercise_key) || row.exercise_key.length > 4096 ||
      typeof row.exercise_name !== 'string' || !row.exercise_name.trim() || row.exercise_name.length > 4096 || /\p{Cc}/u.test(row.exercise_name)) {
    throw new Error('De ranglijst gaf een ongeldige oefening.');
  }
  return { exercise_key: row.exercise_key, exercise_name: row.exercise_name };
}

function publicConfig(url, key) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || typeof key !== 'string' || !key) return null;
    if (key.startsWith('sb_secret_')) return null;
    if (!key.startsWith('sb_publishable_')) {
      // Een legacy JWT moet expliciet de openbare anon-rol hebben.
      const payload = JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') return null;
    }
    return { url: parsed.origin, key };
  } catch { return null; }
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function checkedSession(session) {
  if (!session || typeof session.access_token !== 'string' || !session.access_token ||
      typeof session.refresh_token !== 'string' || !session.refresh_token || !UUID.test(session.user?.id ?? '') ||
      !Number.isFinite(session.expires_at)) return null;
  return { access_token: session.access_token, refresh_token: session.refresh_token,
    expires_at: session.expires_at, user: { id: session.user.id } };
}

export function createLeaderboardClient({ url, anonKey, fetchImpl = globalThis.fetch, storage = browserStorage(), now = () => Date.now() } = {}) {
  const config = publicConfig(url, anonKey);
  const storageKey = `fitness-tracker:leaderboard:v1:${config?.url ?? 'disabled'}`;
  let participant = null, queue = Promise.resolve();
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) ?? 'null');
    if (saved?.version === 1 && saved.consented === true) {
      const restoredSession = checkedSession(saved.session);
      participant = { version: 1, consented: true, name: normalizeDisplayName(saved.name),
        session: restoredSession, requiresRejoin: saved.requiresRejoin === true || (!!saved.session && !restoredSession),
        active: saved.active !== false, pendingLeave: saved.pendingLeave === true,
        scoreMode: ['exercise-v1', SCORE_MODE].includes(saved.scoreMode) ? saved.scoreMode : null,
        lastFingerprint: typeof saved.lastFingerprint === 'string' ? saved.lastFingerprint : null,
        lastTotal: Number.isSafeInteger(saved.lastTotal) ? saved.lastTotal : null,
        lastName: typeof saved.lastName === 'string' ? saved.lastName : null };
    }
  } catch { /* Onbekende of beschadigde deelname start zonder netwerkverzoeken. */ }

  function persist(next) {
    try {
      if (!storage) throw new Error();
      storage.setItem(storageKey, JSON.stringify(next));
    } catch { throw new Error('Je naam kan niet op dit toestel worden bewaard. Je trainingen blijven lokaal beschikbaar.'); }
    participant = next;
  }
  function serial(run) {
    const pending = queue.then(run);
    queue = pending.catch(() => {});
    return pending;
  }
  async function request(path, { method = 'GET', body, token } = {}) {
    if (!config) throw new Error('De ranglijst is nog niet aangesloten.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = { apikey: config.key };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetchImpl(`${config.url}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit', cache: 'no-store', signal: controller.signal,
      });
      const text = await response.text();
      let data = null;
      try { if (text) data = JSON.parse(text); } catch { /* Een proxyfout kan HTML bevatten. */ }
      if (!response.ok) {
        const message = response.status === 403 && data?.code === 'PT403' ?
          'Deelname aan de ranglijst is geblokkeerd. Je trainingen blijven lokaal beschikbaar.' :
          response.status === 429 ? 'Even te veel verzoeken. Probeer de ranglijst later opnieuw.' : 'De ranglijst is nu niet bereikbaar. Probeer later opnieuw.';
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.status) throw error;
      throw new Error('Geen verbinding met de ranglijst. Je trainingen worden gewoon lokaal bewaard.');
    } finally { clearTimeout(timer); }
  }
  function receivedSession(data) {
    const session = checkedSession({ ...data, expires_at: data?.expires_at ?? Math.floor(now() / 1000) + data?.expires_in });
    if (!session) throw new Error('Deelname kon niet worden bevestigd. Probeer opnieuw.');
    if (participant.session && participant.session.user.id !== session.user.id) throw new Error('De deelname is veranderd. Probeer opnieuw.');
    persist({ ...participant, session });
    return session;
  }
  async function session(forceRefresh = false) {
    if (participant.requiresRejoin) throw new Error('De verbinding is verlopen. Bewaar je naam opnieuw om verder te gaan.');
    if (!participant.session) return receivedSession(await request('/auth/v1/signup', { method: 'POST', body: { data: {} } }));
    if (!forceRefresh && participant.session.expires_at > now() / 1000 + 60) return participant.session;
    try {
      return receivedSession(await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: participant.session.refresh_token },
      }));
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) {
        persist({ ...participant, session: null, requiresRejoin: true });
        throw new Error('De verbinding is verlopen. Bewaar je naam opnieuw om verder te gaan.');
      }
      throw error;
    }
  }
  async function publish(values, force = false) {
    const scores = checkedScores(values);
    if (!participant || participant.scoreMode !== SCORE_MODE || participant.active === false || participant.pendingLeave || !config) return { skipped: true };
    const fingerprint = JSON.stringify({ name: participant.name, scores });
    if (!force && participant.lastFingerprint === fingerprint) return { skipped: true };
    let identity = await session();
    const body = { p_display_name: participant.name, p_scores: scores };
    try {
      await request('/rest/v1/rpc/fitness_submit_exercise_scores', { method: 'POST', token: identity.access_token, body });
    } catch (error) {
      if (error.status !== 401) throw error;
      identity = await session(true);
      await request('/rest/v1/rpc/fitness_submit_exercise_scores', { method: 'POST', token: identity.access_token, body });
    }
    persist({ ...participant, lastName: participant.name, lastTotal: scores.reduce((sum, item) => sum + item.total_reps, 0), lastFingerprint: fingerprint });
    return { skipped: false, scores };
  }
  async function deactivate() {
    if (!participant?.pendingLeave) return { skipped: true };
    // Een afgebroken eerste aanmelding zonder sessie kan nog geen score hebben verstuurd.
    if (participant.session || participant.requiresRejoin) {
      let identity = await session();
      try {
        await request('/rest/v1/rpc/fitness_leave_exercise_scores', { method: 'POST', token: identity.access_token, body: {} });
      } catch (error) {
        if (error.status !== 401) throw error;
        identity = await session(true);
        await request('/rest/v1/rpc/fitness_leave_exercise_scores', { method: 'POST', token: identity.access_token, body: {} });
      }
    }
    persist({ ...participant, active: false, pendingLeave: false });
    return { skipped: false, left: true };
  }
  return {
    configured: !!config,
    isJoined: () => participant !== null && participant.scoreMode === SCORE_MODE && participant.active !== false,
    canStopSharing: () => participant !== null && participant.active !== false,
    hasPendingLeave: () => participant?.pendingLeave === true,
    requiresRejoin: () => participant?.requiresRejoin === true,
    getDisplayName: () => participant?.name ?? '',
    getLastTotal: () => participant?.lastTotal ?? null,
    join(name, values) {
      return serial(async () => {
        if (!config) throw new Error('De ranglijst is nog niet aangesloten.');
        const normalized = normalizeDisplayName(name), scores = checkedScores(values);
        persist({ version: 1, consented: true, name: normalized,
          session: participant?.requiresRejoin ? null : participant?.session ?? null,
          requiresRejoin: false, active: true, pendingLeave: false, scoreMode: SCORE_MODE,
          lastName: participant?.lastName ?? null, lastTotal: participant?.lastTotal ?? null,
          lastFingerprint: participant?.lastFingerprint ?? null });
        return publish(scores, true);
      });
    },
    sync(scores) { return serial(() => participant?.pendingLeave ? deactivate() : publish(scores)); },
    leave() {
      return serial(async () => {
        if (!participant) return { skipped: true };
        // Eerst lokaal stoppen: ook bij netwerkuitval wordt nooit weer vanzelf gepubliceerd.
        persist({ ...participant, active: false, pendingLeave: true });
        return deactivate();
      });
    },
    async getExercises() {
      const rows = await request('/rest/v1/fitness_available_exercises?select=exercise_key,exercise_name&order=exercise_name.asc&limit=1000');
      if (!Array.isArray(rows) || rows.length > 1000) throw new Error('De ranglijst gaf een ongeldig antwoord.');
      return [...new Map(rows.map(row => { const item = publicExercise(row); return [item.exercise_key, item]; })).values()];
    },
    async getScores(exerciseKey, metric = 'reps') {
      if (typeof exerciseKey !== 'string' || !/^(?:ex:|custom:).+$/u.test(exerciseKey) || exerciseKey.length > 4096) throw new Error('Kies een oefening.');
      if (!['reps', 'weight'].includes(metric)) throw new Error('Kies een geldige highscore.');
      const filter = encodeURIComponent(JSON.stringify(exerciseKey));
      // IN ondersteunt gequote waarden met : , () expliciet; EQ behandelt quotes letterlijk.
      const ordering = metric === 'weight' ? 'max_weight.desc.nullslast' : 'total_reps.desc';
      const knownWeight = metric === 'weight' ? '&max_weight=not.is.null' : '';
      const rows = await request(`/rest/v1/fitness_exercise_scores?select=exercise_key,exercise_name,display_name,total_reps,max_weight,updated_at&exercise_key=in.(${filter})${knownWeight}&order=${ordering},updated_at.asc&limit=50`);
      if (!Array.isArray(rows) || rows.length > 50) throw new Error('De ranglijst gaf een ongeldig antwoord.');
      return rows.map(row => {
        if (row.exercise_key !== exerciseKey) throw new Error('De ranglijst gaf een andere oefening terug.');
        if (metric === 'weight' && row.max_weight === null) throw new Error('De ranglijst gaf een ongeldig gewicht.');
        return { ...publicExercise(row), display_name: normalizeDisplayName(row.display_name), total_reps: score(row.total_reps),
          max_weight: row.max_weight === null ? null : maxWeight(row.max_weight),
          updated_at: typeof row.updated_at === 'string' ? row.updated_at : '' };
      });
    },
  };
}
