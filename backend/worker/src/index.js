import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth.js";
import posts from "./routes/posts.js";
import users from "./routes/users.js";
import uploads from "./routes/uploads.js";
import bot from "./routes/bot.js";
import credits from "./routes/credits.js";
import analytics from "./routes/analytics.js";
import tools from "./routes/tools.js";
import bio from "./routes/bio.js";
import subtitles from "./routes/subtitles.ts";
import { proxyToBackend } from "./lib/proxy.js";
import { processScheduledPosts } from "./lib/scheduled-posts.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "Range", "X-CSRF-Token", "Cookie"],
    exposeHeaders: ["Content-Length", "Content-Range", "Set-Cookie"],
    maxAge: 86400,
  })
);

app.get("/healthz", (c) =>
  c.json({
    status: "ok",
    runtime: "cloudflare-workers",
  })
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "EZA POST Unified API & Subtitles AI - Cloudflare Edge Worker",
    version: "1.0.0",
    edge_location: c.req.raw.cf?.colo || "local-edge",
    r2_ready: Boolean(c.env.MEDIA_BUCKET),
    ai_ready: Boolean(c.env.AI),
  })
);

const apiHealth = (c) =>
  c.json({
    status: "ok",
    runtime: "cloudflare-workers",
    api: "hono",
  });

app.get("/api/health", apiHealth);
app.get("/api/system/health", apiHealth);
app.on("HEAD", ["/api/health", "/api/system/health"], (c) => c.body(null, 200));

app.route("/api/auth", auth);
app.route("/api/posts", posts);
app.route("/api/user", users);
app.route("/api/upload", uploads);
app.route("/api/bot", bot);
app.route("/api/credits", credits);
app.route("/api/analytics", analytics);
app.route("/api/tools", tools);
app.route("/api/bio", bio);
app.route("/", subtitles);
app.all("/api/*", proxyToBackend);
app.all("/uploads/*", proxyToBackend);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;

export async function scheduled(_controller, env, context) {
  context.waitUntil(processScheduledPosts(env));
}

export class GeminiProxyDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const targetUrl = request.headers.get("x-gemini-target-url");
    if (!targetUrl) {
      return Response.json({ error: "Missing x-gemini-target-url" }, { status: 400 });
    }
    const body = await request.text();
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
