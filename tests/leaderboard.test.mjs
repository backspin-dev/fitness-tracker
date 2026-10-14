import test from 'node:test';
import assert from 'node:assert/strict';
import { totalSavedReps, aggregateExerciseScores, normalizeDisplayName, createLeaderboardClient } from '../leaderboard.js';
import { renderLeaderboardRows, setupLeaderboard } from '../leaderboard-ui.js';
import { setupProgress } from '../progress-ui.js';

const url = 'https://example.supabase.co', anonKey = 'sb_publishable_test';
const S = total => [{ exercise_key: 'ex:squat', exercise_name: 'Squat', total_reps: total }];
const userId = '11111111-1111-4111-8111-111111111111';
const identity = (overrides = {}) => ({ access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 5000, user: { id: userId }, ...overrides });
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values }; };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function fixture(responses, options = {}) {
  const calls = [], storage = options.storage ?? memory();
  const fetchImpl = async (address, init) => {
    calls.push({ url: address, ...init });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (response === undefined) throw new Error('Unexpected request');
    return typeof response === 'function' ? response(address, init) : response;
  };
  return { calls, storage, client: createLeaderboardClient({ url, anonKey, fetchImpl, storage, now: () => 1000000, ...options }) };
}

test('score totals use only saved exercises up to today, multiply sets and retain old one-set data', () => {
  const input = { routines: { push: [{ reps: 999, sets: 99 }] }, sessions: {
    '2026-10-01:push': [{ reps: 12, sets: 3 }, { reps: 10 }],
    '2026-10-02:pull': [{ reps: 8, sets: 4 }, { reps: 0, sets: 99 }],
    '2026-10-02:hidden-group': [{ reps: 10, sets: 2 }],
    '2026-10-02:empty': [], '2026-10-03:push': [{ reps: 999, sets: 99 }],
  } };
  const before = JSON.stringify(input);
  assert.equal(totalSavedReps(input, '2026-10-02'), 98);
  assert.equal(totalSavedReps({}, '2026-10-02'), 0);
  assert.equal(JSON.stringify(input), before);
  input.sessions['2026-10-02:pull'][0] = { reps: 10, sets: 3 };
  assert.equal(totalSavedReps(input, '2026-10-02'), 96); // vervangt; geen optelling van wijzigingen
  assert.throws(() => totalSavedReps(input, 'invalid'), /datum/);
  assert.throws(() => totalSavedReps({ sessions: { '2026-10-02:push': [{ reps: 12, sets: 0 }] } }, '2026-10-02'), /sets/);
});

test('exercise scores merge known aliases across groups and IDs while retaining equipment variants', () => {
  const input = { routines: { push: [{ name: 'Squat', reps: 999, sets: 99 }] }, sessions: {
    '2026-10-01:legs': [{ id: 'a', name: 'Squats', sets: 3, reps: 12 }, { id: 'b', name: 'Bench press', sets: 2, reps: 10 }],
    '2026-10-02:full': [{ id: 'c', name: 'SQUAT', reps: 10 }, { id: 'a', name: 'BenchPressMachine', sets: 3, reps: 8 }],
    '2026-10-02:push': [{ id: 'a', name: 'Bench press machine', sets: 2, reps: 8 }, { id: 'b', name: 'Dumbbell bench press', sets: 3, reps: 10 }],
    '2026-10-03:legs': [{ id: 'a', name: 'Squat', sets: 99, reps: 999 }],
  } };
  const before = JSON.stringify(input), result = aggregateExerciseScores(input, '2026-10-02');
  assert.deepEqual(result, [
    { exercise_key: 'ex:bench-press', exercise_name: 'Bench press', total_reps: 20 },
    { exercise_key: 'ex:bench-press-machine', exercise_name: 'Bench press machine', total_reps: 40 },
    { exercise_key: 'ex:dumbbell-bench-press', exercise_name: 'Dumbbell bench press', total_reps: 30 },
    { exercise_key: 'ex:squat', exercise_name: 'Squat', total_reps: 46 },
  ]);
  assert.equal(JSON.stringify(input), before);
});

