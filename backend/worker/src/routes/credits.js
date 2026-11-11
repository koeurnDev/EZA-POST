import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";

const credits = new Hono();

credits.get("/", requireAuth, async (c) => {
  try {
    const user = await getPrisma(c.env).user.findUnique({
      where: { id: c.get("authUser").id },
      select: {
        credits: true,
        totalCreditsSpent: true,
        totalCreditsPurchased: true,
      },
    });
    if (!user) return c.json({ success: false, error: "User not found" }, 404);
    return c.json({
      success: true,
      credits: user.credits || 0,
      totalSpent: user.totalCreditsSpent || 0,
      totalPurchased: user.totalCreditsPurchased || 0,
    });
  } catch (error) {
    console.error("Hono credit balance fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch credits" }, 500);
  }
});

credits.get("/packages", async (c) => {
  try {
    const packages = await getPrisma(c.env).creditPackage.findMany({
      where: { active: true },
      orderBy: { credits: "asc" },
    });
    return c.json({ success: true, packages });
  } catch (error) {
    console.error("Hono credit packages fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch credit packages" }, 500);
  }
});

credits.get("/transactions", requireAuth, async (c) => {
  const rawLimit = c.req.query("limit");
  const { limit, error } = parseCreditTransactionLimit(rawLimit);
  if (error) {
    return c.json({ success: false, error: "Limit must be a positive integer" }, 400);
  }

  try {
    const transactions = await getPrisma(c.env).creditTransaction.findMany({
      where: { userId: c.get("authUser").id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return c.json({ success: true, transactions });
  } catch (error) {
    console.error("Hono credit transactions fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch credit transactions" }, 500);
  }
});

export function parseCreditTransactionLimit(rawLimit) {
  const parsedLimit = rawLimit === undefined ? 50 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return { error: true };
  }
  return { limit: Math.min(parsedLimit, 100), error: false };
}

export default credits;
