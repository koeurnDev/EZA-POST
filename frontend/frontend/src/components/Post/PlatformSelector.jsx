import React from 'react';
import { Facebook, Youtube, Instagram, Zap } from 'lucide-react';

const PlatformSelector = React.memo(({ platforms, setPlatforms }) => {
    const togglePlatform = (id) => {
        setPlatforms(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const platformList = [
        { id: 'facebook', icon: Facebook, label: 'Facebook', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { id: 'youtube', icon: Youtube, label: 'YouTube', color: 'text-red-500', bg: 'bg-red-500/10' },
        { id: 'tiktok', icon: Zap, label: 'TikTok', color: 'text-pink-500', bg: 'bg-pink-500/10' },
        { id: 'instagram', icon: Instagram, label: 'Instagram', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            {platformList.map((p) => (
                <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border-2 transition-all duration-300 ${
                        platforms[p.id]
                            ? `border-${p.id === 'facebook' ? 'blue' : p.id === 'youtube' ? 'red' : 'pink'}-500/50 ${p.bg} shadow-lg shadow-${p.id === 'facebook' ? 'blue' : 'pink'}-500/10`
                            : "border-white/5 bg-white/5 hover:bg-white/10"
                    }`}
                >
                    <div className={`p-2 rounded-lg ${platforms[p.id] ? 'bg-white' : 'bg-white/5'}`}>
                        <p.icon size={18} className={platforms[p.id] ? p.color : "text-white/40"} />
                    </div>
                    <span className={`text-xs md:text-sm font-bold ${platforms[p.id] ? "text-white" : "text-white/40"}`}>
                        {p.label}
                    </span>
                </button>
            ))}
        </div>
    );
});

export default PlatformSelector;
