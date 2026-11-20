import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ArrowRight, Smartphone, Languages, CreditCard, Film, Sparkles, Check } from "lucide-react";

export default function Welcome() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#08090c] text-slate-100 font-['Kantumruy_Pro'] flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* 🌟 Clean Minimalist Header */}
      <header className="border-b border-white/5 backdrop-blur-md bg-[#08090c]/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md">
              M
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white leading-none">Moneaa</span>
              <span className="text-[10px] text-blue-400 font-medium tracking-wide">moneaa.site</span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {!user ? (
              <>
                <Link to="/login" className="text-slate-300 hover:text-white transition-colors">
                  ចូលគណនី
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
                >
                  ចាប់ផ្តើមឥតគិតថ្លៃ
                </Link>
              </>
            ) : (
              <Link
                to="/bio"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 🦸 Clean Minimalist Hero */}
      <main className="max-w-5xl mx-auto px-5 pt-16 md:pt-24 pb-20 w-full">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
            <Sparkles size={13} />
            <span>Moneaa Studio • moneaa.site</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.2] mb-6">
            កាតអាជីវកម្មឌីជីថល <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              & ស្ទូឌីយោ Subtitle AI
            </span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-10 font-medium">
            បង្កើតកាតអាជីវកម្មឆ្លាតវៃជាមួយ Bakong KHQR និងបម្លែងសំឡេងវីដេអូជាអក្សររត់ខ្មែរស្វ័យប្រវត្តិតាមរយៈ AI នៅលើ moneaa.site
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto mb-6">
            <Link to={user ? "/bio" : "/register"} className="w-full sm:w-auto flex-1">
              <button className="w-full h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs md:text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 active:scale-95">
                <Smartphone size={16} />
                <span>បង្កើតកាត Bio Card</span>
                <ArrowRight size={15} />
              </button>
            </Link>

            <Link to={user ? "/subtitles" : "/register"} className="w-full sm:w-auto flex-1">
              <button className="w-full h-12 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 active:scale-95">
                <Languages size={16} className="text-indigo-400" />
                <span>ស្ទូឌីយោ Subtitle AI</span>
              </button>
            </Link>
          </div>

          {!user && (
            <p className="text-xs text-slate-500 font-medium">
              ចូលគណនីរហ័សជាមួយ{" "}
              <Link to="/login" className="text-blue-400 hover:underline font-bold">
                Google
              </Link>
            </p>
          )}
        </div>

        {/* 📦 2 Clean Core Product Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 md:mt-24">
          {/* Card 1: Digital Business Card */}
          <div className="bg-[#10131b] border border-white/10 rounded-2xl p-7 flex flex-col justify-between hover:border-blue-500/40 transition-all">
            <div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5">
                <CreditCard size={22} />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">កាតអាជីវកម្មឌីជីថល (Bio Card)</h2>
              <p className="text-xs md:text-sm text-slate-400 mb-6 font-medium leading-relaxed">
                បង្កើតកាតផ្ទាល់ខ្លួនសម្រាប់អាជីវកម្ម ភ្ជាប់ជាមួយ Bakong KHQR, ម៉ឺនុយទំនិញ, និងបណ្តាញទំនាក់ទំនង។
              </p>

              <div className="space-y-2.5 text-xs text-slate-300 mb-8 font-medium">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>Bakong KHQR ទទួលប្រាក់ពីគ្រប់ធនាគារកម្ពុជា</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>តំណ Link ខ្លីផ្ទាល់ខ្លួន៖ moneaa.site/b/ឈ្មោះអ្នក</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>ទាញយក QR Code សម្រាប់ព្រីនលើកាត ឬបិទលើតុ</span>
                </div>
              </div>
            </div>

            <Link
              to={user ? "/bio" : "/register"}
              className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>ចាប់ផ្តើមបង្កើតកាត</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Card 2: Khmer AI Subtitle Studio */}
          <div className="bg-[#10131b] border border-white/10 rounded-2xl p-7 flex flex-col justify-between hover:border-indigo-500/40 transition-all">
            <div>
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
                <Film size={22} />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">ស្ទូឌីយោ Subtitle AI ខ្មែរ</h2>
              <p className="text-xs md:text-sm text-slate-400 mb-6 font-medium leading-relaxed">
                បម្លែងសំឡេងនិយាយក្នុងវីដេអូជាអក្សររត់ខ្មែរស្វ័យប្រវត្តិតាមរយៈ AI ត្រឹមត្រូវតាមវេយ្យាករណ៍ 100%។
              </p>

              <div className="space-y-2.5 text-xs text-slate-300 mb-8 font-medium">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>ស្តាប់សំឡេងខ្មែរ និងបម្លែងជាអក្សររត់ក្នុងពេលប៉ុន្មានវិនាទី</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>កែសម្រួលអត្ថបទ និងតម្រឹមម៉ោងរត់បានយ៉ាងងាយស្រួល</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>នាំចេញជា CapCut Draft និងឯកសារ SRT បានភ្លាមៗ</span>
                </div>
              </div>
            </div>

            <Link
              to={user ? "/subtitles" : "/register"}
              className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <span>សាកល្បង Subtitle AI</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      {/* 🦶 Clean Footer */}
      <footer className="border-t border-white/5 py-8 bg-[#06070a]">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Moneaa</span>
            <span>•</span>
            <span>moneaa.site</span>
          </div>
          <p>© 2026 Moneaa. រក្សាសិទ្ធិគ្រប់យ៉ាង។</p>
        </div>
      </footer>
    </div>
  );
}
