import React, { useState } from "react";
import toast from "react-hot-toast";
import { authAPI } from "../utils/api";
import Button from "./ui/Button";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";

const RegisterForm = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid format";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6) newErrors.password = "Minimum 6 characters";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords mismatch";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    const toastId = toast.loading("Creating account...");

    try {
      const result = await authAPI.register(formData);
      toast.success("Account created successfully!", { id: toastId });
      onSuccess?.(result.user);
    } catch (error) {
      const msg = error.response?.data?.message || "Registration failed.";
      toast.error(msg, { id: toastId });
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Full Name */}
      <div className="space-y-2">
        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
        <div className="relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
            <User size={20} />
          </div>
          <input
            type="text"
            name="name"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange}
            className={`w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.name ? "border-red-500" : "border-gray-100 dark:border-gray-800 focus:border-blue-500"}`}
            disabled={loading}
          />
        </div>
        {errors.name && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{errors.name}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
        <div className="relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
            <Mail size={20} />
          </div>
          <input
            type="email"
            name="email"
            placeholder="name@company.com"
            value={formData.email}
            onChange={handleChange}
            className={`w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.email ? "border-red-500" : "border-gray-100 dark:border-gray-800 focus:border-blue-500"}`}
            disabled={loading}
          />
        </div>
        {errors.email && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{errors.email}</p>}
      </div>

      {/* Password Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Password</label>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
              <Lock size={20} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className={`w-full pl-14 pr-12 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.password ? "border-red-500" : "border-gray-100 dark:border-gray-800 focus:border-blue-500"}`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Confirm</label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.confirmPassword ? "border-red-500" : "border-gray-100 dark:border-gray-800 focus:border-blue-500"}`}
            disabled={loading}
          />
          {errors.confirmPassword && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button type="submit" className="h-14 rounded-2xl w-full shadow-xl" isLoading={loading}>
        Create Account <CheckCircle2 size={18} className="ml-2" />
      </Button>

      {errors.submit && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold text-center">
          {errors.submit}
        </div>
      )}
    </form>
  );
};

export default RegisterForm;
