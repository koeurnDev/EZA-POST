// ============================================================
// 📱 BioBuilder.jsx - Digital Business Card & Storefront Manager
// Moneaa - Ultra Fast, Mobile-First, Tabbed UX with 1-Tap Photo Upload
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  QrCode, Sparkles, Store, Phone, Send, MessageCircle,
  MapPin, Video, ShoppingBag, Plus, Trash2, ExternalLink,
  Download, Eye, Check, Loader2, Save, Globe, Clock,
  Copy, CreditCard, Upload, Image as ImageIcon, ChevronRight,
  ChevronLeft, ArrowUpRight, Wand2, X
} from "lucide-react";
import toast from "react-hot-toast";
import QRCodeLib from "qrcode";
import api from "../utils/api";
import PublicBio from "./PublicBio";

const THEME_OPTIONS = [
  { id: "dark", name: "🌙 Dark Obsidian", desc: "ទំនើប និងលេចធ្លោ" },
  { id: "emerald", name: "💎 Emerald Luxury", desc: "ប្រណិត និងស្រស់បំព្រង" },
  { id: "sunset", name: "🌅 Sunset Glow", desc: "ទាក់ទាញ និងរស់រវើក" },
  { id: "coffee", name: "☕ Coffee Warm", desc: "កក់ក្តៅ ហាងកាហ្វេ" },
  { id: "minimal", name: "⚪ Ultra Minimal", desc: "ស ស្អាត សាមញ្ញ" },
];

const DAYS_OF_WEEK = [
  { id: "mon", label: "ច័ន្ទ" },
  { id: "tue", label: "អង្គារ" },
  { id: "wed", label: "ពុធ" },
  { id: "thu", label: "ព្រហ" },
  { id: "fri", label: "សុក្រ" },
  { id: "sat", label: "សៅរ៍" },
  { id: "sun", label: "អាទិត្យ" },
];

const TABS = [
  { id: "profile", label: "ព័ត៌មាន", icon: Store, short: "ព័ត៌មាន" },
  { id: "contacts", label: "ទំនាក់ទំនង", icon: Phone, short: "ទំនាក់ទំនង" },
  { id: "khqr", label: "Bakong KHQR", icon: CreditCard, short: "KHQR" },
  { id: "products", label: "ទំនិញ & ម៉ឺនុយ", icon: ShoppingBag, short: "ទំនិញ" },
  { id: "hours", label: "ម៉ោងបើក", icon: Clock, short: "ម៉ោង" },
  { id: "qr", label: "ទាញយក QR", icon: QrCode, short: "QR" },
];

