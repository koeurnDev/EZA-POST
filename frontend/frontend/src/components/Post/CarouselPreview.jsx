import React from 'react';
import { Share2, MessageSquare, Facebook } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CarouselPreview = React.memo(({ 
    caption, 
    previewUrl, 
    selectedPages, 
    platforms, 
    mediaItems,
    rightSideImagePreview,
    thumbnailPreview
}) => {
    return (
        <div className="sticky top-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Live Preview
                </h3>
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                </div>
            </div>

            <div className="relative group">
                {/* Decorative background glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[40px] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="relative bg-[#1a1a1a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                                {selectedPages.length > 0 ? "P" : "E"}
                            </div>
                            <div>
                                <div className="text-[13px] font-bold text-white leading-tight">
                                    {selectedPages.length > 0 ? "Your Facebook Page" : "EZA Post"}
                                </div>
                                <div className="text-[10px] text-white/30 flex items-center gap-1">
                                    Just now • <Facebook size={10} />
                                </div>
                            </div>
                        </div>
                        <button className="p-2 text-white/20 hover:text-white/40 transition-colors">
                            <Share2 size={16} />
                        </button>
                    </div>

                    {/* Caption */}
                    <div className="px-4 py-3">
                        <p className="text-[13px] text-white/90 line-clamp-3 leading-relaxed">
                            {caption || "មាតិការបស់អ្នកនឹងបង្ហាញនៅទីនេះ..."}
                        </p>
                    </div>

                    {/* Media Display (Carousel Simulation) */}
                    <div className="relative aspect-square bg-black group-hover:scale-[1.02] transition-transform duration-700">
                        {previewUrl ? (
                            <div className="w-full h-full flex overflow-hidden">
                                {/* Simulated Carousel Card 1 (Video) */}
                                <div className="min-w-full relative">
                                    <video src={previewUrl} className="w-full h-full object-cover" muted autoPlay loop />
                                    <div className="absolute bottom-4 left-4 right-4 p-3 bg-black/40 backdrop-blur-md rounded-xl border border-white/10">
                                        <div className="text-[10px] text-white/60 uppercase font-black tracking-tighter mb-0.5">Watch Video</div>
                                        <div className="text-[12px] text-white font-bold truncate">ចុចដើម្បីមើលវីដេអូបន្ថែម</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white/10">
                                <div className="w-16 h-16 rounded-full border-4 border-dashed border-white/5 mb-4" />
                                <span className="text-[10px] uppercase font-black tracking-widest">No Media</span>
                            </div>
                        )}
                    </div>

                    {/* Interactions */}
                    <div className="p-4 bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`w-5 h-5 rounded-full border-2 border-[#1a1a1a] bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold`}>
                                        👍
                                    </div>
                                ))}
                                <span className="pl-4 text-[11px] text-white/40 font-medium">1.2K Likes</span>
                            </div>
                            <div className="text-[11px] text-white/40 font-medium">86 Comments</div>
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                            <div className="flex-1 h-8 rounded-full bg-white/5 border border-white/5 flex items-center px-4 text-[11px] text-white/20">
                                Write a comment...
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <MessageSquare size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default CarouselPreview;
