const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configure Auth
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// We expect `GOOGLE_APPLICATION_CREDENTIALS` env var to point to the service account JSON
// Or we can manually load it. For simplicity in this demo, let's assume env var or a key file path.
const KEY_FILE_PATH = path.join(__dirname, '../../service_account_key.json');

/**
 * Authenticates with Google Drive API.
 */
const getDriveClient = async () => {
    // If the key file doesn't exist, we can't authenticate.
    // In a real app, user would upload this or set env vars.
    if (!fs.existsSync(KEY_FILE_PATH)) {
        throw new Error("Service Account Key file not found. Please upload 'service_account_key.json' to the backend root.");
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
exports.uploadFile = async (filePath, folderId = null) => {
    try {
        const drive = await getDriveClient();
        const fileName = path.basename(filePath);

        const fileMetadata = {
            name: fileName,
            parents: folderId ? [folderId] : [], // If null, uploads to root
        };

        const media = {
            mimeType: 'video/mp4', // auto-detect ideally, but mostly mp4 here
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
