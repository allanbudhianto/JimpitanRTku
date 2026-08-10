import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Eye,
  HandCoins,
  LineChart,
  PencilLine,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
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
      "Tambahkan warga dan pengurus beserta alamat rumahnya — cukup sekali.",
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

const previewRows = [
  { name: "Pak Budi", paid: true },
  { name: "Bu Siti", paid: true },
  { name: "Pak Agus", paid: true },
  { name: "Bu Dewi", paid: false },
];

export default function Landing() {
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
                    <p className="mt-0.5 text-sm font-bold">Agustus 2026</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-transparent bg-emerald-500/10 text-emerald-600"
                  >
                    25/30 lunas
                  </Badge>
                </CardHeader>
                <CardContent className="px-5 py-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Terkumpul bulan ini
                      </p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                        Rp 1.250.000
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Belum bayar</p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        5 warga
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[83%] rounded-full bg-primary" />
                  </div>
                  <div className="mt-5 space-y-2">
                    {previewRows.map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <span className="text-sm font-medium">{row.name}</span>
                        {row.paid ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="size-3.5" /> Lunas
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-3.5 rounded-full border border-dashed border-muted-foreground/50" />
                            Belum
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
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

        {/* How it works */}
        <section id="cara-kerja" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
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
                  <span className="font-mono font-semibold text-foreground">admin</span>{" "}
                  dan password{" "}
                  <span className="font-mono font-semibold text-foreground">admin</span>{" "}
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
