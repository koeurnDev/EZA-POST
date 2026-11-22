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
import { processScheduledPostById, processScheduledPosts } from "../src/lib/scheduled-posts.js";
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

test("R2 upload rejects unsupported media before storage access", async () => {
  await assert.rejects(
    uploadScheduledMedia(new File(["content"], "payload.txt", { type: "text/plain" }), {}),
    /Unsupported scheduled media type/
  );
});

test("R2 profile-image upload stores in MEDIA_BUCKET and returns media URL", async () => {
  const stored = [];
  const env = {
    FRONTEND_URL: "https://pages.example",
    MEDIA_BUCKET: {
      put: async (key, body, options) => {
        stored.push({ key, body, options });
      },
    },
  };

  const result = await uploadProfileImage(
    new File(["image"], "avatar.png", { type: "image/png" }),
    "avatar",
    env
  );
  assert.equal(stored.length, 1);
  assert.match(stored[0].key, /^profiles\/avatar\/\d+_.+\.png$/);
  assert.equal(result.publicId, stored[0].key);
  assert.equal(result.url, `https://pages.example/api/v1/media/${encodeURIComponent(stored[0].key)}`);
  assert.equal(result.isR2, true);
});

test("R2 media listing lists objects from MEDIA_BUCKET for the target prefix", async () => {
  const env = {
    FRONTEND_URL: "https://pages.example",
    MEDIA_BUCKET: {
      list: async ({ prefix }) => {
        assert.equal(prefix, "scheduled/");
        return {
          objects: [{
            key: "scheduled/example.mp4",
            size: 1024,
            uploaded: new Date("2026-10-04T00:00:00Z"),
          }],
        };
      },
    },
  };

  const resources = await listCloudinaryResources("video", "eza-post/videos", env);
  assert.equal(resources.length, 1);
  assert.equal(resources[0].public_id, "scheduled/example.mp4");
  assert.equal(resources[0].secure_url, "https://pages.example/api/v1/media/scheduled%2Fexample.mp4");
});

test("R2 media deletion removes object from MEDIA_BUCKET and validates IDs", async () => {
  const deleted = [];
  const env = {
    MEDIA_BUCKET: {
      delete: async (key) => {
        deleted.push(key);
      },
    },
  };

  assert.equal(isCloudinaryPublicIdInFolder("scheduled/clip-1.mp4", "eza-post/videos"), true);
  assert.equal(isCloudinaryPublicIdInFolder("   ", "eza-post/videos"), false);

  await deleteCloudinaryResource("video", "scheduled/sample.mp4", "eza-post/videos", env);
  assert.deepEqual(deleted, ["scheduled/sample.mp4"]);
});

test("Facebook publisher rejects cookie or placeholder tokens before Graph API call", async () => {
  for (const invalidToken of ["", "active_extension_session", "c_user=123; xs=secret"]) {
    await assert.rejects(
      publishFacebookPost("page-123", invalidToken, { postType: "image", mediaFiles: ["https://cdn.example/a.png"] }),
      /Access Token/
    );
  }
});

test("Bio check-slug allows the authenticated owner's own slug and blocks others", async () => {
  const secret = "bio-test-secret";
  const ownerToken = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const env = {
    JWT_SECRET: secret,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes("FROM bio_pages") && args[0] === "my-shop") {
              return { id: "bio-1", userId: "user-1" };
            }
            return null;
          },
        }),
      }),
    },
  };

  const ownRes = await worker.request(
    "/api/bio/check-slug/my-shop",
    { headers: { Authorization: `Bearer ${ownerToken}` } },
    env
  );
  assert.equal(ownRes.status, 200);
  assert.equal((await ownRes.json()).available, true);

  const anonRes = await worker.request("/api/bio/check-slug/my-shop", undefined, env);
  assert.equal(anonRes.status, 200);
  assert.equal((await anonRes.json()).available, false);
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

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "Not found",
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

