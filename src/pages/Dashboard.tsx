import { api } from "@/convex/_generated/api";
import { JIMPITAN_PER_BULAN, ROLES, type Role } from "@/convex/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useMutation, useQuery } from "convex/react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  HandCoins,
  KeyRound,
  Landmark,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: id });
}

function monthShortLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMM yy", { locale: id });
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  pengurus: "Pengurus",
  warga: "Warga",
};

const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin: "border-transparent bg-foreground text-background",
  pengurus: "border-transparent bg-primary/12 text-primary",
  warga: "border-transparent bg-muted text-muted-foreground",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="outline" className={ROLE_BADGE_CLASS[role]}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}

const FILTERS: { key: "semua" | "lunas" | "belum"; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "lunas", label: "Sudah bayar" },
  { key: "belum", label: "Belum bayar" },
];

const chartConfig = {
  total: { label: "Terkumpul", color: "var(--primary)" },
  target: { label: "Target", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

function chartTooltipFormatter(value: unknown, name: unknown) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground">{String(name)}</span>
      <span className="font-medium tabular-nums">
        {formatRupiah(Number(value))}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Warga = { _id: Id<"users">; name: string; alamat: string; noRumah: string };

type PaymentInfo = {
  _id: Id<"jimpitan">;
  nominal: number;
  note: string;
  recordedByName: string;
  recordedAt: number;
};

type OverviewRow = {
  warga: Warga;
  payment: PaymentInfo | null;
  /** Credit carried into this month (kelebihan dari bulan sebelumnya). */
  saldoBefore: number;
  status: "lunas" | "belum";
};

/** Kelebihan yang dibawa ke bulan berikutnya (0 jika tidak ada). */
function carryToNext(row: OverviewRow) {
  return row.saldoBefore + (row.payment?.nominal ?? 0) - JIMPITAN_PER_BULAN;
}

type ManagedUser = {
  _id: Id<"users">;
  name: string;
  username: string;
  role: Role;
  alamat: string;
  noRumah: string;
  _creationTime: number;
};

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function NameDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateOwnName = useMutation(api.users.updateOwnName);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateOwnName({ name });
      toast.success("Nama diperbarui.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan nama.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Siapa nama Anda?</DialogTitle>
          <DialogDescription>
            Nama ini akan tampil di catatan pembayaran.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nm">Nama lengkap</Label>
            <Input
              id="nm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Siti Rahayu"
              autoFocus
              required
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addUser = useMutation(api.users.addUser);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"warga" | "pengurus">(ROLES.WARGA);
  const [alamat, setAlamat] = useState("");
  const [noRumah, setNoRumah] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setUsername("");
      setPassword("");
      setRole(ROLES.WARGA);
      setAlamat("");
      setNoRumah("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await addUser({
        name,
        username,
        password,
        role,
        alamat: alamat.trim() || undefined,
        noRumah: noRumah.trim() || undefined,
      });
      toast.success(
        role === ROLES.WARGA
          ? `Warga ${name.trim()} ditambahkan.`
          : `Pengurus ${name.trim()} ditambahkan.`,
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah warga / pengurus</DialogTitle>
          <DialogDescription>
            Mereka login dengan username & password yang Anda buat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="au-name">Nama lengkap</Label>
            <Input
              id="au-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Budi Santoso"
              required
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="au-username">Username</Label>
            <Input
              id="au-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cth: budi01"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              3–30 karakter: huruf kecil, angka, titik, strip, underscore.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="au-password">Password awal</Label>
            <Input
              id="au-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="minimal 4 karakter"
              autoComplete="off"
              required
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Digunakan saat mereka login. Beri tahu mereka password ini.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Peran</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "warga" | "pengurus")}
              disabled={submitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLES.WARGA}>Warga</SelectItem>
                <SelectItem value={ROLES.PENGGURUS}>Pengurus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === ROLES.WARGA && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="au-rumah">No. rumah</Label>
                <Input
                  id="au-rumah"
                  value={noRumah}
                  onChange={(e) => setNoRumah(e.target.value)}
                  placeholder="cth: 12"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="au-alamat">Alamat / RT</Label>
                <Input
                  id="au-alamat"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="cth: RT 02"
                  disabled={submitting}
                />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Tambahkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ManagedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateUser = useMutation(api.users.updateUser);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<"warga" | "pengurus">(
    user.role === ROLES.PENGGURUS ? ROLES.PENGGURUS : ROLES.WARGA,
  );
  const [alamat, setAlamat] = useState(user.alamat);
  const [noRumah, setNoRumah] = useState(user.noRumah);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setUsername(user.username);
      setRole(user.role === ROLES.PENGGURUS ? ROLES.PENGGURUS : ROLES.WARGA);
      setAlamat(user.alamat);
      setNoRumah(user.noRumah);
      setError(null);
    }
  }, [open, user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateUser({
        userId: user._id,
        name,
        username,
        role,
        alamat: alamat.trim() || undefined,
        noRumah: noRumah.trim() || undefined,
      });
      toast.success(`Data ${name.trim()} diperbarui.`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui data.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah data {user.name}</DialogTitle>
          <DialogDescription>
            Perbarui data warga/pengurus ini. Jika username diubah, login
            mereka ikut berubah.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="eu-name">Nama lengkap</Label>
            <Input
              id="eu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eu-username">Username</Label>
            <Input
              id="eu-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label>Peran</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "warga" | "pengurus")}
              disabled={submitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLES.WARGA}>Warga</SelectItem>
                <SelectItem value={ROLES.PENGGURUS}>Pengurus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === ROLES.WARGA && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="eu-rumah">No. rumah</Label>
                <Input
                  id="eu-rumah"
                  value={noRumah}
                  onChange={(e) => setNoRumah(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eu-alamat">Alamat / RT</Label>
                <Input
                  id="eu-alamat"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ManagedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const changeUserPassword = useMutation(api.users.changeUserPassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError("Password minimal 4 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changeUserPassword({ userId: user._id, password });
      toast.success(`Password ${user.name} diperbarui.`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ubah password {user.name}</DialogTitle>
          <DialogDescription>
            Password baru dipakai saat login dengan username @{user.username}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pd-password">Password baru</Label>
            <Input
              id="pd-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="minimal 4 karakter"
              autoComplete="off"
              autoFocus
              required
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pd-confirm">Ulangi password</Label>
            <Input
              id="pd-confirm"
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="ketik ulang password"
              autoComplete="off"
              required
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ManagedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteUser = useMutation(api.users.deleteUser);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteUser({ userId: user._id });
      toast.success(`Akun ${user.name} dihapus.`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus akun.");
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Akun, sesi login, dan seluruh catatan pembayaran {user.name} akan
            dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {submitting ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeletePaymentDialog({
  warga,
  payment,
  open,
  onOpenChange,
}: {
  warga: Warga;
  payment: PaymentInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deletePayment = useMutation(api.jimpitan.deletePayment);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deletePayment({ paymentId: payment._id });
      toast.success(`Pembayaran ${warga.name} dihapus.`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus pembayaran.");
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus pembayaran {warga.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Catatan pembayaran {formatRupiah(payment.nominal)} untuk bulan ini
            akan dihapus, dan {warga.name} akan kembali ditandai belum membayar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {submitting ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PayDialog({
  warga,
  month,
  payment,
  saldoBefore,
  onOpenChange,
}: {
  warga: Warga;
  month: string;
  payment: PaymentInfo | null;
  saldoBefore: number;
  onOpenChange: (open: boolean) => void;
}) {
  const recordPayment = useMutation(api.jimpitan.recordPayment);
  const deletePayment = useMutation(api.jimpitan.deletePayment);
  const [nominal, setNominal] = useState(
    payment ? String(payment.nominal) : String(JIMPITAN_PER_BULAN),
  );
  const [note, setNote] = useState(payment?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNominal(
      payment ? String(payment.nominal) : String(JIMPITAN_PER_BULAN),
    );
    setNote(payment?.note ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warga._id, month]);

  const parsedNominal = Number(nominal.replace(/\D/g, ""));
  const surplus = Number.isFinite(parsedNominal) && parsedNominal > 0
    ? saldoBefore + parsedNominal - JIMPITAN_PER_BULAN
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(nominal.replace(/\D/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Masukkan nominal yang valid.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await recordPayment({
        wargaId: warga._id,
        month,
        nominal: value,
        note: note.trim() || undefined,
      });
      toast.success(
        payment
          ? `Pembayaran ${warga.name} diperbarui.`
          : `Pembayaran ${warga.name} dicatat.`,
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pembayaran.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!payment) return;
    setSubmitting(true);
    setError(null);
    try {
      await deletePayment({ paymentId: payment._id });
      toast.success(`Pembayaran ${warga.name} dihapus.`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus pembayaran.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payment ? "Perbarui pembayaran" : "Catat pembayaran"}
          </DialogTitle>
          <DialogDescription>
            {warga.name} — {monthLabel(month)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pay-nominal">Nominal (Rp)</Label>
            <Input
              id="pay-nominal"
              inputMode="numeric"
              placeholder="cth: 15000"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              autoFocus
              disabled={submitting}
            />
            <div className="rounded-xl border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Iuran wajib bulan ini
                </span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(JIMPITAN_PER_BULAN)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Saldo dibawa</span>
                <span className="font-semibold tabular-nums">
                  {saldoBefore > 0
                    ? `+${formatRupiah(saldoBefore)}`
                    : formatRupiah(0)}
                </span>
              </div>
              {surplus !== null && surplus > 0 && (
                <p className="mt-2 font-medium text-emerald-600 dark:text-emerald-400">
                  Kelebihan {formatRupiah(surplus)} akan diakumulasikan ke
                  bulan berikutnya.
                </p>
              )}
              {surplus !== null && surplus < 0 && (
                <p className="mt-2 font-medium text-amber-600 dark:text-amber-400">
                  Masih kurang {formatRupiah(-surplus)} untuk lunas bulan ini.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-note">Catatan (opsional)</Label>
            <Input
              id="pay-note"
              placeholder="cth: dibayar tunai"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {payment ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={submitting}
              >
                <Trash2 className="size-4" />
                Hapus
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Simpan
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function FullScreenSpinner() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}

function UnregisteredCard({ onSignOut }: { onSignOut: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm gap-0 py-0 text-center shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 px-8 py-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="size-6" />
          </div>
          <div>
            <CardTitle className="text-lg">Akun belum terdaftar</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Akun Anda belum didaftarkan sebagai warga atau pengurus. Silakan
              hubungi admin RT untuk didaftarkan.
            </p>
          </div>
          <Button variant="outline" className="mt-2" onClick={onSignOut}>
            <LogOut className="size-4" />
            Keluar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  progress,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-0 shadow-sm",
        onClick &&
          "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        active && "ring-2 ring-primary/50",
      )}
      onClick={onClick}
    >
      <CardContent className="px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
        <p className="mt-2 text-lg font-bold tracking-tight tabular-nums sm:text-xl">
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        {progress !== undefined && (
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [month, setMonth] = useState(currentMonthKey);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [pwdTarget, setPwdTarget] = useState<ManagedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deletePayTarget, setDeletePayTarget] = useState<{
    warga: Warga;
    payment: PaymentInfo;
  } | null>(null);
  const [payTarget, setPayTarget] = useState<{
    warga: Warga;
    payment: PaymentInfo | null;
    saldoBefore: number;
  } | null>(null);
  const [filter, setFilter] = useState<"semua" | "lunas" | "belum">("semua");

  const role = user?.role ?? null;
  const isAdmin = role === ROLES.ADMIN;
  const canRecord = isAdmin || role === ROLES.PENGGURUS;

  // Prompt once for the display name (used in payment records).
  useEffect(() => {
    if (!isLoading && user && user.role && !user.name) {
      setNameDialogOpen(true);
    }
  }, [isLoading, user]);

  const overview = useQuery(api.jimpitan.getOverview, role ? { month } : "skip");
  const series = useQuery(
    api.jimpitan.getMonthlySeries,
    role ? undefined : "skip",
  );
  const monthsWithData = useQuery(
    api.jimpitan.getMonthsWithData,
    role ? undefined : "skip",
  );
  const allUsers = useQuery(api.users.listUsers, isAdmin ? undefined : "skip");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading || !user) return <FullScreenSpinner />;
  if (!user.role) return <UnregisteredCard onSignOut={handleSignOut} />;

  const paidPct =
    overview && overview.totalWarga > 0
      ? Math.round((overview.paidCount / overview.totalWarga) * 100)
      : 0;

  const chartData = (series?.series ?? []).map((s) => ({
    ...s,
    label: monthShortLabel(s.month),
    target: series?.targetPerMonth ?? 0,
  }));
  const visibleRows = (overview?.rows ?? []).filter(
    (r) => filter === "semua" || r.status === filter,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HandCoins className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Jimpitan RT</p>
              <p className="text-[11px] text-muted-foreground">
                Kas iuran warga
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block">
              <RoleBadge role={role!} />
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-accent"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/12 text-xs font-bold text-primary">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {user.username ? `@${user.username}` : "Akun tamu"}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6">
        {/* Greeting */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Halo, {user.name ?? "Saudara"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Kelola warga, pengurus, dan catatan iuran RT Anda."
                : role === ROLES.PENGGURUS
                  ? "Catat iuran jimpitan warga setiap bulannya."
                  : "Pantau total iuran dan status pembayaran warga."}
            </p>
          </div>
          <RoleBadge role={role!} />
        </div>

        {/* Month navigator */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-sm">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-bold tracking-tight">
              {monthLabel(month)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {monthsWithData && monthsWithData.length > 0 && (
              <Select
                value={monthsWithData.includes(month) ? month : undefined}
                onValueChange={setMonth}
              >
                <SelectTrigger size="sm" className="w-44">
                  <CalendarDays className="size-4" />
                  <SelectValue placeholder="Bulan dengan data" />
                </SelectTrigger>
                <SelectContent>
                  {monthsWithData.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(currentMonthKey())}
            >
              Bulan ini
            </Button>
          </div>
        </div>

        {/* Total kas */}
        {series && (
          <Card className="mt-6 gap-0 overflow-hidden py-0 shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Landmark className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total kas terkumpul
                  </p>
                  <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
                    {formatRupiah(series.grandTotal)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {series.series.length} bulan dengan data · rata-rata{" "}
                    {formatRupiah(
                      series.series.length
                        ? Math.round(series.grandTotal / series.series.length)
                        : 0,
                    )}
                    /bulan
                  </p>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/40 px-4 py-2.5 text-xs">
                <p className="text-muted-foreground">Target per bulan</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">
                  {formatRupiah(series.targetPerMonth)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {overview && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Wallet className="size-4" />}
              label="Terkumpul bulan ini"
              value={formatRupiah(overview.total)}
              sub={
                overview.target > 0
                  ? `dari target ${formatRupiah(overview.target)}`
                  : undefined
              }
              progress={
                overview.target > 0
                  ? (overview.total / overview.target) * 100
                  : 0
              }
            />
            <StatCard
              icon={<Users className="size-4" />}
              label="Total warga"
              value={String(overview.totalWarga)}
            />
            <StatCard
              icon={<CheckCircle2 className="size-4" />}
              label="Sudah bayar"
              value={`${overview.paidCount} warga`}
              progress={paidPct}
              active={filter === "lunas"}
              onClick={() =>
                setFilter((f) => (f === "lunas" ? "semua" : "lunas"))
              }
            />
            <StatCard
              icon={<CircleDashed className="size-4" />}
              label="Belum bayar"
              value={`${overview.unpaidCount} warga`}
              active={filter === "belum"}
              onClick={() =>
                setFilter((f) => (f === "belum" ? "semua" : "belum"))
              }
              sub={
                overview.totalWarga > 0
                  ? `${paidPct}% warga sudah membayar`
                  : undefined
              }
            />
          </div>
        )}

        {/* Grafik per bulan */}
        {series && (
          <Card className="mt-6 gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4 text-primary" />
                  Grafik iuran per bulan
                </CardTitle>
                <CardDescription className="mt-1">
                  Nominal terkumpul tiap bulan dibanding target{" "}
                  {formatRupiah(series.targetPerMonth)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {chartData.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <BarChart3 className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Belum ada data pembayaran
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Catat pembayaran bulanan untuk melihat grafik.
                  </p>
                </div>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="h-64 w-full"
                >
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      allowDecimals={false}
                      tickFormatter={(v: number) => formatCompact(v)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={chartTooltipFormatter} />
                      }
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="total"
                      name="Terkumpul"
                      fill="var(--color-total)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={42}
                    />
                    <Line
                      dataKey="target"
                      name="Target"
                      stroke="var(--color-target)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      type="monotone"
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Monthly detail table */}
        <Card className="mt-6 gap-0 overflow-hidden py-0 shadow-sm">
          <CardHeader className="flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <CardTitle className="text-base">Rincian jimpitan</CardTitle>
              <CardDescription className="mt-1">
                {monthLabel(month)} · iuran {formatRupiah(JIMPITAN_PER_BULAN)}
                /bulan ·{" "}
                {overview
                  ? `${overview.paidCount} dari ${overview.totalWarga} warga lunas`
                  : "Memuat data…"}
              </CardDescription>
            </div>
            <div
              className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1"
              role="tablist"
              aria-label="Saring status pembayaran"
            >
              {FILTERS.map((f) => {
                const count =
                  f.key === "semua"
                    ? overview?.totalWarga
                    : f.key === "lunas"
                      ? overview?.paidCount
                      : overview?.unpaidCount;
                return (
                  <Button
                    key={f.key}
                    type="button"
                    variant="ghost"
                    size="sm"
                    role="tab"
                    aria-selected={filter === f.key}
                    className={cn(
                      "h-7 gap-1.5 px-2.5 text-xs",
                      filter === f.key && "bg-background font-semibold shadow-sm",
                    )}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                    {count !== undefined && (
                      <span className="tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!overview ? (
              <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Memuat rincian…
              </div>
            ) : overview.rows.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Users className="size-5" />
                </div>
                <p className="mt-3 text-sm font-medium">
                  Belum ada warga terdaftar
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAdmin
                    ? "Tambahkan warga dari menu Kelola warga & pengurus."
                    : "Silakan hubungi admin RT untuk mendaftarkan warga."}
                </p>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  {filter === "lunas" ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <CircleDashed className="size-5" />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium">
                  {filter === "lunas"
                    ? "Belum ada warga yang lunas bulan ini"
                    : "Semua warga sudah lunas bulan ini"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pilih "Semua" untuk melihat seluruh warga.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4 pr-1 sm:pl-6">No</TableHead>
                    <TableHead>Warga</TableHead>
                    <TableHead className="hidden sm:table-cell">Rumah</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Saldo
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Dicatat oleh
                    </TableHead>
                    {canRecord && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row: OverviewRow, i: number) => (
                    <TableRow key={row.warga._id}>
                      <TableCell className="pl-4 pr-1 text-muted-foreground sm:pl-6">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.warga.name}</span>
                          {row.warga._id === user._id && (
                            <Badge
                              variant="outline"
                              className="border-transparent bg-primary/12 text-primary"
                            >
                              Anda
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {row.warga.noRumah || row.warga.alamat || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {row.warga.noRumah || row.warga.alamat || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.payment ? (
                          <div>
                            <p>{formatRupiah(row.payment.nominal)}</p>
                            {carryToNext(row) > 0 && (
                              <p
                                className="text-xs font-normal text-emerald-600 dark:text-emerald-400"
                                title="Kelebihan yang dibawa ke bulan berikutnya"
                              >
                                +{formatRupiah(carryToNext(row))} ke depan
                              </p>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden text-right tabular-nums sm:table-cell"
                        title="Kredit dari bulan sebelumnya"
                      >
                        {row.saldoBefore > 0 ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            +{formatRupiah(row.saldoBefore)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status === "lunas" ? (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          >
                            <CheckCircle2 className="size-3" />
                            {row.payment ? "Lunas" : "Lunas · saldo"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-muted text-muted-foreground"
                          >
                            <CircleDashed className="size-3" />
                            Belum
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {row.payment ? (
                          <div>
                            <p className="text-sm">{row.payment.recordedByName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(row.payment.recordedAt)}
                              {row.payment.note ? ` · ${row.payment.note}` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canRecord && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant={row.payment ? "outline" : "default"}
                              size="sm"
                              onClick={() =>
                                setPayTarget({
                                  warga: row.warga,
                                  payment: row.payment,
                                  saldoBefore: row.saldoBefore,
                                })
                              }
                            >
                              {row.payment ? (
                                <>
                                  <Pencil className="size-3.5" />
                                  Edit
                                </>
                              ) : (
                                <>
                                  <Plus className="size-3.5" />
                                  Catat
                                </>
                              )}
                            </Button>
                            {isAdmin && row.payment && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                title="Hapus pembayaran"
                                onClick={() =>
                                  setDeletePayTarget({
                                    warga: row.warga,
                                    payment: row.payment!,
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Admin: manage warga & pengurus */}
        {isAdmin && allUsers && (
          <Card className="mt-6 gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
              <div>
                <CardTitle className="text-base">
                  Kelola warga & pengurus
                </CardTitle>
                <CardDescription className="mt-1">
                  {allUsers.length} orang terdaftar
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserRoundPlus className="size-4" />
                Tambah
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-6">Nama</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead className="hidden sm:table-cell">Rumah</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell className="pl-4 font-medium sm:pl-6">
                        {u.name}
                        {u._id === user._id && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (Anda)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        @{u.username}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {u.role === ROLES.WARGA
                          ? u.noRumah || u.alamat || "—"
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell className="text-right">
                        {u.role === ROLES.ADMIN ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Ubah password"
                            onClick={() => setPwdTarget(u)}
                          >
                            <KeyRound className="size-4" />
                          </Button>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Ubah data"
                              onClick={() => setEditTarget(u)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Ubah password"
                              onClick={() => setPwdTarget(u)}
                            >
                              <KeyRound className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              title="Hapus akun"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialogs */}
      <NameDialog open={nameDialogOpen} onOpenChange={setNameDialogOpen} />
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
      {editTarget && (
        <EditUserDialog
          user={editTarget}
          open
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
        />
      )}
      {pwdTarget && (
        <PasswordDialog
          user={pwdTarget}
          open
          onOpenChange={(open) => {
            if (!open) setPwdTarget(null);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
      {deletePayTarget && (
        <DeletePaymentDialog
          warga={deletePayTarget.warga}
          payment={deletePayTarget.payment}
          open
          onOpenChange={(open) => {
            if (!open) setDeletePayTarget(null);
          }}
        />
      )}
      {payTarget && (
        <PayDialog
          warga={payTarget.warga}
          month={month}
          payment={payTarget.payment}
          saldoBefore={payTarget.saldoBefore}
          onOpenChange={(open) => {
            if (!open) setPayTarget(null);
          }}
        />
      )}
    </div>
  );
}
