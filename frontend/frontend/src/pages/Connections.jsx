import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Youtube, Facebook, Instagram, Video, Check, X, Link as LinkIcon, ExternalLink } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function Connections() {
    const [connections, setConnections] = useState({
        youtube: false,
        tiktok: false,
        instagram: false
    });
    const [loading, setLoading] = useState(true);

    // 🔄 Fetch Status
    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const res = await api.get("/user/connections");
                if (res.data.success) {
                    setConnections(res.data.connections);
                }
            } catch (err) {
                console.error("Failed to load connections:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchConnections();
    }, []);

    // 🔗 Handle Connect
    const handleConnect = async (platform) => {
        if (platform === 'youtube' || platform === 'tiktok' || platform === 'instagram') {
            try {
                // 1. Get Auth URL from Backend
                const res = await api.get(`/auth/${platform}`);
                if (res.data.success && res.data.url) {
                    window.location.href = res.data.url; // 🚀 Redirect
                }
            } catch (err) {
                toast.error(`Failed to connect to ${platform}`);
            }
        }
    };

    const ConnectionCard = ({ name, icon: Icon, color, isConnected }) => (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color} text-white`}>
                    <Icon size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white capitalize">{name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                        {isConnected ? (
                            <span className="text-green-500 flex items-center gap-1"><Check size={12} /> Connected</span>
                        ) : (
                            <span className="text-gray-400">Not connected</span>
                        )}
                    </p>
                </div>
            </div>
            <button
                onClick={() => handleConnect(name)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${isConnected
                    ? "bg-red-50 text-red-500 hover:bg-red-100"
                    : "bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black"
                    }`}
            >
                {isConnected ? "Disconnect" : "Connect"}
            </button>
        </div>
    );

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <LinkIcon size={24} className="text-blue-500" />
                    Platform Connections
                </h1>
                <p className="text-gray-500 mb-8">Connect your social accounts to enable cross-platform posting.</p>

                <div className="grid grid-cols-1 gap-4">
                    <ConnectionCard
                        name="youtube"
                        icon={Youtube}
                        color="bg-red-600"
                        isConnected={connections.youtube}
                    />
                    <ConnectionCard
                        name="tiktok"
                        icon={Video}
                        color="bg-black"
                        isConnected={connections.tiktok}
                    />
                    <ConnectionCard
                        name="instagram"
                        icon={Instagram}
                        color="bg-pink-600"
                        isConnected={connections.instagram}
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
