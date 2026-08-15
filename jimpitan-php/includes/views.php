<?php
/**
 * Semua tampilan dashboard (beranda, rincian jimpitan, pengeluaran,
 * warga & pengurus, QRIS, rekap, akun) plus halaman form & handler POST.
 */

require_once __DIR__ . '/layout.php';

/* ================================================================== */
/* Handler POST (dipanggil dari dashboard.php)                        */
/* ================================================================== */

function handle_post(array $user, PDO $pdo): void
{
    verify_csrf();
    $action = (string) ($_POST['action'] ?? '');
    $backView = in_array($_POST['back_view'] ?? '', ['beranda', 'jimpitan', 'pengeluaran', 'warga', 'qris', 'rekap', 'akun'], true)
        ? (string) $_POST['back_view']
        : 'beranda';
    $back = 'dashboard.php?view=' . $backView;

    // Kembali ke bulan yang sama saat menyimpan pembayaran.
    if ($backView === 'jimpitan' && validMonth((string) ($_POST['back_month'] ?? '')) !== null) {
        $back .= '&month=' . urlencode((string) $_POST['back_month']);
    }

    $manage = can_manage($user['role']);

    switch ($action) {
        /* ----- Jimpitan ----- */
        case 'pay':
            require_role(['admin', 'pengurus']);
            $wargaId = (int) ($_POST['warga_id'] ?? 0);
            $month = validMonth((string) ($_POST['month'] ?? ''));
            $nominal = (int) preg_replace('/\D/', '', (string) ($_POST['nominal'] ?? ''));
            $note = mb_substr(trim((string) ($_POST['note'] ?? '')), 0, 255);

            if (!$month) {
                flash_set('error', 'Bulan tidak valid.');
                break;
            }
            if ($nominal <= 0) {
                flash_set('error', 'Nominal harus lebih dari 0.');
                break;
            }
            $w = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'warga'");
            $w->execute([$wargaId]);
            if (!$w->fetch()) {
                flash_set('error', 'Warga tidak ditemukan.');
                break;
            }

            $stmt = $pdo->prepare(
                'INSERT INTO jimpitan (warga_id, month, nominal, recorded_by_id, note)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   nominal = VALUES(nominal),
                   recorded_by_id = VALUES(recorded_by_id),
                   note = VALUES(note)'
            );
            $stmt->execute([$wargaId, $month, $nominal, (int) $user['id'], $note !== '' ? $note : null]);
            flash_set('success', 'Pembayaran ' . monthLabel($month) . ' disimpan.');
            break;

        case 'delete_payment':
            require_role(['admin', 'pengurus']);
            $stmt = $pdo->prepare('DELETE FROM jimpitan WHERE id = ?');
            $stmt->execute([(int) ($_POST['payment_id'] ?? 0)]);
            flash_set($stmt->rowCount() ? 'success' : 'error', $stmt->rowCount() ? 'Pembayaran dihapus.' : 'Pembayaran tidak ditemukan.');
            break;

        /* ----- Pengeluaran ----- */
        case 'add_expense':
        case 'edit_expense':
            if (!$manage) {
                require_role(['admin', 'pengurus']);
            }
            $nominal = (int) preg_replace('/\D/', '', (string) ($_POST['nominal'] ?? ''));
            $alasan = mb_substr(trim((string) ($_POST['alasan'] ?? '')), 0, 255);

            if ($nominal <= 0) {
                flash_set('error', 'Nominal pengeluaran harus lebih dari 0.');
                break;
            }
            if (mb_strlen($alasan) < 3) {
                flash_set('error', 'Alasan pengeluaran minimal 3 karakter.');
                break;
            }

            if ($action === 'add_expense') {
                $stmt = $pdo->prepare('INSERT INTO pengeluaran (nominal, alasan, recorded_by_id) VALUES (?, ?, ?)');
                $stmt->execute([$nominal, $alasan, (int) $user['id']]);
                flash_set('success', 'Pengeluaran ' . rupiah($nominal) . ' dicatat. Saldo kas berkurang.');
            } else {
                $stmt = $pdo->prepare('UPDATE pengeluaran SET nominal = ?, alasan = ? WHERE id = ?');
                $stmt->execute([$nominal, $alasan, (int) ($_POST['expense_id'] ?? 0)]);
                flash_set('success', 'Pengeluaran diperbarui.');
            }
            break;

        case 'delete_expense':
            if (!$manage) {
                require_role(['admin', 'pengurus']);
            }
            $stmt = $pdo->prepare('DELETE FROM pengeluaran WHERE id = ?');
            $stmt->execute([(int) ($_POST['expense_id'] ?? 0)]);
            flash_set('success', 'Pengeluaran dihapus. Saldo kas kembali naik.');
            break;

        /* ----- Warga & Pengurus (admin) ----- */
        case 'add_user':
            require_role(['admin']);
            add_or_edit_user($pdo, null, $_POST);
            break;

        case 'edit_user':
            require_role(['admin']);
            add_or_edit_user($pdo, (int) ($_POST['user_id'] ?? 0), $_POST);
            break;

        case 'change_password':
            require_role(['admin']);
            $userId = (int) ($_POST['user_id'] ?? 0);
            $password = (string) ($_POST['password'] ?? '');
            if (mb_strlen($password) < 4) {
                flash_set('error', 'Password minimal 4 karakter.');
                break;
            }
            $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
            flash_set('success', 'Password diperbarui.');
            break;

        case 'delete_user':
            require_role(['admin']);
            $userId = (int) ($_POST['user_id'] ?? 0);
            if ($userId === (int) $user['id']) {
                flash_set('error', 'Tidak dapat menghapus akun sendiri.');
                break;
            }
            $target = $pdo->prepare('SELECT id FROM users WHERE id = ? AND role IN (\'warga\', \'pengurus\')');
            $target->execute([$userId]);
            if (!$target->fetch()) {
                flash_set('error', 'Akun tidak ditemukan.');
                break;
            }
            // Hapus data terkait dulu (FK), baru akunnya.
            $pdo->prepare('DELETE FROM jimpitan WHERE warga_id = ? OR recorded_by_id = ?')->execute([$userId, $userId]);
            $pdo->prepare('DELETE FROM pengeluaran WHERE recorded_by_id = ?')->execute([$userId]);
            $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
            flash_set('success', 'Akun beserta catatannya dihapus.');
            break;

        /* ----- QRIS (admin) ----- */
        case 'save_qris':
            require_role(['admin']);
            $payload = trim((string) ($_POST['qris_payload'] ?? ''));
            $name = mb_substr(trim((string) ($_POST['qris_merchant_name'] ?? '')), 0, 255);
            $active = isset($_POST['qris_active']) ? 1 : 0;

            $stmt = $pdo->prepare(
                'INSERT INTO settings (setting_key, qris_payload, qris_merchant_name, qris_active)
                 VALUES (\'qris\', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   qris_payload = VALUES(qris_payload),
                   qris_merchant_name = VALUES(qris_merchant_name),
                   qris_active = VALUES(qris_active)'
            );
            $stmt->execute([$payload !== '' ? $payload : null, $name !== '' ? $name : null, $active]);
            flash_set('success', 'Pengaturan QRIS disimpan.');
            break;

        /* ----- Akun ----- */
        case 'change_own_password':
            $current = (string) ($_POST['current_password'] ?? '');
            $new = (string) ($_POST['new_password'] ?? '');
            $confirm = (string) ($_POST['confirm_password'] ?? '');

            if (!verify_user_password($pdo, $user, $current)) {
                flash_set('error', 'Password lama salah.');
                break;
            }
            if (mb_strlen($new) < 4) {
                flash_set('error', 'Password baru minimal 4 karakter.');
                break;
            }
            if ($new !== $confirm) {
                flash_set('error', 'Konfirmasi password tidak cocok.');
                break;
            }
            $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $stmt->execute([password_hash($new, PASSWORD_DEFAULT), (int) $user['id']]);
            flash_set('success', 'Password Anda diperbarui.');
            break;

        default:
            break;
    }

    redirect($back);
}

/** Tambah / ubah warga-pengurus (dipakai handler add_user & edit_user). */
function add_or_edit_user(PDO $pdo, ?int $userId, array $input): void
{
    $name = mb_substr(trim((string) ($input['name'] ?? '')), 0, 255);
    $username = strtolower(trim((string) ($input['username'] ?? '')));
    $role = in_array($input['role'] ?? '', ['warga', 'pengurus'], true) ? $input['role'] : 'warga';
    $alamat = mb_substr(trim((string) ($input['alamat'] ?? '')), 0, 255);
    $noRumah = mb_substr(trim((string) ($input['no_rumah'] ?? '')), 0, 32);

    if (mb_strlen($name) < 2) {
        flash_set('error', 'Nama terlalu pendek.');
        return;
    }
    if (!preg_match('/^[a-z0-9._-]{3,30}$/', $username)) {
        flash_set('error', 'Username harus 3–30 karakter (huruf kecil, angka, titik, strip, underscore).');
        return;
    }

    // Cek username unik (abaikan diri sendiri saat edit).
    $dup = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
    $dup->execute([$username, $userId ?? 0]);
    if ($dup->fetch()) {
        flash_set('error', 'Username sudah terdaftar.');
        return;
    }

    if ($userId === null) {
        $password = (string) ($input['password'] ?? '');
        if (mb_strlen($password) < 4) {
            flash_set('error', 'Password minimal 4 karakter.');
            return;
        }
        $stmt = $pdo->prepare(
            'INSERT INTO users (username, name, role, alamat, no_rumah, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $username,
            $name,
            $role,
            $role === 'warga' && $alamat !== '' ? $alamat : null,
            $role === 'warga' && $noRumah !== '' ? $noRumah : null,
            password_hash($password, PASSWORD_DEFAULT),
        ]);
        flash_set('success', $role === 'warga' ? "Warga $name ditambahkan." : "Pengurus $name ditambahkan.");
    } else {
        $stmt = $pdo->prepare(
            'UPDATE users SET username = ?, name = ?, role = ?, alamat = ?, no_rumah = ? WHERE id = ?'
        );
        $stmt->execute([
            $username,
            $name,
            $role,
            $role === 'warga' && $alamat !== '' ? $alamat : null,
            $role === 'warga' && $noRumah !== '' ? $noRumah : null,
            $userId,
        ]);
        flash_set('success', "Data $name diperbarui.");
    }
}

