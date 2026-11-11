import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { deleteScheduledMedia, scheduledUploadLimitBytes, uploadScheduledMedia } from "../lib/cloudinary.js";
import { getPrisma } from "../lib/prisma.js";
import { proxyRequestToBackend, proxyToBackend } from "../lib/proxy.js";

const posts = new Hono();

posts.post("/", requireAuth, async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  let payload;
  let uploadedMedia = [];
  try {
    if (contentType.toLowerCase().startsWith("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("video");
      if (file && !(file instanceof File)) {
        return c.json({ success: false, error: "Video upload must be a file." }, 400);
      }
      const thumbnail = form.get("thumbnail");
      if (thumbnail && !(thumbnail instanceof File)) {
        return c.json({ success: false, error: "Thumbnail upload must be a file." }, 400);
      }
      payload = {
        caption: form.get("caption"),
        accounts: form.get("accounts"),
        scheduleTime: form.get("scheduleTime"),
        videoUrl: form.get("videoUrl"),
        postType: form.get("postType"),
        videoFile: file,
        thumbnailFile: thumbnail,
      };
    } else {
      payload = await c.req.json();
    }
  } catch {
    return c.json({ success: false, error: "A valid JSON or multipart body is required" }, 400);
  }

  const caption = payload?.caption ?? "";
  if (typeof caption !== "string") {
    return c.json({ success: false, error: "Caption must be a string." }, 400);
  }
  let accounts;
  try {
    accounts = typeof payload.accounts === "string"
      ? JSON.parse(payload.accounts)
      : payload.accounts;
  } catch {
    return c.json({ success: false, error: "Invalid accounts format." }, 400);
  }
  if (!Array.isArray(accounts) || !accounts.length ||
      accounts.some((account) => typeof account !== "string" || !account)) {
    return c.json({ success: false, error: "Select at least one Facebook Page." }, 400);
  }

  const scheduleTime = payload.scheduleTime
    ? new Date(payload.scheduleTime)
    : new Date();
  if (Number.isNaN(scheduleTime.getTime()) || scheduleTime < new Date()) {
    return c.json({ success: false, error: "Invalid or past schedule time." }, 400);
  }

  const videoUrl = typeof payload.videoUrl === "string" ? payload.videoUrl.trim() : "";
  const videoFile = payload.videoFile;
  if (videoFile && !videoFile.size) {
    return c.json({ success: false, error: "Video file cannot be empty." }, 400);
  }
  if (payload.thumbnailFile && !payload.thumbnailFile.size) {
    return c.json({ success: false, error: "Thumbnail file cannot be empty." }, 400);
  }
  if (videoFile && !isSupportedPostMedia(videoFile)) {
    return c.json({ success: false, error: "Unsupported video or image file type." }, 400);
  }
  if (videoFile && videoUrl) {
    return c.json({ success: false, error: "Provide either a video file or a video URL, not both." }, 400);
  }
  if (!videoFile && videoUrl && !isCloudinaryMediaUrl(videoUrl)) {
    return c.json({ success: false, error: "Video URL must reference an HTTPS media asset." }, 400);
  }

  let requestedPostType = payload.postType;
  if (requestedPostType === "single") {
    requestedPostType = videoFile?.type?.startsWith("image/") || videoUrl.includes("image") ? "image" : "video";
  } else if (requestedPostType === undefined || requestedPostType === null || requestedPostType === "") {
    requestedPostType = videoFile?.type?.startsWith("image/") ||
      videoUrl.includes("/image/upload/") ? "image" : "video";
  }
  if (!["video", "image"].includes(requestedPostType)) {
    return c.json({ success: false, error: "Only single video and image posts are supported on this route." }, 400);
  }
  if (videoFile && requestedPostType === "video" && !videoFile.type.startsWith("video/")) {
    return c.json({ success: false, error: "Video posts require a video file." }, 400);
  }
  if (videoFile && requestedPostType === "image" && !videoFile.type.startsWith("image/")) {
    return c.json({ success: false, error: "Image posts require an image file." }, 400);
  }
  if (videoUrl) {
    const expectedResourceType = requestedPostType === "image" ? "image" : "video";
    if (!isCloudinaryMediaUrl(videoUrl, expectedResourceType)) {
      return c.json({
        success: false,
        error: `The selected post type requires a valid ${expectedResourceType} URL.`,
      }, 400);
    }
  }
  if (!videoFile && !videoUrl && !caption.trim()) {
    return c.json({ success: false, error: "Provide a caption or media." }, 400);
  }
  if (payload.thumbnailFile && !["image/jpeg", "image/png", "image/webp"].includes(payload.thumbnailFile.type)) {
    return c.json({ success: false, error: "Thumbnail must be a JPG, PNG, or WEBP image." }, 400);
  }
  if (payload.thumbnailFile?.size > 5 * 1024 * 1024) {
    return c.json({ success: false, error: "Thumbnail exceeds the 5 MiB limit." }, 413);
  }

  try {
    const prisma = getPrisma(c.env);
    const userId = c.get("authUser").id;
    const pages = await prisma.facebookPage.findMany({
      where: { userId, id: { in: [...new Set(accounts)] }, isConnected: true },
      select: { id: true },
    });
    if (pages.length !== new Set(accounts).size) {
      return c.json({ success: false, error: "One or more selected Facebook Pages are unavailable." }, 400);
    }

    let uploadedVideoUrl = videoUrl || null;
    if (videoFile) {
      const asset = await uploadScheduledMedia(videoFile, c.env);
      uploadedMedia.push(asset);
      uploadedVideoUrl = asset.url;
    }
    let thumbnailUrl = null;
    if (payload.thumbnailFile) {
      const asset = await uploadScheduledMedia(payload.thumbnailFile, c.env);
      uploadedMedia.push(asset);
      thumbnailUrl = asset.url;
    }

    const mediaFiles = uploadedVideoUrl ? [uploadedVideoUrl] : [];
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        userId,
        caption,
        postType: mediaFiles.length ? requestedPostType : "video",
        videoUrl: uploadedVideoUrl,
        thumbnailUrl,
        mediaFiles,
        accounts: [...new Set(accounts)],
        scheduleTime,
        status: "scheduled",
        publishedIds: [],
      },
    });

    return c.json({
      success: true,
      message: scheduleTime.getTime() <= Date.now() + 5000
        ? "Post added to the publishing queue."
        : "Post scheduled successfully!",
      jobId: scheduledPost.id,
      data: {
        postId: scheduledPost.id,
        caption,
        postType: scheduledPost.postType,
        mediaFiles,
        accounts: [...new Set(accounts)],
        scheduleTime,
      },
    }, 202);
  } catch (error) {
    console.error("Hono post creation failed:", error);
    const cleanup = await Promise.allSettled(
      uploadedMedia.map((asset) => deleteScheduledMedia(asset, c.env))
    );
    for (const result of cleanup) {
      if (result.status === "rejected") console.error("Post media cleanup failed:", result.reason);
    }
    return c.json({ success: false, error: "Failed to queue post." }, 500);
  }
});

