-- Run As You Are — anmälan per upplaga
--
-- Hål vi hittade i 0001: startordningen räknades ut för ALLA rader i
-- `runners`, inklusive folk som inte sprungit på flera år. Det behövs ett
-- sätt att veta vilka av de redan registrerade löparna som faktiskt är med
-- ETT SPECIFIKT år, innan vi räknar ut något — annars gissar vi startplats
-- åt folk som kanske inte springer alls.
--
-- edition_entries är den bekräftelsen: en rad per löpare per år, skapad
-- när löparen (eller arrangören) säger "jag är med" eller "jag hoppar
-- över". INGEN rad alls = har inte svarat än.

create table edition_entries (
  id          uuid primary key default gen_random_uuid(),
  edition_id  uuid not null references editions (id) on delete cascade,
  runner_id   uuid not null references runners (id) on delete cascade,
  status      text not null check (status in ('confirmed', 'declined')),
  responded_at timestamptz not null default now(),
  unique (edition_id, runner_id)
);

alter table edition_entries enable row level security;

create policy edition_entries_select_all on edition_entries
  for select to authenticated using (true);

-- Du svarar för dig själv. (Arrangören kan fortfarande justera manuellt
-- via dashboarden/service-role om någon behöver hjälpas in — det kringgår
-- RLS med flit och är inte en klient-policy.)
create policy edition_entries_upsert_own on edition_entries
  for insert to authenticated with check (
    runner_id in (select id from runners where auth_id = auth.uid())
  );

create policy edition_entries_update_own on edition_entries
  for update to authenticated using (
    runner_id in (select id from runners where auth_id = auth.uid())
  );
