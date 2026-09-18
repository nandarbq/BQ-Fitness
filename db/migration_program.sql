-- ============================================================
-- MIGRASI TAMBAHAN: Program, Onboarding, dan Riwayat Berat Badan
-- Catatan: skrip ini AMAN dijalankan di database yang sudah ada.
-- Berbeda dengan schema.sql yang reset penuh, skrip ini hanya MENAMBAH.
-- Jalankan sekali di Supabase SQL Editor.
-- ============================================================

-- Kolom program & onboarding di tabel profiles (hanya ditambah jika belum ada)
alter table public.profiles add column if not exists gender            text    default null;
alter table public.profiles add column if not exists age               integer default null;
alter table public.profiles add column if not exists activity_level    integer default null;
alter table public.profiles add column if not exists program           text    default null;
alter table public.profiles add column if not exists program_start     date    default null;
alter table public.profiles add column if not exists start_weight      real    default null;
alter table public.profiles add column if not exists target_weight     real    default null;
alter table public.profiles add column if not exists duration_weeks    integer default null;
alter table public.profiles add column if not exists last_weight_date  date    default null;

-- Tabel riwayat berat badan mingguan
create table if not exists public.weight_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  weight_kg  real not null,
  created_at timestamptz default now()
);

create index if not exists idx_weight_logs_user on public.weight_logs(user_id, date);

alter table public.weight_logs enable row level security;

drop policy if exists weight_logs_own on public.weight_logs;
create policy weight_logs_own on public.weight_logs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);