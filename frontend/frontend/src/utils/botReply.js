// ============================================================
// 🤖 botReply.js — Final Version (Validated & Optimized)
// ============================================================
// Handles auto-reply rule validation, filtering, grouping, and
// suggestion generation for the KR_POST automation system.
// ============================================================

/* -------------------------------------------------------------------------- */
/* ✅ RuleValidator — Ensures all rules meet proper structure and policy       */
/* -------------------------------------------------------------------------- */
export const RuleValidator = {
  /**
   * Validate a keyword for a bot rule.
   * @param {string} keyword - The trigger keyword for the rule.
   * @param {Array} existingRules - Current rules to check for duplicates.
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validateKeyword: (keyword, existingRules = []) => {
    const errors = [];

    if (!keyword || keyword.trim().length === 0)
      errors.push("Keyword cannot be empty");

    if (keyword.trim().length < 2)
      errors.push("Keyword must be at least 2 characters long");

    if (keyword.length > 50)
      errors.push("Keyword must be 50 characters or less");

    // Check for duplicates (case-insensitive)
    const duplicate = existingRules.find(
      (r) => r.keyword.toLowerCase().trim() === keyword.toLowerCase().trim()
    );
    if (duplicate) errors.push("This keyword already exists");

    // Reserved system words
    const reserved = ["admin", "bot", "system", "facebook", "tiktok"];
    if (reserved.includes(keyword.toLowerCase().trim()))
      errors.push("This keyword is reserved and cannot be used");

    return { isValid: errors.length === 0, errors };
  },

  /**
   * Validate a reply message for a rule.
   * @param {string} reply - The message text to send as a reply.
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validateReply: (reply) => {
    const errors = [];

    if (!reply || reply.trim().length === 0)
      errors.push("Reply message cannot be empty");

    if (reply.trim().length < 5)
      errors.push("Reply message must be at least 5 characters long");

    if (reply.length > 500)
      errors.push("Reply message must be 500 characters or less");

    // Basic inappropriate filter
    const badWords = ["spam", "scam", "fake", "cheat"];
    const lower = reply.toLowerCase();
    if (badWords.some((word) => lower.includes(word)))
      errors.push("Reply contains inappropriate content");

    return { isValid: errors.length === 0, errors };
  },

  /**
   * Validate both keyword and reply together.
   * @param {string} keyword
   * @param {string} reply
   * @param {Array} existingRules
   * @returns {{isValid: boolean, errors: string[], keywordErrors: string[], replyErrors: string[]}}
   */
  validateRule: (keyword, reply, existingRules = []) => {
    const kw = RuleValidator.validateKeyword(keyword, existingRules);
    const rp = RuleValidator.validateReply(reply);
    return {
      isValid: kw.isValid && rp.isValid,
      errors: [...kw.errors, ...rp.errors],
      keywordErrors: kw.errors,
      replyErrors: rp.errors,
    };
  },
};

/* -------------------------------------------------------------------------- */
/* ✅ RuleManager — Sorting, Grouping, and Suggestions                        */
/* -------------------------------------------------------------------------- */
export const RuleManager = {
  /**
   * Sort rules by specific criteria.
   * @param {Array} rules - List of rules.
   * @param {'keyword'|'created'|'enabled'} sortBy - Sorting key.
   * @returns {Array}
   */
  sortRules: (rules = [], sortBy = "keyword") => {
    const sorted = [...rules];
    switch (sortBy) {
      case "keyword":
        return sorted.sort((a, b) => a.keyword.localeCompare(b.keyword));
      case "created":
        return sorted.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
      case "enabled":
        return sorted.sort((a, b) =>
          a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1
        );
      default:
        return sorted;
    }
  },

  /**
   * Filter rules based on keyword or reply content.
   * @param {Array} rules
   * @param {string} term
   * @returns {Array}
   */
  filterRules: (rules = [], term = "") => {
    if (!term) return rules;
    const t = term.toLowerCase();
    return rules.filter(
      (r) =>
        r.keyword.toLowerCase().includes(t) ||
        r.reply.toLowerCase().includes(t)
    );
  },

  /**
   * Group rules by enabled/disabled state.
   * @param {Array} rules
   * @returns {{enabled: Array, disabled: Array, all: Array}}
   */
  groupRules: (rules = []) => ({
    enabled: rules.filter((r) => r.enabled),
    disabled: rules.filter((r) => !r.enabled),
    all: rules,
  }),

  /**
   * Generate helpful default auto-reply suggestions.
   * @returns {Array<{keyword: string, reply: string, category: string}>}
   */
  generateSuggestions: () => [
    {
      keyword: "thank you",
      reply: "You're welcome! 😊 We really appreciate your support!",
      category: "gratitude",
    },
    {
      keyword: "help",
      reply: "How can I assist you? Feel free to message us anytime!",
      category: "support",
    },
    {
      keyword: "when",
      reply: "We'll share the schedule soon! Stay tuned for updates.",
      category: "timing",
    },
    {
      keyword: "where",
      reply: "You can find all details in our bio/profile link! 🌐",
      category: "location",
    },
    {
      keyword: "how to",
      reply: "Great question! Visit our website for full instructions. 💡",
      category: "instructions",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* ✅ Exports                                                                 */
/* -------------------------------------------------------------------------- */
export default RuleValidator;
