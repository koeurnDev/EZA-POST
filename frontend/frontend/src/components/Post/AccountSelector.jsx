import React, { useState, useMemo } from 'react';
import { Facebook, Plus, X } from 'lucide-react';

const AccountSelector = React.memo(({ user, selectedPages, setSelectedPages }) => {
    const [searchQuery, setSearchQuery] = useState("");

    const connectedPages = useMemo(() => {
        if (!user?.connectedPages) return [];
        let pages = user.connectedPages;
        if (typeof pages === 'string') try { pages = JSON.parse(pages) } catch { pages = [] }
        return pages;
    }, [user?.connectedPages]);

    const filteredPages = useMemo(() => {
        return connectedPages.filter(p => 
            p.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [connectedPages, searchQuery]);

    const togglePage = (id) => {
        setSelectedPages(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 mb-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-bold text-white mb-2">ជ្រើសរើសផេកសម្រាប់ផុស</h3>
                    <p className="text-sm text-white/40">អ្នកអាចជ្រើសរើសច្រើនផេកក្នុងពេលតែមួយ</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 font-bold text-sm">
                    <Facebook size={14} />
                    <span>{selectedPages.length} Selected</span>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ស្វែងរកផេករបស់អ្នក..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPages.map((page) => (
                    <button
                        key={page.id}
                        onClick={() => togglePage(page.id)}
                        className={`group relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                            selectedPages.includes(page.id)
                                ? "border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                                : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10"
                        }`}
                    >
                        <div className="relative">
                            <img
                                src={`https://graph.facebook.com/${page.id}/picture?type=normal`}
                                alt={page.name}
                                className={`w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                                    selectedPages.includes(page.id) ? "border-blue-400 scale-110" : "border-white/10"
                                }`}
                                onError={(e) => e.target.src = "https://www.facebook.com/images/profile/timeline/fb_blank_user_2x.png"}
                            />
                            {selectedPages.includes(page.id) && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#1a1a1a]">
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                            )}
                        </div>
                        <div className="text-left overflow-hidden">
                            <div className={`text-sm font-bold truncate ${selectedPages.includes(page.id) ? "text-white" : "text-white/60 group-hover:text-white"}`}>
                                {page.name}
                            </div>
                            <div className="text-[10px] text-white/30 uppercase font-black tracking-widest mt-0.5">
                                Facebook Page
                            </div>
                        </div>
                    </button>
                ))}

                <button className="flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-white/20 group-hover:text-white/40" />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-bold text-white/40">បន្ថែមផេកថ្មី</div>
                        <div className="text-[10px] text-white/20 uppercase font-black tracking-widest">Connect Facebook</div>
                    </div>
                </button>
            </div>
        </div>
    );
});

export default AccountSelector;
