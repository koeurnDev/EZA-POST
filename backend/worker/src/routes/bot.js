import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";
import { decryptFacebookToken, fetchRecentFacebookPosts } from "../lib/facebook.js";
import { generateBotSuggestions } from "../lib/ai.js";

const bot = new Hono();
const ruleTypes = new Set(["KEYWORD", "REGEX"]);
const ruleScopes = new Set(["ALL", "SPECIFIC"]);

bot.post("/suggestions", requireAuth, async (c) => {
  try {
    const suggestions = await generateBotSuggestions(c.env);
    return c.json({ success: true, suggestions });
  } catch (error) {
    console.error("Hono bot suggestions generation failed:", error);
    const status = error instanceof Error &&
      error.message === "GEMINI_API_KEY Worker secret is not configured." ? 503 : 502;
    return c.json({
      success: false,
      message: "Failed to generate suggestions",
    }, status);
  }
});

bot.get("/rules", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const [rules, user, status] = await Promise.all([
      prisma.botRule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.user.findUnique({ where: { id: userId }, select: { pageSettings: true } }),
      prisma.botStatus.findUnique({ where: { userId }, select: { enabled: true } }),
    ]);
    return c.json({
      success: true,
      rules,
      enabled: status?.enabled ?? true,
      pageSettings: parsePageSettings(user?.pageSettings),
    });
  } catch (error) {
    console.error("Hono bot rules fetch failed:", error);
    return c.json({ success: false, message: "Server error" }, 500);
  }
});

bot.put("/page-settings", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "A valid JSON body is required" }, 400);
  }
  if (typeof body?.enabled !== "boolean") {
    return c.json({ success: false, message: "Enabled must be a boolean" }, 400);
  }
  const requestedIds = body.pageIds ?? (body.pageId ? [body.pageId] : []);
  if (!Array.isArray(requestedIds) ||
      requestedIds.some((id) => typeof id !== "string" || !id)) {
    return c.json({ success: false, message: "Page IDs must be a list of strings" }, 400);
  }
  const pageIds = [...new Set(requestedIds)];
  if (!pageIds.length) {
    return c.json({ success: false, message: "At least one page ID is required" }, 400);
  }

  try {
    const prisma = getPrisma(c.env);
    const userId = c.get("authUser").id;
    const pages = await prisma.facebookPage.findMany({
      where: { userId, id: { in: pageIds } },
      select: { id: true },
    });
    if (pages.length !== pageIds.length) {
      return c.json({ success: false, message: "One or more pages were not found" }, 404);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pageSettings: true },
    });
    if (!user) return c.json({ success: false, message: "User not found" }, 404);

    const pageSettings = parsePageSettings(user.pageSettings);
    for (const pageId of pageIds) {
      const current = pageSettings.find((setting) => setting.pageId === pageId);
      if (current) current.enableBot = body.enabled;
      else pageSettings.push({ pageId, enableBot: body.enabled });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { pageSettings } }),
      prisma.facebookPage.updateMany({
        where: { userId, id: { in: pageIds } },
        data: { enableBot: body.enabled },
      }),
    ]);
    return c.json({ success: true, message: "Page bot settings updated", pageSettings });
  } catch (error) {
    console.error("Hono bot page settings update failed:", error);
    return c.json({ success: false, message: "Failed to update page bot settings" }, 500);
  }
});

bot.post("/rules", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "A valid JSON body is required" }, 400);
  }
  const validated = validateRule(body, false);
  if (validated.error) return c.json({ success: false, message: validated.error }, 400);

  try {
    const prisma = getPrisma(c.env);
    const userId = c.get("authUser").id;
    if (await prisma.botRule.count({ where: { userId } }) >= 50) {
      return c.json({
        success: false,
        message: "បងបង្កើតច្បាប់បានច្រើនបំផុតត្រឹម ៥០ ប៉ុណ្ណោះ។",
      }, 400);
    }
    const rule = await prisma.botRule.create({
      data: { userId, ...validated.data, enabled: true },
    });
    return c.json({ success: true, rule }, 201);
  } catch (error) {
    console.error("Hono bot rule creation failed:", error);
    return c.json({ success: false, message: "Failed to add rule" }, 500);
  }
});

