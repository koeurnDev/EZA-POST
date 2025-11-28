import React, { useState, useId } from "react";
import { authAPI } from "../utils/api";
import Button from "./ui/Button";
import toast from "react-hot-toast";

const LoginForm = ({ onSuccess, onForgotPassword }) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const emailId = useId();
  const passwordId = useId();

  // ✅ Handle Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ✅ Validate Input
  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email format";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Submit Handler (using backend API)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    const toastId = toast.loading("Signing in...");

    try {
      const res = await authAPI.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      toast.success("Welcome back!", { id: toastId });
      onSuccess?.(res.user); // ✅ Trigger success handler
    } catch (error) {
      console.error("❌ Login error:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Invalid credentials. Please try again.";

      toast.error(errorMessage, { id: toastId });

      setErrors({
        submit: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Toggle Password Visibility
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // ============================================================
  // 🧱 UI Render
  // ============================================================
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Email Input */}
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium text-slate-700 mb-1">
          Email Address
        </label>
        <input
          id={emailId}
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={loading}
          className={`w-full px-4 py-3 bg-white border rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all focus:ring-2 focus:ring-blue-500/20 ${errors.email ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
            } ${loading ? "bg-slate-100 cursor-not-allowed" : ""}`}
        />
        {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
      </div>

      {/* Password Input */}
      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-slate-700 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading}
            className={`w-full px-4 py-3 bg-white border rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all focus:ring-2 focus:ring-blue-500/20 pr-12 ${errors.password ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
              } ${loading ? "bg-slate-100 cursor-not-allowed" : ""}`}
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
        {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password}</p>}
      </div>

      {/* Forgot Password Link */}
      {onForgotPassword && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={loading}
            className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline transition-colors"
          >
            Forgot password?
          </button>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        size="large"
        fullWidth
        isLoading={loading}
      >
        Sign In
      </Button>

      {/* Error Alert (Global) */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 text-center animate-pulse">
          ⚠️ {errors.submit}
        </div>
      )}

    </form>
  );
};

export default LoginForm;
