// ============================================================
// 🤖 BotReplySettings.jsx — V2 Redesign (Table & Modal)
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
  Suspense,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Save,
  X,
  Power,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Sparkles,
  Loader2
} from "lucide-react";
import api from "../utils/api";

// ✅ Main Component
const BotReplySettingsContent = React.memo(({ isDemo }) => {
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState({ keyword: "", reply: "", enabled: true });
  const [editingId, setEditingId] = useState(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // 🆕 Modal State
  const [generating, setGenerating] = useState(false);

  const deferredSearch = useDeferredValue(searchTerm);

  // ✅ Load rules from API
  const fetchRules = useCallback(async () => {
    try {
      if (isDemo) {
        setRules([
          { id: 1, keyword: "price", reply: "Our pricing starts at $10/month.", enabled: true },
          { id: 2, keyword: "hello", reply: "Hi there! How can I help you?", enabled: true },
          { id: 3, keyword: "shipping", reply: "We ship worldwide! 🌍", enabled: false },
          { id: 4, keyword: "discount", reply: "Use code SAVE10 for 10% off!", enabled: true },
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

  // ✅ Open Modal
  const openModal = (rule = null) => {
    if (rule) {
      setNewRule(rule);
      setEditingId(rule.id);
    } else {
      setNewRule({ keyword: "", reply: "", enabled: true });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  // ✅ Close Modal
  const closeModal = () => {
    setIsModalOpen(false);
    setNewRule({ keyword: "", reply: "", enabled: true });
    setEditingId(null);
  };

  // ✅ Add or Update rule
  const saveRule = useCallback(async () => {
    const k = newRule.keyword.trim();
    const r = newRule.reply.trim();
    const t = newRule.type || "KEYWORD";

    if (!k || !r) return showNotify("Please fill both fields", "error");

    try {
      if (isDemo) {
        if (editingId) {
          setRules(prev => prev.map(rule => rule.id === editingId ? { ...rule, keyword: k, reply: r, type: t } : rule));
          showNotify("Demo rule updated");
        } else {
          setRules(prev => [...prev, { id: Date.now(), keyword: k, reply: r, enabled: true, type: t }]);
          showNotify("Demo rule added");
        }
      } else {
        const payload = { keyword: k, reply: r, type: t };
        if (editingId) {
          await api.put(`/bot/rules/${editingId}`, payload);
          showNotify("Rule updated");
        } else {
          await api.post("/bot/rules", payload);
          showNotify("Rule added");
        }
        fetchRules();
      }
      closeModal();
    } catch (err) {
      showNotify(err.response?.data?.message || "Failed to save rule", "error");
    }
  }, [newRule, editingId, fetchRules, showNotify, isDemo]);

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
        await new Promise(r => setTimeout(r, 1500));
        setNewRule({
          keyword: "amazing",
          reply: "Thanks for the kind words! We're glad you like it. ✨",
          type: "KEYWORD",
          enabled: true
        });
        showNotify("AI generated a suggestion!");
      } else {
        const res = await api.post("/bot/suggestions");
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          const random = res.data.suggestions[Math.floor(Math.random() * res.data.suggestions.length)];
          setNewRule({
            keyword: random.keyword,
            reply: random.reply,
            type: "KEYWORD",
            enabled: true
          });
          showNotify("AI generated a suggestion!");
        }
      }
    } catch (err) {
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
    <div className="space-y-6">
      {/* ✅ Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${notification.type === "error"
              ? "bg-red-500 text-white"
              : "bg-emerald-500 text-white"
              }`}
          >
            {notification.type === "error" ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="font-medium">{notification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔹 Header & Global Toggle */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="text-blue-200" />
            Auto-Reply Bot
          </h2>
          <p className="text-blue-100 mt-1 opacity-90">
            Automatically reply to comments on your posts based on keywords.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
          <span className="font-medium text-sm">
            {isEnabled ? "Bot Active" : "Bot Paused"}
          </span>
          <button
            onClick={() => toggleBot(!isEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-400" : "bg-gray-400"
              }`}
          >
            <motion.div
              animate={{ x: isEnabled ? 24 : 2 }}
              className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
            />
          </button>
        </div>
      </div>

      {/* 🔹 Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search keyword or reply..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <button
          onClick={() => openModal()}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          <Plus size={18} />
          Add New Rule
        </button>
      </div>

      {/* 🔹 Rules Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keyword</th>
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
                      <Search size={32} className="opacity-20" />
                      <p>{searchTerm ? "No matching rules found" : "No rules yet. Add one to get started!"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                    <td className="px-6 py-4">
                      {r.type === "ALL_POSTS" ? (
                        <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-sm flex items-center gap-1 w-fit">
                          <MoreHorizontal size={14} /> All Posts
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                          {r.keyword}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 max-w-md">
                        {r.reply}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleRule(r.id, r.enabled)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${r.enabled
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                      >
                        {r.enabled ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(r)}
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

      {/* 🔹 Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingId ? "Edit Rule" : "Add New Rule"}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>

              {/* ✨ AI Generator Banner */}
              <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                    AI Creativity Suite
                  </h4>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                    Stuck? Let AI write a rule for you.
                  </p>
                </div>
                <button
                  onClick={generateAISuggestions}
                  disabled={generating}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      Auto-Generate
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4">
                {/* Rule Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rule Type
                  </label>
                  <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
                    <button
                      onClick={() => setNewRule({ ...newRule, type: "KEYWORD" })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${newRule.type !== "ALL_POSTS"
                        ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                    >
                      Keyword Match
                    </button>
                    <button
                      onClick={() => setNewRule({ ...newRule, type: "ALL_POSTS", keyword: "ALL_POSTS" })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${newRule.type === "ALL_POSTS"
                        ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                    >
                      All Posts
                    </button>
                  </div>
                </div>

                {/* Keyword Input (Only for KEYWORD type) */}
                {newRule.type !== "ALL_POSTS" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Keyword
                    </label>
                    <input
                      value={newRule.keyword}
                      onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                      placeholder="e.g. price"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">Trigger reply when a comment contains this word.</p>
                  </div>
                )}

                {/* All Posts Info */}
                {newRule.type === "ALL_POSTS" && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm flex gap-2 items-start">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Reply to Everything</p>
                      <p className="opacity-80 mt-1">
                        This rule will reply to <strong>every new comment</strong> on your connected pages that doesn't match a specific keyword rule.
                        <br />
                        <span className="text-xs mt-1 block">🛡️ Anti-Spam active: Links are ignored.</span>
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reply Message
                  </label>
                  <textarea
                    value={newRule.reply}
                    onChange={(e) => setNewRule({ ...newRule, reply: e.target.value })}
                    placeholder="e.g. Check your DM!"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveRule}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/30"
                  >
                    {editingId ? "Save Changes" : "Create Rule"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
