import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Eye,
  HandCoins,
  LineChart,
  PencilLine,
  Receipt,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Link } from "react-router";

const features = [
  {
    icon: CalendarCheck2,
    title: "Input bulanan per warga",
    description:
      "Pengurus cukup mencatat nominal iuran setiap warga sekali sebulan. Data tersimpan rapi per bulan.",
  },
  {
    icon: Eye,
    title: "Transparan untuk semua",
    description:
      "Admin, pengurus, dan warga melihat total terkumpul serta siapa saja yang belum membayar.",
  },
  {
    icon: ShieldCheck,
    title: "Peran yang jelas",
    description:
      "Admin mendaftarkan warga & pengurus, pengurus mencatat iuran, dan warga memantau. Sesuai perannya masing-masing.",
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Admin mendaftarkan warga",
    description:
      "Tambahkan warga dan pengurus — cukup sekali.",
  },
  {
    icon: PencilLine,
    title: "Pengurus mencatat iuran",
    description:
      "Isi nominal jimpitan tiap warga setiap bulan, hanya butuh beberapa klik.",
  },
  {
    icon: LineChart,
    title: "Semua memantau",
    description:
      "Total terkumpul dan status pembayaran terlihat jelas oleh seluruh warga.",
  },
];

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: id });
}

function monthShortLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMM", { locale: id });
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function MiniTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: { label: string; total: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-medium">{item.label}</p>
      <p className="tabular-nums text-muted-foreground">
        {formatRupiah(item.total)}
      </p>
    </div>
  );
}

