import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ROLES, type Role } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bootstrap: the very first account that signs in becomes admin, so the RT
 * can start adding warga & pengurus. Returns the assigned role, or null when
 * the account has no role yet (admin already exists -> unregistered).
 */
export const ensureRole = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    if (user.role) return user.role;

    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .collect();
    if (admins.length === 0) {
      await ctx.db.patch(user._id, { role: ROLES.ADMIN });
      return ROLES.ADMIN;
    }
    return null;
  },
});

/** Let any signed-in user set their own display name. */
export const updateOwnName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Harus login.");
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new Error("Nama harus terdiri dari 2–60 karakter.");
    }
    await ctx.db.patch(user._id, { name: trimmed });
    return trimmed;
  },
});

/** List registered warga & pengurus (admin only). */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat melihat daftar pengguna.");
    }
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => Boolean(u.role && u.email))
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "",
        email: u.email ?? "",
        role: u.role as Role,
        alamat: u.alamat ?? "",
        noRumah: u.noRumah ?? "",
        _creationTime: u._creationTime,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  },
});

/**
 * Admin adds a warga or pengurus. They sign in later with the same email via
 * email OTP; Convex Auth matches the pre-created account by email.
 */
export const addUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal(ROLES.WARGA), v.literal(ROLES.PENGGURUS)),
    alamat: v.optional(v.string()),
    noRumah: v.optional(v.string()),
  },
  handler: async (ctx, { name, email, role, alamat, noRumah }) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat menambahkan warga/pengurus.");
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!EMAIL_RE.test(cleanEmail)) throw new Error("Format email tidak valid.");
    if (cleanName.length < 2) throw new Error("Nama terlalu pendek.");

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", cleanEmail))
      .first();
    if (existing) throw new Error("Email sudah terdaftar.");

    return await ctx.db.insert("users", {
      email: cleanEmail,
      name: cleanName,
      role,
      alamat: role === ROLES.WARGA ? alamat?.trim() || undefined : undefined,
      noRumah: role === ROLES.WARGA ? noRumah?.trim() || undefined : undefined,
    });
  },
});
