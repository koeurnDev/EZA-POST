// ============================================================
// 🎬 VideoPreview.jsx — Drag & Drop Support
// ============================================================

import React, { useState, useCallback, useEffect } from "react";
import { Upload, FileVideo, X, Play, Pause, AlertCircle } from "lucide-react";

const VideoPreview = ({ videoUrl, videoFile, onFileSelect, title = "Video Preview", isDemo = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoSrc, setVideoSrc] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // ✅ Handle Source Changes
  useEffect(() => {
    if (videoFile) {
      const objectUrl = URL.createObjectURL(videoFile);
      setVideoSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (videoUrl) {
      setVideoSrc(videoUrl);
    } else {
      setVideoSrc("");
    }
    setError("");
    setIsLoading(false);
  }, [videoUrl, videoFile]);

  // ✅ Drag & Drop Handlers
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
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      onFileSelect(file);
    } else {
      setError("Please drop a valid video file (MP4, WebM, OGG)");
    }
  };

  // ✅ File Input Handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelect(file);
  };

  // ✅ Video Events
  const handleVideoLoadStart = () => setIsLoading(true);
  const handleVideoLoaded = () => setIsLoading(false);
  const handleVideoError = () => {
    setIsLoading(false);
    // Only show error if we actually have a source that failed
    if (videoSrc) setError("Failed to load video. Check URL or file format.");
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          🎬 {title}
        </h3>
        {(videoFile || videoUrl) && (
          <button
            onClick={() => onFileSelect(null)}
            className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full aspect-video rounded-xl overflow-hidden bg-black transition-all duration-300 ${!videoSrc
            ? `border-2 border-dashed cursor-pointer ${isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750"
            }`
            : "border-0 shadow-lg"
          }`}
        onClick={() => !videoSrc && document.getElementById("video-upload").click()}
      >
        <input
          id="video-upload"
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          onChange={handleFileChange}
          className="hidden"
        />

        {videoSrc ? (
          <>
            <video
              src={videoSrc}
              controls
              className="w-full h-full object-contain"
              onLoadStart={handleVideoLoadStart}
              onLoadedData={handleVideoLoaded}
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Error Overlay */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                <AlertCircle size={32} className="text-red-500 mb-2" />
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => onFileSelect(null)}
                  className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
                >
                  Try Again
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty State / Drop Zone */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? "bg-blue-100 text-blue-600" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}>
              {isDragging ? <Upload size={32} /> : <FileVideo size={32} />}
            </div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isDragging ? "Drop video here" : "Upload Video"}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[250px]">
              Drag & drop from drive or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-2">MP4, WebM, OGG (Max 100MB)</p>
          </div>
        )}
      </div>

      {/* File Info */}
      {videoFile && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-300">
            <FileVideo size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {videoFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={() => onFileSelect(null)}
            className="p-2 text-gray-400 hover:text-red-500 transition"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
