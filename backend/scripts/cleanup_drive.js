const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Path to your service account key
const KEY_FILE_PATH = path.join(__dirname, '../service_account_key.json');

// Scopes
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function cleanDrive() {
    try {
        console.log("🔑 Authenticating...");
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });

        const drive = google.drive({ version: 'v3', auth });

        // Check Quota
        console.log("📊 Checking Quota...");
        const about = await drive.about.get({ fields: 'storageQuota' });
        console.log("   👉 Usage:", (about.data.storageQuota.usage / 1024 / 1024).toFixed(2), "MB");
        console.log("   👉 Limit:", (about.data.storageQuota.limit / 1024 / 1024).toFixed(2), "MB");

        // 1. Empty Trash
        console.log("🗑️ Emptying Trash...");
        try {
            await drive.files.emptyTrash();
            console.log("   ✅ Trash emptied.");
        } catch (e) {
            console.error("   ⚠️ Failed to empty trash (might be empty already):", e.message);
        }

        console.log("📂 Listing ALL files (including trashed)...");
        let pageToken = null;
        let fileIds = [];

        do {
            const res = await drive.files.list({
                pageSize: 100,
                // q: "trashed = false", // Default is usually untrashed, let's look for everything
                fields: 'nextPageToken, files(id, name, size, trashed)',
                pageToken: pageToken,
            });

            const files = res.data.files;
            if (files.length) {
                files.forEach((file) => {
                    fileIds.push(file);
                });
            }
            pageToken = res.data.nextPageToken;
        } while (pageToken);

        console.log(`found ${fileIds.length} files.`);

        if (fileIds.length === 0) {
            console.log("✅ Drive is already empty.");
            return;
        }

        console.log("🗑️ Deleting files...");
        for (const file of fileIds) {
            try {
                console.log(`   - Deleting: ${file.name} (${file.id}) - ${file.size || 0} bytes`);
                await drive.files.delete({ fileId: file.id });
            } catch (err) {
                console.error(`   ❌ Failed to delete ${file.id}:`, err.message);
            }
        }

        console.log("🎉 Cleanup complete! Drive should now have free space.");

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

cleanDrive();
