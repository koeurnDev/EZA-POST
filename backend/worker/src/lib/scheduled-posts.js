import { decryptFacebookToken, publishFacebookPost } from "./facebook.js";
import { getPrisma } from "./prisma.js";

const batchSize = 5;
const maxAttempts = 3;
const processingTimeoutMs = 10 * 60 * 1000;
const retryDelayMs = 5 * 60 * 1000;
const expiryAgeMs = 48 * 60 * 60 * 1000;

export async function processScheduledPosts(env, prismaOverride) {
  const prisma = prismaOverride ?? getPrisma(env);
  const now = new Date();
  const staleProcessingBefore = new Date(now.getTime() - processingTimeoutMs);
  const expirationBefore = new Date(now.getTime() - expiryAgeMs);

  await prisma.scheduledPost.updateMany({
    where: {
      status: "scheduled",
      scheduleTime: { lt: expirationBefore },
    },
    data: { status: "expired" },
  });

  const duePosts = await prisma.scheduledPost.findMany({
    where: {
      scheduleTime: { lte: now },
      OR: [
        { status: "scheduled" },
        { status: "processing", updatedAt: { lt: staleProcessingBefore } },
      ],
    },
    orderBy: { scheduleTime: "asc" },
    take: batchSize,
  });

  for (const post of duePosts) {
    await processOneScheduledPost(prisma, post, env);
  }
}

async function processOneScheduledPost(prisma, post, env) {
  const claimed = await prisma.scheduledPost.updateMany({
    where: {
      id: post.id,
      status: post.status,
      ...(post.status === "processing"
        ? { updatedAt: { lt: new Date(Date.now() - processingTimeoutMs) } }
        : {}),
    },
    data: { status: "processing" },
  });
  if (!claimed.count) return;

  const published = Array.isArray(post.publishedIds)
    ? post.publishedIds.filter(
        (item) => item && typeof item.accountId === "string" && typeof item.postId === "string"
      )
    : [];
  const alreadyPublished = new Set(published.map((item) => item.accountId));
  const failures = [];
  const accountIds = Array.isArray(post.accounts)
    ? [...new Set(post.accounts.filter((id) => typeof id === "string"))]
    : [];

  try {
    if (!accountIds.length) throw new Error("Scheduled post has no Facebook pages.");

    const pages = await prisma.facebookPage.findMany({
      where: { userId: post.userId, id: { in: accountIds }, isConnected: true },
    });
    const pageMap = new Map(pages.map((page) => [page.id, page]));
    for (const pageId of accountIds) {
      if (alreadyPublished.has(pageId)) continue;
      const page = pageMap.get(pageId);
      if (!page) {
        failures.push({ accountId: pageId, error: "Facebook page not found or disconnected." });
        continue;
      }
      if (!page.enableSchedule) {
        failures.push({ accountId: pageId, error: "Scheduled posting is disabled for this page." });
        continue;
      }

      try {
        if (!page.accessToken) throw new Error("Facebook page access token is missing.");
        const pageToken = await decryptFacebookToken(page.accessToken, env);
        const facebookPostId = await publishFacebookPost(page.id, pageToken, post, page);
        published.push({ accountId: page.id, postId: facebookPostId });
        try {
          await prisma.postLog.create({
            data: {
              userId: post.userId,
              pageId: page.id,
              fbPostId: facebookPostId,
              type: post.postType,
              scheduledTime: post.scheduleTime,
            },
          });
        } catch (error) {
          console.error("Could not record published post log:", post.id, page.id, error);
        }
      } catch (error) {
        console.error("Scheduled Facebook publish failed:", post.id, page.id, error);
        failures.push({ accountId: page.id, error: error.message });
      }
    }
  } catch (error) {
    console.error("Scheduled post processing failed:", post.id, error);
    failures.push({ error: error.message });
  }

  const attempts = post.attempts + 1;
  const status = failures.length === 0
    ? "published"
    : attempts >= maxAttempts
      ? "failed"
      : "scheduled";
  const updatedAt = new Date();
  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: {
      status,
      attempts,
      scheduleTime: status === "scheduled"
        ? new Date(updatedAt.getTime() + retryDelayMs)
        : post.scheduleTime,
      postedAt: status === "published" ? updatedAt : null,
      publishedIds: published,
      lastError: failures.length ? failures : null,
    },
  });
}
