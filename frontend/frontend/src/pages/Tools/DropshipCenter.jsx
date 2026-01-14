import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ShoppingBag, Search, Globe, Download, Loader, Image as ImageIcon, X, Info } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

// ⬇️ Generic Trigger Download
const triggerDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export default function DropshipCenter() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [product, setProduct] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

    useEffect(() => setMounted(true), []);

    const handleScrape = async () => {
        if (!url) return toast.error("Please enter a URL");

        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post('/api/tools/ecommerce/scrape', { url }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setProduct(res.data.data);
                toast.success("Product Found!");
            } else {
                toast.error("Failed to find product info.");
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Error scraping URL.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAll = async () => {
        if (!product?.images?.length) return;

        setIsDownloading(true);
        setDownloadProgress({ current: 0, total: product.images.length });

        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl pointer-events-auto flex flex-col overflow-hidden ring-1 ring-black/5`}>
                <div className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                        <Download className="h-6 w-6 text-orange-600 dark:text-orange-400 animate-bounce" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">Downloading {product.images.length} Images</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Saving all product photos...
                        </p>
                    </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-xs text-orange-700 dark:text-orange-300 flex items-start gap-2 border-t border-orange-100 dark:border-orange-900/30">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>Please click <b>Allow</b> if prompted to save all files automatically.</span>
                </div>
            </div>
        ), { duration: 5000 });

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 0; i < product.images.length; i++) {
            const imgUrl = product.images[i];
            const safeTitle = product.title.replace(/[^a-z0-9\u0080-\uffff]/gi, '_').slice(0, 30);
            const filename = `${safeTitle}-${i + 1}.jpg`;

            triggerDownload(imgUrl, filename);
            setDownloadProgress(prev => ({ ...prev, current: i + 1 }));

            if (i < product.images.length - 1) await delay(1000); // 1s between downloads
        }

        toast.success("Finalizing downloads...");
        setTimeout(() => {
            setIsDownloading(false);
            setDownloadProgress({ current: 0, total: 0 });
        }, 2000);
    };

    return (
        <DashboardLayout>
            {/* Ambient Background Blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-5%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 rounded-full blur-[120px] opacity-40 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-blue-500/20 rounded-full blur-[120px] opacity-30 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-indigo-500/20 rounded-full blur-[120px] opacity-30 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-10 min-h-screen transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-2">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        Dropship <span className="text-orange-500">Center</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Download high-quality product images from 1688, Taobao, and Tmall instantly.
                    </p>
                </div>

                {/* 🔍 Search Bar */}
                <div className="max-w-2xl mx-auto mb-12">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 flex items-center gap-2">
                            <div className="pl-4 text-gray-400">
                                <Globe size={22} />
                            </div>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                                placeholder="Paste 1688, Taobao, or Tmall link..."
                                className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white p-3 placeholder-gray-400 text-lg md:text-xl font-medium"
                            />
                            {url && (
                                <button onClick={() => setUrl("")} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    <X size={20} />
                                </button>
                            )}
                            <button
                                onClick={handleScrape}
                                disabled={loading}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3.5 rounded-xl font-black transition-all flex items-center gap-2 shadow-lg shadow-orange-500/30 active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <Loader className="animate-spin" size={24} /> : <Search size={24} />}
                                <span className="hidden md:inline">{loading ? "Fetching..." : "Fetch Images"}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 📦 Product Result */}
                {product && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="bg-white/40 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl">

                            {/* Product Info Banner */}
                            <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start relative">
                                <div className="flex-1 space-y-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-xs font-black uppercase tracking-widest border border-orange-500/20">
                                        <ShoppingBag size={12} /> Product Found
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white leading-tight">
                                        {product.title}
                                    </h2>
                                    <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
                                        {product.price && product.price !== 'Ask' ? `¥${product.price}` : 'Price: Ask'}
                                    </div>
                                </div>

                                <div className="w-full md:w-auto shrink-0 self-center">
                                    <button
                                        onClick={handleDownloadAll}
                                        disabled={isDownloading}
                                        className="w-full md:w-auto px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-orange-500/30 transition-all hover:-translate-y-1 active:scale-95 relative overflow-hidden disabled:opacity-70 group"
                                    >
                                        <div className="absolute inset-0 bg-white/20 transition-all duration-300 pointer-events-none" style={{ width: isDownloading ? `${(downloadProgress.current / downloadProgress.total) * 100}%` : '0%' }}></div>
                                        {isDownloading ? (
                                            <>
                                                <Loader className="animate-spin z-10" size={24} />
                                                <span className="z-10">{downloadProgress.current} / {downloadProgress.total} Saved</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="group-hover:animate-bounce" size={24} />
                                                Download All Images
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Images Grid */}
                            <div className="p-8 md:p-10 pt-0">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xl font-black flex items-center gap-3 text-gray-900 dark:text-white">
                                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                            <ImageIcon size={18} />
                                        </div>
                                        Gallery ({product.images.length})
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 uppercase tracking-tighter">
                                        High Definition Photos
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {product.images.map((img, i) => (
                                        <div key={i} className="aspect-square rounded-3xl overflow-hidden border-2 border-transparent hover:border-orange-500 bg-gray-100 dark:bg-white/5 relative group transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/20 active:scale-95 shadow-lg shadow-black/5 dark:shadow-none">
                                            <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        triggerDownload(img, `product-${i + 1}.jpg`);
                                                    }}
                                                    title="Download HD"
                                                    className="w-14 h-14 bg-white text-orange-600 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform shadow-2xl"
                                                >
                                                    <Download size={30} strokeWidth={3} />
                                                </button>
                                            </div>
                                            <div className="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-black text-white/90 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                IMG_{i + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!product && !loading && (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 opacity-40 animate-pulse">
                        <div className="w-24 h-24 bg-gray-200 dark:bg-white/10 rounded-[2rem] flex items-center justify-center text-gray-400">
                            <ShoppingBag size={48} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">Awaiting Link</p>
                            <p className="text-gray-500">The center is ready for your product link.</p>
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
