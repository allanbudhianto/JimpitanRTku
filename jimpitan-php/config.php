<?php
/**
 * Konfigurasi aplikasi Jimpitan RT (versi PHP + MySQL untuk XAMPP).
 *
 * Sesuaikan nilai DB_* bila kredensial MySQL Anda berbeda.
 * Default XAMPP: user "root", password kosong.
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'jimpitan');
define('DB_USER', 'root');
define('DB_PASS', '');

/** Iuran wajib setiap warga per bulan (Rp). */
define('JIMPITAN_PER_BULAN', 15000);

define('APP_NAME', 'Jimpitan RT');
define('APP_TAGLINE', 'Kas & iuran warga');

date_default_timezone_set('Asia/Jakarta');
