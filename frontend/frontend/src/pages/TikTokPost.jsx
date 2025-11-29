import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Download, Send, Loader2, Video } from "lucide-react";

const TikTokPost = () => {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePreview = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate loading for now
        setTimeout(() => setLoading(false), 1000);
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-cyan-500 bg-clip-text text-transparent">
                    TikTok Link Post
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Paste a TikTok URL to download and schedule it to Facebook.
                </p>
            </div>

            {/* Input Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                <form onSubmit={handlePreview} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste TikTok URL here (e.g., https://www.tiktok.com/@user/video/...)"
                        className="block w-full pl-11 pr-32 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading || !url}
                        className="absolute right-2 top-2 bottom-2 px-6 bg-gray-900 dark:bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                        Load
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TikTokPost;
