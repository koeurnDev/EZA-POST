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
 * @param {boolean} deleteAfterUpload - Whether to delete the local file after upload (default: true)
 * @returns {Promise<object>} - Cloudinary response
 */
const uploadFile = async (filePath, folder = "eza-post", resourceType = "auto", deleteAfterUpload = true, transform = false) => {
    try {
        if (!filePath) throw new Error("File path is required");

        // 🛡️ Fallback to local storage if Cloudinary is not configured (or using Cloudflare R2 / local CDN)
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            const fileName = path.basename(filePath);
            const subFolder = folder.replace(/^eza-post\/?/, "") || "media";
            const targetFolder = path.join(__dirname, "../uploads", subFolder);
            if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });
            const targetPath = path.join(targetFolder, fileName);
            if (filePath !== targetPath && fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, targetPath);
                if (deleteAfterUpload) {
                    try { fs.unlinkSync(filePath); } catch (e) {}
                }
            }
            const relativePath = `/uploads/${subFolder}/${fileName}`.replace(/\/+/g, "/");
            const baseUrl = process.env.API_BASE_URL || "http://localhost:3001";
            const fullUrl = `${baseUrl.replace(/\/$/, "")}${relativePath}`;
            return {
                success: true,
                url: fullUrl,
                publicId: fileName,
                width: 1080,
                height: 1080,
                format: path.extname(fileName).replace(".", ""),
                resourceType: resourceType,
            };
        }

        const options = {
            folder: folder,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        };

        // ✅ Apply 1:1 Padding Transformation if requested
        if (transform) {
            options.transformation = [
                { width: 1080, height: 1080, crop: "pad", background: "black", gravity: "center" }
            ];
        }

        const result = await cloudinary.uploader.upload(filePath, options);

        // 🧹 Delete local file after successful upload (if requested)
        if (deleteAfterUpload) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupErr) {
                console.warn("⚠️ Failed to delete local temp file:", cleanupErr.message);
            }
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
        // 🧹 DO NOT delete here, let the controller handle it or keep it for fallback
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
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            console.log(`ℹ️ Local file delete check for ${publicId}`);
            return;
        }
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
    } catch (error) {
        console.error("❌ Cloudinary Delete Error:", error.message);
    }
};

/**
 * 🏷️ Phase 1: Soft Delete (Immediate Action)
 * Marks asset with metadata for future deletion.
 * @param {string} publicId - The public ID of the file
 */
const softDeleteAsset = async (publicId) => {
    try {
        if (!publicId) return;

        // Calculate deletion date (Now + 24 hours)
        const deleteDate = new Date();
        deleteDate.setHours(deleteDate.getHours() + 24);

        await cloudinary.uploader.add_context(
            `post_status=SUCCESS|scheduled_delete_date=${deleteDate.toISOString()}`,
            [publicId]
        );

        console.log(`🏷️ Soft Deleted (Scheduled for ${deleteDate.toISOString()}): ${publicId}`);
    } catch (error) {
        console.error("❌ Cloudinary Soft Delete Error:", error.message);
    }
};

/**
 * 🧹 Phase 2: Hard Delete (Scheduled Job)
 * Finds and deletes assets that are past their scheduled deletion date.
 */
const deleteExpiredAssets = async () => {
    try {
        console.log("🧹 Checking for expired Cloudinary assets...");

        // Search for assets with post_status=SUCCESS
        // Note: Cloudinary Search API has rate limits and latency.
        // We filter results in code for precise date comparison to avoid complex search syntax issues.
        const result = await cloudinary.search
            .expression('context.post_status="SUCCESS"')
            .with_field('context')
            .max_results(100)
            .execute();

        if (result.resources.length === 0) {
            console.log("✅ No expired assets found.");
            return;
        }

        const now = new Date();
        const toDelete = [];

        for (const resource of result.resources) {
            const context = resource.context?.custom;
            if (context?.scheduled_delete_date) {
                const deleteDate = new Date(context.scheduled_delete_date);
                if (deleteDate <= now) {
                    toDelete.push(resource.public_id);
                }
            }
        }

        if (toDelete.length > 0) {
            console.log(`🗑️ Deleting ${toDelete.length} expired assets: ${toDelete.join(', ')}`);
            await cloudinary.api.delete_resources(toDelete);
            console.log("✅ Hard Delete Complete.");
        } else {
            console.log("✅ No assets ready for deletion yet.");
        }

    } catch (error) {
        console.error("❌ Cloudinary Hard Delete Error:", error.message);
    }
};

module.exports = { uploadFile, deleteFile, softDeleteAsset, deleteExpiredAssets };
