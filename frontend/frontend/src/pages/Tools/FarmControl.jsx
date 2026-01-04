import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Users, Upload, Play, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const FarmControl = () => {
    const [accounts, setAccounts] = useState(''); // Text area for JSON cookies
    const [mediaFile, setMediaFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    const handleStoryPost = async () => {
        if (!accounts || !mediaFile) {
            toast.error("Please provide accounts and media.");
            return;
        }

        let parsedAccounts;
        try {
            parsedAccounts = JSON.parse(accounts);
            if (!Array.isArray(parsedAccounts)) throw new Error("Root must be array");
        } catch (e) {
            toast.error("Invalid Accounts JSON format.");
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('accounts', JSON.stringify(parsedAccounts));
        formData.append('media', mediaFile);

        try {
            // Toast promise
            await toast.promise(
                axios.post('/api/tools/farm/story', formData),
                {
                    loading: 'Mass Posting Stories...',
                    success: 'Batch Processed Successfully!',
                    error: 'Error processing batch.'
                }
            );
            setLogs(prev => [`[${new Date().toLocaleTimeString()}] Mass Story Post Completed.`, ...prev].slice(0, 50));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleWarmup = async () => {
        if (!accounts) {
            toast.error("Please provide accounts JSON.");
            return;
        }
        let parsedAccounts;
        try {
            parsedAccounts = JSON.parse(accounts);
        } catch (e) {
            toast.error("Invalid Accounts JSON.");
            return;
        }

        try {
            const res = await axios.post('/api/tools/farm/warmup', { accounts: parsedAccounts, duration: 5 });
            if (res.data.success) {
                toast.success("Warm-up started in background!");
                setLogs(prev => [`[${new Date().toLocaleTimeString()}] Started warm-up for ${parsedAccounts.length} accounts.`, ...prev].slice(0, 50));
            }
        } catch (err) {
            toast.error("Failed to start warm-up");
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-xl">
                        <Users className="w-8 h-8 text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Cloud Farm Automation</h1>
                        <p className="text-gray-400">Manage hundreds of accounts: Mass Story Posting & Auto-Warmup.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Controls */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Account Input */}
                        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-lg font-semibold text-white mb-2">1. Import Accounts (JSON Cookies)</h2>
                            <p className="text-xs text-gray-500 mb-4">Format: <code>[{`{ "id": "acc1", "cookie": [...] }`}, ...]</code></p>
                            <textarea
                                className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-orange-500/50"
                                placeholder='[ { "id": "user1", "cookie": [...] }, { "id": "user2", "cookie": [...] } ]'
                                value={accounts}
                                onChange={(e) => setAccounts(e.target.value)}
                            />
                        </div>

                        {/* Actions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Story Poster */}
                            <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Upload className="w-5 h-5 text-pink-500" /> Mass Story Poster
                                    </h3>
                                    <input
                                        type="file"
                                        onChange={(e) => setMediaFile(e.target.files[0])}
                                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20 mb-4"
                                    />
                                </div>
                                <button
                                    onClick={handleStoryPost}
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-pink-500/20 transition-all"
                                >
                                    {loading ? "Processing Batch..." : "Post to All Stories"}
                                </button>
                            </div>

                            {/* Warm-up */}
                            <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-green-500" /> Auto-Warmup
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-4">
                                        Simulate scrolling, liking, and watching for 5 minutes on all accounts to prevent checkpoints.
                                    </p>
                                </div>
                                <button
                                    onClick={handleWarmup}
                                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-green-500/20 transition-all"
                                >
                                    Start Warm-up Cycle
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Logs/Status */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl h-fit flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Live Activity Logs</h2>
                            <button
                                onClick={() => setLogs([])}
                                className="text-xs text-gray-500 hover:text-white hover:underline"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex-1 min-h-[200px] max-h-[300px] lg:max-h-[500px] overflow-y-auto bg-black/50 rounded-xl p-4 font-mono text-xs space-y-2 overscroll-contain">
                            {logs.length === 0 ? (
                                <p className="text-gray-600 text-center mt-10">No active tasks...</p>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="text-green-400 border-b border-white/5 pb-1 break-words">
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default FarmControl;
