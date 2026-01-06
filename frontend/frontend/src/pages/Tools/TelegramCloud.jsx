import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Send, Cloud, Link, Lock, CheckCircle, Loader } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const TelegramCloud = () => {
    const [url, setUrl] = useState('');
    const [botToken, setBotToken] = useState('');
    const [chatId, setChatId] = useState('');
    const [caption, setCaption] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!url || !botToken || !chatId) {
            toast.error("Please fill in URL, Bot Token, and Chat ID");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Processing... Downloading & Forwarding...");

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/tools/telegram-cloud/send',
                { url, botToken, chatId, caption },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (res.data.success) {
                toast.success('Sent to Telegram successfully!', { id: toastId });
                setUrl('');
                setCaption('');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to send to Telegram', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-400/10 rounded-xl">
                        <Cloud className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cloud Download to Telegram</h1>
                        <p className="text-gray-600 dark:text-gray-400">Save phone storage! Download TikTok/FB videos directly to your Telegram Group.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Form Section */}
                    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-xl space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Video Link</label>
                            <div className="relative">
                                <Link className="absolute left-3 top-3 text-gray-500 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Paste TikTok or Facebook URL"
                                    className="w-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Bot Token</label>
                                <input
                                    type="password"
                                    placeholder="123456:ABC-..."
                                    className="w-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl py-3 px-4 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                                    value={botToken}
                                    onChange={(e) => setBotToken(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Chat ID</label>
                                <input
                                    type="text"
                                    placeholder="-100123456789"
                                    className="w-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl py-3 px-4 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500/50"
                                    value={chatId}
                                    onChange={(e) => setChatId(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Custom Caption (Optional)</label>
                            <textarea
                                placeholder="Add a caption..."
                                className="w-full h-20 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white resize-none focus:outline-none focus:border-blue-500/50"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                        ${loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/25'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span>Forwarding to Cloud...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    <span>Send to Telegram 🚀</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Instructions / Status */}
                    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-green-500 dark:text-green-400" /> Secure & Privacy
                        </h3>
                        <ul className="space-y-4 text-gray-600 dark:text-gray-400 text-sm">
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
                                <span>Videos are processed in a temporary cloud container and deleted immediately after sending.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
                                <span>No storage is used on your device. The process happens entirely server-to-server.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
                                <span>Supports TikTok (No Watermark) and Facebook videos.</span>
                            </li>
                        </ul>

                        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                            <p className="text-blue-700 dark:text-blue-300 font-semibold mb-1">💡 Pro Tip</p>
                            <p className="text-blue-600 dark:text-blue-200/80 text-sm">
                                Create a Telegram Channel for your archives, add your bot as admin, and use the Channel ID to build an unlimited cloud library!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TelegramCloud;
