import { execSync } from "node:child_process";

const privateKeyPem = `-----BEGIN PRIVATE KEY----- MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDYJ6gxgmbAjSti aAsNgcHMZ0aIGIdlA2xYonWm0jYzSE4bTq5izAPPy980hIVJ5qaVO/zi+CVm4Bot B15YxeBrYUdYh+gg6N+gaXjboYCvA/qG1/sxeWshQ7uaD/Q19c33Sc1KQAQLnbXK 6IDTxqJtx7kV/WjWASaErxb56bRJZwJyvbpODMThJoafIveJ1Wvyyikt0c1aJuj+ iXhGF7SzMlFtFjCHVxK+uo8bDX2OaYInjqkG7TmJ53hHAT9SxZg1VELO1Zb8z174 TH5Q3vSUNDxTpY5pF4LM0oKCkVwQ33XjbjI40iKlmQwieCwxPeJCtvheQmZrCenM AqymP7PdAgMBAAECggEABE3d2oaHN0RYXdBGkBFKY6CW1fTvFULZMHajsxuyepjw /Tg23r7DQKsFmc0dvlf6bzRPl9FrJT5HJyhjZ48hJeI9AnVKWQVqFo6jGnR/1HxW y8KXPOf3CyWHIc05hq2LWWY90UGvEvAkA5NXpV/qMhdtBxQRt1k0hCXcZkOSFHgQ RHSakm5V1+sJM154lBuCcp9aJQuP9Dsx0cfW8La7jxL7736fDIeMVH4gm97ETDQZ E2RlIwxLHsc+UA22KzjVgXB9ionFPeKDj/VkzELbQu+rXQLPBR3jdRIBH7BZ6gnt g3UW4pXKLTZGMFdU6DUtL5ptg/U+Jzy9KXkfbrZDnQKBgQDw1X830yJXk3+g4enq dcsxbg+T+TfGTw89s0UM6tm2YUTrBKCP6KwCkA2iOMnDpx8/DgoEtIemxZ0MskYq 15OOrzvqhJWIQFF5TaXm+GK5Iz65QHAsRtGjbqkyE4UYbyTRnxxWzqrCUUIH+w6y RJdNTsjyZFsnvsebyRYmWOvUMwKBgQDlxE6XEi4NIYmlHsh16j0fnhLnhLIoCkdU APx68PuijRBQ7oeRfDi5d8GzA7xWQXM04SAZizOEbrCbMRKHDoR7P3ml95okYejq 3tcXtSUH47sw8W8NAudnH+KnyfoZLs4mcn9ND2Q8O+0z5fxbm9AXpPMZtqo27Zqy zOv0YpLHrwKBgFxp0FNflUH9u2/EwLnTUZE6JogljZ1vIO4QKGL4i2pMkOGN+P6/ zaF+HX0uRV3qdzb+8CE2FQeNtOH2Vq6B4oFSBK/NCIQsChd+EDc9AMUCHUOA0opq 8m7AO/SXQO9LVtmJMJqu2x+NhsUBNXZ6k4R6wukgUUpDDt1coD8+x9+5AoGACXAa 2lHA2oE6KjItgcpxYE8Z77CfsM1bSLQRqusjKvYoaWqi3vL/UX790eChZ9mgZdep feMd5p61WmqVnD6Yaoec85hMGJp8+sjUhQDH2J8eHVCNgzdPUgkZQlMllss5ZJLn b77mGyNLBwq3ZvvrfE0mPzQlocP4ysdoGc3CwbkCgYAk2idMXkR0xruC5xV9BE5J p6ou7VEAlqFllZZ57jxemhdJ48Z23LKP3xpU5VG5QljjJbeHa1qGNjcWIb5AZnsa nwHuDxv7HjLEAuAyW7lbyMUNfS36BQ+cgG4vEdC2JWHmjeFJ4BEpTWPiBHTDnndP SIkLZxNqYxuXWiAji76RQA== -----END PRIVATE KEY-----`;

const jwks = JSON.stringify({
  keys: [
    {
      use: "sig",
      alg: "RS256",
      kty: "RSA",
      n: "2CeoMYJmwI0rYmgLDYHBzGdGiBiHZQNsWKJ1ptI2M0hOG06uYswDz8vfNISFSeamlTv84vglZuAaLQdeWMXga2FHWIfoIOjfoGl426GArwP6htf7MXlrIUO7mg_0NfXN90nNSkAEC521yuiA08aibce5Ff1o1gEmhK8W-em0SWcCcr26TgzE4SaGnyL3idVr8sopLdHNWibo_ol4Rhe0szJRbRYwh1cSvrqPGw19jmmCJ46pBu05ied4RwE_UsWYNVRCztWW_M9e-Ex-UN70lDQ8U6WOaReCzNKCgpFcEN91424yONIipZkMIngsMT3iQrb4XkJmawnpzAKspj-z3Q",
      e: "AQAB"
    }
  ]
});

try {
  console.log("Setting Convex Auth production environment variables with --prod...");
  execSync(`npx convex env set JWT_PRIVATE_KEY "${privateKeyPem}" --prod`, { stdio: "inherit" });
  execSync(`npx convex env set JWKS '${jwks}' --prod`, { stdio: "inherit" });
  execSync(`npx convex env set SITE_URL "https://jimpitan-rtku-ivory.vercel.app" --prod`, { stdio: "inherit" });
  console.log("Convex Auth keys successfully set on production!");
} catch (e) {
  console.warn("Could not set env via CLI with --prod:", e.message);
}
