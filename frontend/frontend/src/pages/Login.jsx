import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoginForm from "../components/LoginForm";
import { saveUserData } from "../utils/apiUtils";
import { motion } from "framer-motion";
import { Zap, Sparkles, ShieldCheck, Lock, ArrowLeft } from "lucide-react";

export default function Login() {
  const MotionDiv = motion.div;
  const navigate = useNavigate();
  const { user, loading: authLoading, setAuthUser } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/post", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLoginSuccess = (user) => {
    saveUserData(user);
    setAuthUser(user);
    setTimeout(() => navigate("/post", { replace: true }), 1000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 overflow-hidden font-['Kantumruy_Pro'] relative">
      
      {/* 🌌 Immersive Immersive Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.05] mix-blend-overlay" />
      </div>

      {/* 🔙 Back to Home */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 md:top-10 md:left-10 z-50 flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="hidden sm:inline">ត្រឡប់ទៅដើម</span>
      </Link>

      <MotionDiv
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg mt-8 md:mt-12 mb-8"
      >
        {/* Floating Icon Decoration - Hidden on small mobile */}
        <div className="hidden sm:block absolute -top-12 -left-12 w-24 h-24 bg-blue-600/10 rounded-3xl blur-2xl animate-bounce duration-[3000ms]" />
        <div className="hidden sm:block absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />

        <div className="bg-white/5 backdrop-blur-[40px] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 shadow-2xl shadow-black/50 relative overflow-hidden">
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
          
          {/* Brand Identity */}
          <div className="flex flex-col items-center mb-8 md:mb-12">
            <MotionDiv 
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30 mb-4 md:mb-6"
            >
              <Zap className="text-white fill-white" size={24}  />
            </MotionDiv>
            <div className="text-center">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight mb-2">ចូលគណនី EZA_POST</h1>
              <div className="flex items-center justify-center gap-2">
                <Sparkles size={12} className="text-blue-500" />
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-blue-500 opacity-80">សូមស្វាគមន៍មកកាន់ប្រព័ន្ធ</span>
              </div>
            </div>
          </div>

          {/* Login Form */}
          <div className="relative">
            <LoginForm
              onSuccess={handleLoginSuccess}
              onForgotPassword={() => navigate("/forgot-password")}
            />
          </div>

          {/* Footer Actions */}
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-white/5 text-center">
            <p className="text-xs md:text-sm text-gray-500 font-medium">
              មិនទាន់មានគណនីមែនទេ?{" "}
              <Link
                to="/register"
                className="text-blue-500 hover:text-blue-400 transition-colors font-bold ml-1 underline underline-offset-4"
              >
                ចុះឈ្មោះឥតគិតថ្លៃ
              </Link>
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <MotionDiv 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 md:mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-4 text-gray-600"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={12}  />
            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-center">End-to-End Encryption</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-gray-800 rounded-full" />
          <div className="flex items-center gap-2">
            <Lock size={12}  />
            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-center">Secure Core v2.6</span>
          </div>
        </MotionDiv>
      </MotionDiv>

      {/* Decorative Background Text */}
      <div className="fixed bottom-[-2%] md:bottom-[-5%] left-[-2%] md:left-[-5%] text-[6rem] md:text-[15rem] font-bold text-white/5 pointer-events-none select-none tracking-tighter italic whitespace-nowrap">
        EZA_POST
      </div>
    </div>
  );
}
