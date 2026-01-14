// ============================================================
// 🤖 routes/bot.js - API Routes for Auto-Reply Bot Rules
// ============================================================

const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const ai = require("../utils/ai");
const { requireAuth } = require("../utils/auth"); // ✅ Auth Middleware

// ============================================================
// 🧠 Initialize bot_status (if missing)
// ============================================================
(async () => {
  try {
    const count = await prisma.botStatus.count();
    if (count === 0) {
      await prisma.botStatus.create({ data: { enabled: true } });
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
    const rules = await prisma.botRule.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    const status = await prisma.botStatus.findFirst();
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
      error: err.message
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
    const rule = await prisma.botRule.create({
      data: {
        userId: req.user.id,
        keyword,
        reply,
        ruleType: ruleType || "KEYWORD",
        scope: scope || "ALL",
        postId: postId || null,
        attachmentUrl: attachmentUrl || null,
        enabled: true
      }
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
    const rule = await prisma.botRule.findFirst({
      where: { id: id, userId: req.user.id }
    });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    const updatedRule = await prisma.botRule.update({
      where: { id: id },
      data: {
        keyword,
        reply,
        ruleType: ruleType || "KEYWORD",
        scope: scope || "ALL",
        postId: postId || null,
        attachmentUrl: attachmentUrl || null
      }
    });

    res.json({ success: true, message: "Rule updated", rule: updatedRule });
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
    const rule = await prisma.botRule.findFirst({
      where: { id: id, userId: req.user.id }
    });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    await prisma.botRule.update({
      where: { id: id },
      data: { enabled: enabled }
    });

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
    // Check ownership first
    const rule = await prisma.botRule.findFirst({
      where: { id: id, userId: req.user.id }
    });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    await prisma.botRule.delete({ where: { id: id } });

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
    const status = await prisma.botStatus.findFirst();
    if (status) {
      await prisma.botStatus.update({
        where: { id: status.id },
        data: { enabled }
      });
    } else {
      await prisma.botStatus.create({ data: { enabled } });
    }
    res.json({ success: true, message: "Bot settings updated" });
  } catch (err) {
    console.error("❌ PUT /settings error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update bot settings" });
  }
});

module.exports = router;
