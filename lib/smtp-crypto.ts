import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "fallback-smtp-encryption-secret!!";
  return crypto.scryptSync(secret, "smtp-config-salt", 32);
}

export function encryptPassword(plain: string): string {
  const iv  = crypto.randomBytes(16);
  const key = getKey();
  const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(stored: string): string {
  try {
    const [ivHex, encHex] = stored.split(":");
    const iv      = Buffer.from(ivHex, "hex");
    const key     = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