/* ================================================================== */
/* Beranda                                                            */
/* ================================================================== */

function render_beranda(array $user, PDO $pdo): void
{
    $stats = publicStats($pdo);
    $expenses = publicExpenses($pdo);
    $manage = can_manage($user['role']);

    page_top('Beranda', $user, 'beranda');

    $pctPaid = $stats['totalWarga'] > 0 ? (int) round($stats['latestPaid'] / $stats['totalWarga'] * 100) : 0;
    $maxSeries = 1;
    foreach ($stats['series'] as $s) {
        $maxSeries = max($maxSeries, (int) $s['total']);
    }

    echo '<div class="section-head" style="margin-bottom:16px"><h1 class="h2">Halo, ' . e(explode(' ', trim($user['name']))[0]) . ' 👋</h1>'
        . '<p class="muted">Ringkasan kas iuran warga.</p></div>';

    // Notifikasi merah di bawah sapaan bila warga belum membayar.
    if ($user['role'] === 'warga') {
        $billAlert = tagihanWarga($pdo, (int) $user['id']);
        if ($billAlert['kekurangan'] > 0) {
            echo '<div style="margin-bottom:16px;padding:12px 16px;border:1px solid #f3c7c2;border-radius:10px;background:var(--danger-bg);color:var(--danger)">'
                . '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' . svg_icon('alert', 18) . 'Anda belum membayar ' . rupiah($billAlert['kekurangan']) . '</div>'
                . '<p style="margin:3px 0 0 26px;font-size:13px;font-weight:400">Iuran ' . rupiah(JIMPITAN_PER_BULAN) . '/bulan · terhitung '
                . monthLabel($billAlert['start']) . ' – ' . monthLabel($billAlert['end'])
                . ' — tunggakan bertambah setiap bulan.</p></div>';
        }
    }

    // Notifikasi tagihan untuk warga: total kekurangan iuran yang belum dibayar
    // (terhitung Agustus 2026, diakumulasikan Rp15.000/bulan).
    if ($user['role'] === 'warga') {
        $bill = tagihanWarga($pdo, (int) $user['id']);
        $hasTunggakan = $bill['kekurangan'] > 0;

        echo '<div class="card card-pad bill-card' . ($hasTunggakan ? ' bill-card-warn' : ' bill-card-ok') . '" style="margin-bottom:16px">';
        echo '<div class="bill-head">';
        echo '<div class="bill-icon' . ($hasTunggakan ? ' bill-icon-warn' : ' bill-icon-ok') . '">' . svg_icon($hasTunggakan ? 'alert' : 'check', 20) . '</div>';
        echo '<div class="bill-info">'
            . '<h3 style="font-size:16px;font-weight:700;margin:0">Tagihan Jimpitan Anda</h3>'
            . '<p class="muted" style="margin:2px 0 0">' . $bill['monthsCount'] . ' bulan (' . monthLabel($bill['start']) . ' – ' . monthLabel($bill['end']) . ') × ' . rupiah(JIMPITAN_PER_BULAN) . '/bulan</p>'
            . '</div>';
        echo '</div>';

        if ($hasTunggakan) {
            echo '<p class="bill-total bill-total-warn">' . rupiah($bill['kekurangan']) . '</p>';
            echo '<p class="muted" style="margin:0 0 10px">Total kekurangan iuran yang belum dibayar.</p>';
            if ($bill['belumMonths']) {
                echo '<div class="bill-chips">';
                foreach ($bill['belumMonths'] as $bm) {
                    echo '<span class="badge badge-warn">' . monthShortLabel($bm) . '</span>';
                }
                echo '</div>';
            }
        } else {
            echo '<p class="bill-total bill-total-ok">Lunas semua 🎉</p>';
            echo '<p class="muted" style="margin:0 0 10px">Tagihan s.d. ' . monthLabel($bill['end']) . ' sudah terbayar'
                . ($bill['kelebihan'] > 0 ? ' — ada kelebihan ' . rupiah($bill['kelebihan']) . '.' : '.') . '</p>';
        }

        echo '<div class="info-box" style="margin:12px 0 14px">';
        echo '<div class="row"><span class="muted">Total kewajiban</span><span>' . rupiah($bill['totalTagihan']) . '</span></div>';
        echo '<div class="row"><span class="muted">Total dibayar</span><span>' . rupiah($bill['totalBayar']) . '</span></div>';
        echo '</div>';

        $pctBill = $bill['totalTagihan'] > 0 ? (int) round($bill['totalBayar'] / $bill['totalTagihan'] * 100) : 100;
        echo progress_bar($pctBill, $hasTunggakan ? 'warn' : 'success');

        echo '<div class="form-actions" style="margin-top:14px">'
            . '<a class="btn btn-primary btn-sm" href="dashboard.php?view=jimpitan">' . svg_icon('calendar', 15) . 'Lihat rincian pembayaran</a>'
            . '</div>';
        echo '</div>';
    }

    echo '<div class="grid grid-4" style="margin-bottom:16px">';
    echo stat_card('Total terkumpul', rupiah($stats['grandTotal']), $stats['monthsCount'] . ' bulan tercatat', 'primary');
    echo stat_card('Pengeluaran', rupiah($stats['totalPengeluaran']), 'kas keluar', 'danger');
    echo stat_card('Saldo kas', rupiah($stats['saldo']), 'terkumpul − pengeluaran', 'success');
    echo stat_card('Warga terdaftar', (string) $stats['totalWarga'], 'iuran ' . rupiah(JIMPITAN_PER_BULAN) . '/bulan');
    echo '</div>';

    echo '<div class="grid grid-2">';

    // Ringkasan bulan terakhir
    echo '<div class="card card-pad">';
    echo '<div class="section-head" style="margin-bottom:12px"><h3 style="font-size:16px;font-weight:700;margin:0">Bulan terakhir' .
        ($stats['latestMonth'] ? ': ' . monthLabel($stats['latestMonth']) : '') . '</h3></div>';
    if ($stats['latestMonth']) {
        echo '<div class="info-box">';
        echo '<div class="row"><span class="muted">Terkumpul</span><span><strong>' . rupiah($stats['latestTotal']) . '</strong></span></div>';
        echo '<div class="row"><span class="muted">Sudah bayar</span><span><span class="badge badge-success">' . $stats['latestPaid'] . ' warga</span></span></div>';
        echo '<div class="row"><span class="muted">Belum bayar</span><span><span class="badge badge-warn">' . $stats['latestUnpaid'] . ' warga</span></span></div>';
        echo '</div>';
        echo '<div style="margin-top:14px">' . progress_bar($pctPaid) . '</div>';
        echo '<p class="muted" style="font-size:12.5px;margin:6px 0 0">' . $pctPaid . '% warga sudah melunasi bulan ini</p>';
    } else {
        echo '<p class="muted">Belum ada pembayaran tercatat.</p>';
    }
    if ($manage) {
        echo '<div class="form-actions" style="margin-top:16px">'
            . '<a class="btn btn-primary btn-sm" href="dashboard.php?view=jimpitan">' . svg_icon('plus', 15) . 'Input iuran</a>'
            . '<a class="btn btn-outline btn-sm" href="dashboard.php?view=jimpitan">Lihat rincian</a></div>';
    } else {
        echo '<div class="form-actions" style="margin-top:16px"><a class="btn btn-outline btn-sm" href="dashboard.php?view=jimpitan">Lihat rincian</a></div>';
    }
    echo '</div>';

    // Grafik
    echo '<div class="card card-pad">';
    echo '<div class="section-head" style="margin-bottom:6px"><h3 style="font-size:16px;font-weight:700;margin:0">Perkembangan 6 bulan</h3></div>';
    if ($stats['series']) {
        echo '<div class="chart">';
        foreach ($stats['series'] as $s) {
            echo '<div class="chart-col"><span class="chart-value">' . number_format((int) $s['total'] / 1000, 0, ',', '.') . 'rb</span>'
                . '<div class="chart-bar" style="height:' . max(4, (int) round((int) $s['total'] / $maxSeries * 100)) . '%"></div>'
                . '<span class="chart-label">' . monthShortLabel($s['month']) . '</span></div>';
        }
        echo '</div>';
    } else {
        echo '<p class="muted" style="padding:26px 0;text-align:center">Belum ada data pembayaran.</p>';
    }
    echo '</div>';

    echo '</div>'; // grid-2

    // Pengeluaran terbaru (view-only di beranda)
    echo '<div class="card" style="margin-top:16px">';
    echo '<div class="card-head"><div><h3>Pengeluaran terbaru</h3><p class="muted">Hanya tampilan — kelola lewat menu Pengeluaran.</p></div>'
        . '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=pengeluaran">' . svg_icon('right', 15) . 'Semua</a></div>';
    if ($expenses['items']) {
        echo '<div class="table-wrap" style="border:none;box-shadow:none;margin:14px 22px 22px"><table class="table"><thead><tr>'
            . '<th>Tanggal</th><th>Alasan</th><th style="text-align:right">Nominal</th></tr></thead><tbody>';
        foreach ($expenses['items'] as $x) {
            echo '<tr><td class="muted-cell">' . formatTanggal($x['created_at']) . '</td><td>' . e($x['alasan']) . '</td>'
                . '<td class="num" style="text-align:right">' . rupiah((int) $x['nominal']) . '</td></tr>';
        }
        echo '</tbody></table></div>';
    } else {
        echo '<p class="empty">Belum ada pengeluaran kas tercatat.</p>';
    }
    echo '</div>';

    page_bottom();
}

