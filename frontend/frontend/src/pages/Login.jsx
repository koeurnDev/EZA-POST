import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoginForm from "../components/LoginForm";
import { saveUserData } from "../utils/apiUtils";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Zap, Globe } from "lucide-react";

const MotionDiv = motion.div;

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading, setAuthUser } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/tools/tiktok", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLoginSuccess = (user) => {
    saveUserData(user);
    setAuthUser(user);
    setTimeout(() => navigate("/tools/tiktok", { replace: true }), 1000);
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950 transition-colors duration-500 overflow-hidden">
      {/* 🎨 Left Side: Immersive Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900 dark:bg-black overflow-hidden flex-col justify-between p-16 text-white">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700" />
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        </div>

        {/* Brand Header */}
        <MotionDiv 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-3 text-2xl font-black tracking-tighter"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={20} fill="white" />
          </div>
          EZA-POST
        </MotionDiv>

        {/* Value Proposition */}
        <div className="relative z-10">
          <MotionDiv
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-6xl font-black leading-[1.1] mb-8 tracking-tight">
              Master your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient">
                Social Pulse.
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-md leading-relaxed font-medium">
              The next generation of social automation. Built for creators who demand excellence.
            </p>
          </MotionDiv>

          <MotionDiv 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-8 mt-12"
          >
            {[
              { icon: ShieldCheck, label: "Secure" },
              { icon: Zap, label: "Fast" },
              { icon: Globe, label: "Global" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <item.icon size={14} className="text-blue-400" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-gray-500">{item.label}</span>
              </div>
            ))}
          </MotionDiv>
        </div>

        {/* Footer Info */}
        <MotionDiv 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 flex items-center gap-4"
        >
          <div className="flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center overflow-hidden">
                <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
              </div>
            ))}
          </div>
          <p className="text-sm font-bold text-gray-500">Trusted by 10k+ elite creators</p>
        </MotionDiv>
      </div>

      {/* 📝 Right Side: Authentication Hub */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 md:p-24 relative">
        <div className="w-full max-w-md">
          {/* Mobile Brand */}
          <div className="lg:hidden flex justify-center mb-12">
            <div className="flex items-center gap-3 text-2xl font-black tracking-tighter dark:text-white">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap size={20} fill="white" />
              </div>
              EZA-POST
            </div>
          </div>

          <MotionDiv 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center lg:text-left"
          >
            <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
              Welcome back
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Enter your credentials to access your command center.
            </p>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <LoginForm
              onSuccess={handleLoginSuccess}
              onForgotPassword={() => navigate("/forgot-password")}
            />
          </MotionDiv>

          <MotionDiv 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-900 text-center lg:text-left"
          >
            <p className="text-sm font-bold text-gray-500">
              New to the platform?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-blue-600 hover:text-blue-700 transition-colors ml-1"
              >
                Create an account
              </button>
            </p>
          </MotionDiv>
        </div>

        {/* Ambient background for mobile */}
        <div className="lg:hidden absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      </div>
    </div>
  );
}
