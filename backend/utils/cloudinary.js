/**
 * ============================================================
 * ☁️ Cloudinary Utility
 * ============================================================
 * Handles uploading and deleting files from Cloudinary.
 */

const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// ⚙️ Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * 📤 Upload a file to Cloudinary
 * @param {string} filePath - Local path to the file
 * @param {string} folder - Folder name in Cloudinary
 * @param {string} resourceType - 'image', 'video', or 'auto'
 * @returns {Promise<object>} - Cloudinary response
 */
const uploadFile = async (filePath, folder = "kr_post", resourceType = "auto") => {
    try {
        if (!filePath) throw new Error("File path is required");

        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        });

        // 🧹 Delete local file after successful upload
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupErr) {
            console.warn("⚠️ Failed to delete local temp file:", cleanupErr.message);
        }

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            duration: result.duration, // for videos
            size: result.bytes,
        };
    } catch (error) {
        // 🧹 Ensure local file is deleted even on error
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupErr) {
            // ignore
        }

        console.error("❌ Cloudinary Upload Error:", error.message);
        throw new Error(error.message || "Cloudinary upload failed");
    }
};

/**
 * 🗑️ Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file
 * @param {string} resourceType - 'image' or 'video'
 */
const deleteFile = async (publicId, resourceType = "image") => {
    try {
        if (!publicId) return;
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
    } catch (error) {
        console.error("❌ Cloudinary Delete Error:", error.message);
    }
};

module.exports = { uploadFile, deleteFile };
