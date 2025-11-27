// ============================================================
// 🤖 botRules.js — FINAL VERSION (EZA_POST)
// ============================================================
// Handles bot rule creation, validation, storage, import/export,
// and analytics for the EZA_POST auto-reply system.
// ============================================================

/* -------------------------------------------------------------------------- */
/* 🧩 Default Rule Templates                                                  */
/* -------------------------------------------------------------------------- */
export const DEFAULT_RULES = [
  {
    id: "1",
    keyword: "price",
    reply: "Please check our website for current pricing information! 📊",
    enabled: true,
    category: "pricing",
    priority: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    keyword: "cost",
    reply: "For pricing details, visit our website or send us a message! 💰",
    enabled: true,
    category: "pricing",
    priority: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    keyword: "how much",
    reply:
      "The price varies depending on the package. Check our website for details! 🏷️",
    enabled: true,
    category: "pricing",
    priority: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    keyword: "thank you",
    reply: "You're welcome! 😊 We appreciate your support!",
    enabled: true,
    category: "gratitude",
    priority: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: "5",
    keyword: "thanks",
    reply: "You're very welcome! 🙏 Thank you for engaging with us!",
    enabled: true,
    category: "gratitude",
    priority: 2,
    createdAt: new Date().toISOString(),
  },
];

/* -------------------------------------------------------------------------- */
/* 🗂️ Categories & Priorities                                                */
/* -------------------------------------------------------------------------- */
export const RULE_CATEGORIES = {
  pricing: {
    name: "Pricing",
    icon: "💰",
    color: "#10b981",
    description: "Questions about costs and pricing",
  },
  gratitude: {
    name: "Gratitude",
    icon: "🙏",
    color: "#f59e0b",
    description: "Thank you messages and appreciation",
  },
  support: {
    name: "Support",
    icon: "🛠️",
    color: "#3b82f6",
    description: "Help and technical support questions",
  },
  information: {
    name: "Information",
    icon: "ℹ️",
    color: "#8b5cf6",
    description: "General information requests",
  },
  timing: {
    name: "Timing",
    icon: "⏰",
    color: "#ef4444",
    description: "Questions about schedules and deadlines",
  },
  custom: {
    name: "Custom",
    icon: "⚙️",
    color: "#6b7280",
    description: "User-defined custom rules",
  },
};

export const PRIORITY_LEVELS = {
  1: { name: "High", color: "#ef4444", description: "Immediate response" },
  2: { name: "Medium", color: "#f59e0b", description: "Quick response" },
  3: { name: "Low", color: "#10b981", description: "Standard response" },
};

