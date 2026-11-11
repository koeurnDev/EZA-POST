// ============================================================
// 🔷 Telegram Authentication Router (Telegram Login Widget)
// ============================================================

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../../utils/prisma");
const { generateToken, setAuthCookie } = require("../../utils/auth");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8289587681:AAFLIUkaDdTN6yub83ezSctYpVNOR7ZCpyU";
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "eza_ocr_bot";

/**
 * ℹ️ GET /api/auth/telegram/config
 * Returns bot config for the frontend widget
 */
router.get("/config", (req, res) => {
  res.json({
    botUsername: TELEGRAM_BOT_USERNAME,
  });
});

/**
 * 🔐 Verify Telegram HMAC signature
 * Telegram algorithm:
 * 1. secret_key = SHA256(bot_token)
 * 2. data_check_string = key=value pairs sorted alphabetically (excluding hash)
 * 3. HMAC-SHA256(data_check_string, secret_key) == hash
 */
function verifyTelegramAuth(data) {
  if (!data || !data.hash) return false;

  const { hash, ...dataToCheck } = data;
  const dataCheckString = Object.keys(dataToCheck)
    .sort()
    .map((key) => `${key}=${dataToCheck[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
  const calculatedHmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculatedHmac !== hash) return false;

  // Check auth_date not expired (24h validity)
  const authDate = Number(data.auth_date);
  if (isNaN(authDate) || Date.now() / 1000 - authDate > 86400) {
    return false;
  }

  return true;
}

/**
 * 🚀 POST /api/auth/telegram
 * Handles Telegram Login Widget callback
 */
router.post("/", async (req, res) => {
  const data = req.body || {};
  const { id, first_name, last_name, username, photo_url } = data;

  if (!id) {
    return res.status(400).json({ error: "Telegram User ID is required." });
  }

  // 1. Verify HMAC
  if (!verifyTelegramAuth(data)) {
    return res.status(401).json({ error: "Invalid Telegram authentication payload." });
  }

  try {
    const telegramIdStr = String(id);
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || `Telegram User #${id}`;
    const syntheticEmail = username ? `${username.toLowerCase()}@telegram.org` : `tg_${id}@ezapost.com`;

    // 2. Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ telegramId: telegramIdStr }, { email: syntheticEmail }],
      },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
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
      console.log(`🎉 New user registered via Telegram: ${user.id} (@${username || id})`);
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

    // 3. Set auth session
    const token = generateToken(user);
    setAuthCookie(res, user);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      avatar: user.avatar,
    };

    return res.json({
      success: true,
      message: "ចូលគណនីជាមួយ Telegram បានជោគជ័យ!",
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("❌ Telegram login failed:", err.message);
    return res.status(500).json({ error: "Telegram login failed. Please try again." });
  }
});

module.exports = router;
