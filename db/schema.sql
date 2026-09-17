create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  weight       real default 65,
  height       real default 170,
  sleep_target real default 8,
  created_at   timestamptz default now()
);

create table if not exists public.food_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cal     real default 2000,
  protein real default 120,
  carb    real default 220,
  fat     real default 60
);

create table if not exists public.workouts (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  date           date not null,
  duration_min   integer not null,
  exercises_json jsonb not null default '[]',
  created_at     timestamptz default now()
);

create table if not exists public.activities (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('running', 'cycling')),
  date         date not null,
  distance_km  real not null,
  duration_sec integer not null,
  kcal         integer not null,
  points_json  jsonb not null default '[]',
  created_at   timestamptz default now()
);

create table if not exists public.food_logs (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  meal     text not null,
  name     text not null,
  kcal     real default 0,
  protein  real default 0,
  carb     real default 0,
  fat      real default 0,
  created_at timestamptz default now()
);

create table if not exists public.sleep_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  start_time text not null,
  end_time   text not null,
  hours      real not null,
  quality    integer default 3,
  created_at timestamptz default now()
);

create index if not exists idx_workouts_user on public.workouts(user_id, date);
create index if not exists idx_activities_user on public.activities(user_id, date);
create index if not exists idx_food_logs_user on public.food_logs(user_id, date);
create index if not exists idx_sleep_logs_user on public.sleep_logs(user_id, date);

-- Row Level Security: tiap pengguna hanya boleh mengakses datanya sendiri.
-- Backend memakai service_role key (otomatis melewati RLS), jadi kebijakan ini
-- adalah lapisan pengaman tambahan kalau nanti ada akses langsung dari
-- frontend memakai anon key.
alter table public.profiles   enable row level security;
alter table public.food_goals enable row level security;
alter table public.workouts   enable row level security;
alter table public.activities enable row level security;
alter table public.food_logs  enable row level security;
alter table public.sleep_logs enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists food_goals_own on public.food_goals;
create policy food_goals_own on public.food_goals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists workouts_own on public.workouts;
create policy workouts_own on public.workouts
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists activities_own on public.activities;
create policy activities_own on public.activities
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists food_logs_own on public.food_logs;
create policy food_logs_own on public.food_logs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists sleep_logs_own on public.sleep_logs;
create policy sleep_logs_own on public.sleep_logs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);