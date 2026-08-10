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
 * Admin changes the password of any account (admin, pengurus, or warga).
 */
export const changeUserPassword = mutation({
  args: { userId: v.id("users"), password: v.string() },
  handler: async (ctx, { userId, password }) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat mengubah password.");
    }
    if (password.length < 4) throw new Error("Password minimal 4 karakter.");

    const target = await ctx.db.get(userId);
    if (!target || !target.role || !target.username) {
      throw new Error("Akun tidak ditemukan.");
    }
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q
          .eq("provider", "password")
          .eq("providerAccountId", target.username ?? ""),
      )
      .first();
    if (!account) throw new Error("Akun login tidak ditemukan.");

    const secret = await new Scrypt().hash(password);
    await ctx.db.patch(account._id, { secret });
    return true;
  },
});

/**
 * Admin edits a pengurus or warga: name, username, role, and address.
 * When the username changes, the login account id is updated too.
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    role: v.optional(
      v.union(v.literal(ROLES.WARGA), v.literal(ROLES.PENGGURUS)),
    ),
    alamat: v.optional(v.string()),
    noRumah: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, username, role, alamat, noRumah }) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat mengubah warga/pengurus.");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("Akun tidak ditemukan.");
    if (target.role !== ROLES.WARGA && target.role !== ROLES.PENGGURUS) {
      throw new Error("Hanya warga atau pengurus yang dapat diubah.");
    }

    const patch: {
      name?: string;
      username?: string;
      role?: Role;
      alamat?: string;
      noRumah?: string;
    } = {};

    if (name !== undefined) {
      const clean = name.trim();
      if (clean.length < 2) throw new Error("Nama terlalu pendek.");
      patch.name = clean;
    }
    if (username !== undefined) {
      const clean = normalizeUsername(username);
      if (!USERNAME_RE.test(clean)) {
        throw new Error(
          "Username harus 3–30 karakter (huruf kecil, angka, titik, strip, underscore).",
        );
      }
      if (clean !== target.username) {
        const existing = await ctx.db
          .query("users")
          .withIndex("username", (q) => q.eq("username", clean))
          .first();
        if (existing) throw new Error("Username sudah terdaftar.");
        const account = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q
              .eq("provider", "password")
              .eq("providerAccountId", target.username ?? ""),
          )
          .first();
        if (account) {
          await ctx.db.patch(account._id, { providerAccountId: clean });
        }
        patch.username = clean;
      }
    }
    if (role !== undefined) {
      patch.role = role;
    }
    if (alamat !== undefined) patch.alamat = alamat.trim() || undefined;
    if (noRumah !== undefined) patch.noRumah = noRumah.trim() || undefined;

    await ctx.db.patch(userId, patch);
    return true;
  },
});

/**
 * Admin deletes a pengurus or warga: their payments, auth accounts, and
 * active sessions are removed along with the user document.
 */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new Error("Hanya admin yang dapat menghapus warga/pengurus.");
    }
    if (userId === admin._id) {
      throw new Error("Tidak dapat menghapus akun sendiri.");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("Akun tidak ditemukan.");
    if (target.role !== ROLES.WARGA && target.role !== ROLES.PENGGURUS) {
      throw new Error("Hanya warga atau pengurus yang dapat dihapus.");
    }

    // Remove their monthly payments so overview counts stay consistent.
    const payments = await ctx.db
      .query("jimpitan")
      .withIndex("by_warga", (q) => q.eq("wargaId", userId))
      .collect();
    for (const p of payments) await ctx.db.delete(p._id);

    // Remove auth accounts & sessions so they are signed out.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const a of accounts) await ctx.db.delete(a._id);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    await ctx.db.delete(userId);
    return true;
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
