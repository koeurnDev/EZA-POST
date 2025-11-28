// ============================================================
// 🤖 routes/bot.js - API Routes for Auto-Reply Bot Rules
// ============================================================

const express = require("express");
const router = express.Router();
const { BotRule, BotStatus } = require("../models/BotRule");
const ai = require("../utils/ai");

// ============================================================
// 🧠 Initialize bot_status (if missing)
// ============================================================
(async () => {
  try {
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

// ✅ Get all bot rules
router.get("/rules", async (req, res) => {
  try {
    const rules = await BotRule.find().sort({ createdAt: -1 });
    const status = await BotStatus.findOne();
    res.json({
      success: true,
      rules,
      enabled: status?.enabled ?? true,
    });
  } catch (err) {
    console.error("❌ GET /rules error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Generate AI Suggestions
router.post("/suggestions", async (req, res) => {
  try {
    const suggestions = await ai.generateSuggestions();
    res.json({ success: true, suggestions });
  } catch (err) {
    console.error("❌ POST /suggestions error:", err.message);
    res.status(500).json({ success: false, message: "Failed to generate suggestions" });
  }
});

// ✅ Add new rule
router.post("/rules", async (req, res) => {
  const { keyword, reply } = req.body;
  if (!keyword || !reply)
    return res.status(400).json({ success: false, message: "Keyword and reply required" });

  try {
    const rule = await BotRule.create({ keyword, reply, enabled: true });
    res.json({ success: true, rule });
  } catch (err) {
    console.error("❌ POST /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to add rule" });
  }
});

// ✅ Update rule
router.put("/rules/:id", async (req, res) => {
  const { id } = req.params;
  const { keyword, reply } = req.body;
  try {
    await BotRule.findByIdAndUpdate(id, { keyword, reply });
    res.json({ success: true, message: "Rule updated" });
  } catch (err) {
    console.error("❌ PUT /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update rule" });
  }
});

// ✅ Toggle rule enabled/disabled
router.patch("/rules/:id", async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  try {
    await BotRule.findByIdAndUpdate(id, { enabled });
    res.json({ success: true, message: "Rule toggled" });
  } catch (err) {
    console.error("❌ PATCH /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to toggle rule" });
  }
});

// ✅ Delete rule
router.delete("/rules/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await BotRule.findByIdAndDelete(id);
    res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    console.error("❌ DELETE /rules error:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete rule" });
  }
});

// ✅ Update bot settings (Global Toggle)
router.put("/settings", async (req, res) => {
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
