// ============================================================
// 📱 BioBuilder.jsx - Digital Business Card & Storefront Manager
// Modeled after Noonlai.com + Superior Bakong KHQR & Live Preview
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { 
  QrCode, Sparkles, Store, Phone, Send, MessageCircle, 
  MapPin, Video, ShoppingBag, Plus, Trash2, ExternalLink, 
  Download, Eye, Check, Loader2, Save, Globe, Clock, 
  HelpCircle, Copy, RefreshCw, Palette, CreditCard
} from "lucide-react";
import toast from "react-hot-toast";
import QRCodeLib from "qrcode";
import api from "../utils/api";
import PublicBio from "./PublicBio";

const THEME_OPTIONS = [
  { id: "dark", name: "🌙 Dark Obsidian", desc: "ទំនើប និងលេចធ្លោ" },
  { id: "emerald", name: "💎 Emerald Luxury", desc: "ប្រណិត និងស្រស់បំព្រង" },
  { id: "sunset", name: "🌅 Sunset Glow", desc: "ទាក់ទាញ និងរស់រវើក" },
  { id: "coffee", name: "☕ Coffee Warm", desc: "កក់ក្តៅ ស័ក្តិសមសម្រាប់ហាងកាហ្វេ" },
  { id: "minimal", name: "⚪ Ultra Minimal", desc: "ស ស្អាត សាមញ្ញ" },
];

const DAYS_OF_WEEK = [
  { id: "mon", label: "ច័ន្ទ (Mon)" },
  { id: "tue", label: "អង្គារ (Tue)" },
  { id: "wed", label: "ពុធ (Wed)" },
  { id: "thu", label: "ព្រហ (Thu)" },
  { id: "fri", label: "សុក្រ (Fri)" },
  { id: "sat", label: "សៅរ៍ (Sat)" },
  { id: "sun", label: "អាទិត្យ (Sun)" },
];