test('the latest saved identity mapping classifies its full history without affecting another group', () => {
  const input = { sessions: {
    '2026-10-01:legs': [{ id: 'a', name: 'My old squat label', reps: 10, sets: 3 }],
    '2026-10-02:legs': [{ id: 'a', name: 'Squats', reps: 12, sets: 3 }],
    '2026-10-02:push': [{ id: 'a', name: 'Bench press', reps: 8, sets: 3 }],
    '2026-10-03:legs': [{ id: 'a', name: 'Deadlift', reps: 10, sets: 3 }],
  } };
  assert.deepEqual(aggregateExerciseScores(input, '2026-10-02'), [
    { exercise_key: 'ex:bench-press', exercise_name: 'Bench press', total_reps: 24 },
    { exercise_key: 'ex:squat', exercise_name: 'Squat', total_reps: 66 },
  ]);
  input.sessions['2026-10-02:legs'][0].rankingKey = 'ex:front-squat';
  assert.equal(aggregateExerciseScores(input, '2026-10-02')[1].exercise_key, 'ex:front-squat');
});

test('custom names share normalized identity, and emoji or expanded valid names lose no reps', () => {
  const expanded = '㍿'.repeat(120);
  const input = { sessions: { '2026-10-01:custom': [
    { id: 'a', name: '  My Cable Move ', reps: 12, sets: 3 },
    { id: 'b', name: 'ＭＹ-cable move', reps: 10 },
    { id: 'c', name: '🏋️', reps: 8, sets: 2 },
    { id: 'd', name: expanded, reps: 5, sets: 2 },
    { id: 'e', name: 'ß test', reps: 7, sets: 1 },
  ] } };
  const scores = aggregateExerciseScores(input, '2026-10-02');
  assert.equal(scores.find(item => item.exercise_key === 'custom:my cable move').total_reps, 46);
  assert.equal(scores.find(item => item.exercise_key === 'custom:my cable move').exercise_name, 'My cable move');
  assert.equal(scores.find(item => item.exercise_key === 'custom:🏋️').total_reps, 16);
  assert.equal(scores.find(item => item.exercise_name.length > 120).total_reps, 10);
  assert.equal(scores.find(item => item.exercise_key === 'custom:ß test').exercise_name, 'ß test');
  assert.equal(scores.reduce((sum, item) => sum + item.total_reps, 0), totalSavedReps(input, '2026-10-02'));
});

test('aliases trim whitespace, allow duplicate names and reject empty, long or hidden control names', () => {
  assert.equal(normalizeDisplayName('  Example   person  '), 'Example person');
  assert.equal(normalizeDisplayName('🏋️ Sporter'), '🏋️ Sporter');
  assert.equal(normalizeDisplayName('<b>Name</b>'), '<b>Name</b>');
  for (const value of ['', '  ', 'a'.repeat(25), 'ab\u200bcd', null]) assert.throws(() => normalizeDisplayName(value), /naam/);
});

test('an unnamed client never creates a backend user before its name is saved', async () => {
  const { client, calls } = fixture([]);
  assert.equal(client.isJoined(), false);
  assert.deepEqual(await client.sync(S(40)), { skipped: true });
  assert.deepEqual(calls, []);
});

test('only public publishable or legacy anon keys are accepted', () => {
  for (const key of ['sb_secret_never', 'invalid', `e30.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`]) {
    assert.equal(createLeaderboardClient({ url, anonKey: key }).configured, false);
  }
  assert.equal(createLeaderboardClient({ url, anonKey: `e30.${btoa(JSON.stringify({ role: 'anon' }))}.signature` }).configured, true);
  assert.equal(createLeaderboardClient({ url: 'http://example.supabase.co', anonKey }).configured, false);
});

