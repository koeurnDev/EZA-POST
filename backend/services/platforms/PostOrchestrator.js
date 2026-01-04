/**
 * 🎻 Post Orchestrator - Conducts the multi-platform symphony
 */
const YouTubeService = require('./YouTubeService');
// const TikTokService = require('./TikTokService');
// const FacebookService = require('./FacebookService'); // (Our existing logic refactored)

exports.publishToPlatforms = async (post, videoPath) => {
    const results = [];

    // 1. YouTube
    if (post.platforms.some(p => p.name === 'youtube')) {
        try {
            const ytResult = await YouTubeService.uploadVideo(
                post.userId,
                videoPath,
                post.caption, // YouTube Title
                post.caption  // YouTube Description
            );

            // Update Post Status
            updatePlatformStatus(post, 'youtube', 'published', ytResult.platformId);
            results.push({ platform: 'youtube', success: true });
        } catch (err) {
            updatePlatformStatus(post, 'youtube', 'failed', null, err.message);
            results.push({ platform: 'youtube', success: false, error: err.message });
        }
    }

    // 2. TikTok (Future)
    // 3. Instagram (Future)

    // 4. Facebook (Existing Logic - handled separately or moved here)
    // For now, we assume Facebook is handled by the main controller's legacy logic or we refactor it.

    return results;
};

// Helper to update the post document immediately (or queued)
const updatePlatformStatus = async (post, platformName, status, externalId = null, error = null) => {
    const platform = post.platforms.find(p => p.name === platformName);
    if (platform) {
        platform.status = status;
        if (externalId) platform.postId = externalId;
        if (error) platform.error = error;
        await post.save();
    }
};
