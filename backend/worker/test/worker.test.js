import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";
import test from "node:test";
import { jwtVerify } from "jose";
import { createAuthToken } from "../src/routes/auth.js";
import {
  createOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotp,
} from "../src/lib/two-factor.js";
import {
  deleteCloudinaryResource,
  isCloudinaryPublicIdInFolder,
  listCloudinaryResources,
  signCloudinaryParameters,
  uploadProfileImage,
  uploadScheduledMedia,
} from "../src/lib/cloudinary.js";
import {
  encryptFacebookToken,
  decryptFacebookToken,
  fetchRecentFacebookPosts,
  exchangeFacebookCode,
  fetchFacebookPages,
  fetchFacebookProfile,
  publishFacebookPost,
} from "../src/lib/facebook.js";
import { sendPasswordResetEmail } from "../src/lib/email.js";
import { processScheduledPosts } from "../src/lib/scheduled-posts.js";
import { generateBotSuggestions } from "../src/lib/ai.js";
import { validateRule } from "../src/routes/bot.js";
import { parseCreditTransactionLimit } from "../src/routes/credits.js";
import { buildAnalyticsStats } from "../src/routes/analytics.js";
import {
  createTikTokPreview,
  extractTikTokVideoData,
  validateTikTokMediaUrl,
  validateTikTokUrl,
} from "../src/routes/tools.js";
import worker from "../src/index.js";

test("health endpoint identifies the Worker runtime", async () => {
  const response = await worker.request("/healthz");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    runtime: "cloudflare-workers",
  });
});

test("health API routes are served natively by Hono without the legacy backend", async () => {
  for (const path of ["/api/health", "/api/system/health"]) {
    const response = await worker.request(path, undefined, {});

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      runtime: "cloudflare-workers",
      api: "hono",
    });
  }

  const headResponse = await worker.request("/api/health", { method: "HEAD" }, {});
  assert.equal(headResponse.status, 200);
  assert.equal(await headResponse.text(), "");
});

test("auth status reports an anonymous user without requiring database credentials", async () => {
  const response = await worker.request("/api/auth/status", undefined, {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: false,
    user: null,
  });
});

test("Hono login validates JSON input before accessing the database", async () => {
  const missingFields = await worker.request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "" }),
    },
    {}
  );
  assert.equal(missingFields.status, 400);
  assert.deepEqual(await missingFields.json(), {
    success: false,
    error: "Email and password are required",
  });

  const invalidJson = await worker.request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    },
    {}
  );
  assert.equal(invalidJson.status, 400);
  assert.deepEqual(await invalidJson.json(), {
    success: false,
    error: "A valid JSON body is required",
  });
});

test("Hono registration validates required fields and password policy", async () => {
  const missingEmail = await worker.request(
    "/api/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "123456" }),
    },
    {}
  );
  assert.equal(missingEmail.status, 400);
  assert.deepEqual(await missingEmail.json(), {
    success: false,
    error: "Email and password are required",
  });

  const shortPassword = await worker.request(
    "/api/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", password: "12345" }),
    },
    {}
  );
  assert.equal(shortPassword.status, 400);
  assert.deepEqual(await shortPassword.json(), {
    success: false,
    error: "Password must be at least 6 characters long.",
  });
});

test("Hono registration reports missing production secrets or database before creating a user", async () => {
  const response = await worker.request(
    "/api/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "deploy-check@example.invalid",
        password: "not-a-real-account-123",
      }),
    },
    {}
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Registration service is not configured.",
  });
});

test("Hono password-reset routes validate request payloads before database access", async () => {
  const missingEmail = await worker.request(
    "/api/auth/forgot-password",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    {}
  );
  assert.equal(missingEmail.status, 400);
  assert.deepEqual(await missingEmail.json(), { error: "Email is required." });

  const shortPassword = await worker.request(
    "/api/auth/reset-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "reset-token", password: "12345" }),
    },
    {}
  );
  assert.equal(shortPassword.status, 400);
  assert.deepEqual(await shortPassword.json(), {
    error: "Password must be at least 6 characters.",
  });
});

test("Hono logout expires authentication and legacy session cookies", async () => {
  const response = await worker.request("/api/auth/logout", { method: "POST" }, {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "Logged out successfully",
  });
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some((cookie) => cookie.startsWith("token=") && cookie.includes("Max-Age=0")));
  assert.ok(cookies.some((cookie) => cookie.startsWith("connect.sid=") && cookie.includes("Max-Age=0")));
});

