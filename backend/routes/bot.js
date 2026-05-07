// ============================================================
// 🤖 routes/bot.js - API Routes for Auto-Reply Bot Rules
// ============================================================

const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const ai = require("../utils/ai");
const { requireAuth } = require("../utils/auth"); // ✅ Auth Middleware

// ✅ No global initialization needed, created per user on first use

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
    const status = await prisma.botStatus.findUnique({
      where: { userId: req.user.id }
    });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { pageSettings: true }
    });

    res.json({
      success: true,
      rules,
      enabled: status?.enabled ?? true,
      pageSettings: user?.pageSettings || []
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

// ✅ Update bot settings for a specific page
router.put("/page-settings", requireAuth, async (req, res) => {
  const { pageId, enabled } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    let pageSettings = user.pageSettings;

    // Ensure it's an array
    if (!pageSettings || !Array.isArray(pageSettings)) {
      pageSettings = [];
    }

    const existingIdx = pageSettings.findIndex(s => s.pageId === pageId);
    if (existingIdx > -1) {
      pageSettings[existingIdx].enableBot = enabled;
    } else {
      pageSettings.push({ pageId, enableBot: enabled });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { pageSettings }
    });

    res.json({ success: true, message: "Page bot settings updated" });
  } catch (err) {
    console.error("❌ PUT /page-settings error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update page bot settings" });
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
  const { reply, ruleType, scope, postId, attachmentUrl } = req.body;
  const keyword = req.body.keyword || "*";

  if (!reply)
    return res.status(400).json({ success: false, message: "Reply is required" });

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
  const { reply, ruleType, scope, postId, attachmentUrl } = req.body;
  const keyword = req.body.keyword || "*";
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
  console.log(`🗑️ Deletion attempt for Rule ID: ${id} by User: ${req.user.id}`);
  try {
    const rule = await prisma.botRule.findFirst({
      where: { id: id, userId: req.user.id }
    });
    
    if (!rule) {
      console.warn(`⚠️ Rule ${id} not found or not owned by user.`);
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    await prisma.botRule.delete({ where: { id: id } });
    console.log(`✅ Rule ${id} deleted successfully.`);

    res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    console.error("❌ DELETE /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete rule", error: err.message });
  }
});

// ✅ Update bot settings (User-Specific Toggle)
router.put("/settings", requireAuth, async (req, res) => {
  const { enabled } = req.body;
  try {
    await prisma.botStatus.upsert({
      where: { userId: req.user.id },
      update: { enabled },
      create: { userId: req.user.id, enabled }
    });
    res.json({ success: true, message: "Bot settings updated" });
  } catch (err) {
    console.error("❌ PUT /settings error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update bot settings" });
  }
});

module.exports = router;
