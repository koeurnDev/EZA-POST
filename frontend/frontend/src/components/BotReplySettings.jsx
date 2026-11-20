// ============================================================
// 🤖 BotReplySettings.jsx — Simplified Tabbed UX with Quick Templates
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
} from "react";
import { Link } from "react-router-dom";
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
  Sparkles,
  History,
  RefreshCw,
  ChevronDown,
  Flag,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import api, { botAPI } from "../utils/api";

const QUICK_TEMPLATES = [
  {
    id: "price",
    label: "💰 សួរតម្លៃ",
    keyword: "តម្លៃ",
    reply: "សូមអរគុណបង! ក្រុមការងារបានផ្ញើតម្លៃលម្អិតចូល Inbox បងរួចរាល់ហើយ 💬",
    enableDm: true,
    dmReply: "សួស្តីបង [[name]]! អរគុណសម្រាប់ការសួរតម្លៃ។ សូមបងមើលព័ត៌មានលម្អិតខាងក្រោម ឬប្រាប់ឈ្មោះទំនិញដែលបងចាប់អារម្មណ៍បានណា!",
  },
  {
    id: "location",
    label: "📍 សួរទីតាំង",
    keyword: "ទីតាំង",
    reply: "ហាងយើងខ្ញុំមានទីតាំងនៅរាជធានីភ្នំពេញ និងមានសេវាដឹកជញ្ជូនទូទាំង ២៥ ខេត្ត-ក្រុង 🚚",
    enableDm: false,
    dmReply: "",
  },
  {
    id: "order",
    label: "🛒 កម្ម៉ង់ទិញ",
    keyword: "កម្ម៉ង់",
    reply: "អរគុណបង! សូមឆែកប្រអប់សារ Inbox ដើម្បីបញ្ជាក់ការកម្ម៉ង់ណា 🛍️",
    enableDm: true,
    dmReply: "សួស្តីបង [[name]]! ដើម្បីកម្ម៉ង់ទំនិញ សូមផ្ញើលេខទូរស័ព្ទ និងទីតាំងដឹកជញ្ជូនមកទីនេះបានណា!",
  },
  {
    id: "all",
    label: "🌐 ឆ្លើយគ្រប់ខមិន",
    keyword: "",
    reply: "សូមអរគុណបង [[name]] សម្រាប់ការចាប់អារម្មណ៍! ក្រុមការងារនឹងទាក់ទងទៅបងវិញភ្លាមៗ 🙏",
    enableDm: true,
    dmReply: "សួស្តីបង [[name]]! អរគុណដែលបាន Comment។ តើបងចង់សាកសួរព័ត៌មានអ្វីដែរ?",
  },
];

