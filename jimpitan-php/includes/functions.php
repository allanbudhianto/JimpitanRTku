<?php
/**
 * Fungsi bantu: format, tanggal, bulan, flash, CSRF, dan logika bisnis
 * (overview jimpitan, statistik, pengeluaran, rekap, QRIS).
 */

require_once __DIR__ . '/db.php';

const BULAN_INDONESIA = [
    1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
    7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
];

const BULAN_SINGKAT = [
    1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr', 5 => 'Mei', 6 => 'Jun',
    7 => 'Jul', 8 => 'Agu', 9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des',
];

/* ------------------------------------------------------------------ */
/* Helper dasar                                                        */
/* ------------------------------------------------------------------ */

function e(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

function rupiah(int $n): string
{
    return 'Rp ' . number_format($n, 0, ',', '.');
}

function redirect(string $url): void
{
    header('Location: ' . $url);
    exit;
}

function validMonth(?string $m): ?string
{
    return ($m !== null && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m)) ? $m : null;
}

function currentMonthKey(): string
{
    return date('Y-m');
}

function monthIndex(string $month): int
{
    [$y, $m] = array_map('intval', explode('-', $month));
    return $y * 12 + ($m - 1);
}

function shiftMonthKey(string $month, int $delta): string
{
    [$y, $m] = array_map('intval', explode('-', $month));
    return date('Y-m', mktime(0, 0, 0, $m + $delta, 1, $y));
}

function monthLabel(string $month): string
{
    [$y, $m] = array_map('intval', explode('-', $month));
    return BULAN_INDONESIA[$m] . ' ' . $y;
}

function monthShortLabel(string $month): string
{
    [$y, $m] = array_map('intval', explode('-', $month));
    return BULAN_SINGKAT[$m] . ' ' . substr((string) $y, 2);
}

/** Format tanggal DB (Y-m-d H:i:s) menjadi "10 Agu 2026" (+jam bila diminta). */
function formatTanggal(?string $datetime, bool $withTime = false): string
{
    if (!$datetime) {
        return '—';
    }
    $ts = strtotime($datetime);
    $out = (int) date('j', $ts) . ' ' . BULAN_SINGKAT[(int) date('n', $ts)] . ' ' . (int) date('Y', $ts);
    if ($withTime) {
        $out .= ', ' . date('H:i', $ts);
    }
    return $out;
}

function initials(?string $name): string
{
    $parts = array_values(array_filter(preg_split('/\s+/', trim((string) $name)) ?: []));
    if (!$parts) {
        return '?';
    }
    $first = mb_substr($parts[0], 0, 1);
    $last = count($parts) > 1 ? mb_substr(end($parts), 0, 1) : '';
    return mb_strtoupper($first . $last);
}

/* ------------------------------------------------------------------ */
/* Flash message & CSRF                                                */
/* ------------------------------------------------------------------ */

function flash_set(string $type, string $msg): void
{
    $_SESSION['flash'][] = ['type' => $type, 'msg' => $msg];
}

function flash_get(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function verify_csrf(): void
{
    $token = (string) ($_POST['csrf'] ?? '');
    if ($token === '' || !hash_equals(csrf_token(), $token)) {
        http_response_code(403);
        exit('Sesi kedaluwarsa. Silakan kembali dan muat ulang halaman.');
    }
}

/* ------------------------------------------------------------------ */
/* Logika bisnis                                                       */
/* ------------------------------------------------------------------ */

/** QRIS settings (baris "qris" di tabel settings). */
function getQris(PDO $pdo): array
{
    $stmt = $pdo->prepare("SELECT * FROM settings WHERE setting_key = 'qris'");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!$row) {
        return ['qris_payload' => null, 'qris_merchant_name' => null, 'qris_active' => 0];
    }
    return $row;
}

/**
 * Overview satu bulan: daftar warga + status lunas/belum + total.
 * Meniru logika convex getOverview (kelebihan pembayaran diakumulasikan).
 */
