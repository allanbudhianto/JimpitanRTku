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

      alamat: v.optional(v.string()), // address of the warga
      noRumah: v.optional(v.string()), // house number of the warga
    }).index("email", ["email"]), // index for the email. do not remove or modify

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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
