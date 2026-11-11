import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { authAPI } from "../utils/api";
import { saveUserData } from "../utils/apiUtils";

export default function SocialAuthButtons({ mode = "signup", onSuccess }) {
  const [loadingProvider, setLoadingProvider] = useState(null);
  const isSignup = mode === "signup";

  // 1. Initialize Telegram Widget Script
  useEffect(() => {
    if (!document.getElementById("telegram-widget-script")) {
      const script = document.createElement("script");
      script.id = "telegram-widget-script";
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 🔵 Handle Facebook Login
  const handleFacebook = () => {
    setLoadingProvider("facebook");
    toast.loading("កំពុងភ្ជាប់ទៅកាន់ Facebook...", { id: "social-auth" });
    authAPI.facebookLogin();
  };

  // 🔴 Handle Google Login
  const handleGoogle = () => {
    setLoadingProvider("google");
    toast.loading("កំពុងភ្ជាប់ទៅកាន់ Google...", { id: "social-auth" });
    // Triggers Google OAuth
    authAPI.googleLogin();
  };

  // 🔷 Handle Telegram Login
  const handleTelegram = () => {
    setLoadingProvider("telegram");
    const toastId = "social-auth";

    if (window.Telegram?.Login) {
      window.Telegram.Login.auth(
        { bot_id: "8289587681", request_access: true },
        async (data) => {
          if (!data) {
            toast.error("ការផ្ទៀងផ្ទាត់ Telegram ត្រូវបានបដិសេធ។", { id: toastId });
            setLoadingProvider(null);
            return;
          }
          toast.loading("កំពុងផ្ទៀងផ្ទាត់គណនី Telegram...", { id: toastId });
          try {
            const res = await authAPI.telegramLogin(data);
            if (res.token && res.user) {
              saveUserData(res.user, res.token);
              toast.success("ចូលគណនីជាមួយ Telegram ជោគជ័យ!", { id: toastId });
              onSuccess?.(res.user);
            }
          } catch (err) {
            toast.error(err?.response?.data?.error || "ការចូលដោយ Telegram មិនបានសម្រេច។", { id: toastId });
          } finally {
            setLoadingProvider(null);
          }
        }
      );
    } else {
      // Fallback: direct user to the bot or open web widget
      window.open("https://t.me/eza_ocr_bot", "_blank");
      toast.dismiss(toastId);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3 Social Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 🔴 Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={Boolean(loadingProvider)}
          className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 hover:border-red-500/40 rounded-2xl text-xs font-semibold text-gray-200 hover:text-white transition-all shadow-sm group disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.3 7.5 23.5 12 23.5z"
            />
          </svg>
          <span className="truncate">Google</span>
        </button>

        {/* 🔵 Facebook */}
        <button
          type="button"
          onClick={handleFacebook}
          disabled={Boolean(loadingProvider)}
          className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 hover:border-blue-500/40 rounded-2xl text-xs font-semibold text-gray-200 hover:text-white transition-all shadow-sm group disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4 flex-shrink-0 fill-[#1877F2] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="truncate">Facebook</span>
        </button>

        {/* 🔷 Telegram */}
        <button
          type="button"
          onClick={handleTelegram}
          disabled={Boolean(loadingProvider)}
          className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 hover:border-sky-500/40 rounded-2xl text-xs font-semibold text-gray-200 hover:text-white transition-all shadow-sm group disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4 flex-shrink-0 fill-[#229ED9] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.536-.196 1.006.128.832.941z" />
          </svg>
          <span className="truncate">Telegram</span>
        </button>
      </div>

      {/* Modern Divider */}
      <div className="relative flex items-center justify-center my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative px-4 bg-[#0a0a0c] text-[11px] font-bold uppercase tracking-wider text-gray-500">
          ឬ {isSignup ? "ចុះឈ្មោះតាមរយៈអ៊ីមែល" : "ចូលដោយប្រើអ៊ីមែល"}
        </div>
      </div>
    </div>
  );
}

