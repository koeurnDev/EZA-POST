// ============================================================
// 📱 PublicBio.jsx - Public Digital Business Card & Storefront
// Modeled after Noonlai.com + Enhanced with Bakong KHQR & Direct Telegram Order
// ============================================================

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { 
  Phone, Send, MessageCircle, MapPin, ExternalLink, 
  Clock, CheckCircle, QrCode, ShoppingBag, Eye, 
  Download, Copy, Check, ChevronRight, Share2, 
  Sparkles, Coffee, Globe, ArrowLeft, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import QRCodeLib from "qrcode";
import api from "../utils/api";

const THEMES = {
  dark: {
    bg: "bg-[#090b10]",
    card: "bg-white/5 border-white/10 text-white",
    cardHover: "hover:bg-white/10",
    textPrimary: "text-white",
    textSecondary: "text-gray-400",
    accent: "from-blue-600 to-indigo-600",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  emerald: {
    bg: "bg-[#04130e]",
    card: "bg-emerald-950/40 border-emerald-500/20 text-emerald-50",
    cardHover: "hover:bg-emerald-900/50",
    textPrimary: "text-emerald-100",
    textSecondary: "text-emerald-300/70",
    accent: "from-emerald-500 to-teal-600",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    glow: "rgba(16, 185, 129, 0.15)",
  },
  sunset: {
    bg: "bg-[#140618]",
    card: "bg-purple-950/40 border-pink-500/20 text-pink-50",
    cardHover: "hover:bg-pink-900/40",
    textPrimary: "text-pink-100",
    textSecondary: "text-pink-300/70",
    accent: "from-pink-500 to-orange-500",
    badge: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    glow: "rgba(236, 72, 153, 0.15)",
  },
  coffee: {
    bg: "bg-[#120b06]",
    card: "bg-amber-950/30 border-amber-600/20 text-amber-50",
    cardHover: "hover:bg-amber-900/40",
    textPrimary: "text-amber-100",
    textSecondary: "text-amber-300/70",
    accent: "from-amber-600 to-yellow-600",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    glow: "rgba(217, 119, 6, 0.15)",
  },
  minimal: {
    bg: "bg-[#f8fafc]",
    card: "bg-white border-gray-200 text-gray-900 shadow-sm",
    cardHover: "hover:bg-gray-50 shadow-md",
    textPrimary: "text-gray-900",
    textSecondary: "text-gray-500",
    accent: "from-gray-900 to-black",
    badge: "bg-gray-100 text-gray-800 border-gray-200",
    glow: "rgba(0, 0, 0, 0.05)",
  },
};

export default function PublicBio({ previewData = null }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(previewData);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showKhqrModal, setShowKhqrModal] = useState(false);
  const [pageQrDataUrl, setPageQrDataUrl] = useState("");
  const [khqrDataUrl, setKhqrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Load bio page if not in preview mode
  useEffect(() => {
    if (previewData) {
      setPage(previewData);
      setLoading(false);
      return;
    }

    if (!slug) return;

    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const isPreview = searchParams.get("preview") === "true";
        const res = await api.get(`/bio/public/${slug}${isPreview ? "?preview=true" : ""}`);
        if (res.data.success && res.data.bioPage) {
          setPage(res.data.bioPage);
        } else {
          setError(res.data.error || "រកមិនឃើញទំព័រអាជីវកម្មនេះទេ");
        }
      } catch (err) {
        setError(err.response?.data?.error || "មិនអាចទាញយកព័ត៌មានអាជីវកម្មបានទេ");
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug, previewData, searchParams]);

  // Track click events
  const trackInteraction = async (type, target) => {
    if (previewData || !slug) return;
    try {
      await api.post(`/bio/public/${slug}/track`, { type, target });
    } catch {
      // Non-blocking telemetry
    }
  };

  // Generate Page QR Code for sharing
  useEffect(() => {
    const currentUrl = window.location.href.split("?")[0];
    QRCodeLib.toDataURL(currentUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => setPageQrDataUrl(url))
      .catch(() => {});
  }, [slug]);

  // Generate KHQR Data URL if KHQR string provided
  useEffect(() => {
    if (page?.khqrString) {
      QRCodeLib.toDataURL(page.khqrString, {
        width: 400,
        margin: 2,
        color: {
          dark: "#d91e18", // Bakong Red
          light: "#ffffff",
        },
      })
        .then((url) => setKhqrDataUrl(url))
        .catch(() => {});
    }
  }, [page?.khqrString]);

  // Live Real-Time Phnom Penh Business Hours Status (Open/Closed)
  const businessStatus = useMemo(() => {
    if (!page?.businessHours) {
      return { isOpen: true, label: "កំពុងបើក (Open Now)", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    }

    const { openTime = "08:00", closeTime = "21:00", days = [], alwaysOpen = false } = page.businessHours;

    if (alwaysOpen) {
      return { isOpen: true, label: "កំពុងបើក ២៤ ម៉ោង (Open 24/7)", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    }

    // Phnom Penh UTC+7 current time
    const now = new Date();
    const ppTimeStr = now.toLocaleTimeString("en-US", { timeZone: "Asia/Phnom_Penh", hour12: false, hour: "2-digit", minute: "2-digit" });
    const ppDayStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Phnom_Penh", weekday: "short" }).toLowerCase();

    const allowedDays = days.length > 0 ? days : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const isDayMatch = allowedDays.includes(ppDayStr);

    if (!isDayMatch) {
      return { isOpen: false, label: "ថ្ងៃនេះបិទ (Closed Today)", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
    }

    const isOpen = ppTimeStr >= openTime && ppTimeStr <= closeTime;
    return {
      isOpen,
      label: isOpen ? `កំពុងបើក • បិទម៉ោង ${closeTime}` : `បិទ • បើកម៉ោង ${openTime}`,
      color: isOpen 
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" 
        : "text-amber-400 bg-amber-500/10 border-amber-500/30",
    };
  }, [page?.businessHours]);

  // Theme styling
  const theme = THEMES[page?.theme] || THEMES.dark;

  // Clean Telegram link
  const getTelegramLink = (tg) => {
    if (!tg) return null;
    if (tg.startsWith("http")) return tg;
    const clean = tg.replace("@", "").trim();
    return `https://t.me/${clean}`;
  };

  // Clean WhatsApp link
  const getWhatsAppLink = (wa) => {
    if (!wa) return null;
    if (wa.startsWith("http")) return wa;
    const clean = wa.replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}`;
  };

  // YouTube embed URL parser
  const getYouTubeEmbedUrl = (yt) => {
    if (!yt) return null;
    try {
      let id = "";
      if (yt.includes("youtu.be/")) {
        id = yt.split("youtu.be/")[1]?.split("?")[0];
      } else if (yt.includes("watch?v=")) {
        id = new URL(yt).searchParams.get("v");
      } else if (yt.includes("shorts/")) {
        id = yt.split("shorts/")[1]?.split("?")[0];
      }
      return id ? `https://www.youtube.com/embed/${id}` : null;
    } catch {
      return null;
    }
  };

  // Share handler
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: page?.businessName || "Digital Business Card",
          text: page?.bio || "Visit our digital business card & menu!",
          url: window.location.href,
        });
      } catch {
        // User dismissed
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("បានចម្លងតំណភ្ជាប់ (Link Copied)!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b10] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-400 font-medium">កំពុងផ្ទុកកាតអាជីវកម្ម...</p>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-[#090b10] flex flex-col items-center justify-center text-white px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 text-2xl font-bold">
          !
        </div>
        <h1 className="text-xl md:text-2xl font-black mb-2">{error || "រកមិនឃើញទំព័រអាជីវកម្មទេ"}</h1>
        <p className="text-gray-400 text-sm max-w-md mb-6">
          សូមពិនិត្យមើលអក្ខរាវិរុទ្ធនៃតំណភ្ជាប់ (URL handle) ម្តងទៀត ឬបង្កើតកាតអាជីវកម្មផ្ទាល់ខ្លួនរបស់អ្នក។
        </p>
        <a
          href="/post"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <ArrowLeft size={16} /> ត្រឡប់ទៅទំព័រដើម
        </a>
      </div>
    );
  }

  const contacts = page.contacts || {};
  const products = Array.isArray(page.products) ? page.products : [];
  const youtubeEmbed = getYouTubeEmbedUrl(page.youtubeUrl);
  const telegramUrl = getTelegramLink(contacts.telegram);
  const whatsappUrl = getWhatsAppLink(contacts.whatsapp);

  return (
    <div className={`min-h-screen ${theme.bg} selection:bg-blue-500 selection:text-white transition-colors duration-500 pb-16`}>
      {/* Top Floating Action Bar */}
      <div className="fixed top-3 right-3 z-30 flex items-center gap-2">
        <button
          onClick={() => setShowQrModal(true)}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
          title="ទាញយក QR Code ហាង"
        >
          <QrCode size={18} />
        </button>
        <button
          onClick={handleShare}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
          title="ចែករំលែក (Share)"
        >
          {copied ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
        </button>
      </div>

      <div className="max-w-md mx-auto min-h-screen relative shadow-2xl flex flex-col">
        {/* 🖼️ Cover Header */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gradient-to-br from-gray-800 to-gray-950">
          {page.coverUrl ? (
            <img
              src={page.coverUrl}
              alt={page.businessName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-r ${theme.accent} opacity-40`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b10] via-transparent to-black/30" />
        </div>

        {/* 🏬 Shop Identity Section */}
        <div className="px-5 -mt-16 relative z-10 flex flex-col items-center text-center">
          {/* Logo Avatar */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-3xl p-1 bg-gradient-to-br from-white/30 to-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden shrink-0">
              {page.avatarUrl ? (
                <img
                  src={page.avatarUrl}
                  alt={page.businessName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${theme.accent} flex items-center justify-center text-white text-3xl font-black`}>
                  {page.businessName?.charAt(0) || "B"}
                </div>
              )}
            </div>
            {/* Verified Badge */}
            <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-full shadow-lg border-2 border-[#090b10]">
              <CheckCircle size={16} className="fill-blue-600 text-white" />
            </div>
          </div>

          {/* Shop Title & Category */}
          <h1 className={`text-2xl sm:text-3xl font-black mt-3 ${theme.textPrimary} tracking-tight`}>
            {page.businessName}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${theme.badge}`}>
              {page.category || "អាជីវកម្មទូទៅ"}
            </span>

            {/* Live Real-time Business Hours Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${businessStatus.color}`}>
              <span className={`w-2 h-2 rounded-full ${businessStatus.isOpen ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{businessStatus.label}</span>
            </div>
          </div>

          {/* Bio / Slogan */}
          {page.bio && (
            <p className={`text-sm mt-3.5 leading-relaxed max-w-sm ${theme.textSecondary}`}>
              {page.bio}
            </p>
          )}

          {/* Physical Address & Google Maps Direction */}
          {(page.address || page.googleMapsUrl) && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400 max-w-sm">
              <MapPin size={14} className="text-red-400 shrink-0" />
              <span className="truncate">{page.address || "ទីតាំងហាង"}</span>
              {page.googleMapsUrl && (
                <a
                  href={page.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackInteraction("click", "google_maps")}
                  className="text-blue-400 hover:underline font-bold inline-flex items-center gap-0.5 shrink-0 ml-1"
                >
                  ផែនទី <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* 🇰🇭 KHQR Scan-to-Pay Banner (Superior to Noonlai!) */}
        {(page.khqrString || page.khqrImage) && (
          <div className="px-5 mt-5">
            <button
              onClick={() => {
                setShowKhqrModal(true);
                trackInteraction("qr_scan", "khqr");
              }}
              className="w-full relative group overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-xl shadow-red-600/25 active:scale-[0.98] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-12 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-md">
                  <div className="w-full h-full bg-red-600 rounded-lg flex flex-col items-center justify-center text-[8px] font-black leading-tight text-white uppercase">
                    <span>KH</span>
                    <span className="text-[7px]">QR</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-wide flex items-center gap-1.5">
                    ស្កេនទូទាត់ Bakong KHQR
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase font-bold">Free</span>
                  </h4>
                  <p className="text-xs text-red-100">
                    {page.khqrAccountName || page.khqrBankName || "គាំទ្រគ្រប់កម្មវិធីធនាគារទាំងអស់"}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-white/80 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* 📞 Contact & Direct CTA Buttons Grid */}
        <div className="px-5 mt-5 space-y-2.5">
          {contacts.phone && (
            <a
              href={`tel:${contacts.phone.replace(/[^0-9+]/g, "")}`}
              onClick={() => trackInteraction("click", "phone")}
              className={`w-full p-3.5 rounded-2xl border ${theme.card} ${theme.cardHover} transition-all flex items-center justify-between group active:scale-[0.99]`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Phone size={18} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">ទូរស័ព្ទទំនាក់ទំនង (Call Now)</div>
                  <div className="text-xs text-gray-400">{contacts.phone}</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
            </a>
          )}

          {telegramUrl && (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackInteraction("click", "telegram")}
              className={`w-full p-3.5 rounded-2xl border ${theme.card} ${theme.cardHover} transition-all flex items-center justify-between group active:scale-[0.99]`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Send size={18} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">Telegram Chat / Order</div>
                  <div className="text-xs text-gray-400">ផ្ញើសារកុម្ម៉ង់ផ្ទាល់តាម Telegram</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
            </a>
          )}

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackInteraction("click", "whatsapp")}
              className={`w-full p-3.5 rounded-2xl border ${theme.card} ${theme.cardHover} transition-all flex items-center justify-between group active:scale-[0.99]`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">WhatsApp</div>
                  <div className="text-xs text-gray-400">ផ្ញើសារតាម WhatsApp</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
            </a>
          )}

          {/* Social Row: Facebook & TikTok & Website */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {contacts.facebook && (
              <a
                href={contacts.facebook.startsWith("http") ? contacts.facebook : `https://facebook.com/${contacts.facebook}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackInteraction("click", "facebook")}
                className={`p-3 rounded-2xl border ${theme.card} ${theme.cardHover} flex flex-col items-center justify-center gap-1.5 transition-all text-center`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-600/20 text-blue-500 flex items-center justify-center">
                  <span className="font-black text-sm">f</span>
                </div>
                <span className="text-[11px] font-bold truncate max-w-full">Facebook</span>
              </a>
            )}

            {contacts.tiktok && (
              <a
                href={contacts.tiktok.startsWith("http") ? contacts.tiktok : `https://tiktok.com/@${contacts.tiktok.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackInteraction("click", "tiktok")}
                className={`p-3 rounded-2xl border ${theme.card} ${theme.cardHover} flex flex-col items-center justify-center gap-1.5 transition-all text-center`}
              >
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center">
                  <span className="font-black text-xs">Tik</span>
                </div>
                <span className="text-[11px] font-bold truncate max-w-full">TikTok</span>
              </a>
            )}

            {contacts.website && (
              <a
                href={contacts.website.startsWith("http") ? contacts.website : `https://${contacts.website}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackInteraction("click", "website")}
                className={`p-3 rounded-2xl border ${theme.card} ${theme.cardHover} flex flex-col items-center justify-center gap-1.5 transition-all text-center`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Globe size={16} />
                </div>
                <span className="text-[11px] font-bold truncate max-w-full">Website</span>
              </a>
            )}
          </div>
        </div>

        {/* 📺 Embedded YouTube Video Showcase (Noonlai Feature) */}
        {youtubeEmbed && (
          <div className="px-5 mt-6">
            <h3 className={`text-sm font-bold mb-2.5 flex items-center gap-2 ${theme.textPrimary}`}>
              <Sparkles size={16} className="text-amber-400" />
              <span>វីដេអូណែនាំ / កម្មវិធីពិសេស</span>
            </h3>
            <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
              <iframe
                src={youtubeEmbed}
                title={page.businessName}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* 🛍️ Product Catalog / Menu Showcase (Noonlai + Telegram Direct Order) */}
        {products.length > 0 && (
          <div className="px-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-base font-black flex items-center gap-2 ${theme.textPrimary}`}>
                <ShoppingBag size={18} className="text-pink-500" />
                <span>មុខទំនិញ & ម៉ឺនុយ ({products.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {products.map((item, index) => {
                const orderText = encodeURIComponent(
                  `សួស្តី! ខ្ញុំចង់កុម្ម៉ង់ទិញ៖ "${item.name}" (តម្លៃ: ${item.price} ${item.currency || "$"}) ពីកាតអាជីវកម្ម ${page.businessName}`
                );
                const itemOrderUrl = item.orderLink || (telegramUrl ? `${telegramUrl}?text=${orderText}` : null);

                return (
                  <div
                    key={item.id || index}
                    className={`rounded-2xl border ${theme.card} p-3 flex gap-3.5 transition-all`}
                  >
                    {item.imageUrl && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-white truncate">
                            {item.name}
                          </h4>
                          <span className="font-black text-sm text-emerald-400 shrink-0">
                            {item.price} {item.currency || "$"}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between pt-1">
                        <span className="text-[10px] text-gray-500 font-medium">
                          {item.isAvailable !== false ? "✅ មានក្នុងស្តុក" : "❌ អស់ពីស្តុក"}
                        </span>
                        {itemOrderUrl && item.isAvailable !== false && (
                          <a
                            href={itemOrderUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => trackInteraction("click", `product_${item.name}`)}
                            className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <span>កុម្ម៉ង់</span>
                            <Send size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🦶 Footer & Powered By EZA POST */}
        <div className="mt-12 text-center text-xs text-gray-500 px-5 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Eye size={12} />
            <span>{page.views || 1} ទស្សនា (Views)</span>
          </div>
          <div className="pt-2 border-t border-white/10">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white font-medium transition-colors"
            >
              <span>បង្កើតកាតអាជីវកម្មជាមួយ</span>
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                EZA POST
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* 🏷️ QR Code Modal (For printing & sharing) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-center text-white relative shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <h3 className="font-black text-lg mb-1">{page.businessName}</h3>
            <p className="text-xs text-gray-400 mb-4">ស្កេនដើម្បីបើកកាតអាជីវកម្មឌីជីថល</p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              {pageQrDataUrl && (
                <img src={pageQrDataUrl} alt="Store QR" className="w-56 h-56 mx-auto" />
              )}
            </div>

            <div className="space-y-2">
              <a
                href={pageQrDataUrl}
                download={`${page.slug || "store"}-qr.png`}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
              >
                <Download size={16} /> ទាញយក QR Code (PNG)
              </a>
              <button
                onClick={handleShare}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <Copy size={14} /> ចម្លងតំណភ្ជាប់ (Copy Link)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🇰🇭 Bakong KHQR Modal */}
      {showKhqrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#150a0a] border border-red-500/30 rounded-3xl p-6 max-w-sm w-full text-center text-white relative shadow-2xl">
            <button
              onClick={() => setShowKhqrModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            {/* KHQR Header */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black mb-3 uppercase tracking-wider">
              <span>Bakong KHQR</span>
            </div>

            <h3 className="font-black text-lg mb-0.5">{page.khqrAccountName || page.businessName}</h3>
            <p className="text-xs text-red-300/80 mb-4">{page.khqrBankName || "ABA / ACLEDA / Wing / Bakong"}</p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl mb-4 border-4 border-red-600">
              {page.khqrImage ? (
                <img src={page.khqrImage} alt="KHQR" className="w-56 h-56 mx-auto object-contain" />
              ) : khqrDataUrl ? (
                <img src={khqrDataUrl} alt="KHQR" className="w-56 h-56 mx-auto" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-gray-500 text-xs">
                  KHQR Code
                </div>
              )}
            </div>

            <p className="text-xs text-gray-300 mb-4">
              ស្កេនទូទាត់ប្រាក់បានរហ័ស តាមរយៈគ្រប់ App ធនាគារទាំងអស់នៅកម្ពុជា
            </p>

            <div className="space-y-2">
              {(page.khqrImage || khqrDataUrl) && (
                <a
                  href={page.khqrImage || khqrDataUrl}
                  download={`khqr-${page.slug || "pay"}.png`}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all"
                >
                  <Download size={16} /> រក្សាទុក KHQR ក្នុងទូរស័ព្ទ
                </a>
              )}
              {page.khqrString && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(page.khqrString);
                    toast.success("បានចម្លងលេខកូដ KHQR!");
                  }}
                  className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={13} /> ចម្លង KHQR String
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

