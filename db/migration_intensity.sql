-- ============================================================
-- MIGRASI TAMBAHAN: Intensitas latihan (Pemula/Menengah/Mahir)
-- Catatan: skrip ini AMAN dijalankan di database yang sudah ada
-- (menambah kolom saja, tidak menghapus data). Jalankan sekali
-- di Supabase SQL Editor setelah migration_program.sql.
-- Nilai valid: 'pemula' | 'menengah' | 'mahir' (null = belum diisi).
-- ============================================================

alter table public.profiles
  add column if not exists intensity text default null;