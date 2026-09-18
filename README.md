# BQ Fitness

Aplikasi pelacak **latihan, lari/sepeda (ala Strava), makan, dan tidur** — versi lengkap dengan backend, database, dan akun pengguna (bukan lagi versi statis/localStorage).

## Teknologi

- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL) lewat `@supabase/supabase-js` — gratis, terkelola, bisa diakses dari mana pun
- **Autentikasi:** **Supabase Auth** (email + password, JWT access/refresh token otomatis dikelola), profil pengguna disimpan di tabel `public.profiles`
- **Frontend:** HTML/CSS/JS vanilla (PWA), peta GPS pakai Leaflet + OpenStreetMap
- **Tema:** Putih-Merah (terang) & Hitam-Merah (gelap)

## Struktur Folder

```
bq-fitness/
├── server.js              # entry point server
├── package.json
├── .env.example            # contoh file environment variable
├── db/
│   ├── schema.sql            # skema tabel BQ Fitness (reset + buat ulang, versi Supabase Auth)
│   └── database.js           # koneksi ke Supabase (client @supabase/supabase-js)
├── lib/
│   └── program.js            # logika rekomendasi program & target makan
├── middleware/
│   ├── auth.js               # verifikasi token lewat Supabase Auth
│   └── asyncHandler.js       # pembungkus handler async agar error sampai ke Express
├── routes/
│   ├── auth.js              # register, login, refresh, logout, reset/update password, /me
│   ├── profile.js
│   ├── program.js            # onboarding, status program, update BB, transisi program
│   ├── workouts.js
│   ├── activities.js        # lari & sepeda dengan titik GPS
│   ├── food.js
│   └── sleep.js
└── public/                  # frontend (disajikan langsung oleh Express)
    ├── index.html
    ├── reset-password.html  # halaman atur ulang kata sandi (dibuka dari email)
    ├── manifest.json
    ├── sw.js
    ├── css/style.css
    ├── icons/
    └── js/
        ├── api.js            # client API (session access/refresh token dengan auto-refresh)
        ├── workout-program.js # jadwal mingguan & katalog gerakan dumbbell (intensitas, rest bisa digeser)
        ├── exercise-demo.js  # animasi siluet SVG "template tutor" tiap gerakan
        ├── auth-ui.js        # layar login/daftar + lupa kata sandi
        ├── reset-password.js # logika halaman atur ulang kata sandi
        ├── onboarding.js     # alur wajib: onboarding awal, BB mingguan, transisi program
        ├── theme.js, nav.js
        ├── dashboard.js, workout.js, running.js, food.js, sleep.js
        └── app.js
```

## Setup Supabase (sekali saja)