/* -------------------------------------------------------------------------- */
/* ✅ RulesValidator — Validation System                                     */
/* -------------------------------------------------------------------------- */
export class RulesValidator {
  static validateKeyword(keyword, existingRules = []) {
    const errors = [];
    const warnings = [];

    if (!keyword || keyword.trim().length === 0)
      return { isValid: false, errors: ["Keyword cannot be empty"], warnings };

    const trimmed = keyword.trim();

    if (trimmed.length > 50) errors.push("Keyword must be 50 characters or less");
    if (trimmed.length < 2) errors.push("Keyword must be at least 2 characters long");
    if (/[<>{}[\]\\]/.test(trimmed))
      errors.push("Keyword contains invalid characters");

    const duplicate = existingRules.find(
      (r) => r.keyword.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) errors.push("This keyword already exists");

    const common = ["the", "and", "or", "but", "is", "are"];
    if (common.includes(trimmed.toLowerCase()))
      warnings.push("Common words may trigger too many replies");

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateReply(reply) {
    const errors = [];
    const warnings = [];

    if (!reply || reply.trim().length === 0)
      return { isValid: false, errors: ["Reply message cannot be empty"], warnings };

    const trimmed = reply.trim();

    if (trimmed.length > 500)
      errors.push("Reply message must be 500 characters or less");
    if (trimmed.length < 5)
      errors.push("Reply message must be at least 5 characters long");
    if (/[<>{}[\]\\]/.test(trimmed))
      errors.push("Reply contains invalid characters");

    if (trimmed.length < 10)
      warnings.push("Short replies might seem impersonal");

    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    if (!emojiRegex.test(trimmed))
      warnings.push("Consider adding emojis for better engagement");

    if (trimmed === trimmed.toUpperCase() && trimmed.length > 5)
      warnings.push("Avoid using all caps—it can look like shouting");

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateRule(rule, existingRules = []) {
    const k = this.validateKeyword(rule.keyword, existingRules);
    const r = this.validateReply(rule.reply);
    return {
      isValid: k.isValid && r.isValid,
      errors: [...k.errors, ...r.errors],
      warnings: [...k.warnings, ...r.warnings],
    };
  }

  static sanitizeRule(rule) {
    return {
      ...rule,
      id: rule.id || this.generateRuleId(),
      keyword: rule.keyword.trim(),
      reply: rule.reply.trim(),
      category: rule.category || "custom",
      priority: rule.priority || 3,
      enabled: rule.enabled ?? true,
      createdAt: rule.createdAt || new Date().toISOString(),
    };
  }

  static generateRuleId() {
    return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

/* -------------------------------------------------------------------------- */
/* 🧠 RulesManager — Storage + CRUD Logic                                    */
/* -------------------------------------------------------------------------- */
export class RulesManager {
  constructor(storageKey = "eza_post_bot_rules") {
    this.storageKey = storageKey;
    this.rules = this.loadRules();
  }

  loadRules() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  }

  saveRules(rules) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rules));
      this.rules = rules;
      return true;
    } catch (e) {
      console.error("❌ Failed to save rules:", e);
      return false;
    }
  }

  getAllRules() {
    return this.rules;
  }
  getEnabledRules() {
    return this.rules.filter((r) => r.enabled);
  }
  getRuleById(id) {
    return this.rules.find((r) => r.id === id);
  }

  addRule(data) {
    const rule = RulesValidator.sanitizeRule(data);
    const valid = RulesValidator.validateRule(rule, this.rules);
    if (!valid.isValid) return { success: false, details: valid };
    return { success: this.saveRules([...this.rules, rule]), rule };
  }

  updateRule(id, updates) {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) return { success: false, error: "Rule not found" };

    const updated = { ...this.rules[index], ...updates };
    const others = this.rules.filter((r) => r.id !== id);
    const valid = RulesValidator.validateRule(updated, others);

    if (!valid.isValid) return { success: false, details: valid };
    return { success: this.saveRules([...others, updated]), rule: updated };
  }

  deleteRule(id) {
    const filtered = this.rules.filter((r) => r.id !== id);
    return { success: this.saveRules(filtered) };
  }

  toggleRule(id) {
    const rule = this.getRuleById(id);
    if (!rule) return { success: false, error: "Rule not found" };
    return this.updateRule(id, { enabled: !rule.enabled });
  }

  searchRules(term) {
    if (!term) return this.rules;
    const t = term.toLowerCase();
    return this.rules.filter(
      (r) =>
        r.keyword.toLowerCase().includes(t) ||
        r.reply.toLowerCase().includes(t) ||
        r.category.toLowerCase().includes(t)
    );
  }

  getStats() {
    const total = this.rules.length;
    const enabled = this.getEnabledRules().length;
    const disabled = total - enabled;

    const categoryStats = Object.keys(RULE_CATEGORIES).reduce((acc, c) => {
      acc[c] = this.rules.filter((r) => r.category === c).length;
      return acc;
    }, {});

    const avgLength =
      total > 0
        ? Math.round(
          this.rules.reduce((a, r) => a + r.reply.length, 0) / total
        )
        : 0;

    return {
      total,
      enabled,
      disabled,
      enabledPct: total > 0 ? Math.round((enabled / total) * 100) : 0,
      categoryStats,
      avgLength,
    };
  }

  exportRules(filename = null) {
    const data = {
      rules: this.rules,
      exportedAt: new Date().toISOString(),
      total: this.rules.length,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      filename ||
      `eza_post_rules_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, filename: a.download };
  }

  async importRules(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          if (!json.rules) throw new Error("Invalid file format");

          const validRules = [];
          for (const rule of json.rules) {
            const clean = RulesValidator.sanitizeRule(rule);
            const val = RulesValidator.validateRule(clean, validRules);
            if (val.isValid) validRules.push(clean);
          }

          if (validRules.length === 0) throw new Error("No valid rules found");

          const merged = [
            ...this.rules,
            ...validRules.filter(
              (r) =>
                !this.rules.find(
                  (x) => x.keyword.toLowerCase() === r.keyword.toLowerCase()
                )
            ),
          ];

          this.saveRules(merged);
          resolve({ success: true, totalAfterImport: merged.length });
        } catch (err) {
          reject(new Error(`Import failed: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 🌐 Default Export                                                         */
/* -------------------------------------------------------------------------- */
export const rulesManager = new RulesManager();

export default {
  RulesValidator,
  RulesManager,
  rulesManager,
  DEFAULT_RULES,
  RULE_CATEGORIES,
  PRIORITY_LEVELS,
};
