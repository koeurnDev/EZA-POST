/**
 * 🍌 AI Image Tools API
 * Handles:
 * 1. Watermark Removal (Nano-Banana Pro)
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { requireAuth } = require("../../utils/auth");

// 📂 Multer Setup (Temp storage)
const upload = multer({ dest: path.join(__dirname, "../../temp/uploads") });

/* -------------------------------------------------------------------------- */
/* 🍌 POST /remove-watermark — Nano-Banana Pro (Watermark Remover)           */
/* -------------------------------------------------------------------------- */
router.post("/remove-watermark", requireAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });

        console.log("🍌 Nano-Banana Pro (Local): Removing watermark for", req.file.filename);

        const { exec } = require("child_process");
        const scriptPath = path.join(__dirname, "../../scripts/remove_watermark.py");

        // 🔧 FIX: Detect OS to choose python command
        const isWin = process.platform === "win32";
        let pythonCmd = isWin ? "python" : "python3";
        let env = { ...process.env };

        if (!isWin) {
            try {
                // 1. Get location of python3
                const whichPython = require("child_process").execSync("which python3").toString().trim();
                console.log(`🐍 System Python Path: ${whichPython}`);

                // 2. Get user site-packages
                const sitePackages = require("child_process").execSync("python3 -m site --user-site").toString().trim();
                console.log(`📦 Python Site Packages: ${sitePackages}`);

                // 3. Force PYTHONPATH
                env.PYTHONPATH = sitePackages + ":" + (process.env.PYTHONPATH || "");

                // 4. Update python command to use absolute path if found
                if (whichPython) pythonCmd = whichPython;

            } catch (e) {
                console.warn("⚠️ Failed to detect Python environment:", e.message);
            }
        }

        // 🔧 FIX: Rename file to include extension (OpenCV requires it)
        const originalExt = path.extname(req.file.originalname) || ".png";
        const imagePath = req.file.path + originalExt;
        fs.renameSync(req.file.path, imagePath);

        const position = req.body.position || "br"; // Default to Bottom-Right

        // Command to run python script
        const command = `"${pythonCmd}" "${scriptPath}" "${imagePath}" "${position}"`;
        console.log("🚀 Executing:", command);

        exec(command, { env: env }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Python Script Error: ${error.message}`);
                console.error(`❌ Stderr: ${stderr}`);
                return res.status(500).json({
                    success: false,
                    error: "Failed to process image locally.",
                    debug: {
                        message: error.message,
                        stderr: stderr,
                        stdout: stdout
                    }
                });
            }
            if (stderr) {
                console.log(`⚠️ Python Stderr (Warning?): ${stderr}`);
            }

            // The script prints the output path to stdout (look for OUTPUT: prefix)
            const match = stdout.match(/OUTPUT: (.*)/);
            const outputFullPath = match ? match[1].trim() : null;

            if (!outputFullPath || !fs.existsSync(outputFullPath)) {
                console.error("❌ Output file not found or invalid stdout:", stdout);
                return res.status(500).json({ success: false, error: "Image processing failed. Script returned no valid path." });
            }

            const filename = path.basename(outputFullPath);

            // Delete original upload (optional, script might have done it or we keep it)
            // fs.unlinkSync(req.file.path); 

            res.json({
                success: true,
                provider: "Nano-Banana Pro (Local UI) 🔥",
                url: `/uploads/temp/uploads/${filename}` // Static serve path
            });
        });

    } catch (err) {
        // Cleanup: Try to delete the file (either original or renamed)
        if (req.file) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            // Also check for potential renamed file if we failed mid-rename (unlikely but safe)
            const ext = path.extname(req.file.originalname) || ".png";
            if (fs.existsSync(req.file.path + ext)) fs.unlinkSync(req.file.path + ext);
        }

        console.error("❌ Watermark Removal Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to remove watermark" });
    }
});

module.exports = router;
