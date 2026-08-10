import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { JIMPITAN_PER_BULAN, ROLES } from "./schema";
import { getCurrentUser } from "./users";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" → total months since year 0 (chronological ordering/comparison). */
function monthIndex(month: string) {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

/**
 * Overview for one month: warga list joined with their payment record, plus
 * totals. Visible to every signed-in user with a role (admin, pengurus, warga).
 *
 * Iuran wajib tiap warga adalah JIMPITAN_PER_BULAN per bulan, terhitung mulai
 * dari bulan pertama warga tersebut tercatat membayar. Kelebihan pembayaran
 * (saldo) otomatis diakumulasikan untuk menutupi iuran bulan-bulan berikutnya:
 * seorang warga berstatus "lunas" jika saldo + pembayaran bulan ini sudah
 * menutupi iuran bulan ini.
 */
export const getOverview = query({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return null;
    if (!MONTH_RE.test(month)) throw new Error("Bulan tidak valid.");

    const [wargaList, allPayments] = await Promise.all([
      ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), ROLES.WARGA))
        .collect(),
      ctx.db.query("jimpitan").collect(),
    ]);

    const payments = allPayments.filter((p) => p.month === month);

    const warga = wargaList
      .map((w) => ({
        _id: w._id,
        name: w.name ?? "Tanpa nama",
        alamat: w.alamat ?? "",
        noRumah: w.noRumah ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));

    // Group every payment (all months) per warga to compute carried credit.
    type JimpitanDoc = (typeof allPayments)[number];
    const historyByWarga = new Map<string, JimpitanDoc[]>(
      wargaList.map((w) => [w._id, []]),
    );
    for (const p of allPayments) {
      historyByWarga.get(p.wargaId)?.push(p);
    }

    const paymentByWarga = new Map(payments.map((p) => [p.wargaId, p]));

    // Resolve who recorded each payment (for the "Dicatat oleh" column).
    const recorderIds = [...new Set(payments.map((p) => p.recordedById))];
    const recorders = await Promise.all(recorderIds.map((id) => ctx.db.get(id)));
    const recorderName = new Map(
      recorders
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .map((r) => [r._id, r.name ?? "Pengurus"]),
    );

    const targetIdx = monthIndex(month);
    const rows = warga.map((w) => {
      const history = historyByWarga.get(w._id) ?? [];
      const payment = paymentByWarga.get(w._id) ?? null;

      // Obligation starts from the warga's first recorded payment month.
      let startIdx: number | null = null;
      let paidBefore = 0;
      for (const p of history) {
        const idx = monthIndex(p.month);
        if (startIdx === null || idx < startIdx) startIdx = idx;
        if (p.month < month) paidBefore += p.nominal;
      }

      // Credit carried into this month: what they paid before minus the
      // obligations already consumed in the months up to (not including) now.
      const saldoBefore =
        startIdx === null
          ? 0
          : paidBefore - Math.max(0, targetIdx - startIdx) * JIMPITAN_PER_BULAN;

      const paidAt = payment?.nominal ?? 0;
      const lunas =
        startIdx === null || targetIdx < startIdx
          ? paidAt > 0
          : saldoBefore + paidAt >= JIMPITAN_PER_BULAN;

      return {
        warga: w,
        saldoBefore,
        status: lunas ? ("lunas" as const) : ("belum" as const),
        payment: payment
          ? {
              _id: payment._id,
              nominal: payment.nominal,
              note: payment.note ?? "",
              recordedByName: recorderName.get(payment.recordedById) ?? "Pengurus",
              recordedAt: payment._creationTime,
            }
          : null,
      };
    });

    const total = payments.reduce((sum, p) => sum + p.nominal, 0);
    const paidCount = rows.filter((r) => r.status === "lunas").length;
    return {
      month,
      totalWarga: warga.length,
      paidCount,
      unpaidCount: warga.length - paidCount,
      total,
      target: warga.length * JIMPITAN_PER_BULAN,
      rows,
    };
  },
});

/** All months (descending) that already have payment records. */
export const getMonthsWithData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return [];
    const payments = await ctx.db.query("jimpitan").collect();
    return [...new Set(payments.map((p) => p.month))].sort().reverse();
  },
});

/**
 * Record (or update) a warga's payment for a month. One record per warga per
 * month; recording again overwrites the previous nominal. Admin & pengurus only.
 */
