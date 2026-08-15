// Login is username + password only, handled by the "password" credentials
// provider below. The reserved admin account (username "admin", password
// "admin") is bootstrapped on first login, when no such account exists yet.
// Warga and pengurus are pre-registered by the admin via users.addUser, which
// stores the same secret (authAccounts.secret) that authorize()
// verifies here.

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";

const ADMIN_USERNAME = "admin";
const PROVIDER_ID = "password";

export async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode("jimpitan_rt_salt_" + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifySecret(hash: string, secret: string): Promise<boolean> {
  const calculated = await hashSecret(secret);
  return calculated === hash;
}

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: PROVIDER_ID,
      crypto: {
        hashSecret: (secret) => hashSecret(secret),
        verifySecret: (secret, hash) => verifySecret(hash, secret),
      },
      authorize: async (credentials, ctx) => {
        const username = normalizeUsername(String(credentials.username ?? ""));
        const password = String(credentials.password ?? "");
        if (!username || !password) {
          throw new Error("Username dan password wajib diisi.");
        }

        // Check if admin account exists or bootstrap create/repair it
        if (username === ADMIN_USERNAME && password === ADMIN_USERNAME) {
          let user = await ctx.db
            .query("users")
            .withIndex("username", (q) => q.eq("username", ADMIN_USERNAME))
            .first();

          if (!user) {
            const userId = await ctx.db.insert("users", {
              username: ADMIN_USERNAME,
              name: "Admin RT",
              role: "admin",
            });
            const secret = await hashSecret(ADMIN_USERNAME);
            await ctx.db.insert("authAccounts", {
              userId,
              provider: PROVIDER_ID,
              providerAccountId: ADMIN_USERNAME,
              secret,
            });
            return { userId };
          }

          // Ensure authAccount exists and has valid secret
          let account = await ctx.db
            .query("authAccounts")
            .withIndex("providerAndAccountId", (q) =>
              q.eq("provider", PROVIDER_ID).eq("providerAccountId", ADMIN_USERNAME),
            )
            .first();

          if (!account) {
            const secret = await hashSecret(ADMIN_USERNAME);
            await ctx.db.insert("authAccounts", {
              userId: user._id,
              provider: PROVIDER_ID,
              providerAccountId: ADMIN_USERNAME,
              secret,
            });
          } else {
            // Self-repair password hash if it was mismatch
            const valid = await verifySecret(account.secret, ADMIN_USERNAME);
            if (!valid) {
              const secret = await hashSecret(ADMIN_USERNAME);
              await ctx.db.patch(account._id, { secret });
            }
          }

          return { userId: user._id };
        }

        // Standard user login check
        const account = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", PROVIDER_ID).eq("providerAccountId", username),
          )
          .first();

        if (!account || !account.secret) {
          throw new Error("Username tidak terdaftar. Hubungi admin RT.");
        }

        const valid = await verifySecret(account.secret, password);
        if (!valid) {
          throw new Error("Username atau password salah.");
        }

        return { userId: account.userId };
      },
    }),
  ],
});
