# Jimpitan RT — Versi PHP + MySQL (XAMPP)

Versi lengkap aplikasi Jimpitan RT dalam **PHP murni + MySQL** yang bisa
dijalankan di **XAMPP** (Apache + MySQL + PHP), tanpa Node.js, tanpa Convex,
tanpa internet.

Fitur sama dengan aplikasi web React:
- Login session: **admin**, **pengurus**, **warga**
- **Admin**: tambah/ubah/hapus pengurus & warga, ganti password siapa pun, atur QRIS
- **Pengurus & Admin**: input/edit/hapus iuran bulanan per warga (tombol Bayar/Edit/Hapus), cari & filter rincian jimpitan (bulan, status, tanggal input, nama)
- **Pengeluaran kas**: input nominal + alasan; saldo kas otomatis berkurang; warga hanya bisa melihat
- **Warga**: lihat total iuran, jumlah warga sudah/belum bayar, pengeluaran (view-only), QRIS
- **QRIS**: tampil untuk admin, pengurus, dan warga; diatur oleh admin
- **Rekap iuran**: tabel lengkap + ekspor CSV (buka di Excel)
- Beranda publik dengan statistik kas & pengeluaran (view-only)

---

## Cara pasang di XAMPP

1. **Install & jalankan XAMPP** (https://www.apachefriends.org) — butuh PHP 8.0+.
2. Buka **XAMPP Control Panel**, start **Apache** dan **MySQL**.
3. Salin folder `jimpitan-php` ini ke folder htdocs XAMPP:
   - Windows: `C:\xampp\htdocs\jimpitan-php`
   - Linux: `/opt/lampp/htdocs/jimpitan-php`
4. Buka di browser: `http://localhost/jimpitan-php/`
5. Siapkan database — salah satu cara:

   **Cara A (paling mudah):** buka `http://localhost/jimpitan-php/setup.php`
   sekali. Database `jimpitan`, tabel, dan data awal dibuat otomatis.

   **Cara B (phpMyAdmin):** buka `http://localhost/phpmyadmin`, tab **Import**,
   pilih file `jimpitan.sql`, klik **Go**.

6. Login dengan akun bawaan:

   | Role     | Username | Password  |
   |----------|----------|-----------|
   | Admin    | `admin`  | `admin`   |
   | Pengurus | `sari`   | `sari`    |
   | Warga    | `sunaryo`| `sunaryo` |
   | Warga    | `galih`  | `galih`   |

7. **Segera ganti password** setelah login pertama (menu **Akun**; admin juga
   lewat menu **Warga & Pengurus** → tombol Password).

### Keamanan

- Password awal di `jimpitan.sql` sengaja disimpan sebagai **teks polos** agar
  mudah di-import lewat phpMyAdmin. Saat pertama kali login sukses, aplikasi
  otomatis menggantinya dengan **hash bcrypt** (`password_hash`).
- **Hapus `setup.php`** setelah instalasi selesai.
- Koneksi database dikonfigurasi di **`config.php`** (default XAMPP:
  `root` / password kosong). Sesuaikan bila perlu.

### Catatan QRIS

Kode QR dirender lewat layanan `api.qrserver.com` — butuh internet. Jika
offline, halaman QRIS menampilkan fallback teks string QRIS. Simpan string
QRIS dari aplikasi bank / e-wallet Anda (dimulai `000201`).

---

## Struktur folder

```
jimpitan-php/
├── index.php          # Beranda publik (statistik + pengeluaran view-only)
├── login.php          # Halaman login
├── logout.php
├── dashboard.php      # Area login: semua menu (beranda, jimpitan, pengeluaran, warga, QRIS, rekap, akun)
├── setup.php          # Installer sekali pakai (buat DB + data awal)
├── export.php         # Ekspor rekap iuran ke CSV
├── config.php         # Konfigurasi database & konstanta
├── jimpitan.sql       # Skema + data awal untuk import phpMyAdmin
├── README-XAMPP.md
├── assets/style.css   # Tema modern
└── includes/
    ├── db.php         # Koneksi PDO
    ├── functions.php  # Helper + logika bisnis (overview, statistik, dll)
    ├── auth.php       # Session, guard role, verifikasi password
    ├── layout.php     # Header, navigasi, komponen UI
    └── views.php      # Semua tampilan & form + handler POST
```
