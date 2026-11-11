import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";

const users = new Hono();

users.get("/pages", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const user = await getPrisma(c.env).user.findUnique({
      where: { id: userId },
      include: { facebookPages: true },
    });

    const pages = Array.isArray(user?.facebookPages) ? user.facebookPages : [];
    if (!user || (!user.facebookAccessToken && pages.length === 0)) {
      return c.json({ success: true, accounts: [] });
    }

    const pageSettings = parsePageSettings(user.pageSettings);
    const accounts = pages.map((page) => {
      const savedSettings = pageSettings.find((settings) => settings.pageId === page.id) ?? {};
      return {
        id: page.id,
        name: page.name,
        picture: page.picture,
        isSelected: page.isSelected,
        settings: {
          enableBot: page.enableBot || savedSettings.enableBot || false,
          enableSchedule: page.enableSchedule !== false,
          enableInbox: page.enableInbox || false,
        },
      };
    });

    return c.json({ success: true, accounts });
  } catch (error) {
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono user pages fetch failed:", { diagnosticId, errorCode, error });
    return c.json({ success: false, error: "Failed to fetch pages", diagnosticId, errorCode }, 500);
  }
});

users.post("/pages/toggle", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  if (typeof body?.pageId !== "string" || !body.pageId || typeof body.isSelected !== "boolean") {
    return c.json({ success: false, error: "Page ID and selection state are required" }, 400);
  }

  try {
    const result = await getPrisma(c.env).facebookPage.updateMany({
      where: { id: body.pageId, userId: c.get("authUser").id },
      data: { isSelected: body.isSelected },
    });
    if (result.count === 0) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    return c.json({
      success: true,
      message: body.isSelected ? "Page Enabled" : "Page Disabled",
    });
  } catch (error) {
    console.error("Hono page selection update failed:", error);
    return c.json({ success: false, error: "Failed to update page selection" }, 500);
  }
});

users.post("/pages/settings", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  if (typeof body?.pageId !== "string" || !body.pageId ||
      !body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    return c.json({ success: false, error: "Page ID and settings are required" }, 400);
  }
  const allowedSettings = ["enableBot", "enableSchedule", "enableInbox"];
  if (Object.entries(body.settings).some(
    ([key, value]) => !allowedSettings.includes(key) || typeof value !== "boolean"
  )) {
    return c.json({ success: false, error: "Page settings must be supported boolean values" }, 400);
  }

  const userId = c.get("authUser").id;
  try {
    const prisma = getPrisma(c.env);
    const page = await prisma.facebookPage.findFirst({
      where: { id: body.pageId, userId },
      select: { id: true },
    });
    if (!page) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pageSettings: true },
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const pageSettings = parsePageSettings(user.pageSettings)
      .filter((settings) => settings.pageId !== body.pageId);
    pageSettings.push({ pageId: body.pageId, ...body.settings });
    await prisma.user.update({
      where: { id: userId },
      data: { pageSettings },
    });

    return c.json({ success: true, message: "Settings updated" });
  } catch (error) {
    console.error("Hono page settings update failed:", error);
    return c.json({ success: false, error: "Failed to update settings" }, 500);
  }
});

users.put("/update", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const userId = c.get("authUser").id;
  const { name, email, avatar, coverImage } = body ?? {};
  if (name !== undefined && name !== null && typeof name !== "string") {
    return c.json({ error: "Name must be a string." }, 400);
  }
  if (email !== undefined && email !== null && typeof email !== "string") {
    return c.json({ error: "Email must be a string." }, 400);
  }
  if (avatar !== undefined && avatar !== null && typeof avatar !== "string") {
    return c.json({ error: "Avatar must be a string." }, 400);
  }
  if (coverImage !== undefined && coverImage !== null && typeof coverImage !== "string") {
    return c.json({ error: "Cover image must be a string." }, 400);
  }

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  if (name && normalizedName.length < 2) {
    return c.json({ error: "Name must be at least 2 characters long." }, 400);
  }
  if (!normalizedName && !normalizedEmail && !avatar && !coverImage) {
    return c.json({ error: "No changes provided." }, 400);
  }

  const data = {};
  if (normalizedName) data.name = normalizedName;
  if (normalizedEmail) data.email = normalizedEmail;
  if (avatar) data.avatar = avatar;
  if (coverImage) data.coverImage = coverImage;

  try {
    const prisma = getPrisma(c.env);
    if (normalizedEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser && existingUser.id !== userId) {
        return c.json({ error: "Email is already in use by another account." }, 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        coverImage: true,
        role: true,
      },
    });

    return c.json({
      success: true,
      message: "Profile updated successfully!",
      user: { ...updatedUser, isDemo: false },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return c.json({ error: "Email is already in use by another account." }, 400);
    }
    console.error("Hono profile update failed:", error);
    return c.json({ error: "Failed to update profile." }, 500);
  }
});

users.get("/stats", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const [posts, replies] = await Promise.all([
      prisma.scheduledPost.count({ where: { userId } }),
      prisma.repliedComment.count({ where: { userId } }),
    ]);

    return c.json({ success: true, stats: { posts, replies } });
  } catch (error) {
    console.error("Hono user stats fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch stats" }, 500);
  }
});

users.get("/connections", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { facebookPages: true },
    });

    let configs = [];
    try {
      configs = await prisma.platformConfig.findMany({
        where: { userId },
        select: { platform: true, isEnabled: true },
      });
    } catch (cfgErr) {
      console.warn("Failed to query platformConfig, using empty defaults:", cfgErr);
    }

    const hasFacebook = Boolean(
      user?.facebookAccessToken ||
      (Array.isArray(user?.facebookPages) && user.facebookPages.length > 0)
    );

    const connections = {
      youtube: false,
      tiktok: false,
      instagram: false,
      facebook: hasFacebook,
    };

    if (Array.isArray(configs)) {
      for (const config of configs) {
        if (config?.isEnabled && Object.hasOwn(connections, config.platform)) {
          connections[config.platform] = true;
        }
      }
    }

    return c.json({ success: true, connections });
  } catch (error) {
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono user connections fetch failed:", { diagnosticId, errorCode, error });
    return c.json({ success: false, error: "Server Error", diagnosticId, errorCode }, 500);
  }
});

function parsePageSettings(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      console.warn("Ignoring malformed saved page settings:", error);
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((setting) => setting && typeof setting === "object") : [];
}

export default users;
