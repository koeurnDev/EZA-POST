// ============================================================
// 🤖 BotSettingsPage.jsx — Auto-Reply Bot Page
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import BotReplySettings from "../components/BotReplySettings";
import { useAuth } from "../hooks/useAuth";

export default function BotSettingsPage() {
    const { user } = useAuth();
    const [isDemo, setIsDemo] = useState(false);

    // ✅ Initialize Demo Mode
    useEffect(() => {
        if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
            setIsDemo(true);
        }
    }, [user]);

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Auto-Reply Bot
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Configure automated replies for your post comments.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <BotReplySettings isDemo={isDemo} />
            </div>
        </DashboardLayout>
    );
}
