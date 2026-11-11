import { jwtVerify, SignJWT } from "jose";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import bcrypt from "bcryptjs";
import qrcode from "qrcode";
import { getPrisma } from "../lib/prisma.js";
import { proxyToBackend } from "../lib/proxy.js";
import {
  createOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotp,
} from "../lib/two-factor.js";
import {
  encryptFacebookToken,
  exchangeFacebookCode,
  fetchFacebookPages,
  fetchFacebookProfile,
} from "../lib/facebook.js";
import { sendPasswordResetEmail } from "../lib/email.js";

const auth = new Hono();
const oneDayInSeconds = 24 * 60 * 60;
const facebookStateCookie = "fb_oauth_state";
const facebookScopes = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_user_content",
  "publish_video",
];

auth.post("/login", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const { email, password } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return c.json({ success: false, error: "Email and password are required" }, 400);
  }

  try {
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return c.json({ success: false, error: "Invalid email or password" }, 401);
    }

    const secret = getJwtSecret(c.env);
    if (user.twoFactorEnabled) {
      const tempToken = await createAuthToken(
        { id: user.id, email: user.email, scope: "2fa_pending" },
        secret,
        "5m"
      );

      return c.json({ success: true, requires2FA: true, tempToken });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = await createAuthToken({ id: user.id, email: user.email }, secret);

    const secure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "token", token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "None" : "Lax",
      path: "/",
      maxAge: oneDayInSeconds,
    });

    return c.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Hono login failed:", error);
    return c.json({ success: false, error: "Internal server error during login" }, 500);
  }
});

auth.post("/login/2fa", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const { tempToken, code } = body ?? {};
  if (typeof tempToken !== "string" || typeof code !== "string" || !tempToken || !code) {
    return c.json({ success: false, error: "Token and code required" }, 400);
  }

  try {
    const { payload } = await jwtVerify(tempToken, getJwtSecret(c.env), {
      algorithms: ["HS256"],
    });
    if (payload.scope !== "2fa_pending" || typeof payload.id !== "string") {
      return c.json({ success: false, error: "Invalid or expired session" }, 401);
    }

    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return c.json({ success: false, error: "Invalid or expired session" }, 401);
    }

    const secret = await decryptTotpSecret(user.twoFactorSecret, c.env);
    if (!(await verifyTotp(code, secret))) {
      return c.json({ success: false, error: "Invalid 2FA Code" }, 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = await createAuthToken({ id: user.id, email: user.email }, getJwtSecret(c.env));
    setAuthCookie(c, token);
    return c.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error?.code?.startsWith("ERR_JWT") || error?.code?.startsWith("ERR_JWS")) {
      return c.json({ success: false, error: "Invalid or expired session" }, 401);
    }
    console.error("Hono 2FA login failed:", error);
    return c.json({ success: false, error: "2FA login failed" }, 500);
  }
});

auth.post("/register", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const { email, password, name } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return c.json({ success: false, error: "Email and password are required" }, 400);
  }
  if (password.length < 6) {
    return c.json({ success: false, error: "Password must be at least 6 characters long." }, 400);
  }
  if (name !== undefined && typeof name !== "string") {
    return c.json({ success: false, error: "Name must be a string" }, 400);
  }
  if (
    typeof c.env.JWT_SECRET !== "string" ||
    !c.env.JWT_SECRET ||
    (!c.env.HYPERDRIVE?.connectionString && !c.env.DATABASE_URL && !c.env.DB)
  ) {
    return c.json({
      success: false,
      error: "Registration service is not configured.",
    }, 503);
  }

  try {
    const prisma = getPrisma(c.env);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return c.json({
        success: false,
        error: "User already exists. Please log in instead.",
      }, 409);
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name: name || "User",
        plan: "free",
        role: "user",
      },
    });

    const token = await createAuthToken({ id: newUser.id, email: newUser.email }, getJwtSecret(c.env));
    const secure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "token", token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "None" : "Lax",
      path: "/",
      maxAge: oneDayInSeconds,
    });

    console.warn("Worker registration does not send the legacy SMTP welcome email.");
    return c.json({
      success: true,
      message: "Registration successful",
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    }, 201);
  } catch (error) {
    if (error?.code === "P2002") {
      return c.json({
        success: false,
        error: "User already exists. Please log in instead.",
      }, 409);
    }

    console.error("Hono registration failed:", error);
    return c.json({
      success: false,
      error: "Registration failed. Please try again later.",
    }, 500);
  }
});