test('joining sends only an anonymous signup then alias and aggregate, using the user JWT', async () => {
  const { client, calls, storage } = fixture([reply(identity()), reply(null)]);
  await client.join('  Example  ', S(36));
  assert.equal(client.isJoined(), true);
  assert.equal(client.getDisplayName(), 'Example');
  assert.equal(client.getLastTotal(), 36);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `${url}/auth/v1/signup`);
  assert.deepEqual(JSON.parse(calls[0].body), { data: {} });
  assert.equal(calls[0].headers.apikey, anonKey);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[1].url, `${url}/rest/v1/rpc/fitness_submit_exercise_scores`);
  assert.deepEqual(JSON.parse(calls[1].body), { p_display_name: 'Example', p_scores: S(36) });
  assert.equal(calls[1].headers.Authorization, 'Bearer access-1');
  assert.equal(calls[1].credentials, 'omit');
  assert.equal(calls[1].cache, 'no-store');
  assert.equal([...storage.values.keys()][0], `fitness-tracker:leaderboard:v1:${url}`);
});

test('changing a name keeps the same anonymous identity and unchanged scores skip writes', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null), reply(null)]);
  await client.join('First name', S(36));
  assert.deepEqual(await client.sync(S(36)), { skipped: true });
  await client.join('Second name', S(36));
  assert.equal(calls.length, 3);
  assert.equal(calls[2].headers.Authorization, 'Bearer access-1');
  assert.deepEqual(JSON.parse(calls[2].body), { p_display_name: 'Second name', p_scores: S(36) });
});

test('canonical score fingerprints ignore array order but notice changed exercises with the same grand total', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null), reply(null)]);
  const scores = [...S(36), { exercise_key: 'ex:bench-press', exercise_name: 'Bench press', total_reps: 24 }];
  await client.join('Example', scores);
  assert.deepEqual(await client.sync([...scores].reverse()), { skipped: true });
  await client.sync([...S(24), { exercise_key: 'ex:bench-press', exercise_name: 'Bench press', total_reps: 36 }]);
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[2].body).p_scores.find(item => item.exercise_key === 'ex:squat').total_reps, 24);
});

test('old global profiles preserve identity but confirm a name once before per-exercise sharing', async () => {
  const storage = memory();
  storage.setItem(`fitness-tracker:leaderboard:v1:${url}`, JSON.stringify({ version: 1, consented: true, name: 'Existing name', session: identity(), active: true, lastTotal: 36, lastName: 'Existing name' }));
  const { client, calls } = fixture([reply(null)], { storage });
  assert.equal(client.isJoined(), false);
  assert.equal(client.canStopSharing(), true);
  assert.equal(client.getDisplayName(), 'Existing name');
  assert.deepEqual(await client.sync(S(36)), { skipped: true });
  assert.equal(calls.length, 0);
  await client.join('Existing name', S(36));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, 'Bearer access-1');
  assert.equal(client.isJoined(), true);
  assert.equal(JSON.parse([...storage.values.values()][0]).scoreMode, 'exercise-v1');
});

test('legacy API profiles can be hidden without publishing exercise names', async () => {
  const storage = memory();
  storage.setItem(`fitness-tracker:leaderboard:v1:${url}`, JSON.stringify({ version: 1, consented: true, name: 'Existing name', session: identity(), active: true }));
  const { client, calls } = fixture([reply(null)], { storage });
  await client.leave();
  assert.equal(client.isJoined(), false);
  assert.equal(client.canStopSharing(), false);
  assert.match(calls[0].url, /fitness_leave_exercise_scores$/);
  assert.deepEqual(JSON.parse(calls[0].body), {});
});

