-- Run As You Are — grundschema
-- Körs mot ett Supabase-projekt (Postgres + Auth). `auth.users` och
-- `auth.uid()` finns redan där, skapas INTE av denna migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- runners
-- ---------------------------------------------------------------------------

create table runners (
  id                  uuid primary key default gen_random_uuid(),
  auth_id             uuid references auth.users (id) on delete set null,
  name                text not null,
  self_estimate_10k_sec integer check (self_estimate_10k_sec > 0),
  host_count          integer not null default 0,
  garmin_livetrack_url text,
  created_at          timestamptz not null default now()
);

create unique index runners_auth_id_key on runners (auth_id) where auth_id is not null;

-- ---------------------------------------------------------------------------
-- editions — en rad per års-upplaga
-- ---------------------------------------------------------------------------

create table editions (
  id                  uuid primary key default gen_random_uuid(),
  year                integer not null unique,
  start_time          timestamptz,
  host_id             uuid references runners (id),
  status              text not null default 'upcoming'
                        check (status in ('upcoming', 'active', 'completed')),
  predictions_locked  boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- predictions — gissningsspelet: självskattning + kompisars gissningar
-- ---------------------------------------------------------------------------

create table predictions (
  id                  uuid primary key default gen_random_uuid(),
  edition_id          uuid not null references editions (id) on delete cascade,
  target_runner_id    uuid not null references runners (id) on delete cascade,
  guesser_runner_id   uuid not null references runners (id) on delete cascade,
  guess_sec           integer not null check (guess_sec > 0),
  is_self             boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (edition_id, target_runner_id, guesser_runner_id)
);

create index predictions_target_idx on predictions (edition_id, target_runner_id);

-- ---------------------------------------------------------------------------
-- start_list — resultatet av jaktstartskalkylatorn (skrivs av Edge Function)
-- ---------------------------------------------------------------------------

create table start_list (
  id                  uuid primary key default gen_random_uuid(),
  edition_id          uuid not null references editions (id) on delete cascade,
  runner_id           uuid not null references runners (id) on delete cascade,
  basis_source        text not null check (basis_source in ('previous_result', 'expected_time')),
  basis_time_sec      integer not null check (basis_time_sec > 0),
  start_offset_sec    integer not null check (start_offset_sec >= 0),
  created_at          timestamptz not null default now(),
  unique (edition_id, runner_id)
);

-- ---------------------------------------------------------------------------
-- results — placering/status per löpare och år, plus gissningsavdrag
-- ---------------------------------------------------------------------------

create table results (
  id                    uuid primary key default gen_random_uuid(),
  edition_id            uuid not null references editions (id) on delete cascade,
  runner_id             uuid not null references runners (id) on delete cascade,
  placering             integer check (placering > 0),
  status                text check (status in ('NI', 'DNR', 'DNC')),
  finish_time_sec       integer check (finish_time_sec > 0),
  prediction_deduction  integer not null default 0,
  created_at            timestamptz not null default now(),
  unique (edition_id, runner_id),
  constraint placering_xor_status check (
    (placering is not null and status is null) or
    (placering is null and status is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Vyer — samma logik som functions/scoring-engine.js, som SQL för snabba
-- läsningar (leaderboard) utan att behöva anropa Edge Function varje gång.
-- Källan till sanning för SJÄLVA uträkningen (vid skrivning) är fortfarande
-- scoring-engine.js — de här vyerna bara summerar det som redan skrivits.
-- ---------------------------------------------------------------------------

create view v_results_scored as
select
  r.*,
  coalesce(
    r.placering,
    max(r.placering) over (partition by r.edition_id)
      + case r.status when 'NI' then 2 when 'DNR' then 2 when 'DNC' then 4 end
  ) as placement_points
from results r;

create view v_season_totals as
select
  runner_id,
  sum(placement_points)::int        as placement_points_total,
  sum(prediction_deduction)::int    as prediction_deduction_total,
  (sum(placement_points) - sum(prediction_deduction))::int as season_points
from v_results_scored
group by runner_id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table runners enable row level security;
alter table editions enable row level security;
alter table predictions enable row level security;
alter table start_list enable row level security;
alter table results enable row level security;

-- runners: alla inloggade i gänget kan se varandra; man kan bara ändra sin egen rad.
create policy runners_select_all on runners
  for select to authenticated using (true);

create policy runners_update_own on runners
  for update to authenticated using (auth_id = auth.uid());

-- editions: alla kan läsa. Skrivning sker via service role (arrangören), inte klienten.
create policy editions_select_all on editions
  for select to authenticated using (true);

-- predictions: du ser alltid dina egna gissningar; allas gissningar syns
-- först när upplagan är avslutad (annars går spoilereffekten förlorad).
-- Du får bara lägga in gissningar medan de inte är låsta.
create policy predictions_select on predictions
  for select to authenticated using (
    guesser_runner_id in (select id from runners where auth_id = auth.uid())
    or exists (
      select 1 from editions e
      where e.id = predictions.edition_id and e.status = 'completed'
    )
  );

create policy predictions_insert_own on predictions
  for insert to authenticated with check (
    guesser_runner_id in (select id from runners where auth_id = auth.uid())
    and exists (
      select 1 from editions e
      where e.id = predictions.edition_id and e.predictions_locked = false
    )
  );

-- start_list och results: publikt läsbara (det är själva resultattavlan),
-- men skrivs bara av backend-logiken (service role kringgår RLS helt).
create policy start_list_select_all on start_list
  for select to authenticated using (true);

create policy results_select_all on results
  for select to authenticated using (true);
