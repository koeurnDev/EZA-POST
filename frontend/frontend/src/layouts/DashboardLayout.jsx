import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;
const MotionAnimatePresence = AnimatePresence;
import NetworkStatus from "../components/NetworkStatus";
import {
  LayoutDashboard, Send, Layers, Clock, BarChart2, Link as LinkIcon, MessageSquare, Zap, Settings, LogOut, Sun, Moon, User, Grid, Search, Bell, MoreHorizontal, X,
  Download, Video, Instagram, AtSign, Facebook, Images, Scissors, ShoppingBag, Music, TrendingUp, Film, FileText, ImagePlus, Wand2, EyeOff, Repeat, Languages, Users, Cloud, Eraser
} from "lucide-react";
import { toast } from "react-hot-toast";

const DashboardLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const isDarkMode = theme === "dark";

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const CORE_NAV = [
    { label: "Overview", icon: <LayoutDashboard size={22} />, path: "/dashboard" },
    { label: "Quick Post", icon: <Send size={22} />, path: "/post" },
    { label: "Bulk", icon: <Layers size={22} />, path: "/bulk-upload" },
    { label: "Queue", icon: <Clock size={22} />, path: "/posts" },
    { label: "Analytics", icon: <BarChart2 size={22} />, path: "/analytics" },
  ];

  const TOOL_CATEGORIES = [
    {
      title: "Automation & Social",
      items: [
        { label: "Reply Bot", icon: <MessageSquare size={18} />, path: "/bot" },
        { label: "Auto-Boost", icon: <Zap size={18} />, path: "/boost-settings" },
        { label: "Connections", icon: <LinkIcon size={18} />, path: "/connections" },
        { label: "Settings", icon: <Settings size={18} />, path: "/settings" },
      ]
    },
    {
      title: "Downloaders 2026",
      items: [
        { label: "TikTok", icon: <Download size={18} />, path: "/tools/tiktok" },
        { label: "YouTube", icon: <Video size={18} />, path: "/tools/youtube" },
        { label: "Instagram", icon: <Instagram size={18} />, path: "/tools/instagram" },
        { label: "Threads", icon: <AtSign size={18} />, path: "/tools/threads" },
        { label: "Facebook", icon: <Facebook size={18} />, path: "/tools/facebook" },
        { label: "Pinterest", icon: <Images size={18} />, path: "/tools/pinterest" },
        { label: "CapCut", icon: <Scissors size={18} />, path: "/tools/capcut" },
      ]
    },
    {
      title: "AI & Content Tools",
      items: [
        { label: "Video Creator", icon: <Film size={18} />, path: "/tools/video-creator" },
        { label: "AI Script", icon: <FileText size={18} />, path: "/tools/script-writer" },
        { label: "AI Thumbnails", icon: <ImagePlus size={18} />, path: "/tools/thumbnail-generator" },
        { label: "Magic Motion", icon: <Wand2 size={18} />, path: "/tools/magic-motion" },
        { label: "Censorship", icon: <EyeOff size={18} />, path: "/tools/censorship" },
        { label: "Label Swap", icon: <Repeat size={18} />, path: "/tools/label-swap" },
        { label: "Subtitles", icon: <Languages size={18} />, path: "/tools/subtitle-generator" },
        { label: "Doc Convert", icon: <FileText size={18} />, path: "/tools/document-converter" },
        { label: "Watermark", icon: <Eraser size={18} />, path: "/tools/ai" },
      ]
    },
    {
      title: "Cloud & Scaling",
      items: [
        { label: "Cloud Farm", icon: <Users size={18} />, path: "/tools/farm" },
        { label: "TG Cloud", icon: <Cloud size={18} />, path: "/tools/telegram-cloud" },
        { label: "Viral Finder", icon: <TrendingUp size={18} />, path: "/tools/viral-finder" },
        { label: "Trending", icon: <Music size={18} />, path: "/tools/tiktok/trends" },
      ]
    }
  ];

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? "bg-[#050505] text-white" : "bg-[#f8f9fa] text-gray-900"} font-outfit transition-colors duration-500`}>

      <header className={`fixed top-0 left-0 right-0 h-20 z-40 px-6 flex items-center justify-between`}>
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 group-hover:rotate-6 transition-transform">
              <Zap className="text-white fill-white" size={22} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight">EZA_POST</span>
              <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold opacity-80">Platform 2026</span>
            </div>
          </Link>
          <div className={`hidden lg:flex items-center px-4 py-2 rounded-2xl border ${isDarkMode ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5"} backdrop-blur-md`}>
            <Search size={16} className="text-gray-500" />
            <input type="text" placeholder="⌘ + K to search..." className="bg-transparent border-none focus:ring-0 text-sm ml-2 w-48 placeholder:text-gray-600" />
          </div>
        </div>

        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-gray-200 shadow-sm"} backdrop-blur-xl`}>
          <NetworkStatus />
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl transition-all ${isDarkMode ? "hover:bg-white/10 text-yellow-400" : "hover:bg-gray-100 text-gray-600"}`}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className={`w-px h-6 mx-1 ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`}></div>
          <Link to="/settings" className={`flex items-center gap-3 p-1 rounded-xl transition-all ${isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-lg">
              {user?.name?.[0] || "U"}
            </div>
            <div className="hidden sm:flex flex-col pr-2 text-left">
              <span className="text-xs font-bold leading-tight">{user?.name || "User"}</span>
              <span className="text-[9px] opacity-60">Pro Account</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-24 pb-32 px-6 max-w-[1600px] mx-auto w-full">
        <MotionDiv initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="relative z-10">
          {children}
        </MotionDiv>
      </main>
      {/* 🚀 FLOATING COMMAND DOCK */}
      <div className="fixed bottom-6 md:bottom-10 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="relative pointer-events-auto flex justify-center w-full max-w-full">

          {/* More Menu Popover */}
          <MotionAnimatePresence>
            {isMoreMenuOpen && (
              <MotionDiv
                initial={{ opacity: 0, y: 50, scale: 0.95, x: "-50%" }}
                animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                exit={{ opacity: 0, y: 50, scale: 0.95, x: "-50%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={`
                  fixed bottom-24 left-1/2
                  w-[calc(100vw-2rem)] md:w-full md:max-w-xl p-6 md:p-8
                  rounded-[3rem] border backdrop-blur-3xl shadow-2xl 
                  max-h-[75vh] overflow-y-auto custom-scrollbar 
                  ${isDarkMode ? "bg-[#0b0b0f]/95 border-white/10 shadow-blue-500/10" : "bg-white/95 border-gray-200 shadow-gray-200/40"}
                `}
              >
                <div className="space-y-8 md:space-y-6">
                  {TOOL_CATEGORIES.map((cat, idx) => (
                    <div key={idx}>
                      <div className="flex items-center gap-2 mb-4 md:mb-3 px-1">
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                        <p className="text-[10px] uppercase tracking-widest font-extrabold opacity-50">{cat.title}</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        {cat.items.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMoreMenuOpen(false)}
                            className={`flex flex-col items-center gap-2.5 p-3 w-[100px] md:w-[110px] rounded-[2rem] transition-all duration-300 ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100 text-gray-700"}`}
                          >
                            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-transform hover:scale-110 ${isDarkMode ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-black/5 shadow-sm"}`}>
                              {React.cloneElement(item.icon, { size: 22 })}
                            </div>
                            <span className="text-[11px] md:text-[10px] font-bold text-center leading-tight tracking-tight">{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`h-px ${isDarkMode ? "bg-white/5" : "bg-gray-100"} my-6 md:my-5`}></div>

                <div className="flex justify-between items-center px-1">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold opacity-60">EZA_POST PRO</p>
                    <p className="text-[8px] opacity-40">V2.0.26</p>
                  </div>
                  <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-[11px] font-bold shadow-lg shadow-red-500/20">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </MotionDiv>
            )}
          </MotionAnimatePresence>

          {/* Main Dock Bar - Scrollable on Mobile */}
          <nav className={`
            flex items-center gap-1 p-1.5 md:p-2 rounded-[2.5rem] border backdrop-blur-2xl shadow-2xl transition-all
            max-w-full overflow-x-auto no-scrollbar
            ${isDarkMode
              ? "bg-black/60 border-white/10 shadow-blue-500/10"
              : "bg-white/80 border-gray-200 shadow-gray-200/40"}
          `}>

            <div className="flex items-center gap-1 shrink-0">
              {CORE_NAV.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className={`relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 group ${isActive ? "bg-blue-600 text-white shadow-xl shadow-blue-600/40 scale-110" : (isDarkMode ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-black/5 hover:text-black")}`}>
                    {React.cloneElement(item.icon, { size: 20 })}
                    <div className="hidden md:block absolute -top-14 px-3 py-1.5 rounded-xl bg-black text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-2xl border border-white/10 scale-90 group-hover:scale-100">
                      {item.label}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45 border-r border-b border-white/10"></div>
                    </div>
                    {isActive && <MotionDiv layoutId="active-nav" className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />}
                  </Link>
                );
              })}
            </div>

            <div className={`shrink-0 w-px h-6 md:h-8 mx-1.5 md:mx-2 ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`}></div>

            <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className={`shrink-0 relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 ${isMoreMenuOpen ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/40" : (isDarkMode ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5")}`}>
              {isMoreMenuOpen ? <X size={20} /> : <Grid size={20} />}
            </button>
          </nav>
        </div>
      </div>

      {/* 🧩 Global Effects & Animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Outfit', sans-serif; overflow-x: hidden; -webkit-tap-highlight-color: transparent; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.2); border-radius: 20px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(100, 100, 100, 0.3); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }

        /* Mobile specific fixes */
        @media (max-width: 768px) {
          main { padding-left: 1rem; padding-right: 1rem; }
        }
      `}</style>
    </div>
  );
};

export default DashboardLayout;