test('submission payload contains only alias and per-exercise aggregates, never private record fields', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null)]);
  await client.join('Example', [{ ...S(36)[0], date: '2026-10-01', weight: 99, sets: 3, bodyWeights: { private: 80 }, id: 'local-private-id' }]);
  const body = JSON.parse(calls[1].body);
  assert.deepEqual(body, { p_display_name: 'Example', p_scores: S(36) });
  assert(!calls[1].body.includes('private'));
  await assert.rejects(client.join('Example', [{ exercise_key: 'ex:made-up', exercise_name: 'Squat', total_reps: 36 }]), /ranglijstoefening/);
});

test('valid emoji, Unicode case expansion and NFKC-expanded labels can publish together', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null)]);
  const values = aggregateExerciseScores({ sessions: { '2026-10-01:custom': [
    { id: 'a', name: '🏋️', reps: 8, sets: 2 },
    { id: 'b', name: 'ß test', reps: 7, sets: 1 },
    { id: 'c', name: '㍿'.repeat(120), reps: 5, sets: 2 },
  ] } }, '2026-10-02');
  await client.join('Example', values);
  const sent = JSON.parse(calls[1].body).p_scores;
  assert.equal(sent.reduce((sum, item) => sum + item.total_reps, 0), 33);
  assert.equal(sent.length, 3);
});

test('a name saved offline remains confirmed and retries on reopening without exposing logs', async () => {
  const first = fixture([new Error('offline')]);
  await assert.rejects(first.client.join('Example', S(36)), /verbinding/);
  assert.equal(first.client.isJoined(), true);
  const second = fixture([reply(identity()), reply(null)], { storage: first.storage });
  await second.client.sync(S(42));
  assert.equal(second.calls.length, 2);
  assert.deepEqual(JSON.parse(second.calls[1].body), { p_display_name: 'Example', p_scores: S(42) });
});

test('failed score upload retries with the same persisted identity', async () => {
  const first = fixture([reply(identity()), reply({ error: 'unavailable' }, 503)]);
  await assert.rejects(first.client.join('Example', S(36)), /bereikbaar/);
  const second = fixture([reply(null)], { storage: first.storage });
  await second.client.sync(S(36));
  assert.equal(second.calls.length, 1);
  assert.equal(second.calls[0].headers.Authorization, 'Bearer access-1');
});

test('expired access tokens refresh before upload, rotate tokens and preserve identity', async () => {
  const first = fixture([reply(identity({ expires_at: 1001 })), reply(null)]);
  await first.client.join('Example', S(36));
  const refreshed = identity({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 });
  delete refreshed.expires_at;
  const second = fixture([reply(refreshed), reply(null)], { storage: first.storage });
  await second.client.sync(S(48));
  assert.match(second.calls[0].url, /token\?grant_type=refresh_token$/);
  assert.deepEqual(JSON.parse(second.calls[0].body), { refresh_token: 'refresh-1' });
  assert.equal(second.calls[0].headers.Authorization, undefined);
  assert.equal(second.calls[1].headers.Authorization, 'Bearer access-2');
  const saved = JSON.parse([...second.storage.values.values()][0]);
  assert.equal(saved.session.refresh_token, 'refresh-2');
  assert.equal(saved.session.user.id, userId);
});

test('a server 401 refreshes once and retries the score write', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null), reply({}, 401), reply(identity({ access_token: 'access-2' })), reply(null)]);
  await client.join('Example', S(36));
  await client.sync(S(48));
  assert.equal(calls.length, 5);
  assert.match(calls[3].url, /refresh_token/);
  assert.equal(calls[4].headers.Authorization, 'Bearer access-2');
});

test('a rejected refresh never silently creates another player; explicit rejoin is required', async () => {
  const first = fixture([reply(identity({ expires_at: 1001 })), reply(null)]);
  await first.client.join('Example', S(36));
  const second = fixture([reply({}, 400)], { storage: first.storage });
  await assert.rejects(second.client.sync(S(48)), /naam opnieuw/);
  assert.equal(second.client.requiresRejoin(), true);
  await assert.rejects(second.client.sync(S(48)), /naam opnieuw/);
  assert.equal(second.calls.length, 1);
  const third = fixture([reply(identity({ user: { id: '22222222-2222-4222-8222-222222222222' } })), reply(null)], { storage: second.storage });
  await third.client.join('Example', S(48));
  assert.match(third.calls[0].url, /signup$/);
});

