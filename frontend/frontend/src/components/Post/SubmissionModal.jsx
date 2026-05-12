import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

const SubmissionModal = React.memo(({ isSubmitting, status }) => {
    if (!isSubmitting) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                />
                
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-[40px] p-8 md:p-12 overflow-hidden shadow-2xl"
                >
                    {/* Animated background patterns */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-shimmer" />
                    
                    <div className="relative z-10 flex flex-col items-center text-center">
                        {status.step === 'done' ? (
                            <div className="mb-8 p-6 rounded-full bg-green-500/10 border-2 border-green-500/20">
                                <CheckCircle2 className="w-16 h-16 text-green-500" />
                            </div>
                        ) : status.step === 'error' ? (
                            <div className="mb-8 p-6 rounded-full bg-red-500/10 border-2 border-red-500/20">
                                <AlertCircle className="w-16 h-16 text-red-500" />
                            </div>
                        ) : (
                            <div className="mb-8 relative">
                                <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Zap className="w-8 h-8 text-blue-500 animate-pulse" />
                                </div>
                            </div>
                        )}

                        <h3 className="text-2xl md:text-3xl font-black text-white mb-4 tracking-tight">
                            {status.step === 'done' ? "បេសកកម្មជោគជ័យ!" : 
                             status.step === 'error' ? "មានបញ្ហាបច្ចេកទេស!" : 
                             "កំពុងដំណើរការ..."}
                        </h3>
                        
                        <p className="text-white/40 text-lg mb-10 max-w-xs leading-relaxed">
                            {status.message}
                        </p>

                        {/* Progress Bar */}
                        <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/5">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${status.progress}%` }}
                                transition={{ type: "spring", stiffness: 50 }}
                            />
                        </div>
                        <div className="flex justify-between w-full text-[10px] uppercase font-black tracking-widest text-white/20">
                            <span>Status: {status.step}</span>
                            <span>{status.progress}% Complete</span>
                        </div>

                        <div className="mt-12 flex items-center gap-3 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <Shield size={16} className="text-blue-500/50" />
                            <span className="text-xs text-white/30 font-medium italic">
                                Safe & Secured by EZA Architecture
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
});

export default SubmissionModal;
