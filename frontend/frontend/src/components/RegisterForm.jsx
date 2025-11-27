// ============================================================
// 🌐 RegisterForm.jsx — Final Enhanced Version (EZA_POST Frontend)
// ============================================================

import React, { useState } from "react";
import { authAPI } from "../utils/api";

export default function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ✅ Validate fields
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required.";
    if (!formData.email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email format.";
    if (!formData.password) newErrors.password = "Password is required.";
    else if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters.";
    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Please confirm your password.";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});

    try {
      const result = await authAPI.register(formData);
      onSuccess?.(result.user);
    } catch (error) {
      console.error("Registration error:", error);
      setErrors({
        submit:
          error.response?.data?.message ||
          error.message ||
          "Registration failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 🚨 Error message */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-6 text-center">
          ⚠️ {errors.submit}
        </div>
      )}

      {/* 📝 Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            name="name"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange}
            disabled={loading}
            className={`w-full px-4 py-3 bg-white border rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all focus:ring-2 focus:ring-blue-500/20 ${errors.name ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
              }`}
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
            className={`w-full px-4 py-3 bg-white border rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all focus:ring-2 focus:ring-blue-500/20 ${errors.email ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
              }`}
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              className={`w-full px-4 py-3 bg-white border rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all focus:ring-2 focus:ring-blue-500/20 pr-12 ${errors.password ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={loading}
            className={`w-full px-4 py-3 bg-white border rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all focus:ring-2 focus:ring-blue-500/20 ${errors.confirmPassword
              ? "border-red-500 focus:border-red-500"
              : "border-slate-200 focus:border-blue-500"
              }`}
          />
          {errors.confirmPassword && (
            <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3.5 font-bold text-white rounded-lg shadow-sm transition-all duration-200 transform active:scale-[0.98] ${loading
            ? "bg-slate-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 hover:shadow-md"
            }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>
      </form>
    </>
  );
}