test("Hono logout forwards legacy sessions so the backend can destroy them", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/auth/logout");
    assert.equal(request.headers.get("cookie"), "connect.sid=legacy-session");
    return Response.json({ success: true, message: "Logged out successfully" });
  };

  try {
    const response = await worker.request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: { Cookie: "connect.sid=legacy-session" },
      },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      message: "Logged out successfully",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono JWT claims stay compatible with the existing Express backend", async () => {
  const secret = new TextEncoder().encode("shared-test-secret");
  const token = await createAuthToken(
    { id: "user-123", email: "person@example.com" },
    secret
  );
  const { payload, protectedHeader } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });

  assert.equal(protectedHeader.alg, "HS256");
  assert.equal(payload.id, "user-123");
  assert.equal(payload.email, "person@example.com");
  assert.equal(typeof payload.exp, "number");
});

test("Hono 2FA encryption can read and write secrets from the legacy backend", async () => {
  const env = { ENCRYPTION_KEY: "existing-encryption-key" };
  const key = createHash("sha256").update(env.ENCRYPTION_KEY).digest();
  const iv = Buffer.alloc(12, 7);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update("JBSWY3DPEHPK3PXP", "utf8"), cipher.final()]);
  const legacyEncrypted = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");

  assert.equal(await decryptTotpSecret(legacyEncrypted, env), "JBSWY3DPEHPK3PXP");

  const workerEncrypted = Buffer.from(await encryptTotpSecret("JBSWY3DPEHPK3PXP", env), "base64");
  const workerIv = workerEncrypted.subarray(0, 12);
  const workerTag = workerEncrypted.subarray(12, 28);
  const workerCiphertext = workerEncrypted.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, workerIv);
  decipher.setAuthTag(workerTag);
  const plaintext = Buffer.concat([
    decipher.update(workerCiphertext),
    decipher.final(),
  ]).toString("utf8");

  assert.equal(plaintext, "JBSWY3DPEHPK3PXP");
});

test("Hono TOTP generation follows six-digit authenticator defaults", async () => {
  const now = 1_700_000_000_000;
  const secret = generateTotpSecret();
  const uri = createOtpAuthUri("person@example.com", secret);

  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.match(uri, /^otpauth:\/\/totp\/EZA_POST%3Aperson%40example\.com\?/);
  assert.equal(new URL(uri).searchParams.get("issuer"), "EZA_POST");
  assert.equal(new URL(uri).searchParams.get("algorithm"), "SHA1");
  assert.equal(new URL(uri).searchParams.get("digits"), "6");
  assert.equal(new URL(uri).searchParams.get("period"), "30");

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const keyBytes = decodeBase32(secret);
  assert.ok(alphabet.includes(secret[0]));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac("sha1", keyBytes).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]
  ) % 1_000_000;
  const code = value.toString().padStart(6, "0");

  assert.equal(await verifyTotp(code, secret, now), true);
  assert.equal(await verifyTotp("not-a-code", secret, now), false);
});

test("Hono 2FA routes require authentication", async () => {
  for (const path of ["/api/auth/2fa/setup", "/api/auth/2fa/verify", "/api/auth/2fa/disable"]) {
    const response = await worker.request(
      path,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      {}
    );
    assert.equal(response.status, 401, path);
  }
});

test("Hono Facebook disconnect requires authentication", async () => {
  const response = await worker.request("/api/auth/facebook", { method: "DELETE" }, {});

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Unauthorized",
  });
});

test("Facebook OAuth start and callback require authentication", async () => {
  const start = await worker.request("/api/auth/facebook", undefined, {});
  const callback = await worker.request("/api/auth/facebook/callback?code=code&state=state", undefined, {});

  assert.equal(start.status, 401);
  assert.equal(callback.status, 401);
});

test("Hono queue and bulk routes require authentication", async () => {
  const requests = [
    ["/api/posts", { method: "POST", body: new FormData() }],
    ["/api/posts/queue", { method: "GET" }],
    ["/api/posts/queue/post-123", { method: "DELETE" }],
    ["/api/posts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: [{ caption: "test" }] }),
    }],
  ];

  for (const [path, init] of requests) {
    const response = await worker.request(path, init, {});
    assert.equal(response.status, 401, path);
  }
});

test("Hono user routes require authentication", async () => {
  const requests = [
    ["/api/user/pages", { method: "GET" }],
    ["/api/user/pages/toggle", { method: "POST", body: "{}" }],
    ["/api/user/pages/settings", { method: "POST", body: "{}" }],
    ["/api/user/update", { method: "PUT", body: "{}" }],
    ["/api/user/stats", { method: "GET" }],
    ["/api/user/connections", { method: "GET" }],
  ];

  for (const [path, init] of requests) {
    const response = await worker.request(
      path,
      { ...init, headers: { "Content-Type": "application/json" } },
      {}
    );
    assert.equal(response.status, 401, path);
  }
});