bot.put("/rules/:id", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "A valid JSON body is required" }, 400);
  }
  const validated = validateRule(body, true);
  if (validated.error) return c.json({ success: false, message: validated.error }, 400);

  try {
    const prisma = getPrisma(c.env);
    const userId = c.get("authUser").id;
    const id = c.req.param("id");
    const rule = await prisma.botRule.findFirst({
      where: { id, userId },
      select: {
        id: true,
        keyword: true,
        reply: true,
        ruleType: true,
        scope: true,
        postId: true,
        attachmentUrl: true,
      },
    });
    if (!rule) return c.json({ success: false, message: "Rule not found" }, 404);
    const updatedData = { ...rule, ...validated.data };
    if (updatedData.scope === "ALL") updatedData.postId = null;
    const mergedValidation = validateRule(updatedData, false);
    if (mergedValidation.error) {
      return c.json({ success: false, message: mergedValidation.error }, 400);
    }
    const updatedRule = await prisma.botRule.update({
      where: { id },
      data: mergedValidation.data,
    });
    return c.json({ success: true, message: "Rule updated", rule: updatedRule });
  } catch (error) {
    console.error("Hono bot rule update failed:", error);
    return c.json({ success: false, message: "Failed to update rule" }, 500);
  }
});

bot.patch("/rules/:id", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "A valid JSON body is required" }, 400);
  }
  if (typeof body?.enabled !== "boolean") {
    return c.json({ success: false, message: "Enabled must be a boolean" }, 400);
  }

  try {
    const prisma = getPrisma(c.env);
    const id = c.req.param("id");
    const userId = c.get("authUser").id;
    const result = await prisma.botRule.updateMany({
      where: { id, userId },
      data: { enabled: body.enabled },
    });
    if (!result.count) return c.json({ success: false, message: "Rule not found" }, 404);
    return c.json({ success: true, message: "Rule toggled" });
  } catch (error) {
    console.error("Hono bot rule toggle failed:", error);
    return c.json({ success: false, message: "Failed to toggle rule" }, 500);
  }
});

bot.delete("/rules/:id", requireAuth, async (c) => {
  try {
    const result = await getPrisma(c.env).botRule.deleteMany({
      where: { id: c.req.param("id"), userId: c.get("authUser").id },
    });
    if (!result.count) return c.json({ success: false, message: "Rule not found" }, 404);
    return c.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    console.error("Hono bot rule deletion failed:", error);
    return c.json({ success: false, message: "Failed to delete rule" }, 500);
  }
});

bot.put("/settings", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "A valid JSON body is required" }, 400);
  }
  if (typeof body?.enabled !== "boolean") {
    return c.json({ success: false, message: "Enabled must be a boolean" }, 400);
  }
  try {
    const userId = c.get("authUser").id;
    await getPrisma(c.env).botStatus.upsert({
      where: { userId },
      update: { enabled: body.enabled },
      create: { userId, enabled: body.enabled },
    });
    return c.json({
      success: true,
      message: "Bot settings updated",
      enabled: body.enabled,
    });
  } catch (error) {
    console.error("Hono bot settings update failed:", error);
    return c.json({ success: false, message: "Failed to update bot settings" }, 500);
  }
});

bot.get("/monitored-posts", requireAuth, async (c) => {
  try {
    const posts = await getPrisma(c.env).botMonitoredPost.findMany({
      where: { userId: c.get("authUser").id },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ success: true, posts });
  } catch (error) {
    console.error("Hono monitored posts fetch failed:", error);
    return c.json({ success: false, message: "Server error" }, 500);
  }
});

bot.post("/monitored-posts", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "A valid JSON body is required" }, 400);
  }
  if (typeof body?.url !== "string" || !body.url.trim() ||
      typeof body?.pageId !== "string" || !body.pageId) {
    return c.json({ success: false, message: "URL and Page ID are required" }, 400);
  }
  const matches = body.url.match(/(\d{10,20})/g);
  if (!matches?.length) {
    return c.json({ success: false, message: "Invalid Facebook URL or ID not found" }, 400);
  }

  try {
    const prisma = getPrisma(c.env);
    const userId = c.get("authUser").id;
    const page = await prisma.facebookPage.findFirst({
      where: { id: body.pageId, userId },
      select: { id: true },
    });
    if (!page) return c.json({ success: false, message: "Page not found" }, 404);
    const post = await prisma.botMonitoredPost.upsert({
      where: {
        userId_facebookPostId: {
          userId,
          facebookPostId: matches[matches.length - 1],
        },
      },
      update: { enabled: true, pageId: body.pageId },
      create: {
        userId,
        pageId: body.pageId,
        facebookPostId: matches[matches.length - 1],
        enabled: true,
      },
    });
    return c.json({ success: true, post });
  } catch (error) {
    console.error("Hono monitored post creation failed:", error);
    return c.json({ success: false, message: "Failed to monitor post" }, 500);
  }
});

