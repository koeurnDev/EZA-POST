import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  Trash2,
  AlertTriangle,
  RefreshCw,
  Search,
  Calendar,
  ExternalLink,
  CheckSquare,
  Square,
  ThumbsUp,
  MessageCircle,
  Share2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  ChevronDown,
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function PageCleaner() {
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [posts, setPosts] = useState([]);
  const [selectedPostIds, setSelectedPostIds] = useState(new Set());
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // "all", "7", "30", "90"

  // Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteProgress, setDeleteProgress] = useState(null);

  // 1. Fetch connected pages
  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      setLoadingPages(true);
      const res = await api.get("/page-cleaner/pages");
      if (res.data?.success) {
        const pageList = res.data.pages || [];
        setPages(pageList);
        if (pageList.length > 0 && !selectedPageId) {
          setSelectedPageId(pageList[0].id);
        }
      }
    } catch (err) {
      toast.error("មិនអាចទាញយកបញ្ជី Pages បានទេ: " + (err.response?.data?.error || err.message));
    } finally {
      setLoadingPages(false);
    }
  };

  // 2. Fetch posts when page changes
  useEffect(() => {
    if (selectedPageId) {
      fetchPosts(selectedPageId);
    } else {
      setPosts([]);
      setSelectedPostIds(new Set());
    }
  }, [selectedPageId]);

  const fetchPosts = async (pageId) => {
    try {
      setLoadingPosts(true);
      setSelectedPostIds(new Set());
      const res = await api.get(`/page-cleaner/posts/${pageId}?limit=100`);
      if (res.data?.success) {
        setPosts(res.data.posts || []);
      } else {
        toast.error(res.data?.error || "មិនអាចទាញយក Posts បានទេ");
      }
    } catch (err) {
      toast.error("បញ្ហាក្នុងការទាញយក Posts: " + (err.response?.data?.error || err.message));
    } finally {
      setLoadingPosts(false);
    }
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    // Search text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const msg = (post.message || "").toLowerCase();
      if (!msg.includes(q)) return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const days = parseInt(dateFilter, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const postDate = new Date(post.created_time);
      if (postDate > cutoff) return false;
    }

    return true;
  });

  // Toggle selection
  const toggleSelectPost = (postId) => {
    const updated = new Set(selectedPostIds);
    if (updated.has(postId)) {
      updated.delete(postId);
    } else {
      updated.add(postId);
    }
    setSelectedPostIds(updated);
  };

  const handleSelectAll = () => {
    if (selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0) {
      setSelectedPostIds(new Set());
    } else {
      const allIds = new Set(filteredPosts.map((p) => p.id));
      setSelectedPostIds(allIds);
    }
  };

  // Execute Batch Delete
  const handleExecuteDelete = async () => {
    if (confirmInput.trim().toUpperCase() !== "DELETE" && confirmInput.trim() !== "លុប") {
      return toast.error("សូមវាយពាក្យ 'DELETE' ឬ 'លុប' ដើម្បីបញ្ជាក់");
    }

    const postIdsToDelete = Array.from(selectedPostIds);
    if (postIdsToDelete.length === 0) return;

    try {
      setDeleting(true);
      setDeleteProgress({ current: 0, total: postIdsToDelete.length });

      const res = await api.post("/page-cleaner/delete", {
        pageId: selectedPageId,
        postIds: postIdsToDelete,
        confirmation: confirmInput.trim().toUpperCase() === "DELETE" ? "DELETE" : "លុប",
      });

      if (res.data?.success) {
        const { deletedCount, failedCount } = res.data;
        toast.success(
          `បានលុបដោយជោគជ័យ ${deletedCount} ផុស! ${failedCount > 0 ? `(បរាជ័យ ${failedCount})` : ""}`,
          { duration: 5000, icon: "🧹" }
        );

        // Remove deleted posts from local list
        const remaining = posts.filter((p) => !postIdsToDelete.includes(p.id));
        setPosts(remaining);
        setSelectedPostIds(new Set());
        setShowConfirmModal(false);
        setConfirmInput("");
      } else {
        toast.error(res.data?.error || "ការលុបមិនបានសម្រេច");
      }
    } catch (err) {
      toast.error("កំហុសពេលលុប: " + (err.response?.data?.error || err.message));
    } finally {
      setDeleting(false);
      setDeleteProgress(null);
    }
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600/10 via-orange-600/10 to-transparent p-6 rounded-3xl border border-red-500/20 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-red-500/25">
                <Trash2 size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight">Facebook Page Cleaner</h1>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                    1-Click Bulk Wiper
                  </span>
                </div>
                <p className="text-sm opacity-70 mt-1">
                  សម្អាត ឬលុប Posts ចាស់ៗលើ Facebook Page ក្នុងពេលតែមួយលឿនរហ័សតាម Meta Graph Batch API (50 ផុស/batch)
                </p>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectedPageId && fetchPosts(selectedPageId)}
                disabled={loadingPosts}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition"
              >
                <RefreshCw size={16} className={loadingPosts ? "animate-spin text-blue-500" : ""} />
                ផ្ទុកឡើងវិញ
              </button>
            </div>
          </div>
        </div>

        {/* Page Selector & Toolbar */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Page Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider opacity-70">
                ជ្រើសរើស Facebook Page
              </label>
              {loadingPages ? (
                <div className="h-11 rounded-xl bg-white/5 animate-pulse" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  >
                    {pages.map((p) => (
                      <option key={p.id} value={p.id} className="bg-gray-900 text-white">
                        {p.name} {p.followersCount ? `(${p.followersCount.toLocaleString()} followers)` : ""}
                      </option>
                    ))}
                    {pages.length === 0 && (
                      <option value="">មិនមាន Page ដែលបានភ្ជាប់ទេ</option>
                    )}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                  />
                </div>
              )}
            </div>

            {/* Date Preset Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider opacity-70">
                កាលបរិច្ឆេទ
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5">
                {[
                  { label: "ទាំងអស់", val: "all" },
                  { label: "> 7 ថ្ងៃ", val: "7" },
                  { label: "> 30 ថ្ងៃ", val: "30" },
                  { label: "> 90 ថ្ងៃ", val: "90" },
                ].map((tab) => (
                  <button
                    key={tab.val}
                    onClick={() => setDateFilter(tab.val)}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      dateFilter === tab.val
                        ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                        : "opacity-60 hover:opacity-100 hover:bg-white/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider opacity-70">
                ស្វែងរកតាម Caption
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  placeholder="ស្វែងរកអត្ថបទ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>
          </div>

          {/* Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                disabled={filteredPosts.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs font-bold transition disabled:opacity-40"
              >
                {selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0 ? (
                  <>
                    <CheckSquare size={16} className="text-red-500" /> ដោះការជ្រើសរើសទាំងអស់
                  </>
                ) : (
                  <>
                    <Square size={16} className="opacity-60" /> ជ្រើសរើសទាំងអស់ ({filteredPosts.length})
                  </>
                )}
              </button>

              <span className="text-xs font-medium opacity-70">
                បានជ្រើសរើស: <strong className="text-red-400 font-bold">{selectedPostIds.size}</strong> /{" "}
                {filteredPosts.length} ផុស
              </span>
            </div>

            {/* Big Action Button */}
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={selectedPostIds.size === 0 || deleting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition transform active:scale-95"
            >
              <Trash2 size={16} />
              លុបចោល ({selectedPostIds.size}) ផុស
            </button>
          </div>
        </div>

        {/* Posts List / Grid */}
        <div className="space-y-3">
          {loadingPosts ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center opacity-70">
              <Loader2 size={36} className="animate-spin text-red-500" />
              <p className="text-sm font-medium">កំពុងទាញយក Posts ពី Meta Facebook Graph API...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center space-y-3">
              <CheckCircle2 size={40} className="mx-auto text-emerald-400 opacity-80" />
              <h3 className="text-base font-bold">គ្មាន Posts ត្រូវបានរកឃើញទេ</h3>
              <p className="text-xs opacity-60 max-w-sm mx-auto">
                {posts.length === 0
                  ? "Page នេះមិនទាន់មាន Published Posts ឬត្រូវបានសម្អាតអស់ហើយ។"
                  : "គ្មាន Post ត្រូវគ្នានឹងលក្ខខណ្ឌចម្រាញ់កាលបរិច្ឆេទ ឬអត្ថបទស្វែងរកឡើយ។"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPosts.map((post) => {
                const isSelected = selectedPostIds.has(post.id);
                const postDate = new Date(post.created_time).toLocaleString("km-KH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <motion.div
                    key={post.id}
                    onClick={() => toggleSelectPost(post.id)}
                    className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-red-500/10 border-red-500 shadow-lg shadow-red-500/10 ring-1 ring-red-500"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Top Bar: Checkbox + Date + Link */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <CheckSquare size={18} className="text-red-500 shrink-0" />
                          ) : (
                            <Square size={18} className="opacity-40 shrink-0" />
                          )}
                          <span className="text-[11px] font-medium opacity-60">{postDate}</span>
                        </div>
                        <a
                          href={post.permalink_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-md hover:bg-white/10 opacity-60 hover:opacity-100 transition"
                          title="មើលលើ Facebook"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      {/* Thumbnail & Message */}
                      <div className="flex gap-3">
                        {post.thumbnail && (
                          <img
                            src={post.thumbnail}
                            alt="Post media"
                            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/10"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        )}
                        <p className="text-xs line-clamp-3 font-medium leading-relaxed opacity-85">
                          {post.message}
                        </p>
                      </div>
                    </div>

                    {/* Stats Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] opacity-70">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <ThumbsUp size={12} className="text-blue-400" />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={12} className="text-emerald-400" />
                          {post.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Share2 size={12} className="text-purple-400" />
                          {post.shares}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5">
                        {post.mediaType}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation Danger Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gray-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-red-400">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                    <ShieldAlert size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">បញ្ជាក់ការលុបជាអចិន្ត្រៃយ៍</h3>
                    <p className="text-xs text-red-300">Action cannot be undone</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200 space-y-1 leading-relaxed">
                  <p>
                    ⚠️ អ្នកកំពុងរៀបចំនឹងលុប <strong>{selectedPostIds.size} ផុស</strong> ពី Facebook Page{" "}
                    <strong>"{selectedPage?.name}"</strong> ជាអចិន្ត្រៃយ៍។
                  </p>
                  <p>ទិន្នន័យដែលបានលុប មិនអាចទាញយកមកវិញបានឡើយ!</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold opacity-70">
                    ដើម្បីបញ្ជាក់ សូមវាយពាក្យ <code className="text-red-400 font-mono">DELETE</code> ឬ{" "}
                    <code className="text-red-400 font-mono">លុប</code> ខាងក្រោម៖
                  </label>
                  <input
                    type="text"
                    placeholder="វាយ 'DELETE' ឬ 'លុប'"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    disabled={deleting}
                    className="w-full bg-black/40 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {deleteProgress && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span>កំពុងដំណើរការលុបតាម Graph Batch...</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div className="bg-red-500 h-full animate-pulse w-full" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setConfirmInput("");
                    }}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition"
                  >
                    បោះបង់
                  </button>
                  <button
                    onClick={handleExecuteDelete}
                    disabled={
                      deleting ||
                      (confirmInput.trim().toUpperCase() !== "DELETE" && confirmInput.trim() !== "លុប")
                    }
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        កំពុងលុប...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        យល់ព្រមលុប
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

