const express = require('express');
const router = express.Router();
const scriptService = require('../../services/scriptService');

// @route   POST /api/tools/script/generate
// @desc    Generate a video script from a topic
// @access  Private (TODO: Auth)
router.post('/generate', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic) {
            return res.status(400).json({ success: false, error: 'Topic is required' });
        }

        const script = await scriptService.generateScript(topic);

        res.json({
            success: true,
            data: {
                script: script
            }
        });

    } catch (err) {
        console.error('Script API Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
