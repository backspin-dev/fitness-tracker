-- Aanvulling op schema.sql: eigenaar kan een deelnemer uitsluiten zonder
-- publieke scores definitief te wissen. Geen namen of IDs in deze broncode.
begin;

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