test("Facebook publisher uploads binary directly from R2 MEDIA_BUCKET for /api/v1/media URLs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://graph-video.facebook.com/v21.0/page-123/videos");
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("access_token"), "page-token");
    assert.equal(options.body.get("description"), "R2 binary video");
    assert.ok(options.body.get("source") instanceof File || options.body.get("source") instanceof Blob);
    return Response.json({ id: "r2-fb-video-id" });
  };

  const env = {
    MEDIA_BUCKET: {
      get: async (key) => {
        assert.equal(key, "scheduled/demo.mp4");
        return {
          httpMetadata: { contentType: "video/mp4" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        };
      },
    },
  };

  try {
    const result = await publishFacebookPost(
      "page-123",
      "page-token",
      {
        postType: "video",
        caption: "R2 binary video",
        videoUrl: "https://eza-post-3kv.pages.dev/api/v1/media/scheduled%2Fdemo.mp4",
      },
      {},
      env
    );
    assert.equal(result, "r2-fb-video-id");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("processScheduledPostById processes targeted post directly without batch starvation", async () => {
  const originalFetch = globalThis.fetch;
  const encryptedPageToken = await encryptFacebookToken("page-token", {
    ENCRYPTION_KEY: "test-page-key",
  });
  globalThis.fetch = async () => Response.json({ id: "direct-fb-post-1" });

  let statusUpdated = null;
  const targetPost = {
    id: "target-post-6",
    userId: "user-123",
    caption: "Immediate post",
    postType: "image",
    scheduleTime: new Date(),
    attempts: 0,
    accounts: ["page-123"],
    mediaFiles: ["https://cdn.example/photo.jpg"],
    publishedIds: [],
    status: "scheduled",
  };
  const prisma = {
    scheduledPost: {
      findUnique: async ({ where }) => (
        where.id === "target-post-6"
          ? {
              ...targetPost,
              status: statusUpdated || "scheduled",
              publishedIds: statusUpdated === "published"
                ? [{ accountId: "page-123", postId: "direct-fb-post-1" }]
                : [],
            }
          : null
      ),
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => { statusUpdated = data.status; },
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
    const refreshed = await processScheduledPostById({ ENCRYPTION_KEY: "test-page-key" }, "target-post-6", prisma);
    assert.equal(statusUpdated, "published");
    assert.equal(refreshed.status, "published");
    assert.equal(refreshed.publishedIds[0].postId, "direct-fb-post-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Bot rule validator preserves enableDm and dmReply and allows DM-only rules", () => {
  assert.deepEqual(
    validateRule({ keyword: "price", reply: "", enableDm: true, dmReply: "DM price $10" }, false),
    {
      data: {
        keyword: "price",
        reply: "",
        dmReply: "DM price $10",
        ruleType: "KEYWORD",
        scope: "ALL",
        enableDm: true,
      },
    }
  );
  assert.equal(
    validateRule({ keyword: "price", reply: "", enableDm: false, dmReply: "DM price $10" }, false).error,
    "Reply is required"
  );
});

test("Hono bot suggestions falls back gracefully instead of returning 502 when Gemini is unavailable", async () => {
  const secret = "bot-suggest-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const env = {
    JWT_SECRET: secret,
    DB: {
      prepare: (sql) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes("FROM users")) {
              return { id: "user-1", email: "owner@example.com", name: "Owner" };
            }
            return null;
          },
        }),
      }),
    },
  };
  const res = await worker.request(
    "/api/bot/suggestions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
    env
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.source, "template");
  assert.ok(Array.isArray(body.suggestions) && body.suggestions.length === 5);
});