test("Hono bot routes require authentication", async () => {
  const requests = [
    ["/api/bot/suggestions", { method: "POST" }],
    ["/api/bot/rules", { method: "GET" }],
    ["/api/bot/rules", { method: "POST", body: "{}" }],
    ["/api/bot/rules/rule-1", { method: "PUT", body: "{}" }],
    ["/api/bot/rules/rule-1", { method: "PATCH", body: "{}" }],
    ["/api/bot/rules/rule-1", { method: "DELETE" }],
    ["/api/bot/settings", { method: "PUT", body: "{}" }],
    ["/api/bot/page-settings", { method: "PUT", body: "{}" }],
    ["/api/bot/monitored-posts", { method: "GET" }],
    ["/api/bot/monitored-posts", { method: "POST", body: "{}" }],
    ["/api/bot/monitored-posts/post-1", { method: "DELETE" }],
    ["/api/bot/history", { method: "GET" }],
    ["/api/bot/recent-posts/page-1", { method: "GET" }],
  ];
  for (const [path, init] of requests) {
    const response = await worker.request(
      path,
      {
        ...init,
        headers: { "Content-Type": "application/json" },
      },
      {}
    );
    assert.equal(response.status, 401, path);
  }
});

test("Hono credit read routes apply expected authentication and limit validation", async () => {
  const balance = await worker.request("/api/credits", undefined, {});
  assert.equal(balance.status, 401);

  const transactions = await worker.request("/api/credits/transactions", undefined, {});
  assert.equal(transactions.status, 401);

  assert.deepEqual(parseCreditTransactionLimit(undefined), { limit: 50, error: false });
  assert.deepEqual(parseCreditTransactionLimit("10"), { limit: 10, error: false });
  assert.deepEqual(parseCreditTransactionLimit("999"), { limit: 100, error: false });
  assert.deepEqual(parseCreditTransactionLimit("-3"), { error: true });
  assert.deepEqual(parseCreditTransactionLimit("1.5"), { error: true });
});

test("Hono analytics requires authentication", async () => {
  const response = await worker.request("/api/analytics", undefined, {});
  assert.equal(response.status, 401);
});

test("TikTok preview accepts only supported HTTPS TikTok video URLs", () => {
  assert.equal(validateTikTokUrl("https://www.tiktok.com/@creator/video/123456789").hostname, "www.tiktok.com");
  assert.equal(validateTikTokUrl("https://vt.tiktok.com/short-code"), null);
  assert.equal(validateTikTokUrl("http://www.tiktok.com/@creator/video/123456789"), null);
  assert.equal(validateTikTokUrl("https://tiktok.com.evil.example/@creator/video/123456789"), null);
  assert.equal(validateTikTokUrl("https://www.tiktok.com.evil.example/@creator/video/123456789"), null);
  assert.equal(validateTikTokUrl("https://www.tiktok.com/@creator/profile"), null);
});

test("TikTok preview builds a safe embed without an upstream metadata request", () => {
  assert.deepEqual(
    createTikTokPreview(new URL("https://www.tiktok.com/@creator/video/123456789")),
    {
      id: "123456789",
      title: "TikTok video by @creator",
      cover: "",
      type: "preview",
      embedUrl: "https://www.tiktok.com/player/v1/123456789",
      web_url: "https://www.tiktok.com/@creator/video/123456789",
      author: { nickname: "creator", unique_id: "creator" },
      stats: { plays: 0, likes: 0 },
    }
  );
  assert.throws(
    () => createTikTokPreview(new URL("https://www.tiktok.com/@creator/profile")),
    /canonical TikTok video URL/
  );
});

test("TikTok public-page extractor only accepts media URLs from supported hosts", () => {
  const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({
    video: {
      id: "123456789",
      desc: "A public video",
      playAddr: "https://v16-webapp-prime.tiktok.com/video.mp4?token=example",
      cover: "https://p16-sign.tiktokcdn.com/cover.jpeg",
    },
  })}</script>`;
  const video = extractTikTokVideoData(html, "123456789");

  assert.equal(video.id, "123456789");
  assert.equal(video.title, "A public video");
  assert.equal(
    video.mediaUrl.href,
    "https://v16-webapp-prime.tiktok.com/video.mp4?token=example"
  );
  assert.equal(validateTikTokMediaUrl("https://tiktokcdn.com.evil.example/video.mp4"), null);
  assert.equal(validateTikTokMediaUrl("http://v16.tiktok.com/video.mp4"), null);

  const untrustedHtml = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify({
    video: {
      id: "123456789",
      playAddr: "https://attacker.example/video.mp4",
    },
  })}</script>`;
  assert.equal(extractTikTokVideoData(untrustedHtml, "123456789").mediaUrl, null);
});

