// Login is username + password only, handled by the "password" credentials
// provider below. The reserved admin account (username "admin", password
// "admin") is bootstrapped on first login, when no admin exists yet. Warga and
// pengurus are pre-registered by the admin via users.addUser, which stores the
// same scrypt secret (authAccounts.secret) that authorize() verifies here.

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import type { MutationCtx } from "./_generated/server";

const ADMIN_USERNAME = "admin";

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: "password",
      authorize: async (credentials, rawCtx) => {
        // The framework's sign-in ctx exposes direct db access (the built-in
        // credentials helpers write to authAccounts the same way); its declared
        // type is generic, so use the generated MutationCtx.
        const ctx = rawCtx as unknown as MutationCtx;

        const username = normalizeUsername(String(credentials.username ?? ""));
        const password = String(credentials.password ?? "");
        if (!username || !password) {
          throw new Error("Username dan password wajib diisi.");
        }

        const account = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", "password").eq("providerAccountId", username),
          )
          .first();

        // Bootstrap: create the reserved admin account (admin / admin) once,
        // only while no admin exists yet.
        if (account === null) {
          if (username === ADMIN_USERNAME && password === ADMIN_USERNAME) {
            const admins = await ctx.db
              .query("users")
              .filter((q) => q.eq(q.field("role"), "admin"))
              .collect();
            if (admins.length === 0) {
              const userId = await ctx.db.insert("users", {
                username,
                name: "Admin RT",
                role: "admin",
              });
              const secret = await new Scrypt().hash(password);
              await ctx.db.insert("authAccounts", {
                userId,
                provider: "password",
                providerAccountId: username,
                secret,
              });
              return { userId };
            }
          }
          throw new Error("Username tidak terdaftar. Hubungi admin RT.");
        }

        const user = await ctx.db.get(account.userId);
        if (!user) throw new Error("Akun tidak ditemukan.");
        if (!account.secret) throw new Error("Akun tidak valid.");
        const valid = await new Scrypt().verify(account.secret, password);
        if (!valid) throw new Error("Username atau password salah.");

        return { userId: account.userId };
      },
    }),
  ],
});
