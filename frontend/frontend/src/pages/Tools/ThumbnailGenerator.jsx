import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ImagePlus, Download, Loader, ImageIcon, Sparkles } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const ThumbnailGenerator = () => {
    const [topic, setTopic] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast.error("Please enter a topic.");
            return;
        }

        setLoading(true);
        setImageUrl('');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/tools/thumbnail/generate', { topic }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setImageUrl(res.data.data.imageUrl);
                toast.success('Thumbnail generated successfully!');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to generate thumbnail');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-pink-500/10 rounded-xl">
                        <ImagePlus className="w-8 h-8 text-pink-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Thumbnail Generator</h1>
                        <p className="text-gray-600 dark:text-gray-400">Create clickbait, viral thumbnails instantly with DALL-E 3.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl h-fit">
                        <h2 className="text-lg font-semibold text-white mb-4">Video Topic / Title</h2>
                        <textarea
                            className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 resize-none"
                            placeholder="E.g., I Survived 24 Hours in the Jungle..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !topic.trim()}
                            className={`w-full mt-4 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                            ${loading || !topic.trim()
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-lg shadow-pink-500/25'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span>Generating Art...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    <span>Generate Thumbnail</span>
                                </>
                            )}
                        </button>

                        <div className="mt-4 text-xs text-gray-500 text-center">
                            Powered by DALL-E 3 • High Quality • 16:9 Optimized
                        </div>
                    </div>

                    {/* Output Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl relative min-h-[400px] flex flex-col items-center justify-center overflow-hidden">
                        {imageUrl ? (
                            <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500">
                                <h2 className="text-lg font-semibold text-white self-start mb-4 flex items-center gap-2">
                                    <ImageIcon className="w-5 h-5 text-pink-400" /> Result
                                </h2>
                                <div className="relative group w-full rounded-xl overflow-hidden shadow-2xl border border-white/10">
                                    <img
                                        src={imageUrl}
                                        alt="Generated Thumbnail"
                                        className="w-full object-cover" // Removed hover scale to prevent mobile issues
                                    />
                                    {/* Overlay for Desktop Hover */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex items-center justify-center">
                                        <a
                                            href={imageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={`thumbnail-${Date.now()}.png`}
                                            className="px-6 py-3 bg-white text-black rounded-lg font-bold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all"
                                        >
                                            <Download className="w-5 h-5" /> Download HD
                                        </a>
                                    </div>
                                </div>

                                {/* Mobile Download Button (Always Visible) */}
                                <a
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={`thumbnail-${Date.now()}.png`}
                                    className="mt-4 w-full lg:hidden py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Download className="w-5 h-5" /> Download HD Image
                                </a>
                            </div>
                        ) : (
                            <div className="text-center text-gray-600 opacity-50">
                                {loading ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin mb-4"></div>
                                        <p>Dreaming up pixels...</p>
                                    </div>
                                ) : (
                                    <>
                                        <ImageIcon className="w-16 h-16 mx-auto mb-2" />
                                        <p>Your thumbnail will appear here</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ThumbnailGenerator;
