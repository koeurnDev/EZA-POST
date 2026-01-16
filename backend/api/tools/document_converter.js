const express = require('express');
const router = express.Router();
const driveService = require('../../services/driveService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure Multer for temp storage
const upload = multer({ dest: 'uploads/' });

const { spawn } = require('child_process');

// @route   POST /api/tools/document-converter/convert
// @desc    Convert document to PDF using Local Microsoft Office
router.post('/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    // Rename temp file to have correct extension
    let localFilePath = path.resolve(req.file.path);
    const newFilePath = localFilePath + ext;
    fs.renameSync(localFilePath, newFilePath);
    localFilePath = newFilePath;

    // Determine Output Format
    const targetFormat = req.body.format || 'pdf'; // Default to PDF
    let outputExtension = '.' + targetFormat;
    let mimeType = 'application/pdf';

    if (targetFormat === 'docx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (targetFormat === 'pptx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }

    const outputFilePath = path.resolve(req.file.path + '_converted' + outputExtension);

    try {
        console.log(`Processing conversion: ${originalName} -> ${outputExtension} (Env: ${process.env.NODE_ENV})`);

        // --------------------------------------------------------------------------
        // 1. CHOOSE CONVERSION METHOD
        // --------------------------------------------------------------------------

        // 🟢 METHOD A: PDF to DOCX/PPTX (Uses Python's pdf2docx)
        if (ext === '.pdf' && (targetFormat === 'docx' || targetFormat === 'pptx')) {
            const pythonCmd = process.env.NODE_ENV === 'production' ? 'python3' : 'python';
            const pyScript = path.resolve(__dirname, '../../scripts/pdf_to_docx_py.py');

            // Step 1: PDF -> DOCX
            const tempDocx = targetFormat === 'docx' ? outputFilePath : path.resolve(req.file.path + '_temp.docx');

            await new Promise((resolve, reject) => {
                const py = spawn(pythonCmd, [pyScript, localFilePath, tempDocx]);
                py.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Python failed: ${code}`)));
                py.on('error', reject);
            });

            // Step 2: DOCX -> PPTX (If requested)
            if (targetFormat === 'pptx') {
                if (process.env.NODE_ENV === 'production') {
                    // ☁️ Production (Linux): Use Google Drive for DOCX -> PPTX (Indirect)
                    const uploaded = await driveService.uploadFile(tempDocx, null, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.google-apps.document');
                    const buffer = await driveService.convertFile(uploaded.id, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
                    fs.writeFileSync(outputFilePath, buffer);
                    await driveService.deleteFile(uploaded.id);
                } else {
                    // 💻 Local (Windows): Use PowerShell
                    const psScript = path.resolve(__dirname, '../../scripts/convert_office.ps1');
                    await runPowerShell(psScript, tempDocx, outputFilePath);
                }
            }
        }

        // 🟢 METHOD B: Office to PDF/Other
        else {
            if (process.env.NODE_ENV === 'production') {
                // ☁️ Production (Linux): Use Google Drive API
                console.log("☁️ Using Google Drive for cloud conversion...");

                // Map local MIME to Google Apps MIME for auto-conversion on upload
                let uploadMime = 'application/octet-stream';
                let googleAppsMime = null;

                if (ext === '.docx' || ext === '.doc') {
                    uploadMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    googleAppsMime = 'application/vnd.google-apps.document';
                } else if (ext === '.pptx' || ext === '.ppt') {
                    uploadMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    googleAppsMime = 'application/vnd.google-apps.presentation';
                }

                // Upload & Convert to Google Doc/Slide
                const uploaded = await driveService.uploadFile(localFilePath, null, uploadMime, googleAppsMime);

                // Export as PDF
                const exportMime = 'application/pdf';
                const buffer = await driveService.convertFile(uploaded.id, exportMime);

                fs.writeFileSync(outputFilePath, buffer);

                // Cleanup Drive
                await driveService.deleteFile(uploaded.id);

            } else {
                // 💻 Local (Windows): Use PowerShell + MS Office
                console.log("💻 Using Local MS Office via PowerShell...");
                const psScript = path.resolve(__dirname, '../../scripts/convert_office.ps1');
                await runPowerShell(psScript, localFilePath, outputFilePath);
            }
        }

        // --------------------------------------------------------------------------
        // 2. SEND THE CONVERTED FILE
        // --------------------------------------------------------------------------
        if (fs.existsSync(outputFilePath)) {
            const fileData = fs.readFileSync(outputFilePath);
            res.setHeader('Content-Type', mimeType);
            const finalFilename = `${path.basename(originalName, path.extname(originalName))}${outputExtension}`;
            const utf8Name = encodeURIComponent(finalFilename);
            const asciiName = finalFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
            res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);
            res.send(fileData);

            // Housekeeping
            setTimeout(() => {
                if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
                const tempDocxFallback = path.resolve(req.file.path + '_temp.docx');
                if (fs.existsSync(tempDocxFallback)) fs.unlinkSync(tempDocxFallback);
            }, 2000);
        } else {
            throw new Error("Conversion engine failed to produce output.");
        }

    } catch (err) {
        console.error('Conversion Error:', err);
        res.status(500).json({ success: false, error: "Conversion Failed: " + err.message });
    } finally {
        // 3. Cleanup Input File
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
    }
});

// Helper for PS
function runPowerShell(scriptPath, inputFile, outputFile) {
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
        const ps = spawn('powershell', [
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-InputFile', inputFile,
            '-OutputFile', outputFile
        ]);
        ps.stdout.on('data', d => console.log(`PS: ${d}`));
        ps.stderr.on('data', d => console.error(`PS Err: ${d}`));
        ps.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`PowerShell exited with code ${code}`));
        });
        ps.on('error', reject);
    });
}

module.exports = router;