function overviewForMonth(PDO $pdo, string $month): array
{
    $warga = $pdo->query(
        "SELECT id, name, alamat, no_rumah FROM users WHERE role = 'warga' ORDER BY name ASC"
    )->fetchAll();

    $all = $pdo->query("SELECT * FROM jimpitan")->fetchAll();

    $payments = array_values(array_filter($all, fn ($p) => $p['month'] === $month));

    $historyByWarga = [];
    foreach ($all as $p) {
        $historyByWarga[$p['warga_id']][] = $p;
    }

    $paymentByWarga = [];
    foreach ($payments as $p) {
        $paymentByWarga[$p['warga_id']] = $p;
    }

    $recorderNames = [];
    $recorderIds = array_unique(array_column($payments, 'recorded_by_id'));
    if ($recorderIds) {
        $in = implode(',', array_map('intval', $recorderIds));
        $recorderNames = $pdo->query("SELECT id, name FROM users WHERE id IN ($in)")->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    $targetIdx = monthIndex($month);
    $rows = [];
    foreach ($warga as $w) {
        $history = $historyByWarga[$w['id']] ?? [];
        $payment = $paymentByWarga[$w['id']] ?? null;

        // Kewajiban dimulai dari bulan pertama warga tercatat membayar.
        $startIdx = null;
        $paidBefore = 0;
        foreach ($history as $p) {
            $idx = monthIndex($p['month']);
            if ($startIdx === null || $idx < $startIdx) {
                $startIdx = $idx;
            }
            if ($p['month'] < $month) {
                $paidBefore += (int) $p['nominal'];
            }
        }

        $saldoBefore = $startIdx === null
            ? 0
            : $paidBefore - max(0, $targetIdx - $startIdx) * JIMPITAN_PER_BULAN;

        $paidAt = $payment ? (int) $payment['nominal'] : 0;
        $lunas = ($startIdx === null || $targetIdx < $startIdx)
            ? $paidAt > 0
            : ($saldoBefore + $paidAt >= JIMPITAN_PER_BULAN);

        $rows[] = [
            'warga'          => $w,
            'saldoBefore'    => $saldoBefore,
            'status'         => $lunas ? 'lunas' : 'belum',
            'payment'        => $payment,
            'recordedByName' => $payment ? ($recorderNames[$payment['recorded_by_id']] ?? 'Pengurus') : null,
        ];
    }

    $total = (int) array_sum(array_column($payments, 'nominal'));
    $paidCount = count(array_filter($rows, fn ($r) => $r['status'] === 'lunas'));

    return [
        'month'       => $month,
        'totalWarga'  => count($warga),
        'paidCount'   => $paidCount,
        'unpaidCount' => count($warga) - $paidCount,
        'total'       => $total,
        'target'      => count($warga) * JIMPITAN_PER_BULAN,
        'rows'        => $rows,
    ];
}

/** Statistik publik untuk beranda (tanpa nama warga perorangan). */
function publicStats(PDO $pdo): array
{
    $totalWarga = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'warga'")->fetchColumn();

    $all = $pdo->query("SELECT * FROM jimpitan")->fetchAll();
    $expenses = $pdo->query("SELECT * FROM pengeluaran")->fetchAll();

    $byMonth = [];
    $grandTotal = 0;
    foreach ($all as $p) {
        $byMonth[$p['month']] = ($byMonth[$p['month']] ?? 0) + (int) $p['nominal'];
        $grandTotal += (int) $p['nominal'];
    }
    $totalPengeluaran = (int) array_sum(array_column($expenses, 'nominal'));

    $months = array_keys($byMonth);
    sort($months);
    $latestMonth = $months ? end($months) : null;

    $latestPaid = 0;
    $latestTotal = 0;
    if ($latestMonth) {
        $ov = overviewForMonth($pdo, $latestMonth);
        $latestPaid = $ov['paidCount'];
        $latestTotal = $ov['total'];
    }

    $series = [];
    foreach (array_slice($months, -6) as $m) {
        $series[] = ['month' => $m, 'total' => $byMonth[$m]];
    }

    return [
        'grandTotal'      => $grandTotal,
        'totalPengeluaran' => $totalPengeluaran,
        'saldo'           => $grandTotal - $totalPengeluaran,
        'totalWarga'      => $totalWarga,
        'monthsCount'     => count($months),
        'latestMonth'     => $latestMonth,
        'latestTotal'     => $latestTotal,
        'latestPaid'      => $latestPaid,
        'latestUnpaid'    => max(0, $totalWarga - $latestPaid),
        'targetPerMonth'  => $totalWarga * JIMPITAN_PER_BULAN,
        'series'          => $series,
    ];
}

/** Daftar pengeluaran (terbaru dulu) + total. */
function listPengeluaran(PDO $pdo): array
{
    $items = $pdo->query(
        "SELECT p.id, p.nominal, p.alasan, p.created_at, u.name AS recorded_by_name
         FROM pengeluaran p
         JOIN users u ON u.id = p.recorded_by_id
         ORDER BY p.created_at DESC, p.id DESC"
    )->fetchAll();

    return [
        'items' => $items,
        'total' => (int) array_sum(array_column($items, 'nominal')),
    ];
}

/** Pengeluaran untuk beranda (view-only, maksimal 8 baris). */
function publicExpenses(PDO $pdo): array
{
    $list = listPengeluaran($pdo);
    return [
        'items' => array_slice($list['items'], 0, 8),
        'total' => $list['total'],
        'count' => count($list['items']),
    ];
}

/** Rekap semua pembayaran (bulan terbaru dulu, lalu nama). */
function listRekap(PDO $pdo): array
{
    return $pdo->query(
        "SELECT j.id, j.month, j.nominal, j.note, j.created_at,
                w.name AS nama, w.no_rumah, w.alamat,
                r.name AS dicatat_oleh
         FROM jimpitan j
         JOIN users w ON w.id = j.warga_id
         JOIN users r ON r.id = j.recorded_by_id
         ORDER BY j.month DESC, w.name ASC"
    )->fetchAll();
}

/** Daftar bulan yang punya data pembayaran (terbaru dulu). */
function monthsWithData(PDO $pdo): array
{
    $months = $pdo->query("SELECT DISTINCT month FROM jimpitan ORDER BY month DESC")->fetchAll(PDO::FETCH_COLUMN);
    return $months ?: [];
}
