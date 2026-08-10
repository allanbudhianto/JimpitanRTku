import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";
import { getCurrentUser } from "./users";

const canManage = (role?: string) =>
  role === ROLES.ADMIN || role === ROLES.PENGGURUS;

/**
 * Expense list (newest first) plus the running total.
 * Visible to every signed-in user with a role — warga can view, admin &
 * pengurus can also add/edit/delete via the other mutations.
 */
export const listPengeluaran = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return null;

    const items = await ctx.db.query("pengeluaran").collect();
    const sorted = items.sort((a, b) => b._creationTime - a._creationTime);

    const recorderIds = [...new Set(sorted.map((e) => e.recordedById))];
    const recorders = await Promise.all(recorderIds.map((id) => ctx.db.get(id)));
    const recorderName = new Map(
      recorders
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .map((r) => [r._id, r.name ?? "Pengurus"]),
    );

    return {
      items: sorted.map((e) => ({
        _id: e._id,
        nominal: e.nominal,
        alasan: e.alasan,
        recordedByName: recorderName.get(e.recordedById) ?? "Pengurus",
        recordedAt: e._creationTime,
      })),
      total: sorted.reduce((sum, e) => sum + e.nominal, 0),
    };
  },
});

/** Admin & pengurus record a kas expense (saldo kas berkurang otomatis). */
export const addPengeluaran = mutation({
  args: { nominal: v.number(), alasan: v.string() },
  handler: async (ctx, { nominal, alasan }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !canManage(user.role)) {
      throw new Error(
        "Hanya admin atau pengurus yang dapat mencatat pengeluaran.",
      );
    }
    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new Error("Nominal harus lebih dari 0.");
    }
    const clean = alasan.trim();
    if (clean.length < 3) {
      throw new Error("Alasan pengeluaran minimal 3 karakter.");
    }
    return await ctx.db.insert("pengeluaran", {
      nominal,
      alasan: clean,
      recordedById: user._id,
    });
  },
});

/** Admin & pengurus remove an expense record (saldo kembali naik). */
export const deletePengeluaran = mutation({
  args: { expenseId: v.id("pengeluaran") },
  handler: async (ctx, { expenseId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !canManage(user.role)) {
      throw new Error(
        "Hanya admin atau pengurus yang dapat menghapus pengeluaran.",
      );
    }
    await ctx.db.delete(expenseId);
  },
});

/** Admin & pengurus edit an expense's nominal and/or reason. */
export const updatePengeluaran = mutation({
  args: {
    expenseId: v.id("pengeluaran"),
    nominal: v.number(),
    alasan: v.string(),
  },
  handler: async (ctx, { expenseId, nominal, alasan }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !canManage(user.role)) {
      throw new Error(
        "Hanya admin atau pengurus yang dapat mengubah pengeluaran.",
      );
    }
    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new Error("Nominal harus lebih dari 0.");
    }
    const clean = alasan.trim();
    if (clean.length < 3) {
      throw new Error("Alasan pengeluaran minimal 3 karakter.");
    }
    await ctx.db.patch(expenseId, { nominal, alasan: clean });
    return true;
  },
});

/**
 * Public expenses for the landing page (beranda): view-only, no auth needed.
 * Returns only the most recent entries plus totals.
 */
export const getPublicExpenses = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("pengeluaran").collect();
    const sorted = items.sort((a, b) => b._creationTime - a._creationTime);

    const recorderIds = [...new Set(sorted.map((e) => e.recordedById))];
    const recorders = await Promise.all(recorderIds.map((id) => ctx.db.get(id)));
    const recorderName = new Map(
      recorders
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .map((r) => [r._id, r.name ?? "Pengurus"]),
    );

    const total = sorted.reduce((sum, e) => sum + e.nominal, 0);
    return {
      items: sorted.slice(0, 8).map((e) => ({
        _id: e._id,
        nominal: e.nominal,
        alasan: e.alasan,
        recordedByName: recorderName.get(e.recordedById) ?? "Pengurus",
        recordedAt: e._creationTime,
      })),
      total,
      count: sorted.length,
    };
  },
});
