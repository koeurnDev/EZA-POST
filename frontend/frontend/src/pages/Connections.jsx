import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Youtube, Instagram, Video, Check, X, Link as LinkIcon, ExternalLink, ShieldCheck, Activity, ChevronRight, Globe, Lock, Zap, Shield, Share2 } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";

export default function Connections() {
    const [connections, setConnections] = useState({
        youtube: false,
        tiktok: false,
        instagram: false
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const res = await api.get("/user/connections");
                if (res.data.success) {
                    setConnections(res.data.connections);
                }
            } catch (err) {
                console.error("Failed to load connections:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchConnections();
    }, []);

    const handleConnect = async (platform) => {
        if (platform === 'youtube' || platform === 'tiktok' || platform === 'instagram') {
            try {
                const res = await api.get(`/auth/${platform}`);
                if (res.data.success && res.data.url) {
                    window.location.href = res.data.url;
                }
            } catch (err) {
                toast.error(`Protocol failure for ${platform}`);
            }
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin shadow-2xl shadow-blue-500/20" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse">Initializing Neural Handshakes</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            {/* Mesh Gradient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 dark:opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-600 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
                {/* Header Section */}
                <div className="mb-16">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                            Sync Protocol v2.0
                        </div>
                        <div className="h-px w-12 bg-emerald-500/20" />
                    </div>
                    <h1 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter mb-4">
                        Cross <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Sync.</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-lg max-w-2xl leading-relaxed">
                        Establish authorized identity handshakes for high-velocity, automated content orchestration across your digital networks.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {[
                        { id: 'youtube', name: 'YouTube Network', icon: Youtube, color: 'from-red-600 to-rose-700', isConnected: connections.youtube, desc: 'Authorize for precision automated Shorts & Video distribution with neural timing.' },
                        { id: 'tiktok', name: 'TikTok Network', icon: Video, color: 'from-gray-900 to-black dark:from-white dark:to-gray-200 dark:text-black', isConnected: connections.tiktok, desc: 'Synchronize your primary TikTok identity for viral automation and trend-surging protocols.' },
                        { id: 'instagram', name: 'Instagram Grid', icon: Instagram, color: 'from-orange-500 via-pink-600 to-purple-700', isConnected: connections.instagram, desc: 'Seamless Reel and Carousel orchestration with integrated aesthetic synchronization.' }
                    ].map((platform, idx) => (
                        <motion.div
                            key={platform.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="group relative overflow-hidden bg-white/60 dark:bg-black/40 backdrop-blur-2xl border border-white/20 dark:border-white/5 rounded-[3rem] p-10 shadow-2xl hover:shadow-emerald-500/5 transition-all duration-700"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                                <div className="flex items-center gap-8">
                                    <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center bg-gradient-to-br ${platform.color} text-white shadow-2xl transition-transform duration-700 group-hover:rotate-[5deg] group-hover:scale-110`}>
                                        <platform.icon size={48} strokeWidth={1.5} />
                                    </div>
                                    <div className="max-w-md">
                                        <div className="flex items-center gap-4 mb-2">
                                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{platform.name}</h3>
                                            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors duration-500 ${platform.isConnected ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/5 dark:border-white/10'}`}>
                                                {platform.isConnected ? 'Handshake Active' : 'Offline'}
                                            </div>
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{platform.desc}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <AnimatePresence mode="wait">
                                        {platform.isConnected ? (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key="connected"
                                            >
                                                <Button 
                                                    variant="secondary"
                                                    className="h-14 px-10 rounded-2xl text-[10px] font-black uppercase tracking-widest border-rose-500/20 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-xl hover:shadow-rose-600/20 group/btn"
                                                    onClick={() => handleConnect(platform.id)}
                                                >
                                                    <X size={16} className="mr-2 group-hover/btn:rotate-90 transition-transform" />
                                                    Terminate Link
                                                </Button>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key="disconnected"
                                            >
                                                <Button 
                                                    className="h-14 px-12 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-600/30 group/btn"
                                                    onClick={() => handleConnect(platform.id)}
                                                >
                                                    <Zap size={16} className="mr-2 group-hover/btn:scale-125 transition-transform" />
                                                    Initialize Handshake
                                                </Button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                            
                            {/* Animated background decoration */}
                            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${platform.color} opacity-[0.03] blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.07] transition-opacity duration-700`} />
                        </motion.div>
                    ))}
                </div>

                {/* Security Footer Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-16 relative overflow-hidden"
                >
                    <div className="bg-white/40 dark:bg-black/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/20 dark:border-white/5 flex flex-col md:flex-row items-center gap-10 shadow-2xl">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-[1.8rem] flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0 shadow-inner">
                            <ShieldCheck size={40} strokeWidth={1.5} />
                        </div>
                        <div className="text-center md:text-left">
                            <div className="flex items-center gap-3 mb-3 justify-center md:justify-start">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Neural Encryption Active</p>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <h4 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Encrypted Identity Proxy</h4>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-3xl">
                                All platform handshakes are executed via OAuth 2.0 encrypted protocols with biometric-level verification. We never store raw credentials. Your cross-platform identity is shielded by end-to-end cloud-scale encryption and randomized temporal proxies.
                            </p>
                        </div>
                        <div className="flex gap-4 shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                                <Lock size={20} />
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                                <Globe size={20} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}
