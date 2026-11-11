import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import NetworkStatus from "../components/NetworkStatus";
import {
  Send, Clock, HelpCircle, Link as LinkIcon, MessageSquare, Zap, Settings, LogOut, Sun, Moon, Grid, X,
  Download, Video, Instagram, AtSign, Facebook, Images, Scissors, Music, TrendingUp, FileText, Languages,
  Radio, Trash2, QrCode, ChevronDown
} from "lucide-react";
import { toast } from "react-hot-toast";

const PRIMARY_TABS = [
  { label: "បង្កើតផុស", shortLabel: "ផុស", icon: Send, path: "/post" },
  { label: "អក្សររត់ AI", shortLabel: "KhmerSub", icon: Languages, path: "/subtitles" },
  { label: "កាលវិភាគ", shortLabel: "កាលវិភាគ", icon: Clock, path: "/posts" },
  { label: "ឆ្លើយតប Bot", shortLabel: "Bot ឆ្លើយ", icon: MessageSquare, path: "/bot" },
  { label: "ភ្ជាប់ផេក", shortLabel: "គណនីផេក", icon: LinkIcon, path: "/connections" },
  { label: "កាត Bio", shortLabel: "កាត Bio", icon: QrCode, path: "/bio" },
];

const TOOL_GROUPS = [
  {
    title: "ទាញយកវីដេអូគ្មាន Watermark (Downloaders)",
    items: [
      { label: "TikTok Downloader", desc: "ទាញយកវីដេអូ TikTok HD", icon: Download, path: "/tools/tiktok", color: "text-pink-500 bg-pink-500/10" },
      { label: "YouTube Downloader", desc: "ទាញយក YouTube & Shorts", icon: Video, path: "/tools/youtube", color: "text-red-500 bg-red-500/10" },
      { label: "Facebook Downloader", desc: "ទាញយកវីដេអូ & Reels", icon: Facebook, path: "/tools/facebook", color: "text-blue-500 bg-blue-500/10" },
      { label: "Instagram Downloader", desc: "ទាញយក Reels & រូបភាព", icon: Instagram, path: "/tools/instagram", color: "text-purple-500 bg-purple-500/10" },
      { label: "Threads Downloader", desc: "ទាញយកវីដេអូពី Threads", icon: AtSign, path: "/tools/threads", color: "text-slate-400 bg-slate-500/10" },
      { label: "Pinterest Downloader", desc: "ទាញយកវីដេអូ & រូបភាព", icon: Images, path: "/tools/pinterest", color: "text-rose-500 bg-rose-500/10" },
      { label: "CapCut Template", desc: "ទាញយកវីដេអូពី CapCut", icon: Scissors, path: "/tools/capcut", color: "text-emerald-500 bg-emerald-500/10" },
    ]
  },
  {
    title: "ឧបករណ៍គ្រប់គ្រងផេក & ច្នៃប្រឌិត (Page & AI Tools)",
    items: [
      { label: "Live Stream ច្រើនផេក", desc: "ផ្សាយផ្ទាល់វីដេអូទៅច្រើនផេក", icon: Radio, path: "/tools/live-stream", color: "text-red-500 bg-red-500/10" },
      { label: "សម្អាតផុស (Page Cleaner)", desc: "លុបផុសចាស់ៗលើផេក دفعةតែមួយ", icon: Trash2, path: "/tools/page-cleaner", color: "text-amber-500 bg-amber-500/10" },
      { label: "បម្លែងឯកសារ (Converter)", desc: "បម្លែង PDF, Word និងរូបភាព", icon: FileText, path: "/tools/document-converter", color: "text-indigo-500 bg-indigo-500/10" },
      { label: "ស្វែងរកវីដេអូល្បី (Viral)", desc: "ស្វែងរកវីដេអូកំពុងពេញនិយម", icon: TrendingUp, path: "/tools/viral-finder", color: "text-cyan-500 bg-cyan-500/10" },
      { label: "TikTok Trends", desc: "ចម្រៀង និងវីដេអូកំពុងផ្ទុះ", icon: Music, path: "/tools/tiktok/trends", color: "text-violet-500 bg-violet-500/10" },
    ]
  },
  {
    title: "គណនី & ជំនួយ (Account & Help)",
    items: [
      { label: "ភ្ជាប់គណនី (Connections)", desc: "គ្រប់គ្រង Facebook Pages", icon: LinkIcon, path: "/connections", color: "text-blue-500 bg-blue-500/10" },
      { label: "ការកំណត់ (Settings)", desc: "កែប្រែព័ត៌មានគណនី & សុវត្ថិភាព", icon: Settings, path: "/settings", color: "text-slate-400 bg-slate-500/10" },
      { label: "របៀបប្រើប្រាស់ (Guide)", desc: "ណែនាំពីការប្រើប្រាស់ប្រព័ន្ធ", icon: HelpCircle, path: "/guide", color: "text-emerald-500 bg-emerald-500/10" },
    ]
  }
];

const DashboardLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  const isDarkMode = theme === "dark";

  const isToolRoute = location.pathname.startsWith("/tools") || location.pathname === "/guide" || location.pathname === "/settings";

  useEffect(() => {
    setIsToolsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setIsToolsOpen(false);
      }
    };
    if (isToolsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isToolsOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (success) {
      if (success === "facebook_connected") {
        toast.success("ភ្ជាប់គណនី Facebook ជោគជ័យ! 🎉");
      } else {
        toast.success("ប្រតិបត្តិការជោគជ័យ!");
      }
      const newUrl = window.location.pathname + window.location.search.replace(/[\?&]success=[^&]+/, "").replace(/^&/, "?");
      window.history.replaceState({}, document.title, newUrl);
    }

    if (error) {
      if (error === "fb_auth_failed") {
        toast.error("ការភ្ជាប់ Facebook បានបរាជ័យ។ សូមព្យាយាមម្តងទៀត។");
      } else if (error === "session_expired") {
        toast.error("Session របស់បងបានផុតកំណត់។ សូម Login ម្តងទៀត។");
      } else {
        toast.error("មានបញ្ហាអ្វីមួយ! សូមព្យាយាមម្តងទៀត។");
      }
      const newUrl = window.location.pathname + window.location.search.replace(/[\?&]error=[^&]+/, "").replace(/^&/, "?");
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [location.search]);

  const handleLogout = async () => {
    await logout();
    toast.success("បានចាកចេញដោយជោគជ័យ");
    navigate("/login");
  };

  return (
    <div
      className={`min-h-screen flex flex-col overflow-x-hidden ${
        isDarkMode ? "bg-[#090d16] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* 1. CLEAN STICKY TOP HEADER WITH DIRECT TABS */}
      <header
        className={`sticky top-0 left-0 right-0 h-14 md:h-16 z-40 px-3 md:px-6 flex items-center justify-between border-b ${
          isDarkMode
            ? "bg-[#0d1321]/95 border-slate-800/80"
            : "bg-white/95 border-slate-200/80 shadow-xs"
        }`}
      >
        <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between gap-2 md:gap-4">
          {/* Left: Brand Logo */}
          <Link to="/post" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm md:text-base font-extrabold tracking-tight leading-none">
                EZA_POST
              </span>
              <span className="text-[9px] uppercase tracking-wider text-blue-500 font-bold mt-0.5">
                Social Studio
              </span>
            </div>
          </Link>

          {/* Center: Desktop/Laptop Primary Navigation Tabs (Scroll-safe on smaller laptops) */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl border bg-slate-500/5 border-slate-500/10 overflow-x-auto no-scrollbar min-w-0 max-w-full">
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3.5 py-1.5 rounded-lg text-[11px] xl:text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                      : isDarkMode
                      ? "text-slate-300 hover:text-white hover:bg-white/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}

            {/* Tools Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 rounded-lg text-[11px] xl:text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                isToolsOpen || isToolRoute
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : isDarkMode
                  ? "text-slate-300 hover:text-white hover:bg-white/5"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Grid size={14} className="shrink-0" />
              <span>ឧបករណ៍</span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-150 ${isToolsOpen ? "rotate-180" : ""}`}
              />
            </button>
          </nav>

          {/* Right: Quick Status, Mobile Page Link, Theme Toggle & User Profile */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <Link
              to="/connections"
              className={`md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                location.pathname === "/connections"
                  ? "bg-blue-600 text-white border-blue-500"
                  : isDarkMode
                  ? "bg-slate-800/70 border-slate-700/80 text-slate-200"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              <LinkIcon size={13} />
              <span>ផេក</span>
            </Link>

            <div className="hidden xl:block">
              <NetworkStatus />
            </div>

            <button
              onClick={toggleTheme}
              title={isDarkMode ? "ប្ដូរទៅពន្លឺថ្ងៃ (Light Mode)" : "ប្ដូរទៅងងឹត (Dark Mode)"}
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode
                  ? "bg-slate-800/70 border-slate-700/80 hover:bg-slate-800 text-amber-400"
                  : "bg-slate-100 border-slate-200 hover:bg-slate-200/70 text-slate-700"
              }`}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <Link
              to="/settings"
              className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border transition-colors ${
                isDarkMode
                  ? "bg-slate-800/70 border-slate-700/80 hover:bg-slate-800"
                  : "bg-slate-100 border-slate-200 hover:bg-slate-200/70"
              }`}
            >
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="hidden sm:inline text-xs font-bold truncate max-w-[90px]">
                {user?.name || "គណនី"}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. ALL TOOLS DRAWER / MODAL (Fast, Clean, Readable Card Grid) */}
      {isToolsOpen && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 p-3 md:p-6 overflow-y-auto">
          <div
            ref={toolsRef}
            className={`w-full max-w-3xl rounded-2xl border p-4 md:p-6 shadow-2xl my-auto max-h-[85vh] overflow-y-auto ${
              isDarkMode
                ? "bg-[#111827] border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-500/15">
              <div className="flex items-center gap-2">
                <Grid size={18} className="text-blue-500" />
                <h2 className="text-sm md:text-base font-bold">
                  មជ្ឈមណ្ឌលឧបករណ៍ទាំងអស់ (All Tools & Settings)
                </h2>
              </div>
              <button
                onClick={() => setIsToolsOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {TOOL_GROUPS.map((group, idx) => (
                <div key={idx}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2.5">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsToolsOpen(false)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            isActive
                              ? "border-blue-500 bg-blue-500/10"
                              : isDarkMode
                              ? "border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700"
                              : "border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                            <Icon size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{item.label}</p>
                            <p className="text-[11px] opacity-65 truncate mt-0.5">{item.desc}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-500/15">
              <span className="text-xs opacity-60 font-medium">
                EZA_POST Cloud Studio • Fast Edition
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-colors text-xs font-bold border border-red-500/20"
              >
                <LogOut size={14} />
                <span>ចាកចេញពីគណនី</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN PAGE CONTENT (Instant 0ms Render, Clean Spacing) */}
      <main className="flex-1 pt-3 md:pt-5 pb-20 md:pb-8 px-3 md:px-6 max-w-[1440px] mx-auto w-full min-w-0">
        {children}
      </main>

      {/* 4. MOBILE BOTTOM TAB BAR (Visible on Phone < md, 5 Equal Grid Columns with Khmer Labels) */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 h-16 z-40 border-t px-1 grid grid-cols-5 items-center ${
          isDarkMode
            ? "bg-[#0d1321]/98 border-slate-800 text-slate-300"
            : "bg-white/98 border-slate-200 text-slate-600 shadow-lg"
        }`}
      >
        {PRIMARY_TABS.slice(0, 4).map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-colors min-w-0 ${
                isActive
                  ? "text-blue-500 font-bold"
                  : "opacity-75 hover:opacity-100"
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  isActive ? "bg-blue-500/15 text-blue-500" : ""
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="text-[10px] leading-none truncate max-w-full">{tab.shortLabel}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setIsToolsOpen(!isToolsOpen)}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-colors min-w-0 ${
            isToolsOpen || isToolRoute
              ? "text-indigo-500 font-bold"
              : "opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`p-1 rounded-lg ${
              isToolsOpen || isToolRoute ? "bg-indigo-500/15 text-indigo-500" : ""
            }`}
          >
            <Grid size={18} />
          </div>
          <span className="text-[10px] leading-none truncate max-w-full">ឧបករណ៍</span>
        </button>
      </nav>
    </div>
  );
};

export default DashboardLayout;