/* ================================================================== */
/* Rincian Jimpitan                                                   */
/* ================================================================== */

function render_jimpitan(array $user, PDO $pdo): void
{
    $month = validMonth((string) ($_GET['month'] ?? '')) ?? currentMonthKey();
    $q = trim((string) ($_GET['q'] ?? ''));
    $status = (string) ($_GET['status'] ?? 'semua');
    if (!in_array($status, ['semua', 'lunas', 'belum'], true)) {
        $status = 'semua';
    }
    $tanggal = (string) ($_GET['tanggal'] ?? '');
    if ($tanggal !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
        $tanggal = '';
    }

    $manage = can_manage($user['role']);
    $ov = overviewForMonth($pdo, $month);

    // Filter
    $rows = $ov['rows'];
    if ($q !== '') {
        $needle = mb_strtolower($q);
        $rows = array_values(array_filter($rows, function ($r) use ($needle) {
            $name = mb_strtolower((string) $r['warga']['name']);
            $no = mb_strtolower((string) $r['warga']['no_rumah']);
            return str_contains($name, $needle) || str_contains($no, $needle);
        }));
    }
    if ($status !== 'semua') {
        $rows = array_values(array_filter($rows, fn ($r) => $r['status'] === $status));
    }
    if ($tanggal !== '') {
        $rows = array_values(array_filter($rows, function ($r) use ($tanggal) {
            return $r['payment'] && date('Y-m-d', strtotime($r['payment']['created_at'])) === $tanggal;
        }));
    }

    page_top('Rincian Jimpitan', $user, 'jimpitan');

    echo section_title('Rincian Jimpitan', 'Input iuran bulanan per warga, cari, dan edit catatan pembayaran.');

    // Navigasi bulan + pencarian
    $prev = shiftMonthKey($month, -1);
    $next = shiftMonthKey($month, 1);
    $qs = http_build_query(array_filter([
        'q' => $q !== '' ? $q : null,
        'status' => $status !== 'semua' ? $status : null,
        'tanggal' => $tanggal !== '' ? $tanggal : null,
    ]));

    echo '<div class="card filter-bar">';
    echo '<div class="month-nav" style="width:100%">';
    echo '<div class="month-nav-center">'
        . '<a class="btn btn-outline btn-sm" href="dashboard.php?view=jimpitan&month=' . $prev . ($qs ? '&' . $qs : '') . '">' . svg_icon('left', 15) . '</a>'
        . '<h2 style="font-size:17px;font-weight:700;margin:0;min-width:150px;text-align:center">' . monthLabel($month) . '</h2>'
        . '<a class="btn btn-outline btn-sm" href="dashboard.php?view=jimpitan&month=' . $next . ($qs ? '&' . $qs : '') . '">' . svg_icon('right', 15) . '</a>'
        . '</div>';
    echo '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=jimpitan">Bulan ini</a>';
    echo '</div>';

    echo '<form method="get" action="dashboard.php" class="filter-bar" style="padding:0;margin:0">';
    echo '<input type="hidden" name="view" value="jimpitan">';
    echo '<div class="form-row"><label for="f-month">Bulan</label><input class="input" type="month" id="f-month" name="month" value="' . e($month) . '"></div>';
    echo '<div class="form-row grow"><label for="f-q">Cari nama / no. rumah</label><input class="input" id="f-q" name="q" value="' . e($q) . '" placeholder="cth: Sunaryo"></div>';
    echo '<div class="form-row"><label for="f-status">Status</label><select class="input" id="f-status" name="status">'
        . '<option value="semua"' . ($status === 'semua' ? ' selected' : '') . '>Semua</option>'
        . '<option value="lunas"' . ($status === 'lunas' ? ' selected' : '') . '>Sudah bayar</option>'
        . '<option value="belum"' . ($status === 'belum' ? ' selected' : '') . '>Belum bayar</option>'
        . '</select></div>';
    echo '<div class="form-row"><label for="f-tanggal">Tanggal input</label><input class="input" type="date" id="f-tanggal" name="tanggal" value="' . e($tanggal) . '"></div>';
    echo '<button class="btn btn-primary" type="submit">' . svg_icon('search', 15) . 'Cari</button>';
    if ($q !== '' || $status !== 'semua' || $tanggal !== '') {
        echo '<a class="btn btn-ghost" href="dashboard.php?view=jimpitan&month=' . e($month) . '">Reset</a>';
    }
    echo '</form>';
    echo '</div>';

    // Ringkasan
    echo '<div class="grid grid-4" style="margin-bottom:18px">';
    echo stat_card('Warga', (string) $ov['totalWarga'], 'total warga');
    echo stat_card('Sudah bayar', (string) $ov['paidCount'], 'lunas bulan ini', 'success');
    echo stat_card('Belum bayar', (string) $ov['unpaidCount'], 'belum melunasi', '');
    echo stat_card('Terkumpul', rupiah($ov['total']), 'target ' . rupiah($ov['target']), 'primary');
    echo '</div>';

    // Tabel
    echo '<div class="table-wrap"><table class="table"><thead><tr>'
        . '<th>#</th><th>Nama warga</th><th>No. rumah</th><th class="num">Nominal</th><th>Status</th>'
        . '<th>Tanggal input</th><th>Dicatat oleh</th><th>Catatan</th>'
        . ($manage ? '<th>Aksi</th>' : '')
        . '</tr></thead><tbody>';

    if (!$rows) {
        echo '<tr><td colspan="' . ($manage ? 9 : 8) . '"><p class="empty" style="padding:26px 0">Tidak ada data yang cocok.</p></td></tr>';
    }

    $no = 1;
    foreach ($rows as $r) {
        $w = $r['warga'];
        $p = $r['payment'];
        echo '<tr>';
        echo '<td class="muted-cell">' . $no . '</td>';
        if ($manage) {
            $payUrl = 'dashboard.php?view=jimpitan&form=pay&warga_id=' . (int) $w['id'] . '&month=' . $month;
            $nameHtml = '<a class="name-link" href="' . $payUrl . '" title="' . ($p ? 'Edit pembayaran' : 'Catat pembayaran') . '">'
                . '<strong>' . e($w['name']) . '</strong> '
                . svg_icon($p ? 'pencil' : 'plus', 12)
                . '</a>';
        } else {
            $nameHtml = '<strong>' . e($w['name']) . '</strong>';
        }
        echo '<td>' . $nameHtml . ($w['alamat'] ? '<div class="muted-cell" style="font-size:12px">RT ' . e($w['alamat']) . '</div>' : '') . '</td>';
        echo '<td class="muted-cell">' . e($w['no_rumah'] ?: '—') . '</td>';
        echo '<td class="num">' . ($p ? rupiah((int) $p['nominal']) : '<span class="muted-cell">—</span>') . '</td>';
        echo '<td>' . status_badge($r['status']) . '</td>';
        echo '<td class="muted-cell">' . ($p ? formatTanggal($p['created_at']) : '—') . '</td>';
        echo '<td class="muted-cell">' . ($p ? e($r['recordedByName']) : '—') . '</td>';
        echo '<td class="muted-cell">' . ($p && $p['note'] ? e($p['note']) : '—') . '</td>';

        if ($manage) {
            echo '<td><div class="actions">';
            if ($p) {
                $editUrl = 'dashboard.php?view=jimpitan&form=pay&warga_id=' . (int) $w['id'] . '&month=' . $month;
                $delUrl = 'dashboard.php?view=jimpitan&form=delete_payment&payment_id=' . (int) $p['id'] . '&month=' . $month;
                echo action_btn($editUrl, 'Edit', 'outline', 'pencil');
                echo action_btn($delUrl, 'Hapus', 'danger', 'trash');
            } else {
                $payUrl = 'dashboard.php?view=jimpitan&form=pay&warga_id=' . (int) $w['id'] . '&month=' . $month;
                echo action_btn($payUrl, 'Bayar', 'primary', 'plus');
            }
            echo '</div></td>';
        }
        echo '</tr>';
        $no++;
    }
    echo '</tbody></table></div>';

    page_bottom();
}

