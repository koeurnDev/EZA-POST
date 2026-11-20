import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getUserData } from "../utils/apiUtils";
import RegisterForm from "../components/RegisterForm";
import { ArrowLeft } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getUserData();
    if (user) navigate("/bio", { replace: true });
  }, [navigate]);

  const handleRegisterSuccess = () => {
    setTimeout(() => navigate("/login", { replace: true }), 1000);
  };

  return (
    <div className="min-h-screen bg-[#08090c] text-slate-100 flex items-center justify-center p-4 font-['Kantumruy_Pro'] relative selection:bg-blue-600 selection:text-white">
      {/* 🔙 Back to Home */}
      <Link 
        to="/" 
        className="absolute top-5 left-5 md:top-8 md:left-8 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        <span>ត្រឡប់ទៅទំព័រដើម</span>
      </Link>

      <div className="w-full max-w-sm my-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-600/30">
              M
            </div>
            <span className="font-extrabold text-xl text-white tracking-tight">Moneaa</span>
          </Link>
          <h1 className="text-xl font-bold text-white mb-1">បង្កើតគណនី</h1>
          <p className="text-xs text-slate-400 font-medium">ចាប់ផ្តើមឥតគិតថ្លៃនៅលើ moneaa.site</p>
        </div>

        {/* Card Box */}
        <div className="bg-[#10131b] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
          <RegisterForm onSuccess={handleRegisterSuccess} />

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-xs text-slate-400 font-medium">
              មានគណនីរួចហើយមែនទេ?{" "}
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-bold transition-colors ml-1"
              >
                ចូលគណនីនៅទីនេះ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
