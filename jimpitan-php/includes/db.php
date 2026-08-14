<?php
/**
 * Koneksi database (PDO). Jika database belum ada, tampilkan pesan
 * ramah yang mengarahkan ke setup.php / jimpitan.sql.
 */

require_once __DIR__ . '/../config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        // 1049 = unknown database. Bantu pengguna menyiapkan database.
        if ($e->getCode() === '1049' || strpos($e->getMessage(), 'Unknown database') !== false) {
            http_response_code(500);
            $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\');
            echo '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Database belum siap</title>'
                . '<link rel="stylesheet" href="' . $base . '/assets/style.css"></head><body>'
                . '<main class="container page" style="max-width:560px;padding-top:64px">'
                . '<div class="card card-pad" style="text-align:center">'
                . '<div class="empty-icon">!</div>'
                . '<h1 class="h2" style="margin-top:12px">Database belum dibuat</h1>'
                . '<p class="muted">Database <code>' . htmlspecialchars(DB_NAME) . '</code> belum ada di MySQL. '
                . 'Jalankan <a href="' . $base . '/setup.php">setup.php</a> sekali saja, atau import '
                . '<code>jimpitan.sql</code> lewat phpMyAdmin.</p>'
                . '<a class="btn btn-primary" href="' . $base . '/setup.php">Buka setup.php</a>'
                . '</div></main></body></html>';
            exit;
        }
        throw $e;
    }

    return $pdo;
}
