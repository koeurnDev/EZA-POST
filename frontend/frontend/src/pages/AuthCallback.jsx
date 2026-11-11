// ============================================================
// 🌐 AuthCallback.jsx — Google & SSO OAuth Callback Handler
// Modeled after MONEA Production Architecture
// ============================================================

import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../utils/api";
import { saveUserData } from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import { Loader2, Sparkles } from "lucide-react";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get("token");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const provider = searchParams.get("provider") || "Google";

    // Clean address bar URL
    window.history.replaceState(null, "", window.location.pathname);

    if (error) {
      console.error("[SSO Callback Error]:", error);
      const errorMsg =
        error === "google_auth_failed"
          ? "ការផ្ទៀងផ្ទាត់ជាមួយ Google មិនបានសម្រេច។"
          : error === "google_missing_email"
          ? "គណនី Google របស់អ្នកមិនបានផ្ដល់អ៊ីមែលទេ។"
          : `កំហុសចូលគណនី៖ ${error}`;
      toast.error(errorMsg, { id: "sso-callback" });
      navigate("/login?error=" + encodeURIComponent(error), { replace: true });
      return;
    }

    if (token) {
      const toastId = toast.loading(`កំពុងផ្ទៀងផ្ទាត់គណនី ${provider}...`, { id: "sso-callback" });

      // Save token locally first
      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax; secure`;

      // Fetch user profile from unified worker
      authAPI
        .getStatus()
        .then((res) => {
          const userData = res?.user || res?.data?.user;
          if (userData) {
            saveUserData(userData, token);
            setAuthUser(userData);
            toast.success(`ចូលគណនីជាមួយ ${provider} បានជោគជ័យ! 🎉`, { id: toastId });
            navigate("/post", { replace: true });
          } else {
            // Fallback user object
            const fallbackUser = { email: "", name: `${provider} User`, plan: "free", role: "user" };
            saveUserData(fallbackUser, token);
            setAuthUser(fallbackUser);
            toast.success(`ចូលគណនីបានជោគជ័យ!`, { id: toastId });
            navigate("/post", { replace: true });
          }
        })
        .catch((err) => {
          console.warn("[SSO Status Check Failed, using token]:", err);
          const fallbackUser = { email: "", name: `${provider} User`, plan: "free", role: "user" };
          saveUserData(fallbackUser, token);
          setAuthUser(fallbackUser);
          toast.success(`ចូលគណនីបានជោគជ័យ!`, { id: toastId });
          navigate("/post", { replace: true });
        });
      return;
    }

    // No token or error in URL
    navigate("/login", { replace: true });
  }, [searchParams, navigate, setAuthUser]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-['Kantumruy_Pro'] relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute w-[400px] h-[400px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm">
        {/* Animated Brand Loader */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
          <div className="relative w-16 h-16 bg-white/[0.06] border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-2xl">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-widest">
            <Sparkles size={14} />
            <span>OAuth SSO Verification</span>
          </div>
          <h2 className="text-xl font-bold text-white">កំពុងភ្ជាប់គណនីរបស់អ្នក...</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            សូមរង់ចាំមួយភ្លែត ប្រព័ន្ធកំពុងផ្ទៀងផ្ទាត់ និងដំណើរការទិន្នន័យសុវត្ថិភាព។
          </p>
        </div>
      </div>
    </div>
  );
}

