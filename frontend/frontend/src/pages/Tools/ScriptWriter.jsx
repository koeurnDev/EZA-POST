import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Sparkles, Copy, Loader, FileText, Check } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

const ScriptWriter = () => {
    const [topic, setTopic] = useState('');
    const [script, setScript] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast.error("Please enter a topic.");
            return;
        }

        setLoading(true);
        setScript('');
        setCopied(false);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/tools/script/generate', { topic }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setScript(res.data.data.script);
                toast.success('Script generated successfully!');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to generate script');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(script);
        setCopied(true);
        toast.success("Script copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-teal-500/10 rounded-xl">
                        <Sparkles className="w-8 h-8 text-teal-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Script Writer</h1>
                        <p className="text-gray-600 dark:text-gray-400">Generate viral video scripts in Khmer instantly.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl h-fit">
                        <h2 className="text-lg font-semibold text-white mb-4">Topic / Idea</h2>
                        <textarea
                            className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 resize-none"
                            placeholder="E.g., How to make money online for students..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !topic.trim()}
                            className={`w-full mt-4 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                            ${loading || !topic.trim()
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white shadow-lg shadow-teal-500/25'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span className="text-white">Writing Magic...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    <span className="text-white">Generate Script</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Output Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl relative min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-teal-400" /> Generated Script
                            </h2>
                            {script && (
                                <button
                                    onClick={handleCopy}
                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Copy to Clipboard"
                                >
                                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 bg-black/30 rounded-xl p-4 overflow-y-auto max-h-[500px]">
                            {script ? (
                                <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-white max-w-none">
                                    <ReactMarkdown>{script}</ReactMarkdown>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                    <FileText className="w-12 h-12 mb-2" />
                                    <p>Your script will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ScriptWriter;
