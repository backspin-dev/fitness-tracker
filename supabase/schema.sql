-- Voer dit eenmaal uit in de SQL Editor van het Supabase-project.
-- Er worden alleen openbare aliassen en oefenrecords opgeslagen, geen logboeken.
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
  max_weight numeric check (max_weight between 0 and 2000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_key)
);
-- NULL betekent: deze oudere deelnemer heeft nog geen gewichtrecord gedeeld.
alter table public.fitness_exercise_scores add column if not exists max_weight numeric;
alter table public.fitness_exercise_scores drop constraint if exists fitness_exercise_scores_max_weight_check;
alter table public.fitness_exercise_scores add constraint fitness_exercise_scores_max_weight_check check (max_weight between 0 and 2000);
alter table public.fitness_exercise_scores drop constraint if exists fitness_exercise_scores_exercise_name_check;
alter table public.fitness_exercise_scores add constraint fitness_exercise_scores_exercise_name_check check (char_length(exercise_name) between 1 and 4096);
create index if not exists fitness_exercise_scores_ranking on public.fitness_exercise_scores (exercise_key, total_reps desc, updated_at asc);
create index if not exists fitness_exercise_scores_weight_ranking on public.fitness_exercise_scores (exercise_key, max_weight desc nulls last, updated_at asc);
alter table public.fitness_exercise_scores enable row level security;
revoke all on public.fitness_exercise_scores from public, anon, authenticated;
grant select (exercise_key, exercise_name, display_name, total_reps, max_weight, updated_at) on public.fitness_exercise_scores to anon, authenticated;
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
  ('ex:lat-pulldown', 'Lat pulldown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lat pulldown', 'Lat pull down', 'Lat pulldowns', 'Lat pull downs', 'Latpulldown', 'Lat pull down machine', 'Lat pulldown machine', 'Latpulldown machine', 'Lat pull down apparaat', 'Lat pulldown apparaat']) as names(name))),
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
  ('ex:ez-bar-biceps-curl', 'EZ-bar biceps curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['EZ-bar biceps curl', 'EZ bar curl', 'EZ curl', 'EZ bar bicep curl', 'Z bar bicep curl', 'Z bar biceps curl', 'Z bar curl', 'Z bar curls', 'Z bar bicep curls', 'Z bar biceps curls', 'Bicep curl Z bar', 'Zbar bicep curl', 'Zbar biceps curl', 'EZbar bicep curl', 'Biceps curl Z bar']) as names(name))),
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
  ('ex:parallel-bar-dip', 'Parallel-bar dip', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Parallel-bar dip', 'Parallel bar dips']) as names(name))),
  ('ex:smith-machine-squat', 'Smith machine squat', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Smith machine squat', 'Smith machine squats', 'Smith squat', 'Squat Smith machine', 'Squat Smith apparaat']) as names(name))),
  ('ex:hack-squat-machine', 'Hack squat machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Hack squat machine', 'Machine hack squat', 'Machine hack squats', 'Hack squat apparaat', 'Hack squat toestel']) as names(name))),
  ('ex:hip-thrust-machine', 'Hip thrust machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Hip thrust machine', 'Machine hip thrust', 'Machine hip thrusts', 'Glute drive machine', 'Machine glute drive', 'Hip thrust apparaat', 'Hip thrust toestel']) as names(name))),
  ('ex:hip-abduction-machine', 'Hip abduction machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Hip abduction machine', 'Seated hip abduction machine', 'Hip abductor machine', 'Abductor machine', 'Heupabductie machine', 'Heupabductie apparaat']) as names(name))),
  ('ex:hip-adduction-machine', 'Hip adduction machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Hip adduction machine', 'Seated hip adduction machine', 'Hip adductor machine', 'Adductor machine', 'Heupadductie machine', 'Heupadductie apparaat']) as names(name))),
  ('ex:seated-calf-raise-machine', 'Seated calf raise machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated calf raise machine', 'Machine seated calf raise', 'Seated calf raises machine', 'Seated calf raise apparaat', 'Zittende kuithef machine']) as names(name))),
  ('ex:smith-machine-calf-raise', 'Smith machine calf raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Smith machine calf raise', 'Smith machine calf raises', 'Smith calf raise', 'Calf raise Smith machine', 'Kuithef Smith machine']) as names(name))),
  ('ex:standing-dumbbell-calf-raise', 'Standing dumbbell calf raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing dumbbell calf raise', 'Standing dumbbell calf raises', 'Dumbbell standing calf raise', 'Standing calf raise dumbbells', 'Staande kuithef dumbbells']) as names(name))),
  ('ex:bodyweight-standing-calf-raise', 'Bodyweight standing calf raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bodyweight standing calf raise', 'Standing bodyweight calf raise', 'Bodyweight standing calf raises', 'Standing calf raise bodyweight', 'Staande kuithef lichaamsgewicht']) as names(name))),
  ('ex:sumo-deadlift', 'Sumo deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Sumo deadlift', 'Sumo deadlifts', 'Barbell sumo deadlift', 'Barbell sumo deadlifts', 'Sumo deadlift barbell']) as names(name))),
  ('ex:dumbbell-deadlift', 'Dumbbell deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell deadlift', 'Dumbbell deadlifts', 'Deadlift dumbbells', 'Deadlift dumbbell']) as names(name))),
  ('ex:trap-bar-deadlift', 'Trap bar deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Trap bar deadlift', 'Trapbar deadlift', 'Trap bar deadlifts', 'Hex bar deadlift', 'Hexbar deadlift', 'Hex bar deadlifts']) as names(name))),
  ('ex:smith-machine-hip-thrust', 'Smith machine hip thrust', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Smith machine hip thrust', 'Smith machine hip thrusts', 'Hip thrust Smith machine', 'Smith hip thrust']) as names(name))),
  ('ex:dumbbell-walking-lunge', 'Dumbbell walking lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell walking lunge', 'Dumbbell walking lunges', 'Walking lunge dumbbells', 'Walking lunges dumbbell']) as names(name))),
  ('ex:cable-glute-kickback', 'Cable glute kickback', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable glute kickback', 'Cable glute kickbacks', 'Glute kickback cable', 'Cable kickback glutes', 'Glute kickback kabel']) as names(name))),
  ('ex:nordic-hamstring-curl', 'Nordic hamstring curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Nordic hamstring curl', 'Nordic hamstring curls', 'Nordic curl', 'Nordic curls', 'Russian hamstring curl']) as names(name))),
  ('ex:dumbbell-hip-thrust', 'Dumbbell hip thrust', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell hip thrust', 'Dumbbell hip thrusts', 'Hip thrust dumbbell', 'Hip thrust dumbbells']) as names(name))),
  ('ex:bodyweight-hip-thrust', 'Bodyweight hip thrust', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bodyweight hip thrust', 'Bodyweight hip thrusts', 'Body weight hip thrust', 'Hip thrust lichaamsgewicht']) as names(name))),
  ('ex:single-leg-bodyweight-hip-thrust', 'Single-leg bodyweight hip thrust', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-leg bodyweight hip thrust', 'Bodyweight single leg hip thrust', 'Single leg hip thrust bodyweight', 'Eenbenige hip thrust lichaamsgewicht']) as names(name))),
  ('ex:standing-cable-hip-abduction', 'Standing cable hip abduction', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing cable hip abduction', 'Cable standing hip abduction', 'Cable hip abduction', 'Standing hip abduction cable', 'Heupabductie kabel']) as names(name))),
  ('ex:standing-cable-hip-adduction', 'Standing cable hip adduction', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing cable hip adduction', 'Cable standing hip adduction', 'Cable hip adduction', 'Standing hip adduction cable', 'Heupadductie kabel']) as names(name))),
  ('ex:smith-machine-romanian-deadlift', 'Smith machine Romanian deadlift', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Smith machine Romanian deadlift', 'Smith machine RDL', 'Romanian deadlift Smith machine', 'Smith Romanian deadlift']) as names(name))),
  ('ex:dumbbell-reverse-lunge', 'Dumbbell reverse lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell reverse lunge', 'Dumbbell reverse lunges', 'Reverse lunge dumbbells', 'Dumbbell rear lunge', 'Achterwaartse lunge dumbbells']) as names(name))),
  ('ex:barbell-walking-lunge', 'Barbell walking lunge', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Barbell walking lunge', 'Barbell walking lunges', 'Walking lunge barbell', 'Walking lunges barbell']) as names(name))),
  ('ex:seated-dumbbell-calf-raise', 'Seated dumbbell calf raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated dumbbell calf raise', 'Seated dumbbell calf raises', 'Dumbbell seated calf raise', 'Seated calf raise dumbbells', 'Zittende kuithef dumbbells']) as names(name))),
  ('ex:cable-lateral-raise', 'Cable lateral raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable lateral raise', 'Cable lateral raises', 'Lateral raise cable', 'Lateral raises cable', 'Cable side raise', 'Cable side raises']) as names(name))),
  ('ex:standing-cable-rear-delt-fly', 'Standing cable rear delt fly', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing cable rear delt fly', 'Standing cable rear delt flyes', 'Standing cable rear delt flies', 'Standing cable reverse fly', 'Cable rear delt fly standing']) as names(name))),
  ('ex:smith-machine-bench-press', 'Smith machine bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Smith machine bench press', 'Smith bench press', 'Smith machine flat bench press', 'Bench press Smith machine', 'Smith machine bankdrukken']) as names(name))),
  ('ex:smith-machine-incline-bench-press', 'Smith machine incline bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Smith machine incline bench press', 'Incline Smith machine bench press', 'Smith incline bench press', 'Smith machine incline press', 'Incline bench press Smith machine']) as names(name))),
  ('ex:dumbbell-pullover', 'Dumbbell pullover', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell pullover', 'Dumbbell pull over', 'Dumbbell pullovers', 'Pullover dumbbell']) as names(name))),
  ('ex:seated-dip-machine', 'Seated dip machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated dip machine', 'Seated machine dip', 'Seated machine dips', 'Machine seated dip', 'Seated dip apparaat', 'Zittende dip machine']) as names(name))),
  ('ex:assisted-machine-dip', 'Assisted machine dip', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Assisted machine dip', 'Machine assisted dip', 'Machine assisted dips', 'Assisted dip machine', 'Assisted dips machine', 'Dip assist machine']) as names(name))),
  ('ex:assisted-machine-pull-up', 'Assisted machine pull-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Assisted machine pull-up', 'Machine assisted pull up', 'Machine assisted pull ups', 'Assisted pull up machine', 'Assisted pull ups machine', 'Pull up assist machine']) as names(name))),
  ('ex:straight-arm-cable-pulldown', 'Straight-arm cable pulldown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Straight-arm cable pulldown', 'Straight arm cable pull down', 'Straight arm lat pulldown', 'Straight arm lat pull down', 'Cable straight arm pulldown']) as names(name))),
  ('ex:v-bar-lat-pulldown', 'V-bar lat pulldown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['V-bar lat pulldown', 'V bar lat pull down', 'V bar lat pulldowns', 'Close grip V bar lat pulldown', 'V handle lat pulldown']) as names(name))),
  ('ex:reverse-grip-cable-lat-pulldown', 'Reverse-grip cable lat pulldown', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Reverse-grip cable lat pulldown', 'Reverse grip lat pulldown', 'Reverse grip lat pull down', 'Underhand cable lat pulldown', 'Underhand lat pulldown']) as names(name))),
  ('ex:cable-rope-hammer-curl', 'Cable rope hammer curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable rope hammer curl', 'Cable rope hammer curls', 'Rope cable hammer curl', 'Rope hammer curl cable']) as names(name))),
  ('ex:cable-rope-overhead-triceps-extension', 'Cable rope overhead triceps extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable rope overhead triceps extension', 'Cable rope overhead tricep extension', 'Overhead cable rope triceps extension', 'Overhead triceps extension cable rope', 'Cable rope overhead triceps extensions']) as names(name))),
  ('ex:dumbbell-shrug', 'Dumbbell shrug', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell shrug', 'Dumbbell shrugs', 'Shrug dumbbell', 'Shrugs dumbbell']) as names(name))),
  ('ex:dumbbell-preacher-curl', 'Dumbbell preacher curl', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell preacher curl', 'Dumbbell preacher curls', 'Preacher curl dumbbell', 'Preacher curls dumbbell']) as names(name))),
  ('ex:decline-barbell-bench-press', 'Decline barbell bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Decline barbell bench press', 'Barbell decline bench press', 'Decline bench press barbell', 'Decline barbell press']) as names(name))),
  ('ex:decline-dumbbell-bench-press', 'Decline dumbbell bench press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Decline dumbbell bench press', 'Decline dumbbell press', 'Dumbbell decline bench press', 'Decline bench press dumbbells']) as names(name))),
  ('ex:cable-upright-row', 'Cable upright row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable upright row', 'Cable upright rows', 'Upright row cable', 'Upright rows cable']) as names(name))),
  ('ex:dumbbell-upright-row', 'Dumbbell upright row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell upright row', 'Dumbbell upright rows', 'Upright row dumbbell', 'Upright rows dumbbells']) as names(name))),
  ('ex:cable-front-raise', 'Cable front raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable front raise', 'Cable front raises', 'Front raise cable', 'Front raises cable']) as names(name))),
  ('ex:cable-triceps-kickback', 'Cable triceps kickback', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Cable triceps kickback', 'Cable tricep kickback', 'Triceps kickback cable', 'Cable triceps kickbacks', 'Single arm cable triceps kickback']) as names(name))),
  ('ex:chest-supported-t-bar-row', 'Chest-supported T-bar row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Chest-supported T-bar row', 'Chest supported T bar rows', 'Chest supported Tbar row', 'T bar row chest supported', 'Chest supported T bar machine row']) as names(name))),
  ('ex:landmine-t-bar-row', 'Landmine T-bar row', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Landmine T-bar row', 'Landmine T bar rows', 'T bar landmine row', 'Tbar landmine row', 'Landmine row']) as names(name))),
  ('ex:single-arm-landmine-shoulder-press', 'Single-arm landmine shoulder press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Single-arm landmine shoulder press', 'Single arm landmine press', 'One arm landmine shoulder press', 'Single arm landmine shoulder presses']) as names(name))),
  ('ex:seated-smith-machine-shoulder-press', 'Seated Smith machine shoulder press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated Smith machine shoulder press', 'Smith machine seated shoulder press', 'Seated Smith shoulder press', 'Seated Smith machine overhead press']) as names(name))),
  ('ex:low-row-machine', 'Low row machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Low row machine', 'Machine low row', 'Lowrow machine', 'Low row apparaat', 'Lowrow apparaat', 'Low row toestel', 'Hammer Strength low row', 'Iso-lateral low row']) as names(name))),
  ('ex:reverse-fly-machine', 'Reverse fly machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Reverse fly machine', 'Machine reverse fly', 'Machine reverse flyes', 'Machine reverse flies', 'Reverse fly apparaat', 'Reverse fly toestel', 'Reverse pec deck', 'Reverse pec-deck machine', 'Rear delt fly machine', 'Machine rear delt fly', 'Rear delt fly apparaat', 'Reverse butterfly machine', 'Omgekeerde butterfly machine']) as names(name))),
  ('ex:bodyweight-russian-twist', 'Bodyweight Russian twist', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Bodyweight Russian twist', 'Bodyweight Russian twists', 'Russische twist zonder gewicht']) as names(name))),
  ('ex:dumbbell-russian-twist', 'Dumbbell Russian twist', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Dumbbell Russian twist', 'Dumbbell Russian twists', 'Russian twist dumbbell', 'Russian twist met dumbbell']) as names(name))),
  ('ex:kneeling-cable-crunch', 'Kneeling cable crunch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Kneeling cable crunch', 'Kneeling cable crunches', 'Cable rope crunch', 'Cable crunch', 'Cable crunches', 'Kabelcrunch']) as names(name))),
  ('ex:ab-wheel-rollout', 'Ab wheel rollout', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Ab wheel rollout', 'Ab wheel rollouts', 'Ab roller rollout', 'Kneeling ab wheel rollout', 'Ab wheel roll out']) as names(name))),
  ('ex:45-degree-back-extension', '45-degree back extension', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['45-degree back extension', '45 degree back extensions', 'Back extension 45 degrees', '45 degree hyperextension']) as names(name))),
  ('ex:back-extension-machine', 'Back extension machine', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Back extension machine', 'Machine back extension', 'Seated back extension machine', 'Rugextensie apparaat']) as names(name))),
  ('ex:superman', 'Superman', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Superman', 'Supermans', 'Prone Superman', 'Superman exercise']) as names(name))),
  ('ex:alternating-superman', 'Alternating Superman', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Alternating Superman', 'Alternating Supermans', 'Contralateral Superman', 'Opposite arm leg Superman']) as names(name))),
  ('ex:sit-up', 'Sit-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Sit-up', 'Sit ups', 'Situp', 'Bodyweight sit up', 'Sit ups lichaamsgewicht']) as names(name))),
  ('ex:decline-sit-up', 'Decline sit-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Decline sit-up', 'Decline sit ups', 'Decline situp', 'Sit up decline bench']) as names(name))),
  ('ex:butterfly-sit-up', 'Butterfly sit-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Butterfly sit-up', 'Butterfly sit ups', 'Butterfly situp']) as names(name))),
  ('ex:v-up', 'V-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['V-up', 'V ups', 'V sit up', 'V sit ups']) as names(name))),
  ('ex:tuck-up', 'Tuck-up', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Tuck-up', 'Tuck ups', 'Tuck sit up', 'Bent knee V up']) as names(name))),
  ('ex:lying-leg-raise', 'Lying leg raise', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Lying leg raise', 'Lying leg raises', 'Supine leg raise', 'Lying straight leg raise', 'Liggende beenheffing']) as names(name))),
  ('ex:seated-knee-tuck', 'Seated knee tuck', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Seated knee tuck', 'Seated knee tucks', 'Seated leg tuck']) as names(name))),
  ('ex:flutter-kick', 'Flutter kick', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Flutter kick', 'Flutter kicks', 'Supine flutter kick', 'Flutter kicks liggend']) as names(name))),
  ('ex:horizontal-scissor-kick', 'Horizontal scissor kick', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Horizontal scissor kick', 'Horizontal scissor kicks', 'Lying horizontal scissor kick', 'Scissor crossover']) as names(name))),
  ('ex:alternating-heel-touch', 'Alternating heel touch', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Alternating heel touch', 'Alternating heel touches', 'Heel touches', 'Supine heel touch', 'Lying heel touch']) as names(name))),
  ('ex:standing-cable-wood-chop', 'Standing cable wood chop', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing cable wood chop', 'Standing cable woodchopper', 'Cable wood chop', 'Cable woodchopper', 'Standing cable chop']) as names(name))),
  ('ex:standing-cable-pallof-press', 'Standing cable Pallof press', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Standing cable Pallof press', 'Standing cable Pallof presses', 'Cable Pallof press', 'Pallof press cable', 'Standing anti rotation cable press']) as names(name))),
  ('ex:plank-shoulder-tap', 'Plank shoulder tap', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Plank shoulder tap', 'Plank shoulder taps', 'Tall plank shoulder taps', 'High plank shoulder taps']) as names(name))),
  ('ex:plank-jack', 'Plank jack', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Plank jack', 'Plank jacks', 'Jumping plank jack']) as names(name))),
  ('ex:mountain-climber', 'Mountain climber', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Mountain climber', 'Mountain climbers', 'Mountainclimber', 'Mountainclimbers']) as names(name))),
  ('ex:burpee', 'Burpee', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Burpee', 'Burpees', 'Standard burpee']) as names(name))),
  ('ex:jumping-jack', 'Jumping jack', array(select distinct fitness_private.normalize_exercise_name(name) from unnest(array['Jumping jack', 'Jumping jacks']) as names(name)))
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
  weight numeric;
  previous_weight numeric;
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
    if exists (select 1 from jsonb_object_keys(item) as fields(name) where name not in ('exercise_key', 'exercise_name', 'total_reps', 'max_weight')) then
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
    weight := null;
    if item ? 'max_weight' then
      if jsonb_typeof(item->'max_weight') is distinct from 'number' then
        raise exception 'Ongeldig gewichtrecord' using errcode = '22023';
      end if;
      weight := (item->>'max_weight')::numeric;
      if weight < 0 or weight > 2000 then
        raise exception 'Ongeldig gewichtrecord' using errcode = '22023';
      end if;
    end if;
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
    -- Reps worden opgeteld; het gewichtrecord is het maximum van echte sets.
    previous_weight := (canonical->canonical_key->>'max_weight')::numeric;
    if previous_weight is not null and (weight is null or previous_weight > weight) then
      weight := previous_weight;
    end if;
    canonical := jsonb_set(canonical, array[canonical_key], jsonb_build_object(
      'exercise_key', canonical_key, 'exercise_name', canonical_label, 'total_reps', reps)
      || case when weight is null then '{}'::jsonb else jsonb_build_object('max_weight', weight) end, true);
  end loop;
  perform pg_advisory_xact_lock(hashtext(caller::text));
  update public.fitness_exercise_scores set active = false
    where user_id = caller and active = true and not (canonical ? exercise_key);
  for item in select value from jsonb_each(canonical) loop
    insert into public.fitness_exercise_scores (user_id, exercise_key, exercise_name, display_name, total_reps, max_weight, active)
      values (caller, item->>'exercise_key', item->>'exercise_name', clean_name, (item->>'total_reps')::bigint, (item->>'max_weight')::numeric, true)
    on conflict (user_id, exercise_key) do update
      set exercise_name = excluded.exercise_name, display_name = excluded.display_name,
          total_reps = excluded.total_reps,
          -- Reeds gecachete reps-only clients mogen een nieuw gewicht niet wissen.
          max_weight = case when item ? 'max_weight' then excluded.max_weight else fitness_exercise_scores.max_weight end,
          active = true
      where fitness_exercise_scores.exercise_name is distinct from excluded.exercise_name
         or fitness_exercise_scores.display_name is distinct from excluded.display_name
         or fitness_exercise_scores.total_reps is distinct from excluded.total_reps
         or (item ? 'max_weight' and fitness_exercise_scores.max_weight is distinct from excluded.max_weight)
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


-- Herstelbare beheeruitsluiting, ook voor oudere clients.

create table if not exists fitness_private.blocked_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now()
);
alter table fitness_private.blocked_participants enable row level security;
revoke all on fitness_private.blocked_participants from public, anon, authenticated;

create or replace function fitness_private.guard_participant_score()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.active and exists (
    select 1 from fitness_private.blocked_participants where user_id = new.user_id
  ) then
    raise exception 'Ranglijstdeelname is geblokkeerd' using errcode = 'PT403';
  end if;
  return new;
end;
$$;
revoke all on function fitness_private.guard_participant_score() from public, anon, authenticated;

-- Ook oudere clients en rechtstreekse REST-writes kunnen een uitgesloten
-- deelnemer niet opnieuw zichtbaar maken. Verbergen blijft mogelijk.
drop trigger if exists fitness_scores_blocked_participant on public.fitness_scores;
create trigger fitness_scores_blocked_participant before insert or update on public.fitness_scores
  for each row execute function fitness_private.guard_participant_score();
drop trigger if exists fitness_exercise_scores_blocked_participant on public.fitness_exercise_scores;
create trigger fitness_exercise_scores_blocked_participant before insert or update on public.fitness_exercise_scores
  for each row execute function fitness_private.guard_participant_score();


commit;
