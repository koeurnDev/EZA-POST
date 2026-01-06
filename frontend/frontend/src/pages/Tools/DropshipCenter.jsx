import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ShoppingBag, Search, Globe, ChevronRight, Copy, Download, Share2, Loader, Image as ImageIcon } from 'lucide-react';
import apiUtils from '../../utils/apiUtils'; // You might need to add generic post method to utils
import toast from 'react-hot-toast';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function DropshipCenter() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [product, setProduct] = useState(null);
    const [translation, setTranslation] = useState('');
    const [translating, setTranslating] = useState(false);
    const navigate = useNavigate();

    const handleScrape = async () => {
        if (!url) return toast.error("Please enter a URL");

        setLoading(true);
        setTranslation(''); // Reset translation
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post('/api/tools/ecommerce/scrape', { url }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setProduct(res.data.data);
                toast.success("Product Found!");
                // Auto-trigger translation? Optional. Let's make it manual or auto.
                // handleTranslate(res.data.data.title); 
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

    const handleTranslate = async () => {
        if (!product?.title) return;
        setTranslating(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post('/api/tools/ecommerce/translate', { text: product.title }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setTranslation(res.data.translation);
                toast.success("Translated to Khmer! 🇰🇭");
            }
        } catch (err) {
            console.error(err);
            toast.error("Translation failed.");
        } finally {
            setTranslating(false);
        }
    };

    const handlePostToPage = () => {
        if (!product) return;
        // Navigate to Post page with pre-filled state
        // We'll pass the first image as 'media' (simulated) or just URL
        // Better: Pass title + description + images urls.
        navigate('/posts', {
            state: {
                caption: `${translation || product.title}\n\nPrice: $${(parseFloat(product.price) / 7).toFixed(2)} USD\n\n#Dropship #NewArrival`,
                imageUrls: product.images
            }
        });
        toast.success("Draft created! (Check Post Page)");
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-6 md:px-6 md:py-10 min-h-screen">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Dropship Center</h1>
                        <p className="text-gray-500 dark:text-gray-400">Import products from 1688, Taobao, Tmall.</p>
                    </div>
                </div>

                {/* 🔍 Search Bar */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-10">
                    <div className="pl-4 text-gray-400">
                        <Globe size={20} />
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste 1688 or Taobao Link here..."
                        className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white p-3 placeholder-gray-400"
                    />
                    <button
                        onClick={handleScrape}
                        disabled={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : <Search size={20} />}
                        {loading ? "Fetching..." : "Fetch"}
                    </button>
                </div>

                {/* 📦 Product Result */}
                {product && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl animate-fade-in-up">

                        {/* Images Grid */}
                        <div className="p-4 pb-0 md:p-6 md:pb-0">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                <ImageIcon size={18} className="text-blue-500" /> Gallery ({product.images.length})
                            </h3>
                            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                                {product.images.map((img, i) => (
                                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group cursor-pointer">
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                        <a href={img} target="_blank" download className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                            <Download size={20} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Info & Edit */}
                        <div className="p-6 md:p-8 space-y-6">

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Title (Original)</label>
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-gray-800 dark:text-gray-200 font-medium">
                                    {product.title}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Smart Translate (CN -> KH)</label>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800">
                                    {/* Mock Translation for now */}
                                    <span className="italic opacity-80 block mb-2 text-xs">Translated:</span>
                                    {product.title} (KH Ver.)
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700">
                                <div className="text-2xl font-black text-orange-600">
                                    ¥{product.price}
                                </div>

                                <button
                                    onClick={handlePostToPage}
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-transform hover:-translate-y-1"
                                >
                                    <Share2 size={20} />
                                    Create Post
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!product && !loading && (
                    <div className="text-center py-20 opacity-40">
                        <ShoppingBag size={64} className="mx-auto mb-4 text-gray-400" />
                        <p>Ready to import high-quality products.</p>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
