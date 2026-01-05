import React, { useState, useEffect } from "react";
import { Coins, TrendingUp, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../utils/api";

export default function CreditsDisplay() {
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCredits();
    }, []);

    const fetchCredits = async () => {
        try {
            const res = await api.get('/credits');
            if (res.data.success) {
                setCredits(res.data.credits);
            }
        } catch (err) {
            console.error('Failed to fetch credits:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white animate-pulse">
                <div className="h-16"></div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Coins size={24} />
                        <p className="text-sm opacity-90 font-medium">Available Credits</p>
                    </div>
                    <p className="text-4xl font-bold">{credits.toLocaleString()}</p>
                    <p className="text-xs opacity-75 mt-1">
                        <TrendingUp size={12} className="inline mr-1" />
                        1 credit = 1 boost action
                    </p>
                </div>
                <Link
                    to="/buy-credits"
                    className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-md"
                >
                    <ShoppingCart size={18} />
                    Buy Credits
                </Link>
            </div>
        </div>
    );
}
