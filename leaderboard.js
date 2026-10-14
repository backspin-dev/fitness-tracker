// Alleen een openbare naam en totaalscore verlaten het toestel, na expliciet meedoen.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      const sets = exercise.sets ?? 1;
      if (!Number.isInteger(exercise.reps) || exercise.reps < 0 || exercise.reps > 999 || !Number.isInteger(sets) || sets < 1 || sets > 99) {
        throw new Error('Deze training bevat ongeldige sets of reps.');
      }
      total += sets * exercise.reps;
    }
  }
  return score(total);
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
        lastTotal: Number.isSafeInteger(saved.lastTotal) ? saved.lastTotal : null,
        lastName: typeof saved.lastName === 'string' ? saved.lastName : null };
    }
  } catch { /* Onbekende of beschadigde deelname start zonder netwerkverzoeken. */ }

  function persist(next) {
    try {
      if (!storage) throw new Error();
      storage.setItem(storageKey, JSON.stringify(next));
    } catch { throw new Error('Deelname kan niet op dit toestel worden bewaard. Je trainingen blijven lokaal beschikbaar.'); }
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
        const error = new Error(response.status === 429 ? 'Even te veel verzoeken. Probeer de ranglijst later opnieuw.' : 'De ranglijst is nu niet bereikbaar. Probeer later opnieuw.');
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
    if (participant.requiresRejoin) throw new Error('Deze deelname is verlopen. Tik op Opnieuw meedoen om verder te gaan.');
    if (!participant.session) return receivedSession(await request('/auth/v1/signup', { method: 'POST', body: { data: {} } }));
    if (!forceRefresh && participant.session.expires_at > now() / 1000 + 60) return participant.session;
    try {
      return receivedSession(await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: participant.session.refresh_token },
      }));
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) {
        persist({ ...participant, session: null, requiresRejoin: true });
        throw new Error('Deze deelname is verlopen. Tik op Opnieuw meedoen om verder te gaan.');
      }
      throw error;
    }
  }
  async function publish(total, force = false) {
    score(total);
    if (!participant || participant.active === false || participant.pendingLeave || !config) return { skipped: true };
    if (!force && participant.lastTotal === total && participant.lastName === participant.name) return { skipped: true };
    let identity = await session();
    const body = { p_display_name: participant.name, p_total_reps: total };
    try {
      await request('/rest/v1/rpc/fitness_submit_score', { method: 'POST', token: identity.access_token, body });
    } catch (error) {
      if (error.status !== 401) throw error;
      identity = await session(true);
      await request('/rest/v1/rpc/fitness_submit_score', { method: 'POST', token: identity.access_token, body });
    }
    persist({ ...participant, lastName: participant.name, lastTotal: total });
    return { skipped: false, total };
  }
  async function deactivate() {
    if (!participant?.pendingLeave) return { skipped: true };
    // Een afgebroken eerste aanmelding zonder sessie kan nog geen score hebben verstuurd.
    if (participant.session || participant.requiresRejoin) {
      let identity = await session();
      try {
        await request('/rest/v1/rpc/fitness_leave_score', { method: 'POST', token: identity.access_token, body: {} });
      } catch (error) {
        if (error.status !== 401) throw error;
        identity = await session(true);
        await request('/rest/v1/rpc/fitness_leave_score', { method: 'POST', token: identity.access_token, body: {} });
      }
    }
    persist({ ...participant, active: false, pendingLeave: false });
    return { skipped: false, left: true };
  }
  return {
    configured: !!config,
    isJoined: () => participant !== null && participant.active !== false,
    hasPendingLeave: () => participant?.pendingLeave === true,
    requiresRejoin: () => participant?.requiresRejoin === true,
    getDisplayName: () => participant?.name ?? '',
    getLastTotal: () => participant?.lastTotal ?? null,
    join(name, total) {
      return serial(async () => {
        if (!config) throw new Error('De ranglijst is nog niet aangesloten.');
        const normalized = normalizeDisplayName(name); score(total);
        persist({ version: 1, consented: true, name: normalized,
          session: participant?.requiresRejoin ? null : participant?.session ?? null,
          requiresRejoin: false, active: true, pendingLeave: false,
          lastName: participant?.lastName ?? null, lastTotal: participant?.lastTotal ?? null });
        return publish(total, true);
      });
    },
    sync(total) { return serial(() => participant?.pendingLeave ? deactivate() : publish(total)); },
    leave() {
      return serial(async () => {
        if (!participant) return { skipped: true };
        // Eerst lokaal stoppen: ook bij netwerkuitval wordt nooit weer vanzelf gepubliceerd.
        persist({ ...participant, active: false, pendingLeave: true });
        return deactivate();
      });
    },
    async getScores() {
      const rows = await request('/rest/v1/fitness_scores?select=display_name,total_reps,updated_at&order=total_reps.desc,updated_at.asc&limit=50');
      if (!Array.isArray(rows) || rows.length > 50) throw new Error('De ranglijst gaf een ongeldig antwoord.');
      return rows.map(row => ({ display_name: normalizeDisplayName(row.display_name), total_reps: score(row.total_reps),
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : '' }));
    },
  };
}
