import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import NetworkStatus from "../components/NetworkStatus";
import {
  LayoutDashboard, Send, Layers, Clock, BarChart2, HelpCircle, Link as LinkIcon, MessageSquare, Zap, Settings, LogOut, Sun, Moon, User, Grid, Search, Bell, MoreHorizontal, X,
  Download, Video, Instagram, AtSign, Facebook, Images, Scissors, ShoppingBag, Music, TrendingUp, Film, FileText, ImagePlus, Wand2, EyeOff, Repeat, Languages, Users, Cloud, Eraser
} from "lucide-react";
import { toast } from "react-hot-toast";

const DashboardLayout = ({ children }) => {
  const [scrolled, setScrolled] = useState(false);
  const MotionDiv = motion.div;
  const MotionAnimatePresence = AnimatePresence;
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const isDarkMode = theme === "dark";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);

    // 🛡️ Global Notification Handler (for OAuth redirects, etc.)
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (success) {
      if (success === "facebook_connected") {
        toast.success("ភ្ជាប់គណនី Facebook ជោគជ័យ! 🎉");
      } else {
        toast.success("ប្រតិបត្តិការជោគជ័យ!");
      }
      // Clean URL
      const newUrl = window.location.pathname + window.location.search.replace(/[\?&]success=[^&]+/, '').replace(/^&/, '?');
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
      // Clean URL
      const newUrl = window.location.pathname + window.location.search.replace(/[\?&]error=[^&]+/, '').replace(/^&/, '?');
      window.history.replaceState({}, document.title, newUrl);
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.search]);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const CORE_NAV = [
    { label: "បង្កើតផុស", icon: <Send size={22} />, path: "/post" },
    { label: "បញ្ជីពេលវេល", icon: <Clock size={22} />, path: "/posts" },
    { label: "ឆ្លើយតបស្វ័យប្រវត្តិ", icon: <MessageSquare size={22} />, path: "/bot" },
  ];

  const TOOL_CATEGORIES = [
    {
      title: "ឧបករណ៍សង្គម",
      items: [
        { label: "គណនី", icon: <LinkIcon size={18} />, path: "/connections" },
        { label: "ជំនួយ", icon: <HelpCircle size={18} />, path: "/guide" },
        { label: "ការកំណត់", icon: <Settings size={18} />, path: "/settings" },
      ]
    },
    {
      title: "កម្មវិធីទាញយកវីដេអូ",
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
      title: "ឧបករណ៍ច្នៃប្រឌិត",
      items: [
        { label: "ឯកសារ", icon: <FileText size={18} />, path: "/tools/document-converter" },
      ]
    },
    {
      title: "ឧបករណ៍កម្រិតខ្ពស់",
      items: [
        { label: "ស្វែងរកវីដេអូ", icon: <TrendingUp size={18} />, path: "/tools/viral-finder" },
        { label: "វីដេអូល្បីៗ", icon: <Music size={18} />, path: "/tools/tiktok/trends" },
      ]
    }
  ];

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden ${isDarkMode ? "bg-[#050505] text-white" : "bg-[#f8f9fa] text-gray-900"} md:transition-colors md:duration-500`}>

      <header className={`fixed top-0 left-0 right-0 h-16 md:h-20 z-40 px-3 md:px-6 flex items-center justify-between gap-2 transition-all duration-300 ${scrolled ? (isDarkMode ? "bg-[#050505] md:backdrop-blur-xl border-b border-white/5" : "bg-white md:backdrop-blur-xl border-b border-gray-100 shadow-sm") : "bg-transparent"}`}>
        <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-6 min-w-0">
            <Link to="/dashboard" className="flex items-center gap-2 md:gap-3 group">
              <div className="w-8 h-8 md:w-11 md:h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg md:rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 group-hover:rotate-6 transition-transform">
                <Zap className="text-white fill-white" size={16}  />
              </div>
              <div className="flex flex-col">
                <span className="text-sm md:text-lg font-bold tracking-tight">EZA_POST</span>
                <span className="hidden sm:block text-[7px] md:text-[10px] uppercase tracking-widest text-blue-500 font-bold opacity-80">Social Manager</span>
              </div>
            </Link>
          </div>

          <div className={`flex items-center gap-1 md:gap-2 p-1 md:p-1.5 rounded-lg md:rounded-2xl border ${isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-gray-200 shadow-sm"} md:backdrop-blur-xl min-w-0`}>
            <div className="hidden sm:block min-w-0">
              <NetworkStatus />
            </div>
            <button onClick={toggleTheme} className={`p-1.5 md:p-2.5 rounded-md md:rounded-xl transition-all ${isDarkMode ? "hover:bg-white/10 text-yellow-400" : "hover:bg-gray-100 text-gray-600"}`}>
              {isDarkMode ? <Sun size={16}  /> : <Moon size={16}  />}
            </button>
            <div className={`w-px h-4 md:h-6 mx-0.5 md:mx-1 ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`}></div>
            <Link to="/settings" className={`flex items-center gap-1.5 md:gap-3 p-0.5 md:p-1 rounded-md md:rounded-xl transition-all ${isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
              <div className="w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-[10px] md:text-sm text-white shadow-lg">
                {user?.name?.[0] || "U"}
              </div>
              <div className="hidden sm:flex flex-col pr-1 md:pr-2 text-left">
                <span className="text-[10px] md:text-xs font-bold leading-tight">{user?.name || "User"}</span>
                <span className="text-[8px] md:text-[9px] opacity-60">Pro Account</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 md:pt-24 pb-32 px-3 md:px-6 max-w-[1400px] mx-auto w-full min-w-0">
        <MotionDiv 
          initial={{ opacity: 0, y: window.innerWidth < 768 ? 0 : 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: window.innerWidth < 768 ? 0.3 : 0.6, ease: "easeOut" }} 
          className="relative z-10 motion-div-container"
        >
          {children}
        </MotionDiv>
      </main>

      {/* 🚀 FLOATING COMMAND DOCK */}
      <div className="fixed bottom-4 md:bottom-10 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="relative pointer-events-auto flex justify-center w-full max-w-full">

          {/* More Menu Popover */}
          <MotionAnimatePresence>
            {isMoreMenuOpen && (
              <>
                <MotionDiv
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-md z-[-1]"
                />
                <MotionDiv
                  initial={{ opacity: 0, y: 30, scale: 0.95, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                  exit={{ opacity: 0, y: 30, scale: 0.95, x: "-50%" }}
                  transition={{ duration: window.innerWidth < 768 ? 0.2 : 0.4 }}
                  className={`
                    fixed bottom-20 md:bottom-24 left-1/2
                    w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] md:w-full md:max-w-2xl p-4 md:p-8
                    rounded-3xl md:rounded-[3rem] border backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.3)]
                    max-h-[75vh] overflow-y-auto custom-scrollbar 
                    ${isDarkMode ? "bg-[#0b0b0f]/90 border-white/10 shadow-blue-500/5" : "bg-white/95 border-gray-200 shadow-gray-200/20"}
                  `}
                >
                  <div className="space-y-6 md:space-y-8">
                    {TOOL_CATEGORIES.map((cat, idx) => (
                      <div key={idx}>
                        <div className="flex items-center gap-2 mb-4 px-1">
                          <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                          <p className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-black opacity-60">{cat.title}</p>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 md:gap-4">
                          {cat.items.map((item) => {
                            const isActiveItem = location.pathname === item.path;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMoreMenuOpen(false)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 ${isActiveItem ? (isDarkMode ? "bg-white/10 scale-105" : "bg-blue-50 scale-105") : (isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-100 text-gray-700")}`}
                              >
                                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${isActiveItem ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : (isDarkMode ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-black/5")}`}>
                                  {React.cloneElement(item.icon, { size: isActiveItem ? 22 : 20 })}
                                </div>
                                <span className={`text-[8px] md:text-[10px] font-bold text-center leading-tight tracking-tight ${isActiveItem ? "text-blue-500" : "opacity-70"}`}>{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`h-px ${isDarkMode ? "bg-white/5" : "bg-gray-100"} my-5 md:my-8`}></div>

                  <div className="flex justify-between items-center px-1">
                    <div className="flex flex-col">
                      <p className="text-[10px] font-black text-blue-500 tracking-wider">EZA_POST PRO</p>
                      <p className="text-[8px] opacity-40 font-bold">STABLE V2.1.0</p>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest border border-red-500/20 shadow-xl shadow-red-500/10">
                      <LogOut size={14} /> ចាកចេញ
                    </button>
                  </div>
                </MotionDiv>
              </>
            )}
          </MotionAnimatePresence>

          {/* Main Dock Bar - Scrollable on Mobile */}
          <nav className={`
            flex items-center justify-center gap-1 p-1 md:p-1.5 rounded-full border md:backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all
            w-full max-w-[95vw] md:max-w-fit mx-auto overflow-x-auto no-scrollbar
            ${isDarkMode
              ? "bg-black/60 border-white/10 shadow-blue-500/5"
              : "bg-white/90 border-gray-200 shadow-gray-200/30"}
          `}>

            <div className="flex items-center gap-1 shrink-0">
              {CORE_NAV.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className={`relative flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full transition-all duration-300 group ${isActive ? "bg-blue-600 text-white shadow-xl shadow-blue-600/40 scale-105" : (isDarkMode ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-black/5 hover:text-black")}`}>
                    {React.cloneElement(item.icon, { size: 22 })}
                    <div className="hidden md:block absolute -top-14 px-3 py-1.5 rounded-xl bg-black text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-2xl border border-white/10 scale-90 group-hover:scale-100">
                      {item.label}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45 border-r border-b border-white/10"></div>
                    </div>
                    {isActive && <MotionDiv layoutId="active-nav" className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />}
                  </Link>
                );
              })}
            </div>

            <div className={`shrink-0 w-px h-6 md:h-8 mx-1 md:mx-2 ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`}></div>

            <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className={`shrink-0 relative flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full transition-all duration-300 ${isMoreMenuOpen ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/40" : (isDarkMode ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5")}`}>
              {isMoreMenuOpen ? <X size={22} /> : <Grid size={22} />}
            </button>
          </nav>
        </div>
      </div>

      {/* 🧩 Global Effects & Animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kantumruy+Pro:ital,wght@0,100..700;1,100..700&display=swap');
        body { font-family: 'Kantumruy Pro', sans-serif; overflow-x: hidden; width: 100%; position: relative; -webkit-tap-highlight-color: transparent; }
        html { scroll-behavior: smooth; overflow-x: hidden; width: 100%; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.2); border-radius: 20px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(100, 100, 100, 0.3); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 768px) {
          main { padding-left: 0.5rem; padding-right: 0.5rem; }
          
          /* 🚀 Ultra-Performance: Disable blurs and heavy animations on low-end mobile */
          * {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          
          .animate-pulse, .animate-bounce, .animate-spin {
            animation-duration: 0.8s !important; /* Slow down instead of killing for better feel */
          }

          /* Hardware acceleration for mobile */
          .fixed, .absolute, nav, header, .motion-div-container {
            will-change: transform;
            transform: translateZ(0);
            backface-visibility: hidden;
            perspective: 1000;
          }
          
          /* Simplify shadows for memory */
          .shadow-2xl, .shadow-xl, .shadow-lg {
             box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
          }
        }

        @media (max-width: 480px) {
          .xs\\:hidden { display: none !important; }
          .xs\\:block { display: block !important; }
        }

        .motion-div-container {
          will-change: transform, opacity;
          transform: translateZ(0);
        }
      `}</style>
    </div>
  );
};

export default DashboardLayout;
