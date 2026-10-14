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

commit;
