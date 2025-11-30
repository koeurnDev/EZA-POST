// ============================================================
// 🤖 BotReplySettings.jsx — V3 Redesign (Inline Form)
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
  Suspense,
} from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Save,
  X,
  Power,
  Filter
} from "lucide-react";
import api from "../utils/api";

// ✅ Main Component
const BotReplySettingsContent = React.memo(({ isDemo }) => {
  const [rules, setRules] = useState([]);
  // Form State
  const [formData, setFormData] = useState({
    ruleType: "KEYWORD", // KEYWORD, REGEX
    scope: "ALL",        // ALL, SPECIFIC
    postId: "",
    keyword: "",
    reply: "",
  });
  const [editingId, setEditingId] = useState(null);

  const [isEnabled, setIsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const deferredSearch = useDeferredValue(searchTerm);

  // ✅ Load rules from API
  const fetchRules = useCallback(async () => {
    try {
      if (isDemo) {
        setRules([
          { id: 1, ruleType: "KEYWORD", scope: "ALL", keyword: "price", reply: "Our pricing starts at $10/month.", enabled: true },
          { id: 2, ruleType: "REGEX", scope: "ALL", keyword: "hi|hello|hey", reply: "Hi there! How can I help you?", enabled: true },
          { id: 3, ruleType: "KEYWORD", scope: "SPECIFIC", postId: "12345", keyword: "discount", reply: "Use code SAVE10!", enabled: false },
        ]);
        setIsEnabled(true);
        setLoading(false);
        return;
      }

      const res = await api.get("/bot/rules");
      // ✅ Normalize _id to id for frontend compatibility
      const normalizedRules = (res.data.rules || []).map(r => ({ ...r, id: r._id }));
      setRules(normalizedRules);
      setIsEnabled(res.data.enabled ?? true);
    } catch (err) {
      console.warn("⚠️ Fetch failed:", err?.message || err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ✅ Notification helper
  const showNotify = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  }, []);

  // ✅ Filtered rules
  const filtered = rules.filter(
    (r) =>
      r.keyword.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      r.reply.toLowerCase().includes(deferredSearch.toLowerCase())
  );

  // ✅ Handle Form Change
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ✅ Reset Form
  const resetForm = () => {
    setFormData({
      ruleType: "KEYWORD",
      scope: "ALL",
      postId: "",
      keyword: "",
      reply: "",
    });
    setEditingId(null);
  };

  // ✅ Edit Rule (Populate Form)
  const handleEdit = (rule) => {
    setFormData({
      ruleType: rule.ruleType || "KEYWORD",
      scope: rule.scope || "ALL",
      postId: rule.postId || "",
      keyword: rule.keyword,
      reply: rule.reply,
    });
    setEditingId(rule.id);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ Save Rule (Create or Update)
  const saveRule = useCallback(async () => {
    const { ruleType, scope, postId, keyword, reply } = formData;

    // Validation
    if (!keyword.trim() || !reply.trim()) return showNotify("Keyword and Reply are required", "error");
    if (scope === "SPECIFIC" && !postId.trim()) return showNotify("Post ID is required for Specific Post scope", "error");

    const payload = {
      ruleType,
      scope,
      postId: scope === "SPECIFIC" ? postId : undefined,
      keyword: keyword.trim(),
      reply: reply.trim()
    };

    try {
      if (isDemo) {
        if (editingId) {
          setRules(prev => prev.map(r => r.id === editingId ? { ...r, ...payload } : r));
          showNotify("Demo rule updated");
        } else {
          setRules(prev => [...prev, { id: Date.now(), ...payload, enabled: true }]);
          showNotify("Demo rule created");
        }
      } else {
        if (editingId) {
          await api.put(`/bot/rules/${editingId}`, payload);
          showNotify("Rule updated successfully");
        } else {
          await api.post("/bot/rules", payload);
          showNotify("Rule created successfully");
        }
        fetchRules();
      }
      resetForm();
    } catch (err) {
      showNotify(err.response?.data?.message || "Failed to save rule", "error");
    }
  }, [formData, editingId, isDemo, fetchRules, showNotify]);

  // ✅ Delete rule
  const deleteRule = useCallback(
    async (id) => {
      if (!confirm("Delete this rule?")) return;
      try {
        if (isDemo) {
          setRules(prev => prev.filter(r => r.id !== id));
          showNotify("Demo rule deleted");
        } else {
          await api.delete(`/bot/rules/${id}`);
          showNotify("Rule deleted");
          fetchRules();
        }
      } catch {
        showNotify("Delete failed", "error");
      }
    },
    [fetchRules, showNotify, isDemo]
  );

  // ✅ Toggle enable/disable rule
  const toggleRule = useCallback(
    async (id, current) => {
      try {
        if (isDemo) {
          setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !current } : r));
          showNotify(`Rule ${!current ? "enabled" : "disabled"}`);
        } else {
          await api.patch(`/bot/rules/${id}`, { enabled: !current });
          fetchRules();
          showNotify(`Rule ${!current ? "enabled" : "disabled"}`);
        }
      } catch {
        showNotify("Toggle failed", "error");
      }
    },
    [fetchRules, showNotify, isDemo]
  );

  // ✅ Enable / Disable entire bot
  const toggleBot = useCallback(async (checked) => {
    try {
      if (isDemo) {
        setIsEnabled(checked);
        showNotify(`Bot ${checked ? "enabled" : "disabled"}`);
      } else {
        await api.put("/bot/settings", { enabled: checked });
        setIsEnabled(checked);
        showNotify(`Bot ${checked ? "enabled" : "disabled"}`);
      }
    } catch {
      showNotify("Failed to update bot status", "error");
    }
  }, [showNotify, isDemo]);

  // ✅ Generate AI Suggestions
  const generateAISuggestions = async () => {
    setGenerating(true);
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 1000));
        setFormData(prev => ({
          ...prev,
          keyword: "amazing",
          reply: "Thanks for the kind words! We're glad you like it. ✨",
          ruleType: "KEYWORD"
        }));
        showNotify("AI suggestion applied!");
      } else {
        const res = await api.post("/bot/suggestions");
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          const random = res.data.suggestions[Math.floor(Math.random() * res.data.suggestions.length)];
          setFormData(prev => ({
            ...prev,
            keyword: random.keyword,
            reply: random.reply,
            ruleType: "KEYWORD"
          }));
          showNotify("AI suggestion applied!");
        }
      }
    } catch {
      showNotify("Failed to generate AI suggestion", "error");
    } finally {
      setGenerating(false);
    }
  };

  // ============================================================
  // 🧱 Render UI
  // ============================================================
  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading bot settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ✅ Notification Toast */}
      {notification && (
        <div
          className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${notification.type === "error"
            ? "bg-red-500 text-white"
            : "bg-emerald-500 text-white"
            }`}
        >
          {notification.type === "error" ? "❌" : "✅"}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      {/* 1️⃣ Top Panel: Bot Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isEnabled ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
            <Power size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEnabled ? "Bot is Active" : "Bot is Paused"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEnabled ? "The bot is replying to comments based on your rules." : "Enable to automatically reply to comments on your posts."}
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isEnabled}
            onChange={(e) => toggleBot(e.target.checked)}
          />
          <div className="w-16 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
        </label>
      </div>

      {/* 2️⃣ Add New Rule Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus size={20} className="text-blue-500" />
            {editingId ? "Edit Rule" : "Add New Rule"}
          </h3>

          {/* AI Auto-Generate Button */}
          <button
            onClick={generateAISuggestions}
            disabled={generating}
            className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-purple-200 dark:border-purple-800/50"
            title="Stuck? Let AI suggest a reply rule based on your post context."
          >
            {generating ? "..." : "✨"}
            AI Auto-Generate
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rule Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                Rule Type
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Choose how the bot triggers. Keyword matches words, Regex matches patterns.
                  </div>
                </div>
              </label>
              <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                {["KEYWORD", "REGEX"].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleFormChange("ruleType", type)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.ruleType === type
                      ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      }`}
                  >
                    {type === "KEYWORD" ? "Keyword Match" : "Regex Pattern"}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                Scope
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Apply to all posts or a specific post ID.
                  </div>
                </div>
              </label>
              <select
                value={formData.scope}
                onChange={(e) => handleFormChange("scope", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="ALL">All Posts</option>
                <option value="SPECIFIC">Specific Post</option>
              </select>
            </div>
          </div>

          {/* Post ID (Conditional) */}
          {formData.scope === "SPECIFIC" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Post ID
              </label>
              <input
                type="text"
                value={formData.postId}
                onChange={(e) => handleFormChange("postId", e.target.value)}
                placeholder="Enter Facebook Post ID"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keyword */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                {formData.ruleType === "KEYWORD" ? "Keyword" : "Regex Pattern"}
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {formData.ruleType === "KEYWORD" ? "Word or phrase to trigger reply." : "Regular expression pattern to match."}
                  </div>
                </div>
              </label>
              <input
                type="text"
                value={formData.keyword}
                onChange={(e) => handleFormChange("keyword", e.target.value)}
                placeholder={formData.ruleType === "KEYWORD" ? "e.g. price" : "e.g. ^(hi|hello)$"}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {/* Reply Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                Reply Message
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Message the bot will send.
                  </div>
                </div>
              </label>
              <input
                type="text"
                value={formData.reply}
                onChange={(e) => handleFormChange("reply", e.target.value)}
                placeholder="e.g. Check your DM!"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={resetForm}
              className="px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveRule}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
            >
              <Save size={18} />
              {editingId ? "Save Changes" : "Create Rule"}
            </button>
          </div>
        </div>
      </div>

      {/* 3️⃣ Rule Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">Active Rules</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keyword / Regex</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reply Message</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 text-center">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Filter size={32} className="opacity-20" />
                      <p>{searchTerm ? "No matching rules found" : "No rules yet. Create one above!"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group ${r.enabled ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-900/20"}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {r.keyword}
                        </span>
                        <div className="flex gap-2">
                          <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {r.ruleType || "KEYWORD"}
                          </span>
                          {r.scope === "SPECIFIC" && (
                            <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                              Post: {r.postId}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                        {r.reply}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleRule(r.id, r.enabled)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${r.enabled
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                      >
                        {r.enabled ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteRule(r.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// ✅ Wrapper
const BotReplySettingsAPI = ({ isDemo }) => (
  <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading Bot Settings...</div>}>
    <BotReplySettingsContent isDemo={isDemo} />
  </Suspense>
);

export default BotReplySettingsAPI;
