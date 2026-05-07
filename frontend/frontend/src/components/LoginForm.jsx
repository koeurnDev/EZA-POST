import React, { useState, useId } from "react";
import { authAPI } from "../utils/api";
import Button from "./ui/Button";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import { Mail, Lock, Eye, EyeOff, Shield, ArrowRight, AlertCircle } from "lucide-react";

const LoginForm = ({ onSuccess, onForgotPassword }) => {
  const MotionDiv = motion.div;
  const MotionAnimatePresence = AnimatePresence;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const emailId = useId();
  const passwordId = useId();

  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = "សូមបញ្ចូលអ៊ីមែល";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ";
    if (!formData.password) newErrors.password = "សូមបញ្ចូលលេខសម្ងាត់";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (show2FA) {
      if (!twoFactorCode) return setErrors({ submit: "សូមបញ្ចូលលេខកូដ 2FA" });
      setLoading(true);
      try {
        const res = await authAPI.verify2FALogin(tempToken, twoFactorCode);
        toast.success("ចូលគណនីបានជោគជ័យ!");
        onSuccess?.(res.user);
      } catch (error) {
        setErrors({ submit: "លេខកូដមិនត្រឹមត្រូវ" });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    const toastId = toast.loading("កំពុងត្រួតពិនិត្យ...");

    try {
      const res = await authAPI.login({ email: formData.email, password: formData.password });
      if (res.requires2FA) {
        setTempToken(res.tempToken);
        setShow2FA(true);
        toast.dismiss(toastId);
        return;
      }
      toast.success("ចូលគណនីបានជោគជ័យ!", { id: toastId });
      onSuccess?.(res.user);
    } catch (error) {
      const msg = error?.response?.data?.error || "មានបញ្ហា។ សូមព្យាយាមម្តងទៀត។";
      toast.error(msg, { id: toastId });
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <MotionAnimatePresence mode="wait">
          {show2FA ? (
            <MotionDiv 
              key="2fa"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                  <Shield size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">ផ្ទៀងផ្ទាត់លេខកូដ</h3>
                <p className="text-sm text-gray-400 mt-2">សូមបញ្ចូលលេខកូដពីទូរស័ព្ទរបស់អ្នក។</p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-3xl outline-none text-center text-3xl font-bold tracking-[0.5em] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-white placeholder-gray-700"
                  autoFocus
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="h-16 rounded-2xl w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? "កំពុងដំណើរការ..." : <>ចូលគណនី <ArrowRight size={20} /></>}
              </button>

              <button type="button" onClick={() => setShow2FA(false)} className="w-full text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
                ត្រឡប់ក្រោយ
              </button>
            </MotionDiv>
          ) : (
            <MotionDiv 
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor={emailId} className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">អ៊ីមែល</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    id={emailId}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className={`w-full pl-14 pr-6 py-4 bg-white/5 border rounded-2xl outline-none text-white placeholder-gray-700 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.email ? "border-red-500/50" : "border-white/10 focus:border-blue-500"}`}
                    disabled={loading}
                  />
                </div>
                {errors.email && <p className="text-red-500 text-[10px] font-bold px-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label htmlFor={passwordId} className="text-xs font-bold text-gray-500 uppercase tracking-widest">លេខសម្ងាត់</label>
                  {onForgotPassword && (
                    <button type="button" onClick={onForgotPassword} className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest">ភ្លេចលេខសម្ងាត់?</button>
                  )}
                </div>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full pl-14 pr-14 py-4 bg-white/5 border rounded-2xl outline-none text-white placeholder-gray-700 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.password ? "border-red-500/50" : "border-white/10 focus:border-blue-500"}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-[10px] font-bold px-1">{errors.password}</p>}
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="h-16 rounded-2xl w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
              >
                {loading ? "កំពុងដំណើរការ..." : <>ចូលគណនី <ArrowRight size={20} /></>}
              </button>
            </MotionDiv>
          )}
        </MotionAnimatePresence>

        {errors.submit && (
          <MotionDiv 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-bold uppercase tracking-wider"
          >
            <AlertCircle size={16} />
            {errors.submit}
          </MotionDiv>
        )}
      </form>
    </div>
  );
};

export default LoginForm;
