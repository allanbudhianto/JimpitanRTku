<?php
/**
 * Beranda publik (landing page). Menampilkan statistik kas, ringkasan
 * bulan terakhir, grafik, dan daftar pengeluaran (view-only).
 */

require_once __DIR__ . '/includes/layout.php';

$user = current_user();
$pdo = db();
$stats = publicStats($pdo);
$expenses = publicExpenses($pdo);

page_top('Beranda');

$pctPaid = $stats['totalWarga'] > 0
    ? (int) round($stats['latestPaid'] / $stats['totalWarga'] * 100)
    : 0;
$maxSeries = 1;
foreach ($stats['series'] as $s) {
    $maxSeries = max($maxSeries, (int) $s['total']);
}
?>

<div class="hero">
  <span class="hero-badge"><?= svg_icon('coins', 16) ?> Kas &amp; iuran warga — transparan</span>
  <h1>Iuran warga, tercatat <span class="accent">rapi</span>.</h1>
  <p>Kelola jimpitan bulanan tiap warga, pantau siapa yang sudah membayar,
     dan jaga saldo kas RT tetap transparan.</p>
  <div class="hero-actions">
    <?php if ($user): ?>
      <a class="btn btn-primary btn-lg" href="dashboard.php"><?= svg_icon('user', 18) ?>Buka dashboard</a>
    <?php else: ?>
      <a class="btn btn-primary btn-lg" href="login.php"><?= svg_icon('lock', 18) ?>Masuk</a>
      <a class="btn btn-outline btn-lg" href="#statistik">Lihat statistik</a>
    <?php endif; ?>
  </div>
</div>

<section class="landing-section" id="statistik">
  <div class="grid grid-4">
    <?= stat_card('Total terkumpul', rupiah($stats['grandTotal']), $stats['monthsCount'] . ' bulan tercatat', 'primary') ?>
    <?= stat_card('Pengeluaran', rupiah($stats['totalPengeluaran']), 'kas keluar', 'danger') ?>
    <?= stat_card('Saldo kas', rupiah($stats['saldo']), 'terkumpul − pengeluaran', 'success') ?>
    <?= stat_card('Warga terdaftar', (string) $stats['totalWarga'], 'iuran ' . rupiah(JIMPITAN_PER_BULAN) . '/bulan') ?>
  </div>
</section>

<?php if ($stats['latestMonth']): ?>
  <section class="landing-section">
    <div class="grid grid-2">
      <div class="card card-pad">
        <div class="section-head" style="margin-bottom:14px">
          <h3 style="font-size:16px;font-weight:700;margin:0">Bulan terakhir: <?= monthLabel($stats['latestMonth']) ?></h3>
        </div>
        <div class="info-box">
          <div class="row"><span class="muted">Terkumpul</span><span><strong><?= rupiah($stats['latestTotal']) ?></strong></span></div>
          <div class="row"><span class="muted">Target iuran</span><span><?= rupiah($stats['targetPerMonth']) ?></span></div>
          <div class="row"><span class="muted">Sudah bayar</span><span><span class="badge badge-success"><?= $stats['latestPaid'] ?> warga</span></span></div>
          <div class="row"><span class="muted">Belum bayar</span><span><span class="badge badge-warn"><?= $stats['latestUnpaid'] ?> warga</span></span></div>
        </div>
        <div style="margin-top:14px">
          <?= progress_bar($pctPaid) ?>
          <p class="muted" style="font-size:12.5px;margin:6px 0 0"><?= $pctPaid ?>% warga sudah melunasi bulan ini</p>
        </div>
      </div>

      <div class="card card-pad">
        <div class="section-head" style="margin-bottom:6px">
          <h3 style="font-size:16px;font-weight:700;margin:0">Perkembangan 6 bulan terakhir</h3>
        </div>
        <?php if ($stats['series']): ?>
          <div class="chart">
            <?php foreach ($stats['series'] as $s): ?>
              <div class="chart-col">
                <span class="chart-value"><?= number_format((int) $s['total'] / 1000, 0, ',', '.') ?>rb</span>
                <div class="chart-bar" style="height:<?= max(4, (int) round((int) $s['total'] / $maxSeries * 100)) ?>%"></div>
                <span class="chart-label"><?= monthShortLabel($s['month']) ?></span>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <p class="muted" style="padding:26px 0;text-align:center">Belum ada data pembayaran.</p>
        <?php endif; ?>
      </div>
    </div>
  </section>
<?php endif; ?>

<section class="landing-section">
  <div class="card">
    <div class="card-head">
      <div>
        <h3>Pengeluaran kas terakhir</h3>
        <p class="muted">Hanya tampilan — rincian lengkap untuk warga di dashboard.</p>
      </div>
      <span class="badge badge-danger" style="flex:none">Total <?= rupiah($expenses['total']) ?></span>
    </div>
    <?php if ($expenses['items']): ?>
      <div class="table-wrap" style="border:none;box-shadow:none;margin:14px 22px 22px">
        <table class="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Alasan</th>
              <th style="text-align:right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($expenses['items'] as $x): ?>
              <tr>
                <td class="muted-cell"><?= formatTanggal($x['created_at']) ?></td>
                <td><?= e($x['alasan']) ?></td>
                <td class="num" style="text-align:right"><?= rupiah((int) $x['nominal']) ?></td>
              </tr>
            <?php endforeach; ?>
            <?php if ($expenses['count'] > count($expenses['items'])): ?>
              <tr><td colspan="3" class="muted-cell">… dan <?= $expenses['count'] - count($expenses['items']) ?> pengeluaran lainnya</td></tr>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    <?php else: ?>
      <p class="empty">Belum ada pengeluaran kas tercatat.</p>
    <?php endif; ?>
  </div>
</section>

<section class="landing-section" style="text-align:center;padding:18px 0 8px">
  <?php if ($user): ?>
    <a class="btn btn-primary btn-lg" href="dashboard.php"><?= svg_icon('right', 18) ?>Ke dashboard</a>
  <?php else: ?>
    <a class="btn btn-primary btn-lg" href="login.php"><?= svg_icon('right', 18) ?>Masuk untuk melihat rincian</a>
  <?php endif; ?>
</section>

<?php page_bottom(); ?>
