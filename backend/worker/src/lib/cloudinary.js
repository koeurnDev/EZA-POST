const uploadLimitBytes = 90 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function uploadScheduledMedia(file, env) {
  if (!(file instanceof File)) throw new Error("Scheduled media must be a file.");
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error(`Unsupported scheduled media type: ${file.type || "unknown"}`);
  }
  if (file.size === 0) throw new Error("Scheduled media files cannot be empty.");
  if (file.size > uploadLimitBytes) {
    throw new Error("Scheduled media exceeds the 90 MiB per-file limit.");
  }

  const cloudName = requiredEnv(env, "CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv(env, "CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv(env, "CLOUDINARY_API_SECRET");
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw new Error("CLOUDINARY_CLOUD_NAME has an invalid format.");
  }
  const resourceType = file.type.startsWith("video/") ? "video" : "image";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = {
    folder: "kr_post/scheduled",
    timestamp,
    unique_filename: "true",
    use_filename: "true",
  };
  const signature = await signCloudinaryParameters(parameters, apiSecret);
  const form = new FormData();
  form.set("file", file, file.name || "upload");
  form.set("api_key", apiKey);
  form.set("signature", signature);
  for (const [key, value] of Object.entries(parameters)) form.set(key, value);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`,
    { method: "POST", body: form }
  );
  const result = await response.json();
  if (!response.ok || typeof result.secure_url !== "string" || typeof result.public_id !== "string") {
    console.error("Cloudinary scheduled-media upload failed:", result);
    throw new Error("Scheduled media upload failed.");
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType,
  };
}

export async function uploadProfileImage(file, folder, env) {
  if (!(file instanceof File)) throw new Error("Profile image must be a file.");
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
    throw new Error("Invalid file type — only JPG, PNG, GIF, or WEBP allowed.");
  }

  const cloudName = requiredEnv(env, "CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv(env, "CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv(env, "CLOUDINARY_API_SECRET");
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw new Error("CLOUDINARY_CLOUD_NAME has an invalid format.");
  }
  const parameters = {
    folder,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    unique_filename: "true",
    use_filename: "true",
  };
  const form = new FormData();
  form.set("file", file, file.name || "upload");
  form.set("api_key", apiKey);
  form.set("signature", await signCloudinaryParameters(parameters, apiSecret));
  for (const [key, value] of Object.entries(parameters)) form.set(key, value);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    { method: "POST", body: form }
  );
  const result = await response.json();
  if (!response.ok || typeof result.secure_url !== "string" || typeof result.public_id !== "string") {
    console.error("Cloudinary profile-image upload failed:", response.status);
    throw new Error("Profile image upload failed.");
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    size: typeof result.bytes === "number" ? result.bytes : file.size,
  };
}

export async function deleteScheduledMedia(asset, env) {
  const cloudName = requiredEnv(env, "CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv(env, "CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv(env, "CLOUDINARY_API_SECRET");
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw new Error("CLOUDINARY_CLOUD_NAME has an invalid format.");
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = { public_id: asset.publicId, timestamp };
  const form = new FormData();
  form.set("public_id", asset.publicId);
  form.set("timestamp", timestamp);
  form.set("api_key", apiKey);
  form.set("signature", await signCloudinaryParameters(parameters, apiSecret));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${asset.resourceType}/destroy`,
    { method: "POST", body: form }
  );
  const result = await response.json();
  if (!response.ok || !["ok", "not found"].includes(result.result)) {
    throw new Error(`Cloudinary cleanup failed for ${asset.publicId}.`);
  }
}

export async function listCloudinaryResources(resourceType, prefix, env) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials(env);
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${resourceType}/upload`
  );
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("max_results", "50");
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}` },
  });
  const result = await readCloudinaryAdminResponse(response, "Resource listing");
  if (!Array.isArray(result.resources)) {
    throw new Error("Cloudinary returned an invalid resource list.");
  }
  return result.resources;
}

export async function deleteCloudinaryResource(resourceType, publicId, prefix, env) {
  if (!isCloudinaryPublicIdInFolder(publicId, prefix)) {
    throw new Error("Cloudinary public ID is outside the managed folder.");
  }
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials(env);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = { public_id: publicId, timestamp };
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("timestamp", timestamp);
  form.set("api_key", apiKey);
  form.set("signature", await signCloudinaryParameters(parameters, apiSecret));
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/destroy`,
    { method: "POST", body: form }
  );
  const result = await readCloudinaryAdminResponse(response, "Resource deletion");
  if (!["ok", "not found"].includes(result.result)) {
    throw new Error("Cloudinary did not confirm resource deletion.");
  }
}

export function isCloudinaryPublicIdInFolder(publicId, prefix) {
  return typeof publicId === "string" && publicId.startsWith(`${prefix}/`) &&
    !publicId.includes("\\") &&
    publicId.split("/").every((part) => part && part !== "." && part !== "..");
}

export async function signCloudinaryParameters(parameters, apiSecret) {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const payload = new TextEncoder().encode(`${serialized}${apiSecret}`);
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const scheduledUploadLimitBytes = uploadLimitBytes;

function getCloudinaryCredentials(env) {
  const cloudName = requiredEnv(env, "CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv(env, "CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv(env, "CLOUDINARY_API_SECRET");
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw new Error("CLOUDINARY_CLOUD_NAME has an invalid format.");
  }
  return { cloudName, apiKey, apiSecret };
}

async function readCloudinaryAdminResponse(response, operation) {
  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error(`Cloudinary ${operation.toLowerCase()} returned invalid JSON:`, error);
    throw new Error(`Cloudinary ${operation.toLowerCase()} failed.`);
  }
  if (!response.ok) {
    console.error(`Cloudinary ${operation.toLowerCase()} failed:`, response.status);
    throw new Error(`Cloudinary ${operation.toLowerCase()} failed.`);
  }
  return result;
}

function requiredEnv(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value) throw new Error(`${name} Worker secret is not configured.`);
  return value;
}
