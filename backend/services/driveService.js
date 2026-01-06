const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configure Auth
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// We expect `GOOGLE_APPLICATION_CREDENTIALS` env var to point to the service account JSON
// Or we can manually load it. For simplicity in this demo, let's assume env var or a key file path.
const KEY_FILE_PATH = path.join(__dirname, '../service_account_key.json');

/**
 * Authenticates with Google Drive API.
 */
const getDriveClient = async () => {
    // If the key file doesn't exist, we can't authenticate.
    // In a real app, user would upload this or set env vars.
    // Debugging Path
    console.log("🔍 Checking Key Path:", KEY_FILE_PATH);
    console.log("   👉 Exists?", fs.existsSync(KEY_FILE_PATH));
    console.log("   👉 CWD:", process.cwd());

    if (!fs.existsSync(KEY_FILE_PATH)) {
        // Fallback: Try looking in CWD
        const fallbackPath = path.join(process.cwd(), 'service_account_key.json');
        console.log("🔍 Checking Fallback Path:", fallbackPath);
        if (fs.existsSync(fallbackPath)) {
            // If found, use it (hacky override for this scope)
            // We'll just return a client using this path
            const auth = new google.auth.GoogleAuth({
                keyFile: fallbackPath,
                scopes: SCOPES,
            });
            return google.drive({ version: 'v3', auth });
        }

        throw new Error(`Service Account Key file not found at ${KEY_FILE_PATH} or ${fallbackPath}`);
    }
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: SCOPES,
    });

    return google.drive({ version: 'v3', auth });
};

/**
 * Uploads a file to Google Drive.
 * @param {string} filePath - Absolute path to local file.
 * @param {string} folderId - Destination Folder ID (optional).
 */
exports.uploadFile = async (filePath, folderId = null, mimeType = null, targetMimeType = null) => {
    try {
        const drive = await getDriveClient();
        const fileName = path.basename(filePath);

        const fileMetadata = {
            name: fileName,
            parents: folderId ? [folderId] : [], // If null, uploads to root
        };

        // If targetMimeType is set, Drive will attempt to convert the uploaded file to this format
        if (targetMimeType) {
            fileMetadata.mimeType = targetMimeType;
        }

        const media = {
            mimeType: mimeType || 'application/octet-stream',
            body: fs.createReadStream(filePath),
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
        });

        console.log(`Uploaded to Drive: ${response.data.name} (${response.data.id})`);
        return response.data;

    } catch (error) {
        console.error("Google Drive Upload Error:", error.message);
        throw new Error("Failed to upload to Google Drive: " + error.message);
    }
};

/**
 * Exports a file from Google Drive to a specific MIME type.
 * @param {string} fileId - The ID of the file to export.
 * @param {string} mimeType - The MIME type to export to (e.g., 'application/pdf').
 * @returns {Promise<Buffer>} - The exported file as a buffer.
 */
exports.convertFile = async (fileId, mimeType) => {
    try {
        const drive = await getDriveClient();

        const response = await drive.files.export({
            fileId: fileId,
            mimeType: mimeType,
        }, {
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error("Google Drive Export Error:", error.message);
        throw new Error("Failed to export from Google Drive: " + error.message);
    }
};

/**
 * Deletes a file from Google Drive.
 * @param {string} fileId - The ID of the file to delete.
 */
exports.deleteFile = async (fileId) => {
    try {
        const drive = await getDriveClient();
        await drive.files.delete({
            fileId: fileId,
        });
        console.log(`Deleted from Drive: ${fileId}`);
    } catch (error) {
        console.error("Google Drive Delete Error:", error.message);
        // Don't throw, just log usage
    }
};
