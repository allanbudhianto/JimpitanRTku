import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  convexAuth,
  createAccount,
  retrieveAccount,
} from "@convex-dev/auth/server";

const ADMIN_USERNAME = "admin";
const PROVIDER_ID = "password";

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: PROVIDER_ID,
      authorize: async (credentials, ctx) => {
        const username = normalizeUsername(String(credentials.username ?? ""));
        const password = String(credentials.password ?? "");
        if (!username || !password) {
          throw new Error("Username dan password wajib diisi.");
        }

        try {
          const { user } = await retrieveAccount(ctx, {
            provider: PROVIDER_ID,
            account: { id: username, secret: password },
          });
          return { userId: user._id };
        } catch (err) {
          // If login fails and this is admin/admin, attempt initial bootstrap
          if (username === ADMIN_USERNAME && password === ADMIN_USERNAME) {
            try {
              const { user } = await createAccount(ctx, {
                provider: PROVIDER_ID,
                account: { id: username, secret: password },
                profile: {
                  username: ADMIN_USERNAME,
                  name: "Admin RT",
                  role: "admin",
                },
              });
              return { userId: user._id };
            } catch {
              // If account was already created with another secret, throw clear error
              throw new Error("Akun admin sudah ada tetapi password tidak cocok.");
            }
          }

          throw new Error("Username atau password salah.");
        }
      },
    }),
  ],
});