// 📸 Reusable 1-Tap Photo Uploader Component
function PhotoUploader({ label, value, onChange, placeholder = "ជ្រើសរើសរូបភាព", helperText }) {
  const [uploading, setUploading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("សូមជ្រើសរើសឯកសារជារូបភាព (JPG, PNG, WEBP)");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("រូបភាពមិនអាចធំជាង 5MB ទេ");
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("thumbnail", file);

      const res = await api.post("/uploads/thumbnail", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data.file?.url) {
        onChange(res.data.file.url);
        toast.success("បានបញ្ចូលរូបភាពជោគជ័យ! 🎉");
      } else {
        toast.error("មិនអាចបញ្ចូលរូបភាពបានទេ");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.error || "មានបញ្ហាក្នុងការបញ្ចូលរូបភាព");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300">{label}</label>
        <button
          type="button"
          onClick={() => setManualMode(!manualMode)}
          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          {manualMode ? "ប្រើប៊ូតុង Upload" : "បញ្ចូល Link ដោយដៃ"}
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {manualMode ? (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://.../photo.jpg"
          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <div className="flex items-center gap-2.5">
          {value ? (
            <div className="relative group shrink-0">
              <img
                src={value}
                alt="Uploaded preview"
                className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-sm"
              />
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] hover:bg-rose-500 shadow-sm"
                title="លុបរូប"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-dashed border-white/15 flex items-center justify-center text-slate-500 shrink-0">
              <ImageIcon size={20} />
            </div>
          )}

          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin text-blue-400" /> : <Upload size={14} className="text-blue-400" />}
              <span>{uploading ? "កំពុង Upload..." : value ? "ប្ដូររូបភាព" : placeholder}</span>
            </button>
            {value && (
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Check size={12} />
                <span>មានរូបហើយ</span>
              </span>
            )}
          </div>
        </div>
      )}

      {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
}

export default function BioBuilder() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [mobileMode, setMobileMode] = useState("editor"); // "editor" | "preview"
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: true, error: null });
  const [qrDownloadUrl, setQrDownloadUrl] = useState("");

  const [formData, setFormData] = useState({
    slug: "",
    businessName: "",
    category: "ហាងកាហ្វេ & ភេសជ្ជៈ",
    bio: "",
    avatarUrl: "",
    coverUrl: "",
    theme: "dark",
    contacts: { phone: "", telegram: "", whatsapp: "", facebook: "", tiktok: "", website: "" },
    businessHours: { alwaysOpen: false, openTime: "07:00", closeTime: "21:00", days: ["mon","tue","wed","thu","fri","sat","sun"] },
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

  const [newProduct, setNewProduct] = useState({ name: "", price: "", currency: "$", description: "", imageUrl: "", isAvailable: true });
  const [showAddProduct, setShowAddProduct] = useState(false);

  useEffect(() => {
    const fetchUserBio = async () => {
      try {
        const res = await api.get("/bio/me");
        if (res.data?.success && res.data.bioPage) {
          const page = res.data.bioPage;
          const loadedContacts = typeof page.contacts === "object" && page.contacts ? page.contacts : {};
          const loadedHours = typeof page.businessHours === "object" && page.businessHours ? page.businessHours : {};
          setFormData({
            slug: page.slug || "",
            businessName: page.businessName || "",
            category: page.category || "ហាងកាហ្វេ & ភេសជ្ជៈ",
            bio: page.bio || "",
            avatarUrl: page.avatarUrl || "",
            coverUrl: page.coverUrl || "",
            theme: page.theme || "dark",
            contacts: { phone: "", telegram: "", whatsapp: "", facebook: "", tiktok: "", website: "", ...loadedContacts },
            businessHours: { alwaysOpen: false, openTime: "07:00", closeTime: "21:00", days: ["mon","tue","wed","thu","fri","sat","sun"], ...loadedHours },
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

  useEffect(() => {
    if (!formData.slug) { setQrDownloadUrl(""); return; }
    const fullUrl = `${window.location.origin}/b/${formData.slug}`;
    QRCodeLib.toDataURL(fullUrl, { width: 600, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => setQrDownloadUrl(url))
      .catch(() => { });
  }, [formData.slug]);

  const handleSlugChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
    setFormData((prev) => ({ ...prev, slug: clean }));
    setSlugStatus({ checking: false, available: true, error: null });
  };

  const checkSlugAvailability = async () => {
    if (!formData.slug || formData.slug.length < 3) {
      setSlugStatus({ checking: false, available: false, error: "តម្រូវឱ្យមានយ៉ាងតិច ៣ តួអក្សរ" });
      return;
    }
    setSlugStatus({ checking: true, available: true, error: null });
    try {
      const res = await api.get(`/bio/check-slug/${formData.slug}`);
      setSlugStatus({ checking: false, available: res.data.available, error: res.data.available ? null : "ឈ្មោះនេះមានអ្នកប្រើប្រាស់រួចហើយ" });
    } catch {
      setSlugStatus({ checking: false, available: true, error: null });
    }
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) return toast.error("សូមបញ្ចូលឈ្មោះទំនិញ និងតម្លៃ");
    setFormData((prev) => ({ ...prev, products: [...prev.products, { id: crypto.randomUUID(), ...newProduct }] }));
    setNewProduct({ name: "", price: "", currency: "$", description: "", imageUrl: "", isAvailable: true });
    setShowAddProduct(false);
    toast.success("បានបន្ថែមទំនិញជោគជ័យ!");
  };

  const handleDeleteProduct = (id) => {
    setFormData((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
    toast.success("បានលុបទំនិញ");
  };

  const toggleDay = (dayId) => {
    setFormData((prev) => {
      const currentDays = prev.businessHours?.days || [];
      const updated = currentDays.includes(dayId) ? currentDays.filter((d) => d !== dayId) : [...currentDays, dayId];
      return { ...prev, businessHours: { ...prev.businessHours, days: updated } };
    });
  };

  const handleSave = async () => {
    if (!formData.slug || formData.slug.length < 3) return toast.error("សូមបញ្ចូល Handle (Slug) យ៉ាងតិច ៣ តួអក្សរ");
    if (!formData.businessName.trim()) return toast.error("សូមបញ្ចូលឈ្មោះអាជីវកម្ម (Business Name)");
    setSaving(true);
    try {
      const res = await api.post("/bio", formData);
      if (res.data?.success) toast.success("រក្សាទុកកាតអាជីវកម្មជោគជ័យ! 🎉");
      else toast.error(res.data?.error || "មិនអាចរក្សាទុកបានទេ");
    } catch (err) {
      toast.error(err.response?.data?.error || "មានបញ្ហាក្នុងការរក្សាទុក");
    } finally {
      setSaving(false);
    }
  };

  // 1-Click Sample Preset
  const handleLoadSample = () => {
    setFormData({
      slug: formData.slug || "moneaa-cafe",
      businessName: "Moneaa Coffee & Bakery",
      category: "ហាងកាហ្វេ & ភេសជ្ជៈ",
      bio: "កាហ្វេឈ្ងុយឆ្ងាញ់ បរិយាកាសស្ងប់ស្ងាត់ សេវាកម្មរហ័សទាន់ចិត្ត ☕️✨",
      avatarUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&auto=format&fit=crop&q=80",
      theme: "coffee",
      contacts: {
        phone: "012 345 678",
        telegram: "moneaacafe",
        whatsapp: "+85512345678",
        facebook: "https://facebook.com",
        tiktok: "",
        website: "https://moneaa.site",
      },
      businessHours: {
        alwaysOpen: false,
        openTime: "07:00",
        closeTime: "21:00",
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      },
      address: "ផ្លូវ ២០០ សង្កាត់បឹងកេងកង រាជធានីភ្នំពេញ",
      googleMapsUrl: "https://maps.google.com",
      youtubeUrl: "",
      khqrString: "",
      khqrImage: "",
      khqrBankName: "Bakong / ABA Bank",
      khqrAccountName: "MONEAA COFFEE SHOP",
      products: [
        { id: "p1", name: "Iced Latte (កាហ្វេទឹកដោះគោ)", price: "2.50", currency: "$", description: "កាហ្វេអារ៉ាប៊ីកា 100% រសជាតិឈ្ងុយផ្អែមស្រទន់", imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=300&auto=format&fit=crop&q=80", isAvailable: true },
        { id: "p2", name: "Matcha Green Tea (តែបៃតង)", price: "2.75", currency: "$", description: "តែបៃតងសុទ្ធនាំចូលពីប្រទេសជប៉ុន", imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&auto=format&fit=crop&q=80", isAvailable: true },
      ],
      isActive: true,
    });
    toast.success("បានដាក់ទិន្នន័យគំរូហាងកាហ្វេជោគជ័យ! 🎉");
  };

  const publicUrl = formData.slug ? `${window.location.origin}/b/${formData.slug}` : "";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-xs text-slate-400 font-medium">កំពុងផ្ទុកទិន្នន័យកាតអាជីវកម្ម...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Next / Previous Tab Navigation
  const currentTabIndex = TABS.findIndex((t) => t.id === activeTab);
  const nextTab = TABS[currentTabIndex + 1];
  const prevTab = TABS[currentTabIndex - 1];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 md:py-6 space-y-4 md:space-y-6">

        {/* 🚀 Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#10131b] p-4 sm:p-5 rounded-2xl md:rounded-3xl border border-white/8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <Store size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white">
                  កាតអាជីវកម្មឌីជីថល
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Moneaa Pro
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Bio Link · ម៉ឺនុយទំនិញ · Bakong KHQR · ម៉ោងដំណើរការ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Sample Button if empty */}
            {!formData.businessName && (
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                title="ដាក់ទិន្នន័យគំរូដើម្បីតេស្តភ្លាមៗ"
              >
                <Wand2 size={13} />
                <span className="hidden xs:inline">ទិន្នន័យគំរូ</span>
              </button>
            )}

            {formData.slug && (
              <a
                href={`/b/${formData.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/8"
              >
                <Eye size={14} />
                <span className="hidden sm:inline">មើលទំព័រ</span>
                <ArrowUpRight size={13} />
              </a>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 sm:px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? "កំពុងរក្សា..." : "រក្សាទុក"}</span>
            </button>
          </div>
        </div>

        {/* 📱 Mobile Mode Switcher (< lg screens): Editor vs Live Preview */}
        <div className="lg:hidden flex items-center p-1 bg-[#10131b] border border-white/8 rounded-2xl">
          <button
            type="button"
            onClick={() => setMobileMode("editor")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mobileMode === "editor"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Store size={14} />
            <span>កែសម្រួលទិន្នន័យ</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMode("preview")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mobileMode === "preview"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Eye size={14} />
            <span>មើលកាតផ្ទាល់ (Preview)</span>
          </button>
        </div>

        {/* 🖥️ Main Grid: Left Editor (7 cols) + Right Live Preview (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column: Editor Form (Hidden on mobile if user chose "preview" mode) */}
          <div className={`lg:col-span-7 space-y-4 ${mobileMode === "preview" ? "hidden lg:block" : "block"}`}>

            {/* 🎯 Horizontal Tab Navigation (Fast, No Endless Scrolling!) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/8">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                        : "bg-[#10131b] text-slate-400 hover:text-slate-200 border border-white/5 hover:border-white/10"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-blue-400"} />
                    <span>{tab.label}</span>
                    {tab.id === "products" && formData.products?.length > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-white/10 text-slate-300"}`}>
                        {formData.products.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── TAB 1: PROFILE / BUSINESS INFO ── */}
            {activeTab === "profile" && (
              <div className="bg-[#10131b] p-4 sm:p-6 rounded-2xl md:rounded-3xl border border-white/8 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Store size={16} className="text-blue-400" />
                    <span>ព័ត៌មានអាជីវកម្ម និងអត្តសញ្ញាណ</span>
                  </h3>
                  <span className="text-[10px] text-slate-500">ជំហាន ១ នៃ ៦</span>
                </div>

                {/* Handle / Slug */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    ឈ្មោះតំណភ្ជាប់អាជីវកម្ម (Business Handle / URL) *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 focus-within:border-blue-500 transition-colors">
                      <span className="text-xs text-slate-500 shrink-0 select-none mr-1">/b/</span>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        onBlur={checkSlugAvailability}
                        placeholder="my-coffee-shop"
                        className="w-full bg-transparent border-none text-xs font-bold text-white focus:outline-none focus:ring-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={checkSlugAvailability}
                      disabled={slugStatus.checking}
                      className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all text-slate-300 shrink-0 border border-white/8"
                    >
                      {slugStatus.checking ? <Loader2 size={14} className="animate-spin" /> : "ពិនិត្យ"}
                    </button>
                  </div>
                  {slugStatus.error && <p className="text-[11px] text-rose-500 mt-1">{slugStatus.error}</p>}
                  {publicUrl && !slugStatus.error && (
                    <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 truncate">
                      <Check size={12} className="shrink-0" />
                      <span className="truncate">{publicUrl}</span>
                    </p>
                  )}
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ឈ្មោះអាជីវកម្ម (Business Name) *</label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Brown Coffee Roasters"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Category & Theme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ប្រភេទអាជីវកម្ម (Category)</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="ហាងកាហ្វេ & ភេសជ្ជៈ">ហាងកាហ្វេ & ភេសជ្ជៈ</option>
                      <option value="ភោជនីយដ្ឋាន & អាហារ">ភោជនីយដ្ឋាន & អាហារ</option>
                      <option value="ហាងលក់សម្លៀកបំពាក់">ហាងលក់សម្លៀកបំពាក់</option>
                      <option value="សាឡន & ថែរក្សាសម្រស់">សាឡន & ថែរក្សាសម្រស់</option>
                      <option value="គ្រឿងអេឡិចត្រូនិក">គ្រឿងអេឡិចត្រូនិក</option>
                      <option value="អាជីវកម្មអនឡាញ">អាជីវកម្មអនឡាញ (Online Shop)</option>
                      <option value="សេវាកម្មទូទៅ">សេវាកម្មទូទៅ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ពណ៌រចនាបថ (Theme)</label>
                    <select
                      value={formData.theme}
                      onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      {THEME_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} — {t.desc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Slogan / Bio */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ពាក្យស្លោក / ការពិពណ៌នាខ្លី (Bio)</label>
                  <textarea
                    rows={2}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="កាហ្វេឈ្ងុយ បរិយាកាសស្ងប់ស្ងាត់ សេវាកម្មរហ័សទាន់ចិត្ត..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* 📸 1-Tap Photo Uploaders for Logo & Cover */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <PhotoUploader
                    label="រូប Logo / Profile"
                    value={formData.avatarUrl}
                    onChange={(url) => setFormData({ ...formData, avatarUrl: url })}
                    placeholder="Upload រូប Logo"
                    helperText="រូប Logo មូលសម្រាប់កាត"
                  />

                  <PhotoUploader
                    label="រូប Cover Banner"
                    value={formData.coverUrl}
                    onChange={(url) => setFormData({ ...formData, coverUrl: url })}
                    placeholder="Upload រូប Cover"
                    helperText="រូបផ្ទាំងខាងលើ (Banner)"
                  />
                </div>

                {/* YouTube Video URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Video size={14} className="text-red-500" />
                    <span>វីដេអូ YouTube Showcase (ជម្រើសបន្ថែម)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.youtubeUrl}
                    onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ── TAB 2: CONTACTS & SOCIALS ── */}
            {activeTab === "contacts" && (
              <div className="bg-[#10131b] p-4 sm:p-6 rounded-2xl md:rounded-3xl border border-white/8 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Phone size={16} className="text-sky-400" />
                    <span>ប៊ូតុងទំនាក់ទំនង និងបណ្តាញសង្គម</span>
                  </h3>
                  <span className="text-[10px] text-slate-500">ជំហាន ២ នៃ ៦</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "phone", label: "លេខទូរស័ព្ទ (Phone Call)", placeholder: "012 345 678", icon: <Phone size={13} className="text-emerald-400" /> },
                    { key: "telegram", label: "Telegram (Username ឬ Link)", placeholder: "@username", icon: <Send size={13} className="text-sky-400" /> },
                    { key: "whatsapp", label: "WhatsApp Number", placeholder: "+85512345678", icon: <MessageCircle size={13} className="text-emerald-500" /> },
                    { key: "facebook", label: "Facebook Page Link", placeholder: "https://facebook.com/...", icon: <span className="font-bold text-blue-500 text-xs">f</span> },
                    { key: "tiktok", label: "TikTok Profile Link", placeholder: "https://tiktok.com/@...", icon: <span className="font-bold text-pink-500 text-xs">Tik</span> },
                    { key: "website", label: "Website Link", placeholder: "https://...", icon: <Globe size={13} className="text-indigo-400" /> },
                  ].map(({ key, label, placeholder, icon }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        {icon}
                        <span>{label}</span>
                      </label>
                      <input
                        type="text"
                        value={formData.contacts?.[key] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contacts: { ...formData.contacts, [key]: e.target.value },
                          })
                        }
                        placeholder={placeholder}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Location & Map */}
                <div className="pt-3 border-t border-white/5 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin size={13} className="text-rose-400" />
                      <span>អាសយដ្ឋានហាង (Physical Address)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="ផ្ទះលេខ... ផ្លូវ... សង្កាត់... រាជធានីភ្នំពេញ"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin size={13} className="text-blue-400" />
                      <span>Google Maps Location Link</span>
                    </label>
                    <input
                      type="text"
                      value={formData.googleMapsUrl || ""}
                      onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">អតិថិជនចុចដើម្បីបើកផ្លូវមកកាន់ហាង</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: BAKONG KHQR ── */}
            {activeTab === "khqr" && (
              <div className="bg-[#10131b] p-4 sm:p-6 rounded-2xl md:rounded-3xl border border-white/8 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard size={16} className="text-red-400" />
                      <span>ការទូទាត់ Bakong KHQR (Scan & Pay)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ស្កេនទូទាត់ប្រាក់ភ្លាមៗពី ABA, Wing, ACLEDA, Bakong...
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                    Cambodia Standard
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ឈ្មោះធនាគារ (Bank Name)</label>
                    <input
                      type="text"
                      value={formData.khqrBankName || ""}
                      onChange={(e) => setFormData({ ...formData, khqrBankName: e.target.value })}
                      placeholder="Bakong / ABA Bank"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ឈ្មោះម្ចាស់គណនី (Account Name)</label>
                    <input
                      type="text"
                      value={formData.khqrAccountName || ""}
                      onChange={(e) => setFormData({ ...formData, khqrAccountName: e.target.value })}
                      placeholder="KHMER BUSINESS CO., LTD"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 📸 1-Tap Photo Uploader for KHQR Screenshot */}
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                  <PhotoUploader
                    label="រូបភាព QR Code (ABA / Bakong Screenshot)"
                    value={formData.khqrImage}
                    onChange={(url) => setFormData({ ...formData, khqrImage: url })}
                    placeholder="ជ្រើសរើសរូប Screenshot KHQR"
                    helperText="អ្នកអាច Screenshot រូប QR ពីក្នុង ABA ឬ Bakong app រួច Upload នៅទីនេះ"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">លេខកូដ KHQR String ឬ Bakong ID (ជម្រើសបន្ថែម)</label>
                  <textarea
                    rows={2}
                    value={formData.khqrString || ""}
                    onChange={(e) => setFormData({ ...formData, khqrString: e.target.value })}
                    placeholder="00020101021229300016bakong@bkrt..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ── TAB 4: PRODUCTS & MENU ── */}
            {activeTab === "products" && (
              <div className="bg-[#10131b] p-4 sm:p-6 rounded-2xl md:rounded-3xl border border-white/8 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShoppingBag size={16} className="text-pink-400" />
                      <span>មុខទំនិញ & ម៉ឺនុយ ({formData.products?.length || 0})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      អតិថិជនអាចមើលតម្លៃ និងចុចកុម្ម៉ង់ផ្ទាល់តាម Telegram
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddProduct(true)}
                    className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>បន្ថែមទំនិញ</span>
                  </button>
                </div>

                {/* Add Product Modal/Card */}
                {showAddProduct && (
                  <div className="p-4 bg-black/40 rounded-2xl border border-pink-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                        <Plus size={14} className="text-pink-400" />
                        <span>បញ្ចូលទំនិញថ្មី</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddProduct(false)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        ✕ បោះបង់
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">ឈ្មោះទំនិញ *</label>
                        <input
                          type="text"
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                          placeholder="Iced Latte / អាវយឺត..."
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">តម្លៃ *</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                            placeholder="2.50"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-bold"
                          />
                          <select
                            value={newProduct.currency}
                            onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })}
                            className="bg-black/50 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none font-bold"
                          >
                            <option value="$">$</option>
                            <option value="៛">៛</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 📸 1-Tap Photo Uploader for Product */}
                    <PhotoUploader
                      label="រូបភាពទំនិញ"
                      value={newProduct.imageUrl}
                      onChange={(url) => setNewProduct({ ...newProduct, imageUrl: url })}
                      placeholder="Upload រូបទំនិញ"
                    />

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">ការពិពណ៌នាខ្លី</label>
                      <input
                        type="text"
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        placeholder="កាហ្វេអារ៉ាប៊ីកា 100% រសជាតិឈ្ងុយ..."
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddProduct(false)}
                        className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
                      >
                        បោះបង់
                      </button>
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
                    <div className="text-center py-8 text-slate-500 text-xs">
                      មិនទាន់មានទំនិញនៅឡើយទេ។ ចុច "បន្ថែមទំនិញ" ដើម្បីចាប់ផ្តើម។
                    </div>
                  ) : (
                    formData.products.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-black/30 rounded-2xl border border-white/8 flex items-center justify-between gap-3 hover:border-white/15 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                              <ShoppingBag size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-white truncate">{item.name}</h4>
                            <p className="text-[11px] text-emerald-400 font-bold">
                              {item.price} {item.currency || "$"}
                            </p>
                            {item.description && (
                              <p className="text-[10px] text-slate-500 truncate max-w-xs">{item.description}</p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(item.id)}
                          className="p-2 text-slate-500 hover:text-rose-500 transition-colors shrink-0"
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

            {/* ── TAB 5: BUSINESS HOURS ── */}
            {activeTab === "hours" && (
              <div className="bg-[#10131b] p-4 sm:p-6 rounded-2xl md:rounded-3xl border border-white/8 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock size={16} className="text-emerald-400" />
                      <span>ម៉ោងបើកដំណើរការអាជីវកម្ម (Business Hours)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ប្រព័ន្ធនឹងបង្ហាញ "កំពុងបើក / បិទ" តាមម៉ោងជាក់ស្តែងនៅកម្ពុជា (UTC+7)
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">ជំហាន ៥ នៃ ៦</span>
                </div>

                {/* 24/7 Toggle */}
                <label className="flex items-center gap-3 p-3.5 bg-black/30 rounded-2xl border border-white/8 cursor-pointer hover:border-white/15 transition-colors">
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
                    <div className="text-xs font-bold text-white">បើកដំណើរការ ២៤ ម៉ោង (Always Open 24/7)</div>
                    <div className="text-[11px] text-slate-500">ជ្រើសរើសជម្រើសនេះ ប្រសិនបើហាងរបស់អ្នកបើករាល់ថ្ងៃពេញ ២៤ ម៉ោង</div>
                  </div>
                </label>

                {!formData.businessHours?.alwaysOpen && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">ម៉ោងបើក (Open Time)</label>
                        <input
                          type="time"
                          value={formData.businessHours?.openTime || "07:00"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              businessHours: { ...formData.businessHours, openTime: e.target.value },
                            })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">ម៉ោងបិទ (Close Time)</label>
                        <input
                          type="time"
                          value={formData.businessHours?.closeTime || "21:00"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              businessHours: { ...formData.businessHours, closeTime: e.target.value },
                            })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">ថ្ងៃបើកដំណើរការក្នុងសប្តាហ៍</label>
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
                                  : "bg-black/30 border-white/8 text-slate-500 hover:text-white"
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

            {/* ── TAB 6: SMART QR CODE ── */}
            {activeTab === "qr" && (
              <div className="bg-[#10131b] p-4 sm:p-6 rounded-2xl md:rounded-3xl border border-white/8 space-y-4 shadow-xl text-center">
                <div className="pb-2 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                    <QrCode size={16} className="text-amber-400" />
                    <span>ទាញយក Smart QR Code សម្រាប់បោះពុម្ព</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    បោះពុម្ពដាក់លើតុ (Table Tent), ស្ទីគ័រកញ្ចក់, ឬនាមប័ណ្ណ
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl inline-block shadow-2xl border-4 border-slate-800">
                  {qrDownloadUrl ? (
                    <img src={qrDownloadUrl} alt="Store QR" className="w-52 h-52 mx-auto" />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                      បញ្ចូល Handle ជាមុនសិន
                    </div>
                  )}
                  <p className="text-xs font-black text-slate-900 mt-2">{formData.businessName || "My Business"}</p>
                  <p className="text-[10px] text-slate-500">{publicUrl}</p>
                </div>

                <div className="max-w-xs mx-auto space-y-2">
                  {qrDownloadUrl ? (
                    <a
                      href={qrDownloadUrl}
                      download={`${formData.slug || "store"}-qr.png`}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                    >
                      <Download size={14} />
                      <span>ទាញយករូបភាព QR Code (PNG)</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 bg-blue-600/40 text-white/50 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Download size={14} />
                      <span>បញ្ចូល Handle ដើម្បីទាញយក</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("បានចម្លងតំណភ្ជាប់!");
                    }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-white/8"
                  >
                    <Copy size={13} />
                    <span>ចម្លងតំណភ្ជាប់ (Copy Link)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Navigation Footer (Next / Prev Tab) */}
            <div className="flex items-center justify-between pt-2">
              {prevTab ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(prevTab.id)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 transition-all flex items-center gap-1.5"
                >
                  <ChevronLeft size={14} />
                  <span>ថយក្រោយ: {prevTab.short}</span>
                </button>
              ) : <div />}

              {nextTab ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(nextTab.id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-blue-300 hover:text-white bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center gap-1.5"
                >
                  <span>បន្ទាប់: {nextTab.short}</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 shadow-md transition-all flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>រក្សាទុកទាំងអស់</span>
                </button>
              )}
            </div>

          </div>

          {/* Right Column: Live Mobile Preview Device (Always on Desktop, Tabbed on Mobile) */}
          <div className={`lg:col-span-5 sticky top-20 ${mobileMode === "editor" ? "hidden lg:block" : "block"}`}>
            <div className="flex items-center justify-between mb-2.5 px-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>ការបង្ហាញផ្ទាល់លើទូរស័ព្ទ (Live Preview)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Sync ភ្លាមៗ</span>
              </span>
            </div>

            {/* Smartphone Mockup Frame */}
            <div className="w-full max-w-[360px] mx-auto rounded-[38px] p-2.5 bg-gray-900 shadow-2xl border-4 border-gray-700/60 ring-1 ring-white/10 relative overflow-hidden">
              {/* Speaker Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-3.5 bg-black rounded-full z-30 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-900/80 mr-2" />
                <div className="w-8 h-1 bg-gray-800 rounded-full" />
              </div>

              {/* Screen Scrollable Viewport */}
              <div className="w-full h-[600px] rounded-[28px] overflow-y-auto overflow-x-hidden bg-black relative scrollbar-none">
                <PublicBio previewData={formData} />
              </div>
            </div>

            {/* Quick Link bar under preview */}
            {publicUrl && (
              <div className="mt-3 p-2.5 bg-[#10131b] border border-white/8 rounded-2xl flex items-center justify-between gap-2 max-w-[360px] mx-auto">
                <span className="text-[11px] text-slate-400 truncate">{publicUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                    toast.success("បានចម្លងតំណភ្ជាប់!");
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-bold shrink-0 transition-colors"
                >
                  ចម្លង Link
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