bot.delete("/monitored-posts/:id", requireAuth, async (c) => {
  try {
    const result = await getPrisma(c.env).botMonitoredPost.deleteMany({
      where: { id: c.req.param("id"), userId: c.get("authUser").id },
    });
    if (!result.count) return c.json({ success: false, message: "Post not found" }, 404);
    return c.json({ success: true, message: "Post removed from monitoring" });
  } catch (error) {
    console.error("Hono monitored post deletion failed:", error);
    return c.json({ success: false, message: "Failed to remove post" }, 500);
  }
});

bot.get("/history", requireAuth, async (c) => {
  try {
    const history = await getPrisma(c.env).botHistory.findMany({
      where: { userId: c.get("authUser").id },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    return c.json({ success: true, history });
  } catch (error) {
    console.error("Hono bot history fetch failed:", error);
    return c.json({ success: false, message: "Server error" }, 500);
  }
});

bot.get("/recent-posts/:pageId", requireAuth, async (c) => {
  try {
    const page = await getPrisma(c.env).facebookPage.findFirst({
      where: { id: c.req.param("pageId"), userId: c.get("authUser").id },
      select: { id: true, accessToken: true },
    });
    if (!page?.accessToken) {
      return c.json({ success: false, message: "Page not found or not connected" }, 404);
    }
    const accessToken = await decryptFacebookToken(page.accessToken, c.env);
    const posts = await fetchRecentFacebookPosts(page.id, accessToken);
    return c.json({ success: true, posts });
  } catch (error) {
    console.error("Hono recent Facebook posts fetch failed:", error);
    return c.json({
      success: false,
      message: "Failed to fetch recent posts from Facebook",
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

export function validateRule(body, partial) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Rule data is required" };
  }
  const data = {};
  const fields = ["keyword", "reply", "ruleType", "scope", "postId", "attachmentUrl"];
  for (const field of fields) {
    const hasField = Object.hasOwn(body, field);
    if (partial && !hasField) continue;
    const value = body[field];
    if (!hasField) {
      if (field === "keyword") {
        data.keyword = "*";
        continue;
      }
      if (field === "ruleType") {
        data.ruleType = "KEYWORD";
        continue;
      }
      if (field === "scope") {
        data.scope = "ALL";
        continue;
      }
      if (field === "reply") return { error: "Reply is required" };
      if (["postId", "attachmentUrl"].includes(field)) continue;
    }
    if (["postId", "attachmentUrl"].includes(field) && value === null) {
      data[field] = null;
      continue;
    }
    if (typeof value !== "string") {
      return { error: `${field} must be a string` };
    }
    data[field] = value;
  }

  if (!partial && (!data.reply || !data.reply.trim())) {
    return { error: "Reply is required" };
  }
  if (partial && Object.hasOwn(data, "reply") && !data.reply.trim()) {
    return { error: "Reply is required" };
  }
  if (data.ruleType && !ruleTypes.has(data.ruleType)) {
    return { error: "Rule type is invalid" };
  }
  if (data.scope && !ruleScopes.has(data.scope)) {
    return { error: "Rule scope is invalid" };
  }
  if (data.scope === "SPECIFIC" &&
      (!partial || Object.hasOwn(data, "postId")) &&
      !((data.postId ?? body.postId ?? "").trim())) {
    return { error: "Post ID is required for Specific Post scope" };
  }
  if ((data.ruleType === "REGEX" || (!partial && body.ruleType === "REGEX")) &&
      Object.hasOwn(data, "keyword")) {
    try {
      new RegExp(data.keyword || "*");
    } catch {
      return { error: "Invalid Regular Expression pattern" };
    }
  }
  if (Object.hasOwn(data, "keyword") && !data.keyword.trim()) data.keyword = "*";
  if (Object.hasOwn(data, "postId") && data.postId === "") data.postId = null;
  if (Object.hasOwn(data, "attachmentUrl") && data.attachmentUrl === "") data.attachmentUrl = null;
  return { data };
}

function parsePageSettings(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      console.warn("Ignoring malformed bot page settings:", error);
      return [];
    }
  }
  return Array.isArray(value)
    ? value.filter((setting) => setting && typeof setting === "object" && !Array.isArray(setting))
    : [];
}

export default bot;
