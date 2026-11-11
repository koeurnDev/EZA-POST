import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";

const bio = new Hono();

// Helper to sanitize slug
function sanitizeSlug(slug) {
  if (!slug || typeof slug !== "string") return "";
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// 🟢 GET /api/bio/me - Fetch authenticated user's digital business card / bio page
bio.get("/me", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const prisma = getPrisma(c.env);

  try {
    const page = await prisma.bioPage.findFirst({
      where: { userId: authUser.id },
    });

    return c.json({
      success: true,
      bioPage: page || null,
    });
  } catch (error) {
    console.error("[Bio] Error fetching user bio page:", error);
    return c.json({ success: false, error: "Failed to fetch bio page" }, 500);
  }
});

// 🔍 GET /api/bio/check-slug/:slug - Check if handle/slug is available
bio.get("/check-slug/:slug", async (c) => {
  const rawSlug = c.req.param("slug");
  const cleanSlug = sanitizeSlug(rawSlug);

  if (!cleanSlug || cleanSlug.length < 3) {
    return c.json({ success: true, available: false, error: "Slug must be at least 3 characters" });
  }

  const prisma = getPrisma(c.env);
  try {
    const existing = await prisma.bioPage.findUnique({
      where: { slug: cleanSlug },
      select: { id: true, userId: true },
    });

    return c.json({
      success: true,
      slug: cleanSlug,
      available: !existing,
    });
  } catch (error) {
    return c.json({ success: false, error: "Failed to check handle availability" }, 500);
  }
});

// 💾 POST /api/bio - Create or update digital business card
bio.post("/", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const cleanSlug = sanitizeSlug(body.slug);
  if (!cleanSlug || cleanSlug.length < 3 || cleanSlug.length > 50) {
    return c.json({
      success: false,
      error: "Business handle (slug) must be 3-50 alphanumeric characters or hyphens",
    }, 400);
  }

  if (!body.businessName || typeof body.businessName !== "string" || !body.businessName.trim()) {
    return c.json({ success: false, error: "Business name is required" }, 400);
  }

  const prisma = getPrisma(c.env);

  try {
    // Check if slug belongs to another user
    const existingSlug = await prisma.bioPage.findUnique({
      where: { slug: cleanSlug },
    });

    if (existingSlug && existingSlug.userId !== authUser.id) {
      return c.json({
        success: false,
        error: `Handle '${cleanSlug}' is already registered by another business. Please choose another handle.`,
      }, 409);
    }

    // Check if current user already has a bio page
    const userPage = await prisma.bioPage.findFirst({
      where: { userId: authUser.id },
    });

    const pageData = {
      userId: authUser.id,
      slug: cleanSlug,
      businessName: body.businessName.trim(),
      category: body.category || "General Business",
      bio: body.bio || "",
      avatarUrl: body.avatarUrl || "",
      coverUrl: body.coverUrl || "",
      theme: body.theme || "dark",
      contacts: body.contacts || {},
      businessHours: body.businessHours || {},
      googleMapsUrl: body.googleMapsUrl || "",
      address: body.address || "",
      youtubeUrl: body.youtubeUrl || "",
      khqrString: body.khqrString || "",
      khqrImage: body.khqrImage || "",
      khqrBankName: body.khqrBankName || "Bakong / ABA Bank",
      khqrAccountName: body.khqrAccountName || "",
      products: Array.isArray(body.products) ? body.products : [],
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      updatedAt: new Date().toISOString(),
    };

    let result;
    if (userPage) {
      result = await prisma.bioPage.update({
        where: { id: userPage.id },
        data: pageData,
      });
    } else {
      result = await prisma.bioPage.create({
        data: {
          id: crypto.randomUUID(),
          ...pageData,
          views: 0,
          qrScans: 0,
          clicks: 0,
          createdAt: new Date().toISOString(),
        },
      });
    }

    return c.json({
      success: true,
      bioPage: result,
      message: "Business Bio Card saved successfully!",
    });
  } catch (error) {
    console.error("[Bio] Error saving bio page:", error);
    return c.json({ success: false, error: error.message || "Failed to save bio page" }, 500);
  }
});

// 🌐 GET /api/bio/public/:slug - Fast Edge Public View (High performance & counter)
bio.get("/public/:slug", async (c) => {
  const rawSlug = c.req.param("slug");
  const cleanSlug = sanitizeSlug(rawSlug);

  if (!cleanSlug) {
    return c.json({ success: false, error: "Invalid business handle" }, 400);
  }

  const prisma = getPrisma(c.env);

  try {
    const page = await prisma.bioPage.findUnique({
      where: { slug: cleanSlug },
    });

    if (!page || (!page.isActive && !c.req.query("preview"))) {
      return c.json({ success: false, error: "Business page not found or inactive" }, 404);
    }

    // Increment page views in background (zero latency impact)
    if (c.env.DB && typeof c.env.DB.prepare === "function") {
      c.executionCtx?.waitUntil?.(
        c.env.DB.prepare("UPDATE bio_pages SET views = views + 1 WHERE id = ?")
          .bind(page.id)
          .run()
          .catch((e) => console.error("[Bio] View counter error:", e))
      );
    }

    return c.json({
      success: true,
      bioPage: {
        ...page,
        views: (page.views || 0) + 1,
      },
    });
  } catch (error) {
    console.error("[Bio] Public retrieval error:", error);
    return c.json({ success: false, error: "Failed to load business profile" }, 500);
  }
});

// 📊 POST /api/bio/public/:slug/track - Track user interactions (QR scan, Call, Telegram click)
bio.post("/public/:slug/track", async (c) => {
  const rawSlug = c.req.param("slug");
  const cleanSlug = sanitizeSlug(rawSlug);

  let body = {};
  try {
    body = await c.req.json();
  } catch {
    // Body is optional
  }

  const { type = "click" } = body;
  const prisma = getPrisma(c.env);

  try {
    const page = await prisma.bioPage.findUnique({
      where: { slug: cleanSlug },
      select: { id: true },
    });

    if (!page) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    const column = type === "qr_scan" ? "qrScans" : "clicks";
    if (c.env.DB && typeof c.env.DB.prepare === "function") {
      c.executionCtx?.waitUntil?.(
        c.env.DB.prepare(`UPDATE bio_pages SET ${column} = ${column} + 1 WHERE id = ?`)
          .bind(page.id)
          .run()
          .catch((e) => console.error(`[Bio] ${column} counter error:`, e))
      );
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: "Failed to record event" }, 500);
  }
});

export default bio;
