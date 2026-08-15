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
