import { decryptFacebookToken, publishFacebookPost } from "./facebook.js";
import { getPrisma } from "./prisma.js";

const batchSize = 5;
const maxAttempts = 3;
const processingTimeoutMs = 10 * 60 * 1000;
const retryDelayMs = 5 * 60 * 1000;
const expiryAgeMs = 48 * 60 * 60 * 1000;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isNonRetryableFacebookError(message) {
  return /FB #(1|10|190|200|368|459)\b|Error validating access token|session has been invalidated|Invalid request\.|checkpoint|temporarily blocked|action blocked|spam|missing valid facebook access token|ផេកនេះមិនទាន់មាន Facebook Access Token/i.test(
    String(message || "")
  );
}

function isSecurityPauseError(message) {
  return /FB #(190|368|459)\b|Error validating access token|session has been invalidated|checkpoint|temporarily blocked|action blocked|spam/i.test(
    String(message || "")
  );
}

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

export async function processScheduledPostById(env, postId, prismaOverride) {
  const prisma = prismaOverride ?? getPrisma(env);
  const post = await prisma.scheduledPost.findUnique({ where: { id: postId } });
  if (!post || (post.status !== "scheduled" && post.status !== "processing")) {
    return null;
  }
  await processOneScheduledPost(prisma, post, env);
  return prisma.scheduledPost.findUnique({
    where: { id: postId },
    select: { status: true, lastError: true, publishedIds: true },
  });
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
    let isFirstAccount = true;
    for (const pageId of accountIds) {
      if (alreadyPublished.has(pageId)) continue;
      if (!isFirstAccount) {
        await pause(800);
      }
      isFirstAccount = false;
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
        const facebookPostId = await publishFacebookPost(page.id, pageToken, post, page, env);
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
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error("Scheduled Facebook publish failed:", post.id, page.id, errMessage);
        failures.push({ accountId: page.id, error: errMessage });
        if (isSecurityPauseError(errMessage)) {
          // Pause auto-scheduling on flagged/invalidated pages so subsequent cron runs do not trigger a ban
          try {
            await prisma.facebookPage.update?.({
              where: { id: page.id },
              data: { enableSchedule: false },
            });
          } catch (pauseErr) {
            console.warn("Could not auto-pause flagged Facebook page:", page.id, pauseErr);
          }
        }
      }
    }
  } catch (error) {
    console.error("Scheduled post processing failed:", post.id, error);
    failures.push({ error: error.message });
  }

  const attempts = (post.attempts || 0) + 1;
  const hasNonRetryableFailure = failures.some((f) => isNonRetryableFacebookError(f?.error));
  const status = failures.length === 0
    ? "published"
    : hasNonRetryableFailure || attempts >= maxAttempts
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