test("Hono bot recent-posts returns 400 FB_TOKEN_EXPIRED when Facebook invalidates the session", async () => {
  const secret = "bot-recent-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const encryptedToken = await encryptFacebookToken("expired-fb-token", { ENCRYPTION_KEY: "test-enc" });
  const env = {
    JWT_SECRET: secret,
    ENCRYPTION_KEY: "test-enc",
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes("FROM users")) {
              return { id: "user-1", email: "owner@example.com", name: "Owner" };
            }
            if (sql.includes("FROM facebook_pages")) {
              return { id: "485880817945228", userId: "user-1", accessToken: encryptedToken };
            }
            return null;
          },
        }),
      }),
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      {
        error: {
          message:
            "Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.",
          type: "OAuthException",
          code: 190,
        },
      },
      { status: 400 }
    );

  try {
    const res = await worker.request(
      "/api/bot/recent-posts/485880817945228",
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, "FB_TOKEN_EXPIRED");
    assert.match(body.error, /session has been invalidated/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook publisher falls back to single video post when carousel card upload returns Invalid request", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, params: new URLSearchParams(options.body) });
    if (calls.length === 1) {
      // Simulate carousel unpublished video card failing with Facebook Invalid request
      return Response.json(
        { error: { message: "Invalid request.", code: 100 } },
        { status: 400 }
      );
    }
    // Single video fallback succeeds
    return Response.json({ id: "fallback-video-post-1" });
  };

  try {
    const postId = await publishFacebookPost("282987781568016", "page-token", {
      postType: "carousel",
      caption: "Promo video",
      videoUrl: "https://cdn.example/video.mp4",
      carouselCards: [
        { type: "video", mediaUrl: "https://cdn.example/video.mp4", headline: "Video" },
        { type: "image", isPageCard: true, headline: "Page" },
      ],
    });
    assert.equal(postId, "fallback-video-post-1");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].params.get("published"), "false");
    assert.equal(calls[1].params.get("published"), null);
    assert.equal(calls[1].params.get("file_url"), "https://cdn.example/video.mp4");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook publisher preserves binary upload error details when transient R2 binary and URL fallbacks fail", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).startsWith("https://graph-video.facebook.com/")) {
      return Response.json(
        { error: { message: "Temporary media chunk glitch.", code: 1363041 } },
        { status: 502 }
      );
    }
    return Response.json({ error: { message: "URL scrape timeout.", code: 1363042 } }, { status: 400 });
  };

  const env = {
    MEDIA_BUCKET: {
      get: async () => ({
        httpMetadata: { contentType: "video/mp4" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      }),
    },
  };

  try {
    await assert.rejects(
      publishFacebookPost(
        "282987781568016",
        "page-token",
        {
          postType: "video",
          caption: "Test video",
          videoUrl: "https://eza-post-3kv.pages.dev/api/v1/media/scheduled%2Fdemo.mp4",
        },
        {},
        env
      ),
      /URL scrape timeout\. \(FB #1363042\) \[binary: Temporary media chunk glitch\. \(FB #1363041\)\]/
    );
    assert.deepEqual(requestedUrls, [
      "https://graph-video.facebook.com/v21.0/282987781568016/videos",
      "https://graph-video.facebook.com/v21.0/282987781568016/videos",
      "https://graph.facebook.com/v21.0/282987781568016/videos",
      "https://graph-video.facebook.com/v21.0/282987781568016/videos",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook publisher aborts immediately without retry storms on security or FB #1 rejections", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json({ error: { message: "Invalid request.", code: 1 } }, { status: 400 });
  };

  const env = {
    MEDIA_BUCKET: {
      get: async () => ({
        httpMetadata: { contentType: "video/mp4" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      }),
    },
  };

  try {
    await assert.rejects(
      publishFacebookPost(
        "282987781568016",
        "page-token",
        {
          postType: "carousel",
          caption: "Promo",
          videoUrl: "https://eza-post-3kv.pages.dev/api/v1/media/scheduled%2Fdemo.mp4",
          carouselCards: [{ type: "video", mediaUrl: "https://eza-post-3kv.pages.dev/api/v1/media/scheduled%2Fdemo.mp4" }],
        },
        {},
        env
      ),
      /Invalid request\. \(FB #1\)/
    );
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono Facebook OAuth status reflects configured Worker secrets", async () => {
  const unconfigured = await worker.request("/api/auth/facebook/status", undefined, {});
  assert.equal(unconfigured.status, 200);
  assert.deepEqual(await unconfigured.json(), { success: true, configured: false });

  const configured = await worker.request("/api/auth/facebook/status", undefined, {
    FB_APP_ID: "app-123",
    FB_APP_SECRET: "secret-456",
    FACEBOOK_REDIRECT_URI: "https://eza-post-3kv.pages.dev/api/auth/facebook/callback",
  });
  assert.equal(configured.status, 200);
  assert.deepEqual(await configured.json(), { success: true, configured: true });
});

test("Hono connect-cookie supports direct Facebook Page Access Token and reports permissions", async () => {
  const secret = "fb-direct-token-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const upsertedPages = [];
  const env = {
    JWT_SECRET: secret,
    ENCRYPTION_KEY: "test-enc",
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes("FROM users")) {
              return { id: "user-1", email: "owner@example.com", name: "Owner" };
            }
            if (sql.includes("INSERT INTO facebook_pages") || sql.includes("UPDATE facebook_pages")) {
              return {
                id: "282987781568016",
                name: "girl ordinary",
                category: "Digital creator",
                picture: "https://cdn.example/pic.jpg",
              };
            }
            if (sql.includes("FROM facebook_pages")) {
              return upsertedPages.find((p) => p.id === args[0]) || null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes("INSERT INTO facebook_pages") || sql.includes("UPDATE facebook_pages")) {
              upsertedPages.push({
                id: "282987781568016",
                name: "girl ordinary",
                category: "Digital creator",
                picture: "https://cdn.example/pic.jpg",
              });
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/v21.0/me") {
      return Response.json({
        id: "282987781568016",
        name: "girl ordinary",
        category: "Digital creator",
        picture: { data: { url: "https://cdn.example/pic.jpg" } },
      });
    }
    return Response.json({ error: { message: "Unexpected endpoint" } }, { status: 400 });
  };

  const validPageToken = "EAA" + "A".repeat(60);
  try {
    const res = await worker.request(
      "/api/user/pages/connect-cookie",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cookieOrToken: validPageToken, accessToken: validPageToken }),
      },
      env
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.hasPublishToken, true);
    assert.equal(body.hasPublishPermissions, true);
    assert.equal(body.pagesCount, 1);
    assert.equal(body.pages[0].id, "282987781568016");
    assert.equal(body.pages[0].isProfile, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook publisher falls back to 3-phase resumable upload when direct binary and file_url uploads fail", async () => {
  const originalFetch = globalThis.fetch;
  const phases = [];
  globalThis.fetch = async (url, options) => {
    if (options.body instanceof FormData) {
      const uploadPhase = options.body.get("upload_phase");
      if (uploadPhase === "transfer") {
        phases.push(`transfer:${options.body.get("upload_session_id")}`);
        return Response.json({ start_offset: "0", end_offset: "4" });
      }
      phases.push("direct-binary");
      return Response.json({ error: { message: "Multipart chunk failed.", code: 1363041 } }, { status: 500 });
    }
    const form = new URLSearchParams(options.body);
    const uploadPhase = form.get("upload_phase");
    if (uploadPhase === "start") {
      phases.push(`start:${form.get("file_size")}`);
      return Response.json({ upload_session_id: "sess-1", video_id: "resumable-video-99", start_offset: "0" });
    }
    if (uploadPhase === "finish") {
      phases.push(`finish:${form.get("upload_session_id")}`);
      return Response.json({ success: true });
    }
    phases.push(`file_url:${new URL(String(url)).hostname}`);
    return Response.json({ error: { message: "URL fetch failed.", code: 1363042 } }, { status: 400 });
  };

  const env = {
    MEDIA_BUCKET: {
      get: async () => ({
        httpMetadata: { contentType: "video/mp4" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      }),
    },
  };

  try {
    const id = await publishFacebookPost(
      "282987781568016",
      "page-token",
      {
        postType: "video",
        caption: "Resumable test",
        videoUrl: "https://eza-post-3kv.pages.dev/api/v1/media/scheduled%2Fdemo.mp4",
      },
      {},
      env
    );
    assert.equal(id, "resumable-video-99");
    assert.deepEqual(phases, [
      "direct-binary",
      "file_url:graph-video.facebook.com",
      "file_url:graph.facebook.com",
      "start:4",
      "transfer:sess-1",
      "finish:sess-1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("processScheduledPostById marks security/invalid-session posts failed immediately and pauses page schedule", async () => {
  const originalFetch = globalThis.fetch;
  const encryptedPageToken = await encryptFacebookToken("expired-token", {
    ENCRYPTION_KEY: "test-page-key",
  });
  globalThis.fetch = async () =>
    Response.json(
      { error: { message: "Error validating access token: The session has been invalidated.", code: 190 } },
      { status: 400 }
    );

  let postUpdateData = null;
  let pagePausedData = null;
  const prisma = {
    scheduledPost: {
      findUnique: async () => ({
        id: "post-sec-1",
        userId: "user-123",
        caption: "Hello",
        postType: "image",
        scheduleTime: new Date(),
        attempts: 0,
        accounts: ["page-123"],
        mediaFiles: ["https://cdn.example/photo.jpg"],
        publishedIds: [],
        status: postUpdateData?.status || "scheduled",
        lastError: postUpdateData?.lastError || null,
      }),
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => { postUpdateData = data; },
    },
    facebookPage: {
      findMany: async () => [{
        id: "page-123",
        accessToken: encryptedPageToken,
        enableSchedule: true,
      }],
      update: async ({ data }) => { pagePausedData = data; },
    },
  };

  try {
    const refreshed = await processScheduledPostById({ ENCRYPTION_KEY: "test-page-key" }, "post-sec-1", prisma);
    assert.equal(refreshed.status, "failed");
    assert.deepEqual(pagePausedData, { enableSchedule: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker default export exposes scheduled handler for Cloudflare Cron triggers", () => {
  assert.equal(typeof worker.fetch, "function");
  assert.equal(typeof worker.scheduled, "function");
});

test("Hono connect-cookie returns 400 with Graph error when EAA token is invalid (no cleanCookie ReferenceError)", async () => {
  const secret = "fb-invalid-token-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const env = {
    JWT_SECRET: secret,
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: "user-1", email: "owner@example.com", name: "Owner" }),
          run: async () => ({ meta: { changes: 1 } }),
        }),
      }),
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ error: { message: "Invalid OAuth access token.", code: 190 } }, { status: 400 });

  const badFbToken = "EAA" + "B".repeat(50);
  try {
    const res = await worker.request(
      "/api/user/pages/connect-cookie",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cookieOrToken: badFbToken, accessToken: badFbToken }),
      },
      env
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error, "Invalid OAuth access token.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono page settings updates facebook_pages table and GET /user/pages honors enableSchedule", async () => {
  const secret = "page-settings-sync-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const userState = {
    id: "user-1",
    email: "owner@example.com",
    name: "Owner",
    facebookId: "fb-1",
    facebookName: "Owner FB",
    facebookAccessToken: "active_extension_session",
    pageSettings: "[]",
  };
  const pageState = {
    id: "page-1",
    userId: "user-1",
    name: "Demo Page",
    accessToken: "active_extension_session",
    picture: "https://cdn.example/p.jpg",
    category: "Digital creator",
    isConnected: 1,
    isSelected: 1,
    enableBot: 1,
    enableSchedule: 1,
    enableInbox: 0,
  };

  const env = {
    JWT_SECRET: secret,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes("FROM users")) return { ...userState };
            if (sql.includes("FROM facebook_pages")) return { ...pageState };
            return null;
          },
          all: async () => {
            if (sql.includes("FROM facebook_pages")) return { results: [{ ...pageState }] };
            return { results: [] };
          },
          run: async () => {
            if (sql.startsWith("UPDATE users SET")) {
              userState.pageSettings = args[0];
            }
            if (sql.startsWith("UPDATE facebook_pages SET")) {
              // Expect enableBot, enableSchedule, enableInbox, updatedAt, ...whereArgs
              if (sql.includes("enableSchedule = ?")) {
                const cols = sql.split("SET ")[1].split(" WHERE")[0].split(", ").map((c) => c.split(" = ")[0]);
                cols.forEach((col, i) => {
                  if (col in pageState && col !== "updatedAt") pageState[col] = args[i];
                });
              }
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
  };

  const saveRes = await worker.request(
    "/api/user/pages/settings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pageId: "page-1",
        settings: { enableBot: false, enableSchedule: false, enableInbox: true },
      }),
    },
    env
  );
  assert.equal(saveRes.status, 200);
  assert.equal(pageState.enableBot, 0);
  assert.equal(pageState.enableSchedule, 0);
  assert.equal(pageState.enableInbox, 1);

  const listRes = await worker.request(
    "/api/user/pages",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
    env
  );
  assert.equal(listRes.status, 200);
  const listed = await listRes.json();
  const demo = listed.accounts.find((a) => a.id === "page-1");
  assert.deepEqual(demo.settings, {
    enableBot: false,
    enableSchedule: false,
    enableInbox: true,
  });
});