/* ---- Form bayar / edit pembayaran ---- */
function form_jimpitan_pay(array $user, PDO $pdo): void
{
    require_role(['admin', 'pengurus']);
    $wargaId = (int) ($_GET['warga_id'] ?? 0);
    $month = validMonth((string) ($_GET['month'] ?? '')) ?? currentMonthKey();

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role = 'warga'");
    $stmt->execute([$wargaId]);
    $warga = $stmt->fetch();
    if (!$warga) {
        flash_set('error', 'Warga tidak ditemukan.');
        redirect('dashboard.php?view=jimpitan');
    }

    $ov = overviewForMonth($pdo, $month);
    $row = null;
    foreach ($ov['rows'] as $r) {
        if ((int) $r['warga']['id'] === $wargaId) {
            $row = $r;
            break;
        }
    }
    $payment = $row['payment'] ?? null;
    $saldoBefore = $row['saldoBefore'] ?? 0;
    $nominal = $payment ? (int) $payment['nominal'] : JIMPITAN_PER_BULAN;

    page_top($payment ? 'Edit pembayaran' : 'Bayar jimpitan', $user, 'jimpitan');

    echo '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=jimpitan&month=' . e($month) . '" style="margin-bottom:14px">'
        . svg_icon('back', 15) . 'Kembali ke rincian</a>';

    echo '<div class="card card-pad form-card">';
    echo '<h1 class="h2">' . ($payment ? 'Edit pembayaran' : 'Bayar jimpitan') . '</h1>';
    echo '<p class="muted">' . e($warga['name']) . ' — ' . monthLabel($month) . '</p>';

    echo '<form method="post" action="dashboard.php">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="pay">';
    echo '<input type="hidden" name="back_view" value="jimpitan">';
    echo '<input type="hidden" name="warga_id" value="' . (int) $warga['id'] . '">';
    echo '<input type="hidden" name="month" value="' . e($month) . '">';
    echo '<input type="hidden" name="back_month" value="' . e($month) . '">';

    echo '<div class="form-grid">';
    echo '<div class="form-row"><label for="pay-nominal">Nominal (Rp)</label>'
        . '<input class="input" id="pay-nominal" name="nominal" inputmode="numeric" value="' . $nominal . '" required autofocus>'
        . '<p class="hint">Iuran wajib ' . rupiah(JIMPITAN_PER_BULAN) . '/bulan. Kelebihan otomatis diakumulasikan ke bulan berikutnya.</p></div>';

    echo '<div class="info-box">';
    echo '<div class="row"><span class="muted">Iuran wajib bulan ini</span><span><strong>' . rupiah(JIMPITAN_PER_BULAN) . '</strong></span></div>';
    echo '<div class="row"><span class="muted">Saldo dibawa</span><span><strong>' . ($saldoBefore > 0 ? '+' . rupiah($saldoBefore) : rupiah(0)) . '</strong></span></div>';
    echo '<div class="row" id="surplus-row" style="display:none"><span class="muted">Setelah pembayaran ini</span><span id="surplus-text"></span></div>';
    echo '</div>';

    echo '<div class="form-row"><label for="pay-note">Catatan (opsional)</label>'
        . '<input class="input" id="pay-note" name="note" value="' . e($payment['note'] ?? '') . '" placeholder="cth: dibayar tunai / QRIS"></div>';

    echo '<div class="form-actions">'
        . '<button class="btn btn-primary" type="submit">' . svg_icon('check', 16) . 'Simpan</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=jimpitan&month=' . e($month) . '">Batal</a>'
        . '</div>';
    echo '</div></form></div>';

    echo '<script>
var saldo = ' . (int) $saldoBefore . ';
var iuran = ' . JIMPITAN_PER_BULAN . ';
var input = document.getElementById("pay-nominal");
var row = document.getElementById("surplus-row");
var text = document.getElementById("surplus-text");
function hitung() {
  var n = parseInt(String(input.value).replace(/\D/g, ""), 10) || 0;
  var sisa = saldo + n - iuran;
  if (n > 0) {
    row.style.display = "flex";
    if (sisa >= 0) {
      text.innerHTML = "<span class=\"kelebihan\">Kelebihan " + (sisa > 0 ? "Rp " + sisa.toLocaleString("id-ID") : "pas lunas") + (sisa > 0 ? " — diakumulasikan ke bulan berikutnya" : "") + "</span>";
    } else {
      text.innerHTML = "<span class=\"kekurangan\">Masih kurang Rp " + (-sisa).toLocaleString("id-ID") + " untuk lunas</span>";
    }
  } else {
    row.style.display = "none";
  }
}
input.addEventListener("input", hitung);
hitung();
</script>';

    page_bottom();
}

