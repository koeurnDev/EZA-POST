/**
 * 🪄 AI Image Tools API
 * Handles:
 * 1. Remove Background (remove.bg)
 * 2. Image Generation (OpenAI DALL-E 3)
 * 3. Image Analysis (Google Gemini Vision)
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { requireAuth } = require("../../utils/auth");
const OpenAI = require("openai"); // 🆕 OpenAI SDK

// 📂 Multer Setup (Temp storage)
const upload = multer({ dest: path.join(__dirname, "../../temp/uploads") });

/* -------------------------------------------------------------------------- */
/* ✂️ POST /remove-bg — Remove Background (via remove.bg)                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* ✂️ POST /remove-bg — Remove Background (Local rembg)                       */
/* -------------------------------------------------------------------------- */
router.post("/remove-bg", requireAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });

        console.log("✂️ Local AI: Removing background for", req.file.filename);

        const { exec } = require("child_process");
        const scriptPath = path.join(__dirname, "../../scripts/remove_bg.py");

        // 🔧 FIX: Rename file to include extension (PIL/OpenCV requires it)
        const originalExt = path.extname(req.file.originalname) || ".png";
        const imagePath = req.file.path + originalExt;
        fs.renameSync(req.file.path, imagePath);

        // Command to run python script
        const command = `python "${scriptPath}" "${imagePath}"`;
        console.log("🚀 Executing:", command);

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => { // 10MB buffer
            if (error) {
                console.error(`❌ Python Script Error: ${error.message}`);
                console.error(`❌ Stderr: ${stderr}`);
                return res.status(500).json({ success: false, error: "Failed to process image locally." });
            }

            // The script prints the output path to stdout (look for OUTPUT: prefix)
            const match = stdout.match(/OUTPUT: (.*)/);
            const outputFullPath = match ? match[1].trim() : null;

            if (!outputFullPath || !fs.existsSync(outputFullPath)) {
                console.error("❌ Output file not found or invalid stdout:", stdout);
                return res.status(500).json({ success: false, error: "Image processing failed." });
            }

            const filename = path.basename(outputFullPath);

            res.json({
                success: true,
                provider: "Local AI (rembg) 🚀",
                url: `/uploads/temp/uploads/${filename}`
            });
        });

    } catch (err) {
        // Cleanup
        if (req.file) {
            const ext = path.extname(req.file.originalname) || ".png";
            if (fs.existsSync(req.file.path + ext)) fs.unlinkSync(req.file.path + ext);
        }
        console.error("❌ Remove BG Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to process image" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🎨 POST /generate — Text to Image (OpenAI DALL-E 3)                        */
/* -------------------------------------------------------------------------- */
router.post("/generate", requireAuth, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ success: false, error: "Prompt is required" });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, error: "OpenAI API Key missing" });

        const openai = new OpenAI({ apiKey });

        console.log("🎨 Generating with OpenAI DALL-E 3...");

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json", // Get direct data
            quality: "standard",
        });

        const base64Image = response.data[0].b64_json;
        if (!base64Image) throw new Error("OpenAI returned no image.");

        // Save result
        const filename = `gen-dalle-${Date.now()}.png`;
        const outputPath = path.join(__dirname, "../../temp/uploads", filename);
        fs.writeFileSync(outputPath, Buffer.from(base64Image, "base64"));

        res.json({
            success: true,
            provider: "OpenAI DALL-E 3",
            url: `/uploads/temp/uploads/${filename}`
        });

    } catch (err) {
        console.error("❌ DALL-E 3 Error:", err.message);
        res.status(500).json({ success: false, error: err.message || "Failed to generate image" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🧠 POST /analyze — Gemini Vision                                          */
/* -------------------------------------------------------------------------- */
router.post("/analyze", requireAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, error: "Google API Key missing" });

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Convert file to correct format for Gemini
        const fileData = fs.readFileSync(req.file.path);
        const imagePart = {
            inlineData: {
                data: fileData.toString("base64"),
                mimeType: req.file.mimetype,
            },
        };

        const prompt = req.body.prompt || "Describe this image for social media captioning. Suggest 5 hashtags.";

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Cleanup
        fs.unlinkSync(req.file.path);

        res.json({ success: true, analysis: text });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error("❌ Gemini Vision Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to analyze image" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🍌 POST /remove-watermark — Nano-Banana Pro (Watermark Remover)           */
/* -------------------------------------------------------------------------- */
router.post("/remove-watermark", requireAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });

        console.log("🍌 Nano-Banana Pro (Local): Removing watermark for", req.file.filename);

        const { exec } = require("child_process");
        const scriptPath = path.join(__dirname, "../../scripts/remove_watermark.py");

        // 🔧 FIX: Rename file to include extension (OpenCV requires it)
        const originalExt = path.extname(req.file.originalname) || ".png";
        const imagePath = req.file.path + originalExt;
        fs.renameSync(req.file.path, imagePath);

        const position = req.body.position || "br"; // Default to Bottom-Right

        // Command to run python script
        const command = `python "${scriptPath}" "${imagePath}" "${position}"`;
        console.log("🚀 Executing:", command);

        exec(command, (error, stdout, stderr) => {
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
