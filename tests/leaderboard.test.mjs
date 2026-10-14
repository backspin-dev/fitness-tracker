import test from 'node:test';
import assert from 'node:assert/strict';
import { totalSavedReps, normalizeDisplayName, createLeaderboardClient } from '../leaderboard.js';
import { renderLeaderboardRows } from '../leaderboard-ui.js';

const url = 'https://example.supabase.co', anonKey = 'sb_publishable_test';
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

test('aliases trim whitespace, allow duplicate names and reject empty, long or hidden control names', () => {
  assert.equal(normalizeDisplayName('  Example   person  '), 'Example person');
  assert.equal(normalizeDisplayName('🏋️ Sporter'), '🏋️ Sporter');
  assert.equal(normalizeDisplayName('<b>Name</b>'), '<b>Name</b>');
  for (const value of ['', '  ', 'a'.repeat(25), 'ab\u200bcd', null]) assert.throws(() => normalizeDisplayName(value), /naam/);
});

test('opening a client or syncing without explicit participation never creates a backend user', async () => {
  const { client, calls } = fixture([]);
  assert.equal(client.isJoined(), false);
  assert.deepEqual(await client.sync(40), { skipped: true });
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
  await client.join('  Example  ', 36);
  assert.equal(client.isJoined(), true);
  assert.equal(client.getDisplayName(), 'Example');
  assert.equal(client.getLastTotal(), 36);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `${url}/auth/v1/signup`);
  assert.deepEqual(JSON.parse(calls[0].body), { data: {} });
  assert.equal(calls[0].headers.apikey, anonKey);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[1].url, `${url}/rest/v1/rpc/fitness_submit_score`);
  assert.deepEqual(JSON.parse(calls[1].body), { p_display_name: 'Example', p_total_reps: 36 });
  assert.equal(calls[1].headers.Authorization, 'Bearer access-1');
  assert.equal(calls[1].credentials, 'omit');
  assert.equal(calls[1].cache, 'no-store');
  assert.equal([...storage.values.keys()][0], `fitness-tracker:leaderboard:v1:${url}`);
});

test('changing a name keeps the same anonymous identity and unchanged scores skip writes', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null), reply(null)]);
  await client.join('First name', 36);
  assert.deepEqual(await client.sync(36), { skipped: true });
  await client.join('Second name', 36);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].headers.Authorization, 'Bearer access-1');
  assert.deepEqual(JSON.parse(calls[2].body), { p_display_name: 'Second name', p_total_reps: 36 });
});

test('offline participation retains consent and retries on reopening without exposing logs', async () => {
  const first = fixture([new Error('offline')]);
  await assert.rejects(first.client.join('Example', 36), /verbinding/);
  assert.equal(first.client.isJoined(), true);
  const second = fixture([reply(identity()), reply(null)], { storage: first.storage });
  await second.client.sync(42);
  assert.equal(second.calls.length, 2);
  assert.deepEqual(JSON.parse(second.calls[1].body), { p_display_name: 'Example', p_total_reps: 42 });
});

test('failed score upload retries with the same persisted identity', async () => {
  const first = fixture([reply(identity()), reply({ error: 'unavailable' }, 503)]);
  await assert.rejects(first.client.join('Example', 36), /bereikbaar/);
  const second = fixture([reply(null)], { storage: first.storage });
  await second.client.sync(36);
  assert.equal(second.calls.length, 1);
  assert.equal(second.calls[0].headers.Authorization, 'Bearer access-1');
});

test('expired access tokens refresh before upload, rotate tokens and preserve identity', async () => {
  const first = fixture([reply(identity({ expires_at: 1001 })), reply(null)]);
  await first.client.join('Example', 36);
  const refreshed = identity({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 });
  delete refreshed.expires_at;
  const second = fixture([reply(refreshed), reply(null)], { storage: first.storage });
  await second.client.sync(48);
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
  await client.join('Example', 36);
  await client.sync(48);
  assert.equal(calls.length, 5);
  assert.match(calls[3].url, /refresh_token/);
  assert.equal(calls[4].headers.Authorization, 'Bearer access-2');
});

test('a rejected refresh never silently creates another player; explicit rejoin is required', async () => {
  const first = fixture([reply(identity({ expires_at: 1001 })), reply(null)]);
  await first.client.join('Example', 36);
  const second = fixture([reply({}, 400)], { storage: first.storage });
  await assert.rejects(second.client.sync(48), /Opnieuw meedoen/);
  assert.equal(second.client.requiresRejoin(), true);
  await assert.rejects(second.client.sync(48), /Opnieuw meedoen/);
  assert.equal(second.calls.length, 1);
  const third = fixture([reply(identity({ user: { id: '22222222-2222-4222-8222-222222222222' } })), reply(null)], { storage: second.storage });
  await third.client.join('Example', 48);
  assert.match(third.calls[0].url, /signup$/);
});

