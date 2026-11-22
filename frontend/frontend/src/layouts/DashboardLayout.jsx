import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import NetworkStatus from "../components/NetworkStatus";
import {
  Send, Clock, HelpCircle, Link as LinkIcon, MessageSquare, Zap, Settings, LogOut, Sun, Moon, Grid, X,
  Download, Video, Instagram, AtSign, Facebook, Images, Scissors, Music, TrendingUp, FileText, Languages,
  Radio, Trash2, QrCode, CreditCard, ChevronDown
} from "lucide-react";
import { toast } from "react-hot-toast";

const PRIMARY_NAV_ITEMS = [
  { label: "បង្កើតផុស", shortLabel: "ផុស", icon: Send, path: "/post" },
  { label: "ភ្ជាប់ផេក", shortLabel: "ផេក", icon: LinkIcon, path: "/connections" },
  { label: "កាលវិភាគ", shortLabel: "កក់ម៉ោង", icon: Clock, path: "/posts" },
  { label: "Bot ឆ្លើយតប", shortLabel: "Bot", icon: MessageSquare, path: "/bot" },
  { label: "អក្សររត់ AI", shortLabel: "អក្សររត់", icon: Languages, path: "/subtitles", badge: "AI" },
  { label: "កាត Bio", shortLabel: "កាត Bio", icon: QrCode, path: "/bio" },
];

const EXTRA_TOOL_SECTIONS = [
  {
    title: "ទាញយកវីដេអូ (គ្មាន Watermark)",
    items: [
      { label: "ទាញយកវីដេអូ TikTok", icon: Download, path: "/tools/tiktok" },
      { label: "ទាញយកវីដេអូ Facebook", icon: Facebook, path: "/tools/facebook" },
      { label: "ទាញយកវីដេអូ YouTube", icon: Video, path: "/tools/youtube" },
      { label: "ទាញយកវីដេអូ Instagram", icon: Instagram, path: "/tools/instagram" },
      { label: "ទាញយក CapCut", icon: Scissors, path: "/tools/capcut" },
      { label: "ទាញយកវីដេអូ Threads", icon: AtSign, path: "/tools/threads" },
      { label: "ទាញយកវីដេអូ Pinterest", icon: Images, path: "/tools/pinterest" },
    ],
  },
  {
    title: "ឧបករណ៍គ្រប់គ្រងផេក និងគណនី",
    items: [
      { label: "ផ្សាយផ្ទាល់ច្រើនផេក (Live)", icon: Radio, path: "/tools/live-stream" },
      { label: "សម្អាតផុសក្នុងផេក", icon: Trash2, path: "/tools/page-cleaner" },
      { label: "បម្លែងឯកសារ", icon: FileText, path: "/tools/document-converter" },
      { label: "ស្វែងរកវីដេអូល្បី", icon: TrendingUp, path: "/tools/viral-finder" },
      { label: "ចម្រៀងកំពុងល្បី TikTok", icon: Music, path: "/tools/tiktok/trends" },
      { label: "វីដេអូល្បីៗ", icon: Zap, path: "/viral-posts" },
      { label: "ទិញ Credits", icon: CreditCard, path: "/buy-credits" },
      { label: "របៀបប្រើប្រាស់", icon: HelpCircle, path: "/guide" },
      { label: "ការកំណត់គណនី", icon: Settings, path: "/settings" },
    ],
  },
];

const DashboardLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsMenuRef = useRef(null);
  const isDarkMode = theme === "dark";

  const isToolRouteActive = EXTRA_TOOL_SECTIONS.some((sec) =>
    sec.items.some((item) => item.path === location.pathname)
  );

  useEffect(() => {
    setIsToolsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      const newUrl =
        window.location.pathname +
        window.location.search.replace(/[\?&]success=[^&]+/, "").replace(/^&/, "?");
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
      const newUrl =
        window.location.pathname +
        window.location.search.replace(/[\?&]error=[^&]+/, "").replace(/^&/, "?");
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
      className={`min-h-screen flex flex-col font-khmer ${
        isDarkMode ? "bg-[#0b0f19] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* 1. CLEAN TOP NAVIGATION BAR (NO SIDEBAR) */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${
          isDarkMode
            ? "bg-[#111827]/95 border-slate-800/80"
            : "bg-white/95 border-slate-200/80 shadow-2xs"
        }`}
      >
        <div className="max-w-7xl mx-auto h-15 px-3 sm:px-6 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link to="/post" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-xs">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold leading-tight">EZA-POST</span>
              <span className="text-[10px] text-blue-500 font-semibold leading-none">
                moneaa.site
              </span>
            </div>
          </Link>

          {/* Horizontal Primary Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : isDarkMode
                      ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-md ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-indigo-500/15 text-indigo-500"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Dropdown Button for Extra Tools */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setIsToolsOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isToolRouteActive || isToolsOpen
                    ? "bg-blue-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Grid size={15} />
                <span>ឧបករណ៍</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform ${isToolsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </nav>

          {/* Right Actions: Network, Theme Toggle, Profile & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:block">
              <NetworkStatus />
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title={isDarkMode ? "ប្ដូរទៅផ្ទៃភ្លឺ" : "ប្ដូរទៅផ្ទៃងងឹត"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} className="text-indigo-600" />}
              <span className="hidden xl:inline">{isDarkMode ? "ផ្ទៃភ្លឺ" : "ផ្ទៃងងឹត"}</span>
            </button>

            <Link
              to="/settings"
              title="ការកំណត់គណនី"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                location.pathname === "/settings"
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-extrabold">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="hidden sm:inline max-w-[90px] truncate">
                {user?.name || "គណនី"}
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="ចាកចេញពីគណនី"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40"
                  : "bg-slate-100 border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Tools Popover Panel (No Sidebar, Clean Full-Width Grid Menu) */}
        {isToolsOpen && (
          <div
            className={`border-t shadow-2xl ${
              isDarkMode
                ? "bg-[#111827] border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-500">
                  មុខងារ និងឧបករណ៍ទាំងអស់
                </span>
                <button
                  type="button"
                  onClick={() => setIsToolsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {EXTRA_TOOL_SECTIONS.map((section, idx) => (
                  <div key={idx} className="space-y-2.5">
                    <p className="text-xs font-bold text-slate-400">{section.title}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsToolsOpen(false)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                              isActive
                                ? "bg-blue-600 text-white border-blue-600"
                                : isDarkMode
                                ? "bg-slate-800/60 border-slate-700/80 text-slate-200 hover:border-blue-500/50"
                                : "bg-slate-50 border-slate-200/80 text-slate-700 hover:border-blue-500/50 hover:bg-blue-50/30"
                            }`}
                          >
                            <Icon size={16} className={isActive ? "text-white" : "text-blue-500"} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 2. FULL-WIDTH CENTERED WORKSPACE (NO LEFT SIDEBAR OFFSET) */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-3 sm:p-5 lg:p-6 pb-24 md:pb-10 min-w-0">
        {children}
      </main>

      {/* 3. MOBILE BOTTOM TAB BAR (< md) */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 h-16 z-40 border-t px-1 grid grid-cols-5 items-center ${
          isDarkMode
            ? "bg-[#111827] border-slate-800 text-slate-300"
            : "bg-white border-slate-200 text-slate-600 shadow-lg"
        }`}
      >
        {PRIMARY_NAV_ITEMS.slice(0, 4).map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-colors min-w-0 ${
                isActive ? "text-blue-600 dark:text-blue-400 font-bold" : "opacity-75 hover:opacity-100"
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  isActive ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : ""
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
          onClick={() => setIsToolsOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-colors min-w-0 cursor-pointer ${
            isToolsOpen || isToolRouteActive ? "text-blue-600 font-bold" : "opacity-75 hover:opacity-100"
          }`}
        >
          <div className="p-1 rounded-lg">
            <Grid size={18} />
          </div>
          <span className="text-[10px] leading-none truncate max-w-full">ឧបករណ៍</span>
        </button>
      </nav>
    </div>
  );
};

export default DashboardLayout;