test("native TikTok preview still requires authentication without a legacy backend", async () => {
  const response = await worker.request(
    "/api/tools/tiktok/lookup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.tiktok.com/@creator/video/123456789" }),
    },
    {}
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { success: false, error: "Unauthorized" });
});

test("native TikTok download still requires authentication", async () => {
  const response = await worker.request(
    "/api/tools/tiktok/download?url=https%3A%2F%2Fwww.tiktok.com%2F%40creator%2Fvideo%2F123456789",
    {},
    {}
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { success: false, error: "Unauthorized" });
});

test("Analytics aggregates scheduled post statuses, platform counts, and daily activity", () => {
  const stats = buildAnalyticsStats([
    {
      status: "published",
      createdAt: new Date("2026-10-01T09:00:00Z"),
      accounts: ["page-1"],
    },
    {
      status: "scheduled",
      createdAt: new Date("2026-10-01T10:00:00Z"),
      accounts: '["page-1", "page-2"]',
    },
    {
      status: "failed",
      createdAt: new Date("2026-10-02T10:00:00Z"),
      accounts: [],
    },
  ], { views: 120, likes: 15, shares: 3 });

  assert.equal(stats.total, 3);
  assert.equal(stats.successful, 1);
  assert.equal(stats.scheduled, 1);
  assert.equal(stats.failed, 1);
  assert.deepEqual(stats.platforms, {
    facebook: 2,
    youtube: 0,
    tiktok: 0,
    instagram: 0,
  });
  assert.deepEqual(stats.chartData, [
    { date: "2026-10-01", posts: 2 },
    { date: "2026-10-02", posts: 1 },
  ]);
  assert.deepEqual(stats.engagement, { views: 120, likes: 15, shares: 3 });
  assert.equal(stats.bestTimes.length, 4);
});

test("Bot rule validator applies defaults and rejects invalid regex/scope", () => {
  assert.deepEqual(validateRule({ reply: "Hello" }, false), {
    data: {
      keyword: "*",
      reply: "Hello",
      ruleType: "KEYWORD",
      scope: "ALL",
    },
  });
  assert.equal(validateRule({
    reply: "Hello",
    keyword: "[",
    ruleType: "REGEX",
  }, false).error, "Invalid Regular Expression pattern");
  assert.equal(validateRule({
    reply: "Hello",
    scope: "SPECIFIC",
  }, false).error, "Post ID is required for Specific Post scope");
});

test("Bot rule partial updates only include fields supplied by the caller", () => {
  assert.deepEqual(validateRule({ reply: "Updated reply" }, true), {
    data: { reply: "Updated reply" },
  });
  assert.deepEqual(validateRule({ scope: "ALL" }, true), {
    data: { scope: "ALL" },
  });
  assert.deepEqual(validateRule({ scope: "SPECIFIC" }, true), {
    data: { scope: "SPECIFIC" },
  });
});

