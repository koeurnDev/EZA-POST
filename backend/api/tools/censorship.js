const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const censorshipService = require('../../services/censorshipService');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/uploads/videos/censorship');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'censor-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// @route   POST /api/tools/censorship/process
// @desc    Upload video and auto-censor logos/text
// @access  Private (TODO: Add auth middleware if needed)
router.post('/process', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No video file uploaded' });
    }

    try {
        const inputPath = req.file.path;
        const outputDir = path.dirname(inputPath);

        // Call the service
        const censoredFilename = await censorshipService.censorVideo(inputPath, outputDir);

        // Construct public URL
        const downloadUrl = `${req.protocol}://${req.get('host')}/api/tools/censorship/download/${censoredFilename}`;

        res.json({
            success: true,
            data: {
                message: 'Video processed successfully',
                downloadUrl: downloadUrl,
                originalName: req.file.originalname
            }
        });

    } catch (err) {
        console.error('Censorship API Error:', err);
        res.status(500).json({ success: false, error: 'Failed to censor video. ' + err.message });
    }
});

// @route   GET /api/tools/censorship/download/:filename
// @desc    Download processed video
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../public/uploads/videos/censorship', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ success: false, error: 'File not found' });
    }
});

module.exports = router;
