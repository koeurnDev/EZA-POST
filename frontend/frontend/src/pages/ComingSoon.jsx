import React from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../layouts/DashboardLayout';
import { Rocket } from 'lucide-react';

const ComingSoon = () => {
    return (
        <DashboardLayout>
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center max-w-lg mx-auto"
                >
                    <motion.div
                        animate={{
                            y: [0, -20, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="inline-block mb-8"
                    >
                        <div className="w-32 h-32 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Rocket className="w-16 h-16 text-white" />
                        </div>
                    </motion.div>

                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                        Coming Soon! 🚀
                    </h1>

                    <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                        We're working hard to bring you this amazing feature.
                        <br />
                        Stay tuned for something incredible!
                    </p>

                    <div className="mt-12 flex justify-center gap-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.5, 1, 0.5]
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2
                                }}
                                className="w-3 h-3 bg-blue-500 rounded-full"
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        </DashboardLayout>
    );
};

export default ComingSoon;
