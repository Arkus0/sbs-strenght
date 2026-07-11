create schema if not exists sbs_private;

create sequence if not exists public.sync_change_version_seq as bigint;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  change_version bigint not null default nextval('public.sync_change_version_seq'),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.programs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  change_version bigint not null default nextval('public.sync_change_version_seq'),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  change_version bigint not null default nextval('public.sync_change_version_seq'),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  change_version bigint not null default nextval('public.sync_change_version_seq'),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index programs_user_change_idx on public.programs (user_id, change_version);
create index sessions_user_change_idx on public.sessions (user_id, change_version);
create index sessions_program_id_idx on public.sessions (program_id);
create index measurements_user_change_idx on public.measurements (user_id, change_version);

create or replace function sbs_private.bump_sync_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.change_version = nextval('public.sync_change_version_seq');
  return new;
end;
$$;

create trigger profiles_bump_sync before update on public.profiles for each row execute function sbs_private.bump_sync_version();
create trigger programs_bump_sync before update on public.programs for each row execute function sbs_private.bump_sync_version();
create trigger sessions_bump_sync before update on public.sessions for each row execute function sbs_private.bump_sync_version();
create trigger measurements_bump_sync before update on public.measurements for each row execute function sbs_private.bump_sync_version();

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.sessions enable row level security;
alter table public.measurements enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy programs_select_own on public.programs for select to authenticated using ((select auth.uid()) = user_id);
create policy programs_insert_own on public.programs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy programs_update_own on public.programs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy programs_delete_own on public.programs for delete to authenticated using ((select auth.uid()) = user_id);

create policy sessions_select_own on public.sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy sessions_insert_own on public.sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sessions_update_own on public.sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sessions_delete_own on public.sessions for delete to authenticated using ((select auth.uid()) = user_id);

create policy measurements_select_own on public.measurements for select to authenticated using ((select auth.uid()) = user_id);
create policy measurements_insert_own on public.measurements for insert to authenticated with check ((select auth.uid()) = user_id);
create policy measurements_update_own on public.measurements for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy measurements_delete_own on public.measurements for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.programs, public.sessions, public.measurements from anon;
grant select, insert, update, delete on public.profiles, public.programs, public.sessions, public.measurements to authenticated;
grant usage, select on sequence public.sync_change_version_seq to authenticated;
grant usage on schema sbs_private to authenticated;
grant execute on function sbs_private.bump_sync_version() to authenticated;
revoke execute on function sbs_private.bump_sync_version() from public, anon;
