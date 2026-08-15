<?php
/**
 * Dashboard — area login untuk admin, pengurus, dan warga.
 * Tampilan diatur lewat ?view=... dan form lewat ?form=...
 */

require_once __DIR__ . '/includes/views.php';

$user = require_login();
$pdo = db();

$ALLOWED = [
    'beranda'     => ['admin', 'pengurus', 'warga'],
    'jimpitan'    => ['admin', 'pengurus', 'warga'],
    'pengeluaran' => ['admin', 'pengurus', 'warga'],
    'warga'       => ['admin'],
    'qris'        => ['admin', 'pengurus', 'warga'],
    'rekap'       => ['admin', 'pengurus'],
    'kontak'      => ['admin', 'pengurus', 'warga'],
    'akun'        => ['admin', 'pengurus', 'warga'],
];

$view = (string) ($_GET['view'] ?? 'beranda');
if (!isset($ALLOWED[$view]) || !in_array($user['role'], $ALLOWED[$view], true)) {
    $view = 'beranda';
}
$form = (string) ($_GET['form'] ?? '');

// ---- Handler POST (PRG: redirect setelah selesai) ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handle_post($user, $pdo);
}

// ---- Halaman form ----
if ($form !== '') {
    render_form_page($user, $pdo, $view, $form);
    exit;
}

// ---- Tampilan utama ----
switch ($view) {
    case 'jimpitan':
        render_jimpitan($user, $pdo);
        break;
    case 'pengeluaran':
        render_pengeluaran($user, $pdo);
        break;
    case 'warga':
        render_warga($user, $pdo);
        break;
    case 'qris':
        render_qris($user, $pdo);
        break;
    case 'rekap':
        render_rekap($user, $pdo);
        break;
    case 'kontak':
        render_kontak($user, $pdo);
        break;
    case 'akun':
        render_akun($user, $pdo);
        break;
    default:
        render_beranda($user, $pdo);
}
