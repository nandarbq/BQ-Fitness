# BQ Fitness

Aplikasi pelacak **latihan, lari/sepeda (ala Strava), makan, dan tidur** — versi lengkap dengan backend, database, dan akun pengguna (bukan lagi versi statis/localStorage).

## Teknologi

- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL) lewat `@supabase/supabase-js` — gratis, terkelola, bisa diakses dari mana pun
- **Autentikasi:** JWT + password hash (bcrypt), data pengguna & kata sandi tetap disimpan di app ini (tidak pakai Supabase Auth)
- **Frontend:** HTML/CSS/JS vanilla (PWA), peta GPS pakai Leaflet + OpenStreetMap
- **Tema:** Putih-Merah (terang) & Hitam-Merah (gelap)

## Struktur Folder

```
bq-fitness/
├── server.js              # entry point server
├── package.json
├── .env.example            # contoh file environment variable
├── db/
│   ├── schema.sql          # skema tabel untuk dijalankan di SQL Editor Supabase
│   └── database.js         # koneksi ke Supabase (client @supabase/supabase-js)
├── middleware/
│   ├── auth.js             # verifikasi JWT
│   └── asyncHandler.js     # pembungkus handler async agar error sampai ke Express
├── routes/
│   ├── auth.js              # register, login, /me
│   ├── profile.js
│   ├── workouts.js
│   ├── activities.js        # lari & sepeda dengan titik GPS
│   ├── food.js
│   └── sleep.js
└── public/                  # frontend (disajikan langsung oleh Express)
    ├── index.html
    ├── manifest.json
    ├── sw.js
    ├── css/style.css
    ├── icons/
    └── js/
        ├── api.js            # client API (pengganti localStorage)
        ├── auth-ui.js         # layar login/daftar
        ├── theme.js, nav.js
        ├── dashboard.js, workout.js, running.js, food.js, sleep.js
        └── app.js
```

## Setup Supabase (sekali saja)

1. Buat akun di [supabase.com](https://supabase.com), lalu **New project** (pilih region terdekat).
2. Buka menu **SQL Editor** → **New query**, paste isi file `db/schema.sql`, lalu **Run**. Ini membuat semua tabel & index.
3. Buka **Project Settings → API**. Salin **Project URL** dan **service_role key** (rahasia, jangan pernah taruh di frontend).
4. Buat file `.env` dari `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Lalu isi `JWT_SECRET`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY`.

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

Buka `http://localhost:3000` di browser. Tabel & data tersimpan otomatis di Supabase.

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
- Set environment variable di hosting: `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (nilai kuat yang rahasia, jangan pakai contoh)
- Wajib HTTPS supaya GPS tracking dan instalasi PWA berjalan penuh di semua browser
- Service role key Supabase **hanya dipakai di server**, jangan pernah dibuka di frontend

## Fitur

- **Autentikasi akun** — daftar & masuk, data tersimpan di server per-pengguna (bisa dipakai dari HP mana pun, tidak hilang saat ganti device/browser)
- **Dashboard** — ring kalori, ringkasan tidur/latihan/jarak, streak harian, insight otomatis (korelasi tidur vs hari aktif)
- **Latihan** — sesi latihan dengan timer & daftar gerakan, riwayat tersimpan
- **Lari/Sepeda (ala Strava)** — pelacakan GPS langsung di peta, jarak/waktu/pace/kalori, riwayat rute
- **Makan** — catatan per waktu makan, kalori & makro, target harian yang bisa diatur
- **Tidur** — catatan jam tidur-bangun & kualitas, grafik 7 hari
- **PWA** — bisa di-install ke home screen, tetap tampil offline untuk halaman yang sudah dibuka (data baru tetap butuh koneksi ke server)

## Catatan tentang GPS di PWA

Karena ini PWA (bukan aplikasi native), pelacakan GPS paling stabil kalau layar HP tetap menyala saat lari/sepeda. Aplikasi ini sudah memakai **Wake Lock API** untuk membantu, tapi iOS Safari tetap lebih ketat soal akses lokasi di background dibanding Android. Kalau ke depannya ingin tracking latar belakang yang benar-benar solid, opsi lanjutannya adalah membungkus aplikasi ini jadi aplikasi native lewat Capacitor.

## Keamanan

- Password di-hash dengan bcrypt, tidak pernah disimpan dalam bentuk teks biasa
- Setiap endpoint data (workout, aktivitas, makan, tidur) diverifikasi lewat token JWT dan hanya mengembalikan data milik pengguna yang sedang login
- Query ke Supabase selalu difilter dengan `user_id` dari token di backend
- Ganti `JWT_SECRET` di file `.env` sebelum dipakai serius — jangan gunakan nilai contoh