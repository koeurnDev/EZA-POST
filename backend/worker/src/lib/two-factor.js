const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const encryptionAlgorithm = "AES-GCM";

export function generateTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return encodeBase32(bytes);
}

export function createOtpAuthUri(email, secret) {
  const label = encodeURIComponent(`EZA_POST:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: "EZA_POST",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function verifyTotp(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    decodeBase32(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  for (const offset of [-1, 0, 1]) {
    const counter = BigInt(Math.floor(now / 30000) + offset);
    const message = new Uint8Array(8);
    new DataView(message.buffer).setBigUint64(0, counter);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
    const index = digest[digest.length - 1] & 0x0f;
    const value = (
      ((digest[index] & 0x7f) << 24) |
      (digest[index + 1] << 16) |
      (digest[index + 2] << 8) |
      digest[index + 3]
    ) % 1_000_000;

    if (value.toString().padStart(6, "0") === token) return true;
  }

  return false;
}

export async function encryptTotpSecret(secret, env) {
  const key = await getEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextAndTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: encryptionAlgorithm, iv }, key, new TextEncoder().encode(secret))
  );
  const ciphertextLength = ciphertextAndTag.length - 16;
  const result = new Uint8Array(iv.length + ciphertextAndTag.length);
  result.set(iv);
  result.set(ciphertextAndTag.subarray(ciphertextLength), iv.length);
  result.set(ciphertextAndTag.subarray(0, ciphertextLength), iv.length + 16);
  return bytesToBase64(result);
}

export async function decryptTotpSecret(encrypted, env) {
  const data = base64ToBytes(encrypted);
  if (data.length < 29) throw new Error("Encrypted authenticator secret has an invalid format.");

  const key = await getEncryptionKey(env);
  const secret = await crypto.subtle.decrypt(
    { name: encryptionAlgorithm, iv: data.subarray(0, 12) },
    key,
    joinBytes(data.subarray(28), data.subarray(12, 28))
  );
  return new TextDecoder().decode(secret);
}

function encodeBase32(bytes) {
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value) {
  let buffer = 0;
  let bits = 0;
  const bytes = [];

  for (const character of value.toUpperCase().replace(/=+$/, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Authenticator secret is invalid.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

async function getEncryptionKey(env) {
  const passphrase =
    env.ENCRYPTION_KEY || env.JWT_SECRET || "default_secret_key_must_be_32_bytes_long";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(passphrase)));
  return crypto.subtle.importKey("raw", digest, { name: encryptionAlgorithm }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function joinBytes(first, second) {
  const result = new Uint8Array(first.length + second.length);
  result.set(first);
  result.set(second, first.length);
  return result;
}
