import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getUserData } from "../utils/apiUtils";
import RegisterForm from "../components/RegisterForm";
import { Sparkles, ShieldCheck, Zap, Globe, Rocket, CheckCircle2, Star } from "lucide-react";

export default function Register() {
  const MotionDiv = motion.div;
  const navigate = useNavigate();

  useEffect(() => {
    const user = getUserData();
    if (user) navigate("/post", { replace: true });
  }, [navigate]);

  const handleRegisterSuccess = () => {
    setTimeout(() => navigate("/login", { replace: true }), 1500);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white overflow-hidden font-['Kantumruy_Pro']">
      
      {/* 🎨 Left Side: Immersive Brand Story */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-20 overflow-hidden border-r border-white/5">
        {/* Immersive Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[150px] animate-pulse delay-1000" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        </div>

        {/* Brand Identity */}
        <MotionDiv 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 flex items-center gap-3 group cursor-pointer w-fit"
          onClick={() => navigate("/")}
        >
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/20 group-hover:rotate-6 transition-transform">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold tracking-tight leading-none">EZA_POST</span>
            <span className="text-[10px] uppercase tracking-widest text-blue-500 font-black opacity-80">Social Orchestrator</span>
          </div>
        </MotionDiv>

        {/* Big Text Heading */}
        <div className="relative z-10">
          <MotionDiv initial="hidden" animate="visible" variants={fadeInUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8">
              <Sparkles size={14} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 italic">Elevate Your Strategy</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter mb-10 whitespace-nowrap">
              សាងផេកឱ្យកាន់តែខ្លាំង
            </h1>
            <p className="text-xl text-gray-400 max-w-lg leading-relaxed font-medium mb-12">
              ចូលរួមជាមួយអ្នកបង្កើតមាតិកាជាង ៥,០០០ នាក់ ដែលកំពុងប្រើប្រាស់ឧបករណ៍របស់យើងដើម្បីជោគជ័យ។
            </p>

            <div className="grid grid-cols-2 gap-8">
              {[
                { icon: ShieldCheck, label: "សុវត្ថិភាពខ្ពស់", color: "text-emerald-500" },
                { icon: Rocket, label: "ល្បឿនលឿន", color: "text-blue-500" },
                { icon: Star, label: "គុណភាពល្អបំផុត", color: "text-yellow-500" },
                { icon: Globe, label: "ប្រើបានសកល", color: "text-purple-500" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 group cursor-default">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                    <item.icon size={18} className={item.color} />
                  </div>
                  <span className="text-sm font-bold text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>
          </MotionDiv>
        </div>

        {/* Glassmorphism Testimonial */}
        <MotionDiv 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] max-w-md group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Rocket size={60} className="rotate-12" />
          </div>
          <p className="text-lg italic text-gray-300 mb-6 leading-relaxed">
            "កម្មវិធីនេះបានជួយឱ្យផេករបស់ខ្ញុំរីកចម្រើនយ៉ាងឆាប់រហ័ស។ វាជាឧបករណ៍ដ៏ល្អបំផុតដែលខ្ញុំធ្លាប់ប្រើ!"
          </p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xl shadow-lg">E</div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">អុីហ្សា ផុស</p>
              <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em]">អ្នកគ្រប់គ្រងមាតិកា</p>
            </div>
          </div>
        </MotionDiv>
      </div>

      {/* 📝 Right Side: Registration Portal */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 md:p-20 relative overflow-y-auto bg-[#08080c]">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-50" />
        
        <div className="w-full max-w-md my-auto relative">
          {/* Mobile Identity */}
          <div className="lg:hidden flex justify-center mb-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30">
                <Zap size={28} fill="white" className="text-white" />
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold tracking-tight block">EZA_POST</span>
                <span className="text-[10px] uppercase tracking-widest text-blue-500 font-black opacity-80">Social Manager</span>
              </div>
            </div>
          </div>

          <MotionDiv 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center lg:text-left"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              បង្កើតគណនីដោយឥតគិតថ្លៃ
            </h2>
            <p className="text-gray-400 font-medium">
              ចាប់ផ្តើមបង្កើនប្រសិទ្ធភាពការងាររបស់អ្នកជាមួយយើងថ្ងៃនេះ។
            </p>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-blue-600/5 blur-3xl -z-10 rounded-full" />
            <RegisterForm onSuccess={handleRegisterSuccess} />
          </MotionDiv>

          <MotionDiv 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-12 pt-10 border-t border-white/5 text-center lg:text-left"
          >
            <p className="text-sm font-bold text-gray-500">
              មានគណនីរួចហើយមែនទេ?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-blue-500 hover:text-blue-400 transition-colors ml-1 underline underline-offset-4"
              >
                ចូលគណនីនៅទីនេះ
              </button>
            </p>
          </MotionDiv>
        </div>
      </div>
    </div>
  );
}
