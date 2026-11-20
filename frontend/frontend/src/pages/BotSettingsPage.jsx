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

    useEffect(() => {
        if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
            setIsDemo(true);
        }
    }, [user]);

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto pb-12">
                <div className="mb-5">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-khmer">
                        Bot ឆ្លើយតបខមិន &amp; Inbox ស្វ័យប្រវត្តិ
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-khmer">
                        កំណត់ឱ្យប្រព័ន្ធជួយឆ្លើយខមិន និងផ្ញើសារចូល Messenger Inbox ភ្ញៀវដោយស្វ័យប្រវត្តិ ២៤ ម៉ោង
                    </p>
                </div>

                <BotReplySettings isDemo={isDemo} />
            </div>
        </DashboardLayout>
    );
}
