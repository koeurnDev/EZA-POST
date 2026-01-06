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
        console.log(`Processing local conversion: ${originalName} -> ${outputExtension}`);

        // Special Case: PDF -> DOCX (Use Python if valid, else PS)
        // Special Case: PDF -> PPTX (PDF -> DOCX (Py) -> PPTX (PS))

        if (ext === '.pdf' && targetFormat === 'docx') {
            // Try Python first
            const pyScript = path.resolve(__dirname, '../../scripts/pdf_to_docx_py.py');
            try {
                await new Promise((resolve, reject) => {
                    const py = spawn('python', [pyScript, localFilePath, outputFilePath]);
                    py.stdout.on('data', (data) => console.log(`PY stdout: ${data}`));
                    py.stderr.on('data', (data) => console.error(`PY stderr: ${data}`));
                    py.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`Python script exited with code ${code}`));
                    });
                    py.on('error', (err) => reject(err));
                });
            } catch (pyErr) {
                console.warn("Python conversion failed, falling back to PowerShell:", pyErr);
                // Fallback to PowerShell
                const scriptPath = path.resolve(__dirname, '../../scripts/convert_office.ps1');
                await runPowerShell(scriptPath, localFilePath, outputFilePath);
            }

        } else if (ext === '.pdf' && targetFormat === 'pptx') {
            // PDF -> DOCX (Python) -> PPTX (PS)
            const tempDocx = path.resolve(req.file.path + '_temp.docx');
            const pyScript = path.resolve(__dirname, '../../scripts/pdf_to_docx_py.py');

            // Step 1: PDF -> DOCX
            await new Promise((resolve, reject) => {
                const py = spawn('python', [pyScript, localFilePath, tempDocx]);
                py.stdout.on('data', (data) => console.log(`PY stdout: ${data}`));
                py.stderr.on('data', (data) => console.error(`PY stderr: ${data}`));
                py.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Python (PDF->DOCX) failed with code ${code}`));
                });
                py.on('error', (err) => reject(err));
            });

            // Step 2: DOCX -> PPTX
            const scriptPath = path.resolve(__dirname, '../../scripts/convert_office.ps1');
            await runPowerShell(scriptPath, tempDocx, outputFilePath);

            // Cleanup temp intermediate
            if (fs.existsSync(tempDocx)) fs.unlinkSync(tempDocx);

        } else {
            // Standard PowerShell Conversion
            const scriptPath = path.resolve(__dirname, '../../scripts/convert_office.ps1');
            await runPowerShell(scriptPath, localFilePath, outputFilePath);
        }

        // 2. Check and Send Result
        if (fs.existsSync(outputFilePath)) {
            const fileData = fs.readFileSync(outputFilePath);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(originalName, path.extname(originalName))}${outputExtension}"`);
            res.send(fileData);

            // Cleanup Output
            setTimeout(() => {
                if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
            }, 1000);
        } else {
            throw new Error("Output file was not created.");
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
