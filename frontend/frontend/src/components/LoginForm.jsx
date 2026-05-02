import React, { useState, useId } from "react";
import { authAPI } from "../utils/api";
import Button from "./ui/Button";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Shield, ArrowRight, AlertCircle } from "lucide-react";

const LoginForm = ({ onSuccess, onForgotPassword }) => {
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
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (show2FA) {
      if (!twoFactorCode) return setErrors({ submit: "Please enter the 2FA code" });
      setLoading(true);
      try {
        const res = await authAPI.verify2FALogin(tempToken, twoFactorCode);
        toast.success("Identity verified!");
        onSuccess?.(res.user);
      } catch (error) {
        setErrors({ submit: "Invalid verification code" });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    const toastId = toast.loading("Authenticating...");

    try {
      const res = await authAPI.login({ email: formData.email, password: formData.password });
      if (res.requires2FA) {
        setTempToken(res.tempToken);
        setShow2FA(true);
        toast.dismiss(toastId);
        return;
      }
      toast.success("Authentication successful!", { id: toastId });
      onSuccess?.(res.user);
    } catch (error) {
      const msg = error?.response?.data?.error || "Login failed. Please try again.";
      toast.error(msg, { id: toastId });
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <AnimatePresence mode="wait">
          {show2FA ? (
            <motion.div 
              key="2fa"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800">
                  <Shield size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Security Check</h3>
                <p className="text-sm text-gray-500 mt-2">Enter the verification code from your device.</p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-3xl outline-none text-center text-3xl font-black tracking-[0.5em] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              <Button type="submit" className="h-14 rounded-2xl w-full shadow-xl" isLoading={loading}>
                Verify Identity <ArrowRight size={18} className="ml-2" />
              </Button>

              <button type="button" onClick={() => setShow2FA(false)} className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors">
                Back to credentials
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor={emailId} className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    id={emailId}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@company.com"
                    className={`w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.email ? "border-red-500" : "border-gray-100 dark:border-gray-800 focus:border-blue-500"}`}
                    disabled={loading}
                  />
                </div>
                {errors.email && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label htmlFor={passwordId} className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Password</label>
                  {onForgotPassword && (
                    <button type="button" onClick={onForgotPassword} className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest">Forgot?</button>
                  )}
                </div>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full pl-14 pr-14 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.password ? "border-red-500" : "border-gray-100 dark:border-gray-800 focus:border-blue-500"}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{errors.password}</p>}
              </div>

              <Button type="submit" className="h-14 rounded-2xl w-full shadow-xl mt-4" isLoading={loading}>
                Access Account <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {errors.submit && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold"
          >
            <AlertCircle size={16} />
            {errors.submit}
          </motion.div>
        )}
      </form>
    </div>
  );
};

export default LoginForm;



export default LoginForm;
