// Alleen voor onderhoud: geen netwerkverzoeken of persoonlijke gegevens.
import { readFile, writeFile } from 'node:fs/promises';
import { EXERCISE_CATALOG } from '../exercise-catalog.js';

const path = new URL('./schema.sql', import.meta.url);
const source = await readFile(path, 'utf8');
const quote = value => `'${value.replaceAll("'", "''")}'`;
const rows = EXERCISE_CATALOG.map(item =>
  `  (${quote(item.key)}, ${quote(item.label)}, array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array[${[item.label, ...item.aliases].map(quote).join(', ')}]) as names(name)))`
).join(',\n');
const marker = 'insert into fitness_private.exercise_catalog (exercise_key, exercise_name, normalized_names) values\n';
const start = source.indexOf(marker) + marker.length;
const end = source.indexOf('\non conflict (exercise_key) do update', start);
if (start < marker.length || end < start) throw new Error('Het SQL-catalogusblok ontbreekt.');
await writeFile(path, source.slice(0, start) + rows + source.slice(end));
console.log(`SQL-catalogus bijgewerkt: ${EXERCISE_CATALOG.length} oefeningen.`);
