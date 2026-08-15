import { generateKeyPairSync } from "node:crypto";
import { execSync } from "node:child_process";

try {
  console.log("Checking Convex Auth environment variables...");
  let envList = "";
  try {
    envList = execSync("npx convex env list", { encoding: "utf-8" });
  } catch (err) {
    console.log("Could not list convex env, attempting to set keys...");
  }

  if (!envList.includes("JWT_PRIVATE_KEY") || !envList.includes("JWKS")) {
    console.log("Generating Convex Auth JWT keys...");
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString()
      .trim()
      .replace(/\r?\n/g, " ");
    const jwk = publicKey.export({ format: "jwk" });
    const jwks = JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...jwk }] });

    execSync(`npx convex env set JWT_PRIVATE_KEY "${privateKeyPem}"`, { stdio: "inherit" });
    execSync(`npx convex env set JWKS '${jwks}'`, { stdio: "inherit" });
    execSync(`npx convex env set SITE_URL "https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'jimpitan-rtku-ivory.vercel.app'}"`, { stdio: "inherit" });
    console.log("Convex Auth keys configured successfully!");
  } else {
    console.log("Convex Auth keys already configured.");
  }
} catch (e) {
  console.warn("Failed to set Convex auth keys automatically:", e.message);
}