posts.post("/mixed-carousel", requireAuth, async (c) => {
  const originalRequest = c.req.raw.clone();
  let form;
  try {
    form = await c.req.formData();
  } catch (error) {
    console.error("Invalid mixed-carousel multipart body:", error);
    return c.json({ success: false, error: "Invalid multipart form data." }, 400);
  }

  const allowedFields = new Set([
    "caption", "accounts", "scheduleTime", "enableBot", "videoUrl",
    "carouselCards", "aiOptions", "platforms", "staggerDelay",
    "video", "thumbnail", "rightSideImage",
  ]);
  if ([...form.keys()].some((key) => !allowedFields.has(key))) {
    return c.json({ success: false, error: "Unexpected mixed-carousel field." }, 400);
  }
  const aiOptionsValue = form.get("aiOptions");
  if (typeof aiOptionsValue === "string" && aiOptionsValue) {
    let aiOptions;
    try {
      aiOptions = JSON.parse(aiOptionsValue);
    } catch {
      return c.json({ success: false, error: "Invalid AI transformation options." }, 400);
    }
    if (aiOptions && ["flip", "pitchShift", "safeMode", "noise", "speedChange", "squarePad"]
      .some((option) => aiOptions[option] === true)) {
      return proxyRequestToBackend(c, originalRequest);
    }
  }

  const caption = form.get("caption") ?? "";
  if (typeof caption !== "string") {
    return c.json({ success: false, error: "Caption must be a string." }, 400);
  }
  let accounts;
  let cards;
  try {
    accounts = JSON.parse(form.get("accounts") ?? "");
    cards = JSON.parse(form.get("carouselCards") ?? "");
  } catch {
    return c.json({ success: false, error: "Invalid accounts or carousel cards." }, 400);
  }
  if (!Array.isArray(accounts) || !accounts.length ||
      accounts.some((id) => typeof id !== "string" || !id)) {
    return c.json({ success: false, error: "Select at least one Facebook Page." }, 400);
  }
  if (!Array.isArray(cards) || cards.length < 2 || cards.length > 10 ||
      cards.some((card) =>
        !card || typeof card !== "object" || Array.isArray(card) ||
        typeof card.id !== "string" || !["video", "image"].includes(card.type)
      )) {
    return c.json({ success: false, error: "Carousel requires 2 to 10 valid cards." }, 400);
  }
  const supportedCallsToAction = new Set([
    "", "NO_BUTTON", "FOLLOW", "LEARN_MORE", "SEND_MESSAGE",
    "SIGN_UP", "BOOK_NOW", "SHOP_NOW",
  ]);
  if (cards.some(
    (card) => card.cta !== undefined && !supportedCallsToAction.has(card.cta)
  )) {
    return c.json({ success: false, error: "Carousel contains an unsupported call to action." }, 400);
  }

  const videoFile = form.get("video");
  const thumbnailFile = form.get("thumbnail");
  const rightSideImage = form.get("rightSideImage");
  for (const [name, file] of [
    ["video", videoFile],
    ["thumbnail", thumbnailFile],
    ["rightSideImage", rightSideImage],
  ]) {
    if (file !== null && !(file instanceof File)) {
      return c.json({ success: false, error: `${name} must be a file.` }, 400);
    }
  }
  if ([videoFile, thumbnailFile, rightSideImage].some(
    (file) => file instanceof File && !isSupportedPostMedia(file)
  )) {
    return c.json({ success: false, error: "Unsupported carousel media file type." }, 400);
  }
  if ([videoFile, thumbnailFile, rightSideImage].some(
    (file) => file instanceof File && file.size === 0
  )) {
    return c.json({ success: false, error: "Carousel media files cannot be empty." }, 400);
  }
  if (thumbnailFile?.size > 5 * 1024 * 1024) {
    return c.json({ success: false, error: "Thumbnail exceeds the 5 MiB limit." }, 413);
  }
  if (videoFile && !videoFile.type.startsWith("video/") ||
      rightSideImage && !rightSideImage.type.startsWith("image/") ||
      thumbnailFile && !thumbnailFile.type.startsWith("image/")) {
    return c.json({ success: false, error: "Carousel media file types are invalid." }, 400);
  }
  const totalBytes = [videoFile, thumbnailFile, rightSideImage]
    .filter((file) => file instanceof File)
    .reduce((total, file) => total + file.size, 0);
  if (totalBytes > scheduledUploadLimitBytes) {
    return c.json({ success: false, error: "Total carousel media must not exceed 90 MiB." }, 413);
  }

  const externalVideoUrl = form.get("videoUrl");
  if (typeof externalVideoUrl === "string" && externalVideoUrl &&
      !isCloudinaryMediaUrl(externalVideoUrl, "video")) {
    return c.json({ success: false, error: "Video URL must be a valid HTTPS asset." }, 400);
  }
  if (!videoFile && !externalVideoUrl) {
    return c.json({ success: false, error: "A video file or media URL is required." }, 400);
  }

  const scheduleTimeValue = form.get("scheduleTime");
  const scheduleTime = scheduleTimeValue ? new Date(scheduleTimeValue) : new Date();
  if (Number.isNaN(scheduleTime.getTime()) || scheduleTime < new Date()) {
    return c.json({ success: false, error: "Invalid or past schedule time." }, 400);
  }

  const uniqueAccounts = [...new Set(accounts)];
  const deduplicatedCards = [...new Map(cards.map((card) => [card.id, card])).values()]
    .filter((card) => !(card.id === "right-side-image" && !rightSideImage && !card.imageUrl));
  if (deduplicatedCards.length < 2) {
    return c.json({ success: false, error: "Carousel requires at least two unique cards." }, 400);
  }
  const uploadedMedia = [];
  try {
    const prisma = getPrisma(c.env);
    const userId = c.get("authUser").id;
    const pages = await prisma.facebookPage.findMany({
      where: { userId, id: { in: uniqueAccounts }, isConnected: true },
      select: { id: true, picture: true },
    });
    if (pages.length !== uniqueAccounts.length) {
      return c.json({ success: false, error: "One or more selected Facebook Pages are unavailable." }, 400);
    }

    const videoAsset = videoFile ? await uploadScheduledMedia(videoFile, c.env) : null;
    if (videoAsset) uploadedMedia.push(videoAsset);
    const imageAsset = rightSideImage ? await uploadScheduledMedia(rightSideImage, c.env) : null;
    if (imageAsset) uploadedMedia.push(imageAsset);
    const thumbnailAsset = thumbnailFile ? await uploadScheduledMedia(thumbnailFile, c.env) : null;
    if (thumbnailAsset) uploadedMedia.push(thumbnailAsset);
    const mainVideoUrl = videoAsset?.url ?? externalVideoUrl;

    const carouselCards = deduplicatedCards.map((card) => {
      let mediaUrl = null;
      if (card.id === "video-main") {
        mediaUrl = mainVideoUrl;
      } else if (card.id === "right-side-image") {
        mediaUrl = imageAsset?.url ?? null;
      } else if (!card.isPageCard && typeof card.imageUrl === "string") {
        if (!isCloudinaryMediaUrl(card.imageUrl, "image")) {
          throw new Error("Carousel image cards must use valid HTTPS image URLs.");
        }
        mediaUrl = card.imageUrl;
      }
      if (!card.isPageCard && !mediaUrl) {
        throw new Error(`Carousel card ${card.id} has no media.`);
      }
      return {
        id: card.id,
        type: card.type,
        mediaUrl,
        isPageCard: card.isPageCard === true,
        headline: typeof card.headline === "string" ? card.headline : "",
        description: typeof card.description === "string" ? card.description : "",
        link: typeof card.link === "string" ? card.link : "",
        cta: typeof card.cta === "string" ? card.cta : "",
      };
    });

    if (form.get("enableBot") === "true") {
      await prisma.facebookPage.updateMany({
        where: { userId, id: { in: uniqueAccounts } },
        data: { enableBot: true },
      });
    }
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        userId,
        caption,
        postType: "carousel",
        videoUrl: mainVideoUrl,
        thumbnailUrl: thumbnailAsset?.url ?? null,
        mediaFiles: uploadedMedia.map((asset) => asset.url),
        carouselCards,
        accounts: uniqueAccounts,
        scheduleTime,
        status: "scheduled",
        publishedIds: [],
      },
    });

    return c.json({
      success: true,
      message: scheduleTime.getTime() <= Date.now() + 5000
        ? "Post added to queue for processing."
        : "Post scheduled successfully!",
      jobId: scheduledPost.id,
    }, 202);
  } catch (error) {
    console.error("Hono mixed-carousel creation failed:", error);
    const cleanup = await Promise.allSettled(
      uploadedMedia.map((asset) => deleteScheduledMedia(asset, c.env))
    );
    for (const result of cleanup) {
      if (result.status === "rejected") console.error("Carousel media cleanup failed:", result.reason);
    }
    return c.json({ success: false, error: "Failed to queue carousel post." }, 500);
  }
});

