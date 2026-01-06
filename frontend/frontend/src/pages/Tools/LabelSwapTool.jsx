import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Upload, ImageIcon, Repeat, Loader, CheckCircle, MousePointer2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const LabelSwapTool = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [logoFile, setLogoFile] = useState(null);

    // Preview states
    const [videoPreview, setVideoPreview] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    // Canvas & ROI
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [roi, setRoi] = useState(null); // {x, y, w, h}
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Handle Video Upload
    const handleVideoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVideoFile(file);
            setVideoPreview(URL.createObjectURL(file));
            setRoi(null); // Reset ROI
        }
    };

    // Handle Logo Upload
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    // Draw video frame to canvas for ROI selection
    const handleVideoLoaded = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas && video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
    };

    // Mouse Events for Drawing ROI
    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Scale mouse coordinates to canvas resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        setStartPos({ x, y });
        setIsDrawing(true);
        setRoi(null); // Clear previous
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;

        // Redraw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        const width = currentX - startPos.x;
        const height = currentY - startPos.y;

        // Draw Selection Box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(startPos.x, startPos.y, width, height);

        // Draw dimensions text (optional)
        ctx.fillStyle = '#00ff00';
        ctx.font = '20px Arial';
        ctx.fillText(`ROI`, startPos.x, startPos.y - 10);
    };

    const handleMouseUp = (e) => {
        if (!isDrawing) return;
        setIsDrawing(false);

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const endX = (e.clientX - rect.left) * scaleX;
        const endY = (e.clientY - rect.top) * scaleY;

        const w = Math.abs(endX - startPos.x);
        const h = Math.abs(endY - startPos.y);
        const x = Math.min(startPos.x, endX);
        const y = Math.min(startPos.y, endY);

        if (w > 10 && h > 10) {
            setRoi({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
        }
    };

    const handleProcess = async () => {
        if (!videoFile || !logoFile || !roi) {
            toast.error("Please upload video, logo, and select a region.");
            return;
        }

        setLoading(true);
        setMessage('Initializing Object Tracker (CSRT)... this might take a minute...');

        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('logo', logoFile);
        formData.append('roi', `${roi.x},${roi.y},${roi.w},${roi.h}`);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/tools/label-swap/process', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 600000 // 10 minutes timeout for heavy processing
            });

            if (res.data.success) {
                setResult(res.data.data.downloadUrl);
                toast.success('Label swapped successfully!');
                setMessage('Done!');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to swap label');
            setMessage('Error processing video. Try a smaller video or simpler scene.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                        <Repeat className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Product Label Swap</h1>
                        <p className="text-gray-600 dark:text-gray-400">Replace logos on moving objects using AI Tracking</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="space-y-6">
                        {/* Video Upload */}
                        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
                            <h2 className="text-lg font-semibold text-white mb-4">1. Choose Video</h2>
                            <input
                                type="file"
                                onChange={handleVideoChange}
                                accept="video/*"
                                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"
                            />
                        </div>

                        {/* Logo Upload */}
                        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
                            <h2 className="text-lg font-semibold text-white mb-4">2. Choose New Logo (PNG)</h2>
                            <input
                                type="file"
                                onChange={handleLogoChange}
                                accept="image/png"
                                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20"
                            />
                            {logoPreview && (
                                <img src={logoPreview} alt="New Logo" className="mt-4 h-16 object-contain" />
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                            <h3 className="font-semibold text-blue-300 flex items-center gap-2 mb-2">
                                <MousePointer2 size={18} /> How to Select Region
                            </h3>
                            <p className="text-sm text-blue-200">
                                Once the video loads on the right, draw a box around the object/label you want to replace.
                                The AI will track this box as it moves.
                            </p>
                        </div>

                        <button
                            onClick={handleProcess}
                            disabled={!roi || !logoFile || loading}
                            className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                        ${!roi || !logoFile || loading
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span>{message}</span>
                                </>
                            ) : (
                                <>
                                    <Repeat className="w-5 h-5" />
                                    <span>Process & Swap</span>
                                </>
                            )}
                        </button>

                        {roi && (
                            <div className="text-center text-green-400 text-sm font-mono">
                                Selected Region: {roi.w}x{roi.h} at ({roi.x}, {roi.y})
                            </div>
                        )}
                    </div>

                    {/* Canvas / Preview Section */}
                    <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl relative min-h-[400px] flex items-center justify-center bg-black/50 overflow-hidden">
                        {/* Hidden Video for Canvas Source */}
                        {videoPreview && (
                            <video
                                ref={videoRef}
                                src={videoPreview}
                                className="hidden"
                                onLoadedData={handleVideoLoaded}
                            />
                        )}

                        {!videoPreview ? (
                            <div className="text-center text-gray-500">
                                <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Upload a video to start</p>
                            </div>
                        ) : (
                            <canvas
                                ref={canvasRef}
                                className="max-w-full max-h-[500px] border border-white/10 cursor-crosshair shadow-2xl"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves canvas
                            />
                        )}

                        {/* Result Overlay */}
                        {result && (
                            <div className="absolute inset-0 z-20 bg-[#1e1e1e] flex flex-col items-center justify-center p-4 md:p-6">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <CheckCircle className="text-green-400" /> Success!
                                </h2>
                                <video src={result} controls className="max-w-full max-h-[300px] rounded-lg shadow-lg mb-6" />
                                <a
                                    href={result}
                                    download
                                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
                                >
                                    Download Video
                                </a>
                                <button
                                    onClick={() => setResult(null)}
                                    className="mt-4 text-sm text-gray-400 hover:text-white"
                                >
                                    processed another video
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default LabelSwapTool;
