import React from 'react';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;
import DashboardLayout from '../layouts/DashboardLayout';
import { Rocket, Sparkles, Activity, Timer } from 'lucide-react';

const ComingSoon = () => {
    return (
        <DashboardLayout>
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -z-10" />

                <MotionDiv
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center max-w-2xl mx-auto"
                >
                    <MotionDiv
                        animate={{
                            y: [0, -30, 0],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="inline-block mb-12 relative"
                    >
                        <div className="absolute inset-0 bg-blue-500 blur-[40px] opacity-20 animate-pulse" />
                        <div className="w-32 h-32 bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10">
                            <Rocket className="w-16 h-16 text-blue-600" />
                        </div>
                        <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 animate-bounce">
                            <Sparkles size={20} />
                        </div>
                    </MotionDiv>

                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                            System Expansion
                        </div>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white mb-8 tracking-tighter uppercase italic leading-[0.9]">
                        Under <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Construction.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-md mx-auto">
                        This module is currently being optimized for high-performance network orchestration.
                    </p>

                    <div className="mt-16 flex items-center justify-center gap-8">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center text-gray-400">
                                <Activity size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Optimizing</span>
                        </div>
                        <div className="w-px h-10 bg-gray-100 dark:bg-white/5" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center text-gray-400">
                                <Timer size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ETA: Q3 2026</span>
                        </div>
                    </div>

                    <div className="mt-16 flex justify-center gap-3">
                        {[0, 1, 2].map((i) => (
                            <MotionDiv
                                key={i}
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.3, 1, 0.3]
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    delay: i * 0.3
                                }}
                                className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                            />
                        ))}
                    </div>
                </MotionDiv>
            </div>
        </DashboardLayout>
    );
};

export default ComingSoon;
