<?php
/**
 * setup.php — Installer sekali pakai untuk XAMPP.
 *
 * 1. Membuat database `jimpitan` (bila belum ada).
 * 2. Membuat tabel users / jimpitan / pengeluaran / settings.
 * 3. Mengisi data awal (admin, sari, sunaryo, galih + contoh iuran).
 *
 * Buka di browser: http://localhost/jimpitan-php/setup.php
 * Setelah sukses, hapus file ini atau kunci aksesnya.
 */

require_once __DIR__ . '/config.php';

function setup_pdo_server(): PDO
{
    $dsn = 'mysql:host=' . DB_HOST . ';charset=utf8mb4';
    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

$messages = [];
$error = null;

try {
    $pdo = setup_pdo_server();
    $pdo->exec(
        "CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    $pdo->exec("USE `" . DB_NAME . "`");
    $messages[] = 'Database `' . DB_NAME . '` siap.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `users` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `username` VARCHAR(30) NOT NULL,
          `name` VARCHAR(255) NOT NULL,
          `role` ENUM('admin','pengurus','warga') NOT NULL DEFAULT 'warga',
          `alamat` VARCHAR(255) DEFAULT NULL,
          `no_rumah` VARCHAR(32) DEFAULT NULL,
          `password_hash` VARCHAR(255) NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_username` (`username`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `jimpitan` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `warga_id` BIGINT UNSIGNED NOT NULL,
          `month` CHAR(7) NOT NULL,
          `nominal` INT UNSIGNED NOT NULL,
          `recorded_by_id` BIGINT UNSIGNED NOT NULL,
          `note` VARCHAR(255) DEFAULT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_warga_bulan` (`warga_id`, `month`),
          KEY `idx_month` (`month`),
          CONSTRAINT `fk_jimpitan_warga` FOREIGN KEY (`warga_id`) REFERENCES `users` (`id`),
          CONSTRAINT `fk_jimpitan_pencatat` FOREIGN KEY (`recorded_by_id`) REFERENCES `users` (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `pengeluaran` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `nominal` INT UNSIGNED NOT NULL,
          `alasan` VARCHAR(255) NOT NULL,
          `recorded_by_id` BIGINT UNSIGNED NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_pengeluaran_pencatat` (`recorded_by_id`),
          CONSTRAINT `fk_pengeluaran_pencatat` FOREIGN KEY (`recorded_by_id`) REFERENCES `users` (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `settings` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `setting_key` VARCHAR(32) NOT NULL,
          `qris_payload` TEXT DEFAULT NULL,
          `qris_merchant_name` VARCHAR(255) DEFAULT NULL,
          `qris_active` TINYINT(1) NOT NULL DEFAULT 0,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_setting_key` (`setting_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $messages[] = 'Tabel users, jimpitan, pengeluaran, settings siap.';

    // Seed pengguna (hanya bila tabel kosong).
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count === 0) {
        $seed = [
            ['admin', 'Admin RT', 'admin', null, null, 'admin'],
            ['sari', 'Sari', 'pengurus', null, null, 'sari'],
            ['sunaryo', 'Sunaryo', 'warga', '03', '13', 'sunaryo'],
            ['galih', 'Tata', 'warga', '03', '12', 'galih'],
        ];
        $stmt = $pdo->prepare(
            'INSERT INTO users (username, name, role, alamat, no_rumah, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($seed as $s) {
            $stmt->execute([$s[0], $s[1], $s[2], $s[3], $s[4], password_hash($s[5], PASSWORD_DEFAULT)]);
        }
        $messages[] = 'Data awal: admin/admin, sari/sari, sunaryo/sunaryo, galih/galih.';
    } else {
        $messages[] = 'Tabel users sudah berisi data — dilewati.';
    }

    // Seed contoh iuran (hanya bila kosong).
    $countPay = (int) $pdo->query('SELECT COUNT(*) FROM jimpitan')->fetchColumn();
    if ($countPay === 0) {
        $adminId = (int) $pdo->query("SELECT id FROM users WHERE username = 'admin'")->fetchColumn();
        $sunaryoId = (int) $pdo->query("SELECT id FROM users WHERE username = 'sunaryo'")->fetchColumn();
        $galihId = (int) $pdo->query("SELECT id FROM users WHERE username = 'galih'")->fetchColumn();
        if ($adminId && $sunaryoId && $galihId) {
            $pdo->exec("INSERT INTO jimpitan (warga_id, month, nominal, recorded_by_id, note, created_at) VALUES
                ($sunaryoId, '2026-08', 15000, $adminId, 'tunai', '2026-08-10 06:37:00'),
                ($galihId, '2026-08', 60000, $adminId, 'tunai', '2026-08-10 06:15:33')");
            $messages[] = 'Contoh iuran Agustus 2026 dimasukkan.';
        }
    } else {
        $messages[] = 'Tabel jimpitan sudah berisi data — dilewati.';
    }
} catch (PDOException $e) {
    $error = 'Gagal menyiapkan database: ' . $e->getMessage()
        . '<br>Pastikan MySQL XAMPP sudah berjalan dan kredensial di <code>config.php</code> benar '
        . '(default: user <code>root</code>, password kosong).';
}
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setup — <?= APP_NAME ?></title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="glow-bg" aria-hidden="true"></div>
<main class="container page" style="max-width:560px">
  <div class="card card-pad">
    <h1 class="h2">Setup <?= APP_NAME ?></h1>
    <p class="muted">Installer satu kali. Membuat database <code><?= DB_NAME ?></code> dan data awal.</p>

    <?php if ($error): ?>
      <div class="form-error"><?= $error ?></div>
      <div class="form-actions" style="margin-top:14px">
        <a class="btn btn-outline" href="setup.php">Coba lagi</a>
      </div>
    <?php else: ?>
      <ul style="padding-left:18px;line-height:2">
        <?php foreach ($messages as $m): ?>
          <li><?= htmlspecialchars($m) ?></li>
        <?php endforeach; ?>
      </ul>
      <div class="info-box" style="margin:14px 0">
        <strong>Akun bawaan</strong>
        <div class="row"><span>Admin</span><span><code>admin</code> / <code>admin</code></span></div>
        <div class="row"><span>Pengurus</span><span><code>sari</code> / <code>sari</code></span></div>
        <div class="row"><span>Warga</span><span><code>sunaryo</code> / <code>sunaryo</code></span></div>
        <div class="row"><span>Warga</span><span><code>galih</code> / <code>galih</code></span></div>
      </div>
      <p class="muted" style="font-size:12.5px">
        Ganti semua password segera setelah login pertama (menu Akun; admin juga lewat menu Warga &amp; Pengurus).
        Untuk keamanan, hapus file <code>setup.php</code> setelah selesai.
      </p>
      <div class="form-actions">
        <a class="btn btn-primary" href="login.php">Masuk ke aplikasi</a>
        <a class="btn btn-ghost" href="index.php">Lihat beranda</a>
      </div>
    <?php endif; ?>
  </div>
</main>
</body>
</html>