auth.post("/forgot-password", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "A valid JSON body is required" }, 400);
  }
  if (typeof body?.email !== "string" || !body.email.trim()) {
    return c.json({ error: "Email is required." }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const message = "If that email exists, we've sent a reset link.";
  try {
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return c.json({ success: true, message });

    const tokenBytes = crypto.getRandomValues(new Uint8Array(20));
    const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const tokenHash = await hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const frontendUrl = parseFrontendUrl(c.env);
    const resetUrl = new URL("/reset-password", frontendUrl);
    resetUrl.searchParams.set("token", token);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expiresAt,
      },
    });
    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString(), c.env);
    } catch (error) {
      await prisma.user.updateMany({
        where: { id: user.id, resetPasswordToken: tokenHash },
        data: { resetPasswordToken: null, resetPasswordExpires: null },
      });
      throw error;
    }

    return c.json({ success: true, message });
  } catch (error) {
    console.error("Hono forgot-password failed:", error);
    return c.json({ error: "Unable to send a password reset email right now." }, 503);
  }
});

auth.post("/reset-password", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "A valid JSON body is required" }, 400);
  }
  if (typeof body?.token !== "string" || !body.token ||
      typeof body?.password !== "string" || !body.password) {
    return c.json({ error: "Token and password are required." }, 400);
  }
  if (body.password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters." }, 400);
  }

  try {
    const tokenHash = await hashPasswordResetToken(body.token);
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: { in: [tokenHash, body.token] },
        resetPasswordExpires: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!user) {
      return c.json({ error: "Password reset token is invalid or has expired." }, 400);
    }

    const result = await prisma.user.updateMany({
      where: {
        id: user.id,
        resetPasswordToken: { in: [tokenHash, body.token] },
        resetPasswordExpires: { gt: new Date() },
      },
      data: {
        password: await bcrypt.hash(body.password, 10),
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
    if (result.count === 0) {
      return c.json({ error: "Password reset token is invalid or has expired." }, 400);
    }

    return c.json({
      success: true,
      message: "Password has been reset successfully! You can now login.",
    });
  } catch (error) {
    console.error("Hono reset-password failed:", error);
    return c.json({ error: "Internal server error." }, 500);
  }
});

auth.post("/logout", async (c) => {
  const hasLegacySession = c.req.header("Cookie")?.includes("connect.sid=");
  if (hasLegacySession) {
    return proxyToBackend(c);
  }

  const secure = new URL(c.req.url).protocol === "https:";
  deleteCookie(c, "token", {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/",
  });
  deleteCookie(c, "connect.sid", {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/",
  });
  return c.json({ success: true, message: "Logged out successfully" });
});

auth.get("/telegram/config", (c) => {
  return c.json({
    botUsername: c.env.TELEGRAM_BOT_USERNAME || "eza_ocr_bot",
  });
});