test("Gemini suggestions request validates the expected result and reports configuration failures", async () => {
  await assert.rejects(generateBotSuggestions({}), /GEMINI_API_KEY Worker secret is not configured/);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    );
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-goog-api-key"], "gemini-test-key");
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    return Response.json({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify(Array.from({ length: 5 }, (_, index) => ({
              keyword: `keyword-${index}`,
              reply: `reply-${index}`,
              category: "support",
            }))),
          }],
        },
      }],
    });
  };
  try {
    const suggestions = await generateBotSuggestions({ GEMINI_API_KEY: "gemini-test-key" });
    assert.equal(suggestions.length, 5);
    assert.deepEqual(suggestions[0], {
      keyword: "keyword-0",
      reply: "reply-0",
      category: "support",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono profile-image upload routes require authentication", async () => {
  for (const path of [
    "/api/upload/avatar",
    "/api/upload/cover",
    "/api/upload/bot-image",
    "/api/upload/thumbnail",
  ]) {
    const response = await worker.request(
      path,
      { method: "POST", body: new FormData() },
      {}
    );
    assert.equal(response.status, 401, path);
  }
  const videos = await worker.request("/api/upload/video", undefined, {});
  assert.equal(videos.status, 401);

  for (const path of [
    "/api/upload/video/eza-post%2Fvideos%2Fsample",
    "/api/upload/thumbnail/kr_post%2Fthumbnails%2Fsample",
  ]) {
    const response = await worker.request(path, { method: "DELETE" }, {});
    assert.equal(response.status, 401, path);
  }
});

test("Hono mixed-carousel route requires authentication", async () => {
  const response = await worker.request(
    "/api/posts/mixed-carousel",
    { method: "POST", body: new FormData() },
    {}
  );
  assert.equal(response.status, 401);
});

test("Hono schedule route requires authentication", async () => {
  const response = await worker.request(
    "/api/posts/schedule",
    { method: "POST", body: new FormData() },
    {}
  );
  assert.equal(response.status, 401);
});

test("Cloudinary upload signature uses sorted API parameters", async () => {
  const signature = await signCloudinaryParameters(
    { timestamp: "1315060510", public_id: "sample", folder: "images" },
    "secret"
  );
  const expected = createHash("sha1")
    .update("folder=images&public_id=sample&timestamp=1315060510secret")
    .digest("hex");
  assert.equal(signature, expected);
});

test("Cloudinary upload rejects unsupported media before network access", async () => {
  await assert.rejects(
    uploadScheduledMedia(new File(["content"], "payload.txt", { type: "text/plain" }), {}),
    /Unsupported scheduled media type/
  );
});

test("Cloudinary profile-image upload signs the expected folder and returns metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload"
    );
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("folder"), "kr_post/avatars");
    assert.equal(options.body.get("api_key"), "test-api-key");
    assert.ok(options.body.get("signature"));
    assert.equal(options.body.get("file").name, "avatar.png");
    return Response.json({
      secure_url: "https://cdn.example/avatar.png",
      public_id: "kr_post/avatars/avatar",
      bytes: 2048,
    });
  };

  try {
    const result = await uploadProfileImage(
      new File(["image"], "avatar.png", { type: "image/png" }),
      "kr_post/avatars",
      {
        CLOUDINARY_CLOUD_NAME: "test-cloud",
        CLOUDINARY_API_KEY: "test-api-key",
        CLOUDINARY_API_SECRET: "test-api-secret",
      }
    );
    assert.deepEqual(result, {
      url: "https://cdn.example/avatar.png",
      publicId: "kr_post/avatars/avatar",
      size: 2048,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cloudinary media listing uses authenticated Admin API and folder prefix", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.pathname, "/v1_1/test-cloud/resources/video/upload");
    assert.equal(requestUrl.searchParams.get("prefix"), "eza-post/videos");
    assert.equal(requestUrl.searchParams.get("max_results"), "50");
    assert.equal(
      options.headers.Authorization,
      `Basic ${Buffer.from("test-api-key:test-api-secret").toString("base64")}`
    );
    return Response.json({
      resources: [{
        public_id: "eza-post/videos/example",
        secure_url: "https://cdn.example/example.mp4",
        bytes: 1024,
        created_at: "2026-10-04T00:00:00Z",
      }],
    });
  };

  try {
    const resources = await listCloudinaryResources("video", "eza-post/videos", {
      CLOUDINARY_CLOUD_NAME: "test-cloud",
      CLOUDINARY_API_KEY: "test-api-key",
      CLOUDINARY_API_SECRET: "test-api-secret",
    });
    assert.equal(resources[0].public_id, "eza-post/videos/example");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cloudinary media deletion signs the ID and rejects IDs outside managed folder", async () => {
  const env = {
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-api-key",
    CLOUDINARY_API_SECRET: "test-api-secret",
  };
  await assert.rejects(
    deleteCloudinaryResource("video", "kr_post/avatars/private", "eza-post/videos", env),
    /outside the managed folder/
  );
  assert.equal(isCloudinaryPublicIdInFolder("eza-post/videos/clip-1", "eza-post/videos"), true);
  assert.equal(isCloudinaryPublicIdInFolder("eza-post/videos/../private", "eza-post/videos"), false);
  assert.equal(isCloudinaryPublicIdInFolder("eza-post/videos\\private", "eza-post/videos"), false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.cloudinary.com/v1_1/test-cloud/video/destroy");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("public_id"), "eza-post/videos/sample");
    assert.equal(options.body.get("api_key"), "test-api-key");
    assert.ok(options.body.get("signature"));
    return Response.json({ result: "ok" });
  };
  try {
    await deleteCloudinaryResource("video", "eza-post/videos/sample", "eza-post/videos", env);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook token encryption remains readable by the legacy AES-CBC helper", async () => {
  const env = { ENCRYPTION_KEY: "shared-facebook-encryption-key" };
  const encrypted = await encryptFacebookToken("page-access-token", env);
  const [ivHex, ciphertextHex] = encrypted.split(":");
  const key = Buffer.from(
    createHash("sha256").update(env.ENCRYPTION_KEY).digest("base64").slice(0, 32)
  );
  const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");

  assert.equal(plaintext, "page-access-token");
});

test("Worker decrypts legacy-compatible Facebook access tokens", async () => {
  const env = { ENCRYPTION_KEY: "shared-facebook-encryption-key" };
  const encrypted = await encryptFacebookToken("page-access-token", env);
  assert.equal(await decryptFacebookToken(encrypted, env), "page-access-token");
  assert.equal(await decryptFacebookToken("legacy-plaintext-token", env), "legacy-plaintext-token");
});

test("Facebook OAuth exchanges tokens and fetches account and page data", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (request) => {
    const url = new URL(request instanceof Request ? request.url : request);
    urls.push(url);
    if (url.pathname.endsWith("/oauth/access_token")) {
      return Response.json(
        url.searchParams.has("code")
          ? { access_token: "short-lived-token" }
          : { access_token: "long-lived-token", expires_in: 3600 }
      );
    }
    if (url.pathname.endsWith("/me/accounts")) {
      return Response.json({
        data: [{
          id: "page-1",
          name: "Page One",
          access_token: "page-token",
          picture: { data: { url: "https://cdn.example/page.png" } },
          category: "Community",
        }],
      });
    }
    return Response.json({ id: "facebook-user", name: "Test User" });
  };

  try {
    const env = {
      FB_APP_ID: "facebook-app-id",
      FB_APP_SECRET: "facebook-app-secret",
      FACEBOOK_REDIRECT_URI: "https://pages.example/api/auth/facebook/callback",
    };
    const tokens = await exchangeFacebookCode("oauth-code", env);
    const profile = await fetchFacebookProfile(tokens.accessToken);
    const pages = await fetchFacebookPages(tokens.accessToken);

    assert.equal(tokens.accessToken, "long-lived-token");
    assert.ok(tokens.expiresAt instanceof Date);
    assert.equal(profile.id, "facebook-user");
    assert.deepEqual(pages, [{
      id: "page-1",
      name: "Page One",
      accessToken: "page-token",
      picture: "https://cdn.example/page.png",
      category: "Community",
    }]);
    assert.equal(urls.length, 4);
    assert.equal(urls[0].searchParams.get("redirect_uri"), env.FACEBOOK_REDIRECT_URI);
    assert.equal(urls[1].searchParams.get("fb_exchange_token"), "short-lived-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook publisher creates a post from a Cloudinary-hosted video URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://graph.facebook.com/v21.0/page-123/videos");
    assert.equal(options.method, "POST");
    const form = new URLSearchParams(options.body);
    assert.equal(form.get("access_token"), "page-token");
    assert.equal(form.get("file_url"), "https://res.cloudinary.com/demo/video/upload/clip.mp4");
    assert.equal(form.get("description"), "Video caption");
    return Response.json({ id: "facebook-post-id" });
  };

  try {
    const result = await publishFacebookPost("page-123", "page-token", {
      postType: "video",
      caption: "Video caption",
      videoUrl: "https://res.cloudinary.com/demo/video/upload/clip.mp4",
    });
    assert.equal(result, "facebook-post-id");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook publisher creates carousel attachments for photos and Page cards", async () => {
  const originalFetch = globalThis.fetch;
  let photoIndex = 0;
  globalThis.fetch = async (url, options) => {
    const parsedUrl = new URL(url);
    const fields = new URLSearchParams(options.body);
    assert.equal(fields.get("access_token"), "page-token");
    if (parsedUrl.pathname.endsWith("/photos")) {
      photoIndex += 1;
      assert.equal(fields.get("published"), "false");
      return Response.json({ id: `photo-${photoIndex}` });
    }
    assert.equal(parsedUrl.pathname, "/v21.0/page-123/feed");
    const attachments = JSON.parse(fields.get("child_attachments"));
    assert.equal(attachments.length, 2);
    assert.equal(attachments[0].media_fbid, "photo-1");
    assert.equal(attachments[1].media_fbid, "photo-2");
    assert.equal(attachments[0].call_to_action.type, "LEARN_MORE");
    return Response.json({ id: "carousel-post-id" });
  };

  try {
    const result = await publishFacebookPost("page-123", "page-token", {
      postType: "carousel",
      caption: "Carousel caption",
      carouselCards: [
        {
          type: "image",
          mediaUrl: "https://res.cloudinary.com/demo/image/upload/card.png",
          headline: "First",
          link: "https://example.com",
          cta: "LEARN_MORE",
        },
        { type: "image", isPageCard: true, headline: "Page" },
      ],
    }, {
      picture: "https://scontent.example.fbcdn.net/page.png",
      name: "Page One",
    });
    assert.equal(result, "carousel-post-id");
    assert.equal(photoIndex, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recent Facebook posts include sorted insight metrics and retry without insights", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (request) => {
    const url = new URL(request);
    requests.push(url);
    if (requests.length === 1) {
      return Response.json({ error: { message: "Insights are unavailable", code: 100 } }, { status: 400 });
    }
    return Response.json({
      data: [
        { id: "low", message: "Lower reach", created_time: "2026-10-03T00:00:00Z" },
        {
          id: "high",
          message: "Higher reach",
          insights: {
            data: [
              { name: "post_impressions_unique", values: [{ value: 42 }] },
              { name: "post_video_views", values: [{ value: 8 }] },
            ],
          },
        },
      ],
    });
  };

  try {
    const posts = await fetchRecentFacebookPosts("page-123", "page-token");
    assert.equal(requests.length, 2);
    assert.match(requests[0].searchParams.get("fields"), /insights\.metric/);
    assert.equal(requests[0].searchParams.get("limit"), "30");
    assert.equal(requests[1].searchParams.get("fields"), "id,message,created_time,full_picture,permalink_url");
    assert.deepEqual(posts.map(({ id }) => id), ["high", "low"]);
    assert.equal(posts[0].reach, 42);
    assert.equal(posts[0].views, 8);
    assert.equal(posts[1].reach, 0);
    assert.equal(posts[1].views, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker scheduled processor claims due posts and records Facebook publication", async () => {
  const originalFetch = globalThis.fetch;
  const encryptedPageToken = await encryptFacebookToken("page-token", {
    ENCRYPTION_KEY: "test-page-key",
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://graph.facebook.com/v21.0/page-123/videos");
    assert.equal(new URLSearchParams(options.body).get("access_token"), "page-token");
    return Response.json({ id: "published-post-123" });
  };

  const scheduledPost = {
    id: "scheduled-123",
    userId: "user-123",
    caption: "Scheduled caption",
    postType: "video",
    scheduleTime: new Date(Date.now() - 60_000),
    attempts: 0,
    accounts: ["page-123"],
    videoUrl: "https://res.cloudinary.com/demo/video/upload/clip.mp4",
    mediaFiles: ["https://res.cloudinary.com/demo/video/upload/clip.mp4"],
    publishedIds: [],
  };
  let resultUpdate;
  const prisma = {
    scheduledPost: {
      updateMany: async () => ({ count: 1 }),
      findMany: async () => [scheduledPost],
      update: async ({ data }) => { resultUpdate = data; },
    },
    facebookPage: {
      findMany: async () => [{
        id: "page-123",
        accessToken: encryptedPageToken,
        enableSchedule: true,
      }],
    },
    postLog: {
      create: async () => ({}),
    },
  };
  try {
    await processScheduledPosts({ ENCRYPTION_KEY: "test-page-key" }, prisma);
    assert.equal(resultUpdate.status, "published");
    assert.equal(resultUpdate.attempts, 1);
    assert.deepEqual(resultUpdate.publishedIds, [{
      accountId: "page-123",
      postId: "published-post-123",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Resend password email request uses configured sender and escapes reset URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.Authorization, "Bearer test-resend-key");
    const payload = JSON.parse(options.body);
    assert.equal(payload.from, "EZA Post <verified@example.com>");
    assert.deepEqual(payload.to, ["person@example.com"]);
    assert.ok(payload.html.includes("&amp;"));
    assert.ok(!payload.html.includes("token=abc&admin"));
    return Response.json({ id: "email-123" }, { status: 200 });
  };

  try {
    await sendPasswordResetEmail(
      "person@example.com",
      "https://pages.example/reset-password?token=abc&admin=true",
      { RESEND_API_KEY: "test-resend-key", EMAIL_FROM: "EZA Post <verified@example.com>" }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let buffer = 0;
  let bits = 0;
  const bytes = [];

  for (const character of value) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

test("unmigrated API routes fail clearly when the legacy backend is not configured", async () => {
  const response = await worker.request("/api/unmigrated", undefined, {});

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Backend origin is not configured",
  });

});

test("unmigrated post routes continue to proxy to the legacy backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/posts/tiktok/fetch");
    assert.equal(request.method, "GET");
    return Response.json({ source: "legacy" });
  };

  try {
    const response = await worker.request(
      "/api/posts/tiktok/fetch",
      undefined,
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { source: "legacy" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YouTube downloader API stays on the legacy backend and preserves its response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/tools/youtube/lookup");
    assert.equal(request.method, "POST");
    assert.equal(request.headers.get("cookie"), "token=worker-session");
    assert.deepEqual(JSON.parse(await request.text()), {
      url: "https://www.youtube.com/watch?v=video-id",
    });
    return new Response(JSON.stringify({ success: true, isPlaylist: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Downloader": "legacy" },
    });
  };

  try {
    const response = await worker.request(
      "/api/tools/youtube/lookup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "token=worker-session",
        },
        body: JSON.stringify({ url: "https://www.youtube.com/watch?v=video-id" }),
      },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Downloader"), "legacy");
    assert.deepEqual(await response.json(), { success: true, isPlaylist: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook downloader requests continue to proxy to the legacy backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/tools/facebook/download");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(await request.text()), {
      url: "https://www.facebook.com/watch/?v=123",
    });
    return Response.json({ success: true, url: "/uploads/temp/videos/fb-test.mp4" });
  };

  try {
    const response = await worker.request(
      "/api/tools/facebook/download",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.facebook.com/watch/?v=123" }),
      },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      url: "/uploads/temp/videos/fb-test.mp4",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Instagram downloader requests continue to proxy to the legacy backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/tools/instagram/download");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(await request.text()), {
      url: "https://www.instagram.com/reel/ABC123/",
    });
    return Response.json({
      success: true,
      url: "/uploads/temp/instagram/ig-test.jpg",
      meta: { type: "image" },
    });
  };

  try {
    const response = await worker.request(
      "/api/tools/instagram/download",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.instagram.com/reel/ABC123/" }),
      },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      url: "/uploads/temp/instagram/ig-test.jpg",
      meta: { type: "image" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Pinterest downloader requests continue to proxy to the legacy backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/tools/pinterest/download");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(await request.text()), {
      url: "https://www.pinterest.com/pin/123456789/",
    });
    return Response.json({
      success: true,
      url: "/uploads/temp/downloads/pin-test.jpg",
      meta: { type: "image" },
    });
  };

  try {
    const response = await worker.request(
      "/api/tools/pinterest/download",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.pinterest.com/pin/123456789/" }),
      },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      url: "/uploads/temp/downloads/pin-test.jpg",
      meta: { type: "image" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Threads media proxy requests continue to proxy to the legacy backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(
      request.url,
      "https://backend.example/api/tools/threads/proxy?url=https%3A%2F%2Fscontent.cdninstagram.com%2Fclip.mp4&filename=threads-clip.mp4"
    );
    assert.equal(request.method, "GET");
    return new Response("thread video", {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="threads-clip.mp4"',
      },
    });
  };

  try {
    const response = await worker.request(
      "/api/tools/threads/proxy?url=https%3A%2F%2Fscontent.cdninstagram.com%2Fclip.mp4&filename=threads-clip.mp4",
      undefined,
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "video/mp4");
    assert.equal(await response.text(), "thread video");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CapCut downloader requests continue to proxy to the legacy backend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/tools/capcut/download");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(await request.text()), {
      url: "https://www.capcut.com/template-detail/example/123",
    });
    return Response.json({
      success: true,
      url: "/uploads/temp/capcut/cc-test.mp4",
      meta: { filename: "cc-test.mp4", type: "video" },
    });
  };

  try {
    const response = await worker.request(
      "/api/tools/capcut/download",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://www.capcut.com/template-detail/example/123",
        }),
      },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      url: "/uploads/temp/capcut/cc-test.mp4",
      meta: { filename: "cc-test.mp4", type: "video" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Pages media URLs proxy through the Worker to legacy temporary files", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/uploads/temp/downloads/pin-test.jpg");
    assert.equal(request.method, "GET");
    return new Response("image bytes", {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="pin-test.jpg"',
      },
    });
  };

  try {
    const response = await worker.request(
      "/uploads/temp/downloads/pin-test.jpg",
      undefined,
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/jpeg");
    assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="pin-test.jpg"');
    assert.equal(await response.text(), "image bytes");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YouTube file downloads preserve the legacy content-disposition response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/download?file=clip.mp4");
    assert.equal(request.method, "GET");
    return new Response("video bytes", {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="clip.mp4"',
      },
    });
  };

  try {
    const response = await worker.request(
      "/api/download?file=clip.mp4",
      undefined,
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.headers.get("Content-Type"), "video/mp4");
    assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="clip.mp4"');
    assert.equal(await response.text(), "video bytes");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API requests preserve the method, query, and body when proxied", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://backend.example/api/unmigrated?draft=true");
    assert.equal(request.method, "POST");
    assert.equal(await request.text(), "post payload");
    return new Response("created", { status: 201 });
  };

  try {
    const response = await worker.request(
      "/api/unmigrated?draft=true",
      { method: "POST", body: "post payload" },
      { BACKEND_ORIGIN: "https://backend.example" }
    );

    assert.equal(response.status, 201);
    assert.equal(await response.text(), "created");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