test("Facebook publisher publishes Reels via /video_reels and rupload.facebook.com", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const strUrl = String(url);
    if (strUrl.startsWith("https://rupload.facebook.com/")) {
      calls.push({
        step: "rupload",
        auth: options.headers.Authorization,
        offset: options.headers.offset,
        fileSize: options.headers.file_size,
        bodyLen: options.body.byteLength,
      });
      return Response.json({ success: true });
    }
    const form = new URLSearchParams(options.body);
    const phase = form.get("upload_phase");
    calls.push({ step: phase, videoState: form.get("video_state") });
    if (phase === "start") {
      return Response.json({
        video_id: "reel-vid-777",
        upload_url: "https://rupload.facebook.com/video-upload/v21.0/reel-vid-777",
      });
    }
    if (phase === "finish") {
      return Response.json({ success: true });
    }
    return Response.json({}, { status: 400 });
  };

  const env = {
    MEDIA_BUCKET: {
      get: async () => ({
        arrayBuffer: async () => new Uint8Array([9, 8, 7, 6, 5]).buffer,
      }),
    },
  };

  try {
    const id = await publishFacebookPost(
      "282987781568016",
      "oauth-page-token",
      {
        postType: "reels",
        caption: "Khmer Reel Demo",
        videoUrl: "https://eza-post-3kv.pages.dev/api/v1/media/scheduled%2Freel.mp4",
      },
      {},
      env
    );
    assert.equal(id, "reel-vid-777");
    assert.deepEqual(calls, [
      { step: "start", videoState: null },
      { step: "rupload", auth: "OAuth oauth-page-token", offset: "0", fileSize: "5", bodyLen: 5 },
      { step: "finish", videoState: "PUBLISHED" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono Facebook data-deletion verifies signed_request and returns confirmation code", async () => {
  const appSecret = "test-fb-app-secret";
  const payloadObj = { user_id: "fb-user-999", algorithm: "HMAC-SHA256", issued_at: 1700000000 };
  const toB64Url = (bytes) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = toB64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(payloadB64))
  );
  const signedRequest = `${toB64Url(sigBytes)}.${payloadB64}`;

  let deletedForUserId = null;
  let clearedFbUser = false;
  const env = {
    FB_APP_SECRET: appSecret,
    FRONTEND_URL: "https://eza-post-3kv.pages.dev",
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.startsWith("UPDATE users SET")) {
              clearedFbUser = true;
              return { id: "local-user-9", facebookId: null };
            }
            if (sql.includes("FROM users")) {
              return { id: "local-user-9", facebookId: "fb-user-999" };
            }
            return null;
          },
          run: async () => {
            if (sql.startsWith("DELETE FROM facebook_pages")) deletedForUserId = args[0];
            if (sql.startsWith("UPDATE users SET")) clearedFbUser = true;
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
  };

  const badRes = await worker.request(
    "/api/auth/facebook/data-deletion",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: "bad.sig" }),
    },
    env
  );
  assert.equal(badRes.status, 400);

  const okRes = await worker.request(
    "/api/auth/facebook/data-deletion",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: signedRequest }),
    },
    env
  );
  assert.equal(okRes.status, 200);
  const body = await okRes.json();
  assert.ok(body.confirmation_code);
  assert.equal(
    body.url,
    `https://eza-post-3kv.pages.dev/privacy?deletion_code=${body.confirmation_code}`
  );
  assert.equal(deletedForUserId, "local-user-9");
  assert.equal(clearedFbUser, true);
});

