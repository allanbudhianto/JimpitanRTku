<?php
require_once __DIR__ . '/includes/layout.php';

if (current_user()) {
    redirect('dashboard.php');
}

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if ($username === '' || $password === '') {
        $error = 'Username dan password wajib diisi.';
    } else {
        $user = attempt_login($username, $password);
        if ($user) {
            flash_set('success', 'Selamat datang, ' . $user['name'] . '!');
            redirect('dashboard.php');
        }
        $error = 'Username atau password salah.';
    }
}
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Masuk — <?= APP_NAME ?></title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="glow-bg" aria-hidden="true"></div>
<main class="container page" style="display:flex;justify-content:center;padding-top:64px">
  <div style="width:100%;max-width:400px">
    <div style="text-align:center;margin-bottom:22px">
      <a href="index.php" style="display:inline-flex;align-items:center;gap:10px;color:var(--text);text-decoration:none">
        <span class="brand-mark" style="width:46px;height:46px;border-radius:14px"><?= svg_icon('coins', 24) ?></span>
        <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em">Jimpitan <span style="color:var(--primary)">RT</span></span>
      </a>
    </div>

    <div class="card" style="overflow:hidden">
      <div style="padding:24px 26px 20px;background:var(--surface-2);border-bottom:1px solid var(--border)">
        <h1 class="h2" style="margin:0">Masuk</h1>
        <p class="muted" style="margin:4px 0 0">Masukkan username dan password Anda</p>
      </div>
      <form method="post" style="padding:24px 26px">
        <?= csrf_field() ?>
        <div class="form-grid">
          <div class="form-row">
            <label for="username">Username</label>
            <input class="input" id="username" name="username" placeholder="cth: admin"
                   autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
          </div>
          <div class="form-row">
            <label for="password">Password</label>
            <div style="position:relative">
              <input class="input" id="password" name="password" type="password" placeholder="••••••••"
                     autocomplete="current-password" required style="padding-right:44px">
              <button type="button" id="togglePass" aria-label="Tampilkan password"
                      style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;color:var(--muted);padding:6px;border-radius:8px">
                <?= svg_icon('eye', 17) ?>
              </button>
            </div>
          </div>
          <?php if ($error): ?>
            <div class="form-error"><?= e($error) ?></div>
          <?php endif; ?>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Masuk</button>
        </div>
      </form>
      <div style="padding:14px 26px;border-top:1px solid var(--border);background:var(--surface-2)">
        <p class="muted" style="font-size:12.5px;margin:0;line-height:1.7">
          Akun bawaan: <code>admin / admin</code> ·
          <code>sari / sari</code> (pengurus) ·
          <code>sunaryo / sunaryo</code> · <code>galih / galih</code> (warga).<br>
          Warga &amp; pengurus baru didaftarkan oleh admin RT.
        </p>
      </div>
    </div>

    <p style="text-align:center;margin-top:18px">
      <a class="btn btn-ghost btn-sm" href="index.php"><?= svg_icon('back', 15) ?>Kembali ke beranda</a>
    </p>
  </div>
</main>
<script>
document.getElementById('togglePass').addEventListener('click', function () {
  var input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
  this.querySelector('svg').outerHTML = '';
  this.innerHTML = input.type === 'password'
    ? '<svg class="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg class="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
});
</script>
</body>
</html>