auth.post("/telegram", async (c) => {
  let data;
  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const { id, first_name, last_name, username, photo_url, hash, auth_date } = data ?? {};
  if (!id || !hash) {
    return c.json({ error: "Telegram User ID and hash are required." }, 400);
  }

  const botToken = c.env.TELEGRAM_BOT_TOKEN || "8289587681:AAFLIUkaDdTN6yub83ezSctYpVNOR7ZCpyU";

  // Verify HMAC using SubtleCrypto
  try {
    const { hash: _h, ...dataToCheck } = data;
    const dataCheckString = Object.keys(dataToCheck)
      .sort()
      .map((k) => `${k}=${dataToCheck[k]}`)
      .join("\n");

    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
    const key = await crypto.subtle.importKey(
      "raw",
      secretKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(dataCheckString));
    const hexSignature = Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");

    if (hexSignature !== hash) {
      return c.json({ error: "Invalid Telegram authentication payload." }, 401);
    }

    const authDateNum = Number(auth_date);
    if (isNaN(authDateNum) || Date.now() / 1000 - authDateNum > 86400) {
      return c.json({ error: "Telegram authentication has expired." }, 401);
    }
  } catch (err) {
    console.error("Telegram signature verification error:", err);
    return c.json({ error: "Telegram signature verification error." }, 500);
  }

  try {
    const prisma = getPrisma(c.env);
    const secret = getJwtSecret(c.env);
    const telegramIdStr = String(id);
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || `Telegram User #${id}`;
    const syntheticEmail = username ? `${username.toLowerCase()}@telegram.org` : `tg_${id}@ezapost.com`;

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ telegramId: telegramIdStr }, { email: syntheticEmail }],
      },
    });

    if (!user) {
      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email: syntheticEmail,
          name: fullName,
          password: hashedPassword,
          telegramId: telegramIdStr,
          telegramUsername: username || null,
          avatar: photo_url || null,
        },
      });
      console.log(`🎉 New user registered via Telegram Worker: ${user.id} (@${username || id})`);
    } else if (!user.telegramId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramId: telegramIdStr,
          telegramUsername: username || user.telegramUsername,
          avatar: user.avatar || photo_url,
        },
      });
    }

    const token = await createAuthToken({ id: user.id, email: user.email }, secret);
    const secure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "token", token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "None" : "Lax",
      path: "/",
      maxAge: oneDayInSeconds,
    });

    return c.json({
      success: true,
      message: "ចូលគណនីជាមួយ Telegram បានជោគជ័យ!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        avatar: user.avatar,
      },
      token,
    });
  } catch (err) {
    console.error("Telegram login worker error:", err);
    return c.json({ error: "Telegram login failed. Please try again." }, 500);
  }
});

