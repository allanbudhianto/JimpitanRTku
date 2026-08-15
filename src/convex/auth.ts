// Login is username + password only, handled by the "password" credentials
// provider below. The reserved admin account (username "admin", password
// "admin") is bootstrapped on first login, when no such account exists yet.
// Warga and pengurus are pre-registered by the admin via users.addUser, which
// stores the same secret (authAccounts.secret) that authorize()
// verifies here.

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  convexAuth,
  createAccount,
  retrieveAccount,
} from "@convex-dev/auth/server";

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

        try {
          // Looks up the account by (provider, username) and verifies the
          // password. Throws with a framework error code on failure.
          const { user } = await retrieveAccount(ctx, {
            provider: PROVIDER_ID,
            account: { id: username, secret: password },
          });
          return { userId: user._id };
        } catch (err) {
          const code = err instanceof Error ? err.message : "";

          // Bootstrap: create the reserved admin account (admin / admin) once.
          if (code === "InvalidAccountId") {
            if (username === ADMIN_USERNAME && password === ADMIN_USERNAME) {
              const { user } = await createAccount(ctx, {
                provider: PROVIDER_ID,
                account: { id: username, secret: password },
                profile: {
                  username,
                  name: "Admin RT",
                  role: "admin",
                },
              });
              return { userId: user._id };
            }
            throw new Error("Username tidak terdaftar. Hubungi admin RT.");
          }

          if (code === "TooManyFailedAttempts") {
            throw new Error(
              "Terlalu banyak percobaan gagal. Coba lagi beberapa saat lagi.",
            );
          }

          throw new Error("Username atau password salah.");
        }
      },
    }),
  ],
});
