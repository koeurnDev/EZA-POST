import React, { useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { getUserData } from "../utils/apiUtils";
import RegisterForm from "../components/RegisterForm";
import { Sparkles, ShieldCheck, Zap, Globe, Rocket } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getUserData();
    if (user) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleRegisterSuccess = () => {
    setTimeout(() => navigate("/login", { replace: true }), 1500);
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
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-3 text-2xl font-black tracking-tighter cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={20} fill="white" />
          </div>
          EZA-POST
        </motion.div>

        {/* Value Proposition */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-6xl font-black leading-[1.1] mb-8 tracking-tight text-white">
              Scale your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                Social Growth.
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-md leading-relaxed font-medium">
              Join the elite circle of creators using advanced automation to dominate the social landscape.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-8 mt-12"
          >
            {[
              { icon: ShieldCheck, label: "Encrypted" },
              { icon: Zap, label: "Powerful" },
              { icon: Globe, label: "Scalable" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <item.icon size={14} className="text-blue-400" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-gray-500">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Testimonial/Trust */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl max-w-sm"
        >
          <p className="text-sm italic text-gray-300 mb-4">
            "EZA-POST changed the way I handle my multi-channel strategy. It's not just a tool, it's an unfair advantage."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">JD</div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Alex Rivera</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Digital Strategist</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 📝 Right Side: Registration Hub */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 md:p-24 relative overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          {/* Mobile Brand */}
          <div className="lg:hidden flex justify-center mb-12">
            <div className="flex items-center gap-3 text-2xl font-black tracking-tighter dark:text-white">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap size={20} fill="white" />
              </div>
              EZA-POST
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center lg:text-left"
          >
            <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
              Start for free
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Create your account and unlock the full potential of EZA-POST.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <RegisterForm onSuccess={handleRegisterSuccess} />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-900 text-center lg:text-left"
          >
            <p className="text-sm font-bold text-gray-500">
              Already a member?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-blue-600 hover:text-blue-700 transition-colors ml-1"
              >
                Sign in to your account
              </button>
            </p>
          </motion.div>
        </div>

        {/* Ambient background for mobile */}
        <div className="lg:hidden absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      </div>
    </div>
  );
}