export default function Landing() {
  const stats = useQuery(api.jimpitan.getPublicStats);
  const publicExpenses = useQuery(api.pengeluaran.getPublicExpenses);
  const chartData = (stats?.series ?? []).map((s) => ({
    ...s,
    label: monthShortLabel(s.month),
  }));
  const paidPct =
    stats && stats.totalWarga > 0
      ? Math.round((stats.latestPaid / stats.totalWarga) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HandCoins className="size-5" />
            </span>
            <span className="text-sm font-bold tracking-tight">Jimpitan RT</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/auth">Masuk</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Badge className="mb-5 border-transparent bg-primary/10 px-3 py-1 text-primary">
                Kas warga yang transparan & sederhana
              </Badge>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Catat jimpitan RT jadi{" "}
                <span className="text-primary">mudah</span> dan transparan.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Kelola iuran bulanan warga dalam satu tempat — pengurus
                mencatat, admin mengelola, dan semua warga bisa memantau siapa
                yang sudah membayar.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    Mulai sekarang
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#cara-kerja">Lihat cara kerja</a>
                </Button>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Gratis untuk warga
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Data aman & pribadi
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Tanpa aplikasi tambahan
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            >
              <Card className="gap-0 overflow-hidden py-0 shadow-xl shadow-primary/10">
                <CardHeader className="flex-row items-center justify-between border-b px-5 py-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Bulan ini
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      {stats?.latestMonth
                        ? monthLabel(stats.latestMonth)
                        : "Belum ada data"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    {stats
                      ? `${stats.latestPaid}/${stats.totalWarga} lunas`
                      : "Memuat…"}
                  </Badge>
                </CardHeader>
                <CardContent className="px-5 py-5">
                  {!stats ? (
                    <div className="space-y-4" aria-busy="true">
                      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
                      <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
                      <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
                    </div>
                  ) : stats.latestMonth === null ? (
                    <div className="py-6 text-center">
                      <HandCoins className="mx-auto size-8 text-muted-foreground" />
                      <p className="mt-3 text-sm font-semibold">
                        Belum ada catatan jimpitan
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Data real akan tampil di sini begitu pengurus mulai
                        mencatat pembayaran.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Terkumpul bulan ini
                          </p>
                          <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                            {formatRupiah(stats.latestTotal)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Belum bayar</p>
                          <p className="mt-1 text-lg font-bold text-foreground">
                            {stats.latestUnpaid} warga
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {stats.latestPaid} dari {stats.totalWarga} warga sudah
                        lunas ({paidPct}%)
                      </p>
                      {chartData.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs text-muted-foreground">
                            6 bulan terakhir
                          </p>
                          <div className="mt-2 h-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={chartData}
                                margin={{
                                  top: 4,
                                  right: 0,
                                  left: 0,
                                  bottom: 0,
                                }}
                              >
                                <XAxis dataKey="label" hide />
                                <Tooltip
                                  content={<MiniTooltip />}
                                  cursor={{
                                    fill: "var(--muted)",
                                    opacity: 0.4,
                                  }}
                                />
                                <Bar
                                  dataKey="total"
                                  fill="var(--primary)"
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={26}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 space-y-1 border-t pt-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Total terkumpul
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatRupiah(stats.grandTotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Pengeluaran
                          </span>
                          <span className="font-semibold tabular-nums text-destructive">
                            −{formatRupiah(stats.totalPengeluaran)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-1">
                          <span className="font-medium text-foreground">
                            Saldo kas
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatRupiah(stats.saldo)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Fitur
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Semua yang RT butuhkan, tanpa ribet
              </h2>
            </motion.div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
                    <CardContent className="px-5 py-6">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <feature.icon className="size-5" />
                      </div>
                      <h3 className="mt-4 text-base font-bold tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pengeluaran kas (view-only) */}
        {publicExpenses && (
          <section className="border-b bg-background">
            <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Transparansi kas
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Pengeluaran kas RT
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  Setiap pengeluaran tercatat terbuka — saldo kas otomatis
                  berkurang sesuai nominalnya.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="mx-auto mt-10 max-w-2xl"
              >
                <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                  <CardHeader className="flex-row items-center justify-between border-b px-5 py-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Total pengeluaran
                      </p>
                      <p className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums text-destructive">
                        −{formatRupiah(publicExpenses.total)}
                      </p>
                    </div>
                    <Receipt className="size-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-0">
                    {publicExpenses.items.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <Receipt className="mx-auto size-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">
                          Belum ada pengeluaran
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pengeluaran kas akan tampil di sini.
                        </p>
                      </div>
                    ) : (
                      <>
                        <ul className="divide-y">
                          {publicExpenses.items.map((e) => (
                            <li
                              key={e._id}
                              className="flex items-center justify-between gap-3 px-5 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {e.alasan}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(e.recordedAt).toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                  {e.recordedByName
                                    ? ` · ${e.recordedByName}`
                                    : ""}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                                −{formatRupiah(e.nominal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {publicExpenses.count > publicExpenses.items.length && (
                          <p className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
                            Menampilkan {publicExpenses.items.length}{" "}
                            pengeluaran terbaru dari {publicExpenses.count}.
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </section>
        )}

        {/* How it works */}
        <section
          id="cara-kerja"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Cara kerja
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Tiga langkah sederhana
            </h2>
          </motion.div>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="flex size-12 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm">
                  <step.icon className="size-6" />
                </div>
                <span className="mt-4 text-xs font-bold text-muted-foreground">
                  LANGKAH {i + 1}
                </span>
                <h3 className="mt-1 text-base font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="gap-0 overflow-hidden border-primary/20 bg-primary/5 py-12 text-center shadow-none">
              <CardContent className="flex flex-col items-center gap-5 px-6">
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Siap mencatat jimpitan dengan rapi?
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Mulai gratis — login dengan username{" "}
                  <span className="font-mono font-semibold text-foreground">
                    admin
                  </span>{" "}
                  dan password{" "}
                  <span className="font-mono font-semibold text-foreground">
                    admin
                  </span>{" "}
                  untuk menjadi admin RT.
                </p>
                <Button asChild size="lg">
                  <Link to="/auth">
                    Masuk ke Jimpitan RT
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© 2026 Jimpitan RT — Dibuat untuk warga Indonesia.</p>
          <p className="flex items-center gap-1.5">
            <HandCoins className="size-3.5 text-primary" />
            Aman, sederhana, dan transparan
          </p>
        </div>
      </footer>
    </div>
  );
}
