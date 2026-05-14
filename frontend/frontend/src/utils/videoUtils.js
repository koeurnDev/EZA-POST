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

        video.preload = "metadata";
        const src = (videoFile instanceof File || videoFile instanceof Blob) ? URL.createObjectURL(videoFile) : videoFile;
        video.src = src;
        if (!(videoFile instanceof File || videoFile instanceof Blob)) video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            video.currentTime = Math.min(1, video.duration / 2);
        };

        video.onseeked = () => {
            // 🚀 Optimization: Scale down large videos to prevent memory jank
            const MAX_WIDTH = 640;
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > MAX_WIDTH) {
                height = (MAX_WIDTH / width) * height;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75); // Lower quality for preview speed
            if (videoFile instanceof File || videoFile instanceof Blob) URL.revokeObjectURL(video.src);
            resolve(dataUrl);
        };

        video.onerror = (err) => {
            URL.revokeObjectURL(video.src);
            reject(new Error("Failed to load video for thumbnail generation"));
        };
    });
};

/**
 * Generates a gallery of thumbnails from a video file.
 * @param {File} videoFile 
 * @param {number} count - Number of frames to extract
 * @returns {Promise<string[]>}
 */
export const generateGalleryFromVideo = (videoFile, count = 6) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const frames = [];

        video.preload = "metadata";
        const src = (videoFile instanceof File || videoFile instanceof Blob) ? URL.createObjectURL(videoFile) : videoFile;
        video.src = src;
        if (!(videoFile instanceof File || videoFile instanceof Blob)) video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = async () => {
            const duration = video.duration;
            const interval = duration / (count + 1);

            for (let i = 1; i <= count; i++) {
                const timestamp = i * interval;
                await new Promise((res) => {
                    video.onseeked = () => {
                        // 🚀 Optimization: Scale down gallery frames
                        const MAX_WIDTH = 480;
                        let width = video.videoWidth;
                        let height = video.videoHeight;

                        if (width > MAX_WIDTH) {
                            height = (MAX_WIDTH / width) * height;
                            width = MAX_WIDTH;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(video, 0, 0, width, height);
                        frames.push(canvas.toDataURL("image/jpeg", 0.6));
                        res();
                    };
                    video.currentTime = timestamp;
                });
            }

            URL.revokeObjectURL(video.src);
            resolve(frames);
        };

        video.onerror = (err) => {
            URL.revokeObjectURL(video.src);
            reject(new Error("Failed to load video for gallery generation"));
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
