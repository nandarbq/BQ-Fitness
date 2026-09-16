-- BQ Fitness - Skema database Supabase (PostgreSQL)
-- Jalankan skrip ini di SQL Editor dashboard Supabase.

create table if not exists public.users (
  id            bigint generated always as identity primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  weight        real default 65,
  height        real default 170,
  sleep_target  real default 8,
  created_at    timestamptz default now()
);

create table if not exists public.food_goals (
  user_id bigint primary key references public.users(id) on delete cascade,
  cal     real default 2000,
  protein real default 120,
  carb    real default 220,
  fat     real default 60
);

create table if not exists public.workouts (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users(id) on delete cascade,
  name           text not null,
  date           date not null,
  duration_min   integer not null,
  exercises_json jsonb not null default '[]',
  created_at     timestamptz default now()
);

create table if not exists public.activities (
  id           bigint generated always as identity primary key,
  user_id      bigint not null references public.users(id) on delete cascade,
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
  user_id  bigint not null references public.users(id) on delete cascade,
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
  user_id    bigint not null references public.users(id) on delete cascade,
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

-- Backend memakai service_role key sehingga RLS dilewati.
-- (Aktifkan RLS + policies nanti jika ingin lapisan keamanan tambahan.)