test('refresh replies cannot replace the existing participant with another user', async () => {
  const first = fixture([reply(identity({ expires_at: 1001 })), reply(null)]);
  await first.client.join('Example', S(36));
  const second = fixture([reply(identity({ user: { id: '22222222-2222-4222-8222-222222222222' } }))], { storage: first.storage });
  await assert.rejects(second.client.sync(S(48)), /deelname is veranderd/);
  assert.equal(second.calls.length, 1);
});

test('concurrent score changes serialize uploads and session creation', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null), reply(null), reply(null)]);
  await Promise.all([client.join('Example', S(10)), client.sync(S(20)), client.sync(S(30))]);
  assert.equal(calls.filter(call => call.url.endsWith('/signup')).length, 1);
  assert.deepEqual(calls.slice(1).map(call => JSON.parse(call.body).p_scores[0].total_reps), [10, 20, 30]);
  assert.equal(client.getLastTotal(), 30);
});

test('stopping persists inactive intent before the request, hides the score and skips future uploads', async () => {
  const { client, calls, storage } = fixture([reply(identity()), reply(null), () => {
    const saved = JSON.parse([...storage.values.values()][0]);
    assert.equal(saved.active, false);
    assert.equal(saved.pendingLeave, true);
    return reply(null);
  }]);
  await client.join('Example', S(36));
  assert.deepEqual(await client.leave(), { skipped: false, left: true });
  assert.equal(client.isJoined(), false);
  assert.equal(client.hasPendingLeave(), false);
  assert.match(calls[2].url, /rpc\/fitness_leave_exercise_scores$/);
  assert.deepEqual(JSON.parse(calls[2].body), {});
  assert.equal(calls[2].headers.Authorization, 'Bearer access-1');
  assert.deepEqual(await client.sync(S(999)), { skipped: true });
  assert.equal(calls.length, 3);
});

test('failed stop retries after reopening instead of publishing a changed score', async () => {
  const first = fixture([reply(identity()), reply(null), new Error('offline')]);
  await first.client.join('Example', S(36));
  await assert.rejects(first.client.leave(), /verbinding/);
  assert.equal(first.client.isJoined(), false);
  assert.equal(first.client.hasPendingLeave(), true);
  const second = fixture([reply(null)], { storage: first.storage });
  assert.equal(second.client.isJoined(), false);
  assert.equal(second.client.hasPendingLeave(), true);
  await second.client.sync(S(999));
  assert.equal(second.calls.length, 1);
  assert.match(second.calls[0].url, /rpc\/fitness_leave_exercise_scores$/);
  assert.equal(second.client.hasPendingLeave(), false);
  assert.deepEqual(await second.client.sync(S(1000)), { skipped: true });
});

test('explicitly joining again reactivates the same identity, even with an unchanged total', async () => {
  const first = fixture([reply(identity()), reply(null), reply(null)]);
  await first.client.join('Example', S(36));
  await first.client.leave();
  const second = fixture([reply(null)], { storage: first.storage });
  assert.equal(second.client.getDisplayName(), 'Example');
  await second.client.join('New name', S(36));
  assert.equal(second.calls.length, 1);
  assert.match(second.calls[0].url, /fitness_submit_exercise_scores$/);
  assert.equal(second.calls[0].headers.Authorization, 'Bearer access-1');
  assert.equal(second.client.isJoined(), true);
  assert.equal(second.client.hasPendingLeave(), false);
});

test('stopping after signup could not start does not create a new backend identity', async () => {
  const { client, calls } = fixture([new Error('offline')]);
  await assert.rejects(client.join('Example', S(36)), /verbinding/);
  await client.leave();
  assert.equal(calls.length, 1);
  assert.equal(client.isJoined(), false);
  assert.equal(client.hasPendingLeave(), false);
});