const handleGoogleAuthStart = (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const frontendUrl = c.env.FRONTEND_URL || "https://eza-post-3kv.pages.dev";
  if (!clientId) {
    return c.redirect(`${frontendUrl}/login?error=google_not_configured`);
  }
  const origin = new URL(c.req.url).origin;
  const currentPath = new URL(c.req.url).pathname;
  const redirectUri = currentPath.includes("/sso/")
    ? `${origin}/api/auth/sso/callback`
    : `${origin}/api/auth/google/callback`;
  const state = crypto.randomUUID();
  const secure = new URL(c.req.url).protocol === "https:";

  setCookie(c, "google_oauth_state", JSON.stringify({ state, redirectUri }), {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/api/auth",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

const handleGoogleAuthCallback = async (c) => {
  const { code, state, error } = c.req.query();
  const frontendUrl = c.env.FRONTEND_URL || "https://eza-post-3kv.pages.dev";
  const secure = new URL(c.req.url).protocol === "https:";
  const cookieData = getCookie(c, "google_oauth_state");

  deleteCookie(c, "google_oauth_state", {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/api/auth",
  });

  if (error || !code) {
    return c.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  let savedState, savedRedirectUri;
  try {
    const parsed = JSON.parse(cookieData);
    savedState = parsed.state;
    savedRedirectUri = parsed.redirectUri;
  } catch {
    savedState = cookieData;
  }

  if (savedState && state && savedState !== state) {
    console.error("Google OAuth state mismatch");
    return c.redirect(`${frontendUrl}/login?error=sso_state_invalid`);
  }

  try {
    const origin = new URL(c.req.url).origin;
    const currentPath = new URL(c.req.url).pathname;
    const defaultUri = currentPath.includes("/sso/")
      ? `${origin}/api/auth/sso/callback`
      : `${origin}/api/auth/google/callback`;
    const redirectUri = savedRedirectUri || defaultUri;

    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials are not configured in Worker.");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange failed:", tokenRes.status, errBody);
      throw new Error(`Google token exchange failed with status ${tokenRes.status}`);
    }

    const { access_token } = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      throw new Error("Failed to fetch Google user profile");
    }

    const profile = await userRes.json();
    const { sub: googleId, email, name, picture } = profile;

    if (!email) {
      return c.redirect(`${frontendUrl}/login?error=google_missing_email`);
    }

    const prisma = getPrisma(c.env);
    const secret = getJwtSecret(c.env);

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: email.toLowerCase() }],
      },
    });

    if (!user) {
      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || "Google User",
          password: hashedPassword,
          googleId,
          googleEmail: email.toLowerCase(),
          avatar: picture || null,
          role: "user",
          plan: "free",
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, googleEmail: email.toLowerCase(), avatar: user.avatar || picture },
      });
    }

    const token = await createAuthToken({ id: user.id, email: user.email }, secret);
    setCookie(c, "token", token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "None" : "Lax",
      path: "/",
      maxAge: oneDayInSeconds,
    });

    return c.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=Google`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return c.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }
};

auth.get("/google", handleGoogleAuthStart);
auth.get("/google/callback", handleGoogleAuthCallback);
auth.get("/sso/google", handleGoogleAuthStart);
auth.get("/sso/callback", handleGoogleAuthCallback);

auth.post("/google", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const { credential } = body ?? {};
  if (!credential) {
    return c.json({ error: "Google credential ID token is required." }, 400);
  }

  try {
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!tokenInfoRes.ok) {
      return c.json({ error: "Invalid or expired Google credential." }, 401);
    }

    const payload = await tokenInfoRes.json();
    const { sub: googleId, email, name, picture } = payload;
    if (!email) {
      return c.json({ error: "Google account did not provide an email." }, 400);
    }

    const prisma = getPrisma(c.env);
    const secret = getJwtSecret(c.env);

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: email.toLowerCase() }],
      },
    });

    if (!user) {
      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || "Google User",
          password: hashedPassword,
          googleId,
          googleEmail: email.toLowerCase(),
          avatar: picture || null,
        },
      });
      console.log(`🎉 New user registered via Google Worker: ${user.id} (${user.email})`);
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, googleEmail: email.toLowerCase(), avatar: user.avatar || picture },
      });
    }

    const token = await createAuthToken({ id: user.id, email: user.email }, secret);
    const secure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "token", token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "None" : "Lax",
      path: "/",
      maxAge: oneDayInSeconds,
    });

    return c.json({
      success: true,
      message: "ចូលគណនីជាមួយ Google បានជោគជ័យ!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        avatar: user.avatar,
      },
      token,
    });
  } catch (err) {
    console.error("Google login worker error:", err);
    return c.json({ error: "Google login failed. Please try again." }, 500);
  }
});

auth.get("/facebook", requireAuth, async (c) => {
  try {
    const appId = requiredFacebookEnv(c.env, "FB_APP_ID");
    const redirectUri = new URL(requiredFacebookEnv(c.env, "FACEBOOK_REDIRECT_URI"));
    if (redirectUri.protocol !== "https:" && redirectUri.hostname !== "localhost") {
      throw new Error("FACEBOOK_REDIRECT_URI must use HTTPS.");
    }

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri.toString());
    authUrl.searchParams.set("scope", facebookScopes.join(","));
    authUrl.searchParams.set("state", state);

    const secure = new URL(c.req.url).protocol === "https:";
    setCookie(c, facebookStateCookie, state, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/api/auth/facebook",
      maxAge: 600,
    });
    return c.redirect(authUrl.toString(), 302);
  } catch (error) {
    console.error("Hono Facebook OAuth start failed:", error);
    return c.json({ error: "Facebook connection is not configured." }, 503);
  }
});

auth.get("/facebook/callback", requireAuth, async (c) => {
  const secure = new URL(c.req.url).protocol === "https:";
  const cookieState = getCookie(c, facebookStateCookie);
  const query = c.req.query();
  deleteCookie(c, facebookStateCookie, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/api/auth/facebook",
  });

  if (!cookieState || !query.state || cookieState !== query.state || query.error || !query.code) {
    return redirectToFacebookResult(c, "error");
  }

  try {
    const prisma = getPrisma(c.env);
    const { id: userId } = c.get("authUser");
    const { accessToken, expiresAt } = await exchangeFacebookCode(query.code, c.env);
    const profile = await fetchFacebookProfile(accessToken);
    const pages = await fetchFacebookPages(accessToken);

    const existingFacebookOwner = await prisma.user.findFirst({
      where: { facebookId: profile.id, id: { not: userId } },
      select: { id: true },
    });
    if (existingFacebookOwner) {
      return redirectToFacebookResult(c, "error");
    }

    const conflictingPage = pages.length
      ? await prisma.facebookPage.findFirst({
          where: { id: { in: pages.map((page) => page.id) }, userId: { not: userId } },
          select: { id: true },
        })
      : null;
    if (conflictingPage) {
      return redirectToFacebookResult(c, "error");
    }

    const encryptedUserToken = await encryptFacebookToken(accessToken, c.env);
    const pageUpserts = await Promise.all(pages.map(async (page) => {
      const encryptedPageToken = await encryptFacebookToken(page.accessToken, c.env);
      return {
        where: { id: page.id },
        update: {
          name: page.name,
          accessToken: encryptedPageToken,
          picture: page.picture,
          category: page.category,
          isConnected: true,
          updatedAt: new Date(),
        },
        create: {
          id: page.id,
          userId,
          name: page.name,
          accessToken: encryptedPageToken,
          picture: page.picture,
          category: page.category,
          isConnected: true,
          isSelected: true,
        },
      };
    }));

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          facebookId: profile.id,
          facebookAccessToken: encryptedUserToken,
          facebookTokenExpiresAt: expiresAt,
          facebookName: profile.name,
        },
      }),
      ...pageUpserts.map((data) => prisma.facebookPage.upsert(data)),
    ]);
    return redirectToFacebookResult(c, "success");
  } catch (error) {
    console.error("Hono Facebook OAuth callback failed:", error);
    return redirectToFacebookResult(c, "error");
  }
});

auth.delete("/facebook", requireAuth, async (c) => {
  const userId = c.get("authUser").id;
  try {
    const prisma = getPrisma(c.env);
    await prisma.$transaction([
      prisma.facebookPage.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          facebookId: null,
          facebookAccessToken: null,
          facebookName: null,
          facebookTokenExpiresAt: null,
          pageSettings: [],
        },
      }),
    ]);
    return c.json({ success: true, message: "Facebook account disconnected." });
  } catch (error) {
    console.error("Hono Facebook disconnect failed:", error);
    return c.json({ error: "Failed to disconnect account." }, 500);
  }
});

auth.post("/2fa/setup", requireAuth, async (c) => {
  try {
    const user = c.get("authUser");
    const secret = generateTotpSecret();
    const encryptedSecret = await encryptTotpSecret(secret, c.env);
    const otpAuthUri = createOtpAuthUri(user.email, secret);
    const qrCode = await qrcode.toDataURL(otpAuthUri);

    await getPrisma(c.env).user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: encryptedSecret,
        twoFactorVerified: false,
      },
    });

    return c.json({ success: true, ok: true, qrCode });
  } catch (error) {
    console.error("Hono 2FA setup failed:", error);
    return c.json({ success: false, error: "2FA setup failed" }, 500);
  }
});

auth.post("/2fa/verify", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const code = body?.token || body?.code;
  if (typeof code !== "string" || !code) {
    return c.json({ success: false, error: "OTP is required." }, 400);
  }

  try {
    const user = c.get("authUser");
    const prisma = getPrisma(c.env);
    const savedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!savedUser?.twoFactorSecret) {
      return c.json({ success: false, error: "2FA not initialized." }, 400);
    }

    const secret = await decryptTotpSecret(savedUser.twoFactorSecret, c.env);
    if (!(await verifyTotp(code, secret))) {
      return c.json({ success: false, error: "Invalid OTP." }, 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorVerified: true },
    });
    return c.json({ success: true, ok: true });
  } catch (error) {
    console.error("Hono 2FA verify failed:", error);
    return c.json({ success: false, error: "2FA verification failed" }, 500);
  }
});

auth.post("/2fa/disable", requireAuth, async (c) => {
  try {
    const user = c.get("authUser");
    await getPrisma(c.env).user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorVerified: false,
      },
    });
    return c.json({ success: true, ok: true });
  } catch (error) {
    console.error("Hono 2FA disable failed:", error);
    return c.json({ success: false, error: "2FA disable failed" }, 500);
  }
});

auth.get("/status", async (c) => {
  const cookieToken = getCookie(c, "token");
  const authorization = c.req.header("Authorization");
  const token = cookieToken || (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);

  if (!token) {
    if (c.req.header("Cookie")?.includes("connect.sid=")) {
      return proxyToBackend(c);
    }
    return c.json({ authenticated: false, user: null });
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret(c.env), {
      algorithms: ["HS256"],
    });
    if (typeof payload.id !== "string") {
      return c.json({ authenticated: false, user: null });
    }

    const foundUser = await getPrisma(c.env).user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        facebookId: true,
        facebookName: true,
        avatar: true,
        facebookPages: true,
        credits: true,
        plan: true,
      },
    });

    if (!foundUser) {
      return c.json({ authenticated: false, user: null });
    }

    return c.json({
      authenticated: true,
      user: {
        ...foundUser,
        connectedPages: foundUser.facebookPages,
        ...(foundUser.id === "demo_user_001" ? { isDemo: true } : {}),
      },
    });
  } catch (error) {
    if (error?.code?.startsWith("ERR_JWT") || error?.code?.startsWith("ERR_JWS")) {
      return c.json({ authenticated: false, user: null });
    }

    console.error("Hono auth status failed:", error);
    return c.json({ authenticated: false, user: null, error: "Auth status check failed" }, 500);
  }
});

export async function requireAuth(c, next) {
  const cookieToken = getCookie(c, "token");
  const authorization = c.req.header("Authorization");
  const token = cookieToken || (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);

  if (!token) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret(c.env), {
      algorithms: ["HS256"],
    });
    if (typeof payload.id !== "string") {
      return c.json({ success: false, error: "Invalid or expired token" }, 401);
    }

    const user = await getPrisma(c.env).user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return c.json({ success: false, error: "User no longer exists. Please log in again." }, 401);
    }

    c.set("authUser", user);
    await next();
  } catch (error) {
    if (error?.code?.startsWith("ERR_JWT") || error?.code?.startsWith("ERR_JWS")) {
      return c.json({ success: false, error: "Invalid or expired token" }, 401);
    }
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono auth middleware failed:", { diagnosticId, errorCode, error });
    return c.json(
      { success: false, error: "Authentication check failed", diagnosticId, errorCode },
      500
    );
  }
}

function setAuthCookie(c, token) {
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, "token", token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/",
    maxAge: oneDayInSeconds,
  });
}

function getJwtSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET Worker secret is not configured.");
  }

  return new TextEncoder().encode(env.JWT_SECRET);
}

function requiredFacebookEnv(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} Worker secret is not configured.`);
  }
  return value;
}

async function hashPasswordResetToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseFrontendUrl(env) {
  const value = requiredFacebookEnv(env, "FRONTEND_URL");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("FRONTEND_URL must use HTTPS.");
  }
  return url;
}

function redirectToFacebookResult(c, result) {
  const frontendUrl = parseFrontendUrl(c.env);
  const destination = new URL(result === "success" ? "/connections" : "/settings", frontendUrl);
  if (result !== "success") destination.searchParams.set("error", "fb_auth_failed");
  return c.redirect(destination.toString(), 302);
}

export function createAuthToken(claims, secret, expiresIn = "1d") {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export default auth;