export const recordPayment = mutation({
  args: {
    wargaId: v.id("users"),
    month: v.string(),
    nominal: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { wargaId, month, nominal, note }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Harus login.");
    if (user.role !== ROLES.ADMIN && user.role !== ROLES.PENGGURUS) {
      throw new Error("Hanya pengurus atau admin yang dapat mencatat pembayaran.");
    }
    if (!MONTH_RE.test(month)) throw new Error("Bulan tidak valid.");
    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new Error("Nominal harus lebih dari 0.");
    }
    const warga = await ctx.db.get(wargaId);
    if (!warga || warga.role !== ROLES.WARGA) {
      throw new Error("Warga tidak ditemukan.");
    }

    const existing = await ctx.db
      .query("jimpitan")
      .withIndex("by_warga", (q) => q.eq("wargaId", wargaId).eq("month", month))
      .first();

    const cleanNote = note?.trim() || undefined;
    if (existing) {
      await ctx.db.patch(existing._id, {
        nominal,
        recordedById: user._id,
        note: cleanNote,
      });
      return existing._id;
    }
    return await ctx.db.insert("jimpitan", {
      wargaId,
      month,
      nominal,
      recordedById: user._id,
      note: cleanNote,
    });
  },
});

/** Remove a payment record (marks the warga as unpaid again). Admin & pengurus only. */
export const deletePayment = mutation({
  args: { paymentId: v.id("jimpitan") },
  handler: async (ctx, { paymentId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Harus login.");
    if (user.role !== ROLES.ADMIN && user.role !== ROLES.PENGGURUS) {
      throw new Error("Hanya pengurus atau admin yang dapat menghapus pembayaran.");
    }
    await ctx.db.delete(paymentId);
  },
});

/**
 * Monthly collection series for the chart: nominal collected per month
 * (ascending), plus the grand total and the per-month target.
 */
export const getMonthlySeries = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return null;

    const [allPayments, wargaList, expenses] = await Promise.all([
      ctx.db.query("jimpitan").collect(),
      ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), ROLES.WARGA))
        .collect(),
      ctx.db.query("pengeluaran").collect(),
    ]);

    const byMonth = new Map<string, number>();
    let grandTotal = 0;
    for (const p of allPayments) {
      byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.nominal);
      grandTotal += p.nominal;
    }
    const totalPengeluaran = expenses.reduce((sum, e) => sum + e.nominal, 0);

    const series = [...byMonth.entries()]
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      grandTotal,
      totalPengeluaran,
      saldo: grandTotal - totalPengeluaran,
      targetPerMonth: wargaList.length * JIMPITAN_PER_BULAN,
      totalWarga: wargaList.length,
      series,
    };
  },
});

/**
 * Public aggregates for the landing page (beranda): totals, latest month
 * credit-aware status, and the last 6 months of collections. Returns numbers
 * only — no warga names or per-warga details — so it is safe for visitors.
 */
export const getPublicStats = query({
  args: {},
  handler: async (ctx) => {
    const [allPayments, wargaList, expenses] = await Promise.all([
      ctx.db.query("jimpitan").collect(),
      ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), ROLES.WARGA))
        .collect(),
      ctx.db.query("pengeluaran").collect(),
    ]);

    const byMonth = new Map<string, number>();
    let grandTotal = 0;
    for (const p of allPayments) {
      byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.nominal);
      grandTotal += p.nominal;
    }
    const totalPengeluaran = expenses.reduce((sum, e) => sum + e.nominal, 0);
    const months = [...byMonth.keys()].sort();
    const latestMonth = months.length > 0 ? months[months.length - 1] : null;

    // Credit-aware count of warga who covered the latest month (same rule as
    // getOverview: kelebihan from earlier payments can carry over).
    let latestPaid = 0;
    if (latestMonth) {
      const targetIdx = monthIndex(latestMonth);
      type JimpitanDoc = (typeof allPayments)[number];
      const historyByWarga = new Map<string, JimpitanDoc[]>(
        wargaList.map((w) => [w._id, []]),
      );
      for (const p of allPayments) {
        historyByWarga.get(p.wargaId)?.push(p);
      }
      for (const w of wargaList) {
        const history = historyByWarga.get(w._id) ?? [];
        if (history.length === 0) continue;
        let startIdx: number | null = null;
        let paidBefore = 0;
        for (const p of history) {
          const idx = monthIndex(p.month);
          if (startIdx === null || idx < startIdx) startIdx = idx;
          if (p.month < latestMonth) paidBefore += p.nominal;
        }
        const paidAt =
          history.find((p) => p.month === latestMonth)?.nominal ?? 0;
        const saldoBefore =
          startIdx === null
            ? 0
            : paidBefore -
              Math.max(0, targetIdx - startIdx) * JIMPITAN_PER_BULAN;
        if (saldoBefore + paidAt >= JIMPITAN_PER_BULAN) latestPaid++;
      }
    }

    const series = months.slice(-6).map((month) => ({
      month,
      total: byMonth.get(month) ?? 0,
    }));

    return {
      grandTotal,
      totalPengeluaran,
      saldo: grandTotal - totalPengeluaran,
      totalWarga: wargaList.length,
      monthsCount: months.length,
      latestMonth,
      latestTotal: latestMonth ? byMonth.get(latestMonth) ?? 0 : 0,
      latestPaid,
      latestUnpaid: Math.max(0, wargaList.length - latestPaid),
      targetPerMonth: wargaList.length * JIMPITAN_PER_BULAN,
      series,
    };
  },
});