export default function BioBuilder() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // profile, hours, contacts, khqr, products, qr
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: true, error: null });
  const [qrDownloadUrl, setQrDownloadUrl] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    slug: "",
    businessName: "",
    category: "ហាងកាហ្វេ & ភេសជ្ជៈ",
    bio: "",
    avatarUrl: "",
    coverUrl: "",
    theme: "dark",
    contacts: {
      phone: "",
      telegram: "",
      whatsapp: "",
      facebook: "",
      tiktok: "",
      website: "",
    },
    businessHours: {
      alwaysOpen: false,
      openTime: "07:00",
      closeTime: "21:00",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
    address: "",
    googleMapsUrl: "",
    youtubeUrl: "",
    khqrString: "",
    khqrImage: "",
    khqrBankName: "Bakong / ABA Bank",
    khqrAccountName: "",
    products: [],
    isActive: true,
  });

  // New Product Modal/Form State
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    currency: "$",
    description: "",
    imageUrl: "",
    isAvailable: true,
  });
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Fetch Existing Bio Page
  useEffect(() => {
    const fetchUserBio = async () => {
      try {
        const res = await api.get("/bio/me");
        if (res.data.success && res.data.bioPage) {
          const page = res.data.bioPage;
          setFormData({
            slug: page.slug || "",
            businessName: page.businessName || "",
            category: page.category || "ហាងកាហ្វេ & ភេសជ្ជៈ",
            bio: page.bio || "",
            avatarUrl: page.avatarUrl || "",
            coverUrl: page.coverUrl || "",
            theme: page.theme || "dark",
            contacts: page.contacts || {},
            businessHours: page.businessHours || {
              alwaysOpen: false,
              openTime: "07:00",
              closeTime: "21:00",
              days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            },
            address: page.address || "",
            googleMapsUrl: page.googleMapsUrl || "",
            youtubeUrl: page.youtubeUrl || "",
            khqrString: page.khqrString || "",
            khqrImage: page.khqrImage || "",
            khqrBankName: page.khqrBankName || "Bakong / ABA Bank",
            khqrAccountName: page.khqrAccountName || "",
            products: Array.isArray(page.products) ? page.products : [],
            isActive: page.isActive !== undefined ? page.isActive : true,
          });
        }
      } catch (err) {
        console.error("Failed to load bio page:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserBio();
  }, []);

  // Generate QR Code for downloading
  useEffect(() => {
    if (!formData.slug) return;
    const fullUrl = `${window.location.origin}/b/${formData.slug}`;
    QRCodeLib.toDataURL(fullUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDownloadUrl(url))
      .catch(() => {});
  }, [formData.slug]);

  // Handle Slug Change & Debounced Check
  const handleSlugChange = (val) => {
    const clean = val
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-");
    setFormData((prev) => ({ ...prev, slug: clean }));
  };

  // Check Slug Availability
  const checkSlugAvailability = async () => {
    if (!formData.slug || formData.slug.length < 3) {
      setSlugStatus({ checking: false, available: false, error: "តម្រូវឱ្យមានយ៉ាងតិច ៣ តួអក្សរ" });
      return;
    }

    setSlugStatus({ checking: true, available: true, error: null });
    try {
      const res = await api.get(`/bio/check-slug/${formData.slug}`);
      setSlugStatus({
        checking: false,
        available: res.data.available,
        error: res.data.available ? null : "ឈ្មោះនេះមានអ្នកប្រើប្រាស់រួចហើយ សូមជ្រើសរើសឈ្មោះផ្សេង",
      });
    } catch {
      setSlugStatus({ checking: false, available: true, error: null });
    }
  };

  // Add Product Item
  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      return toast.error("សូមបញ្ចូលឈ្មោះទំនិញ និងតម្លៃ");
    }

    const item = {
      id: crypto.randomUUID(),
      ...newProduct,
    };

    setFormData((prev) => ({
      ...prev,
      products: [...prev.products, item],
    }));

    setNewProduct({
      name: "",
      price: "",
      currency: "$",
      description: "",
      imageUrl: "",
      isAvailable: true,
    });
    setShowAddProduct(false);
    toast.success("បានបន្ថែមទំនិញជោគជ័យ!");
  };

  // Delete Product Item
  const handleDeleteProduct = (id) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
    toast.success("បានលុបទំនិញ");
  };

  // Toggle Day in Business Hours
  const toggleDay = (dayId) => {
    setFormData((prev) => {
      const currentDays = prev.businessHours?.days || [];
      const updated = currentDays.includes(dayId)
        ? currentDays.filter((d) => d !== dayId)
        : [...currentDays, dayId];
      return {
        ...prev,
        businessHours: {
          ...prev.businessHours,
          days: updated,
        },
      };
    });
  };

  // Save Bio Page
  const handleSave = async () => {
    if (!formData.slug || formData.slug.length < 3) {
      return toast.error("សូមបញ្ចូល Handle (Slug) យ៉ាងតិច ៣ តួអក្សរ");
    }
    if (!formData.businessName.trim()) {
      return toast.error("សូមបញ្ចូលឈ្មោះអាជីវកម្ម (Business Name)");
    }

    setSaving(true);
    try {
      const res = await api.post("/bio", formData);
      if (res.data.success) {
        toast.success("រក្សាទុកកាតអាជីវកម្មជោគជ័យ! 🎉");
      } else {
        toast.error(res.data.error || "មិនអាចរក្សាទុកបានទេ");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "មានបញ្ហាក្នុងការរក្សាទុក");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = formData.slug ? `${window.location.origin}/b/${formData.slug}` : "";

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* 🚀 Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-gray-900/50 backdrop-blur-2xl p-5 md:p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <Store size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                  កាតអាជីវកម្មឌីជីថល (Digital Business Card)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Noonlai Pro
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                បង្កើត Bio Link, ម៉ឺនុយមុខទំនិញ, Bakong KHQR, និងម៉ោងបើកអាជីវកម្មរបស់អ្នកក្នុងកាតតែមួយ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {formData.slug && (
              <a
                href={`/b/${formData.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Eye size={15} />
                <span>មើលទំព័រផ្ទាល់</span>
                <ExternalLink size={12} />
              </a>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs md:text-sm font-black shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? "កំពុងរក្សាទុក..." : "រក្សាទុក (Save)"}</span>
            </button>
          </div>
        </div>

        {/* 🖥️ Main Workspace (2-Column: Left Editor, Right Live Preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 📝 Left Editor Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 overflow-x-auto">
              {[
                { id: "profile", label: "ព័ត៌មានទូទៅ", icon: Store },
                { id: "hours", label: "ម៉ោងបើកអាជីវកម្ម", icon: Clock },
                { id: "contacts", label: "ទំនាក់ទំនង & Social", icon: Phone },
                { id: "khqr", label: "Bakong KHQR", icon: CreditCard },
                { id: "products", label: "មុខទំនិញ & ម៉ឺនុយ", icon: ShoppingBag },
                { id: "qr", label: "ទាញយក QR Code", icon: QrCode },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                      active
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: PROFILE INFO */}
            {activeTab === "profile" && (
              <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-2xl rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Store size={18} className="text-blue-500" />
                  <span>ព័ត៌មានអាជីវកម្ម និងអត្តសញ្ញាណ</span>
                </h3>

                {/* Handle / Slug */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    ឈ្មោះតំណភ្ជាប់អាជីវកម្ម (Business Handle / URL) *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 focus-within:border-blue-500 transition-colors">
                      <span className="text-xs text-gray-400 shrink-0 select-none mr-1">/b/</span>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        onBlur={checkSlugAvailability}
                        placeholder="my-coffee-shop"
                        className="w-full bg-transparent border-none text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={checkSlugAvailability}
                      disabled={slugStatus.checking}
                      className="px-3.5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-all text-gray-700 dark:text-gray-300 shrink-0"
                    >
                      {slugStatus.checking ? <Loader2 size={14} className="animate-spin" /> : "ពិនិត្យ"}
                    </button>
                  </div>
                  {slugStatus.error && (
                    <p className="text-[11px] text-rose-500 mt-1">{slugStatus.error}</p>
                  )}
                  {publicUrl && !slugStatus.error && (
                    <p className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1">
                      <Check size={12} />
                      <span>តំណភ្ជាប់របស់អ្នក៖ {publicUrl}</span>
                    </p>
                  )}
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    ឈ្មោះអាជីវកម្ម (Business Name) *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="ឧទាហរណ៍៖ Brown Coffee Roasters"
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Category & Theme Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      ប្រភេទអាជីវកម្ម (Category)
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="ហាងកាហ្វេ & ភេសជ្ជៈ">ហាងកាហ្វេ & ភេសជ្ជៈ (Coffee & Drinks)</option>
                      <option value="ភោជនីយដ្ឋាន & អាហារ">ភោជនីយដ្ឋាន & អាហារ (Restaurant & Food)</option>
                      <option value="ហាងលក់សម្លៀកបំពាក់">ហាងលក់សម្លៀកបំពាក់ (Clothing & Fashion)</option>
                      <option value="សាឡន & ថែរក្សាសម្រស់">សាឡន & ថែរក្សាសម្រស់ (Salon & Spa)</option>
                      <option value="គ្រឿងអេឡិចត្រូនិក">គ្រឿងអេឡិចត្រូនិក (Electronics & Gadgets)</option>
                      <option value="អាជីវកម្មអនឡាញ">អាជីវកម្មអនឡាញ (Online Shop)</option>
                      <option value="សេវាកម្មទូទៅ">សេវាកម្មទូទៅ (General Services)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      ពណ៌រចនាបថ (Theme)
                    </label>
                    <select
                      value={formData.theme}
                      onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    >
                      {THEME_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Slogan / Bio */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    ពាក្យស្លោក ឬការពិពណ៌នាខ្លី (Bio / Slogan)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="កាហ្វេឈ្ងុយឆ្ងាញ់ បរិយាកាសស្ងប់ស្ងាត់ សេវាកម្មរហ័សទាន់ចិត្ត..."
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs font-medium text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Avatar & Cover Image URLs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Logo / Avatar Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.avatarUrl}
                      onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                      placeholder="https://.../logo.png"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Cover Banner Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.coverUrl}
                      onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                      placeholder="https://.../cover.jpg"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* YouTube Video URL */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Video size={14} className="text-red-500" />
                    <span>វីដេអូ YouTube Showcase (Noonlai Feature)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.youtubeUrl}
                    onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=... ឬ https://youtu.be/..."
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">វីដេអូណែនាំហាង ឬមុខម្ហូបពិសេស នឹងត្រូវចាក់បញ្ចាំងលើទំព័រ Bio</p>
                </div>
              </div>
            )}

            {/* TAB 2: BUSINESS HOURS (100% Noonlai Match) */}
            {activeTab === "hours" && (
              <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-2xl rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 space-y-5 shadow-xl">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-emerald-500" />
                    <span>ម៉ោងបើកដំណើរការអាជីវកម្ម (Business Hours)</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    ប្រព័ន្ធនឹងបង្ហាញស្ថានភាព "កំពុងបើក / បិទ" តាមពេលវេលាជាក់ស្តែងនៅកម្ពុជា (Phnom Penh Real-Time UTC+7)
                  </p>
                </div>

                {/* 24/7 Toggle */}
                <label className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-black/30 rounded-2xl border border-gray-200 dark:border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.businessHours?.alwaysOpen || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessHours: {
                          ...formData.businessHours,
                          alwaysOpen: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">
                      បើកដំណើរការ ២៤ ម៉ោង (Always Open 24/7)
                    </div>
                    <div className="text-[11px] text-gray-400">
                      ជ្រើសរើសជម្រើសនេះ ប្រសិនបើហាងរបស់អ្នកបើករាល់ថ្ងៃពេញ ២៤ ម៉ោង
                    </div>
                  </div>
                </label>

                {!formData.businessHours?.alwaysOpen && (
                  <>
                    {/* Time Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                          ម៉ោងបើក (Open Time)
                        </label>
                        <input
                          type="time"
                          value={formData.businessHours?.openTime || "07:00"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              businessHours: {
                                ...formData.businessHours,
                                openTime: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                          ម៉ោងបិទ (Close Time)
                        </label>
                        <input
                          type="time"
                          value={formData.businessHours?.closeTime || "21:00"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              businessHours: {
                                ...formData.businessHours,
                                closeTime: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Active Days */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                        ថ្ងៃបើកដំណើរការក្នុងសប្តាហ៍ (Operating Days)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {DAYS_OF_WEEK.map((day) => {
                          const isSelected = (formData.businessHours?.days || []).includes(day.id);
                          return (
                            <button
                              type="button"
                              key={day.id}
                              onClick={() => toggleDay(day.id)}
                              className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center ${
                                isSelected
                                  ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20"
                                  : "bg-gray-50 dark:bg-black/30 border-gray-200 dark:border-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 3: CONTACTS & SOCIAL LINKS */}
            {activeTab === "contacts" && (
              <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-2xl rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Phone size={18} className="text-sky-500" />
                  <span>ប៊ូតុងទំនាក់ទំនង និងបណ្តាញសង្គម</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-400" />
                      <span>លេខទូរស័ព្ទ (Phone Call)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contacts?.phone || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contacts: { ...formData.contacts, phone: e.target.value },
                        })
                      }
                      placeholder="012 345 678"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Send size={13} className="text-sky-400" />
                      <span>Telegram (Username ឬ Link)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contacts?.telegram || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contacts: { ...formData.contacts, telegram: e.target.value },
                        })
                      }
                      placeholder="@username ឬ https://t.me/..."
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <MessageCircle size={13} className="text-emerald-500" />
                      <span>WhatsApp Number</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contacts?.whatsapp || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contacts: { ...formData.contacts, whatsapp: e.target.value },
                        })
                      }
                      placeholder="+85512345678"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <span className="font-bold text-blue-500">f</span>
                      <span>Facebook Page Link</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contacts?.facebook || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contacts: { ...formData.contacts, facebook: e.target.value },
                        })
                      }
                      placeholder="https://facebook.com/..."
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <span className="font-bold text-pink-500">Tik</span>
                      <span>TikTok Profile Link</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contacts?.tiktok || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contacts: { ...formData.contacts, tiktok: e.target.value },
                        })
                      }
                      placeholder="https://tiktok.com/@..."
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Globe size={13} className="text-indigo-400" />
                      <span>Website Link</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contacts?.website || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contacts: { ...formData.contacts, website: e.target.value },
                        })
                      }
                      placeholder="https://..."
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Physical Location */}
                <div className="pt-2 border-t border-gray-200 dark:border-white/10 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin size={13} className="text-rose-400" />
                      <span>អាសយដ្ឋានហាង (Physical Address)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="ផ្ទះលេខ... ផ្លូវ... សង្កាត់... រាជធានីភ្នំពេញ"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin size={13} className="text-blue-400" />
                      <span>Google Maps Location Link</span>
                    </label>
                    <input
                      type="text"
                      value={formData.googleMapsUrl || ""}
                      onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">អតិថិជនអាចចុចដើម្បីបើកផ្លូវមកកាន់ហាងរបស់អ្នកផ្ទាល់</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: BAKONG KHQR SETUP (Superior to Noonlai!) */}
            {activeTab === "khqr" && (
              <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-2xl rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <CreditCard size={18} className="text-red-500" />
                      <span>ការទូទាត់ Bakong KHQR (Direct Scan & Pay)</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      អតិថិជនអាចស្កេនទូទាត់ប្រាក់ភ្លាមៗពីគ្រប់ធនាគារ (ABA, Wing, ACLEDA, Bakong...)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-500 border border-red-500/20">
                    Cambodia Standard
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      ឈ្មោះធនាគារ (Bank Name)
                    </label>
                    <input
                      type="text"
                      value={formData.khqrBankName || ""}
                      onChange={(e) => setFormData({ ...formData, khqrBankName: e.target.value })}
                      placeholder="Bakong / ABA Bank"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      ឈ្មោះម្ចាស់គណនី (Account Name)
                    </label>
                    <input
                      type="text"
                      value={formData.khqrAccountName || ""}
                      onChange={(e) => setFormData({ ...formData, khqrAccountName: e.target.value })}
                      placeholder="KHMER BUSINESS CO., LTD"
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    រូបភាព QR Code (KHQR Image URL)
                  </label>
                  <input
                    type="text"
                    value={formData.khqrImage || ""}
                    onChange={(e) => setFormData({ ...formData, khqrImage: e.target.value })}
                    placeholder="https://.../my_aba_khqr.jpg"
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    អ្នកអាចបញ្ចូលតំណភ្ជាប់រូបភាព QR Code របស់ធនាគារ ABA ឬ Bakong របស់អ្នក
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    លេខកូដ KHQR String ឬ Bakong ID (ជម្រើសបន្ថែម)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.khqrString || ""}
                    onChange={(e) => setFormData({ ...formData, khqrString: e.target.value })}
                    placeholder="00020101021229300016bakong@bkrt..."
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* TAB 5: PRODUCTS & MENU (Noonlai Feature + Telegram Order) */}
            {activeTab === "products" && (
              <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-2xl rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShoppingBag size={18} className="text-pink-500" />
                      <span>មុខទំនិញ & ម៉ឺនុយ ({formData.products?.length || 0})</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      បង្ហាញទំនិញលក់ដាច់ ម៉ឺនុយភេសជ្ជៈ ជាមួយនឹងប៊ូតុងកុម្ម៉ង់ផ្ទាល់តាម Telegram
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddProduct(true)}
                    className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 flex items-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>បន្ថែមទំនិញ</span>
                  </button>
                </div>

                {/* Add Product Modal/Form */}
                {showAddProduct && (
                  <div className="p-4 bg-gray-50 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">បញ្ចូលទំនិញថ្មី</h4>
                      <button
                        type="button"
                        onClick={() => setShowAddProduct(false)}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        ✕ បោះបង់
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                          ឈ្មោះទំនិញ *
                        </label>
                        <input
                          type="text"
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                          placeholder="Iced Latte / អាវយឺត..."
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                          តម្លៃ *
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                            placeholder="2.50"
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none font-bold"
                          />
                          <select
                            value={newProduct.currency}
                            onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-2 text-xs text-gray-900 dark:text-white focus:outline-none font-bold"
                          >
                            <option value="$">$</option>
                            <option value="៛">៛</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                        រូបភាពទំនិញ (Image URL)
                      </label>
                      <input
                        type="text"
                        value={newProduct.imageUrl}
                        onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                        placeholder="https://.../product.jpg"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                        ការពិពណ៌នាខ្លី (Description)
                      </label>
                      <input
                        type="text"
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        placeholder="កាហ្វេប្រេស៊ីល 100% រសជាតិឈ្ងុយឆ្ងាញ់..."
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleAddProduct}
                        className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20"
                      >
                        យល់ព្រមបន្ថែម
                      </button>
                    </div>
                  </div>
                )}

                {/* Product List */}
                <div className="space-y-2">
                  {formData.products?.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      មិនទាន់មានទំនិញនៅឡើយទេ។ ចុច "បន្ថែមទំនិញ" ដើម្បីចាប់ផ្តើម។
                    </div>
                  ) : (
                    formData.products.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 dark:bg-black/30 rounded-2xl border border-gray-200 dark:border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                            />
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-emerald-500 font-bold">
                              {item.price} {item.currency || "$"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(item.id)}
                          className="p-2 text-gray-400 hover:text-rose-500 transition-colors shrink-0"
                          title="លុប"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: SMART QR CODE (Download high-res for print) */}
            {activeTab === "qr" && (
              <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-2xl rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 space-y-5 shadow-xl text-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                    <QrCode size={18} className="text-blue-500" />
                    <span>ទាញយក Smart QR Code សម្រាប់បោះពុម្ព</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    ទាញយក QR Code កម្រិតច្បាស់ខ្ពស់ ដើម្បីបោះពុម្ពដាក់លើតុ (Table Tent Card), ស្ទីគ័រលើកញ្ចក់, ឬប័ណ្ណបញ្ចុះតម្លៃ
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl inline-block shadow-2xl border-4 border-gray-100 dark:border-gray-800">
                  {qrDownloadUrl ? (
                    <img src={qrDownloadUrl} alt="Store QR" className="w-56 h-56 mx-auto" />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-gray-400 text-xs">
                      បញ្ចូល Handle ជាមុនសិន
                    </div>
                  )}
                  <p className="text-xs font-black text-gray-900 mt-3">{formData.businessName || "My Business"}</p>
                  <p className="text-[10px] text-gray-500">{publicUrl}</p>
                </div>

                <div className="max-w-xs mx-auto space-y-2">
                  <a
                    href={qrDownloadUrl}
                    download={`${formData.slug || "store"}-qr.png`}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                  >
                    <Download size={15} />
                    <span>ទាញយករូបភាព QR Code (PNG)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("បានចម្លងតំណភ្ជាប់!");
                    }}
                    className="w-full py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Copy size={13} />
                    <span>ចម្លងតំណភ្ជាប់ (Copy Link)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 📱 Right Column: Live Mobile Preview Device (5 cols) */}
          <div className="lg:col-span-5 sticky top-24">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>ការបង្ហាញផ្ទាល់លើទូរស័ព្ទ (Live Mobile Preview)</span>
              </span>
              <span className="text-[10px] text-emerald-500 font-bold">● Syncing Live</span>
            </div>

            {/* Smartphone Mockup Frame */}
            <div className="w-full max-w-[380px] mx-auto rounded-[42px] p-3 bg-gray-900 shadow-2xl border-4 border-gray-700/60 ring-1 ring-white/10 relative overflow-hidden">
              {/* Speaker Notch */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-gray-900/80 mr-3" />
                <div className="w-10 h-1 bg-gray-800 rounded-full" />
              </div>

              {/* Screen Scrollable Viewport */}
              <div className="w-full h-[640px] rounded-[32px] overflow-y-auto overflow-x-hidden bg-black relative scrollbar-none">
                <PublicBio previewData={formData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
