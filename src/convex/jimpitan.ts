import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";
import { getCurrentUser } from "./users";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Overview for one month: warga list joined with their payment record, plus
 * totals. Visible to every signed-in user with a role (admin, pengurus, warga).
 */
export const getOverview = query({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return null;
    if (!MONTH_RE.test(month)) throw new Error("Bulan tidak valid.");

    const [wargaList, payments] = await Promise.all([
      ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), ROLES.WARGA))
        .collect(),
      ctx.db
        .query("jimpitan")
        .withIndex("by_month", (q) => q.eq("month", month))
        .collect(),
    ]);

    const warga = wargaList
      .map((w) => ({
        _id: w._id,
        name: w.name ?? "Tanpa nama",
        alamat: w.alamat ?? "",
        noRumah: w.noRumah ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));

    const paymentByWarga = new Map(payments.map((p) => [p.wargaId, p]));

    // Resolve who recorded each payment (for the "Dicatat oleh" column).
    const recorderIds = [...new Set(payments.map((p) => p.recordedById))];
    const recorders = await Promise.all(recorderIds.map((id) => ctx.db.get(id)));
    const recorderName = new Map(
      recorders
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .map((r) => [r._id, r.name ?? "Pengurus"]),
    );

    const rows = warga.map((w) => {
      const payment = paymentByWarga.get(w._id) ?? null;
      return {
        warga: w,
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
    return {
      month,
      totalWarga: warga.length,
      paidCount: payments.length,
      unpaidCount: warga.length - payments.length,
      total,
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
