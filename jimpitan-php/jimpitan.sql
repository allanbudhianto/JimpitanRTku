-- ============================================================
-- JIMPITAN RT — Database MySQL (jimpitan.sql)
-- ------------------------------------------------------------
-- Skema + data awal untuk versi PHP (XAMPP).
--
-- Cara import:
--   1. Buka http://localhost/phpmyadmin
--   2. Import file ini (atau jalankan lewat tab SQL)
-- Atau cukup buka setup.php di browser — skema & data contoh
-- dibuat otomatis.
--
-- CATATAN PASSWORD: password awal di bawah disimpan sebagai teks
-- polos agar mudah di-import lewat phpMyAdmin. Saat pertama kali
-- login sukses, aplikasi otomatis menggantinya dengan hash bcrypt.
-- Segera ganti password setelah login pertama (menu Akun / admin).
-- ============================================================

CREATE DATABASE IF NOT EXISTS `jimpitan`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `jimpitan`;

-- ------------------------------------------------------------
-- 1) users — pengguna aplikasi (admin, pengurus, warga)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `pengeluaran`;
DROP TABLE IF EXISTS `jimpitan`;
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(30)  NOT NULL COMMENT 'Username login',
  `name`          VARCHAR(255) NOT NULL COMMENT 'Nama lengkap',
  `role`          ENUM('admin','pengurus','warga') NOT NULL DEFAULT 'warga',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt (seed awal plaintext, di-upgrade otomatis)',
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2) jimpitan — pembayaran iuran bulanan per warga
--    Satu baris per warga per bulan ("YYYY-MM").
-- ------------------------------------------------------------
CREATE TABLE `jimpitan` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `warga_id`       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  `month`          CHAR(7)      NOT NULL COMMENT 'Bulan pembayaran, format YYYY-MM',
  `nominal`        INT UNSIGNED NOT NULL COMMENT 'Nominal yang dibayar (Rp)',
  `recorded_by_id` BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id (pencatat)',
  `note`           VARCHAR(255)  DEFAULT NULL COMMENT 'Catatan pembayaran',
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warga_bulan` (`warga_id`, `month`),
  KEY `idx_month` (`month`),
  CONSTRAINT `fk_jimpitan_warga` FOREIGN KEY (`warga_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_jimpitan_pencatat` FOREIGN KEY (`recorded_by_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3) pengeluaran — pengeluaran kas RT
--    Saldo kas = total terkumpul - total pengeluaran.
-- ------------------------------------------------------------
CREATE TABLE `pengeluaran` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nominal`        INT UNSIGNED NOT NULL COMMENT 'Nominal pengeluaran (Rp)',
  `alasan`         VARCHAR(255) NOT NULL COMMENT 'Alasan pengeluaran',
  `recorded_by_id` BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id (pencatat)',
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pengeluaran_pencatat` (`recorded_by_id`),
  CONSTRAINT `fk_pengeluaran_pencatat` FOREIGN KEY (`recorded_by_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4) settings — pengaturan aplikasi (mis. QRIS)
-- ------------------------------------------------------------
CREATE TABLE `settings` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`        VARCHAR(32) NOT NULL COMMENT 'Kunci pengaturan, mis. "qris"',
  `qris_payload`       TEXT          DEFAULT NULL COMMENT 'String QRIS merchant (mulai 000201)',
  `qris_merchant_name` VARCHAR(255)  DEFAULT NULL COMMENT 'Nama merchant / atas nama',
  `qris_active`        TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Aktifkan pembayaran QRIS',
  `updated_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATA AWAL (diekstrak dari aplikasi Convex, per 2026-08-14)
--   Password awal sama dengan username.
--   Admin: admin/admin | Sari (pengurus): sari/sari
--   Sunaryo (warga): sunaryo/sunaryo | Tata (warga): galih/galih
-- ============================================================

INSERT INTO `users` (`id`, `username`, `name`, `role`, `password_hash`, `created_at`) VALUES
(1, 'admin',   'Admin RT', 'admin',    'admin',   '2026-08-10 04:52:25'),
(2, 'sari',    'Sari',     'pengurus', 'sari',    '2026-08-10 04:54:11'),
(3, 'sunaryo', 'Sunaryo',  'warga',    'sunaryo', '2026-08-10 06:07:19'),
(4, 'galih',   'Tata',     'warga',    'galih',   '2026-08-10 06:14:12');

INSERT INTO `jimpitan` (`id`, `warga_id`, `month`, `nominal`, `recorded_by_id`, `note`, `created_at`) VALUES
(1, 3, '2026-08', 15000, 1, 'tunai', '2026-08-10 06:37:00'),
(2, 4, '2026-08', 60000, 1, 'tunai', '2026-08-10 06:15:33');
