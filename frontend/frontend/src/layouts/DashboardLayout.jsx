import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { motion } from "framer-motion";
import NetworkStatus from "../components/NetworkStatus";
import {
  LayoutDashboard,
  Video,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  User,
  Images,
  Link as LinkIcon,
  UploadCloud,
  Download,
  Sparkles,
  Facebook,
  Send,
  Instagram,
  Scissors,
  Eraser,
  BarChart2,
  Music,
  TrendingUp,
  Film,
  ShoppingBag,
  Languages,
  Wand2,
  EyeOff,
  Repeat,
  FileText,
  ImagePlus,
  Cloud,
  Users,
  Zap,
  Coins
} from "lucide-react";

// 🧭 Navigation Items (Organized by Category)
const NAV_ITEMS = [
  // ✅ Working Tools (Top Priority)
  { type: "header", label: "Downloaders" },
  { label: "TikTok", icon: <Download size={20} />, path: "/tools/tiktok" },
  { label: "YouTube", icon: <Video size={20} />, path: "/tools/youtube" },
  { label: "Instagram", icon: <Instagram size={20} />, path: "/tools/instagram" },
  { label: "Facebook", icon: <Facebook size={20} />, path: "/tools/facebook" },
  { label: "Pinterest", icon: <Images size={20} />, path: "/tools/pinterest" },
  { label: "Telegram", icon: <Send size={20} />, path: "/tools/telegram" },
  { label: "CapCut", icon: <Scissors size={20} />, path: "/tools/capcut" },
  { type: "divider" },

  { type: "header", label: "Active AI Tools" },


  { type: "divider" },

  { type: "header", label: "Discovery" },
  { label: "Viral Finder", icon: <TrendingUp size={20} />, path: "/tools/viral-finder" },
  { label: "Trending Sounds", icon: <Music size={20} />, path: "/tools/tiktok/trends" },
  { type: "divider" },

  // 🚀 Coming Soon Sections (Moved to Bottom)
  { type: "header", label: "Core (Coming Soon)" },
  { label: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/dashboard" },
  { label: "Posting", icon: <UploadCloud size={20} />, path: "/post" },
  { label: "Auto-Boost", icon: <Zap size={20} />, path: "/boost-settings" },
  { label: "Analytics", icon: <BarChart2 size={20} />, path: "/analytics" },
  { type: "divider" },

  { type: "header", label: "Creator Tools (Coming Soon)" },
  { label: "Video Creator", icon: <Film size={20} />, path: "/tools/video-creator" },
  { label: "AI Script Writer", icon: <FileText size={20} />, path: "/tools/script-writer" },
  { label: "AI Thumbnails", icon: <ImagePlus size={20} />, path: "/tools/thumbnail-generator" },
  { label: "Magic Motion", icon: <Wand2 size={20} />, path: "/tools/magic-motion" },
  { label: "Auto Censorship", icon: <EyeOff size={20} />, path: "/tools/censorship" },
  { label: "Label Swap", icon: <Repeat size={20} />, path: "/tools/label-swap" },
  { label: "Khmer Subtitles", icon: <Languages size={20} />, path: "/tools/subtitle-generator" },
  { label: "Doc Converter", icon: <FileText size={20} />, path: "/tools/document-converter" },
  { label: "Watermark Remover", icon: <Eraser size={20} />, path: "/tools/ai" },
  { type: "divider" },

  { type: "header", label: "Advanced (Coming Soon)" },
  { label: "Cloud Farm", icon: <Users size={20} />, path: "/tools/farm" },
  { label: "Telegram Cloud", icon: <Cloud size={20} />, path: "/tools/telegram-cloud" },
  { label: "Dropship Center", icon: <ShoppingBag size={20} />, path: "/tools/dropship-center" },
  { type: "divider" },

  { type: "header", label: "System (Coming Soon)" },
  { label: "Connections", icon: <LinkIcon size={20} />, path: "/connections" },
  { label: "Auto-Reply Bot", icon: <MessageSquare size={20} />, path: "/bot" },
  { label: "Settings", icon: <Settings size={20} />, path: "/settings" },
];

/**
 * Optimized Sidebar Component
 * Memoized to prevent re-renders unless user/location changes
 */
const SidebarContent = React.memo(({ user, handleLogout, location, onLinkClick }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <span className="text-2xl">🚀</span>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            EZA_POST
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto min-h-0 pb-20">
        {NAV_ITEMS.map((item, index) => {
          // Section Header
          if (item.type === "header") {
            return (
              <div key={`header-${index}`} className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {item.label}
              </div>
            );
          }

          // Divider
          if (item.type === "divider") {
            return <div key={`divider-${index}`} className="my-2 border-t border-gray-200 dark:border-gray-700" />;
          }

          // Regular Link
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 group ${isActive
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              <span className={`${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user?.email || "user@example.com"}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
});

export default function DashboardLayout({ children }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className={`min-h-screen flex ${theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>

      {/* 🖥️ Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-30">
        <SidebarContent user={user} handleLogout={handleLogout} location={location} />
      </aside>

      {/* 📱 Mobile Sidebar (Drawer) - Optimized for Performance */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in duration-200"
          />
          <aside
            style={{ willChange: 'transform' }}
            className={`fixed inset-y-0 left-0 w-[80%] max-w-xs bg-white dark:bg-gray-900 z-50 lg:hidden shadow-2xl transform transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
          >
            <SidebarContent
              user={user}
              handleLogout={handleLogout}
              location={location}
              onLinkClick={() => setMobileMenuOpen(false)}
            />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            >
              <X size={20} />
            </button>
          </aside>
        </>
      )}

      {/* 📄 Main Content Wrapper */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen transition-all duration-300">

        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 hidden sm:block">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <NetworkStatus />
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={16} className="text-gray-500 dark:text-gray-400" />
                )}
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
