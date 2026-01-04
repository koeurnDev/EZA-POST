import React, { useState, useRef } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Sparkles, Upload, Scissors, Eraser, Download, Check, X, Wand2 } from "lucide-react";
import Button from "../../components/ui/Button";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function AiTools() {
    const [activeTab, setActiveTab] = useState("remove-bg"); // remove-bg | watermark-remover | vision | generator

    // 🖼️ Shared State
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [processedUrl, setProcessedUrl] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [analysisResult, setAnalysisResult] = useState(""); // 🧠 Analysis Result

    const fileInputRef = useRef(null);

    // 📤 Handle Upload
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setProcessedUrl(null); // Reset result
        }
    };

    // ✂️ Remove Background Action
    const handleRemoveBg = async () => {
        if (!selectedImage) return;
        setProcessing(true);
        const toastId = toast.loading("Removing background...");

        try {
            const formData = new FormData();
            formData.append("image", selectedImage);

            const res = await api.post("/tools/ai/remove-bg", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.success) {
                setProcessedUrl(res.data.url);
                toast.success("Background removed!", { id: toastId });
            } else {
                throw new Error(res.data.error || "Failed");
            }
        } catch (err) {
            toast.error(err.message || "Failed to process", { id: toastId });
        } finally {
            setProcessing(false);
        }
    };



    // 📍 Watermark Position State
    const [watermarkPos, setWatermarkPos] = useState("br"); // br, bl, tr, tl

    // 🍌 Remove Watermark Action (Nano-Banana Pro)
    const handleRemoveWatermark = async () => {
        if (!selectedImage) return;
        setProcessing(true);
        const toastId = toast.loading("Removing watermark...");

        try {
            const formData = new FormData();
            formData.append("image", selectedImage);
            formData.append("position", watermarkPos);

            const res = await api.post("/tools/ai/remove-watermark", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.success) {
                setProcessedUrl(res.data.url);
                toast.success("Watermark removed! 🔥", { id: toastId });
            } else {
                throw new Error(res.data.error || "Failed");
            }
        } catch (err) {
            toast.error(err.message || "Failed to process", { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    // 🎨 Generate Image Action
    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setProcessing(true);
        const toastId = toast.loading("Dreaming up your image...");

        try {
            const res = await api.post("/tools/ai/generate", { prompt });

            if (res.data.success) {
                setProcessedUrl(res.data.url);
                toast.success("Image generated!", { id: toastId });
            } else {
                throw new Error(res.data.error || "Failed");
            }
        } catch (err) {
            toast.error(err.message || "Failed to generate", { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    // 🧠 Analyze Image Action
    const handleAnalyze = async () => {
        if (!selectedImage) return;
        setProcessing(true);
        const toastId = toast.loading("Analyzing with Gemini...");
        setAnalysisResult("");

        try {
            const formData = new FormData();
            formData.append("image", selectedImage);
            formData.append("prompt", "Analyze this image and write a catchy social media caption with emojis. Also suggest 10 trending hashtags.");

            const res = await api.post("/tools/ai/analyze", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.success) {
                setAnalysisResult(res.data.analysis);
                toast.success("Analysis complete!", { id: toastId });
            } else {
                throw new Error(res.data.error || "Failed");
            }
        } catch (err) {
            toast.error(err.message || "Failed to analyze", { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-3">
                        <Sparkles className="text-purple-500" /> AI Image Studio
                    </h1>
                    <p className="text-gray-500">Enhance your assets with AI power before posting.</p>
                </div>

                {/* 📑 Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex gap-1">
                        <button
                            onClick={() => setActiveTab("remove-bg")}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === "remove-bg"
                                ? "bg-white dark:bg-gray-700 shadow text-purple-600"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                }`}
                        >
                            <Scissors size={18} /> Remove Background
                        </button>
                        <button
                            onClick={() => setActiveTab("watermark-remover")}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === "watermark-remover"
                                ? "bg-white dark:bg-gray-700 shadow text-yellow-500"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                }`}
                        >
                            <Eraser size={18} /> Watermark Remover
                        </button>
                        <button
                            onClick={() => setActiveTab("vision")}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === "vision"
                                ? "bg-white dark:bg-gray-700 shadow text-green-600"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                }`}
                        >
                            <Sparkles size={18} /> Gemini Vision
                        </button>
                        <button
                            onClick={() => { setActiveTab("generator"); setProcessedUrl(null); }}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === "generator"
                                ? "bg-white dark:bg-gray-700 shadow text-pink-600"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                }`}
                        >
                            <Sparkles size={18} /> Image Generator
                        </button>
                    </div>
                </div>

                {/* 🖼️ Workplace */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 min-h-[500px]">

                    {/* Prompt Input for Generator */}
                    {activeTab === "generator" && (
                        <div className="mb-6">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe the image you want... (e.g. 'A futuristic city with neon lights')"
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-pink-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                />
                                <Button
                                    onClick={handleGenerate}
                                    isLoading={processing}
                                    disabled={processing || !prompt.trim()}
                                    className="bg-black hover:bg-gray-800 text-white px-8 rounded-xl shrink-0 border border-gray-700"
                                >
                                    <Sparkles size={18} className="mr-2" /> Generate (DALL-E 3)
                                </Button>
                            </div>
                            <p className="text-xs text-right text-gray-400 mt-2 font-mono">
                                ✨ Powered by OpenAI DALL-E 3
                            </p>
                        </div>
                    )}

                    {!selectedImage ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl h-96 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                        >
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">Upload Image</h3>
                            <p className="text-gray-400 mt-2">JPG or PNG (Max 5MB)</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Toolbar */}
                            <div className="flex justify-between items-center mb-6">
                                <button
                                    onClick={() => { setSelectedImage(null); setPreviewUrl(null); setProcessedUrl(null); }}
                                    className="text-gray-500 hover:text-red-500 font-medium flex items-center gap-2"
                                >
                                    <X size={18} /> Reset
                                </button>

                                {activeTab === "remove-bg" && (
                                    <Button
                                        onClick={handleRemoveBg}
                                        isLoading={processing}
                                        disabled={processing || !!processedUrl}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-8 rounded-xl"
                                    >
                                        <Wand2 size={18} className="mr-2" /> Remove Background
                                    </Button>
                                )}
                                {activeTab === "watermark-remover" && (
                                    <div className="flex flex-col gap-2">
                                        <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex justify-between w-full max-w-[200px] mb-2">
                                            {/* TL */}
                                            <button
                                                onClick={() => setWatermarkPos("tl")}
                                                className={`p-2 rounded-md transition-all ${watermarkPos === "tl" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                                                title="Top Left"
                                            >
                                                ↖️
                                            </button>
                                            {/* TR */}
                                            <button
                                                onClick={() => setWatermarkPos("tr")}
                                                className={`p-2 rounded-md transition-all ${watermarkPos === "tr" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                                                title="Top Right"
                                            >
                                                ↗️
                                            </button>
                                            {/* BL */}
                                            <button
                                                onClick={() => setWatermarkPos("bl")}
                                                className={`p-2 rounded-md transition-all ${watermarkPos === "bl" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                                                title="Bottom Left"
                                            >
                                                ↙️
                                            </button>
                                            {/* BR */}
                                            <button
                                                onClick={() => setWatermarkPos("br")}
                                                className={`p-2 rounded-md transition-all ${watermarkPos === "br" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                                                title="Bottom Right"
                                            >
                                                ↘️
                                            </button>
                                        </div>
                                        <Button
                                            onClick={handleRemoveWatermark}
                                            isLoading={processing}
                                            disabled={processing || !!processedUrl}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 rounded-xl"
                                        >
                                            <Wand2 size={18} className="mr-2" /> Remove Watermark
                                        </Button>
                                    </div>
                                )}
                                {activeTab === "vision" && (
                                    <Button
                                        onClick={handleAnalyze}
                                        isLoading={processing}
                                        disabled={processing}
                                        className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-xl"
                                    >
                                        <Sparkles size={18} className="mr-2" /> Analyze with Gemini
                                    </Button>
                                )}
                            </div>

                            {/* Canvas Area */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Original */}
                                <div className="relative bg-gray-100 dark:bg-gray-900 rounded-2xl p-4 flex items-center justify-center">
                                    <img src={previewUrl} className="max-h-[400px] object-contain" alt="Original" />
                                    <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded">Original</div>
                                </div>

                                {/* Result */}
                                <div className="relative bg-[url('/transparent-grid.png')] bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-auto">
                                    {activeTab === "vision" ? (
                                        <div className="w-full h-full text-left p-2">
                                            {analysisResult ? (
                                                <div className="prose dark:prose-invert text-sm whitespace-pre-wrap">
                                                    {analysisResult}
                                                </div>
                                            ) : (
                                                <div className="text-gray-400 text-sm flex flex-col items-center justify-center h-full">
                                                    <Sparkles size={32} className="mb-2 opacity-50" />
                                                    AI Analysis will appear here
                                                </div>
                                            )}
                                        </div>
                                    ) : processedUrl ? (
                                        <img src={processedUrl} className="max-h-[400px] object-contain" alt="Processed" />
                                    ) : (
                                        <div className="text-gray-400 text-sm flex flex-col items-center">
                                            {processing ? (
                                                <div className="animate-pulse">Processing...</div>
                                            ) : (
                                                <>
                                                    <Sparkles size={32} className="mb-2 opacity-50" />
                                                    Result will appear here
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* 🔥 Nano-Banana Pro Badge */}


                                    {processedUrl && activeTab !== "vision" && (
                                        <div className="absolute top-4 right-4">
                                            <a
                                                href={processedUrl}
                                                download="edited-image.png"
                                                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold"
                                            >
                                                <Download size={16} /> Download
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Generator Result Only Mode (if generator tab active and no upload needed) */}
                {activeTab === "generator" && !selectedImage && (
                    <div className="mt-8 relative bg-[url('/transparent-grid.png')] bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 min-h-[400px]">
                        {processedUrl ? (
                            <img src={processedUrl} className="max-h-[500px] object-contain shadow-2xl rounded-xl" alt="Generated" />
                        ) : (
                            <div className="text-gray-400 text-sm flex flex-col items-center">
                                {processing ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
                                        <div className="animate-pulse">Painting your masterpiece...</div>
                                    </div>
                                ) : (
                                    <>
                                        <Sparkles size={48} className="mb-2 opacity-30" />
                                        <p>Enter a description above and hit Generate</p>
                                    </>
                                )}
                            </div>
                        )}

                        {processedUrl && (
                            <div className="absolute top-4 right-4">
                                <a
                                    href={processedUrl}
                                    download="generated-art.jpg"
                                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold"
                                >
                                    <Download size={16} /> Download
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
