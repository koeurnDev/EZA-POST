import React from 'react';
import { Upload, X, Link as LinkIcon, Volume2, VolumeX, Maximize2 } from 'lucide-react';

const MediaUploader = React.memo(({ 
    videoTab, 
    setVideoTab, 
    file, 
    previewUrl, 
    onFileUpload, 
    onRemoveFile, 
    tiktokUrl, 
    setTiktokUrl, 
    onTiktokFetch, 
    isLoadingVideo,
    isMuted,
    setIsMuted
}) => {
    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 mb-8">
            <div className="flex items-center gap-6 mb-8 border-b border-white/5 pb-6">
                <button
                    onClick={() => setVideoTab("upload")}
                    className={`relative pb-4 text-sm font-bold transition-all ${
                        videoTab === "upload" ? "text-blue-400" : "text-white/40 hover:text-white/60"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Upload size={16} />
                        <span>Upload Video</span>
                    </div>
                    {videoTab === "upload" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" />
                    )}
                </button>
                <button
                    onClick={() => setVideoTab("link")}
                    className={`relative pb-4 text-sm font-bold transition-all ${
                        videoTab === "link" ? "text-blue-400" : "text-white/40 hover:text-white/60"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <LinkIcon size={16} />
                        <span>TikTok Link</span>
                    </div>
                    {videoTab === "link" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" />
                    )}
                </button>
            </div>

            {videoTab === "upload" ? (
                <div className="space-y-4">
                    {!previewUrl ? (
                        <label className="group relative flex flex-col items-center justify-center w-full h-64 md:h-80 border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-3xl bg-white/[0.02] hover:bg-blue-500/[0.02] cursor-pointer transition-all duration-500 overflow-hidden">
                            <input type="file" className="hidden" accept="video/*" onChange={onFileUpload} />
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="mb-4 p-4 rounded-2xl bg-white/5 group-hover:scale-110 group-hover:bg-blue-500/10 transition-all duration-500">
                                    <Upload className="w-8 h-8 text-white/40 group-hover:text-blue-400" />
                                </div>
                                <span className="text-lg font-bold text-white mb-2">ទម្លាក់វីដេអូនៅទីនេះ</span>
                                <span className="text-sm text-white/40">ឬចុចដើម្បីជ្រើសរើស (អតិបរមា 500MB)</span>
                            </div>
                        </label>
                    ) : (
                        <div className="relative rounded-3xl overflow-hidden bg-black aspect-video group">
                            <video
                                src={previewUrl}
                                className="w-full h-full object-contain"
                                muted={isMuted}
                                autoPlay
                                loop
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className="p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-black/70 transition-all"
                                >
                                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                </button>
                                <button
                                    onClick={onRemoveFile}
                                    className="p-3 rounded-xl bg-red-500/80 backdrop-blur-md border border-red-500/20 text-white hover:bg-red-600 transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <LinkIcon className="h-5 w-5 text-white/20" />
                        </div>
                        <input
                            type="text"
                            value={tiktokUrl}
                            onChange={(e) => setTiktokUrl(e.target.value)}
                            className="block w-full pl-14 pr-32 py-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                            placeholder="បិទភ្ជាប់ Link វីដេអូ TikTok នៅទីនេះ..."
                        />
                        <button
                            onClick={onTiktokFetch}
                            disabled={isLoadingVideo || !tiktokUrl}
                            className="absolute right-3 top-2 bottom-2 px-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-2"
                        >
                            {isLoadingVideo ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Maximize2 size={16} />
                            )}
                            ទាញយក
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

export default MediaUploader;
