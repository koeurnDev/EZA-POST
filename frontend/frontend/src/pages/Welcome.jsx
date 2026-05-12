import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../utils/api";
import { ArrowRight, Zap, BarChart3, Globe, Sparkles, Shield, Rocket, Activity, ChevronRight, Play, CheckCircle2, MessageSquare, Clock, Share2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Welcome() {
    const MotionDiv = motion.div;
    const MotionH1 = motion.h1;
    const MotionP = motion.p;
    const MotionSection = motion.section;
    const [tiktokLink, setTiktokLink] = useState("");
    const [previewVideo, setPreviewVideo] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState("");
    const navigate = useNavigate();
    const { user } = useAuth();

    const isValidTikTokLink = tiktokLink.trim() && (tiktokLink.includes("tiktok.com") || tiktokLink.includes("vt.tiktok.com"));

    const handleTikTokSaver = () => {
        if (!isValidTikTokLink) return;
        navigate(`/tools/tiktok?url=${encodeURIComponent(tiktokLink.trim())}`);
    };

    const handleTikTokPreview = async () => {
        if (!isValidTikTokLink) return;
        if (!user) {
            navigate('/login');
            return;
        }

        setPreviewLoading(true);
        setPreviewError("");
        setPreviewVideo(null);

        try {
            const res = await api.post('/tools/tiktok/lookup', { url: tiktokLink.trim() });
            if (res.data?.success) {
                setPreviewVideo(res.data.video);
            } else {
                setPreviewError(res.data?.error || 'Failed to preview TikTok link');
            }
        } catch (err) {
            setPreviewError(err.response?.data?.error || 'Preview failed. Please login and try again.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const fadeInUp = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2, delayChildren: 0.3 }
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-600 selection:text-white font-['Kantumruy_Pro']">
            
            {/* 🌌 Animated Background Elements */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.03] mix-blend-overlay" />
            </div>
            {/* 🌟 Navigation */}
            <nav className="fixed top-0 w-full z-[100] border-b border-white/5 backdrop-blur-xl bg-black/20">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
                    <MotionDiv 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 md:gap-3 group cursor-pointer"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    >
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:rotate-6 transition-transform duration-300">
                            <Zap className="text-white fill-white" size={16} md:size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg md:text-xl font-bold tracking-tight leading-none">EZA_POST</span>
                            <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-blue-500 font-black opacity-80">Social Orchestrator</span>
                        </div>
                    </MotionDiv>
                    
                    <div className="flex items-center gap-3 md:gap-6">
                        <Link to="/login" className="hidden sm:block text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                            ចូលគណនី
                        </Link>
                        <Link to="/register">
                            <MotionDiv
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
                            >
                                ចាប់ផ្តើម
                            </MotionDiv>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* 🦸 Hero Section */}
            <MotionSection 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={staggerContainer}
                className="relative pt-32 md:pt-44 pb-20 md:pb-32 px-4 md:px-6"
            >
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <MotionDiv variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6 md:mb-8">
                        <Sparkles size={12} md:size={14} className="text-blue-400" />
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-blue-400">គ្រប់គ្រងបណ្តាញសង្គមបែបឆ្លាតវៃ</span>
                    </MotionDiv>

                    <MotionH1 variants={fadeInUp} className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] mb-6 md:mb-8">
                        ផុសបានគ្រប់គ្នាដោយស្វ័យប្រវត្តិ
                    </MotionH1>

                    <MotionP variants={fadeInUp} className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-8 md:mb-12 font-medium leading-relaxed px-2">
                        កម្មវិធីគ្រប់គ្រងបណ្តាញសង្គមលេខ ១ នៅកម្ពុជា។ ជួយអ្នកក្នុងការទាញយកវីដេអូ កំណត់ពេលវេលាផុស និងឆ្លើយតប Comment ដោយស្វ័យប្រវត្តិ។
                    </MotionP>

                    <MotionDiv variants={fadeInUp} className="flex flex-row items-center justify-center gap-3 w-full max-w-md mx-auto px-2">
                        <Link to="/register" className="flex-1">
                            <div className="group relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-md opacity-20 group-hover:opacity-50 transition duration-500"></div>
                                <button className="relative h-14 px-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center gap-2 text-[10px] md:text-sm font-bold uppercase tracking-widest w-full border border-white/10 shadow-xl shadow-blue-900/20 active:scale-95 transition-transform">
                                    បង្កើតគណនី <ArrowRight size={14} className="hidden sm:block group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </Link>
                        <button className="flex-1 h-14 px-2 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md text-[10px] md:text-sm font-bold uppercase tracking-widest hover:bg-white/15 transition-all flex items-center justify-center gap-2 group active:scale-95">
                            <Play size={14} className="text-blue-500 fill-blue-500 group-hover:scale-110 transition-transform" /> 
                            វីដេអូណែនាំ
                        </button>
                    </MotionDiv>
                </div>

            </MotionSection>

            {/* 🎬 TikTok Saver Quick Access */}
            <section className="px-4 md:px-6 pb-20">
                <div className="max-w-6xl mx-auto bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-xl">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="min-w-0">
                            <p className="text-sm uppercase tracking-[0.3em] font-black text-pink-300 mb-3">TikTok Saver</p>
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">ដាក់ Link វីដេអូ TikTok នៅទីនេះ ដើម្បីទាញយកបានរហ័ស។</h2>
                            <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl">ប្រើពេលដូច TikTok Saver ពីទំព័រដើម។ ដាក់តំណភ្ជាប់ TikTok យ៉ាងត្រឹមត្រូវ ហើយចុច ទាញយក ដើម្បីបើកឧបករណ៍ទាញយក។</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto">
                            <input
                                value={tiktokLink}
                                onChange={(e) => {
                                    setTiktokLink(e.target.value);
                                    setPreviewVideo(null);
                                    setPreviewError("");
                                }}
                                placeholder="បិទភ្ជាប់ Link វីដេអូ TikTok..."
                                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/80 px-4 py-4 text-sm text-white placeholder:text-gray-500 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20"
                            />
                            <button
                                onClick={handleTikTokSaver}
                                disabled={!isValidTikTokLink}
                                className="h-14 rounded-2xl bg-pink-500 text-white font-bold uppercase tracking-widest text-sm px-6 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-pink-400"
                            >
                                ទាញយក
                            </button>
                            <button
                                onClick={handleTikTokPreview}
                                disabled={!isValidTikTokLink || previewLoading}
                                className="h-14 rounded-2xl bg-white/10 border border-white/20 text-white font-bold uppercase tracking-widest text-sm px-6 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20"
                            >
                                {previewLoading ? 'កំពុងបង្ហាញ...' : 'Preview'}
                            </button>
                        </div>
                    </div>

                    {previewError && (
                        <div className="mt-6 max-w-4xl mx-auto text-center text-sm text-red-400">
                            {previewError}
                        </div>
                    )}

                    {previewVideo && (
                        <div className="mt-8 max-w-4xl mx-auto bg-black/90 border border-white/10 rounded-[2rem] p-4 md:p-6">
                            <div className="grid gap-4 md:grid-cols-[320px_1fr] items-start">
                                <div className="rounded-3xl overflow-hidden bg-gray-900 border border-white/10">
                                    {previewVideo.previewUrl ? (
                                        <video
                                            src={previewVideo.previewUrl}
                                            controls
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                    ) : previewVideo.type === 'slideshow' || previewVideo.images?.length > 0 ? (
                                        <img src={previewVideo.images?.[0] || previewVideo.cover} alt="TikTok preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <video
                                            src={`${previewVideo.no_watermark_url || previewVideo.playUrl}`}
                                            controls
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                                <div className="space-y-4 text-left px-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.3em] text-pink-300 font-black mb-2">Preview</p>
                                        <h3 className="text-xl md:text-2xl font-bold text-white">{previewVideo.title || 'TikTok Video Preview'}</h3>
                                        <p className="mt-2 text-sm text-gray-300">@{previewVideo.author?.nickname || previewVideo.author?.unique_id || 'TikTok'}</p>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <span className="px-3 py-2 rounded-2xl bg-white/10 text-xs uppercase tracking-[0.25em] text-gray-200">{previewVideo.type?.toUpperCase() || 'VIDEO'}</span>
                                        <span className="px-3 py-2 rounded-2xl bg-white/10 text-xs uppercase tracking-[0.25em] text-gray-200">No watermark</span>
                                        <span className="px-3 py-2 rounded-2xl bg-white/10 text-xs uppercase tracking-[0.25em] text-gray-200">Direct preview</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={handleTikTokSaver}
                                            className="px-4 py-3 rounded-2xl bg-pink-500 text-white text-sm font-bold uppercase tracking-widest hover:bg-pink-400 transition"
                                        >
                                            Continue to Downloader
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPreviewVideo(null);
                                                setPreviewError("");
                                            }}
                                            className="px-4 py-3 rounded-2xl bg-white/10 text-white text-sm font-bold uppercase tracking-widest hover:bg-white/20 transition"
                                        >
                                            Clear Preview
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 🛠️ Features Grid */}
            <section className="py-32 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 px-4 leading-tight">តើ EZA_POST អាចធ្វើអ្វីបានខ្លះ?</h2>
                        <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto font-medium px-4">យើងផ្តល់ជូននូវឧបករណ៍ដ៏មានឥទ្ធិពលបំផុត ដើម្បីជួយឱ្យអាជីវកម្មរបស់អ្នករីកចម្រើន។</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { 
                                icon: Clock, 
                                title: "កំណត់ពេលវេលា", 
                                desc: "ផុសវីដេអូ TikTok ទៅកាន់ Facebook Page ដោយស្វ័យប្រវត្តិទៅតាមម៉ោងដែលអ្នកចង់បាន។",
                                color: "from-blue-500 to-cyan-500"
                            },
                            { 
                                icon: MessageSquare, 
                                title: "ឆ្លើយតប Comment", 
                                desc: "ប្រព័ន្ធឆ្លើយតប Comment ស្វ័យប្រវត្តិ (Auto-Reply) ជួយឱ្យអ្នកមិនខកខានរាល់អតិថិជន។",
                                color: "from-indigo-500 to-purple-500"
                            },
                            { 
                                icon: Share2, 
                                title: "ទាញយកវីដេអូ", 
                                desc: "ទាញយកវីដេអូពី TikTok, YouTube, Facebook និង Instagram ដោយគ្មាន Logo ក្នុងកម្រិត 4K។",
                                color: "from-purple-500 to-pink-500"
                            },
                            { 
                                icon: Shield, 
                                title: "សុវត្ថិភាពខ្ពស់", 
                                desc: "គណនីរបស់អ្នកត្រូវបានការពារដោយប្រព័ន្ធសុវត្ថិភាពកម្រិតខ្ពស់ និងការរក្សាការសម្ងាត់បំផុត។",
                                color: "from-emerald-500 to-teal-500"
                            }
                        ].map((feature, i) => (
                            <MotionDiv
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                whileHover={{ y: -10 }}
                                className="group relative bg-white/5 border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/10 transition-all duration-500"
                            >
                                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-black/20 group-hover:rotate-12 transition-transform`}>
                                    <feature.icon size={28} className="text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-base text-gray-400 leading-relaxed font-medium">{feature.desc}</p>
                            </MotionDiv>
                        ))}
                    </div>
                </div>
            </section>

            {/* 🚀 Stats Section */}
            <section className="py-20 border-y border-white/5 bg-white/2">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10">
                    {[
                        { label: "អ្នកប្រើប្រាស់", value: "5,000+" },
                        { label: "ផុសក្នុងមួយថ្ងៃ", value: "10,000+" },
                        { label: "Pages បានតភ្ជាប់", value: "2,500+" },
                        { label: "វីដេអូបានទាញយក", value: "100k+" }
                    ].map((stat, i) => (
                        <div key={i} className="text-center">
                            <p className="text-3xl md:text-5xl font-bold mb-2 text-blue-500">{stat.value}</p>
                            <p className="text-sm font-bold uppercase tracking-widest text-gray-500">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 💎 Final CTA */}
            <section className="py-32 px-6">
                <div className="max-w-5xl mx-auto relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-gradient-to-br from-[#0a0a0f] to-[#10101a] border border-white/10 rounded-[3rem] p-12 md:p-20 text-center overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.05] pointer-events-none" />
                        <MotionDiv
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-tight">រួចរាល់សម្រាប់ការផ្លាស់ប្តូរ?</h2>
                            <p className="text-base md:text-lg text-gray-400 mb-12 max-w-xl mx-auto font-medium px-4">ចុះឈ្មោះប្រើប្រាស់ឥឡូវនេះ ដើម្បីទទួលបានការសាកល្បងដោយឥតគិតថ្លៃ និងបង្កើនប្រសិទ្ធភាពការងាររបស់អ្នក។</p>
                            <Link to="/register">
                                <button className="h-16 px-12 bg-white text-black rounded-2xl text-sm md:text-base font-bold uppercase tracking-widest hover:bg-gray-200 transition-all shadow-xl shadow-white/5">
                                    ចុះឈ្មោះប្រើប្រាស់ Free
                                </button>
                            </Link>
                        </MotionDiv>
                    </div>
                </div>
            </section>

            {/* 🦶 Footer */}
            <footer className="py-12 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 text-gray-500">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Zap className="text-white fill-white" size={16} />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-white">EZA_POST</span>
                    </div>
                    
                    <div className="flex items-center gap-8">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 EZA_POST GLOBAL</p>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Systems Active</span>
                        </div>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes gradient-x {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-x {
                    background-size: 200% 200%;
                    animation: gradient-x 10s linear infinite;
                }
            `}</style>
        </div>
    );
}