/* ---- Form hapus pembayaran ---- */
function form_jimpitan_delete(array $user, PDO $pdo): void
{
    require_role(['admin', 'pengurus']);
    $paymentId = (int) ($_GET['payment_id'] ?? 0);

    $stmt = $pdo->prepare(
        'SELECT j.*, w.name AS warga_name FROM jimpitan j JOIN users w ON w.id = j.warga_id WHERE j.id = ?'
    );
    $stmt->execute([$paymentId]);
    $payment = $stmt->fetch();
    if (!$payment) {
        flash_set('error', 'Pembayaran tidak ditemukan.');
        redirect('dashboard.php?view=jimpitan');
    }

    page_top('Hapus pembayaran', $user, 'jimpitan');

    echo '<div class="card card-pad form-card" style="margin:0 auto">';
    echo '<div style="text-align:center">';
    echo '<div class="empty-icon" style="background:var(--danger-bg);color:var(--danger)">' . svg_icon('alert', 22) . '</div>';
    echo '<h1 class="h2" style="margin-top:14px">Hapus pembayaran ' . e($payment['warga_name']) . '?</h1>';
    echo '<p class="muted">Catatan pembayaran <strong>' . rupiah((int) $payment['nominal']) . '</strong> untuk '
        . monthLabel($payment['month']) . ' akan dihapus. Warga ini akan kembali ditandai belum membayar.</p>';
    echo '</div>';

    echo '<form method="post" action="dashboard.php" onsubmit="return confirm(\'Hapus pembayaran ini?\')">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="delete_payment">';
    echo '<input type="hidden" name="back_view" value="jimpitan">';
    echo '<input type="hidden" name="back_month" value="' . e($payment['month']) . '">';
    echo '<input type="hidden" name="payment_id" value="' . (int) $payment['id'] . '">';
    echo '<div class="form-actions" style="justify-content:center">'
        . '<button class="btn btn-danger" type="submit">' . svg_icon('trash', 16) . 'Ya, hapus</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=jimpitan&month=' . e($payment['month']) . '">Batal</a>'
        . '</div>';
    echo '</form></div>';

    page_bottom();
}

/* ================================================================== */
/* Pengeluaran                                                        */
/* ================================================================== */

function render_pengeluaran(array $user, PDO $pdo): void
{
    $manage = can_manage($user['role']);
    $list = listPengeluaran($pdo);
    $stats = publicStats($pdo);

    page_top('Pengeluaran', $user, 'pengeluaran');

    echo section_title(
        'Pengeluaran kas',
        $manage
            ? 'Catat pengeluaran — nominal otomatis mengurangi saldo kas.'
            : 'Tampilan pengeluaran kas (hanya untuk dilihat).'
    );

    echo '<div class="grid grid-3" style="margin-bottom:18px">';
    echo stat_card('Total pengeluaran', rupiah($list['total']), count($list['items']) . ' catatan', 'danger');
    echo stat_card('Total terkumpul', rupiah($stats['grandTotal']), 'sebelum pengeluaran', 'primary');
    echo stat_card('Saldo kas', rupiah($stats['saldo']), 'terkumpul − pengeluaran', 'success');
    echo '</div>';

    if ($manage) {
        echo '<div style="margin-bottom:16px"><a class="btn btn-primary" href="dashboard.php?view=pengeluaran&form=add">'
            . svg_icon('plus', 16) . 'Tambah pengeluaran</a></div>';
    }

    echo '<div class="table-wrap"><table class="table"><thead><tr>'
        . '<th>#</th><th>Tanggal</th><th>Alasan</th><th class="num">Nominal</th><th>Dicatat oleh</th>'
        . ($manage ? '<th>Aksi</th>' : '')
        . '</tr></thead><tbody>';

    if (!$list['items']) {
        echo '<tr><td colspan="' . ($manage ? 6 : 5) . '"><p class="empty" style="padding:26px 0">Belum ada pengeluaran tercatat.</p></td></tr>';
    }

    $no = 1;
    foreach ($list['items'] as $x) {
        echo '<tr><td class="muted-cell">' . $no . '</td>'
            . '<td class="muted-cell">' . formatTanggal($x['created_at']) . '</td>'
            . '<td>' . e($x['alasan']) . '</td>'
            . '<td class="num">' . rupiah((int) $x['nominal']) . '</td>'
            . '<td class="muted-cell">' . e($x['recorded_by_name']) . '</td>';
        if ($manage) {
            $editUrl = 'dashboard.php?view=pengeluaran&form=edit&id=' . (int) $x['id'];
            $delUrl = 'dashboard.php?view=pengeluaran&form=delete_expense&id=' . (int) $x['id'];
            echo '<td><div class="actions">'
                . action_btn($editUrl, 'Edit', 'outline', 'pencil')
                . action_btn($delUrl, 'Hapus', 'danger', 'trash')
                . '</div></td>';
        }
        echo '</tr>';
        $no++;
    }
    echo '</tbody></table></div>';

    page_bottom();
}

function form_expense(array $user, PDO $pdo, ?int $expenseId): void
{
    require_role(['admin', 'pengurus']);
    $editing = $expenseId !== null;
    $nominal = '';
    $alasan = '';
    if ($editing) {
        $stmt = $pdo->prepare('SELECT * FROM pengeluaran WHERE id = ?');
        $stmt->execute([$expenseId]);
        $row = $stmt->fetch();
        if (!$row) {
            flash_set('error', 'Pengeluaran tidak ditemukan.');
            redirect('dashboard.php?view=pengeluaran');
        }
        $nominal = (string) (int) $row['nominal'];
        $alasan = $row['alasan'];
    }

    page_top($editing ? 'Ubah pengeluaran' : 'Tambah pengeluaran', $user, 'pengeluaran');

    echo '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=pengeluaran" style="margin-bottom:14px">'
        . svg_icon('back', 15) . 'Kembali ke pengeluaran</a>';

    echo '<div class="card card-pad form-card">';
    echo '<h1 class="h2">' . ($editing ? 'Ubah pengeluaran' : 'Tambah pengeluaran') . '</h1>';
    echo '<p class="muted">Saldo kas berkurang sebesar nominal yang dicatat.</p>';

    echo '<form method="post" action="dashboard.php">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="' . ($editing ? 'edit_expense' : 'add_expense') . '">';
    echo '<input type="hidden" name="back_view" value="pengeluaran">';
    if ($editing) {
        echo '<input type="hidden" name="expense_id" value="' . (int) $row['id'] . '">';
    }

    echo '<div class="form-grid">';
    echo '<div class="form-row"><label for="ex-nominal">Nominal (Rp)</label>'
        . '<input class="input" id="ex-nominal" name="nominal" inputmode="numeric" value="' . e($nominal) . '" placeholder="cth: 50000" required autofocus></div>';
    echo '<div class="form-row"><label for="ex-alasan">Alasan pengeluaran</label>'
        . '<input class="input" id="ex-alasan" name="alasan" value="' . e($alasan) . '" placeholder="cth: belanja konsumsi rapat warga" required></div>';
    echo '<div class="form-actions">'
        . '<button class="btn btn-primary" type="submit">' . svg_icon('check', 16) . 'Simpan</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=pengeluaran">Batal</a>'
        . '</div>';
    echo '</div></form></div>';

    page_bottom();
}

