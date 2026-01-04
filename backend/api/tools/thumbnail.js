const express = require('express');
const router = express.Router();
const thumbnailService = require('../../services/thumbnailService');

// @route   POST /api/tools/thumbnail/generate
// @desc    Generate a thumbnail from a topic
// @access  Private (TODO: Auth)
router.post('/generate', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic) {
            return res.status(400).json({ success: false, error: 'Topic is required' });
        }

        const imageUrl = await thumbnailService.generateThumbnail(topic);

        res.json({
            success: true,
            data: {
                imageUrl: imageUrl
            }
        });

    } catch (err) {
        console.error('Thumbnail API Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
