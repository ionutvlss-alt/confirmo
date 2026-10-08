import crypto from "node:crypto";

function key() {
  const configuredKey = process.env.ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && (!configuredKey || configuredKey.length < 32)) {
    throw new Error("ENCRYPTION_KEY must be configured with at least 32 characters in production");
  }
  return crypto.createHash("sha256").update(configuredKey || "confirmo-development-key").digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const [ivText, tagText, dataText] = value.split(".");
  if (!ivText || !tagText || !dataText) throw new Error("Invalid encrypted secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}