posts.get("/queue", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const [user, scheduledPosts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { facebookPages: true },
      }),
      prisma.scheduledPost.findMany({
        where: {
          userId,
          status: { in: ["scheduled", "processing", "expired"] },
        },
        orderBy: { scheduleTime: "asc" },
      }),
    ]);

    const pageMap = Object.fromEntries(
      (user?.facebookPages ?? []).map((page) => [
        page.id,
        { name: page.name, picture: page.picture },
      ])
    );
    const formattedPosts = scheduledPosts.map((post) => ({
      id: post.id,
      _id: post.id,
      caption: post.caption,
      videoUrl: post.videoUrl,
      thumbnailUrl: post.thumbnailUrl,
      scheduleTime: post.scheduleTime,
      status: post.status,
      accounts: (post.accounts ?? []).map((accountId) => ({
        id: accountId,
        name: pageMap[accountId]?.name ?? "Unknown Page",
        picture: pageMap[accountId]?.picture ?? null,
      })),
      createdAt: post.createdAt,
    }));

    return c.json({
      success: true,
      total: formattedPosts.length,
      posts: formattedPosts,
    });
  } catch (error) {
    console.error("Hono queue fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch queue" }, 500);
  }
});

posts.delete("/queue/:id", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const id = c.req.param("id");
    const prisma = getPrisma(c.env);
    const post = await prisma.scheduledPost.findUnique({ where: { id } });

    if (!post || post.userId !== userId) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    const cancelledPost = await prisma.scheduledPost.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return c.json({
      success: true,
      message: "Post cancelled successfully",
      cancelledPost,
    });
  } catch (error) {
    console.error("Hono post cancellation failed:", error);
    return c.json({ success: false, error: "Failed to cancel post" }, 500);
  }
});

