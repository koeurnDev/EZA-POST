import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, BarChart3, Globe, Sparkles, Shield, Rocket, Activity, ChevronRight, Play } from "lucide-react";
import { motion } from "framer-motion";

const MotionDiv = motion.div;
const MotionH1 = motion.h1;
const MotionP = motion.p;
import Button from "../components/ui/Button";

export default function Welcome() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden selection:bg-blue-500 selection:text-white font-sans">
            
            {/* 🌟 Navigation */}
            <nav className="fixed top-0 w-full z-[100] bg-white/50 dark:bg-black/50 backdrop-blur-2xl border-b border-gray-100 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <Rocket className="text-white" size={20} />
                        </div>
                        <span className="text-2xl font-black tracking-tighter uppercase italic">
                            EZA<span className="text-blue-600">POST</span>
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-8">
                        <Link to="/login" className="hidden md:block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-blue-600 transition-colors">
                            Access Portal
                        </Link>
                        <Link to="/register">
                            <Button className="h-12 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* 🦸 Hero Section */}
            <section className="relative pt-40 pb-32 lg:pt-64 lg:pb-48 px-6 overflow-hidden">
                {/* Immersive Background */}
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                </div>

                <MotionDiv 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-7xl mx-auto text-center"
                >
                    <MotionDiv variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/5 border border-blue-500/10 rounded-full mb-10">
                        <Sparkles size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">The 2026 Engagement Standard</span>
                    </MotionDiv>

                    <MotionH1 variants={itemVariants} className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.85] mb-12 uppercase italic">
                        Network <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Dominance.</span>
                    </MotionH1>

                    <MotionP variants={itemVariants} className="text-lg md:text-2xl text-gray-400 max-w-3xl mx-auto mb-16 font-medium leading-relaxed">
                        Orchestrate your social ecosystem with high-fidelity automation, 
                        deep analytical insights, and cross-platform synchronization.
                    </MotionP>

                    <MotionDiv variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <Link to="/register" className="w-full sm:w-auto">
                            <Button className="h-20 px-12 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 w-full">
                                Establish Identity <ArrowRight className="ml-3" size={20} />
                            </Button>
                        </Link>
                        <button className="h-20 px-12 rounded-[2rem] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-sm font-black uppercase tracking-[0.2em] hover:bg-gray-100 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-3 w-full group">
                            <Play size={20} className="text-blue-600 fill-blue-600 group-hover:scale-110 transition-transform" /> 
                            System Demo
                        </button>
                    </MotionDiv>
                </MotionDiv>

                {/* Floating Mockup Preview */}
                <MotionDiv 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-6xl mx-auto mt-32 relative group"
                >
                    <div className="absolute inset-0 bg-blue-600/20 blur-[100px] -z-10 group-hover:bg-blue-600/30 transition-colors duration-1000" />
                    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-100 dark:border-white/10 rounded-[3rem] p-4 shadow-2xl shadow-black/20">
                        <div className="bg-gray-50 dark:bg-black/50 rounded-[2.5rem] aspect-video flex items-center justify-center relative overflow-hidden">
                            {/* Dashboard Elements Mockup */}
                            <div className="absolute inset-0 p-12 grid grid-cols-12 gap-8">
                                <div className="col-span-3 space-y-6">
                                    <div className="h-12 w-full bg-blue-600/10 rounded-2xl border border-blue-600/20" />
                                    <div className="h-40 w-full bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl" />
                                    <div className="h-40 w-full bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl" />
                                </div>
                                <div className="col-span-6 space-y-6">
                                    <div className="h-64 w-full bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] shadow-2xl p-8 flex flex-col justify-end">
                                        <div className="h-4 w-32 bg-white/20 rounded-full mb-3" />
                                        <div className="h-8 w-64 bg-white/40 rounded-full" />
                                    </div>
                                    <div className="h-64 w-full bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl" />
                                </div>
                                <div className="col-span-3 space-y-6">
                                    <div className="h-96 w-full bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl" />
                                    <div className="h-32 w-full bg-emerald-500/10 rounded-2xl border border-emerald-500/20" />
                                </div>
                            </div>
                        </div>
                    </div>
                </MotionDiv>
            </section>

            {/* 🍱 Features Section */}
            <section className="py-32 bg-gray-50 dark:bg-black/40 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
                        <div>
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4">Core Architecture</p>
                            <h2 className="text-6xl font-black tracking-tighter uppercase italic">Engineered for <br /><span className="text-gray-400">Excellence.</span></h2>
                        </div>
                        <p className="text-gray-500 max-w-sm font-medium">A unified orchestration layer designed to elevate your digital presence across every platform.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: Zap, label: 'Performance', title: "Hyper-Fast Distribution", desc: "Propagate your content across global networks with zero latency and maximum throughput.", color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                            { icon: Activity, label: 'Analytics', title: "Neural Insights", desc: "Gain deep algorithmic understanding of your audience behavior with real-time feedback loops.", color: 'text-blue-500', bg: 'bg-blue-500/10' },
                            { icon: Globe, label: 'Global', title: "Cross-Grid Sync", desc: "Simultaneous orchestration of TikTok, Facebook, and Instagram identities from a single core.", color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
                        ].map((feature, i) => (
                            <MotionDiv
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-sm border border-gray-100 dark:border-white/5 group hover:shadow-2xl hover:shadow-black/5 transition-all duration-500"
                            >
                                <div className={`w-14 h-14 ${feature.bg} ${feature.color} rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform`}>
                                    <feature.icon size={28} />
                                </div>
                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${feature.color}`}>{feature.label}</p>
                                <h3 className="text-2xl font-black tracking-tight mb-4 text-gray-900 dark:text-white">{feature.title}</h3>
                                <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                    {feature.desc}
                                </p>
                            </MotionDiv>
                        ))}
                    </div>
                </div>
            </section>

            {/*  CTA Section */}
            <section className="py-32 px-6">
                <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[4rem] p-16 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-600/40">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                    <MotionDiv 
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        className="relative z-10"
                    >
                        <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-8 italic">Ready for <br />Lift Off?</h2>
                        <p className="text-xl text-blue-100/80 mb-12 max-w-xl mx-auto font-medium">Join the elite network of creators and businesses dominating the 2026 digital landscape.</p>
                        <Link to="/register">
                            <Button variant="secondary" className="h-20 px-16 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] bg-white text-blue-600 hover:bg-gray-100 shadow-2xl">
                                Initialize Account
                            </Button>
                        </Link>
                    </MotionDiv>
                </div>
            </section>

            {/* 🦶 Footer */}
            <footer className="py-20 border-t border-gray-100 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Rocket className="text-white" size={16} />
                        </div>
                        <span className="text-lg font-black tracking-tighter uppercase italic">EZA<span className="text-blue-600">POST</span></span>
                    </div>
                    
                    <div className="flex items-center gap-8">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">© 2026 EZA_POST GLOBAL CONGLOMERATE</p>
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Systems Online</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
