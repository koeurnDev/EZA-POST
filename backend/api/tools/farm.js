const express = require('express');
const router = express.Router();
const farmService = require('../../services/farmService');
const warmupService = require('../../services/warmupService');
const multer = require('multer');
const path = require('path');

// Configure Multer for Story Uploads
const storage = multer.diskStorage({
    destination: './public/uploads/temp',
    filename: function (req, file, cb) {
        cb(null, 'story-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// @route   POST /api/tools/farm/story
// @desc    Mass Post Story
router.post('/story', upload.single('media'), async (req, res) => {
    try {
        const { accounts } = req.body; // Expect JSON string of account objects
        const mediaPath = req.file ? req.file.path : null;

        if (!accounts || !mediaPath) {
            return res.status(400).json({ success: false, error: 'Accounts and Media are required.' });
        }

        const parsedAccounts = JSON.parse(accounts);

        // Run in background (don't wait for all to finish if list is huge)
        // For this demo, we await to show results.
        const results = await farmService.massPostStory(parsedAccounts, path.resolve(mediaPath));

        res.json({ success: true, results });

    } catch (err) {
        console.error("Farm Story Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// @route   POST /api/tools/farm/warmup
// @desc    Start Warm-up for accounts
router.post('/warmup', async (req, res) => {
    try {
        const { accounts, duration } = req.body;
        const parsedAccounts = accounts; // Assuming JSON body parser handles it if sent as object

        if (!parsedAccounts || !Array.isArray(parsedAccounts)) {
            return res.status(400).json({ success: false, error: 'Valid Accounts list required.' });
        }

        // Trigger warmups (async, don't block)
        parsedAccounts.forEach(acc => {
            warmupService.warmupAccount(acc, duration || 5);
        });

        res.json({ success: true, message: `Started warm-up for ${parsedAccounts.length} accounts.` });

    } catch (err) {
        console.error("Farm Warmup Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
