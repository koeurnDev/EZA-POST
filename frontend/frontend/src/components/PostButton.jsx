// ============================================================
// 🚀 PostButton.jsx — Final Optimized Version (EZA_POST Project)
// ============================================================

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PostButton({
  selectedAccounts = [],
  videoUrl = "",
  videoFile = null, // 🎥 New Prop
  thumbnailFile = null,
  caption = "",
  scheduleTime = null,
  onPostSuccess,
  onPostError,
  disabled = false,
}) {
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);
  const [postStatus, setPostStatus] = useState("");
  const [currentAction, setCurrentAction] = useState("");

  // ✅ Validate all user inputs
  const validateInputs = useCallback(() => {
    if (!selectedAccounts.length)
      throw new Error("Please select at least one Facebook page or account.");

    // Check for either video URL OR video file
    if (!videoUrl.trim() && !videoFile)
      throw new Error("Please provide a TikTok video URL or upload a video file.");

    if (!caption.trim())
      throw new Error("Please enter a caption.");
    if (caption.length < 5 || caption.length > 2200)
      throw new Error("Caption must be between 5 and 2200 characters.");
  }, [selectedAccounts, videoUrl, videoFile, caption]);

  // 💫 Simulate progress animation for user feedback
  const simulateProgress = useCallback(async (action) => {
    return new Promise((resolve) => {
      let progress = 0;
      const timer = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 95) {
          clearInterval(timer);
          setPostProgress(95);
          resolve();
        } else {
          setPostProgress(progress);
        }
      }, 250);
    });
  }, []);

  // 🚀 Handle API call for posting/scheduling
  const handleApiCall = async (endpoint, action) => {
    setIsPosting(true);
    setCurrentAction(action);
    setPostProgress(0);
    setPostStatus("Validating inputs...");

    try {
      validateInputs();
      if (action === "schedule" && (!scheduleTime || scheduleTime <= new Date()))
        throw new Error("Please select a valid future schedule time.");

      await simulateProgress(action);

      const formData = new FormData();

      // 🎥 Handle Video Source
      if (videoFile) {
        formData.append("video", videoFile); // Backend expects 'video' field for file
      } else if (videoUrl) {
        formData.append("videoUrl", videoUrl);
      }

      formData.append("caption", caption);
      formData.append("accounts", JSON.stringify(selectedAccounts));
      if (scheduleTime) formData.append("scheduleTime", scheduleTime.toISOString());
      if (thumbnailFile) formData.append("thumbnail", thumbnailFile);

      setPostStatus(
        action === "post" ? "Publishing to Facebook..." : "Scheduling your post..."
      );

      const response = await fetch(endpoint, { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok)
        throw new Error(result.error || result.message || `Failed to ${action} post.`);

      setPostProgress(100);
      setPostStatus(
        action === "post"
          ? "✅ Post published successfully!"
          : "✅ Post scheduled successfully!"
      );
      onPostSuccess?.(result);

      setTimeout(() => {
        setIsPosting(false);
        setPostProgress(0);
        setPostStatus("");
        setCurrentAction("");
      }, 2000);
    } catch (err) {
      console.error(`${action} failed:`, err);
      setPostProgress(100);
      setPostStatus(`❌ ${err.message}`);
      onPostError?.(err.message);
      setTimeout(() => {
        setIsPosting(false);
        setPostProgress(0);
        setPostStatus("");
        setCurrentAction("");
      }, 4000);
    }
  };

  // 🔘 Handlers for each action
  const handlePost = () => handleApiCall("/api/posts/create", "post");
  const handleSchedule = () => handleApiCall("/api/posts/schedule", "schedule");

  // ✅ Button logic
  // ✅ Button logic
  const isFormValid =
    selectedAccounts.length > 0 &&
    (videoUrl || videoFile) &&
    caption.length >= 5 &&
    caption.length <= 2200 &&
    !isPosting &&
    !disabled;

  const canPost = isFormValid && !scheduleTime; // 🛑 Disable "Post Now" if scheduling is active
  const canSchedule = isFormValid && scheduleTime && new Date(scheduleTime) > new Date();

  const isError = postStatus.includes("❌");
  const isSuccess = postStatus.includes("✅");

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* 🔘 Buttons */}
      {/* 🚀 Dynamic Post/Schedule Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 🚀 Post Now Button */}
        <button
          onClick={handlePost}
          disabled={!canPost || (isPosting && currentAction !== "post")}
          className={`flex-1 px-4 py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] ${!canPost || (isPosting && currentAction !== "post")
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            }`}
        >
          {isPosting && currentAction === "post" ? (
            <>
              <div className="w-5 h-5 border-2 border-t-white border-white/30 rounded-full animate-spin" />
              <span>Publishing...</span>
            </>
          ) : (
            <>🚀 Post Now</>
          )}
        </button>

        {/* 📅 Schedule Button */}
        <button
          onClick={handleSchedule}
          disabled={!canSchedule || (isPosting && currentAction !== "schedule")}
          className={`flex-1 px-4 py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] ${!canSchedule || (isPosting && currentAction !== "schedule")
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none"
            : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            }`}
        >
          {isPosting && currentAction === "schedule" ? (
            <>
              <div className="w-5 h-5 border-2 border-t-white border-white/30 rounded-full animate-spin" />
              <span>Scheduling...</span>
            </>
          ) : (
            <>📅 Schedule</>
          )}
        </button>
      </div>

      {/* 📊 Progress Bar */}
      <AnimatePresence>
        {isPosting && (
          <motion.div
            className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`absolute left-0 top-0 h-full rounded-full ${isError ? "bg-red-500" : "bg-emerald-500"
                }`}
              initial={{ width: "0%" }}
              animate={{ width: `${postProgress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
            <span className="absolute right-2 top-0 text-xs text-gray-500 font-medium">
              {Math.round(postProgress)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💬 Status Message */}
      <AnimatePresence>
        {postStatus && (
          <motion.div
            key={postStatus}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`text-center text-sm font-medium ${isSuccess
              ? "text-emerald-600"
              : isError
                ? "text-red-600"
                : "text-gray-700 dark:text-gray-300"
              }`}
          >
            {postStatus}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