posts.post("/bulk", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const submittedPosts = body?.posts;
  if (!Array.isArray(submittedPosts) || submittedPosts.length === 0) {
    return c.json({ success: false, error: "No posts provided" }, 400);
  }
  if (submittedPosts.length > 50) {
    return c.json({
      success: false,
      error: "បងអាចបង្ហោះ Bulk បានច្រើនបំផុតត្រឹម ៥០ ផុសប៉ុណ្ណោះក្នុងម្តង។",
    }, 400);
  }
  if (submittedPosts.some((post) => !post || typeof post !== "object" || Array.isArray(post))) {
    return c.json({ success: false, error: "Each post must be an object" }, 400);
  }

  const now = new Date();
  const postsToInsert = [];
  for (const post of submittedPosts) {
    if (post.caption !== undefined && typeof post.caption !== "string") {
      return c.json({ success: false, error: "Post caption must be a string" }, 400);
    }
    if (post.videoUrl !== undefined && post.videoUrl !== null && typeof post.videoUrl !== "string") {
      return c.json({ success: false, error: "Post videoUrl must be a string" }, 400);
    }
    if (post.accounts !== undefined && !Array.isArray(post.accounts)) {
      return c.json({ success: false, error: "Post accounts must be an array" }, 400);
    }
    if ((post.accounts ?? []).some((account) => typeof account !== "string" || !account)) {
      return c.json({ success: false, error: "Post accounts must contain page IDs" }, 400);
    }
    if (post.scheduleTime !== undefined && post.scheduleTime !== null && typeof post.scheduleTime !== "string") {
      return c.json({ success: false, error: "Post scheduleTime must be a date string" }, 400);
    }

    const scheduleTime = post.scheduleTime ? new Date(post.scheduleTime) : now;
    if (Number.isNaN(scheduleTime.getTime())) {
      return c.json({ success: false, error: "Post scheduleTime is invalid" }, 400);
    }

    const postType = post.postType ?? "video";
    if (!["video", "image", "carousel"].includes(postType)) {
      return c.json({ success: false, error: "Post postType is invalid" }, 400);
    }

    postsToInsert.push({
      userId: c.get("authUser").id,
      caption: post.caption || "",
      videoUrl: post.videoUrl || null,
      accounts: post.accounts ?? [],
      scheduleTime,
      status: post.scheduleTime ? "scheduled" : "draft",
      postType,
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    const prisma = getPrisma(c.env);
    const pageIds = [...new Set(postsToInsert.flatMap((post) => post.accounts))];
    if (pageIds.length) {
      const pages = await prisma.facebookPage.findMany({
        where: {
          userId: c.get("authUser").id,
          id: { in: pageIds },
          isConnected: true,
        },
        select: { id: true },
      });
      if (pages.length !== pageIds.length) {
        return c.json({ success: false, error: "One or more Facebook Pages are unavailable." }, 400);
      }
    }
    const result = await prisma.scheduledPost.createMany({ data: postsToInsert });
    return c.json({
      success: true,
      message: `Successfully created ${result.count} scheduled posts.`,
      count: result.count,
    }, 201);
  } catch (error) {
    console.error("Hono bulk post creation failed:", error);
    return c.json({
      success: false,
      error: "Failed to create posts",
      details: error.message,
    }, 500);
  }
});

posts.post("/schedule", requireAuth, async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return c.json({ success: false, error: "Scheduled posts require multipart/form-data" }, 400);
  }

  let form;
  try {
    form = await c.req.formData();
  } catch (error) {
    console.warn("Invalid scheduled-post multipart body:", error);
    return c.json({ success: false, error: "Invalid multipart form data" }, 400);
  }

  const caption = form.get("caption");
  const accountsValue = form.get("accounts");
  const scheduleTimeValue = form.get("scheduleTime");
  const postTypeValue = form.get("postType");
  const files = form.getAll("mediaFiles");
  const allowedFields = new Set(["caption", "accounts", "scheduleTime", "postType", "mediaFiles"]);

  if ([...form.keys()].some((key) => !allowedFields.has(key))) {
    return c.json({ success: false, error: "Unexpected scheduled-post field" }, 400);
  }
  if (typeof caption !== "string" || !caption ||
      typeof accountsValue !== "string" || !accountsValue ||
      typeof scheduleTimeValue !== "string" || !scheduleTimeValue) {
    return c.json({ success: false, error: "Missing required fields" }, 400);
  }
  if (files.length === 0 || files.length > 10 || files.some((file) => !(file instanceof File))) {
    return c.json({ success: false, error: "Provide between 1 and 10 media files" }, 400);
  }
  if (files.some((file) => !isSupportedPostMedia(file) || file.size === 0)) {
    return c.json({ success: false, error: "Media file type is unsupported or empty." }, 400);
  }
  if (files.reduce((total, file) => total + file.size, 0) > scheduledUploadLimitBytes) {
    return c.json({ success: false, error: "Total scheduled media must not exceed 90 MiB" }, 413);
  }

  const scheduleTime = new Date(scheduleTimeValue);
  if (Number.isNaN(scheduleTime.getTime()) || scheduleTime < new Date()) {
    return c.json({ success: false, error: "Invalid or past schedule time" }, 400);
  }

  let accounts;
  try {
    accounts = JSON.parse(accountsValue);
  } catch {
    return c.json({ success: false, error: "Invalid accounts format" }, 400);
  }
  if (!Array.isArray(accounts) || accounts.some((account) => typeof account !== "string")) {
    return c.json({ success: false, error: "Accounts must be an array of page IDs" }, 400);
  }
  if (accounts.length === 0) {
    return c.json({ success: false, error: "Select at least one Facebook Page." }, 400);
  }

  const requestedPostType = postTypeValue === null || postTypeValue === "" ? "single" : postTypeValue;
  if (typeof requestedPostType !== "string" ||
      !["single", "video", "image", "carousel"].includes(requestedPostType)) {
    return c.json({ success: false, error: "Invalid post type" }, 400);
  }
  const postType = requestedPostType === "single" ? "video" : requestedPostType;
  if (postType === "video" && (files.length !== 1 || !files[0].type.startsWith("video/"))) {
    return c.json({ success: false, error: "Video posts require exactly one video file." }, 400);
  }
  if (postType === "image" && (files.length !== 1 || !files[0].type.startsWith("image/"))) {
    return c.json({ success: false, error: "Image posts require exactly one image file." }, 400);
  }
  if (postType === "carousel" &&
      (files.length < 2 || files.some((file) => !file.type.startsWith("image/")))) {
    return c.json({ success: false, error: "Photo carousels require 2 to 10 images." }, 400);
  }
  const uploadedMedia = [];

  try {
    const pages = await getPrisma(c.env).facebookPage.findMany({
      where: {
        userId: c.get("authUser").id,
        id: { in: [...new Set(accounts)] },
        isConnected: true,
      },
      select: { id: true },
    });
    if (pages.length !== new Set(accounts).size) {
      return c.json({ success: false, error: "One or more selected Facebook Pages are unavailable." }, 400);
    }
    for (const file of files) {
      uploadedMedia.push(await uploadScheduledMedia(file, c.env));
    }

    const mediaUrls = uploadedMedia.map((asset) => asset.url);
    const videoUrl = postType === "video" ? mediaUrls[0] : null;
    const thumbnailUrl = uploadedMedia[0].resourceType === "image"
      ? mediaUrls[0]
      : videoUrl;
    const scheduledPost = await getPrisma(c.env).scheduledPost.create({
      data: {
        userId: c.get("authUser").id,
        caption,
        postType,
        videoUrl,
        mediaFiles: mediaUrls,
        thumbnailUrl,
        accounts,
        scheduleTime,
        status: "scheduled",
        publishedIds: [],
      },
    });

    return c.json({
      success: true,
      message: "Post scheduled successfully!",
      data: {
        caption,
        postType: requestedPostType,
        mediaFiles: mediaUrls,
        accounts,
        scheduleTime,
        postId: scheduledPost.id,
      },
    }, 201);
  } catch (error) {
    console.error("Hono scheduled-post creation failed:", error);
    const cleanupResults = await Promise.allSettled(
      uploadedMedia.map((asset) => deleteScheduledMedia(asset, c.env))
    );
    for (const result of cleanupResults) {
      if (result.status === "rejected") console.error("Scheduled-media cleanup failed:", result.reason);
    }
    return c.json({
      success: false,
      error: error.message === "Scheduled media upload failed."
        ? error.message
        : "Failed to schedule post.",
    }, 500);
  }
});

function isCloudinaryMediaUrl(value, resourceType) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "res.cloudinary.com" || url.hostname.endsWith(".cloudinary.com")) {
      return !resourceType || url.pathname.includes(`/${resourceType}/upload/`);
    }
    // Accept Cloudflare R2 / Pages / Worker media streaming URLs
    if (url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".workers.dev") || url.pathname.includes("/api/v1/media/")) {
      return true;
    }
    // Accept standard CDN / video hosts
    return url.hostname.length > 3;
  } catch {
    return false;
  }
}

function isSupportedPostMedia(file) {
  return [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "image/jpeg",
    "image/png",
    "image/webp",
  ].includes(file.type);
}

export default posts;
