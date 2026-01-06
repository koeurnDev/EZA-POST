import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Upload, EyeOff, Loader, CheckCircle, AlertCircle, FileVideo } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const CensorshipTool = () => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [originalName, setOriginalName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setResult(null); // Reset result
            setMessage('');
        }
    };

    const handleCensor = async () => {
        if (!file) return;

        setLoading(true);
        setMessage('Processing video... detecting logos and text (this may take a while)...');

        const formData = new FormData();
        formData.append('video', file);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/tools/censorship/process', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 300000 // 5 minutes timeout
            });

            if (res.data.success) {
                setResult(res.data.data.downloadUrl);
                setOriginalName(res.data.data.originalName);
                toast.success('Video censored successfully!');
                setMessage('Done! Download your video below.');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to process video');
            setMessage('Error processing video. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-500/10 rounded-xl">
                        <EyeOff className="w-8 h-8 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Auto-Censorship</h1>
                        <p className="text-gray-600 dark:text-gray-400">Automatically detect and blur logos and text to avoid copyright</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Upload Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FileVideo className="w-5 h-5 text-blue-400" />
                            Source Video
                        </h2>

                        <div
                            className={`relative group border-2 border-dashed rounded-xl transition-all h-[300px] flex flex-col items-center justify-center cursor-pointer 
                        ${file ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}
                            onClick={() => document.getElementById('video-upload').click()}
                        >
                            <input
                                type="file"
                                id="video-upload"
                                className="hidden"
                                accept="video/*"
                                onChange={handleFileChange}
                            />

                            {preview ? (
                                <video
                                    src={preview}
                                    className="w-full h-full object-contain rounded-lg p-2"
                                    controls
                                />
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Upload className="w-8 h-8 text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-1">Click to upload video</h3>
                                    <p className="text-sm text-gray-500">MP4, MOV, or WEBM</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleCensor}
                            disabled={!file || loading}
                            className={`w-full mt-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                        ${!file || loading
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 text-white shadow-lg shadow-red-500/25'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span>{message}</span>
                                </>
                            ) : (
                                <>
                                    <EyeOff className="w-5 h-5" />
                                    <span>Auto-Censor Video</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Result Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl relative overflow-hidden">
                        {result ? (
                            <div className="h-full flex flex-col">
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    Censored Result
                                </h2>
                                <div className="flex-1 bg-black/50 rounded-xl overflow-hidden mb-6 border border-white/5">
                                    <video
                                        src={result}
                                        className="w-full h-full object-contain"
                                        controls
                                    />
                                </div>
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-400 text-center">
                                        Detection & Blurring Complete!
                                    </p>
                                    <a
                                        href={result}
                                        download={`censored_${originalName}`}
                                        className="block w-full py-4 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl text-center font-semibold transition-all"
                                    >
                                        Download Censored Video
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                    <EyeOff className="w-10 h-10 text-white/20" />
                                </div>
                                <h3 className="text-xl font-medium text-white mb-2">Ready to Censor</h3>
                                <p className="text-gray-500 max-w-xs">
                                    Upload a video to automatically detect and blur logos, text, and watermarks.
                                </p>
                            </div>
                        )}

                        {loading && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center">
                                <Loader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Analyzing Frames...</h3>
                                <p className="text-gray-400">
                                    This process uses AI to detect text in every few frames.<br />
                                    Please do not close this window.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-200">
                        <strong>Note:</strong> Detection runs locally on the server. For 1 minute of video, processing typically takes 30-60 seconds depending on resolution.
                        The system blurs detected regions with a "box blur" effect.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default CensorshipTool;
