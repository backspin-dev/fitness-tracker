import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXERCISE_CATALOG, normalizeExerciseName } from '../exercise-catalog.js';

test('deployed SQL catalog has exactly the same stable keys, labels and aliases as the client', async () => {
  const source = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const block = source.split('insert into fitness_private.exercise_catalog (exercise_key, exercise_name, normalized_names) values\n')[1]?.split('\non conflict (exercise_key) do update')[0];
  assert(block, 'Het gegenereerde SQL-catalogusblok moet aanwezig zijn.');
  const decode = value => value.replaceAll("''", "'");
  const rows = [...block.matchAll(/^\s+\('((?:[^']|'')*)', '((?:[^']|'')*)', array\(select distinct fitness_private\.normalize_exercise_name\(name\) from unnest\(array\[(.*?)\]\) as names\(name\)\)\)[,]?$/gm)].map(match => ({
    key: decode(match[1]), label: decode(match[2]), names: [...match[3].matchAll(/'((?:[^']|'')*)'/g)].map(item => decode(item[1])),
  }));
  assert.equal(rows.length, EXERCISE_CATALOG.length);
  assert.equal(new Set(rows.map(row => row.key)).size, rows.length);
  assert.deepEqual(rows, EXERCISE_CATALOG.map(item => ({ key: item.key, label: item.label, names: [item.label, ...item.aliases] })));
  const owner = new Map();
  for (const row of rows) for (const alias of row.names) {
    const normalized = normalizeExerciseName(alias);
    assert(!owner.has(normalized) || owner.get(normalized) === row.key, `SQL-alias ${alias} mag geen verschillende oefeningen verbinden.`);
    owner.set(normalized, row.key);
  }
});
