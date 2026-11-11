import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";

const analytics = new Hono();

analytics.get("/", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const prisma = getPrisma(c.env);
    const [posts, metrics] = await Promise.all([
      prisma.scheduledPost.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "asc" },
        select: { status: true, createdAt: true, accounts: true },
      }),
      prisma.postMetrics.aggregate({
        where: { userId },
        _sum: { reach: true, likes: true, shares: true },
      }),
    ]);

    const engagement = {
      views: metrics._sum.reach || 0,
      likes: metrics._sum.likes || 0,
      shares: metrics._sum.shares || 0,
    };
    return c.json({
      success: true,
      stats: buildAnalyticsStats(posts, engagement),
    });
  } catch (error) {
    console.error("Hono analytics fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch analytics" }, 500);
  }
});

export function buildAnalyticsStats(posts, engagement) {
  let successful = 0;
  let failed = 0;
  let scheduled = 0;
  const platformCounts = { facebook: 0, youtube: 0, tiktok: 0, instagram: 0 };
  const dailyActivity = new Map();

  for (const post of posts) {
    if (post.status === "published") successful++;
    else if (post.status === "failed") failed++;
    else if (post.status === "scheduled") scheduled++;

    if (parseJsonArray(post.accounts).length) platformCounts.facebook++;

    const createdDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt || Date.now());
    const dateKey = !Number.isNaN(createdDate.getTime())
      ? createdDate.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    dailyActivity.set(dateKey, (dailyActivity.get(dateKey) || 0) + 1);
  }

  return {
    total: posts.length,
    successful,
    failed,
    scheduled,
    platforms: platformCounts,
    chartData: [...dailyActivity].map(([date, count]) => ({ date, posts: count })),
    engagement,
    bestTimes: [
      { day: "Mon", time: "10:00 AM" },
      { day: "Wed", time: "02:00 PM" },
      { day: "Fri", time: "07:00 PM" },
      { day: "Sun", time: "09:00 PM" },
    ],
  };
}

function parseJsonArray(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      console.warn("Ignoring malformed post accounts in analytics:", error);
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

export default analytics;