test("Hono post-media upload stores video/image in MEDIA_BUCKET and returns HTTPS URL", async () => {
  const secret = "post-media-upload-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  let storedKey = null;
  const env = {
    JWT_SECRET: secret,
    FRONTEND_URL: "https://eza-post-3kv.pages.dev",
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: "user-1", email: "owner@example.com", name: "Owner" }),
        }),
      }),
    },
    MEDIA_BUCKET: {
      put: async (key) => {
        storedKey = key;
      },
    },
  };

  const form = new FormData();
  form.set("media", new File([new Uint8Array([1, 2, 3, 4])], "demo.mp4", { type: "video/mp4" }));
  const res = await worker.request(
    "/api/upload/post-media",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
    env
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.resourceType, "video");
  assert.ok(storedKey.startsWith("scheduled/"));
  assert.ok(body.url.startsWith("https://eza-post-3kv.pages.dev/api/v1/media/"));
});

test("Facebook publisher creates Video CTA AdCreative and publishes effective_object_story_id to timeline", async () => {
  const originalFetch = globalThis.fetch;
  const steps = [];
  globalThis.fetch = async (url, options) => {
    const strUrl = String(url);
    if (strUrl.includes("/act_999111/advideos")) {
      steps.push("advideos");
      return Response.json({ id: "ad-vid-101" });
    }
    if (strUrl.includes("/act_999111/adcreatives")) {
      const form = new URLSearchParams(options.body);
      const spec = JSON.parse(form.get("object_story_spec"));
      steps.push(`adcreatives:${spec.video_data.call_to_action.type}`);
      return Response.json({ id: "creative-202" });
    }
    if (strUrl.includes("/creative-202")) {
      steps.push("story-lookup");
      return Response.json({ effective_object_story_id: "282987781568016_777888" });
    }
    if (strUrl.includes("/282987781568016_777888")) {
      const form = new URLSearchParams(options.body);
      steps.push(`publish:${form.get("is_published")}`);
      return Response.json({ id: "282987781568016_777888", success: true });
    }
    return Response.json({}, { status: 400 });
  };

  try {
    const postId = await publishFacebookPost(
      "282987781568016",
      "EAAG-page-token-012345678901234567890123456789",
      {
        postType: "video",
        caption: "Shop now CTA demo",
        videoUrl: "https://cdn.example/demo.mp4",
        thumbnailUrl: "https://cdn.example/thumb.jpg",
        carouselCards: [
          {
            isMetaConfig: true,
            format: "video_cta",
            adAccountId: "act_999111",
            headline: "Buy Today",
            description: "Limited offer",
            link: "https://moneaa.site/shop",
            cta: "SHOP_NOW",
            isDarkPost: false,
          },
        ],
        _adsContext: {
          adsToken: "EAAB-ads-token-012345678901234567890123456789",
          adAccounts: [{ id: "act_999111" }],
        },
      },
      { name: "Demo Shop" },
      {}
    );
    assert.equal(postId, "282987781568016_777888");
    assert.deepEqual(steps, [
      "advideos",
      "adcreatives:SHOP_NOW",
      "story-lookup",
      "publish:true",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono connect-cookie persists Extension EAAB adsToken and adAccounts cleanly", async () => {
  const originalFetch = globalThis.fetch;
  const secret = "ads-sync-secret";
  const encryptionKey = "ads-sync-encryption-key-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  const userState = {
    id: "user-1",
    email: "owner@example.com",
    name: "Owner",
    facebookId: null,
    facebookName: null,
    facebookAccessToken: null,
    pageSettings: "[]",
  };
  const pageState = new Map();

  globalThis.fetch = async (url) => {
    const strUrl = String(url);
    if (strUrl.includes("/me?")) {
      return Response.json({ id: "fb-u1", name: "Owner FB" });
    }
    if (strUrl.includes("/me/permissions")) {
      return Response.json({ data: [{ permission: "pages_manage_posts", status: "granted" }] });
    }
    if (strUrl.includes("/me/accounts")) {
      return Response.json({
        data: [{ id: "pg-1", name: "My Page", access_token: "EAAG-page-token-012345678901234567890123456789" }],
      });
    }
    return Response.json({});
  };

  const env = {
    JWT_SECRET: secret,
    ENCRYPTION_KEY: encryptionKey,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.startsWith("UPDATE users SET")) {
              const setMatch = sql.match(/UPDATE users SET (.+?) WHERE /);
              if (setMatch) {
                setMatch[1].split(",").forEach((part, idx) => {
                  const col = part.split("=")[0].trim();
                  if (col) userState[col] = args[idx];
                });
              }
              return { ...userState };
            }
            if (sql.startsWith("INSERT INTO facebook_pages")) {
              const colsMatch = sql.match(/INSERT INTO facebook_pages \(([^)]+)\)/);
              const row = {
                isConnected: 1,
                isSelected: 1,
                enableSchedule: 1,
              };
              if (colsMatch) {
                colsMatch[1].split(",").forEach((col, idx) => {
                  const name = col.trim();
                  if (name) row[name] = args[idx];
                });
              }
              if (row.id) pageState.set(row.id, row);
              return row;
            }
            if (sql.startsWith("UPDATE facebook_pages SET")) {
              const targetId = args[args.length - 1];
              const existing = pageState.get(targetId) || { id: targetId };
              const setMatch = sql.match(/UPDATE facebook_pages SET (.+?) WHERE /);
              if (setMatch) {
                setMatch[1].split(",").forEach((part, idx) => {
                  const col = part.split("=")[0].trim();
                  if (col) existing[col] = args[idx];
                });
              }
              if (existing.id) pageState.set(existing.id, existing);
              return { ...existing };
            }
            if (sql.includes("FROM users")) return { ...userState };
            if (sql.includes("FROM facebook_pages")) return pageState.get(args[0]) || null;
            return null;
          },
          all: async () => {
            if (sql.includes("FROM facebook_pages")) return { results: Array.from(pageState.values()) };
            return { results: [] };
          },
          run: async () => ({ meta: { changes: 1 } }),
        }),
      }),
    },
  };

  try {
    const res = await worker.request(
      "/api/user/pages/connect-cookie",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: "EAAG-user-token-012345678901234567890123456789",
          adsToken: "EAAB-ads-token-0123456789012345678901234567890",
          adAccounts: [{ id: "act_555666", accountId: "555666", name: "Main Ads", currency: "USD" }],
        }),
      },
      env
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.adAccountsCount, 1);

    const listRes = await worker.request(
      "/api/user/pages",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      env
    );
    assert.equal(listRes.status, 200);
    const listed = await listRes.json();
    assert.equal(listed.hasAdsToken, true);
    assert.equal(listed.adAccounts.length, 1);
    assert.equal(listed.adAccounts[0].id, "act_555666");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hono edge live-stream creates RTMP stream URL without requiring BACKEND_ORIGIN", async () => {
  const originalFetch = globalThis.fetch;
  const secret = "edge-live-secret";
  const token = await createAuthToken(
    { id: "user-1", email: "owner@example.com" },
    new TextEncoder().encode(secret)
  );
  globalThis.fetch = async (url) => {
    if (String(url).includes("/live_videos")) {
      return Response.json({
        id: "live-333",
        secure_stream_url: "rtmps://live-api-s.facebook.com:443/rtmp/FB-333-0-Abc",
      });
    }
    return Response.json({}, { status: 400 });
  };

  const env = {
    JWT_SECRET: secret,
    DB: {
      prepare: (sql) => ({
        bind: () => ({
          first: async () => ({ id: "user-1", email: "owner@example.com", name: "Owner" }),
          all: async () => {
            if (sql.includes("FROM facebook_pages")) {
              return {
                results: [
                  {
                    id: "pg-live-1",
                    userId: "user-1",
                    name: "Live Page",
                    accessToken: "EAAG-live-token-012345678901234567890123456789",
                    isConnected: 1,
                  },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    },
  };

  try {
    const activeRes = await worker.request(
      "/api/live-stream/active",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      env
    );
    assert.equal(activeRes.status, 200);
    const activeBody = await activeRes.json();
    assert.equal(activeBody.edgeOnly, true);

    const createRes = await worker.request(
      "/api/live-stream/create-rtmp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pageIds: ["pg-live-1"], title: "Night Live" }),
      },
      env
    );
    assert.equal(createRes.status, 200);
    const createdBody = await createRes.json();
    assert.equal(createdBody.success, true);
    assert.equal(createdBody.streams[0].streamUrl, "rtmps://live-api-s.facebook.com:443/rtmp/FB-333-0-Abc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
