-- Bestaande per-oefeningranglijsten uitbreiden met een gewichtrecord.
-- Voer uit vóór publicatie van de nieuwe client. Geen logboeken of sets online.
-- Oudere rijen houden NULL totdat de deelnemer de nieuwe melding bevestigt.
begin;

alter table public.fitness_exercise_scores add column if not exists max_weight numeric;
alter table public.fitness_exercise_scores drop constraint if exists fitness_exercise_scores_max_weight_check;
alter table public.fitness_exercise_scores add constraint fitness_exercise_scores_max_weight_check check (max_weight between 0 and 2000);
create index if not exists fitness_exercise_scores_weight_ranking on public.fitness_exercise_scores (exercise_key, max_weight desc nulls last, updated_at asc);
-- De bestaande RLS, directe schrijfverboden en beheeruitsluiting blijven staan.
grant select (max_weight) on public.fitness_exercise_scores to anon, authenticated;

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

commit;
