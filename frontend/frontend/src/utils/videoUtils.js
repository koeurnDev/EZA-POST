/**
 * 🎬 Video Utility for Frontend
 * Generates thumbnails from video files in the browser.
 */

/**
 * Generates a thumbnail from a video file.
 * @param {File} videoFile - The video file object.
 * @returns {Promise<string>} - A promise that resolves with the thumbnail data URL (base64).
 */
export const generateThumbnailFromVideo = (videoFile) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Load video metadata to get dimensions
        video.preload = "metadata";
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            // Seek to 1 second (or 0.1s if short) to capture a frame
            video.currentTime = Math.min(1, video.duration / 2);
        };

        video.onseeked = () => {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to data URL (JPEG)
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

            // Cleanup
            URL.revokeObjectURL(video.src);
            resolve(dataUrl);
        };

        video.onerror = (err) => {
            URL.revokeObjectURL(video.src);
            reject(new Error("Failed to load video for thumbnail generation"));
        };
    });
};

/**
 * Converts a Data URL (base64) to a Blob/File object.
 * Useful for uploading the generated thumbnail.
 * @param {string} dataUrl - The base64 string.
 * @param {string} filename - The filename for the file.
 * @returns {File} - The File object.
 */
export const dataURLtoFile = (dataUrl, filename) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
};
