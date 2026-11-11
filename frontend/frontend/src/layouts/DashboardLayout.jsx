import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import NetworkStatus from "../components/NetworkStatus";
import {
  Send, Clock, HelpCircle, Link as LinkIcon, MessageSquare, Zap, Settings, LogOut, Sun, Moon, Grid, X,
  Download, Video, Instagram, AtSign, Facebook, Images, Scissors, Music, TrendingUp, FileText, Languages,
  Radio, Trash2, QrCode, Menu
} from "lucide-react";
import { toast } from "react-hot-toast";

const SIDEBAR_SECTIONS = [
  {
    title: "មុខងារចម្បង",
    items: [
      { label: "បង្កើតផុសថ្មី", shortLabel: "ផុស", icon: Send, path: "/post" },
      { label: "អក្សររត់ AI", shortLabel: "អក្សររត់", icon: Languages, path: "/subtitles", badge: "AI" },
      { label: "កាលវិភាគផុស", shortLabel: "កាលវិភាគ", icon: Clock, path: "/posts" },
      { label: "ឆ្លើយតបស្វ័យប្រវត្តិ", shortLabel: "ឆ្លើយតប", icon: MessageSquare, path: "/bot" },
      { label: "ភ្ជាប់ផេក Facebook", shortLabel: "ផេក", icon: LinkIcon, path: "/connections" },
      { label: "កាតអាជីវកម្មឌីជីថល", shortLabel: "កាត Bio", icon: QrCode, path: "/bio" },
    ],
  },
  {
    title: "ទាញយកវីដេអូ",
    items: [
      { label: "ទាញយកវីដេអូ TikTok", icon: Download, path: "/tools/tiktok" },
      { label: "ទាញយកវីដេអូ YouTube", icon: Video, path: "/tools/youtube" },
      { label: "ទាញយកវីដេអូ Facebook", icon: Facebook, path: "/tools/facebook" },
      { label: "ទាញយកវីដេអូ Instagram", icon: Instagram, path: "/tools/instagram" },
      { label: "ទាញយក CapCut", icon: Scissors, path: "/tools/capcut" },
      { label: "ទាញយកវីដេអូ Threads", icon: AtSign, path: "/tools/threads" },
      { label: "ទាញយកវីដេអូ Pinterest", icon: Images, path: "/tools/pinterest" },
    ],
  },
  {
    title: "ឧបករណ៍ផេក និងគណនី",
    items: [
      { label: "ផ្សាយផ្ទាល់ច្រើនផេក", icon: Radio, path: "/tools/live-stream" },
      { label: "សម្អាតផុសក្នុងផេក", icon: Trash2, path: "/tools/page-cleaner" },
      { label: "បម្លែងឯកសារ", icon: FileText, path: "/tools/document-converter" },
      { label: "ស្វែងរកវីដេអូល្បី", icon: TrendingUp, path: "/tools/viral-finder" },
      { label: "ចម្រៀងកំពុងល្បី TikTok", icon: Music, path: "/tools/tiktok/trends" },
      { label: "ការកំណត់គណនី", icon: Settings, path: "/settings" },
      { label: "របៀបប្រើប្រាស់", icon: HelpCircle, path: "/guide" },
    ],
  },
];

const MOBILE_BOTTOM_TABS = SIDEBAR_SECTIONS[0].items.slice(0, 4);

const DashboardLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const isDarkMode = theme === "dark";

  // Find active item label for the top header breadcrumb
  const activeNavItem =
    SIDEBAR_SECTIONS.flatMap((s) => s.items).find((i) => i.path === location.pathname) ||
    SIDEBAR_SECTIONS[0].items[0];

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

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

  const renderSidebarLinks = (onItemClick) => (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 no-scrollbar">
      {SIDEBAR_SECTIONS.map((section, sIdx) => (
        <div key={sIdx}>
          <p
            className={`px-2.5 mb-1.5 text-[11px] font-bold ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onItemClick}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : isDarkMode
                      ? "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={16}
                      className={
                        isActive
                          ? "text-white shrink-0"
                          : isDarkMode
                          ? "text-slate-400 shrink-0"
                          : "text-slate-500 shrink-0"
                      }
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${
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
          </div>
        </div>
      ))}

      {/* Quick Download EZA-POST FB Extension Box */}
      <div
        className={`p-3 rounded-xl border ${
          isDarkMode
            ? "bg-blue-500/10 border-blue-500/20 text-slate-200"
            : "bg-blue-50/80 border-blue-200 text-slate-800"
        }`}
      >
        <p className="text-xs font-semibold font-khmer mb-1 flex items-center gap-1.5">
          <Zap size={13} className="text-blue-500 fill-blue-500 shrink-0" />
          <span>ផ្នែកបន្ថែមភ្ជាប់ Facebook</span>
        </p>
        <p className="text-[11px] opacity-75 font-khmer mb-2">
          ភ្ជាប់ផេកស្វ័យប្រវត្តិដោយមិនប្រើ Token ដោយដៃ
        </p>
        <a
          href="/eza-post-fb-extension.zip"
          download="EZA-POST-FB-Extension.zip"
          className="w-full py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all font-khmer shadow-2xs"
        >
          <Download size={13} />
          <span>ទាញយក Extension</span>
        </a>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen flex ${
        isDarkMode ? "bg-[#0b0f19] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* 1. DESKTOP LEFT SIDEBAR (Fixed, Clean, 1-Click Access to Everything) */}
      <aside
        className={`hidden lg:flex flex-col w-60 shrink-0 fixed top-0 bottom-0 left-0 z-40 border-r ${
          isDarkMode
            ? "bg-[#111827] border-slate-800/90"
            : "bg-white border-slate-200/90"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-14 px-4 flex items-center justify-between border-b shrink-0 ${
            isDarkMode ? "border-slate-800/80" : "border-slate-200/80"
          }`}
        >
          <Link to="/post" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-xs">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold leading-tight">EZA_POST</span>
              <span className="text-[10px] text-blue-500 font-semibold leading-none">
                Social & AI Studio
              </span>
            </div>
          </Link>
        </div>

        {/* All Navigation Links */}
        {renderSidebarLinks()}

        {/* Sidebar Footer: User & Logout */}
        <div
          className={`p-3 border-t flex items-center justify-between gap-2 shrink-0 ${
            isDarkMode ? "border-slate-800/80 bg-slate-900/40" : "border-slate-200/80 bg-slate-50/60"
          }`}
        >
          <Link to="/settings" className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{user?.name || "គណនីរបស់ខ្ញុំ"}</p>
              <p className="text-[10px] opacity-60 truncate">Pro Workspace</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="ចាកចេញពីគណនី"
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              isDarkMode
                ? "hover:bg-red-500/15 text-slate-400 hover:text-red-400"
                : "hover:bg-red-50 text-slate-500 hover:text-red-600"
            }`}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 2. MOBILE SLIDE-OVER DRAWER (For All Tools & Links on Phone/Tablet) */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div
            className={`relative w-72 max-w-[82vw] h-full flex flex-col z-10 border-r shadow-2xl ${
              isDarkMode
                ? "bg-[#111827] border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div
              className={`h-14 px-4 flex items-center justify-between border-b shrink-0 ${
                isDarkMode ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="text-white fill-white" size={14} />
                </div>
                <span className="text-sm font-extrabold">EZA_POST ម៉ឺនុយ</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className={`p-1.5 rounded-lg ${
                  isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {renderSidebarLinks(() => setIsMobileDrawerOpen(false))}

            <div
              className={`p-3 border-t flex items-center justify-between ${
                isDarkMode ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <span className="text-xs font-semibold truncate">{user?.name || "គណនី"}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold"
              >
                <LogOut size={14} />
                <span>ចាកចេញ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. RIGHT WORKSPACE COLUMN (Top Bar + Page Content) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Sticky Top Bar */}
        <header
          className={`sticky top-0 z-30 h-14 px-3 sm:px-6 flex items-center justify-between border-b ${
            isDarkMode
              ? "bg-[#111827]/95 border-slate-800/80"
              : "bg-white/95 border-slate-200/80"
          }`}
        >
          {/* Left: Mobile Menu Button + Current Page Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className={`lg:hidden p-2 rounded-xl border transition-colors ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-200"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              }`}
              title="បើកម៉ឺនុយទាំងអស់"
            >
              <Menu size={18} />
            </button>

            <Link to="/post" className="lg:hidden flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white fill-white" size={14} />
              </div>
              <span className="text-sm font-extrabold hidden xs:inline">EZA_POST</span>
            </Link>

            <div className="hidden lg:flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold truncate">{activeNavItem.label}</span>
            </div>
          </div>

          {/* Right: Quick Connections Link, Network Status, Light/Dark Mode Toggle & Profile */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/connections"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                location.pathname === "/connections"
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDarkMode
                  ? "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              <LinkIcon size={13} />
              <span>ភ្ជាប់ផេក</span>
            </Link>

            <div className="hidden sm:block">
              <NetworkStatus />
            </div>

            {/* Light / Dark Mode Toggle with Clear Label */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDarkMode ? "ប្ដូរទៅផ្ទៃភ្លឺ" : "ប្ដូរទៅផ្ទៃងងឹត"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 hover:bg-slate-750 text-amber-400"
                  : "bg-slate-100 border-slate-200 hover:bg-slate-200/70 text-slate-700"
              }`}
            >
              {isDarkMode ? (
                <>
                  <Sun size={14} className="text-amber-400" />
                  <span className="hidden sm:inline text-slate-200">ផ្ទៃភ្លឺ</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-indigo-600" />
                  <span className="hidden sm:inline text-slate-700">ផ្ទៃងងឹត</span>
                </>
              )}
            </button>

            <Link
              to="/settings"
              className={`lg:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs`}
            >
              {user?.name?.[0]?.toUpperCase() || "U"}
            </Link>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 pb-20 lg:pb-8 max-w-[1320px] w-full mx-auto min-w-0">
          {children}
        </main>
      </div>

      {/* 4. MOBILE BOTTOM TAB BAR (< lg, 5 Equal Columns with Khmer Labels) */}
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 h-16 z-40 border-t px-1 grid grid-cols-5 items-center ${
          isDarkMode
            ? "bg-[#111827] border-slate-800 text-slate-300"
            : "bg-white border-slate-200 text-slate-600 shadow-lg"
        }`}
      >
        {MOBILE_BOTTOM_TABS.map((tab) => {
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
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-colors min-w-0 ${
            isMobileDrawerOpen ? "text-blue-600 font-bold" : "opacity-75 hover:opacity-100"
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