function form_expense_delete(array $user, PDO $pdo, int $expenseId): void
{
    require_role(['admin', 'pengurus']);
    $stmt = $pdo->prepare('SELECT * FROM pengeluaran WHERE id = ?');
    $stmt->execute([$expenseId]);
    $row = $stmt->fetch();
    if (!$row) {
        flash_set('error', 'Pengeluaran tidak ditemukan.');
        redirect('dashboard.php?view=pengeluaran');
    }

    page_top('Hapus pengeluaran', $user, 'pengeluaran');

    echo '<div class="card card-pad form-card" style="margin:0 auto">';
    echo '<div style="text-align:center">';
    echo '<div class="empty-icon" style="background:var(--danger-bg);color:var(--danger)">' . svg_icon('alert', 22) . '</div>';
    echo '<h1 class="h2" style="margin-top:14px">Hapus pengeluaran ini?</h1>';
    echo '<p class="muted">Catatan pengeluaran <strong>' . rupiah((int) $row['nominal']) . '</strong> — '
        . e($row['alasan']) . ' — akan dihapus, dan saldo kas kembali naik.</p>';
    echo '</div>';

    echo '<form method="post" action="dashboard.php" onsubmit="return confirm(\'Hapus pengeluaran ini?\')">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="delete_expense">';
    echo '<input type="hidden" name="back_view" value="pengeluaran">';
    echo '<input type="hidden" name="expense_id" value="' . (int) $row['id'] . '">';
    echo '<div class="form-actions" style="justify-content:center">'
        . '<button class="btn btn-danger" type="submit">' . svg_icon('trash', 16) . 'Ya, hapus</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=pengeluaran">Batal</a>'
        . '</div>';
    echo '</form></div>';

    page_bottom();
}

/* ================================================================== */
/* Warga & Pengurus (admin)                                           */
/* ================================================================== */

function render_warga(array $user, PDO $pdo): void
{
    $q = trim((string) ($_GET['q'] ?? ''));
    $stmt = $pdo->query("SELECT * FROM users WHERE role IN ('warga','pengurus') ORDER BY role = 'pengurus' DESC, name ASC");
    $users = $stmt->fetchAll();
    if ($q !== '') {
        $needle = mb_strtolower($q);
        $users = array_values(array_filter($users, function ($u) use ($needle) {
            return str_contains(mb_strtolower($u['name']), $needle)
                || str_contains(mb_strtolower($u['username']), $needle);
        }));
    }

    page_top('Warga & Pengurus', $user, 'warga');

    echo section_title('Warga & Pengurus', 'Kelola akun login: tambah, ubah, ganti password, atau hapus.');

    echo '<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px">'
        . '<a class="btn btn-primary" href="dashboard.php?view=warga&form=add">' . svg_icon('plus', 16) . 'Tambah warga / pengurus</a>'
        . '<form method="get" action="dashboard.php" style="display:flex;gap:8px">'
        . '<input type="hidden" name="view" value="warga">'
        . '<input class="input" name="q" value="' . e($q) . '" placeholder="Cari nama / username" style="width:220px">'
        . '<button class="btn btn-outline" type="submit">' . svg_icon('search', 15) . '</button>'
        . '</form></div>';

    echo '<div class="table-wrap"><table class="table"><thead><tr>'
        . '<th>#</th><th>Nama</th><th>Username</th><th>Peran</th><th>No. rumah</th><th>Alamat / RT</th><th>Aksi</th>'
        . '</tr></thead><tbody>';

    if (!$users) {
        echo '<tr><td colspan="7"><p class="empty" style="padding:26px 0">Belum ada warga atau pengurus terdaftar.</p></td></tr>';
    }

    $no = 1;
    foreach ($users as $u) {
        $editUrl = 'dashboard.php?view=warga&form=edit&id=' . (int) $u['id'];
        $passUrl = 'dashboard.php?view=warga&form=password&id=' . (int) $u['id'];
        $delUrl = 'dashboard.php?view=warga&form=delete_user&id=' . (int) $u['id'];
        echo '<tr><td class="muted-cell">' . $no . '</td>'
            . '<td><strong>' . e($u['name']) . '</strong></td>'
            . '<td class="muted-cell">@' . e($u['username']) . '</td>'
            . '<td>' . role_badge($u['role']) . '</td>'
            . '<td class="muted-cell">' . e($u['no_rumah'] ?: '—') . '</td>'
            . '<td class="muted-cell">' . e($u['alamat'] ?: '—') . '</td>'
            . '<td><div class="actions">'
            . action_btn($editUrl, 'Edit', 'outline', 'pencil')
            . action_btn($passUrl, 'Password', 'outline', 'lockkey')
            . action_btn($delUrl, 'Hapus', 'danger', 'trash')
            . '</div></td></tr>';
        $no++;
    }
    echo '</tbody></table></div>';

    page_bottom();
}

function form_user(array $user, PDO $pdo, ?int $userId): void
{
    $editing = $userId !== null;
    $name = $username = $alamat = $noRumah = '';
    $role = 'warga';

    if ($editing) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role IN ('warga','pengurus')");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) {
            flash_set('error', 'Akun tidak ditemukan.');
            redirect('dashboard.php?view=warga');
        }
        $name = $row['name'];
        $username = $row['username'];
        $role = $row['role'];
        $alamat = $row['alamat'] ?? '';
        $noRumah = $row['no_rumah'] ?? '';
    }

    page_top($editing ? 'Ubah data' : 'Tambah warga / pengurus', $user, 'warga');

    echo '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=warga" style="margin-bottom:14px">'
        . svg_icon('back', 15) . 'Kembali ke daftar</a>';

    echo '<div class="card card-pad form-card-wide">';
    echo '<h1 class="h2">' . ($editing ? 'Ubah data ' . e($name) : 'Tambah warga / pengurus') . '</h1>';
    echo '<p class="muted">' . ($editing
        ? 'Perbarui data akun ini. Jika username diubah, login mereka ikut berubah.'
        : 'Mereka login dengan username & password yang Anda buat.') . '</p>';

    echo '<form method="post" action="dashboard.php">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="' . ($editing ? 'edit_user' : 'add_user') . '">';
    echo '<input type="hidden" name="back_view" value="warga">';
    if ($editing) {
        echo '<input type="hidden" name="user_id" value="' . (int) $row['id'] . '">';
    }

    echo '<div class="form-grid">';
    echo '<div class="form-row"><label for="u-name">Nama lengkap</label>'
        . '<input class="input" id="u-name" name="name" value="' . e($name) . '" placeholder="cth: Budi Santoso" required></div>';
    echo '<div class="form-row"><label for="u-username">Username</label>'
        . '<input class="input" id="u-username" name="username" value="' . e($username) . '" placeholder="cth: budi01" autocapitalize="none" spellcheck="false" required>'
        . '<p class="hint">3–30 karakter: huruf kecil, angka, titik, strip, underscore.</p></div>';

    if (!$editing) {
        echo '<div class="form-row"><label for="u-password">Password awal</label>'
            . '<input class="input" id="u-password" name="password" placeholder="minimal 4 karakter" autocomplete="off" required>'
            . '<p class="hint">Dipakai saat mereka login. Beri tahu mereka password ini.</p></div>';
    }

    echo '<div class="form-row"><label for="u-role">Peran</label><select class="input" id="u-role" name="role">'
        . '<option value="warga"' . ($role === 'warga' ? ' selected' : '') . '>Warga</option>'
        . '<option value="pengurus"' . ($role === 'pengurus' ? ' selected' : '') . '>Pengurus</option>'
        . '</select></div>';

    echo '<div class="grid grid-2">';
    echo '<div class="form-row"><label for="u-rumah">No. rumah (warga)</label>'
        . '<input class="input" id="u-rumah" name="no_rumah" value="' . e($noRumah) . '" placeholder="cth: 12"></div>';
    echo '<div class="form-row"><label for="u-alamat">Alamat / RT (warga)</label>'
        . '<input class="input" id="u-alamat" name="alamat" value="' . e($alamat) . '" placeholder="cth: RT 02"></div>';
    echo '</div>';

    echo '<div class="form-actions">'
        . '<button class="btn btn-primary" type="submit">' . svg_icon('check', 16) . 'Simpan</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=warga">Batal</a>'
        . '</div>';
    echo '</div></form></div>';

    page_bottom();
}