test('public ranking reads only safe columns with no user JWT and preserves duplicate aliases', async () => {
  const scores = [
    { exercise_key: 'ex:squat', exercise_name: 'Squat', display_name: 'Same name', total_reps: 100, updated_at: '2026-10-14T12:00:00Z' },
    { exercise_key: 'ex:squat', exercise_name: 'Squat', display_name: 'Same name', total_reps: 90, updated_at: '2026-10-14T13:00:00Z' },
  ];
  const { client, calls } = fixture([reply(scores)]);
  assert.deepEqual(await client.getScores('ex:squat'), scores);
  assert.match(calls[0].url, /select=exercise_key,exercise_name,display_name,total_reps,updated_at&exercise_key=in\.\(%22ex%3Asquat%22\)&order=total_reps.desc,updated_at.asc&limit=50$/);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(client.isJoined(), false);
});

test('exercise suggestions are public, deduplicated by key and do not submit a search query', async () => {
  const result = [...S(36), ...S(24), { exercise_key: 'custom:my move', exercise_name: 'My move' }];
  const { client, calls } = fixture([reply(result)]);
  assert.deepEqual(await client.getExercises(), [
    { exercise_key: 'ex:squat', exercise_name: 'Squat' }, { exercise_key: 'custom:my move', exercise_name: 'My move' },
  ]);
  assert.match(calls[0].url, /fitness_available_exercises\?select=exercise_key,exercise_name&order=exercise_name.asc&limit=1000$/);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(client.isJoined(), false);
});

test('exercise filters quote reserved characters and reject results from another exercise', async () => {
  const key = 'custom:🏋️,()&test', { client, calls } = fixture([reply([]), reply([{ ...S(36)[0], display_name: 'Example' }])]);
  assert.deepEqual(await client.getScores(key), []);
  const filter = new URL(calls[0].url).searchParams.get('exercise_key');
  assert.equal(filter, `in.(${JSON.stringify(key)})`);
  assert.equal(JSON.parse(filter.slice(4, -1)), key);
  assert.equal(new URL(calls[0].url).searchParams.has('test'), false);
  await assert.rejects(client.getScores('ex:bench-press'), /andere oefening/);
});

test('storage failures stop participation before signup and HTTP errors expose no response contents', async () => {
  const broken = fixture([], { storage: { getItem() { return null; }, setItem() { throw new Error('denied'); } } });
  await assert.rejects(broken.client.join('Example', S(36)), /toestel/);
  assert.equal(broken.calls.length, 0);
  const limited = fixture([reply({ message: 'sensitive internal detail' }, 429)]);
  await assert.rejects(limited.client.getScores('ex:squat'), error => /te veel verzoeken/.test(error.message) && !error.message.includes('sensitive'));
  const invalid = fixture([reply({ unrelated: true })]);
  await assert.rejects(invalid.client.getScores('ex:squat'), /ongeldig/);
});

test('public names render as safe text, never HTML', () => {
  class Element {
    constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.children = []; this.textContent = ''; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    set innerHTML(value) { throw new Error(`Unsafe HTML: ${value}`); }
  }
  const document = { createElement: tag => new Element(tag, document) }, container = document.createElement('div');
  renderLeaderboardRows(container, [{ display_name: '<img src=x onerror=alert(1)>', total_reps: 123 }]);
  assert.equal(container.children[0].children[0].textContent, '1. <img src=x onerror=alert(1)>');
  assert.equal(container.children[0].children[1].textContent, '123 reps');
  renderLeaderboardRows(container, []);
  assert.match(container.children[0].textContent, /Nog geen scores/);
});

