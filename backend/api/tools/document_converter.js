const express = require("express");
const router = express.Router();
const driveService = require("../../services/driveService");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const { spawn } = require("child_process");
const { requireAuth } = require("../../utils/auth");
const {
    getOfficeMimeType,
    isSupportedConversion,
    matchesDocumentSignature,
    outputFormats,
} = require("../../utils/documentConversion");

const maxInputBytes = 25 * 1024 * 1024;
const conversionTempDir = path.join(os.tmpdir(), "eza-post-document-conversions");
fs.mkdirSync(conversionTempDir, { recursive: true });

const upload = multer({
    dest: conversionTempDir,
    limits: { fileSize: maxInputBytes, files: 1, fields: 2 },
});

function handleUpload(req, res, next) {
    upload.single("file")(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return res.status(status).json({
                success: false,
                error: error.code === "LIMIT_FILE_SIZE"
                    ? "Files must be 25 MiB or smaller."
                    : "Invalid document upload.",
            });
        }
        return next(error);
    });
}

async function removeTemporaryFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Failed to clean up document conversion file:", error);
        }
    }
}

async function readFileHeader(filePath) {
    const fileHandle = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(1024);
    let bytesRead;
    try {
        ({ bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0));
    } finally {
        await fileHandle.close();
    }
    return buffer.subarray(0, bytesRead);
}

router.post("/convert", requireAuth, handleUpload, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const inputPath = req.file.path;
    const inputExtension = path.extname(req.file.originalname).toLowerCase();
    const targetFormat = typeof req.body?.format === "string" ? req.body.format.toLowerCase() : "pdf";
    const outputFormat = outputFormats[targetFormat];
    let outputPath;
    let intermediatePath;
    let driveFileId;

    try {
        if (!outputFormat || !isSupportedConversion(inputExtension, targetFormat)) {
            return res.status(400).json({
                success: false,
                error: "This source and target format combination is not supported.",
            });
        }

        const fileHeader = await readFileHeader(inputPath);
        if (!matchesDocumentSignature(inputExtension, fileHeader)) {
            return res.status(415).json({
                success: false,
                error: "The uploaded file content does not match its supported document extension.",
            });
        }

        outputPath = `${inputPath}_converted${outputFormat.extension}`;
        intermediatePath = `${inputPath}_intermediate.docx`;
        const originalFilename = path.basename(req.file.originalname.replace(/[\\/]/g, path.sep));
        const finalFilename = `${path.basename(originalFilename, inputExtension)}${outputFormat.extension}`;

        console.log(`Processing document conversion: ${inputExtension} -> ${outputFormat.extension}`);

        if (inputExtension === ".pdf" && ["docx", "pptx"].includes(targetFormat)) {
            const pythonCmd = process.env.NODE_ENV === "production" ? "python3" : "python";
            const pyScript = path.resolve(__dirname, "../../scripts/pdf_to_docx_py.py");
            const docxPath = targetFormat === "docx" ? outputPath : intermediatePath;
            await runProcess(pythonCmd, [pyScript, inputPath, docxPath]);

            if (targetFormat === "pptx") {
                if (process.env.NODE_ENV === "production") {
                    const uploaded = await driveService.uploadFile(
                        docxPath,
                        null,
                        outputFormats.docx.mimeType,
                        "application/vnd.google-apps.document"
                    );
                    driveFileId = uploaded.id;
                    const buffer = await driveService.convertFile(
                        uploaded.id,
                        outputFormat.mimeType
                    );
                    await fs.promises.writeFile(outputPath, buffer);
                } else {
                    const psScript = path.resolve(__dirname, "../../scripts/convert_office.ps1");
                    await runPowerShell(psScript, docxPath, outputPath);
                }
            }
        } else if (process.env.NODE_ENV === "production") {
            const sourceMimeType = getOfficeMimeType(inputExtension);
            const googleMimeType = [".doc", ".docx"].includes(inputExtension)
                ? "application/vnd.google-apps.document"
                : "application/vnd.google-apps.presentation";
            const uploaded = await driveService.uploadFile(
                inputPath,
                null,
                sourceMimeType,
                googleMimeType
            );
            driveFileId = uploaded.id;
            const buffer = await driveService.convertFile(uploaded.id, outputFormat.mimeType);
            await fs.promises.writeFile(outputPath, buffer);
        } else {
            const psScript = path.resolve(__dirname, "../../scripts/convert_office.ps1");
            await runPowerShell(psScript, inputPath, outputPath);
        }

        const outputStats = await fs.promises.stat(outputPath);
        if (!outputStats.isFile() || outputStats.size === 0) {
            throw new Error("Conversion did not produce a valid output file.");
        }
        if (!matchesDocumentSignature(outputFormat.extension, await readFileHeader(outputPath))) {
            throw new Error("Conversion produced a file with an unexpected format.");
        }

        await new Promise((resolve, reject) => {
            res.download(outputPath, finalFilename, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    } catch (error) {
        console.error("Document conversion failed:", error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: "Document conversion failed. Check the file and try again.",
            });
        } else {
            res.destroy(error);
        }
    } finally {
        try {
            if (driveFileId) await driveService.deleteFile(driveFileId);
        } finally {
            await Promise.all([
                removeTemporaryFile(inputPath),
                outputPath && removeTemporaryFile(outputPath),
                intermediatePath && removeTemporaryFile(intermediatePath),
            ].filter(Boolean));
        }
    }
});

function runProcess(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { windowsHide: true });
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
            if (stderr.length > 4000) stderr = stderr.slice(-4000);
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${path.basename(command)} exited with code ${code}: ${stderr}`));
        });
    });
}

function runPowerShell(scriptPath, inputFile, outputFile) {
    return runProcess("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-InputFile",
        inputFile,
        "-OutputFile",
        outputFile,
    ]);
}

module.exports = router;
