import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// Roles for the Jimpitan RT app:
// - admin: manages warga & pengurus
// - pengurus: records monthly jimpitan payments
// - warga: monitors totals and payment status
// The very first account to sign in is bootstrapped as admin (see users.ts).
export const ROLES = {
  ADMIN: "admin",
  PENGGURUS: "pengurus",
  WARGA: "warga",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.PENGGURUS),
  v.literal(ROLES.WARGA),
);
export type Role = Infer<typeof roleValidator>;

/**
 * Iuran wajib setiap warga per bulan (Rp).
 * Kelebihan pembayaran otomatis diakumulasikan untuk menutupi iuran
 * bulan-bulan berikutnya (lihat jimpitan.getOverview).
 */
export const JIMPITAN_PER_BULAN = 15000;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      username: v.optional(v.string()), // login username (username + password auth)
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("username", ["username"]), // index for username login

    // Monthly jimpitan payments: one record per warga per month ("YYYY-MM").
    jimpitan: defineTable({
      wargaId: v.id("users"),
      month: v.string(), // "YYYY-MM"
      nominal: v.number(),
      recordedById: v.id("users"),
      note: v.optional(v.string()),
    })
      .index("by_month", ["month"])
      .index("by_warga", ["wargaId", "month"]),

    // App settings (singleton documents keyed by `key`), e.g. QRIS payment.
    settings: defineTable({
      key: v.string(), // "qris" atau "kontak"
      qrisPayload: v.optional(v.string()), // QRIS merchant string (mulai "000201")
      qrisMerchantName: v.optional(v.string()), // merchant / atas nama
      qrisActive: v.optional(v.boolean()),
      kontakSari: v.optional(v.string()), // nomor telepon Sari (bisa diubah admin)
      kontakIna: v.optional(v.string()), // nomor telepon Ina
      kontakBri: v.optional(v.string()), // rekening BRI kas
    }).index("key", ["key"]),

    // Cash outflows (pengeluaran kas RT), recorded by admin & pengurus.
    // Reduces the total kas saldo: saldo = total terkumpul - total pengeluaran.
    pengeluaran: defineTable({
      nominal: v.number(),
      alasan: v.string(),
      recordedById: v.id("users"),
    }),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
