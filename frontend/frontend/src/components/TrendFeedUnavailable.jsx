import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AlertCircle, Search } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";

export default function TrendFeedUnavailable({ title, description }) {
    return (
        <DashboardLayout>
            <motion.main
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center"
            >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
                    <AlertCircle size={32} />
                </div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-amber-500">
                    Temporarily unavailable
                </p>
                <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white md:text-5xl">
                    {title}
                </h1>
                <p className="mt-5 max-w-xl text-sm leading-7 text-gray-500 dark:text-gray-400 md:text-base">
                    {description} We do not currently have a supported source for this data, so no live trends are shown.
                </p>
                <Link
                    to="/tools/tiktok"
                    className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                    <Search size={17} />
                    Open TikTok Downloader
                </Link>
            </motion.main>
        </DashboardLayout>
    );
}