function form_user_password(array $user, PDO $pdo, int $userId): void
{
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role IN ('warga','pengurus')");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        flash_set('error', 'Akun tidak ditemukan.');
        redirect('dashboard.php?view=warga');
    }

    page_top('Ganti password', $user, 'warga');

    echo '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=warga" style="margin-bottom:14px">'
        . svg_icon('back', 15) . 'Kembali ke daftar</a>';

    echo '<div class="card card-pad form-card">';
    echo '<h1 class="h2">Ganti password ' . e($row['name']) . '</h1>';
    echo '<p class="muted">Password baru dipakai saat login dengan username @' . e($row['username']) . '.</p>';

    echo '<form method="post" action="dashboard.php">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="change_password">';
    echo '<input type="hidden" name="back_view" value="warga">';
    echo '<input type="hidden" name="user_id" value="' . (int) $row['id'] . '">';

    echo '<div class="form-grid">';
    echo '<div class="form-row"><label for="p-pass">Password baru</label>'
        . '<input class="input" id="p-pass" name="password" placeholder="minimal 4 karakter" autocomplete="off" required autofocus></div>';
    echo '<div class="form-actions">'
        . '<button class="btn btn-primary" type="submit">' . svg_icon('check', 16) . 'Simpan</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=warga">Batal</a>'
        . '</div>';
    echo '</div></form></div>';

    page_bottom();
}

function form_user_delete(array $user, PDO $pdo, int $userId): void
{
    if ($userId === (int) $user['id']) {
        flash_set('error', 'Tidak dapat menghapus akun sendiri.');
        redirect('dashboard.php?view=warga');
    }
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role IN ('warga','pengurus')");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        flash_set('error', 'Akun tidak ditemukan.');
        redirect('dashboard.php?view=warga');
    }

    page_top('Hapus akun', $user, 'warga');

    echo '<div class="card card-pad form-card" style="margin:0 auto">';
    echo '<div style="text-align:center">';
    echo '<div class="empty-icon" style="background:var(--danger-bg);color:var(--danger)">' . svg_icon('alert', 22) . '</div>';
    echo '<h1 class="h2" style="margin-top:14px">Hapus ' . e($row['name']) . '?</h1>';
    echo '<p class="muted">Akun, sesi login, dan seluruh catatan pembayaran ' . e($row['name'])
        . ' akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p>';
    echo '</div>';

    echo '<form method="post" action="dashboard.php" onsubmit="return confirm(\'Hapus akun ini beserta catatannya?\')">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="delete_user">';
    echo '<input type="hidden" name="back_view" value="warga">';
    echo '<input type="hidden" name="user_id" value="' . (int) $row['id'] . '">';
    echo '<div class="form-actions" style="justify-content:center">'
        . '<button class="btn btn-danger" type="submit">' . svg_icon('trash', 16) . 'Ya, hapus</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=warga">Batal</a>'
        . '</div>';
    echo '</form></div>';

    page_bottom();
}

/* ================================================================== */
/* QRIS                                                               */
/* ================================================================== */

function render_qris(array $user, PDO $pdo): void
{
    $qris = getQris($pdo);
    $isAdmin = $user['role'] === 'admin';
    $active = (int) $qris['qris_active'] === 1;
    $payload = (string) ($qris['qris_payload'] ?? '');
    $merchant = (string) ($qris['qris_merchant_name'] ?? '');

    page_top('Pembayaran QRIS', $user, 'qris');

    echo section_title(
        'Pembayaran QRIS',
        $isAdmin ? 'Atur kode QRIS agar admin, pengurus, dan warga bisa membayar dengan scan.' : 'Scan kode QR untuk membayar iuran.'
    );

    if ($isAdmin) {
        echo '<div style="margin-bottom:16px"><a class="btn btn-primary" href="dashboard.php?view=qris&form=edit">'
            . svg_icon('pencil', 16) . 'Atur QRIS</a></div>';
    }

    echo '<div class="card card-pad" style="max-width:520px">';
    if ($active && $payload !== '') {
        $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=' . rawurlencode($payload);
        echo '<div class="qr-box">';
        echo '<img class="qr-img" src="' . e($qrUrl) . '" alt="QRIS ' . e($merchant) . '" loading="lazy">';
        echo '<p style="display:none" class="muted">Gambar QR tidak dapat dimuat — pastikan perangkat terhubung internet.</p>';
        echo '</div>';
        echo '<div style="text-align:center;margin-top:14px">'
            . '<h3 style="font-size:17px;font-weight:700;margin:0 0 2px">' . e($merchant ?: 'QRIS RT') . '</h3>'
            . '<p class="muted" style="margin:0">Bayar iuran lewat aplikasi bank / e-wallet apa pun</p></div>';
        echo '<div class="info-box" style="margin-top:14px">'
            . '<div class="row"><span class="muted">Status</span><span>' . badge('Aktif', 'success') . '</span></div>'
            . '<div class="row"><span class="muted">Iuran</span><span><strong>' . rupiah(JIMPITAN_PER_BULAN) . '</strong>/bulan</span></div>'
            . '</div>';
        echo '<div class="qr-payload" style="margin-top:12px">' . e($payload) . '</div>';
    } elseif ($payload !== '') {
        echo '<div class="empty">'
            . '<div class="empty-icon">' . svg_icon('qr', 22) . '</div>'
            . '<p style="margin:12px 0 0"><strong>QRIS belum aktif</strong></p>'
            . '<p class="muted" style="margin:4px 0 0">Kode QR sudah disimpan tapi belum diaktifkan'
            . ($isAdmin ? ' — atur lewat tombol di atas.' : ' oleh admin RT.') . '</p></div>';
    } else {
        echo '<div class="empty">'
            . '<div class="empty-icon">' . svg_icon('qr', 22) . '</div>'
            . '<p style="margin:12px 0 0"><strong>QRIS belum diatur</strong></p>'
            . '<p class="muted" style="margin:4px 0 0">'
            . ($isAdmin ? 'Tempel string QRIS dari aplikasi bank / e-wallet Anda.' : 'Admin RT belum mengatur kode QRIS.') . '</p></div>';
    }
    echo '</div>';

    page_bottom();
}

