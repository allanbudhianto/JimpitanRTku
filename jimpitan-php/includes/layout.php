<?php
/**
 * Layout: ikon SVG inline, halaman atas/bawah, header + navigasi per role.
 */

require_once __DIR__ . '/auth.php';

function svg_icon(string $name, int $size = 18): string
{
    $icons = [
        'home'     => '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        'calendar' => '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        'wallet'   => '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
        'users'    => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'qr'       => '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M21 14v3h-3"/><path d="M14 21h3v-3"/>',
        'db'       => '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
        'user'     => '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'coins'    => '<circle cx="8" cy="8" r="5"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88l.7.71-2.82 2.82"/>',
        'logout'   => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
        'plus'     => '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        'pencil'   => '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        'trash'    => '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        'search'   => '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        'left'     => '<polyline points="15 18 9 12 15 6"/>',
        'right'    => '<polyline points="9 18 15 12 9 6"/>',
        'download' => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        'check'    => '<polyline points="20 6 9 17 4 12"/>',
        'alert'    => '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        'eye'      => '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        'eyeoff'   => '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>',
        'lock'     => '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        'back'     => '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
        'lockkey'  => '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
        'phone'    => '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    ];

    $body = $icons[$name] ?? '<circle cx="12" cy="12" r="10"/>';
    return '<svg class="icon" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" '
        . 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        . $body . '</svg>';
}

/** Item navigasi per role. Kembalikan [key => [label, icon, roles]]. */
function nav_items(string $role): array
{
    $all = [
        'beranda'     => ['Beranda', 'home', ['admin', 'pengurus', 'warga']],
        'jimpitan'    => ['Rincian Jimpitan', 'calendar', ['admin', 'pengurus', 'warga']],
        'pengeluaran' => ['Pengeluaran', 'wallet', ['admin', 'pengurus', 'warga']],
        'warga'       => ['Warga & Pengurus', 'users', ['admin']],
        'qris'        => ['QRIS', 'qr', ['admin', 'pengurus', 'warga']],
        'rekap'       => ['Rekap', 'db', ['admin', 'pengurus']],
        'kontak'      => ['Kontak', 'phone', ['admin', 'pengurus', 'warga']],
        'akun'        => ['Akun', 'user', ['admin', 'pengurus', 'warga']],
    ];
    $items = [];
    foreach ($all as $key => [$label, $icon, $roles]) {
        if (in_array($role, $roles, true)) {
            $items[$key] = [$label, $icon];
        }
    }
    return $items;
}

function render_header(array $user, string $active): void
{
    $items = nav_items($user['role']);
    $roleLabel = ['admin' => 'Admin', 'pengurus' => 'Pengurus', 'warga' => 'Warga'];

    echo '<header class="topbar">';
    echo '<div class="container topbar-inner">';
    echo '<a class="brand" href="dashboard.php"><span class="brand-mark">' . svg_icon('coins', 22) . '</span>'
        . '<span class="brand-text">Jimpitan <strong>RT</strong></span></a>';
    echo '<div class="topbar-right">';
    echo '<span class="user-chip"><span class="avatar">' . e(initials($user['name'])) . '</span>'
        . '<span class="user-meta"><span class="user-name">' . e($user['name']) . '</span>'
        . '<span class="user-role">' . e($roleLabel[$user['role']] ?? $user['role']) . '</span></span></span>';
    echo '<a class="btn btn-ghost btn-sm" href="logout.php">' . svg_icon('logout', 16) . 'Keluar</a>';
    echo '</div></div>';

    echo '<nav class="container nav-tabs" aria-label="Menu utama">';
    foreach ($items as $key => [$label, $icon]) {
        $cls = $key === $active ? ' nav-tab-active' : '';
        echo '<a class="nav-tab' . $cls . '" href="dashboard.php?view=' . $key . '">' . svg_icon($icon, 16) . $label . '</a>';
    }
    echo '</nav>';
    echo '</header>';
}

/** Buka halaman: <head> + header (bila login) + flash. */
function page_top(string $title, ?array $user = null, ?string $active = null): void
{
    echo '<!doctype html><html lang="id"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . e($title) . ' — ' . APP_NAME . '</title>'
        . '<link rel="preconnect" href="https://fonts.googleapis.com">'
        . '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        . '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">'
        . '<link rel="stylesheet" href="assets/style.css">'
        . '</head><body><div class="glow-bg" aria-hidden="true"></div>';

    if ($user) {
        render_header($user, $active);
    }

    echo '<main class="container page">';
    foreach (flash_get() as $f) {
        echo '<div class="flash flash-' . e($f['type']) . '"><span class="flash-icon">'
            . svg_icon($f['type'] === 'success' ? 'check' : 'alert', 16) . '</span>'
            . e($f['msg']) . '</div>';
    }
}

function page_bottom(): void
{
    echo '</main>';
    echo '<footer class="footer"><div class="container">' . APP_NAME . ' — ' . APP_TAGLINE . '</div></footer>';
    echo '</body></html>';
}

/* ------------------------------------------------------------------ */
/* Komponen kecil yang dipakai di banyak view                          */
/* ------------------------------------------------------------------ */

function badge(string $text, string $kind): string
{
    return '<span class="badge badge-' . e($kind) . '">' . e($text) . '</span>';
}

function status_badge(string $status): string
{
    if ($status === 'lunas') {
        return badge('Lunas', 'success');
    }
    return badge('Belum', 'warn');
}

/** Badge metode pembayaran (Tunai / QRIS) atau teks catatan lama. */
function note_html(?string $note): string
{
    $n = normalizeNote($note);
    if ($n === '') {
        return '—';
    }
    if ($n === 'Tunai') {
        return badge('Tunai', 'muted');
    }
    if ($n === 'QRIS') {
        return badge('QRIS', 'primary');
    }
    return e($n);
}

function role_badge(string $role): string
{
    $map = [
        'admin'    => badge('Admin', 'dark'),
        'pengurus' => badge('Pengurus', 'primary'),
        'warga'    => badge('Warga', 'muted'),
    ];
    return $map[$role] ?? badge($role, 'muted');
}

function stat_card(string $label, string $value, string $sub = '', string $tone = ''): string
{
    return '<div class="card stat-card' . ($tone ? ' stat-' . $tone : '') . '">'
        . '<p class="stat-label">' . e($label) . '</p>'
        . '<p class="stat-value">' . $value . '</p>'
        . ($sub !== '' ? '<p class="stat-sub">' . $sub . '</p>' : '')
        . '</div>';
}

function section_title(string $title, string $desc = ''): string
{
    return '<div class="section-head"><h1 class="h2">' . e($title) . '</h1>'
        . ($desc !== '' ? '<p class="muted">' . e($desc) . '</p>' : '') . '</div>';
}

/** Tombol aksi kecil (Bayar / Edit / Hapus) dengan ikon. */
function action_btn(string $href, string $label, string $kind, string $icon, string $extra = ''): string
{
    return '<a class="btn btn-sm btn-' . e($kind) . '" href="' . e($href) . '"' . $extra . '>'
        . svg_icon($icon, 15) . e($label) . '</a>';
}

/** Progress bar sederhana (0-100). */
function progress_bar(int $pct, string $tone = 'primary'): string
{
    $pct = max(0, min(100, $pct));
    return '<div class="progress"><div class="progress-fill progress-' . e($tone) . '" style="width:' . $pct . '%"></div></div>';
}
