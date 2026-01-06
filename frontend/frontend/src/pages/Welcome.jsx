// ============================================================
// 🚀 Welcome.jsx — Landing Page (Responsive & Modern)
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion"; // eslint-disable-line no-unused-vars

import { ArrowRight, Zap, BarChart3, Globe } from "lucide-react";

export default function Welcome() {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden selection:bg-blue-500 selection:text-white">

            {/* 🌟 Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-2xl font-bold tracking-tighter">
                        <span className="text-3xl">🚀</span>
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            EZA_POST
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            className="hidden sm:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/register"
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* 🦸 Hero Section */}
            <section className="relative pt-24 pb-16 lg:pt-48 lg:pb-32 px-4 md:px-6">
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="inline-block py-1 px-3 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wide uppercase mb-6 border border-blue-100 dark:border-blue-800">
                            v2.0 is now live
                        </span>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                            Social Media Automation <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                                Reimagined.
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
                            Schedule posts, analyze performance, and engage with your audience across all platforms—from one beautiful dashboard.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                to="/register"
                                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-full transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/40 flex items-center justify-center gap-2"
                            >
                                Start Free Trial <ArrowRight size={20} />
                            </Link>
                            <Link
                                to="/login"
                                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-lg font-semibold rounded-full transition-all"
                            >
                                View Demo
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Background Gradients */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob" />
                    <div className="absolute top-20 right-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
                    <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
                </div>
            </section>

            {/* 🍱 Features Grid */}
            <section className="py-20 bg-gray-50 dark:bg-gray-800/50">
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Zap className="text-yellow-500" size={32} />,
                                title: "Lightning Fast",
                                desc: "Optimized for speed. Schedule hundreds of posts in minutes, not hours."
                            },
                            {
                                icon: <BarChart3 className="text-blue-500" size={32} />,
                                title: "Deep Analytics",
                                desc: "Get real-time insights into your audience growth and engagement metrics."
                            },
                            {
                                icon: <Globe className="text-emerald-500" size={32} />,
                                title: "Global Reach",
                                desc: "Publish content to TikTok, Facebook, Instagram, and more simultaneously."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                            >
                                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl w-fit">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 🦶 Footer */}
            <footer className="py-12 border-t border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                        <span className="text-xl">🚀</span> EZA_POST
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        © {new Date().getFullYear()} EZA_POST. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