1. Buat akun di [supabase.com](https://supabase.com), lalu **New project** (pilih region terdekat).
2. Buka menu **SQL Editor** → **New query**, paste isi file `db/schema.sql`, lalu **Run**. File ini **menghapus tabel data lama lalu membuat ulang dari nol** (reset penuh), jadi pastikan tidak ada data penting yang bakal hilang.
3. Buka **Project Settings → API**. Salin **Project URL** dan **service_role key** (rahasia, jangan pernah taruh di frontend).
4. Buka **Authentication → Providers**: pastikan provider **Email** aktif (default untuk project baru: aktif).
5. Buka **Authentication → URL Configuration → Redirect URLs**: tambahkan `APP_URL` kamu (mis. `http://localhost:3000` dan URL production). Tanpa ini link reset password tidak akan mengarah ke aplikasi.
6. Buat file `.env` dari `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Lalu isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `APP_URL`.

> Catatan email: Supabase bisa langsung mengirim email (verifikasi/reset) memakai mailer bawaan. Untuk volume besar sebaiknya pasang **custom SMTP** di Authentication → SMTP, dan sesuaikan *templates email* (Confirm signup / Reset password) agar link mengarah ke `APP_URL`.

## Cara Menjalankan (lokal)

Butuh **Node.js versi 18 ke atas**.

```bash
# 1. Masuk ke folder project
cd bq-fitness

# 2. Install dependency
npm install

# 3. Siapkan .env (lihat bagian Setup Supabase di atas)

# 4. Jalankan server
npm start
```

Buka `http://localhost:3000` di browser. Akun & data tersimpan otomatis di Supabase.

Untuk pengembangan dengan auto-restart saat file berubah:
```bash
npm run dev
```

## Mencoba dari HP di jaringan yang sama

1. Cari alamat IP lokal komputer kamu (mis. `192.168.1.5`)
2. Jalankan server (`npm start`)
3. Di HP, buka `http://192.168.1.5:3000` (harus satu WiFi)
4. **Catatan:** fitur GPS (lari/sepeda) dan "Add to Home Screen" butuh koneksi **HTTPS** kecuali diakses lewat `localhost`. Untuk tes GPS dari HP secara penuh, deploy dulu ke hosting dengan HTTPS (lihat bagian bawah).

## Deploy ke Production (disarankan)

Karena database kini di Supabase (bukan file lokal), kamu bebas memakai hosting Node.js apa pun tanpa perlu worry soal penyimpanan file persisten:

- **Railway** / **Render** — paling gampang, tinggal hubungkan repo Git, otomatis dapat HTTPS
- **Fly.io**, **Vercel**, atau **VPS** (mis. DigitalOcean/Biznet) + Nginx reverse proxy

Yang perlu diperhatikan saat deploy:
- Set environment variable di hosting: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (nilai kuat yang rahasia, jangan pakai contoh)
- Wajib HTTPS supaya GPS tracking dan instalasi PWA berjalan penuh di semua browser
- Tambahkan URL production ke **Authentication → URL Configuration → Redirect URLs** di Supabase (untuk link reset password)
- Service role key Supabase **hanya dipakai di server**, jangan pernah dibuka di frontend

## Reset database (kalau ada tabel versi lama)

Satu-satunya skrip skema adalah `db/schema.sql` (sudah termasuk semua fitur program: kolom `gender/age/activity_level/intensity/rest_days`, tabel `weight_logs`, dst.). Di bagian atasnya dia menghapus tabel lama (termasuk `public.users` versi lama) lalu membuat ulang dari nol — **data lama ikut terhapus**. Cukup jalankan ulang sekali di SQL Editor, lalu tinggal daftar akun baru (tahap pengembangan, jadi boleh wipe).

> Setelah ranah ulang, user baru mengisi onboarding BB/TB/aktivitas + intensitas latihan; jadwal rest default otomatis jadi Rabu/Sabtu/Minggu.

## Fitur

- **Autentikasi akun (Supabase Auth)** — daftar & masuk, data tersimpan di server per-pengguna (bisa dipakai dari HP mana pun, tidak hilang saat ganti device/browser). Ada **lupa kata sandi** via email, sesi access/refresh token yang di-refresh otomatis, dan logout yang mencabut sesi server
- **Dashboard** — ring kalori, ringkasan tidur/latihan/jarak, streak harian, insight otomatis (korelasi tidur vs hari aktif)
- **Latihan** — **program bulking/cutting otomatis**: onboarding awal wajib isi BB/TB/gender/umur/aktivitas **+ intensitas latihan (Pemula/Menengah/Mahir)** yang memengaruhi jumlah set, saran beban dumbbell, dan istirahat. Aplikasi merekomendasikan program + target BB + durasi ideal + target makan (kalori/makro) otomatis. Update BB wajib tiap 7 hari. Semua gerakan **dumbbell-only**, dan sesi latihan disajikan sebagai **pemutar gerakan**: animasi siluet "template tutor" yang berulang, keterangan set × repetisi + beban + istirahat, tombol **Lanjut**/**Kembali** (tanpa repot mencentang tiap set). Jadwal menempel nama hari (**Day 1 = Senin**, default latihan Senin/Selasa/Kamis/Jumat, rest Rabu/Sabtu/Minggu) dan user bisa **memindahkan 3 hari rest** lewat editor — urutan latihan (Chest & Triceps → Back & Biceps → Shoulder → Leg Day) ikut menyesuaikan; rest day terakhir otomatis jadi "Rest / Kardio". Ada **alert** bila 1+ latihan terlewat di pekan berjalan. Sesi yang belum tuntas **bisa dilanjutkan** (ter-simpan otomatis saat "Selesai lebih awal" / tutup aplikasi), dan **riwayat bisa dihapus** lewat tombol sampah dengan tombol **Urungkan**. Bila target BB tercapai lebih awal muncul modal pilih fase + opsi **"Lanjut program — target baru"** (siklus baru dihitung dari BB sekarang); bila durasi (mis. 32 minggu) habis tapi target belum tercapai, tombol **"Evaluasi Target"** → modal **Perpanjang (siklus baru) / Evaluasi ulang (rekomendasi BMI-BB terbaru) / Pindah fase**. Riwayat tetap tersimpan.
- **Lari/Sepeda (ala Strava)** — pelacakan GPS langsung di peta, jarak/waktu/pace/kalori, riwayat rute
- **Makan** — catatan per waktu makan, kalori & makro, target harian yang bisa diatur
- **Tidur** — catatan jam tidur-bangun & kualitas, grafik 7 hari
- **PWA** — bisa di-install ke home screen, tetap tampil offline untuk halaman yang sudah dibuka (data baru tetap butuh koneksi ke server)

## Catatan tentang GPS di PWA

Karena ini PWA (bukan aplikasi native), pelacakan GPS paling stabil kalau layar HP tetap menyala saat lari/sepeda. Aplikasi ini sudah memakai **Wake Lock API** untuk membantu, tapi iOS Safari tetap lebih ketat soal akses lokasi di background dibanding Android. Kalau ke depannya ingin tracking latar belakang yang benar-benar solid, opsi lanjutannya adalah membungkus aplikasi ini jadi aplikasi native lewat Capacitor.

## Keamanan

- Autentikasi ditangani **Supabase Auth**: password di-hash dengan algoritma aman (scrypt/bcrypt), tidak pernah disimpan dalam teks biasa, ada rate limiting percobaan login, dan access token berumur pendek + refresh token dapat dicabut saat logout
- Setiap endpoint data (workout, aktivitas, makan, tidur) diverifikasi token lewat `supabase.auth.getUser()` dan hanya mengembalikan data milik pengguna yang sedang login (`user_id` diambil dari token di backend)
- Query ke Supabase selalu difilter dengan `user_id` dari token di backend
- Tabel public mengaktifkan **Row Level Security** (tiap user cuma bisa akses datanya sendiri); backend tetap memakai service_role key yang dianggap sah melewati RLS
- Jaga `SUPABASE_SERVICE_ROLE_KEY` dan `APP_URL` tetap rahasia; jangan pernah menaruh service role key di frontend