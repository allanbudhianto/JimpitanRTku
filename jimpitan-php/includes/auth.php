<?php
/**
 * Autentikasi: session, guard per role, dan verifikasi password.
 *
 * Password tersimpan sebagai hash bcrypt (password_hash). Untuk data awal
 * yang di-import dari jimpitan.sql, password bisa berupa teks polos (seed)
 * — saat pertama kali login sukses, otomatis diganti dengan hash bcrypt.
 */

require_once __DIR__ . '/functions.php';

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Pengguna yang sedang login (data segar dari DB), atau null. */
function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([(int) $_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }
    return $user;
}

/** Wajib login; redirect ke login.php bila belum. */
function require_login(): array
{
    $user = current_user();
    if (!$user) {
        redirect('login.php');
    }
    return $user;
}

/** Wajib login dengan salah satu role. */
function require_role(array $roles): array
{
    $user = current_user();
    if (!$user) {
        redirect('login.php');
    }
    if (!in_array($user['role'], $roles, true)) {
        http_response_code(403);
        exit('Anda tidak memiliki akses ke halaman ini.');
    }
    return $user;
}

function can_manage(string $role): bool
{
    return $role === 'admin' || $role === 'pengurus';
}

/**
 * Verifikasi password seorang user (hash bcrypt, atau seed plaintext yang
 * otomatis di-upgrade menjadi bcrypt saat cocok).
 */
function verify_user_password(PDO $pdo, array $user, string $password): bool
{
    $hash = (string) $user['password_hash'];
    if (str_starts_with($hash, '$2')) {
        return password_verify($password, $hash);
    }

    // Seed plaintext dari jimpitan.sql — bandingkan lalu upgrade ke hash.
    $ok = hash_equals($hash, $password);
    if ($ok) {
        $up = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $up->execute([password_hash($password, PASSWORD_DEFAULT), (int) $user['id']]);
    }
    return $ok;
}

/**
 * Coba login. Mengembalikan data user bila sukses (session sudah diset),
 * atau null bila gagal.
 */
function attempt_login(string $username, string $password): ?array
{
    $stmt = db()->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([strtolower(trim($username))]);
    $user = $stmt->fetch();
    if (!$user) {
        return null;
    }

    if (!verify_user_password(db(), $user, $password)) {
        return null;
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    return $user;
}

function logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