const BotReplySettingsContent = React.memo(({ isDemo }) => {
  const [activeTab, setActiveTab] = useState("rules"); // "rules" | "pages" | "history"
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [rules, setRules] = useState([]);
  const [formData, setFormData] = useState({
    ruleType: "KEYWORD",
    scope: "ALL",
    postId: "",
    keyword: "",
    reply: "",
    dmReply: "",
    enableDm: false,
    attachmentUrl: null,
  });
  const [editingId, setEditingId] = useState(null);

  const [isEnabled, setIsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availablePages, setAvailablePages] = useState([]);
  const [pageSettings, setPageSettings] = useState([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  const [monitoredPosts, setMonitoredPosts] = useState([]);
  const [isLoadingMonitored, setIsLoadingMonitored] = useState(false);
  const [monitoredPostUrl, setMonitoredPostUrl] = useState("");
  const [monitoredPageId, setMonitoredPageId] = useState("");
  const [isAddingMonitored, setIsAddingMonitored] = useState(false);

  const [recentPosts, setRecentPosts] = useState([]);
  const [recentPostsError, setRecentPostsError] = useState(null);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [browsePageId, setBrowsePageId] = useState("");

  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const deferredSearch = useDeferredValue(searchTerm);

  const showNotify = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      if (isDemo) {
        setRules([
          { id: 1, ruleType: "KEYWORD", scope: "ALL", keyword: "តម្លៃ", reply: "សូមបងឆែកប្រអប់សារ Inbox ណា!", enableDm: true, dmReply: "តម្លៃ $10 បង!", enabled: true },
          { id: 2, ruleType: "KEYWORD", scope: "ALL", keyword: "ទីតាំង", reply: "នៅភ្នំពេញបង មានដឹកជញ្ជូនទូទាំងប្រទេស!", enabled: true },
        ]);
        setIsEnabled(true);
        setLoading(false);
        return;
      }

      const res = await api.get("/bot/rules");
      const normalizedRules = (res.data.rules || []).map((r) => ({ ...r, id: r.id || r._id }));
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

  const fetchMonitoredPosts = useCallback(async () => {
    if (isDemo) {
      setMonitoredPosts([
        { id: "1", facebookPostId: "1234567890", pageId: "1000123", enabled: true, createdAt: new Date() },
      ]);
      return;
    }
    setIsLoadingMonitored(true);
    try {
      const res = await api.get("/bot/monitored-posts");
      if (res.data.success) {
        setMonitoredPosts(res.data.posts || []);
      }
    } catch (err) {
      console.warn("⚠️ Monitored fetch failed:", err);
    } finally {
      setIsLoadingMonitored(false);
    }
  }, [isDemo]);

  const fetchHistory = useCallback(async () => {
    if (isDemo) {
      setHistory([
        { id: "1", commentId: "123_456", replyMessage: "សូមបងឆែកប្រអប់សារ!", pageId: "101", status: "success", timestamp: new Date() },
      ]);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const res = await api.get("/bot/history");
      if (res.data.success) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      console.warn("⚠️ History fetch failed:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchRules();
    fetchMonitoredPosts();

    const fetchPages = async () => {
      setIsLoadingPages(true);
      try {
        const res = await api.get("/user/pages");
        if (res.data.success) {
          const accounts = res.data.accounts || [];
          setAvailablePages(accounts);
          if (accounts.length > 0) {
            setMonitoredPageId(accounts[0].id);
            setBrowsePageId(accounts[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch pages", err);
      } finally {
        setIsLoadingPages(false);
      }
    };
    fetchPages();
  }, [fetchRules, fetchMonitoredPosts]);

  useEffect(() => {
    fetchHistory();
    const timer = setInterval(fetchHistory, 30000);
    return () => clearInterval(timer);
  }, [fetchHistory]);

  const fetchRecentPosts = useCallback(async (pageId) => {
    if (!pageId || isDemo) return;
    setIsLoadingRecent(true);
    setRecentPostsError(null);
    try {
      const res = await api.get(`/bot/recent-posts/${pageId}`);
      if (res.data.success) {
        setRecentPosts(res.data.posts || []);
      }
    } catch (err) {
      console.warn("⚠️ Recent posts fetch failed:", err);
      setRecentPosts([]);
      const apiData = err?.response?.data;
      setRecentPostsError({
        isExpired: apiData?.code === "FB_TOKEN_EXPIRED",
        message:
          apiData?.message ||
          "មិនអាចទាញយកផុសថ្មីៗពីផេកនេះបានទេ។ សូមពិនិត្យការតភ្ជាប់ Facebook ឡើងវិញ។",
      });
    } finally {
      setIsLoadingRecent(false);
    }
  }, [isDemo]);

  useEffect(() => {
    if (activeTab === "pages" && browsePageId) {
      fetchRecentPosts(browsePageId);
    }
  }, [activeTab, browsePageId, fetchRecentPosts]);

  const isPageBotActive = useCallback(
    (page) => {
      const settings = pageSettings.find((s) => s.pageId === page.id);
      return settings ? settings.enableBot === true : page.settings?.enableBot === true;
    },
    [pageSettings]
  );

  const enabledPagesCount = availablePages.filter(isPageBotActive).length;
  const activeRulesCount = rules.filter((r) => r.enabled !== false).length;

  const filtered = (rules || []).filter(
    (r) =>
      (r.keyword || "").toLowerCase().includes(deferredSearch.toLowerCase()) ||
      (r.reply || "").toLowerCase().includes(deferredSearch.toLowerCase())
  );

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const applyTemplate = (tpl) => {
    setFormData((prev) => ({
      ...prev,
      ruleType: "KEYWORD",
      scope: "ALL",
      keyword: tpl.keyword,
      reply: tpl.reply,
      enableDm: tpl.enableDm,
      dmReply: tpl.dmReply,
    }));
    showNotify(`បានប្រើគំរូ "${tpl.label}" — បងអាចកែអក្សរ រួចចុចរក្សាទុក!`);
  };

  const resetForm = () => {
    setFormData({
      ruleType: "KEYWORD",
      scope: "ALL",
      postId: "",
      keyword: "",
      reply: "",
      dmReply: "",
      enableDm: false,
      attachmentUrl: null,
    });
    setEditingId(null);
    setShowAdvanced(false);
  };

  const handleEdit = (rule) => {
    setFormData({
      ruleType: rule.ruleType || "KEYWORD",
      scope: rule.scope || "ALL",
      postId: rule.postId || "",
      keyword: rule.keyword === "*" ? "" : rule.keyword || "",
      reply: rule.reply || "",
      dmReply: rule.dmReply || "",
      enableDm: Boolean(rule.enableDm),
      attachmentUrl: rule.attachmentUrl || null,
    });
    if (rule.ruleType === "REGEX" || rule.scope === "SPECIFIC") {
      setShowAdvanced(true);
    }
    setEditingId(rule.id);
    setActiveTab("rules");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRule = useCallback(async () => {
    const { ruleType, scope, postId, keyword, reply, dmReply, enableDm, attachmentUrl } = formData;

    if (!reply.trim() && !(enableDm && dmReply.trim())) {
      return showNotify("សូមបញ្ចូលសារឆ្លើយតប Comment ឬ សារផ្ញើចូល Inbox (DM)", "error");
    }
    if (scope === "SPECIFIC" && !postId.trim()) {
      return showNotify("សូមបញ្ចូល Post ID ឬ Link ផុសជាក់លាក់", "error");
    }

    let cleanPostId = postId.trim();
    if (scope === "SPECIFIC" && cleanPostId.includes("facebook.com")) {
      const matches = cleanPostId.match(/(\d{10,20})/g);
      if (matches && matches.length > 0) {
        cleanPostId = matches[matches.length - 1];
      }
    }

    const payload = {
      ruleType,
      scope,
      postId: scope === "SPECIFIC" ? cleanPostId : undefined,
      keyword: keyword.trim() || "*",
      reply: reply.trim(),
      dmReply: enableDm ? dmReply.trim() : null,
      enableDm: Boolean(enableDm),
      attachmentUrl,
    };

    setSavingRule(true);
    try {
      if (isDemo) {
        if (editingId) {
          setRules((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r)));
          showNotify("បានកែប្រែច្បាប់ (Demo) រួចរាល់");
        } else {
          setRules((prev) => [...prev, { id: Date.now(), ...payload, enabled: true }]);
          showNotify("បានបង្កើតច្បាប់ថ្មី (Demo) រួចរាល់");
        }
      } else {
        if (editingId) {
          await api.put(`/bot/rules/${editingId}`, payload);
          showNotify("បានកែប្រែច្បាប់រួចរាល់ ✅");
        } else {
          await api.post("/bot/rules", payload);
          showNotify("បានបង្កើតច្បាប់ថ្មីរួចរាល់ ✅");
        }
        fetchRules();
      }
      resetForm();
    } catch (err) {
      showNotify(err.response?.data?.error || err.response?.data?.message || "មិនអាចរក្សាទុកច្បាប់បានទេ", "error");
    } finally {
      setSavingRule(false);
    }
  }, [formData, editingId, isDemo, fetchRules, showNotify]);

  const deleteRule = useCallback(
    async (id) => {
      if (!window.confirm("តើបងពិតជាចង់លុបច្បាប់ (Rule) នេះមែនទេ?")) return;
      try {
        setRules((prev) => prev.filter((r) => r.id !== id));
        if (!isDemo) {
          const res = await api.delete(`/bot/rules/${id}`);
          if (res.data.success) {
            showNotify("បានលុបច្បាប់រួចរាល់");
            fetchRules();
          } else {
            throw new Error(res.data.message || "Failed to delete");
          }
        } else {
          showNotify("បានលុបច្បាប់សាកល្បងរួចរាល់");
        }
      } catch (err) {
        showNotify("មិនអាចលុបបានទេ សូមព្យាយាមម្តងទៀត", "error");
        fetchRules();
      }
    },
    [fetchRules, showNotify, isDemo]
  );

  const toggleRule = useCallback(
    async (id, current) => {
      try {
        if (isDemo) {
          setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !current } : r)));
        } else {
          await api.patch(`/bot/rules/${id}`, { enabled: !current });
          fetchRules();
        }
        showNotify(!current ? "បានបើកច្បាប់នេះ" : "បានបិទច្បាប់នេះ");
      } catch {
        showNotify("មិនអាចប្ដូរស្ថានភាពបានទេ", "error");
      }
    },
    [fetchRules, showNotify, isDemo]
  );

  const toggleBot = useCallback(
    async (checked) => {
      try {
        if (!isDemo) {
          await api.put("/bot/settings", { enabled: checked });
        }
        setIsEnabled(checked);
        showNotify(checked ? "Bot ត្រូវបានបើកឱ្យដំណើរការ 🟢" : "Bot ត្រូវបានផ្អាកបណ្ដោះអាសន្ន");
      } catch {
        showNotify("មិនអាចកែប្រែស្ថានភាព Bot បានទេ", "error");
      }
    },
    [showNotify, isDemo]
  );

  const togglePageBot = useCallback(
    async (pageId, checked) => {
      try {
        if (!isDemo) {
          await botAPI.updatePageSettings(pageId, checked);
        }
        setPageSettings((prev) => {
          const next = [...prev];
          const idx = next.findIndex((s) => s.pageId === pageId);
          if (idx > -1) next[idx] = { ...next[idx], enableBot: checked };
          else next.push({ pageId, enableBot: checked });
          return next;
        });
        setAvailablePages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, settings: { ...p.settings, enableBot: checked } } : p))
        );
        showNotify(checked ? "បានបើក Bot សម្រាប់ផេកនេះ" : "បានបិទ Bot សម្រាប់ផេកនេះ");
      } catch {
        showNotify("មិនអាចកែប្រែការកំណត់ផេកបានទេ", "error");
      }
    },
    [showNotify, isDemo]
  );

  const toggleAllPages = useCallback(
    async (enabled) => {
      if (availablePages.length === 0) return;
      const pageIds = availablePages.map((p) => p.id);
      try {
        if (!isDemo) {
          await api.put("/bot/page-settings", { pageIds, enabled });
        }
        setPageSettings(pageIds.map((id) => ({ pageId: id, enableBot: enabled })));
        setAvailablePages((prev) =>
          prev.map((p) => ({ ...p, settings: { ...p.settings, enableBot: enabled } }))
        );
        showNotify(enabled ? "បានបើក Bot គ្រប់ផេករួចរាល់" : "បានបិទ Bot គ្រប់ផេករួចរាល់");
      } catch {
        showNotify("បរាជ័យក្នុងការកំណត់គ្រប់ផេក", "error");
      }
    },
    [availablePages, isDemo, showNotify]
  );

  const generateAISuggestions = async () => {
    setGenerating(true);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 600));
        setFormData((prev) => ({
          ...prev,
          keyword: "តម្លៃ",
          reply: "អរគុណបង! តម្លៃពិសេសថ្ងៃនេះត្រឹម $10 ប៉ុណ្ណោះ សូមឆែកប្រអប់សារណា ✨",
          ruleType: "KEYWORD",
        }));
        showNotify("AI បានសរសេរគំរូឱ្យរួចរាល់ ✨");
      } else {
        const res = await api.post("/bot/suggestions");
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          const random = res.data.suggestions[Math.floor(Math.random() * res.data.suggestions.length)];
          setFormData((prev) => ({
            ...prev,
            keyword: random.keyword,
            reply: random.reply,
            ruleType: "KEYWORD",
          }));
          showNotify("AI បានសរសេរគំរូឱ្យរួចរាល់ ✨");
        }
      }
    } catch {
      showNotify("AI មិនអាចបង្កើតគំរូបានទេនៅពេលនេះ", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return showNotify("រូបភាពធំជាង 5MB សូមជ្រើសរូបតូចជាងនេះ", "error");
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
        showNotify("បានភ្ជាប់រូបភាពជោគជ័យ!");
      }
    } catch {
      showNotify("មិនអាច Upload រូបភាពបានទេ", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleAddMonitored = async () => {
    if (!monitoredPostUrl.trim() || !monitoredPageId) {
      return showNotify("សូមបញ្ចូល Link ផុស និងរើស Page", "error");
    }
    setIsAddingMonitored(true);
    try {
      if (isDemo) {
        setMonitoredPosts((prev) => [
          { id: Date.now().toString(), facebookPostId: "DemoID", pageId: monitoredPageId, enabled: true, createdAt: new Date() },
          ...prev,
        ]);
        setMonitoredPostUrl("");
        showNotify("បានបន្ថែមផុសសម្រាប់ Monitor (Demo)");
      } else {
        const res = await api.post("/bot/monitored-posts", { url: monitoredPostUrl, pageId: monitoredPageId });
        if (res.data.success) {
          showNotify("បានបន្ថែមផុសសម្រាប់តាមដានរួចរាល់");
          setMonitoredPostUrl("");
          fetchMonitoredPosts();
        }
      }
    } catch (err) {
      showNotify(err.response?.data?.message || "បរាជ័យក្នុងការបន្ថែមផុស", "error");
    } finally {
      setIsAddingMonitored(false);
    }
  };

  const handleAddMonitoredById = async (postId, pageId) => {
    setIsAddingMonitored(true);
    try {
      if (isDemo) {
        setMonitoredPosts((prev) => [
          { id: Date.now().toString(), facebookPostId: postId, pageId, enabled: true, createdAt: new Date() },
          ...prev,
        ]);
        showNotify("បានបន្ថែមផុសសម្រាប់តាមដាន (Demo)");
      } else {
        const res = await api.post("/bot/monitored-posts", { url: postId, pageId });
        if (res.data.success) {
          showNotify("បានបន្ថែមផុសសម្រាប់តាមដានរួចរាល់");
          fetchMonitoredPosts();
        }
      }
    } catch (err) {
      showNotify(err.response?.data?.message || "បរាជ័យក្នុងការបន្ថែមផុស", "error");
    } finally {
      setIsAddingMonitored(false);
    }
  };

  const handleDeleteMonitored = async (id) => {
    if (!window.confirm("តើបងចង់ឈប់តាមដានផុសនេះមែនទេ?")) return;
    try {
      if (isDemo) {
        setMonitoredPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        await api.delete(`/bot/monitored-posts/${id}`);
        fetchMonitoredPosts();
      }
      showNotify("បានឈប់តាមដានផុសនេះរួចរាល់");
    } catch {
      showNotify("មិនអាចលុបបានទេ", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3 font-khmer">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>កំពុងផ្ទុកការកំណត់ Bot...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-khmer">
      {notification && (
        <div
          className={`fixed top-20 right-4 sm:right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
            notification.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {notification.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* 1️⃣ Master Status & Quick Readiness Checklist */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isEnabled
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <Power size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isEnabled ? "Bot កំពុងបើកដំណើរការ" : "Bot ត្រូវបានបិទ"}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isEnabled
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {isEnabled ? "Active" : "Paused"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                បើកកុងតាក់នេះ ដើម្បីឱ្យ Bot ឆ្លើយខមិន និងផ្ញើ Inbox ភ្ញៀវដោយស្វ័យប្រវត្តិ
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer self-end sm:self-center">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isEnabled}
              onChange={(e) => toggleBot(e.target.checked)}
            />
            <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-7 shadow-inner" />
          </label>
        </div>

        {/* 3-Step Readiness Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
            <span className="text-slate-600 dark:text-slate-300">១. បើកមុខងារ Bot</span>
            <span className={`font-bold ${isEnabled ? "text-emerald-600" : "text-amber-500"}`}>
              {isEnabled ? "✓ រួចរាល់" : "មិនទាន់បើក"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("pages")}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
          >
            <span className="text-slate-600 dark:text-slate-300">២. ផេកដែលបើក Bot</span>
            <span className={`font-bold ${enabledPagesCount > 0 ? "text-emerald-600" : "text-amber-500"}`}>
              {enabledPagesCount}/{availablePages.length} ផេក →
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
          >
            <span className="text-slate-600 dark:text-slate-300">៣. ច្បាប់ឆ្លើយតប</span>
            <span className={`font-bold ${activeRulesCount > 0 ? "text-emerald-600" : "text-amber-500"}`}>
              {activeRulesCount} ច្បាប់សកម្ម →
            </span>
          </button>
        </div>
      </div>

      {/* 2️⃣ Clean 3-Tab Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {[
          { id: "rules", label: `💬 ច្បាប់ឆ្លើយតប (${rules.length})`, icon: MessageSquare },
          { id: "pages", label: `🚩 ផេក & ផុស (${enabledPagesCount}/${availablePages.length})`, icon: Flag },
          { id: "history", label: `📜 ប្រវត្តិ (${history.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                active
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: RULES ==================== */}
      {activeTab === "rules" && (
        <div className="space-y-5">
          {/* Quick Setup Form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3 bg-slate-50/70 dark:bg-slate-800/30">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus size={18} className="text-blue-500" />
                  <span>{editingId ? "កែប្រែសារឆ្លើយតប" : "បង្កើតសារឆ្លើយតបស្វ័យប្រវត្តិ"}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ជ្រើសគំរូរហ័សខាងក្រោម ឬសរសេរពាក្យគន្លឹះនិងសារឆ្លើយតបដោយខ្លួនឯង
                </p>
              </div>

              <button
                type="button"
                onClick={generateAISuggestions}
                disabled={generating}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-purple-500/20 cursor-pointer disabled:opacity-60"
              >
                <Sparkles size={14} />
                <span>{generating ? "AI កំពុងសរសេរ..." : "ឱ្យ AI ជួយសរសេរ"}</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* 1-Click Quick Templates */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                  គំរូរហ័ស (ចុច ១ ដងដើម្បីបំពេញស្រាប់)៖
                </label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyword + Comment Reply */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    ១. ពាក្យដែលភ្ញៀវចូលចិត្តខមិន (Keyword)
                  </label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={(e) => handleFormChange("keyword", e.target.value)}
                    placeholder="ឧ. តម្លៃ (ឬទុកទំនេរដើម្បីឆ្លើយគ្រប់ខមិន)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    ទុកប្រអប់នេះឱ្យទំនេរ ប្រសិនបើចង់ឱ្យ Bot ឆ្លើយតបទៅគ្រប់ Comment ទាំងអស់។
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    ២. សារឆ្លើយតបក្នុង Comment *
                  </label>
                  <input
                    type="text"
                    value={formData.reply}
                    onChange={(e) => handleFormChange("reply", e.target.value)}
                    placeholder="ឧ. សូមបងឆែកប្រអប់សារ Inbox ណា!"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormChange("reply", `${formData.reply} [[name]]`.trim())}
                      className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-500/20 cursor-pointer"
                    >
                      + បន្ថែមឈ្មោះភ្ញៀវ [[name]]
                    </button>
                  </div>
                </div>
              </div>

              {/* Private DM Box */}
              <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.enableDm}
                      onChange={(e) => handleFormChange("enableDm", e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>📬 ផ្ញើសារចូល Messenger Inbox ភ្ញៀវបន្ថែមទៀត (DM)</span>
                  </label>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                      formData.enableDm
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {formData.enableDm ? "បើក DM" : "បិទ DM"}
                  </span>
                </div>

                {formData.enableDm && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={formData.dmReply}
                      onChange={(e) => handleFormChange("dmReply", e.target.value)}
                      placeholder="ឧ. សួស្តីបង [[name]]! តម្លៃទំនិញនេះគឺ $10 បងចង់កម្ម៉ង់ប៉ុន្មានដែរ?"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleFormChange("dmReply", `${formData.dmReply} [[name]]`.trim())}
                      className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-500/20 cursor-pointer"
                    >
                      + បន្ថែមឈ្មោះភ្ញៀវ [[name]]
                    </button>
                  </div>
                )}
              </div>

              {/* Attachment & Advanced Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  {formData.attachmentUrl ? (
                    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <img src={formData.attachmentUrl} alt="Attachment" className="w-8 h-8 rounded-lg object-cover" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">មានរូបភាពភ្ជាប់</span>
                      <button
                        type="button"
                        onClick={() => handleFormChange("attachmentUrl", null)}
                        className="text-rose-500 hover:text-rose-600 cursor-pointer"
                        title="លុបរូបភាព"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition">
                      {uploading ? <Loader size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      <span>{uploading ? "កំពុងបញ្ចូល..." : "ភ្ជាប់រូបភាព (បើមាន)"}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg, image/png"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <span>កំណត់កម្រិតខ្ពស់</span>
                    <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    >
                      បោះបង់
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={saveRule}
                    disabled={savingRule}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                  >
                    {savingRule ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{editingId ? "រក្សាទុកការកែប្រែ" : "រក្សាទុកច្បាប់នេះ"}</span>
                  </button>
                </div>
              </div>

              {/* Advanced Options (Hidden by default) */}
              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      របៀបផ្ទៀងផ្ទាត់ពាក្យ (Rule Type)
                    </label>
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      {["KEYWORD", "REGEX"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleFormChange("ruleType", type)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                            formData.ruleType === type
                              ? "bg-blue-600 text-white"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          }`}
                        >
                          {type === "KEYWORD" ? "ពាក្យធម្មតា (Keyword)" : "ទម្រង់ Regex"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      អនុវត្តលើផុស (Scope)
                    </label>
                    <select
                      value={formData.scope}
                      onChange={(e) => handleFormChange("scope", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      <option value="ALL">គ្រប់ផុសទាំងអស់ (All Posts)</option>
                      <option value="SPECIFIC">ផុសជាក់លាក់ (Specific Post)</option>
                    </select>
                  </div>

                  {formData.scope === "SPECIFIC" && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        Facebook Post ID ឬ Link ផុស
                      </label>
                      <input
                        type="text"
                        value={formData.postId}
                        onChange={(e) => handleFormChange("postId", e.target.value)}
                        placeholder="បញ្ចូល Facebook Post ID ឬ Link..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rules List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Filter size={16} className="text-blue-500" />
                  <span>បញ្ជីច្បាប់ដែលកំពុងប្រើ ({filtered.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={fetchRules}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="ស្វែងរកពាក្យគន្លឹះ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
                {searchTerm ? "មិនមានច្បាប់ដែលត្រូវនឹងការស្វែងរកទេ" : "មិនទាន់មានច្បាប់ឆ្លើយតបនៅឡើយទេ — ចុចគំរូរហ័សខាងលើដើម្បីចាប់ផ្ដើម!"}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.slice(0, visibleCount).map((r, idx) => (
                  <div
                    key={r.id || idx}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      r.enabled === false ? "opacity-60 bg-slate-50/50 dark:bg-slate-800/20" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {r.keyword === "*" ? "🌐 ឆ្លើយគ្រប់ខមិន" : `🔑 ${r.keyword}`}
                        </span>
                        {r.enableDm && r.dmReply ? (
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                            💬 Comment + 📬 DM
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            💬 Comment
                          </span>
                        )}
                        {r.scope === "SPECIFIC" && r.postId && (
                          <span className="text-[11px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold">
                            Post: {r.postId}
                          </span>
                        )}
                      </div>
                      {r.reply && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          <span className="font-semibold text-slate-400">តប Comment:</span> {r.reply}
                        </p>
                      )}
                      {r.enableDm && r.dmReply && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 line-clamp-1">
                          <span className="font-semibold">ផ្ញើ DM:</span> {r.dmReply}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={() => toggleRule(r.id, r.enabled !== false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                          r.enabled !== false
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {r.enabled !== false ? "បើក" : "បិទ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="p-2 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition cursor-pointer"
                        title="កែប្រែ"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule(r.id)}
                        className="p-2 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition cursor-pointer"
                        title="លុប"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {filtered.length > visibleCount && (
                  <div className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 10)}
                      className="px-5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      បង្ហាញបន្ថែម ({filtered.length - visibleCount})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PAGES & MONITORED POSTS ==================== */}
      {activeTab === "pages" && (
        <div className="space-y-5">
          {/* Page Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flag size={18} className="text-blue-500" />
                  <span>ជ្រើសរើសផេកដែលចង់ឱ្យ Bot ឆ្លើយតប</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  បើក Bot លើផេកណា នោះរាល់ Comment លើផេកនោះនឹងត្រូវបានឆ្លើយតបដោយស្វ័យប្រវត្តិ
                </p>
              </div>
              {availablePages.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAllPages(true)}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 cursor-pointer"
                  >
                    បើកទាំងអស់
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllPages(false)}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    បិទទាំងអស់
                  </button>
                </div>
              )}
            </div>

            {isLoadingPages ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
                <Loader size={16} className="animate-spin" />
                <span>កំពុងទាញយកបញ្ជីផេក...</span>
              </div>
            ) : availablePages.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center space-y-3 border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  មិនទាន់មានផេក Facebook ត្រូវបានភ្ជាប់ទេ។
                </p>
                <Link
                  to="/connections"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                >
                  <span>ទៅភ្ជាប់ផេក Facebook</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availablePages.map((page) => {
                  const active = isPageBotActive(page);
                  return (
                    <div
                      key={page.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        active
                          ? "bg-blue-500/5 border-blue-500/30"
                          : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={page.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=random`}
                          alt={page.name}
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{page.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">ID: {page.id}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={active}
                          onChange={(e) => togglePageBot(page.id, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Specific Post Monitoring */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search size={17} className="text-blue-500" />
                <span>តាមដានផុសជាក់លាក់ / ផុសចាស់ៗ (Optional)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                បន្ថែមផុសចាស់ៗ ឬផុសពី Page ដែលចង់ឱ្យ Bot តាមដានឆ្លើយខមិនដោយចំពោះ
              </p>
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {/* Manual Link Input */}
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="បិទភ្ជាប់ Link ផុស Facebook ទីនេះ..."
                  value={monitoredPostUrl}
                  onChange={(e) => setMonitoredPostUrl(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none"
                />
                <select
                  value={monitoredPageId}
                  onChange={(e) => setMonitoredPageId(e.target.value)}
                  className="md:w-56 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none"
                >
                  {availablePages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMonitored}
                  disabled={isAddingMonitored}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isAddingMonitored ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>បន្ថែមផុស</span>
                </button>
              </div>

              {/* Monitored List */}
              {monitoredPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500">កំពុងតាមដាន ({monitoredPosts.length})៖</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {monitoredPosts.map((post) => (
                      <div
                        key={post.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            Post ID: {post.facebookPostId}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            Page: {availablePages.find((ap) => ap.id === post.pageId)?.name || post.pageId}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMonitored(post.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                          title="ឈប់តាមដាន"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Posts Picker */}
              {availablePages.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">ផុសថ្មីៗពីផេក៖</p>
                    <select
                      value={browsePageId}
                      onChange={(e) => setBrowsePageId(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    >
                      {availablePages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {isLoadingRecent ? (
                    <div className="py-8 text-center text-xs text-slate-400">កំពុងទាញយកផុសថ្មីៗ...</div>
                  ) : recentPostsError ? (
                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>{recentPostsError.message}</span>
                      </div>
                      {recentPostsError.isExpired && (
                        <Link
                          to="/connections"
                          className="shrink-0 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <span>Sync ផេកឡើងវិញ</span>
                          <ExternalLink size={12} />
                        </Link>
                      )}
                    </div>
                  ) : recentPosts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      មិនទាន់មានផុសថ្មីៗសម្រាប់បង្ហាញទេ
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {recentPosts.map((post) => {
                        const isAlreadyMonitored = monitoredPosts.some((p) => p.facebookPostId === post.id);
                        return (
                          <div
                            key={post.id}
                            className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col justify-between"
                          >
                            {post.full_picture && (
                              <img src={post.full_picture} alt="Post" loading="lazy" className="w-full h-28 object-cover" />
                            )}
                            <div className="p-3 space-y-3">
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                {post.message || "(គ្មានអត្ថបទ)"}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleAddMonitoredById(post.id, browsePageId)}
                                disabled={isAlreadyMonitored || isAddingMonitored}
                                className={`w-full py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  isAlreadyMonitored
                                    ? "bg-emerald-500/15 text-emerald-600 cursor-default"
                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                              >
                                {isAlreadyMonitored ? "✅ កំពុងតាមដាន" : "+ តាមដានផុសនេះ"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: HISTORY ==================== */}
      {activeTab === "history" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History size={17} className="text-blue-500" />
                <span>ប្រវត្តិដែល Bot បានឆ្លើយតប</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                បង្ហាញការឆ្លើយតប Comment និង Inbox ថ្មីៗបំផុត
              </p>
            </div>
            <button
              type="button"
              onClick={fetchHistory}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoadingHistory ? "animate-spin" : ""} />
            </button>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center text-xs sm:text-sm text-slate-400">
              មិនទាន់មានប្រវត្តិឆ្លើយតបនៅឡើយទេ។
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((h) => (
                <div key={h.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Comment: {h.commentId?.includes("_") ? h.commentId.split("_").pop() : h.commentId || "Unknown"}
                      </span>
                      <span className="text-slate-400">• Page: {h.pageId}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{h.replyMessage}"</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400">
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        h.status === "success"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600"
                      }`}
                    >
                      {h.status === "success" ? "ជោគជ័យ" : h.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const BotReplySettingsAPI = ({ isDemo }) => <BotReplySettingsContent isDemo={isDemo} />;

export default BotReplySettingsAPI;
