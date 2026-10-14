-- Voer dit eenmaal uit in de SQL Editor van het Supabase-project.
-- Er worden alleen openbare aliassen en totaalscores opgeslagen, geen logboeken.
begin;

create table if not exists public.fitness_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24 and display_name = btrim(display_name)),
  total_reps bigint not null check (total_reps between 0 and 9007199254740991),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.fitness_scores add column if not exists active boolean not null default true;
create index if not exists fitness_scores_ranking on public.fitness_scores (total_reps desc, updated_at asc);
alter table public.fitness_scores enable row level security;

revoke all on public.fitness_scores from public, anon, authenticated;
-- Ook een rechtstreekse REST-query kan geen gebruikers-ID of tokens lezen.
grant select (display_name, total_reps, updated_at) on public.fitness_scores to anon, authenticated;
grant insert (user_id, display_name, total_reps), update (display_name, total_reps) on public.fitness_scores to authenticated;

drop policy if exists fitness_scores_public_read on public.fitness_scores;
create policy fitness_scores_public_read on public.fitness_scores for select to anon, authenticated using (active);
drop policy if exists fitness_scores_own_insert on public.fitness_scores;
create policy fitness_scores_own_insert on public.fitness_scores for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
drop policy if exists fitness_scores_own_update on public.fitness_scores;
create policy fitness_scores_own_update on public.fitness_scores for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privileged uitvoering blijft in een schema dat NIET door de Data API wordt blootgesteld.
create schema if not exists fitness_private;
revoke all on schema fitness_private from public, anon, authenticated;
grant usage on schema fitness_private to authenticated;

create or replace function fitness_private.score_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function fitness_private.score_timestamp() from public, anon, authenticated;
drop trigger if exists fitness_scores_updated_at on public.fitness_scores;
create trigger fitness_scores_updated_at before insert or update on public.fitness_scores
  for each row execute function fitness_private.score_timestamp();

create or replace function fitness_private.submit_score(p_display_name text, p_total_reps bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  alias text := btrim(p_display_name);
begin
  if caller is null then
    raise exception 'Anonieme deelname vereist' using errcode = '42501';
  end if;
  if alias is null or char_length(alias) not between 1 and 24 or alias ~ '[[:cntrl:]]' then
    raise exception 'Ongeldige naam' using errcode = '22023';
  end if;
  if p_total_reps is null or p_total_reps < 0 or p_total_reps > 9007199254740991 then
    raise exception 'Ongeldige score' using errcode = '22023';
  end if;
  -- caller komt uitsluitend uit de gecontroleerde JWT, nooit uit de client-payload.
  insert into public.fitness_scores (user_id, display_name, total_reps, active)
    values (caller, alias, p_total_reps, true)
  on conflict (user_id) do update
    set display_name = excluded.display_name, total_reps = excluded.total_reps, active = true
    where fitness_scores.display_name is distinct from excluded.display_name
       or fitness_scores.total_reps is distinct from excluded.total_reps
       or fitness_scores.active = false;
end;
$$;
revoke all on function fitness_private.submit_score(text, bigint) from public, anon, authenticated;
grant execute on function fitness_private.submit_score(text, bigint) to authenticated;

-- Kleine expliciete Data API-ingang; deze wrapper heeft zelf geen verhoogde rechten.
create or replace function public.fitness_submit_score(p_display_name text, p_total_reps bigint)
returns void language sql security invoker set search_path = '' as $$
  select fitness_private.submit_score(p_display_name, p_total_reps);
$$;
revoke all on function public.fitness_submit_score(text, bigint) from public, anon, authenticated;
grant execute on function public.fitness_submit_score(text, bigint) to authenticated;

create or replace function fitness_private.leave_score()
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Anonieme deelname vereist' using errcode = '42501';
  end if;
  update public.fitness_scores set active = false where user_id = caller and active = true;
end;
$$;
revoke all on function fitness_private.leave_score() from public, anon, authenticated;
grant execute on function fitness_private.leave_score() to authenticated;

create or replace function public.fitness_leave_score()
returns void language sql security invoker set search_path = '' as $$
  select fitness_private.leave_score();
$$;
revoke all on function public.fitness_leave_score() from public, anon, authenticated;
grant execute on function public.fitness_leave_score() to authenticated;


-- Ranglijsten per oefening. De oudere totaaltabel blijft voor reeds gecachete clients.
create table if not exists public.fitness_exercise_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_key text not null check (char_length(exercise_key) between 4 and 4096),
  exercise_name text not null check (char_length(exercise_name) between 1 and 4096),
  display_name text not null check (char_length(display_name) between 1 and 24),
  total_reps bigint not null check (total_reps between 0 and 9007199254740991),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_key)
);
alter table public.fitness_exercise_scores drop constraint if exists fitness_exercise_scores_exercise_name_check;
alter table public.fitness_exercise_scores add constraint fitness_exercise_scores_exercise_name_check check (char_length(exercise_name) between 1 and 4096);
create index if not exists fitness_exercise_scores_ranking on public.fitness_exercise_scores (exercise_key, total_reps desc, updated_at asc);
alter table public.fitness_exercise_scores enable row level security;
revoke all on public.fitness_exercise_scores from public, anon, authenticated;
grant select (exercise_key, exercise_name, display_name, total_reps, updated_at) on public.fitness_exercise_scores to anon, authenticated;
-- Schrijven kan uitsluitend via de gecontroleerde RPC, zodat namen altijd canoniek zijn.
drop policy if exists fitness_exercise_scores_public_read on public.fitness_exercise_scores;
create policy fitness_exercise_scores_public_read on public.fitness_exercise_scores for select to anon, authenticated using (active);
drop trigger if exists fitness_exercise_scores_updated_at on public.fitness_exercise_scores;
create trigger fitness_exercise_scores_updated_at before insert or update on public.fitness_exercise_scores
  for each row execute function fitness_private.score_timestamp();

