<?php
/**
 * export.php — Ekspor rekap iuran ke CSV (bisa dibuka di Excel).
 * Hanya admin & pengurus.
 */

require_once __DIR__ . '/includes/auth.php';

require_role(['admin', 'pengurus']);

$rows = listRekap(db());

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="rekap-jimpitan-' . date('Ymd-His') . '.csv"');
header('Cache-Control: no-store');

// BOM agar karakter Indonesia terbaca benar di Excel.
echo "\xEF\xBB\xBF";

$out = fopen('php://output', 'w');

fputcsv($out, ['No', 'Bulan', 'Nama', 'Nominal (Rp)', 'Dicatat Oleh', 'Tanggal Input', 'Catatan']);

$no = 1;
foreach ($rows as $r) {
    fputcsv($out, [
        $no,
        $r['month'],
        $r['nama'],
        (int) $r['nominal'],
        $r['dicatat_oleh'],
        date('Y-m-d H:i', strtotime($r['created_at'])),
        normalizeNote($r['note'] ?? ''),
    ]);
    $no++;
}

fclose($out);
exit;
