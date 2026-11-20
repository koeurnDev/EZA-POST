import React, { useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoginForm from "../components/LoginForm";
import { saveUserData } from "../utils/apiUtils";
import { authAPI } from "../utils/api";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, setAuthUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    if (error) {
      toast.error(error === "google_auth_failed" ? "ការចូលដោយ Google មិនបានសម្រេច។" : `កំហុស៖ ${error}`);
      return;
    }
    if (token) {
      toast.loading("កំពុងផ្ទៀងផ្ទាត់គណនី...", { id: "sso-login" });
      authAPI.getStatus()
        .then((res) => {
          const userData = res?.user || res?.data?.user || { email: "", name: "User" };
          saveUserData(userData, token);
          setAuthUser(userData);
          toast.success("ចូលគណនីបានជោគជ័យ!", { id: "sso-login" });
          navigate("/bio", { replace: true });
        })
        .catch(() => {
          saveUserData({ email: "", name: "User" }, token);
          navigate("/bio", { replace: true });
        });
      return;
    }

    if (!authLoading && user) {
      navigate("/bio", { replace: true });
    }
  }, [user, authLoading, navigate, searchParams, setAuthUser]);

  const handleLoginSuccess = (user) => {
    saveUserData(user);
    setAuthUser(user);
    setTimeout(() => navigate("/bio", { replace: true }), 500);
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
          <h1 className="text-xl font-bold text-white mb-1">ចូលគណនី</h1>
          <p className="text-xs text-slate-400 font-medium">សូមស្វាគមន៍មកកាន់ moneaa.site</p>
        </div>

        {/* Card Box */}
        <div className="bg-[#10131b] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
          <LoginForm
            onSuccess={handleLoginSuccess}
            onForgotPassword={() => navigate("/forgot-password")}
          />

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-xs text-slate-400 font-medium">
              មិនទាន់មានគណនីមែនទេ?{" "}
              <Link
                to="/register"
                className="text-blue-400 hover:text-blue-300 font-bold transition-colors ml-1"
              >
                ចុះឈ្មោះឥតគិតថ្លៃ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
