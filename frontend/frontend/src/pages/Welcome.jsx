import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Zap, ArrowRight, Shield, Globe, Clock, MessageSquare, Share2, Sparkles, BarChart3, Users, Smartphone, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function Welcome() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 }
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-600 selection:text-white font-['Kantumruy_Pro']">
            
            {/* 🌌 Animated Background Elements */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] md:animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] md:animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.03] mix-blend-overlay" />
            </div>

            {/* 🌟 Navigation */}
            <nav className="fixed top-0 w-full z-[100] border-b border-white/5 backdrop-blur-xl bg-black/20">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 md:gap-3 group cursor-pointer"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    >
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:rotate-6 transition-transform duration-300">
                            <Zap className="text-white fill-white" size={16}  />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-lg md:text-xl font-bold tracking-tight leading-none text-white">EZA_POST</span>
                            <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-blue-500 font-black opacity-80">Social Orchestrator</span>
                        </div>
                    </motion.div>
                    
                    <div className="flex items-center gap-3 md:gap-6">
                        {!user ? (
                            <>
                                <Link to="/login" className="hidden sm:block text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                                    ចូលគណនី
                                </Link>
                                <Link to="/register">
                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
                                    >
                                        ចាប់ផ្តើម
                                    </motion.div>
                                </Link>
                            </>
                        ) : (
                            <Link to="/posts">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
                                >
                                    Dashboard
                                </motion.div>
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* 🦸 Hero Section */}
            <section className="relative pt-32 md:pt-52 pb-20 px-4 md:px-6">
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6 md:mb-8">
                        <Sparkles size={12}  className="text-blue-400" />
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">គ្រប់គ្រងបណ្តាញសង្គមបែបឆ្លាតវៃ</span>
                    </motion.div>

                    <motion.h1 
                        initial="hidden" animate="visible" transition={{ delay: 0.1 }} variants={fadeInUp} 
                        className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tighter leading-[1] mb-8"
                    >
                        បដិវត្តន៍ការគ្រប់គ្រង <br className="hidden md:block" /> 
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-600">បណ្តាញសង្គម</span> របស់អ្នក។
                    </motion.h1>

                    <motion.p 
                        initial="hidden" animate="visible" transition={{ delay: 0.2 }} variants={fadeInUp} 
                        className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed px-2"
                    >
                        EZA_POST ជួយអ្នកក្នុងការកំណត់ពេលវេលាផុស ឆ្លើយតបមតិយោបល់ និងគ្រប់គ្រងមាតិកា <br className="hidden md:block" /> ពីគ្រប់វេទិកាទាំងអស់ក្នុងកម្មវិធីតែមួយ។
                    </motion.p>

                    <motion.div 
                        initial="hidden" animate="visible" transition={{ delay: 0.3 }} variants={fadeInUp}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link to={user ? "/posts" : "/register"}>
                            <button className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-blue-600 text-white font-bold uppercase tracking-widest text-xs hover:bg-blue-500 shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 group">
                                ចាប់ផ្តើមឥឡូវនេះ
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                        <button className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
                            ស្វែងយល់បន្ថែម
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* 🛠️ Features Grid */}
            <section className="py-24 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">តើ EZA_POST អាចធ្វើអ្វីបានខ្លះ?</h2>
                        <p className="text-base text-gray-400 max-w-2xl mx-auto font-medium">យើងផ្តល់ជូននូវឧបករណ៍ដ៏មានឥទ្ធិពលបំផុត ដើម្បីជួយឱ្យអាជីវកម្មរបស់អ្នករីកចម្រើន។</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: Clock, title: "កំណត់ពេលវេលា", desc: "ផុសមាតិកាទៅកាន់ Facebook Page ដោយស្វ័យប្រវត្តិទៅតាមម៉ោងដែលអ្នកចង់បាន។", color: "from-blue-500 to-cyan-500" },
                            { icon: MessageSquare, title: "ឆ្លើយតប Comment", desc: "ប្រព័ន្ធឆ្លើយតប Comment ស្វ័យប្រវត្តិ (Auto-Reply) ជួយឱ្យអ្នកមិនខកខានរាល់អតិថិជន។", color: "from-indigo-500 to-purple-500" },
                            { icon: Share2, title: "គ្រប់គ្រងមាតិកា", desc: "ទាញយក និងគ្រប់គ្រងវីដេអូពី TikTok, YouTube, Instagram បានយ៉ាងងាយស្រួល។", color: "from-purple-500 to-pink-500" },
                            { icon: Shield, title: "សុវត្ថិភាពខ្ពស់", desc: "គណនីរបស់អ្នកត្រូវបានការពារដោយប្រព័ន្ធសុវត្ថិភាពកម្រិតខ្ពស់បំផុត។", color: "from-emerald-500 to-teal-500" },
                            { icon: BarChart3, title: "វិភាគទិន្នន័យ", desc: "ពិនិត្យមើលដំណើរការនៃផុសនីមួយៗរបស់អ្នកជាមួយនឹងរបាយការណ៍លម្អិត។", color: "from-orange-500 to-amber-500" },
                            { icon: Users, title: "គ្រប់គ្រងក្រុម", desc: "ធ្វើការងារជាក្រុមដោយចែកចាយសិទ្ធិគ្រប់គ្រងទៅកាន់សមាជិកផ្សេងៗ។", color: "from-rose-500 to-red-500" }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group relative bg-white/5 border border-white/10 p-10 rounded-[2.5rem] hover:bg-white/10 transition-all duration-500"
                            >
                                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-black/20 group-hover:rotate-12 transition-transform`}>
                                    <feature.icon size={28} className="text-white" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed font-medium">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 🚀 Stats Section */}
            <section className="py-20 border-y border-white/5 bg-white/2">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
                    {[
                        { label: "អ្នកប្រើប្រាស់", value: "5,000+" },
                        { label: "ផុសក្នុងមួយថ្ងៃ", value: "10,000+" },
                        { label: "Pages បានតភ្ជាប់", value: "2,500+" },
                        { label: "សុវត្ថិភាព", value: "100%" }
                    ].map((stat, i) => (
                        <div key={i}>
                            <p className="text-3xl md:text-5xl font-bold mb-2 text-blue-500">{stat.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{stat.label}</p>
                        </div>
                    ))}
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
        </div>
    );
}