create or replace view public.fitness_available_exercises with (security_invoker = true) as
  select distinct exercise_key, exercise_name from public.fitness_exercise_scores;
revoke all on public.fitness_available_exercises from public, anon, authenticated;
grant select on public.fitness_available_exercises to anon, authenticated;

create or replace function fitness_private.normalize_exercise_name(value text)
returns text language sql immutable security invoker set search_path = '' as $$
  with normalized as (select lower(normalize(coalesce(value, ''), NFKC)) as label),
  separated as (select label, btrim(regexp_replace(label, '[^[:alnum:]]+', ' ', 'g')) as clean from normalized)
  select case when clean = '' then btrim(regexp_replace(label, '[[:space:]]+', ' ', 'g')) else clean end from separated;
$$;
revoke all on function fitness_private.normalize_exercise_name(text) from public, anon, authenticated;
create table if not exists fitness_private.exercise_catalog (
  exercise_key text primary key,
  exercise_name text not null,
  normalized_names text[] not null
);
revoke all on fitness_private.exercise_catalog from public, anon, authenticated;
-- Gegenereerd uit exercise-catalog.js; alleen expliciete aliassen, nooit fuzzy/stemming.
insert into fitness_private.exercise_catalog (exercise_key, exercise_name, normalized_names) values
  ('ex:squat', 'Squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Squat', 'Squats']) as names(name))),
  ('ex:back-squat', 'Back squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Back squat', 'Back squats', 'Barbell back squat', 'Barbell back squats']) as names(name))),
  ('ex:front-squat', 'Front squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Front squat', 'Front squats', 'Barbell front squat', 'Barbell front squats']) as names(name))),
  ('ex:goblet-squat', 'Goblet squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Goblet squat', 'Goblet squats']) as names(name))),
  ('ex:leg-press', 'Leg press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Leg press', 'Legpress', 'Leg press machine', 'Leg press apparaat', 'Benenpers']) as names(name))),
  ('ex:leg-extension', 'Leg extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Leg extension', 'Leg extensions', 'Leg extension machine', 'Leg extension apparaat']) as names(name))),
  ('ex:seated-leg-curl', 'Seated leg curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated leg curl', 'Seated leg curls', 'Seated leg curl machine', 'Zittende leg curl']) as names(name))),
  ('ex:lying-leg-curl', 'Lying leg curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lying leg curl', 'Lying leg curls', 'Lying leg curl machine', 'Liggende leg curl']) as names(name))),
  ('ex:standing-calf-raise-machine', 'Standing calf raise machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing calf raise machine', 'Standing calf raises machine', 'Standing calf raise apparaat']) as names(name))),
  ('ex:deadlift', 'Deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Deadlift', 'Deadlifts']) as names(name))),
  ('ex:romanian-deadlift', 'Romanian deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Romanian deadlift', 'Romanian deadlifts', 'Roemeense deadlift', 'Roemeense deadlifts', 'RDL']) as names(name))),
  ('ex:bench-press', 'Bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bench press', 'Benchpress', 'Barbell bench press', 'Bench press barbell', 'Bankdrukken', 'Bankdrukken halter']) as names(name))),
  ('ex:dumbbell-bench-press', 'Dumbbell bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell bench press', 'Dumbbell benchpress', 'Bench press dumbbell', 'Bench press dumbbells', 'Dumbbell bankdrukken']) as names(name))),
  ('ex:bench-press-machine', 'Bench press machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bench press machine', 'Benchpress machine', 'BenchPressMachine', 'Bench press apparaat', 'Bankdrukken machine']) as names(name))),
  ('ex:incline-bench-press', 'Incline bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Incline bench press', 'Incline bench', 'Incline benchpress', 'Incline barbell bench press', 'Incline bench press barbell']) as names(name))),
  ('ex:incline-dumbbell-bench-press', 'Incline dumbbell bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Incline dumbbell bench press', 'Incline dumbbell press', 'Incline bench press dumbbell', 'Incline bench press dumbbells']) as names(name))),
  ('ex:chest-press-machine', 'Chest press machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Chest press machine', 'Chest press apparaat', 'Chestpress machine', 'Chestpress apparaat']) as names(name))),
  ('ex:chest-fly-machine', 'Chest fly machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Chest fly machine', 'Fly machine', 'Chest fly apparaat', 'Pec deck', 'Pecdeck', 'Butterfly machine']) as names(name))),
  ('ex:dumbbell-chest-fly', 'Dumbbell chest fly', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell chest fly', 'Dumbbell chest flys', 'Dumbbell chest flies', 'Dumbbell fly', 'Dumbbell flies', 'Chest fly dumbbell']) as names(name))),
  ('ex:shoulder-press-machine', 'Shoulder press machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Shoulder press machine', 'Shoulder press apparaat', 'Shoulderpress machine', 'Schouderpress machine']) as names(name))),
  ('ex:dumbbell-shoulder-press', 'Dumbbell shoulder press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell shoulder press', 'Shoulder press dumbbell', 'Shoulder press dumbbells', 'Dumbbell schouderpress']) as names(name))),
  ('ex:barbell-overhead-press', 'Barbell overhead press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell overhead press', 'Overhead press barbell', 'Barbell shoulder press', 'Shoulder press barbell']) as names(name))),
  ('ex:dumbbell-lateral-raise', 'Dumbbell lateral raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell lateral raise', 'Dumbbell lateral raises', 'Lateral raise dumbbell', 'Lateral raises dumbbell', 'Side raise dumbbell', 'Side raises dumbbell', 'Dumbbell side raise', 'Dumbbell side raises']) as names(name))),
  ('ex:lat-pulldown', 'Lat pulldown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lat pulldown', 'Lat pull down', 'Lat pulldowns', 'Lat pull downs', 'Latpulldown']) as names(name))),
  ('ex:pull-up', 'Pull-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Pull-up', 'Pull ups', 'Pullups', 'Pullup']) as names(name))),
  ('ex:seated-cable-row', 'Seated cable row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated cable row', 'Seated cable rows', 'Cable seated row', 'Zittende kabelroeien']) as names(name))),
  ('ex:barbell-row', 'Barbell row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell row', 'Barbell rows', 'Bent over barbell row', 'Bent over barbell rows', 'Bent over row barbell']) as names(name))),
  ('ex:dumbbell-row', 'Dumbbell row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell row', 'Dumbbell rows', 'One arm dumbbell row', 'One arm dumbbell rows', 'Dumbbell roeien']) as names(name))),
  ('ex:barbell-biceps-curl', 'Barbell biceps curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell biceps curl', 'Barbell biceps curls', 'Barbell curl', 'Barbell curls', 'Bicep curl barbell']) as names(name))),
  ('ex:dumbbell-biceps-curl', 'Dumbbell biceps curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell biceps curl', 'Dumbbell biceps curls', 'Dumbbell curl', 'Dumbbell curls', 'Bicep curl dumbbell']) as names(name))),
  ('ex:triceps-pushdown-bar', 'Triceps pushdown bar', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Triceps pushdown bar', 'Tricep push down bar', 'Triceps push down bar', 'Tricep pushdown bar', 'Triceps pushdown stang', 'Tricep pushdown stang']) as names(name))),
  ('ex:triceps-pushdown-rope', 'Triceps pushdown rope', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Triceps pushdown rope', 'Tricep push down rope', 'Triceps push down rope', 'Tricep pushdown rope', 'Triceps pushdown touw', 'Tricep pushdown touw']) as names(name))),
  ('ex:skull-crusher', 'Skull crusher', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Skull crusher', 'Skull crushers', 'Skullcrusher', 'Skullcrushers']) as names(name))),
  ('ex:push-up', 'Push-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Push-up', 'Push ups', 'Pushup', 'Pushups', 'Opdrukken']) as names(name))),
  ('ex:bodyweight-squat', 'Bodyweight squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bodyweight squat', 'Body weight squat', 'Bodyweight squats', 'Air squat', 'Air squats', 'Squat lichaamsgewicht']) as names(name))),
  ('ex:prisoner-squat', 'Prisoner squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Prisoner squat', 'Prisoner squats']) as names(name))),
  ('ex:jump-squat', 'Jump squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Jump squat', 'Jump squats', 'Squat jump', 'Squat jumps']) as names(name))),
  ('ex:sumo-squat', 'Sumo squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Sumo squat', 'Sumo squats']) as names(name))),
  ('ex:dumbbell-sumo-squat', 'Dumbbell sumo squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell sumo squat', 'Dumbbell sumo squats', 'Sumo squat dumbbell']) as names(name))),
  ('ex:dumbbell-front-squat', 'Dumbbell front squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell front squat', 'Dumbbell front squats', 'Front squat dumbbells']) as names(name))),
  ('ex:kettlebell-front-squat', 'Kettlebell front squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kettlebell front squat', 'Kettlebell front squats', 'Front squat kettlebell']) as names(name))),
  ('ex:dumbbell-goblet-squat', 'Dumbbell goblet squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell goblet squat', 'Goblet squat dumbbell', 'Dumbbell goblet squats']) as names(name))),
  ('ex:kettlebell-goblet-squat', 'Kettlebell goblet squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kettlebell goblet squat', 'Goblet squat kettlebell', 'Kettlebell goblet squats']) as names(name))),
  ('ex:single-leg-squat', 'Single-leg squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-leg squat', 'Single leg squats', 'Eenbenige squat']) as names(name))),
  ('ex:bulgarian-split-squat', 'Bulgarian split squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bulgarian split squat', 'Bulgarian split squats', 'Bulgaarse split squat']) as names(name))),
  ('ex:dumbbell-bulgarian-split-squat', 'Dumbbell Bulgarian split squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell Bulgarian split squat', 'Bulgarian split squat dumbbell', 'Bulgarian split squat dumbbells']) as names(name))),
  ('ex:bodyweight-split-squat', 'Bodyweight split squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bodyweight split squat', 'Body weight split squat', 'Bodyweight split squats']) as names(name))),
  ('ex:forward-lunge', 'Forward lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Forward lunge', 'Forward lunges', 'Voorwaartse lunge', 'Voorwaartse lunges']) as names(name))),
  ('ex:reverse-lunge', 'Reverse lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Reverse lunge', 'Reverse lunges', 'Rear lunge', 'Rear lunges', 'Achterwaartse lunge']) as names(name))),
  ('ex:lateral-lunge', 'Lateral lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lateral lunge', 'Lateral lunges', 'Side lunge', 'Side lunges', 'Zijwaartse lunge']) as names(name))),
  ('ex:barbell-forward-lunge', 'Barbell forward lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell forward lunge', 'Barbell forward lunges', 'Forward lunge barbell']) as names(name))),
  ('ex:dumbbell-forward-lunge', 'Dumbbell forward lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell forward lunge', 'Dumbbell forward lunges', 'Forward lunge dumbbells']) as names(name))),
  ('ex:dumbbell-lateral-lunge', 'Dumbbell lateral lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell lateral lunge', 'Dumbbell side lunge', 'Dumbbell lateral lunges', 'Side lunge dumbbells']) as names(name))),
  ('ex:dumbbell-step-up', 'Dumbbell step-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell step-up', 'Dumbbell step ups', 'Step up dumbbells']) as names(name))),
  ('ex:bodyweight-step-up', 'Bodyweight step-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bodyweight step-up', 'Body weight step up', 'Bodyweight step ups']) as names(name))),
  ('ex:single-leg-press', 'Single-leg press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-leg press', 'Single leg leg press', 'Single leg presses', 'Eenbenige leg press']) as names(name))),
  ('ex:leg-press-calf-raise', 'Leg press calf raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Leg press calf raise', 'Leg press calf raises', 'Calf raise leg press']) as names(name))),
  ('ex:glute-bridge', 'Glute bridge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Glute bridge', 'Glute bridges', 'Floor bridge', 'Floor bridges', 'Bilbrug']) as names(name))),
  ('ex:barbell-glute-bridge', 'Barbell glute bridge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell glute bridge', 'Barbell hip bridge', 'Barbell glute bridges', 'Glute bridge barbell']) as names(name))),
  ('ex:barbell-hip-thrust', 'Barbell hip thrust', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell hip thrust', 'Barbell hip thrusts', 'Hip thrust barbell']) as names(name))),
  ('ex:side-lying-hip-abduction', 'Side-lying hip abduction', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Side-lying hip abduction', 'Side lying hip abductions', 'Liggende heupabductie']) as names(name))),
  ('ex:quadruped-hip-extension', 'Quadruped hip extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Quadruped hip extension', 'Quadruped hip extensions', 'Donkey kick', 'Donkey kicks']) as names(name))),
  ('ex:glute-press-machine', 'Glute press machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Glute press machine', 'Glute press apparaat', 'Machine glute press']) as names(name))),
  ('ex:dumbbell-romanian-deadlift', 'Dumbbell Romanian deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell Romanian deadlift', 'Dumbbell RDL', 'Dumbbell Romanian deadlifts', 'Romanian deadlift dumbbells']) as names(name))),
  ('ex:kettlebell-deadlift', 'Kettlebell deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kettlebell deadlift', 'Kettlebell deadlifts', 'Deadlift kettlebell']) as names(name))),
  ('ex:barbell-good-morning', 'Barbell good morning', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell good morning', 'Barbell good mornings', 'Good morning barbell']) as names(name))),
  ('ex:stability-ball-leg-curl', 'Stability ball leg curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Stability ball leg curl', 'Stability ball hamstring curl', 'Stability ball hamstring curls', 'Swiss ball leg curl']) as names(name))),
  ('ex:standing-band-hip-abduction', 'Standing band hip abduction', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing band hip abduction', 'Band standing hip abduction', 'Standing hip abduction resistance band']) as names(name))),
  ('ex:close-grip-bench-press', 'Close-grip bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Close-grip bench press', 'Close grip benchpress', 'Close grip barbell bench press', 'Smal bankdrukken']) as names(name))),
  ('ex:dumbbell-floor-press', 'Dumbbell floor press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell floor press', 'Floor press dumbbells']) as names(name))),
  ('ex:single-arm-dumbbell-bench-press', 'Single-arm dumbbell bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-arm dumbbell bench press', 'Single arm dumbbell chest press', 'One arm dumbbell bench press']) as names(name))),
  ('ex:single-arm-incline-dumbbell-bench-press', 'Single-arm incline dumbbell bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-arm incline dumbbell bench press', 'Single arm incline dumbbell chest press']) as names(name))),
  ('ex:incline-dumbbell-fly', 'Incline dumbbell fly', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Incline dumbbell fly', 'Incline dumbbell flies', 'Incline dumbbell flys', 'Incline chest fly dumbbell']) as names(name))),
  ('ex:cable-crossover', 'Cable crossover', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable crossover', 'Cable crossovers', 'Bent forward cable crossover']) as names(name))),
  ('ex:standing-cable-chest-fly', 'Standing cable chest fly', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing cable chest fly', 'Standing cable fly', 'Standing cable flyes', 'Two arm standing cable fly']) as names(name))),
  ('ex:standing-band-chest-press', 'Standing band chest press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing band chest press', 'Resistance band standing chest press', 'Standing chest press resistance band']) as names(name))),
  ('ex:standing-band-chest-fly', 'Standing band chest fly', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing band chest fly', 'Resistance band chest fly', 'Standing chest fly resistance band']) as names(name))),
  ('ex:seated-cable-chest-press', 'Seated cable chest press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated cable chest press', 'Seated cable press']) as names(name))),
  ('ex:seated-incline-cable-press', 'Seated incline cable press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated incline cable press', 'Seated incline cable chest press']) as names(name))),
  ('ex:seated-decline-cable-press', 'Seated decline cable press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated decline cable press', 'Seated decline cable chest press']) as names(name))),
  ('ex:close-grip-chest-press-machine', 'Close-grip chest press machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Close-grip chest press machine', 'Seated close grip chest press machine', 'Close grip chest press apparaat']) as names(name))),
  ('ex:chin-up', 'Chin-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Chin-up', 'Chin ups', 'Chinup', 'Chinups']) as names(name))),
  ('ex:band-assisted-pull-up', 'Band-assisted pull-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Band-assisted pull-up', 'Band assisted pull ups', 'Pull up with resistance band']) as names(name))),
  ('ex:negative-pull-up', 'Negative pull-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Negative pull-up', 'Negative pull ups', 'Eccentric pull up']) as names(name))),
  ('ex:kneeling-cable-lat-pulldown', 'Kneeling cable lat pulldown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kneeling cable lat pulldown', 'Kneeling lat pulldown cable', 'Kneeling cable lat pull down']) as names(name))),
  ('ex:seated-row-machine', 'Seated row machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated row machine', 'Seated machine row', 'Seated row apparaat']) as names(name))),
  ('ex:high-row-machine', 'High row machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['High row machine', 'Seated high back row machine', 'Seated high back rows machine']) as names(name))),
  ('ex:seated-high-cable-row', 'Seated high cable row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated high cable row', 'Seated cable high row', 'Seated high back cable row']) as names(name))),
  ('ex:standing-band-row', 'Standing band row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing band row', 'Standing tubing row', 'Resistance band standing row']) as names(name))),
  ('ex:single-arm-cable-row', 'Single-arm cable row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-arm cable row', 'Single arm cable rows', 'One arm cable row']) as names(name))),
  ('ex:incline-dumbbell-row', '45-degree incline dumbbell row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['45-degree incline dumbbell row', '45 degree incline row dumbbell', 'Incline dumbbell row 45 degrees']) as names(name))),
  ('ex:dumbbell-renegade-row', 'Dumbbell renegade row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell renegade row', 'Dumbbell renegade rows', 'Renegade row dumbbells']) as names(name))),
  ('ex:dumbbell-front-raise', 'Dumbbell front raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell front raise', 'Dumbbell front raises', 'Front raise dumbbell']) as names(name))),
  ('ex:incline-dumbbell-reverse-fly', 'Incline dumbbell reverse fly', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Incline dumbbell reverse fly', 'Incline reverse fly dumbbell', 'Incline dumbbell reverse flies']) as names(name))),
  ('ex:seated-dumbbell-rear-lateral-raise', 'Seated dumbbell rear lateral raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated dumbbell rear lateral raise', 'Seated rear lateral raise dumbbell', 'Seated dumbbell rear lateral raises']) as names(name))),
  ('ex:cable-diagonal-raise', 'Cable diagonal raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable diagonal raise', 'Diagonal raise cable']) as names(name))),
  ('ex:barbell-upright-row', 'Barbell upright row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell upright row', 'Barbell upright rows', 'Upright row barbell']) as names(name))),
  ('ex:cable-face-pull', 'Cable face pull', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable face pull', 'Cable face pulls', 'Face pull cable', 'Face pull rope', 'Face pulls rope']) as names(name))),
  ('ex:dumbbell-arnold-press', 'Dumbbell Arnold press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell Arnold press', 'Arnold press dumbbell', 'Arnold press', 'Arnold presses']) as names(name))),
  ('ex:dumbbell-push-press', 'Dumbbell push press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell push press', 'Push press dumbbell', 'Dumbbell push presses']) as names(name))),
  ('ex:seated-dumbbell-shoulder-press', 'Seated dumbbell shoulder press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated dumbbell shoulder press', 'Seated dumbbell overhead press', 'Seated overhead press dumbbells']) as names(name))),
  ('ex:lateral-raise-machine', 'Lateral raise machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lateral raise machine', 'Lateral shoulder raise machine', 'Lateral raise apparaat']) as names(name))),
  ('ex:barbell-shrug', 'Barbell shrug', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell shrug', 'Barbell shrugs', 'Shrug barbell']) as names(name))),
  ('ex:dumbbell-hammer-curl', 'Dumbbell hammer curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell hammer curl', 'Dumbbell hammer curls', 'Hammer curl dumbbell', 'Hammer curls dumbbells']) as names(name))),
  ('ex:dumbbell-concentration-curl', 'Dumbbell concentration curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell concentration curl', 'Concentration curl dumbbell', 'Dumbbell concentration curls']) as names(name))),
  ('ex:incline-dumbbell-curl', 'Incline dumbbell curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Incline dumbbell curl', 'Incline dumbbell curls', 'Incline curl dumbbell']) as names(name))),
  ('ex:preacher-curl', 'Preacher curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Preacher curl', 'Preacher curls']) as names(name))),
  ('ex:cable-biceps-curl', 'Cable biceps curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable biceps curl', 'Cable bicep curl', 'Cable biceps curls', 'Cable curl', 'Cable curls']) as names(name))),
  ('ex:ez-bar-biceps-curl', 'EZ-bar biceps curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['EZ-bar biceps curl', 'EZ bar curl', 'EZ curl', 'EZ bar bicep curl']) as names(name))),
  ('ex:wide-grip-ez-bar-curl', 'Wide-grip EZ-bar curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Wide-grip EZ-bar curl', 'EZ curl wide grip', 'Wide grip EZ curl']) as names(name))),
  ('ex:close-grip-ez-bar-curl', 'Close-grip EZ-bar curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Close-grip EZ-bar curl', 'EZ curl narrow grip', 'Narrow grip EZ bar curl', 'Close grip EZ curl']) as names(name))),
  ('ex:barbell-reverse-curl', 'Barbell reverse curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell reverse curl', 'Reverse barbell curl', 'Reverse bicep curl barbell']) as names(name))),
  ('ex:dumbbell-zottman-curl', 'Dumbbell Zottman curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell Zottman curl', 'Zottman curl dumbbell', 'Zottman curl', 'Zottman curls']) as names(name))),
  ('ex:dumbbell-cross-body-curl', 'Dumbbell cross-body curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell cross-body curl', 'Cross body curl dumbbell', 'Dumbbell cross body curls']) as names(name))),
  ('ex:biceps-curl-machine', 'Biceps curl machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Biceps curl machine', 'Seated biceps curl machine', 'Bicep curl machine', 'Biceps curl apparaat']) as names(name))),
  ('ex:lying-barbell-triceps-extension', 'Lying barbell triceps extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lying barbell triceps extension', 'Lying barbell triceps extensions', 'Barbell skull crusher', 'Barbell skullcrushers']) as names(name))),
  ('ex:dumbbell-triceps-kickback', 'Dumbbell triceps kickback', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell triceps kickback', 'Dumbbell tricep kickback', 'Triceps kickback dumbbell']) as names(name))),
  ('ex:dumbbell-wrist-extension', 'Dumbbell wrist extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell wrist extension', 'Wrist curl extension dumbbell', 'Dumbbell wrist extensions']) as names(name))),
  ('ex:dumbbell-wrist-flexion', 'Dumbbell wrist flexion', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell wrist flexion', 'Wrist curl flexion dumbbell', 'Dumbbell wrist curls']) as names(name))),
  ('ex:cable-triceps-pushdown', 'Cable triceps pushdown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable triceps pushdown', 'Cable tricep pushdown', 'Cable triceps press down']) as names(name))),
  ('ex:band-triceps-extension', 'Band triceps extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Band triceps extension', 'Resistance band triceps extension', 'Triceps extension resistance band']) as names(name))),
  ('ex:dumbbell-overhead-triceps-extension', 'Dumbbell overhead triceps extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell overhead triceps extension', 'Overhead triceps extension dumbbell', 'Dumbbell overhead tricep extension']) as names(name))),
  ('ex:crunch', 'Crunch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Crunch', 'Crunches', 'Abdominal crunch', 'Buikspiercrunch']) as names(name))),
  ('ex:reverse-crunch', 'Reverse crunch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Reverse crunch', 'Reverse crunches']) as names(name))),
  ('ex:bicycle-crunch', 'Bicycle crunch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bicycle crunch', 'Bicycle crunches', 'Bicycle maneuver']) as names(name))),
  ('ex:stability-ball-crunch', 'Stability ball crunch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Stability ball crunch', 'Crunch on exercise ball', 'Swiss ball crunch']) as names(name))),
  ('ex:hanging-knee-raise', 'Hanging knee raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Hanging knee raise', 'Hanging knee raises']) as names(name))),
  ('ex:hanging-leg-raise', 'Hanging leg raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Hanging leg raise', 'Hanging leg raises', 'Hanging straight leg raise']) as names(name))),
  ('ex:dead-bug', 'Dead bug', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dead bug', 'Dead bugs', 'Deadbug']) as names(name))),
  ('ex:bird-dog', 'Bird dog', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bird dog', 'Bird dogs', 'Birddog']) as names(name))),
  ('ex:crunch-machine', 'Crunch machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Crunch machine', 'Seated crunch machine', 'Abdominal crunch machine', 'Ab crunch machine']) as names(name))),
  ('ex:vertical-leg-crunch', 'Vertical leg crunch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Vertical leg crunch', 'Vertical leg crunches']) as names(name))),
  ('ex:kneeling-cable-wood-chop', 'Kneeling cable wood chop', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kneeling cable wood chop', 'Kneeling wood chop cable']) as names(name))),
  ('ex:plank-walkup', 'Plank walkup', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Plank walkup', 'Plank walk up', 'Plank up down', 'Up down plank']) as names(name))),
  ('ex:trx-row', 'TRX row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['TRX row', 'TRX back row', 'TRX rows', 'Suspension trainer row']) as names(name))),
  ('ex:trx-biceps-curl', 'TRX biceps curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['TRX biceps curl', 'TRX bicep curl', 'TRX biceps curls']) as names(name))),
  ('ex:trx-chest-press', 'TRX chest press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['TRX chest press', 'Suspension trainer chest press']) as names(name))),
  ('ex:trx-triceps-extension', 'TRX overhead triceps extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['TRX overhead triceps extension', 'TRX triceps extension', 'TRX overhead tricep extension']) as names(name))),
  ('ex:trx-hamstring-curl', 'TRX hamstring curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['TRX hamstring curl', 'TRX hamstrings curl', 'TRX hamstring curls']) as names(name))),
  ('ex:trx-squat', 'TRX squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['TRX squat', 'TRX squats', 'Suspension trainer squat']) as names(name))),
  ('ex:kettlebell-clean-and-press', 'Kettlebell clean and press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kettlebell clean and press', 'Kettlebell clean press']) as names(name))),
  ('ex:single-arm-kettlebell-overhead-press', 'Single-arm kettlebell overhead press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-arm kettlebell overhead press', 'Single arm overhead press kettlebell']) as names(name))),
  ('ex:kettlebell-halo', 'Kettlebell halo', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kettlebell halo', 'Kettlebell halos', 'Halo kettlebell']) as names(name))),
  ('ex:incline-push-up', 'Incline push-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Incline push-up', 'Incline push ups', 'Incline pushup']) as names(name))),
  ('ex:decline-push-up', 'Decline push-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Decline push-up', 'Decline push ups', 'Decline pushup']) as names(name))),
  ('ex:kneeling-push-up', 'Kneeling push-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kneeling push-up', 'Knee push up', 'Bent knee push up', 'Kneeling push ups']) as names(name))),
  ('ex:pike-push-up', 'Pike push-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Pike push-up', 'Pike push ups', 'Pike pushup']) as names(name))),
  ('ex:plyometric-push-up', 'Plyometric push-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Plyometric push-up', 'Plyometric push ups', 'Clapping push up', 'Clap push up']) as names(name))),
  ('ex:bench-dip', 'Bench dip', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bench dip', 'Bench dips']) as names(name))),
  ('ex:parallel-bar-dip', 'Parallel-bar dip', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Parallel-bar dip', 'Parallel bar dips']) as names(name)))
on conflict (exercise_key) do update
  set exercise_name = excluded.exercise_name, normalized_names = excluded.normalized_names;

create or replace function fitness_private.submit_exercise_scores(p_display_name text, p_scores jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  clean_name text := btrim(p_display_name);
  item jsonb;
  canonical jsonb := '{}'::jsonb;
  given_key text;
  given_label text;
  normalized_label text;
  canonical_key text;
  canonical_label text;
  reps bigint;
begin
  if caller is null then raise exception 'Anonieme deelname vereist' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 24 or clean_name ~ '[[:cntrl:]]' then
    raise exception 'Ongeldige naam' using errcode = '22023';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Ongeldige oefenscores' using errcode = '22023';
  end if;
  if jsonb_array_length(p_scores) > 5000 then raise exception 'Te veel oefenscores' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(p_scores) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Ongeldige oefenscore' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_object_keys(item) as fields(name) where name not in ('exercise_key', 'exercise_name', 'total_reps')) then
      raise exception 'Onbekende scorevelden' using errcode = '22023';
    end if;
    given_key := item->>'exercise_key';
    given_label := item->>'exercise_name';
    if jsonb_typeof(item->'exercise_key') is distinct from 'string' or
       jsonb_typeof(item->'exercise_name') is distinct from 'string' or
       given_key is null or char_length(given_key) not between 4 and 4096 or
       given_label is null or char_length(given_label) not between 1 and 4096 or given_label ~ '[[:cntrl:]]' or
       jsonb_typeof(item->'total_reps') is distinct from 'number' or (item->>'total_reps') !~ '^[0-9]{1,16}$' then
      raise exception 'Ongeldige oefenscore' using errcode = '22023';
    end if;
    reps := (item->>'total_reps')::bigint;
    if reps > 9007199254740991 then raise exception 'Ongeldige score' using errcode = '22023'; end if;
    canonical_key := null;
    canonical_label := null;
    if left(given_key, 3) = 'ex:' then
      select c.exercise_key, c.exercise_name into canonical_key, canonical_label
        from fitness_private.exercise_catalog c where c.exercise_key = given_key;
      if canonical_key is null then raise exception 'Onbekende ranglijstoefening' using errcode = '22023'; end if;
    else
      normalized_label := fitness_private.normalize_exercise_name(given_label);
      if normalized_label = '' or given_key <> 'custom:' || normalized_label then
        raise exception 'Ongeldige eigen oefensleutel' using errcode = '22023';
      end if;
      select c.exercise_key, c.exercise_name into canonical_key, canonical_label
        from fitness_private.exercise_catalog c where normalized_label = any(c.normalized_names);
      if canonical_key is null then
        canonical_key := given_key;
        canonical_label := upper(left(normalized_label, 1)) || substring(normalized_label from 2);
        if fitness_private.normalize_exercise_name(canonical_label) <> normalized_label then
          canonical_label := normalized_label;
        end if;
      end if;
    end if;
    -- Ook oudere clients met custom:squats komen daardoor op de Squat-ranglijst.
    reps := reps + coalesce((canonical->canonical_key->>'total_reps')::bigint, 0);
    if reps > 9007199254740991 then raise exception 'Ongeldige score' using errcode = '22023'; end if;
    canonical := jsonb_set(canonical, array[canonical_key], jsonb_build_object(
      'exercise_key', canonical_key, 'exercise_name', canonical_label, 'total_reps', reps), true);
  end loop;
  perform pg_advisory_xact_lock(hashtext(caller::text));
  update public.fitness_exercise_scores set active = false
    where user_id = caller and active = true and not (canonical ? exercise_key);
  for item in select value from jsonb_each(canonical) loop
    insert into public.fitness_exercise_scores (user_id, exercise_key, exercise_name, display_name, total_reps, active)
      values (caller, item->>'exercise_key', item->>'exercise_name', clean_name, (item->>'total_reps')::bigint, true)
    on conflict (user_id, exercise_key) do update
      set exercise_name = excluded.exercise_name, display_name = excluded.display_name,
          total_reps = excluded.total_reps, active = true
      where fitness_exercise_scores.exercise_name is distinct from excluded.exercise_name
         or fitness_exercise_scores.display_name is distinct from excluded.display_name
         or fitness_exercise_scores.total_reps is distinct from excluded.total_reps
         or fitness_exercise_scores.active = false;
  end loop;
  update public.fitness_scores set active = false where user_id = caller and active = true;
end;
$$;
revoke all on function fitness_private.submit_exercise_scores(text, jsonb) from public, anon, authenticated;
grant execute on function fitness_private.submit_exercise_scores(text, jsonb) to authenticated;
create or replace function public.fitness_submit_exercise_scores(p_display_name text, p_scores jsonb)
returns void language sql security invoker set search_path = '' as $$
  select fitness_private.submit_exercise_scores(p_display_name, p_scores);
$$;
revoke all on function public.fitness_submit_exercise_scores(text, jsonb) from public, anon, authenticated;
grant execute on function public.fitness_submit_exercise_scores(text, jsonb) to authenticated;

-- Stoppen geldt voor zowel oude totale scores als alle nieuwe oefenscores.
create or replace function fitness_private.leave_score()
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Anonieme deelname vereist' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(caller::text));
  update public.fitness_scores set active = false where user_id = caller and active = true;
  update public.fitness_exercise_scores set active = false where user_id = caller and active = true;
end;
$$;
revoke all on function fitness_private.leave_score() from public, anon, authenticated;
grant execute on function fitness_private.leave_score() to authenticated;
create or replace function public.fitness_leave_exercise_scores()
returns void language sql security invoker set search_path = '' as $$
  select fitness_private.leave_score();
$$;
revoke all on function public.fitness_leave_exercise_scores() from public, anon, authenticated;
grant execute on function public.fitness_leave_exercise_scores() to authenticated;

commit;
