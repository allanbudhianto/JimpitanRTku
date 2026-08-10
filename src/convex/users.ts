import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";
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

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

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
      .filter((u) => Boolean(u.role && u.username))
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "",
        username: u.username ?? "",
        role: u.role as Role,
        alamat: u.alamat ?? "",
        noRumah: u.noRumah ?? "",
        _creationTime: u._creationTime,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  },
});

/**
 * Admin adds a warga or pengurus with a username + initial password.
 * Creates both the user document and the auth account (scrypt-hashed secret),
 * so they can log in with the same username and password.
 */
export const addUser = mutation({
  args: {
    name: v.string(),
    username: v.string(),
    password: v.string(),
    role: v.union(v.literal(ROLES.WARGA), v.literal(ROLES.PENGGURUS)),
    alamat: v.optional(v.string()),
    noRumah: v.optional(v.string()),
  },
  handler: async (ctx, { name, username, password, role, alamat, noRumah }) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat menambahkan warga/pengurus.");
    }
    const cleanUsername = normalizeUsername(username);
    const cleanName = name.trim();
    if (!USERNAME_RE.test(cleanUsername)) {
      throw new Error(
        "Username harus 3–30 karakter (huruf kecil, angka, titik, strip, underscore).",
      );
    }
    if (password.length < 4) throw new Error("Password minimal 4 karakter.");
    if (cleanName.length < 2) throw new Error("Nama terlalu pendek.");

    const existing = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", cleanUsername))
      .first();
    if (existing) throw new Error("Username sudah terdaftar.");

    const userId = await ctx.db.insert("users", {
      username: cleanUsername,
      name: cleanName,
      role,
      alamat: role === ROLES.WARGA ? alamat?.trim() || undefined : undefined,
      noRumah: role === ROLES.WARGA ? noRumah?.trim() || undefined : undefined,
    });

    const secret = await new Scrypt().hash(password);
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: cleanUsername,
      secret,
    });
    return userId;
  },
});
