import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { 
    FileText, Download, Loader2, CheckCircle, UploadCloud, 
    FileType, X, Sparkles, Zap, ChevronRight, FileUp
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

// ✨ Motion Variants
const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
};

export default function DocumentConverter() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const [targetFormat, setTargetFormat] = useState('pdf');

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) {
            const f = e.target.files[0];
            setFile(f);
            setResult(null);
            setTargetFormat(f.name.toLowerCase().endsWith('.pdf') ? 'docx' : 'pdf');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            const f = e.dataTransfer.files[0];
            setFile(f);
            setResult(null);
            setTargetFormat(f.name.toLowerCase().endsWith('.pdf') ? 'docx' : 'pdf');
        }
    };

    const handleConvert = async () => {
        if (!file) return toast.error("Please select a file first");
        setLoading(true);
        setResult(null);
        setProgress(10);
        const interval = setInterval(() => {
            setProgress(p => (p >= 90 ? p : p + 5));
        }, 800);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", targetFormat);

        try {
            const res = await api.post("/tools/document-converter/convert", formData, {
                responseType: 'blob',
                timeout: 300000 
            });
            clearInterval(interval);
            setProgress(100);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const contentDisposition = res.headers['content-disposition'];
            let fileName = file.name.split('.')[0] + '.' + targetFormat;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match?.[1]) fileName = match[1].replace(/['"]/g, '');
            }
            setResult({ url, filename: fileName });
            toast.success("Conversion Successful!", { icon: "✨" });
        } catch (err) {
            toast.error("Conversion Failed. Please try again.");
            setProgress(0);
        } finally {
            setLoading(false);
            clearInterval(interval);
        }
    };

    const getFileIcon = () => {
        if (!file) return <FileText size={40} className="text-gray-400" />;
        const ext = file.name.split('.').pop().toLowerCase();
        const colors = {
            pdf: "bg-red-500/20 text-red-500",
            pptx: "bg-orange-500/20 text-orange-500",
            docx: "bg-blue-500/20 text-blue-500"
        };
        const colorClass = colors[ext] || "bg-emerald-500/20 text-emerald-500";
        return <div className={`p-4 rounded-2xl ${colorClass}`}><FileText size={40} /></div>;
    };

    return (
        <DashboardLayout>
            {/* 🌈 Modern Background Mesh (Emerald/Teal) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-cyan-500/20 to-emerald-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24 flex flex-col items-center">
                {/* 🏷️ Header */}
                <div className="text-center space-y-4 w-full flex flex-col items-center">
                    <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                        <FileType size={14} /> Document Pro
                    </motion.div>
                    <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 dark:text-white leading-tight">
                        Smart <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Converter</span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-sm md:text-lg font-medium leading-relaxed px-4">
                        Transform PDF, Word, and PowerPoint files with high-fidelity formatting.
                    </motion.p>
                </div>

                <div className="w-full max-w-4xl space-y-12">
                    {/* Main Tool Area */}
                    <motion.div variants={itemVariants} className="space-y-6">
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`relative aspect-video md:h-96 w-full max-w-4xl mx-auto flex flex-col items-center justify-center rounded-[2.5rem] border-4 border-dashed transition-all duration-500 group overflow-hidden ${isDragging ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'border-white/20 bg-white/40 dark:bg-white/5 backdrop-blur-3xl hover:border-emerald-500/50'}`}
                        >
                            <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" accept=".doc,.docx,.ppt,.pptx,.pdf" />
                            
                            <AnimatePresence mode="wait">
                                {!file ? (
                                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center p-8 space-y-6 w-full">
                                        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform shadow-inner">
                                            <FileUp size={48} />
                                        </div>
                                        <div className="flex flex-col items-center text-center">
                                            <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">Upload Document</h3>
                                            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">Drag & drop or click to browse files</p>
                                        </div>
                                        <div className="flex justify-center gap-3 pt-2">
                                            {['PDF', 'DOCX', 'PPTX'].map(ext => (
                                                <span key={ext} className="px-4 py-1.5 bg-white/50 dark:bg-white/5 border border-white/20 rounded-xl text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{ext}</span>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center p-8 space-y-4">
                                        {getFileIcon()}
                                        <div className="min-w-0 max-w-xs">
                                            <h3 className="text-xl font-black text-gray-900 dark:text-white truncate">{file.name}</h3>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        {!loading && !result && (
                                            <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-gray-400 hover:text-red-500 transition-colors p-2"><X size={24} /></button>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {file && !loading && !result && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-3xl rounded-3xl p-8 border border-white/20 shadow-2xl space-y-8 max-w-2xl mx-auto">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Target Format</label>
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Premium Quality</span>
                                    </div>
                                    <div className="flex gap-3">
                                        {['pdf', 'docx', 'pptx'].map(fmt => (
                                            <button
                                                key={fmt}
                                                onClick={() => setTargetFormat(fmt)}
                                                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${targetFormat === fmt ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-white/5 border-white/10 text-gray-500 hover:border-emerald-500/50'}`}
                                            >
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleConvert} className="w-full h-16 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]">
                                    <Zap size={20} /> Start Conversion
                                </button>
                            </motion.div>
                        )}

                        {/* Status/Result Overlay (Centered) */}
                        <div className="max-w-2xl mx-auto">
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    <motion.div key="loading" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-emerald-600 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                        <div className="relative z-10 space-y-6">
                                            <div className="flex items-center gap-3">
                                                <Loader2 size={24} className="animate-spin" />
                                                <span className="font-black text-xs uppercase tracking-[0.2em]">Processing Document...</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-4xl font-black">
                                                    <span>{progress}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                                    <motion.div className="h-full bg-white shadow-[0_0_15px_white]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                            <p className="text-xs font-bold text-white/60 leading-relaxed uppercase tracking-widest">Optimizing layers and assets for perfect conversion...</p>
                                        </div>
                                    </motion.div>
                                ) : result && (
                                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-10 shadow-2xl border border-emerald-500/20 text-center space-y-8">
                                        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto shadow-inner">
                                            <CheckCircle size={48} />
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-black text-gray-900 dark:text-white">Ready to Download</h3>
                                            <p className="text-sm font-bold text-gray-500 mt-2">{result.filename}</p>
                                        </div>
                                        <div className="space-y-3">
                                            <a href={result.url} download={result.filename} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-3">
                                                <Download size={22} /> Save Final File
                                            </a>
                                            <button onClick={() => { setFile(null); setResult(null); }} className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors pt-2">Convert Another File</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Bottom Features: Balanced Grid */}
                    {!loading && !result && (
                        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { title: "Vector Preservation", desc: "Keep images and icons sharp at any size." },
                                { title: "Searchable Text", desc: "Advanced OCR for scanned documents." },
                                { title: "High DPI Quality", desc: "Perfect for professional printing." },
                                { title: "File Optimization", desc: "Smaller file sizes without quality loss." }
                            ].map((feat, i) => (
                                <div key={i} className="bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-lg flex flex-col items-center text-center gap-4 group hover:bg-white/60 dark:hover:bg-white/10 transition-all hover:scale-[1.02]">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform shadow-inner">
                                        <ChevronRight size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 dark:text-white text-[11px] md:text-xs uppercase tracking-wider">{feat.title}</h4>
                                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{feat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