test('refresh replies cannot replace the existing participant with another user', async () => {
  const first = fixture([reply(identity({ expires_at: 1001 })), reply(null)]);
  await first.client.join('Example', 36);
  const second = fixture([reply(identity({ user: { id: '22222222-2222-4222-8222-222222222222' } }))], { storage: first.storage });
  await assert.rejects(second.client.sync(48), /deelname is veranderd/);
  assert.equal(second.calls.length, 1);
});

test('concurrent score changes serialize uploads and session creation', async () => {
  const { client, calls } = fixture([reply(identity()), reply(null), reply(null), reply(null)]);
  await Promise.all([client.join('Example', 10), client.sync(20), client.sync(30)]);
  assert.equal(calls.filter(call => call.url.endsWith('/signup')).length, 1);
  assert.deepEqual(calls.slice(1).map(call => JSON.parse(call.body).p_total_reps), [10, 20, 30]);
  assert.equal(client.getLastTotal(), 30);
});

test('stopping persists inactive intent before the request, hides the score and skips future uploads', async () => {
  const { client, calls, storage } = fixture([reply(identity()), reply(null), () => {
    const saved = JSON.parse([...storage.values.values()][0]);
    assert.equal(saved.active, false);
    assert.equal(saved.pendingLeave, true);
    return reply(null);
  }]);
  await client.join('Example', 36);
  assert.deepEqual(await client.leave(), { skipped: false, left: true });
  assert.equal(client.isJoined(), false);
  assert.equal(client.hasPendingLeave(), false);
  assert.match(calls[2].url, /rpc\/fitness_leave_score$/);
  assert.deepEqual(JSON.parse(calls[2].body), {});
  assert.equal(calls[2].headers.Authorization, 'Bearer access-1');
  assert.deepEqual(await client.sync(999), { skipped: true });
  assert.equal(calls.length, 3);
});

test('failed stop retries after reopening instead of publishing a changed score', async () => {
  const first = fixture([reply(identity()), reply(null), new Error('offline')]);
  await first.client.join('Example', 36);
  await assert.rejects(first.client.leave(), /verbinding/);
  assert.equal(first.client.isJoined(), false);
  assert.equal(first.client.hasPendingLeave(), true);
  const second = fixture([reply(null)], { storage: first.storage });
  assert.equal(second.client.isJoined(), false);
  assert.equal(second.client.hasPendingLeave(), true);
  await second.client.sync(999);
  assert.equal(second.calls.length, 1);
  assert.match(second.calls[0].url, /rpc\/fitness_leave_score$/);
  assert.equal(second.client.hasPendingLeave(), false);
  assert.deepEqual(await second.client.sync(1000), { skipped: true });
});

test('explicitly joining again reactivates the same identity, even with an unchanged total', async () => {
  const first = fixture([reply(identity()), reply(null), reply(null)]);
  await first.client.join('Example', 36);
  await first.client.leave();
  const second = fixture([reply(null)], { storage: first.storage });
  assert.equal(second.client.getDisplayName(), 'Example');
  await second.client.join('New name', 36);
  assert.equal(second.calls.length, 1);
  assert.match(second.calls[0].url, /fitness_submit_score$/);
  assert.equal(second.calls[0].headers.Authorization, 'Bearer access-1');
  assert.equal(second.client.isJoined(), true);
  assert.equal(second.client.hasPendingLeave(), false);
});

test('stopping after signup could not start does not create a new backend identity', async () => {
  const { client, calls } = fixture([new Error('offline')]);
  await assert.rejects(client.join('Example', 36), /verbinding/);
  await client.leave();
  assert.equal(calls.length, 1);
  assert.equal(client.isJoined(), false);
  assert.equal(client.hasPendingLeave(), false);
});

test('public ranking reads only safe columns with no user JWT and preserves duplicate aliases', async () => {
  const scores = [
    { display_name: 'Same name', total_reps: 100, updated_at: '2026-10-14T12:00:00Z' },
    { display_name: 'Same name', total_reps: 90, updated_at: '2026-10-14T13:00:00Z' },
  ];
  const { client, calls } = fixture([reply(scores)]);
  assert.deepEqual(await client.getScores(), scores);
  assert.match(calls[0].url, /select=display_name,total_reps,updated_at&order=total_reps.desc,updated_at.asc&limit=50$/);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(client.isJoined(), false);
});

test('storage failures stop participation before signup and HTTP errors expose no response contents', async () => {
  const broken = fixture([], { storage: { getItem() { return null; }, setItem() { throw new Error('denied'); } } });
  await assert.rejects(broken.client.join('Example', 36), /toestel/);
  assert.equal(broken.calls.length, 0);
  const limited = fixture([reply({ message: 'sensitive internal detail' }, 429)]);
  await assert.rejects(limited.client.getScores(), error => /te veel verzoeken/.test(error.message) && !error.message.includes('sensitive'));
  const invalid = fixture([reply({ unrelated: true })]);
  await assert.rejects(invalid.client.getScores(), /ongeldig/);
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
