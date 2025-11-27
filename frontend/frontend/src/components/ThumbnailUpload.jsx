// ============================================================
// 📸 ThumbnailUpload.jsx — Modern 16:9 Uploader
// ============================================================

import React, { useState, useCallback } from "react";
import { ImagePlus, Upload, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ThumbnailUpload = ({ onChange, currentThumbnail = null, isDemo = false }) => {
  const [preview, setPreview] = useState(currentThumbnail);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // ✅ Validate image
  const validateFile = (file) => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type))
      throw new Error("Please select a valid image (JPEG, PNG, GIF, or WebP)");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Image must be smaller than 5MB");
    return true;
  };

  // ✅ Handle file selection
  const handleFile = useCallback(
    async (file) => {
      try {
        setError("");
        setUploadProgress(0);
        validateFile(file);

        // Preview immediately
        const reader = new FileReader();
        reader.onloadstart = () => setUploadProgress(10);
        reader.onprogress = (e) => {
          if (e.lengthComputable)
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };

        reader.onload = async (e) => {
          const result = e.target.result;
          setPreview(result);
          setUploadProgress(100);

          // Simulate upload or real upload
          if (isDemo) {
            setTimeout(() => {
              onChange?.(file, result);
              setUploadProgress(0);
            }, 500);
          } else {
            try {
              const formData = new FormData();
              formData.append("thumbnail", file);
              const res = await fetch(
                `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/upload/thumbnail`,
                { method: "POST", body: formData }
              );
              const data = await res.json();
              if (data.success && onChange) onChange(file, data.file.path);
              else onChange(file, result);
            } catch {
              onChange(file, result); // Fallback to local preview
            }
            setTimeout(() => setUploadProgress(0), 800);
          }
        };

        reader.onerror = () => {
          setError("Failed to read file");
          setUploadProgress(0);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError(err.message);
        setUploadProgress(0);
        onChange?.(null, null);
      }
    },
    [onChange, isDemo]
  );

  // ✅ Input and drag events
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
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
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
  };

  const removeThumbnail = (e) => {
    e?.stopPropagation();
    setPreview(null);
    setError("");
    setUploadProgress(0);
    onChange?.(null, null);
    const input = document.getElementById("thumbnail-upload");
    if (input) input.value = "";
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => document.getElementById("thumbnail-upload").click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group w-full aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border-2 border-dashed ${error
          ? "border-red-300 bg-red-50 dark:bg-red-900/10"
          : isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[0.99]"
            : preview
              ? "border-transparent"
              : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-100 dark:hover:bg-gray-750"
          }`}
      >
        {/* Hidden Input */}
        <input
          id="thumbnail-upload"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 🖼️ PREVIEW STATE */}
        {preview ? (
          <>
            <img
              src={preview}
              alt="Thumbnail preview"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
              <p className="text-white font-medium text-sm">Change Thumbnail</p>
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById("thumbnail-upload").click();
                  }}
                  className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors backdrop-blur-md"
                  title="Replace"
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={removeThumbnail}
                  className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors backdrop-blur-md"
                  title="Remove"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {/* Success Badge (Temporary) */}
            {uploadProgress === 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1"
              >
                <CheckCircle2 size={12} /> Uploaded
              </motion.div>
            )}
          </>
        ) : (
          /* 📂 EMPTY STATE */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? "bg-blue-100 text-blue-600" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-gray-600 group-hover:text-blue-500"
              }`}>
              {isDragging ? <Upload size={24} /> : <ImagePlus size={24} />}
            </div>

            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {isDragging ? "Drop image here" : "Upload Thumbnail"}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px]">
              16:9 recommended • Max 5MB
            </p>
          </div>
        )}

        {/* 🚨 ERROR OVERLAY */}
        {error && (
          <div className="absolute inset-0 bg-red-50/90 dark:bg-red-900/90 flex flex-col items-center justify-center p-4 text-center backdrop-blur-sm z-10">
            <AlertCircle className="text-red-600 dark:text-red-200 mb-2" size={32} />
            <p className="text-sm font-medium text-red-800 dark:text-red-100">{error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setError("");
              }}
              className="mt-3 text-xs bg-white text-red-600 px-3 py-1.5 rounded-md font-medium shadow-sm hover:bg-gray-50"
            >
              Try Again
            </button>
          </div>
        )}

        {/* 📊 PROGRESS BAR */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ThumbnailUpload;
