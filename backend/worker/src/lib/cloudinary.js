/**
 * ============================================================
 * ⚡ EZA-POST Pure Cloudflare R2 Media Storage Engine
 * Replaces Cloudinary completely with high-speed, zero-cost Edge R2
 * ============================================================
 */

const uploadLimitBytes = 90 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getFrontendUrl(env) {
  return (env.FRONTEND_URL || "https://eza-post-3kv.pages.dev").replace(/\/$/, "");
}

export async function uploadScheduledMedia(file, env) {
  if (!(file instanceof File)) throw new Error("Scheduled media must be a file.");
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error(`Unsupported scheduled media type: ${file.type || "unknown"}`);
  }
  if (file.size === 0) throw new Error("Scheduled media files cannot be empty.");
  if (file.size > uploadLimitBytes) {
    throw new Error("Scheduled media exceeds the 90 MiB per-file limit.");
  }

  const isVideo = file.type.startsWith("video/");
  const resourceType = isVideo ? "video" : "image";
  const ext = isVideo ? "mp4" : (file.type === "image/png" ? "png" : "jpg");
  const key = `scheduled/${Date.now()}_${crypto.randomUUID()}.${ext}`;

  if (!env.MEDIA_BUCKET) {
    throw new Error("Cloudflare R2 MEDIA_BUCKET binding is missing.");
  }

  const arrayBuffer = await file.arrayBuffer();
  await env.MEDIA_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: {
      originalName: encodeURIComponent(file.name || "media"),
      resourceType,
      uploadedAt: new Date().toISOString()
    }
  });

  const mediaUrl = `${getFrontendUrl(env)}/api/v1/media/${encodeURIComponent(key)}`;

  return {
    url: mediaUrl,
    publicId: key,
    resourceType,
    isR2: true
  };
}

export async function uploadProfileImage(file, folder, env) {
  if (!(file instanceof File)) throw new Error("Profile image must be a file.");
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
    throw new Error("Invalid file type — only JPG, PNG, GIF, or WEBP allowed.");
  }

  if (!env.MEDIA_BUCKET) {
    throw new Error("Cloudflare R2 MEDIA_BUCKET binding is missing.");
  }

  const ext = file.type === "image/png" ? "png" : (file.type === "image/webp" ? "webp" : "jpg");
  const key = `profiles/${folder}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  await env.MEDIA_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  const mediaUrl = `${getFrontendUrl(env)}/api/v1/media/${encodeURIComponent(key)}`;

  return {
    url: mediaUrl,
    publicId: key,
    size: file.size,
    isR2: true
  };
}

export async function deleteScheduledMedia(asset, env) {
  if (!asset || !asset.publicId || !env.MEDIA_BUCKET) return;
  try {
    await env.MEDIA_BUCKET.delete(asset.publicId);
  } catch (e) {
    console.warn("R2 delete scheduled media failed:", asset.publicId, e);
  }
}

export async function listCloudinaryResources(resourceType, prefix, env) {
  if (!env.MEDIA_BUCKET) return [];
  try {
    const r2Prefix = resourceType === "video" ? "scheduled/" : "profiles/";
    const list = await env.MEDIA_BUCKET.list({ prefix: r2Prefix, limit: 50 });
    const frontendUrl = getFrontendUrl(env);

    return (list.objects || []).map((o) => ({
      public_id: o.key,
      secure_url: `${frontendUrl}/api/v1/media/${encodeURIComponent(o.key)}`,
      bytes: o.size,
      created_at: o.uploaded ? o.uploaded.toISOString() : new Date().toISOString(),
      resource_type: resourceType
    }));
  } catch (e) {
    console.warn("R2 list media failed:", e);
    return [];
  }
}

export async function deleteCloudinaryResource(resourceType, publicId, prefix, env) {
  if (!publicId || !env.MEDIA_BUCKET) return;
  try {
    await env.MEDIA_BUCKET.delete(publicId);
  } catch (e) {
    console.warn("R2 delete media failed:", publicId, e);
  }
}

export function isCloudinaryPublicIdInFolder(publicId, prefix) {
  return typeof publicId === "string" && publicId.trim().length > 0;
}

export const scheduledUploadLimitBytes = uploadLimitBytes;
