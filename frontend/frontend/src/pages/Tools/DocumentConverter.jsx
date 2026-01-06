import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FileText, Download, Loader2, CheckCircle, Smartphone, UploadCloud, FileType } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function DocumentConverter() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);

    const [targetFormat, setTargetFormat] = useState('pdf');

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setResult(null);
            // Auto-set default based on extension
            if (f.name.toLowerCase().endsWith('.pdf')) {
                setTargetFormat('docx');
            } else {
                setTargetFormat('pdf');
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const f = e.dataTransfer.files[0];
            setFile(f);
            setResult(null);
            // Auto-set default based on extension
            if (f.name.toLowerCase().endsWith('.pdf')) {
                setTargetFormat('docx');
            } else {
                setTargetFormat('pdf');
            }
        }
    };

    const removeFile = () => {
        setFile(null);
        setResult(null);
        setProgress(0);
        setTargetFormat('pdf');
    };

    const handleConvert = async () => {
        if (!file) return toast.error("Please select a file first");

        setLoading(true);
        setResult(null);
        setProgress(10); // Start progress

        // Simulate progress
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + 10;
            });
        }, 500);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", targetFormat);

        try {
            const res = await api.post("/tools/document-converter/convert", formData, {
                responseType: 'blob',
                timeout: 300000 // 5 minutes (Local conversion can be slow)
            });

            clearInterval(interval);
            setProgress(100);

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const contentDisposition = res.headers['content-disposition'];
            let fileName = file.name.split('.')[0] + '.' + targetFormat; // Fallback
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (fileNameMatch && fileNameMatch[1]) {
                    fileName = fileNameMatch[1].replace(/['"]/g, '');
                }
            }

            setResult({ url: url, filename: fileName });
            toast.success("Conversion Successful!");

        } catch (err) {
            console.error(err);
            clearInterval(interval);
            setProgress(0);
            toast.error("Conversion Failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = () => {
        if (!file) return <FileText size={40} className="text-gray-400" />;
        const ext = file.name.split('.').pop().toLowerCase();
        if (['ppt', 'pptx'].includes(ext)) {
            return <div className="p-3 bg-orange-100 rounded-lg text-orange-600"><FileText size={32} /></div>;
        }
        if (ext === 'pdf') {
            return <div className="p-3 bg-red-100 rounded-lg text-red-600"><FileText size={32} /></div>;
        }
        return <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><FileText size={32} /></div>;
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
                {/* Hero */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20">
                        <FileText size={40} className="text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
                        Document <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Converter</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Transform your <span className="font-semibold text-red-500">PDF</span>, <span className="font-semibold text-orange-500">PowerPoint</span>, and <span className="font-semibold text-blue-500">Word</span> documents in seconds.
                    </p>
                </div>

                <div className="grid md:grid-cols-5 gap-8 items-start">

                    {/* Left: Upload Area */}
                    <div className={`md:col-span-3 bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border-2 transition-all duration-300 ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-gray-700 scale-[1.02]' : 'border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}>

                        {!file && !result ? (
                            <div
                                className="h-80 flex flex-col items-center justify-center text-center cursor-pointer"
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <label htmlFor="dropzone-file" className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                                    <div className="mb-6 p-6 bg-blue-50 dark:bg-gray-700 rounded-full animate-bounce">
                                        <UploadCloud size={48} className="text-blue-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                                        Drag & Drop your file here
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6">or click to browse</p>
                                    <div className="flex gap-3 text-sm font-medium text-gray-400">
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">PDF</span>
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">PPTX</span>
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">DOCX</span>
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">PPT</span>
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">DOC</span>
                                    </div>
                                </label>
                                <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".doc,.docx,.ppt,.pptx,.pdf" />
                            </div>
                        ) : (
                            <div className="h-80 flex flex-col items-center justify-center relative animate-in fade-in zoom-in duration-300">
                                {!loading && !result && (
                                    <button onClick={removeFile} className="absolute top-0 right-0 p-2 text-gray-400 hover:text-red-500 transition-colors">
                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-1">X</div>
                                    </button>
                                )}

                                {getFileIcon()}

                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mt-4 mb-1 max-w-[80%] truncate">
                                    {file.name}
                                </h3>
                                <p className="text-sm text-gray-400 mb-8">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>

                                {!loading && !result && (
                                    <button
                                        onClick={handleConvert}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:scale-105"
                                    >
                                        <Download size={20} /> Convert Now
                                    </button>
                                )}

                                {/* PDF Options */}
                                {!loading && !result && file && file.name.toLowerCase().endsWith('.pdf') && (
                                    <div className="mt-4 flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                                        <button
                                            onClick={() => setTargetFormat('docx')}
                                            className={`px-4 py-2 rounded-lg border-2 font-bold transition-all ${targetFormat === 'docx' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                        >
                                            To Word
                                        </button>
                                        <button
                                            onClick={() => setTargetFormat('pptx')}
                                            className={`px-4 py-2 rounded-lg border-2 font-bold transition-all ${targetFormat === 'pptx' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                        >
                                            To PPT
                                        </button>
                                    </div>
                                )}

                                {loading && (
                                    <div className="w-full max-w-xs">
                                        <div className="flex justify-between text-sm mb-2 text-gray-600 dark:text-gray-300 font-medium">
                                            <span>Converting...</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-center text-gray-400 mt-3 animate-pulse">
                                            Please wait while we process your document...
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Info or Result */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Success Card */}
                        {result && (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-green-100 dark:border-green-900/30 animate-in slide-in-from-right duration-500">
                                <div className="text-center">
                                    <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ready to Download!</h3>
                                    <p className="text-sm text-gray-500 mb-6">Your document has been successfully converted.</p>

                                    <a
                                        href={result.url}
                                        download={result.filename}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all transform hover:scale-[1.02] mb-3"
                                    >
                                        <Download size={20} /> Download PDF
                                    </a>

                                    <button
                                        onClick={removeFile}
                                        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-4"
                                    >
                                        Convert another file
                                    </button>
                                </div>
                            </div>
                        )}

                        {!result && (
                            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                                <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Smartphone size={18} className="text-blue-500" /> Why convert?
                                </h4>
                                <ul className="space-y-3">
                                    {[
                                        "Preserve formatting across all devices",
                                        "Secure and uneditable format",
                                        "Smaller file size for sharing",
                                        "Professional presentation"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
