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
  Filter,
  Image as ImageIcon,
  Loader,
  HelpCircle
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
    attachmentUrl: null,
  });
  const [editingId, setEditingId] = useState(null);

  const [isEnabled, setIsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availablePages, setAvailablePages] = useState([]);
  const [pageSettings, setPageSettings] = useState([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

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
      // ✅ Normalize ID for frontend compatibility
      const normalizedRules = (res.data.rules || []).map(r => ({ ...r, id: r.id || r._id }));
      setRules(normalizedRules);
      setIsEnabled(res.data.enabled ?? true);
      setPageSettings(res.data.pageSettings || []);
    } catch (err) {
      console.warn("⚠️ Fetch failed:", err?.message || err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchRules();
    // Also fetch available pages to show in selection
    const fetchPages = async () => {
      setIsLoadingPages(true);
      try {
        const res = await api.get("/user/pages");
        if (res.data.success) {
          setAvailablePages(res.data.accounts || []);
        }
      } catch (err) {
        console.error("Failed to fetch pages", err);
      } finally {
        setIsLoadingPages(false);
      }
    };
    fetchPages();
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
      attachmentUrl: null,
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
      attachmentUrl: rule.attachmentUrl || null,
    });
    setEditingId(rule.id);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ Save Rule (Create or Update)
  const saveRule = useCallback(async () => {
    const { ruleType, scope, postId, keyword, reply, attachmentUrl } = formData;

    // Validation
    if (!reply.trim()) return showNotify("Reply Message is required", "error");
    if (scope === "SPECIFIC" && !postId.trim()) return showNotify("Post ID is required for Specific Post scope", "error");

    const payload = {
      ruleType,
      scope,
      postId: scope === "SPECIFIC" ? postId : undefined,
      keyword: keyword.trim() || "*",
      reply: reply.trim(),
      attachmentUrl
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
      console.log("🖱️ Delete button clicked for ID:", id);
      if (!window.confirm("តើបងពិតជាចង់លុបច្បាប់ (Rule) នេះមែនទេ?")) return;
      
      try {
        // 1️⃣ Optimistic Update: Remove from UI immediately so user sees it "gone"
        setRules(prev => prev.filter(r => r.id !== id));
        showNotify("កំពុងលុប...");

        if (!isDemo) {
          console.log("🌐 Sending DELETE request to server...");
          const res = await api.delete(`/bot/rules/${id}`);
          console.log("✅ Server response:", res.data);
          
          if (res.data.success) {
            showNotify("បានលុបច្បាប់ (Rule) រួចរាល់");
            // 2️⃣ Double check sync with server
            fetchRules();
          } else {
            throw new Error(res.data.message || "Failed to delete");
          }
        } else {
          showNotify("បានលុបច្បាប់សាកល្បងរួចរាល់");
        }
      } catch (err) {
        console.error("❌ Deletion failed:", err);
        showNotify("មិនអាចលុបបានទេ សូមព្យាយាមម្តងទៀត", "error");
        fetchRules(); // Revert back if failed
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

  // ✅ Toggle Page Bot Status
  const togglePageBot = useCallback(async (pageId, checked) => {
    try {
      if (isDemo) {
        setPageSettings(prev => {
          const newSettings = [...prev];
          const idx = newSettings.findIndex(s => s.pageId === pageId);
          if (idx > -1) newSettings[idx].enableBot = checked;
          else newSettings.push({ pageId, enableBot: checked });
          return newSettings;
        });
        showNotify(`Bot ${checked ? "enabled" : "disabled"} for this page`);
        return;
      }

      await botAPI.updatePageSettings(pageId, checked);
      setPageSettings(prev => {
        const newSettings = [...prev];
        const idx = newSettings.findIndex(s => s.pageId === pageId);
        if (idx > -1) newSettings[idx].enableBot = checked;
        else newSettings.push({ pageId, enableBot: checked });
        return newSettings;
      });
      showNotify(`Bot ${checked ? "enabled" : "disabled"} for this page`);
    } catch (err) {
      showNotify("Failed to update page bot status", "error");
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

  // ✅ Handle Image Upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotify("File size too large (Max 5MB)", "error");
      return;
    }

    setUploading(true);
    const uploadData = new FormData();
    uploadData.append("image", file);

    try {
      const res = await api.post("/upload/bot-image", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setFormData((prev) => ({ ...prev, attachmentUrl: res.data.url }));
        showNotify("Image attached successfully!");
      }
    } catch (error) {
      console.error("Upload failed", error);
      showNotify("Failed to upload image", "error");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, attachmentUrl: null }));
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

      {/* 📘 Quick Guide */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
          <HelpCircle size={20} />
          របៀបប្រើប្រាស់ (Quick Guide)
        </h3>
        <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <li><strong>បើកមុខងារ (Turn ON):</strong> ចុចបើកកុងតាក់ <span className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-sm text-xs border dark:border-gray-700 font-medium">Bot កំពុងដំណើរការ</span>។</li>
          <li><strong>ជ្រើសរើសផេក (Select Pages):</strong> ជ្រើសរើស Page ដែលបងចង់ឱ្យ Bot ទៅជួយឆ្លើយខមិននៅត្រង់ <span className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-sm text-xs border dark:border-gray-700 font-medium">ជ្រើសរើស Page ដែលចង់ឱ្យ Bot ឆ្លើយតប</span>។</li>
          <li><strong>បង្កើតច្បាប់ (Create Rule):</strong> កំណត់ពាក្យដែលភ្ញៀវចូលចិត្តសួរ (Keyword) និងសារឆ្លើយតប (Reply Message) រួចចុច Save។</li>
        </ol>
      </div>

      {/* 1️⃣ Top Panel: Bot Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isEnabled ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
            <Power size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEnabled ? "Bot កំពុងដំណើរការ" : "Bot ត្រូវបានផ្អាក"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEnabled ? "Bot កំពុងជួយឆ្លើយតបខមិនផ្អែកលើច្បាប់ដែលបងបានកំណត់។" : "បើកមុខងារនេះដើម្បីឱ្យ Bot ជួយឆ្លើយតបខមិនលើផុសរបស់បងដោយស្វ័យប្រវត្តិ។"}
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

      {/* 1.5️⃣ Middle Panel: Page-Specific Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Filter size={20} className="text-blue-500" />
          ជ្រើសរើស Page ដែលចង់ឱ្យ Bot ឆ្លើយតប
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          ជ្រើសរើស Page ណាខ្លះដែលបងចង់ឱ្យ Bot តាមដាន និងឆ្លើយតបខមិនដោយស្វ័យប្រវត្តិ។
        </p>

        {isLoadingPages ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
            <Loader size={16} className="animate-spin" />
            កំពុងទាញយក Page...
          </div>
        ) : availablePages.length === 0 ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center text-sm text-gray-500 border border-dashed border-gray-200 dark:border-gray-700">
            មិនមាន Page ណាមួយត្រូវបានភ្ជាប់ទេ។ សូមភ្ជាប់ Page Facebook នៅក្នុងការកំណត់ (Settings)។
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePages.map((page) => {
              const settings = pageSettings.find(s => s.pageId === page.id);
              const isPageBotEnabled = settings?.enableBot ?? false;

              return (
                <div
                  key={page.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isPageBotEnabled
                    ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/50"
                    : "bg-gray-50/50 border-gray-100 dark:bg-gray-900/20 dark:border-gray-700"
                    }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={page.picture || `https://ui-avatars.com/api/?name=${page.name}&background=random`}
                      alt={page.name}
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {page.name}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate opacity-60">
                        {page.id}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer scale-75">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isPageBotEnabled}
                      onChange={(e) => togglePageBot(page.id, e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2️⃣ Add New Rule Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus size={20} className="text-blue-500" />
            {editingId ? "កែប្រែច្បាប់" : "បង្កើតច្បាប់ថ្មី"}
          </h3>

          {/* AI Auto-Generate Button */}
          <button
            onClick={generateAISuggestions}
            disabled={generating}
            className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-purple-200 dark:border-purple-800/50"
            title="AI នឹងជួយបង្កើតច្បាប់ឆ្លើយតបដោយស្វ័យប្រវត្តិ។"
          >
            {generating ? "..." : "✨"}
            AI ជួយបង្កើតឱ្យ
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rule Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                ប្រភេទច្បាប់ (Rule Type)
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    ជ្រើសរើសរបៀបដែល Bot ដំណើរការ។ Keyword គឺផ្អែកលើពាក្យ ចំណែក Regex គឺផ្អែកលើទម្រង់អក្សរ។
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
                    {type === "KEYWORD" ? "ប្រើ Keyword" : "ប្រើ Regex"}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                វិសាលភាព (Scope)
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    អនុវត្តលើគ្រប់ផុសទាំងអស់ ឬផុសណាមួយជាក់លាក់។
                  </div>
                </div>
              </label>
              <select
                value={formData.scope}
                onChange={(e) => handleFormChange("scope", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="ALL">គ្រប់ផុសទាំងអស់ (All Posts)</option>
                <option value="SPECIFIC">ផុសជាក់លាក់ (Specific Post)</option>
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
                placeholder="បញ្ជូល Facebook Post ID"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keyword */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                {formData.ruleType === "KEYWORD" ? "Keyword (Optional)" : "Regex Pattern"}
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {formData.ruleType === "KEYWORD" ? "ទុកឱ្យនៅទំនេរដើម្បីឆ្លើយតបទៅកាន់គ្រប់ខមិនទាំងអស់។" : "ទម្រង់ Regex សម្រាប់ត្រួតពិនិត្យអត្ថបទ។"}
                  </div>
                </div>
              </label>
              <input
                type="text"
                value={formData.keyword}
                onChange={(e) => handleFormChange("keyword", e.target.value)}
                placeholder={formData.ruleType === "KEYWORD" ? "ឧទាហរណ៍៖ តម្លៃ (ទុកឱ្យនៅទំនេរដើម្បីឆ្លើយគ្រប់ខមិន)" : "ឧទាហរណ៍៖ ^(hi|hello)$"}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {/* Reply Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                សារឆ្លើយតប (Reply Message)
                <div className="group relative">
                  <span className="text-gray-400 cursor-help">(?)</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    សារដែល Bot នឹងផ្ញើទៅកាន់អតិថិជន។
                  </div>
                </div>
              </label>
              <input
                type="text"
                value={formData.reply}
                onChange={(e) => handleFormChange("reply", e.target.value)}
                placeholder="ឧទាហរណ៍៖ សូមបងឆែកប្រអប់សារ!"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Image Attachment */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              រូបភាពភ្ជាប់ (Attachment - បើមាន)
              <div className="group relative">
                <span className="text-gray-400 cursor-help">(?)</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  ភ្ជាប់រូបភាពទៅជាមួយសារឆ្លើយតប។
                </div>
              </div>
            </label>

            {formData.attachmentUrl ? (
              <div className="relative flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl group">
                <img
                  src={formData.attachmentUrl}
                  alt="រូបភាពភ្ជាប់"
                  className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-600 shadow-sm"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">រូបភាពត្រូវបានដាក់បញ្ចូល</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">រូបភាពនេះនឹងផ្ញើទៅជាមួយសារឆ្លើយតប។</p>
                </div>
                <button
                  onClick={removeImage}
                  className="p-2.5 text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-colors"
                  title="លុបរូបភាព"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ) : (
              <label className="relative flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer bg-gray-50/50 dark:bg-gray-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader size={28} className="animate-spin text-blue-500" />
                    <span className="text-sm font-medium text-blue-500">កំពុងដាក់រូបភាពបញ្ចូល...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <ImageIcon size={24} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      ចុចទីនេះដើម្បីបញ្ចូលរូបភាព
                    </p>
                    <p className="text-xs text-gray-500 mt-1">ប្រភេទ៖ JPG, PNG • ទំហំអតិបរមា៖ 5MB</p>
                  </>
                )}
                <input type="file" className="hidden" accept="image/jpeg, image/png" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={resetForm}
              className="px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              បោះបង់
            </button>
            <button
              onClick={saveRule}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
            >
              <Save size={18} />
              {editingId ? "រក្សាទុកការកែប្រែ" : "បង្កើតច្បាប់ថ្មី"}
            </button>
          </div>
        </div>
      </div>

      {/* 3️⃣ Rule Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">បញ្ជីច្បាប់ដែលកំពុងប្រើ (Active Rules)</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="ស្វែងរកច្បាប់..."
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
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">សារឆ្លើយតប (Reply Message)</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 text-center">ស្ថានភាព</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Filter size={32} className="opacity-20" />
                      <p>{searchTerm ? "មិនមានច្បាប់ដែលត្រូវនឹងការស្វែងរកទេ" : "មិនទាន់មានច្បាប់ឆ្លើយតបនៅឡើយទេ។ បង្កើតមួយនៅខាងលើ!"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const ruleId = r._id || r.id || `temp-${idx}`;
                  return (
                    <tr key={ruleId} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group ${r.enabled ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-900/20"}`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {r.keyword === '*' ? <span className="text-gray-400 italic">(ឆ្លើយគ្រប់ខមិន)</span> : r.keyword}
                          </span>
                          <div className="flex gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                              {r.ruleType || "KEYWORD"}
                            </span>
                            {r.scope === "SPECIFIC" && (
                              <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                ផុស៖ {r.postId}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          {r.attachmentUrl && (
                            <img
                              src={r.attachmentUrl}
                              alt="រូបភាព"
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700 flex-shrink-0"
                            />
                          )}
                          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 pt-0.5">
                            {r.reply}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRule(ruleId, r.enabled);
                          }}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${r.enabled
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                        >
                          {r.enabled ? "បើក" : "បិទ"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity relative z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(r);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
                            title="កែប្រែ"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRule(ruleId);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                            title="លុប"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
