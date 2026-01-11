import React, { useState, useRef } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Eraser, Upload, Download, X, Wand2 } from "lucide-react";
import Button from "../../components/ui/Button";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function AiTools() {
    // 🖼️ Shared State
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [processedUrl, setProcessedUrl] = useState(null);
    const [processing, setProcessing] = useState(false);

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

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-3">
                        <Eraser className="text-yellow-500" /> Watermark Remover
                    </h1>
                    <p className="text-gray-500">Quickly remove corner watermarks from your images.</p>
                </div>

                {/* 🖼️ Workplace */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 md:p-8 min-h-[500px]">

                    {!selectedImage ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl h-96 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                        >
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4">
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

                                <div className="flex flex-col gap-2">
                                    <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex justify-between w-full max-w-[200px] mb-2">
                                        <button onClick={() => setWatermarkPos("tl")} className={`p-2 rounded-md transition-all ${watermarkPos === "tl" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}>↖️</button>
                                        <button onClick={() => setWatermarkPos("tr")} className={`p-2 rounded-md transition-all ${watermarkPos === "tr" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}>↗️</button>
                                        <button onClick={() => setWatermarkPos("bl")} className={`p-2 rounded-md transition-all ${watermarkPos === "bl" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}>↙️</button>
                                        <button onClick={() => setWatermarkPos("br")} className={`p-2 rounded-md transition-all ${watermarkPos === "br" ? "bg-yellow-500 text-white shadow" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}>↘️</button>
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
                                    {processedUrl ? (
                                        <img src={processedUrl} className="max-h-[400px] object-contain" alt="Processed" />
                                    ) : (
                                        <div className="text-gray-400 text-sm flex flex-col items-center">
                                            {processing ? (
                                                <div className="animate-pulse">Processing...</div>
                                            ) : (
                                                <>
                                                    <Eraser size={32} className="mb-2 opacity-50" />
                                                    Result will appear here
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {processedUrl && (
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
            </div>
        </DashboardLayout>
    );
}
