import React, { useState } from "react";
import toast from "react-hot-toast";
import { authAPI } from "../utils/api";
import Button from "./ui/Button";
import { User, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";

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
    if (!formData.name.trim()) newErrors.name = "សូមបញ្ចូលឈ្មោះរបស់អ្នក";
    if (!formData.email.trim()) newErrors.email = "សូមបញ្ចូលអ៊ីមែល";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ";
    if (!formData.password) newErrors.password = "សូមបញ្ចូលលេខសម្ងាត់";
    else if (formData.password.length < 6) newErrors.password = "លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ ខ្ទង់";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "លេខសម្ងាត់មិនផ្ទៀងផ្ទាត់គ្នា";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    const toastId = toast.loading("កំពុងរក្សាទុក...");

    try {
      const result = await authAPI.register(formData);
      toast.success("បង្កើតគណនីបានជោគជ័យ!", { id: toastId });
      onSuccess?.(result.user);
    } catch (error) {
      const msg = error.response?.data?.message || "ការចុះឈ្មោះមិនបានសម្រេច។";
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
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">ឈ្មោះរបស់អ្នក</label>
        <div className="relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
            <User size={18} />
          </div>
          <input
            type="text"
            name="name"
            placeholder="ឈ្មោះពេញរបស់អ្នក"
            value={formData.name}
            onChange={handleChange}
            className={`w-full pl-14 pr-6 py-4 bg-white/5 border rounded-2xl outline-none text-white placeholder-gray-600 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.name ? "border-red-500/50" : "border-white/10 focus:border-blue-500"}`}
            disabled={loading}
          />
        </div>
        {errors.name && <p className="text-red-500 text-[10px] font-bold px-1">{errors.name}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">អ៊ីមែល</label>
        <div className="relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
            <Mail size={18} />
          </div>
          <input
            type="email"
            name="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={handleChange}
            className={`w-full pl-14 pr-6 py-4 bg-white/5 border rounded-2xl outline-none text-white placeholder-gray-600 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.email ? "border-red-500/50" : "border-white/10 focus:border-blue-500"}`}
            disabled={loading}
          />
        </div>
        {errors.email && <p className="text-red-500 text-[10px] font-bold px-1">{errors.email}</p>}
      </div>

      {/* Password Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">លេខសម្ងាត់</label>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className={`w-full pl-14 pr-12 py-4 bg-white/5 border rounded-2xl outline-none text-white placeholder-gray-600 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.password ? "border-red-500/50" : "border-white/10 focus:border-blue-500"}`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-[10px] font-bold px-1">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">ផ្ទៀងផ្ទាត់</label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`w-full px-6 py-4 bg-white/5 border rounded-2xl outline-none text-white placeholder-gray-600 transition-all focus:ring-4 focus:ring-blue-500/10 ${errors.confirmPassword ? "border-red-500/50" : "border-white/10 focus:border-blue-500"}`}
            disabled={loading}
          />
          {errors.confirmPassword && <p className="text-red-500 text-[10px] font-bold px-1">{errors.confirmPassword}</p>}
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="h-16 rounded-2xl w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "កំពុងដំណើរការ..." : <>ចុះឈ្មោះឥឡូវនេះ <CheckCircle2 size={20} /></>}
      </button>

      {errors.submit && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-bold text-center uppercase tracking-wider">
          {errors.submit}
        </div>
      )}
    </form>
  );
};

export default RegisterForm;
