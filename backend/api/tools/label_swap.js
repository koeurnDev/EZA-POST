const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const labelSwapService = require('../../services/labelSwapService');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/uploads/videos/labelswap');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'swap-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// @route   POST /api/tools/label-swap/process
// @desc    Upload video & logo, and swap label based on ROI
router.post('/process', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
    try {
        if (!req.files || !req.files.video || !req.files.logo) {
            return res.status(400).json({ success: false, error: 'Video and Logo are required.' });
        }

        const videoPath = req.files.video[0].path;
        const logoPath = req.files.logo[0].path;
        const roi = req.body.roi; // expected format: "x,y,w,h"

        if (!roi) {
            return res.status(400).json({ success: false, error: 'ROI (Region of Interest) is required.' });
        }

        const outputDir = path.dirname(videoPath);

        // Call Service
        const swappedFilename = await labelSwapService.swapLabel(videoPath, logoPath, roi, outputDir);

        const downloadUrl = `${req.protocol}://${req.get('host')}/api/tools/label-swap/download/${swappedFilename}`;

        res.json({
            success: true,
            data: {
                message: 'Label swapped successfully',
                downloadUrl: downloadUrl,
                originalName: req.files.video[0].originalname
            }
        });

    } catch (err) {
        console.error('Label Swap API Error:', err);
        res.status(500).json({ success: false, error: 'Failed to process video. ' + err.message });
    }
});

// @route   GET /api/tools/label-swap/download/:filename
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../public/uploads/videos/labelswap', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ success: false, error: 'File not found' });
    }
});

module.exports = router;