function form_qris(array $user, PDO $pdo): void
{
    require_role(['admin']);
    $qris = getQris($pdo);

    page_top('Atur QRIS', $user, 'qris');

    echo '<a class="btn btn-ghost btn-sm" href="dashboard.php?view=qris" style="margin-bottom:14px">'
        . svg_icon('back', 15) . 'Kembali ke QRIS</a>';

    echo '<div class="card card-pad form-card-wide">';
    echo '<h1 class="h2">Atur pembayaran QRIS</h1>';
    echo '<p class="muted">Tempel string QRIS dari aplikasi bank / e-wallet Anda agar warga bisa membayar dengan scan.</p>';

    echo '<form method="post" action="dashboard.php">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="save_qris">';
    echo '<input type="hidden" name="back_view" value="qris">';

    echo '<div class="form-grid">';
    echo '<div class="form-row"><label for="qr-merchant">Nama merchant / atas nama</label>'
        . '<input class="input" id="qr-merchant" name="qris_merchant_name" value="' . e($qris['qris_merchant_name'] ?? '') . '" placeholder="cth: Jimpitan RT 02"></div>';
    echo '<div class="form-row"><label for="qr-payload">String QRIS</label>'
        . '<textarea class="input" id="qr-payload" name="qris_payload" rows="5" placeholder="cth: 00020101021126670014COM.GO-JEK...">' . e($qris['qris_payload'] ?? '') . '</textarea>'
        . '<p class="hint">Kode QRIS dimulai dengan "000201". Salin dari aplikasi bank / e-wallet Anda.</p></div>';
    echo '<div class="checkbox-row"><input type="checkbox" id="qr-active" name="qris_active" value="1"'
        . ((int) ($qris['qris_active'] ?? 0) === 1 ? ' checked' : '') . '>'
        . '<label for="qr-active" style="font-weight:600">Aktifkan pembayaran QRIS — tampilkan kode QR untuk warga</label></div>';
    echo '<div class="form-actions">'
        . '<button class="btn btn-primary" type="submit">' . svg_icon('check', 16) . 'Simpan</button>'
        . '<a class="btn btn-ghost" href="dashboard.php?view=qris">Batal</a>'
        . '</div>';
    echo '</div></form></div>';

    page_bottom();
}

/* ================================================================== */
/* Rekap                                                              */
/* ================================================================== */

function render_rekap(array $user, PDO $pdo): void
{
    $rows = listRekap($pdo);
    $total = (int) array_sum(array_column($rows, 'nominal'));

    page_top('Rekap iuran', $user, 'rekap');

    echo section_title('Rekap iuran', 'Seluruh catatan pembayaran — bisa diekspor ke CSV (buka di Excel).');

    echo '<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px">'
        . '<div class="grid grid-2" style="gap:12px">'
        . stat_card('Total catatan', (string) count($rows), 'baris pembayaran')
        . stat_card('Total nominal', rupiah($total), 'seluruh periode', 'primary')
        . '</div>'
        . '<a class="btn btn-outline" href="export.php">' . svg_icon('download', 16) . 'Ekspor CSV</a>'
        . '</div>';

    echo '<div class="table-wrap"><table class="table"><thead><tr>'
        . '<th>#</th><th>Bulan</th><th>Nama</th><th>No. rumah</th><th>Alamat / RT</th>'
        . '<th class="num">Nominal</th><th>Dicatat oleh</th><th>Tanggal input</th><th>Catatan</th>'
        . '</tr></thead><tbody>';

    if (!$rows) {
        echo '<tr><td colspan="9"><p class="empty" style="padding:26px 0">Belum ada catatan pembayaran.</p></td></tr>';
    }

    $no = 1;
    foreach ($rows as $r) {
        echo '<tr><td class="muted-cell">' . $no . '</td>'
            . '<td class="num">' . e($r['month']) . '</td>'
            . '<td><strong>' . e($r['nama']) . '</strong></td>'
            . '<td class="muted-cell">' . e($r['no_rumah'] ?: '—') . '</td>'
            . '<td class="muted-cell">' . e($r['alamat'] ?: '—') . '</td>'
            . '<td class="num">' . rupiah((int) $r['nominal']) . '</td>'
            . '<td class="muted-cell">' . e($r['dicatat_oleh']) . '</td>'
            . '<td class="muted-cell">' . formatTanggal($r['created_at']) . '</td>'
            . '<td class="muted-cell">' . e($r['note'] ?: '—') . '</td></tr>';
        $no++;
    }
    echo '</tbody></table></div>';

    page_bottom();
}

/* ================================================================== */
/* Akun                                                               */
/* ================================================================== */

function render_akun(array $user, PDO $pdo): void
{
    $roleLabel = ['admin' => 'Admin', 'pengurus' => 'Pengurus', 'warga' => 'Warga'];

    page_top('Akun', $user, 'akun');

    echo section_title('Akun', 'Profil dan keamanan login Anda.');

    echo '<div class="grid grid-2">';

    echo '<div class="card card-pad">';
    echo '<h3 style="font-size:16px;font-weight:700;margin:0 0 12px">Profil</h3>';
    echo '<div class="info-box">';
    echo '<div class="row"><span class="muted">Nama</span><span><strong>' . e($user['name']) . '</strong></span></div>';
    echo '<div class="row"><span class="muted">Username</span><span>@' . e($user['username']) . '</span></div>';
    echo '<div class="row"><span class="muted">Peran</span><span>' . role_badge($user['role']) . '</span></div>';
    if ($user['role'] === 'warga') {
        echo '<div class="row"><span class="muted">No. rumah</span><span>' . e($user['no_rumah'] ?: '—') . '</span></div>';
        echo '<div class="row"><span class="muted">Alamat / RT</span><span>' . e($user['alamat'] ?: '—') . '</span></div>';
    }
    echo '</div></div>';

    echo '<div class="card card-pad">';
    echo '<h3 style="font-size:16px;font-weight:700;margin:0 0 12px">Ganti password</h3>';
    echo '<form method="post" action="dashboard.php">';
    echo csrf_field();
    echo '<input type="hidden" name="action" value="change_own_password">';
    echo '<input type="hidden" name="back_view" value="akun">';
    echo '<div class="form-grid">';
    echo '<div class="form-row"><label for="cp-current">Password lama</label>'
        . '<input class="input" id="cp-current" name="current_password" type="password" autocomplete="current-password" required></div>';
    echo '<div class="form-row"><label for="cp-new">Password baru</label>'
        . '<input class="input" id="cp-new" name="new_password" type="password" placeholder="minimal 4 karakter" autocomplete="new-password" required></div>';
    echo '<div class="form-row"><label for="cp-confirm">Ulangi password baru</label>'
        . '<input class="input" id="cp-confirm" name="confirm_password" type="password" autocomplete="new-password" required></div>';
    echo '<button class="btn btn-primary" type="submit">' . svg_icon('check', 16) . 'Perbarui password</button>';
    echo '</div></form></div>';

    echo '</div>';

    page_bottom();
}

/* ================================================================== */
/* Dispatch form                                                      */
/* ================================================================== */

function render_form_page(array $user, PDO $pdo, string $view, string $form): void
{
    switch ($view) {
        case 'jimpitan':
            if ($form === 'pay') {
                form_jimpitan_pay($user, $pdo);
                return;
            }
            if ($form === 'delete_payment') {
                form_jimpitan_delete($user, $pdo);
                return;
            }
            break;

        case 'pengeluaran':
            if ($form === 'add') {
                form_expense($user, $pdo, null);
                return;
            }
            if ($form === 'edit') {
                form_expense($user, $pdo, (int) ($_GET['id'] ?? 0));
                return;
            }
            if ($form === 'delete_expense') {
                form_expense_delete($user, $pdo, (int) ($_GET['id'] ?? 0));
                return;
            }
            break;

        case 'warga':
            if ($form === 'add') {
                form_user($user, $pdo, null);
                return;
            }
            if ($form === 'edit') {
                form_user($user, $pdo, (int) ($_GET['id'] ?? 0));
                return;
            }
            if ($form === 'password') {
                form_user_password($user, $pdo, (int) ($_GET['id'] ?? 0));
                return;
            }
            if ($form === 'delete_user') {
                form_user_delete($user, $pdo, (int) ($_GET['id'] ?? 0));
                return;
            }
            break;

        case 'qris':
            if ($form === 'edit') {
                form_qris($user, $pdo);
                return;
            }
            break;
    }

    redirect('dashboard.php?view=' . urlencode($view));
}