function nameUiFixture({ writable = true, storageFails = false } = {}) {
  const original = new Map(['document', 'localStorage', 'fetch', 'addEventListener', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const ids = new Map(), values = new Map(), requests = [], toasts = [];
  let editable = writable;
  class Element {
    constructor(tag, ownerDocument) { this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.textContent = ''; this.value = ''; this.open = false; this.hidden = false; this.disabled = false; }
    set id(value) { this._id = value; ids.set(value, this); }
    get id() { return this._id; }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    addEventListener(event, handler) { (this.listeners[event] ??= []).push(handler); }
    showModal() { assert.equal(this.tagName, 'dialog', 'Alleen het naamvenster mag modal zijn.'); this.open = true; }
    close() { this.open = false; for (const listener of this.listeners.close ?? []) listener({}); }
    focus() {}
  }
  const document = { createElement: tag => new Element(tag, document), createElementNS: (namespace, tag) => new Element(tag, document), getElementById: id => ids.get(id) ?? null, addEventListener() {}, querySelectorAll(selector) {
    if (selector === '[data-progress]') return [...ids.values()].filter(item => item.dataset.progress);
    if (selector === '#body-form input, #body-form button') return ['body-date', 'body-weight', 'delete-body'].map(id => ids.get(id));
    return [];
  } };
  document.body = document.createElement('body');
  const content = document.createElement('main'); content.id = 'app-content'; document.body.append(content);
  for (const id of ['edit-player-name', 'leaderboard-button', 'progress-button']) { const button = document.createElement('button'); button.id = id; document.body.append(button); }
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { if (storageFails) throw new Error('storage denied'); values.set(key, value); } };
  for (const [key, value] of Object.entries({ document, localStorage: storage, fetch: async (...args) => { requests.push(args); throw new Error('offline'); }, addEventListener() {}, setTimeout: () => 1, clearTimeout() {} })) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  let currentPage = 'training'; const pageHandlers = new Map();
  const navigation = {
    onOpen(page, handler) { pageHandlers.set(page, handler); }, isCurrent(page) { return currentPage === page; },
    open(page) { currentPage = page; for (const child of content.children) child.hidden = child.attributes['data-app-page'] !== page; pageHandlers.get(page)?.(); },
  };
  const ui = setupLeaderboard({ getState: () => ({ sessions: {} }), canEdit: () => editable, toast: message => toasts.push(message), navigation });
  return { ui, navigation, document, ids, values, requests, toasts, setEditable(value) { editable = value; }, cleanup() {
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  } };
}

test('first-use name screen waits for editable load, blocks Escape, stores offline and leaves a minimal ranking view', async () => {
  const fixture = nameUiFixture({ writable: false });
  try {
    const { ui, ids } = fixture, nameDialog = ids.get('leaderboard-name-dialog');
    ui.onSaved(); assert.equal(nameDialog.open, false); assert.equal(ids.get('edit-player-name').disabled, true);
    fixture.setEditable(true); ui.onSaved(); assert.equal(nameDialog.open, true); assert.equal(ids.get('edit-player-name').disabled, false);
    let prevented = false; nameDialog.listeners.cancel[0]({ preventDefault() { prevented = true; } }); assert.equal(prevented, true);
    let stopped = false; prevented = false;
    nameDialog.listeners.keydown[0]({ key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
    assert.equal(prevented, true); assert.equal(stopped, true);
    nameDialog.close(); await Promise.resolve(); assert.equal(nameDialog.open, true);
    ids.get('leaderboard-first-name').value = 'Example';
    await nameDialog.children.find(item => item.tagName === 'form').onsubmit({ preventDefault() {} });
    assert.equal(nameDialog.open, false);
    assert.equal(JSON.parse([...fixture.values.values()][0]).name, 'Example');
    assert.equal(JSON.parse([...fixture.values.values()][0]).scoreMode, 'exercise-v1');
    assert.equal(fixture.requests.length, 1); assert.match(fixture.toasts.at(-1), /verbinding/);
    const viewer = ids.get('leaderboard-page');
    assert.equal(viewer.tagName, 'section'); assert.equal(viewer.attributes['data-app-page'], 'ranglijst');
    assert.equal(ids.get('app-content').children.includes(viewer), true);
    assert.equal(ids.has('leaderboard-dialog'), false);
    assert.equal(viewer.children[0].children[1].href, '#/training');
    assert.equal(viewer.children[0].children[1].textContent, '←');
    assert.equal(viewer.children[0].children[1].attributes['aria-label'], 'Terug naar training');
    assert.equal(ids.get('leaderboard-button').onclick, undefined);
    assert.equal(viewer.children.some(item => item.tagName === 'form' || item.tagName === 'details'), false);
    ids.get('edit-player-name').onclick(); assert.equal(nameDialog.open, true);
    prevented = false; nameDialog.listeners.cancel[0]({ preventDefault() { prevented = true; } }); assert.equal(prevented, false);
  } finally { fixture.cleanup(); }
});

test('failed local name storage keeps the required name screen open and never starts a backend session', async () => {
  const fixture = nameUiFixture({ storageFails: true });
  try {
    fixture.ui.onSaved(); const dialog = fixture.ids.get('leaderboard-name-dialog');
    fixture.ids.get('leaderboard-first-name').value = 'Example';
    await dialog.children.find(item => item.tagName === 'form').onsubmit({ preventDefault() {} });
    assert.equal(dialog.open, true); assert.equal(fixture.requests.length, 0);
    const error = dialog.children.find(item => item.tagName === 'form').children.find(item => item.className === 'field-error');
    assert.equal(error.hidden, false); assert.match(error.textContent, /toestel/);
  } finally { fixture.cleanup(); }
});

test('statistics renders on its own route and refreshes only while that page is current', () => {
  const fixture = nameUiFixture();
  try {
    const { document, ids, navigation } = fixture;
    for (const id of ['exercise-series', 'chart-weight', 'chart-reps', 'exercise-rep-total', 'exercise-rep-count', 'exercise-summary', 'exercise-chart', 'exercise-measurements', 'body-date', 'body-weight', 'body-edit-note', 'delete-body', 'body-error', 'body-form', 'training-group', 'training-summary', 'training-chart', 'training-comparison', 'body-summary', 'body-chart', 'body-measurements']) {
      const element = document.createElement('div'); element.id = id; document.body.append(element);
    }
    for (const tab of ['exercise', 'body', 'training']) {
      const button = document.createElement('button'); button.id = `progress-tab-${tab}`; button.dataset.progress = tab; document.body.append(button);
      const panel = document.createElement('section'); panel.id = `progress-${tab}`; document.body.append(panel);
    }
    const state = { sessions: {}, groups: [], bodyWeights: {} };
    const progress = setupProgress({ getState: () => state, canEdit: () => true, changeState: async () => true, confirmAction: async () => false, toast() {}, navigation });
    ids.get('exercise-rep-total').textContent = 'untouched'; progress.refresh();
    assert.equal(ids.get('exercise-rep-total').textContent, 'untouched');
    navigation.open('statistieken'); assert.equal(ids.get('exercise-rep-total').textContent, '0');
    assert.match(ids.get('body-date').value, /^\d{4}-\d{2}-\d{2}$/);
    state.sessions['2000-01-01:push'] = [{ id: 'example', name: 'Squat', sets: 3, reps: 12, weight: 25 }];
    progress.refresh(); assert.equal(ids.get('exercise-rep-total').textContent, '36');
    navigation.open('training'); state.sessions = {}; progress.refresh();
    assert.equal(ids.get('exercise-rep-total').textContent, '36');
    navigation.open('statistieken'); assert.equal(ids.get('exercise-rep-total').textContent, '0');
    assert.equal(ids.get('progress-button').onclick, undefined);
    assert.equal(ids.has('progress-dialog'), false);
  } finally { fixture.cleanup(); }
});
