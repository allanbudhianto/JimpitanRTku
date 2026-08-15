import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  convexAuth,
  createAccount,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { hashSecret, verifySecret } from "./crypto";
import { api } from "./_generated/api";

export { hashSecret, verifySecret };

const ADMIN_USERNAME = "admin";
const PROVIDER_ID = "password";

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

        // 1. Try normal login
        try {
          const { user } = await retrieveAccount(ctx, {
            provider: PROVIDER_ID,
            account: { id: username, secret: password },
          });
          return { userId: user._id };
        } catch (err) {
          // 2. If login fails and this is admin/admin, auto-reset and create fresh admin
          if (username === ADMIN_USERNAME && password === ADMIN_USERNAME) {
            try {
              // Wipe any broken admin account from database automatically
              await ctx.runMutation(api.users.resetAdmin, {});

              // Create fresh admin account
              const { user } = await createAccount(ctx, {
                provider: PROVIDER_ID,
                account: { id: ADMIN_USERNAME, secret: password },
                profile: {
                  username: ADMIN_USERNAME,
                  name: "Admin RT",
                  role: "admin",
                },
              });
              return { userId: user._id };
            } catch (createErr) {
              console.error("Failed to bootstrap admin account:", createErr);
              throw new Error("Gagal membuat akun admin. Silakan coba lagi.");
            }
          }

          throw new Error("Username atau password salah.");
        }
      },
    }),
  ],
});
