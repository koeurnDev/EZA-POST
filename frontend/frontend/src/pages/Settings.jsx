// ============================================================
// ⚙️ Settings.jsx — Moneaa Clean Settings Page
// ============================================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import {
  LogOut, Moon, Sun, User, Mail, CreditCard,
  Zap, ChevronRight, Shield, Pencil
} from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import toast from "react-hot-toast";

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("ចាកចេញបានជោគជ័យ!");
    } catch {
      toast.error("មានបញ្ហា សូមព្យាយាមម្តងទៀត");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 font-khmer">

        {/* ── Page Title ── */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">ការកំណត់គណនី</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">គ្រប់គ្រងគណនី និងការកំណត់ផ្ទាល់ខ្លួន</p>
        </div>

        {/* ── Profile Card ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">គណនី</span>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold transition-colors cursor-pointer"
            >
              <Pencil size={12} />
              កែប្រែ
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-xl shadow-md shadow-blue-600/20 flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-full h-full object-cover rounded-xl" />
              ) : (
                (user?.name?.[0] || "U").toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white text-base truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{user?.email}</p>
              <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-500/20">
                {user?.plan || "free"} plan
              </span>
            </div>
          </div>
        </div>

        {/* ── Active Features ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">មុខងាររហ័ស</span>
          </div>

          <Link to="/post" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">បង្កើតផុស Facebook</p>
              <p className="text-xs text-slate-500 mt-0.5">Video PE · រូបភាព · Reels · កក់ម៉ោង</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </Link>

          <Link to="/bio" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CreditCard size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">ឌីជីថលកាតអាជីវកម្ម</p>
              <p className="text-xs text-slate-500 mt-0.5">Bio Card · Bakong KHQR</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </Link>

          <Link to="/subtitles" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">ស្ទូឌីយោ Subtitle AI</p>
              <p className="text-xs text-slate-500 mt-0.5">អក្សររត់ខ្មែរ · CapCut Draft</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </Link>
        </div>

        {/* ── Appearance ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">រូបរាង</span>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${theme === "dark" ? "bg-indigo-500/10" : "bg-orange-500/10"}`}>
                {theme === "dark"
                  ? <Moon size={18} className="text-indigo-400" />
                  : <Sun size={18} className="text-orange-500" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">ផ្ទៃងងឹត (Dark Mode)</p>
                <p className="text-xs text-slate-500 mt-0.5">{theme === "dark" ? "កំពុងបើក" : "កំពុងបិទ (ផ្ទៃភ្លឺ)"}</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={toggleTheme}
              className={`relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer ${theme === "dark" ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${theme === "dark" ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* ── Security ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">សុវត្ថិភាព</span>
          </div>

          <Link to="/forgot-password" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">ប្តូរលេខសម្ងាត់</p>
              <p className="text-xs text-slate-500 mt-0.5">Reset Password</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        </div>

        {/* ── Logout ── */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all text-sm font-bold cursor-pointer"
        >
          <LogOut size={16} />
          ចាកចេញពីគណនី
        </button>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-slate-600 pb-4">
          Moneaa v1.0 · <a href="https://moneaa.site" className="hover:text-slate-400 transition-colors">moneaa.site</a>
        </p>

      </div>

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </DashboardLayout>
  );
}
