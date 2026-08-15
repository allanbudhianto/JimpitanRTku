import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";
import { getCurrentUser } from "./users";

const QRIS_KEY = "qris";

/**
 * QRIS payment settings, visible to every signed-in user with a role so that
 * admin, pengurus, and warga can all see the payment QR code.
 */
export const getQris = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return null;

    const doc = await ctx.db
      .query("settings")
      .withIndex("key", (q) => q.eq("key", QRIS_KEY))
      .first();
    if (!doc) {
      return { qrisPayload: null, qrisMerchantName: null, qrisActive: false };
    }
    return {
      qrisPayload: doc.qrisPayload ?? null,
      qrisMerchantName: doc.qrisMerchantName ?? null,
      qrisActive: doc.qrisActive ?? false,
    };
  },
});

/** Admin configures the QRIS payment method (merchant QR payload + name). */
export const updateQris = mutation({
  args: {
    qrisPayload: v.optional(v.string()),
    qrisMerchantName: v.optional(v.string()),
    qrisActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { qrisPayload, qrisMerchantName, qrisActive }) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat mengatur QRIS.");
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("key", (q) => q.eq("key", QRIS_KEY))
      .first();

    const patch: {
      qrisPayload?: string;
      qrisMerchantName?: string;
      qrisActive?: boolean;
    } = {};
    if (qrisPayload !== undefined) {
      patch.qrisPayload = qrisPayload.trim() || undefined;
    }
    if (qrisMerchantName !== undefined) {
      patch.qrisMerchantName = qrisMerchantName.trim() || undefined;
    }
    if (qrisActive !== undefined) {
      patch.qrisActive = qrisActive;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("settings", { key: QRIS_KEY, ...patch });
    }
    return true;
  },
});

const KONTAK_KEY = "kontak";

/**
 * Contact info (Sari, Ina, rekening BRI), visible to every signed-in role so
 * warga tahu cara menghubungi pengurus atau transfer iuran ke rekening kas.
 */
export const getKontak = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.role) return null;

    const doc = await ctx.db
      .query("settings")
      .withIndex("key", (q) => q.eq("key", KONTAK_KEY))
      .first();
    if (!doc) {
      return { sari: null, ina: null, bri: null };
    }
    return {
      sari: doc.kontakSari ?? null,
      ina: doc.kontakIna ?? null,
      bri: doc.kontakBri ?? null,
    };
  },
});

/** Admin edits the contact info shown to all roles (Sari, Ina, rekening BRI). */
export const updateKontak = mutation({
  args: {
    sari: v.optional(v.string()),
    ina: v.optional(v.string()),
    bri: v.optional(v.string()),
  },
  handler: async (ctx, { sari, ina, bri }) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat mengubah kontak.");
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("key", (q) => q.eq("key", KONTAK_KEY))
      .first();

    const patch: {
      kontakSari?: string;
      kontakIna?: string;
      kontakBri?: string;
    } = {};
    if (sari !== undefined) patch.kontakSari = sari.trim() || undefined;
    if (ina !== undefined) patch.kontakIna = ina.trim() || undefined;
    if (bri !== undefined) patch.kontakBri = bri.trim() || undefined;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("settings", { key: KONTAK_KEY, ...patch });
    }
    return true;
  },
});
