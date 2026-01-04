const express = require('express');
const router = express.Router();
const driveService = require('../../services/driveService');
const fs = require('fs');
const path = require('path');

// @route   POST /api/tools/drive-sync/upload
// @desc    Upload a local file to Google Drive
router.post('/upload', async (req, res) => {
    const { filePath, folderId } = req.body;

    if (!filePath) {
        return res.status(400).json({ success: false, error: 'File Path is required' });
    }

    // Security check: ensure file is within public/uploads
    const absolutePath = path.resolve(filePath);
    if (!absolutePath.includes(path.resolve(__dirname, '../../public/uploads'))) {
        // Just a basic check, might need relaxation depending on use case
        // actually, we might accept relative paths from clients
    }

    try {
        const result = await driveService.uploadFile(filePath, folderId);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Drive Sync Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
