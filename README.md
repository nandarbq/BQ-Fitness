# BQ Fitness

Aplikasi pelacak **latihan, lari/sepeda (ala Strava), makan, dan tidur** — versi lengkap dengan backend, database, dan akun pengguna (bukan lagi versi statis/localStorage).

## Teknologi

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`, tidak perlu install database server terpisah)
- **Autentikasi:** JWT + password hash (bcrypt)
- **Frontend:** HTML/CSS/JS vanilla (PWA), peta GPS pakai Leaflet + OpenStreetMap
- **Tema:** Putih-Merah (terang) & Hitam-Merah (gelap)

## Struktur Folder

```
bq-fitness/
├── server.js              # entry point server
├── package.json
├── .env.example            # contoh file environment variable
├── db/
│   └── database.js         # koneksi & skema SQLite (file bqfitness.db dibuat otomatis)
├── middleware/
│   └── auth.js             # verifikasi JWT
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

## Cara Menjalankan (lokal)

Butuh **Node.js versi 18 ke atas**.

```bash
# 1. Masuk ke folder project
cd bq-fitness

# 2. Install dependency
npm install

# 3. Salin file environment variable, lalu edit JWT_SECRET
cp .env.example .env
# buka .env, ganti JWT_SECRET dengan string acak yang panjang

# 4. Jalankan server
npm start
```

Buka `http://localhost:3000` di browser. Database SQLite (`db/bqfitness.db`) akan dibuat otomatis saat pertama kali dijalankan — tidak perlu setup manual.

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

Beberapa opsi hosting yang mendukung Node.js + file database persisten:

- **Railway** / **Render** — paling gampang, tinggal hubungkan repo Git, otomatis dapat HTTPS
- **Fly.io** — gratis untuk skala kecil, butuh volume persisten untuk file SQLite
- **VPS sendiri** (mis. DigitalOcean, Biznet) + Nginx sebagai reverse proxy + Let's Encrypt untuk SSL

Yang perlu diperhatikan saat deploy:
- Set environment variable `JWT_SECRET` ke nilai rahasia yang kuat (jangan pakai contoh dari `.env.example`)
- Pastikan folder `db/` punya storage yang **persisten** (tidak hilang saat server restart/redeploy) — kalau host pakai filesystem sementara (ephemeral), pindahkan ke Postgres/MySQL nantinya, atau gunakan volume/disk persisten yang disediakan host
- Wajib HTTPS supaya GPS tracking dan instalasi PWA berjalan penuh di semua browser

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
- Ganti `JWT_SECRET` di file `.env` sebelum dipakai serius — jangan gunakan nilai contoh
