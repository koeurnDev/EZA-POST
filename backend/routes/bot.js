// ============================================================
// 🤖 routes/bot.js - API Routes for Auto-Reply Bot Rules
// ============================================================

const express = require("express");
const router = express.Router();
const { BotRule } = require("../models/BotRule");
const BotStatus = require("../models/BotStatus");
const ai = require("../utils/ai");
const { requireAuth } = require("../utils/auth"); // ✅ Added Auth Middleware

// 🔍 Debug Imports
console.log("🔍 BotRule Import Type:", typeof BotRule, BotRule ? "Defined" : "Undefined");
console.log("🔍 BotStatus Import Type:", typeof BotStatus, BotStatus ? "Defined" : "Undefined");

// ============================================================
// 🧠 Initialize bot_status (if missing)
// ============================================================
(async () => {
  try {
    if (!BotStatus) {
      console.error("❌ BotStatus model is undefined!");
      return;
    }
    const count = await BotStatus.countDocuments();
    if (count === 0) {
      await BotStatus.create({ enabled: true });
      console.log("✅ bot_status initialized");
    }
  } catch (err) {
    console.error("❌ bot_status init failed:", err.message);
  }
})();

// ============================================================
// 🧩 Routes
// ============================================================

// ✅ Get all bot rules for the logged-in user
router.get("/rules", requireAuth, async (req, res) => {
  try {
    if (!BotRule) throw new Error("BotRule model is undefined");
    if (!BotStatus) throw new Error("BotStatus model is undefined");

    const rules = await BotRule.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const status = await BotStatus.findOne();
    res.json({
      success: true,
      rules,
      enabled: status?.enabled ?? true,
    });
  } catch (err) {
    console.error("❌ GET /rules error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ✅ Generate AI Suggestions
router.post("/suggestions", requireAuth, async (req, res) => {
  try {
    const suggestions = await ai.generateSuggestions();
    res.json({ success: true, suggestions });
  } catch (err) {
    console.error("❌ POST /suggestions error:", err.message);
    res.status(500).json({ success: false, message: "Failed to generate suggestions" });
  }
});

// ✅ Add new rule
router.post("/rules", requireAuth, async (req, res) => {
  const { keyword, reply, ruleType, scope, postId, attachmentUrl } = req.body;

  if (!keyword || !reply)
    return res.status(400).json({ success: false, message: "Keyword and reply required" });

  try {
    const rule = await BotRule.create({
      userId: req.user.id,
      keyword,
      reply,
      ruleType: ruleType || "KEYWORD",
      scope: scope || "ALL",
      scope: scope || "ALL",
      postId: postId || undefined,
      attachmentUrl: attachmentUrl || null,
      enabled: true
    });
    res.json({ success: true, rule });
  } catch (err) {
    console.error("❌ POST /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to add rule" });
  }
});

// ✅ Update rule
router.put("/rules/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { keyword, reply, ruleType, scope, postId, attachmentUrl } = req.body;
  try {
    // Ensure user owns the rule
    const rule = await BotRule.findOne({ _id: id, userId: req.user.id });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    rule.keyword = keyword;
    rule.reply = reply;
    rule.ruleType = ruleType;
    rule.scope = scope;
    rule.postId = postId;
    rule.attachmentUrl = attachmentUrl;

    await rule.save();
    res.json({ success: true, message: "Rule updated" });
  } catch (err) {
    console.error("❌ PUT /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update rule" });
  }
});

// ✅ Toggle rule enabled/disabled
router.patch("/rules/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  try {
    const rule = await BotRule.findOne({ _id: id, userId: req.user.id });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    rule.enabled = enabled;
    await rule.save();
    res.json({ success: true, message: "Rule toggled" });
  } catch (err) {
    console.error("❌ PATCH /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to toggle rule" });
  }
});

// ✅ Delete rule
router.delete("/rules/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await BotRule.deleteOne({ _id: id, userId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: "Rule not found" });

    res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    console.error("❌ DELETE /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete rule" });
  }
});

// ✅ Update bot settings (Global Toggle)
router.put("/settings", requireAuth, async (req, res) => {
  const { enabled } = req.body;
  try {
    await BotStatus.findOneAndUpdate({}, { enabled }, { upsert: true });
    res.json({ success: true, message: "Bot settings updated" });
  } catch (err) {
    console.error("❌ PUT /settings error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update bot settings" });
  }
});

module.exports = router;
