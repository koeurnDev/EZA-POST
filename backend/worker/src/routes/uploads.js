import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import {
  deleteCloudinaryResource,
  isCloudinaryPublicIdInFolder,
  listCloudinaryResources,
  uploadProfileImage,
} from "../lib/cloudinary.js";

const uploads = new Hono();
const imageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

uploads.post("/avatar", requireAuth, (c) => handleProfileImageUpload(c, "avatar", 2 * 1024 * 1024));
uploads.post("/cover", requireAuth, (c) => handleProfileImageUpload(c, "cover", 5 * 1024 * 1024));
uploads.post("/bot-image", requireAuth, handleBotImageUpload);
uploads.post("/thumbnail", requireAuth, handleThumbnailUpload);
uploads.get("/video", requireAuth, (c) => listMedia(c, "video", "eza-post/videos"));
uploads.get("/thumbnail", requireAuth, (c) => listMedia(c, "image", "kr_post/thumbnails"));
uploads.delete("/video/:id", requireAuth, (c) => deleteMedia(c, "video", "eza-post/videos"));
uploads.delete("/video/*", requireAuth, (c) => deleteMedia(c, "video", "eza-post/videos"));
uploads.delete("/thumbnail/:id", requireAuth, (c) => deleteMedia(c, "image", "kr_post/thumbnails"));
uploads.delete("/thumbnail/*", requireAuth, (c) => deleteMedia(c, "image", "kr_post/thumbnails"));

async function listMedia(c, resourceType, prefix) {
  try {
    const resources = await listCloudinaryResources(resourceType, prefix, c.env);
    const files = resources.map((resource) => ({
      name: resource.public_id,
      url: resource.secure_url,
      ...(resourceType === "video"
        ? { sizeMB: `${(resource.bytes / (1024 * 1024)).toFixed(2)} MB` }
        : { sizeKB: `${(resource.bytes / 1024).toFixed(2)} KB` }),
      uploadedAt: resource.created_at,
      publicId: resource.public_id,
    }));
    return resourceType === "video"
      ? c.json({ success: true, total: files.length, videos: files })
      : c.json({ success: true, count: files.length, thumbnails: files });
  } catch (error) {
    console.error(`Hono Cloudinary ${resourceType} listing failed:`, error);
    return c.json({ success: false, error: `Failed to list ${resourceType} files.` }, 502);
  }
}

async function deleteMedia(c, resourceType, prefix) {
  const publicId = c.req.param("id") || c.req.param("*") || "";
  if (!isCloudinaryPublicIdInFolder(publicId, prefix)) {
    return c.json({ success: false, error: "Invalid media ID." }, 400);
  }
  try {
    await deleteCloudinaryResource(resourceType, publicId, prefix, c.env);
    const label = resourceType === "video" ? "Video" : "Thumbnail";
    return c.json({
      success: true,
      message: `${label} deleted successfully`,
    });
  } catch (error) {
    console.error(`Hono Cloudinary ${resourceType} deletion failed:`, error);
    return c.json({ success: false, error: `Failed to delete ${resourceType}.` }, 502);
  }
}

async function handleBotImageUpload(c) {
  let body;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    console.error("Hono bot image multipart parsing failed:", error);
    return c.json({ success: false, error: "Invalid multipart upload." }, 400);
  }

  const file = body.image;
  if (!(file instanceof File)) {
    return c.json({ success: false, error: "No file uploaded" }, 400);
  }
  if (!imageTypes.has(file.type)) {
    return c.json({
      success: false,
      error: "Invalid file type — only JPG, PNG, GIF, or WEBP allowed.",
    }, 400);
  }
  if (file.size === 0) {
    return c.json({ success: false, error: "Uploaded file cannot be empty." }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({
      success: false,
      error: "File exceeds the 5 MB limit.",
    }, 400);
  }

  try {
    const result = await uploadProfileImage(file, "kr_post/bot_replies", c.env);
    return c.json({
      success: true,
      message: "Bot image uploaded successfully",
      url: result.url,
      publicId: result.publicId,
    }, 201);
  } catch (error) {
    console.error("Hono bot image upload failed:", error);
    return c.json({ success: false, error: "Bot image upload failed." }, 500);
  }
}

async function handleThumbnailUpload(c) {
  let body;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    console.error("Hono thumbnail multipart parsing failed:", error);
    return c.json({ success: false, error: "Invalid multipart upload." }, 400);
  }

  const file = body.thumbnail;
  if (!(file instanceof File)) {
    return c.json({ success: false, error: "No file uploaded" }, 400);
  }
  if (!imageTypes.has(file.type)) {
    return c.json({
      success: false,
      error: "Invalid file type — only JPG, PNG, GIF, or WEBP allowed.",
    }, 400);
  }
  if (file.size === 0) {
    return c.json({ success: false, error: "Uploaded file cannot be empty." }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ success: false, error: "File exceeds the 5 MB limit." }, 400);
  }

  try {
    const result = await uploadProfileImage(file, "kr_post/thumbnails", c.env);
    return c.json({
      success: true,
      message: "Thumbnail uploaded successfully",
      file: {
        name: result.publicId,
        url: result.url,
        path: result.url,
        sizeKB: `${(result.size / 1024).toFixed(2)} KB`,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        publicId: result.publicId,
      },
    }, 201);
  } catch (error) {
    console.error("Hono thumbnail upload failed:", error);
    return c.json({ success: false, error: "Thumbnail upload failed." }, 500);
  }
}

async function handleProfileImageUpload(c, fieldName, maxBytes) {
  let body;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    console.error(`Hono ${fieldName} multipart parsing failed:`, error);
    return c.json({ success: false, error: "Invalid multipart upload." }, 400);
  }

  const file = body[fieldName];
  if (!(file instanceof File)) {
    return c.json({ success: false, error: "No file uploaded" }, 400);
  }
  if (!imageTypes.has(file.type)) {
    return c.json({
      success: false,
      error: "Invalid file type — only JPG, PNG, GIF, or WEBP allowed.",
    }, 400);
  }
  if (file.size === 0) {
    return c.json({ success: false, error: "Uploaded file cannot be empty." }, 400);
  }
  if (file.size > maxBytes) {
    const limitInMb = maxBytes / (1024 * 1024);
    return c.json({
      success: false,
      error: `File exceeds the ${limitInMb} MB limit.`,
    }, 400);
  }

  try {
    const result = await uploadProfileImage(file, `kr_post/${fieldName}s`, c.env);
    const label = fieldName === "avatar" ? "Avatar uploaded successfully" : "Cover image uploaded successfully";
    return c.json({
      success: true,
      message: label,
      file: {
        name: result.publicId,
        url: result.url,
        path: result.url,
        sizeKB: `${(result.size / 1024).toFixed(2)} KB`,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        publicId: result.publicId,
      },
    }, 201);
  } catch (error) {
    console.error(`Hono ${fieldName} upload failed:`, error);
    return c.json({
      success: false,
      error: fieldName === "avatar" ? "Avatar upload failed." : "Cover upload failed.",
    }, 500);
  }
}

export default uploads;
