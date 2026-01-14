const fs = require('fs');
const path = require('path');

// ⚙️ Configuration
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run check every 5 minutes
const MAX_FILE_AGE_MS = 15 * 60 * 1000;    // Keep files for 15 minutes

// 📂 Target Directories
const TARGET_DIRS = [
    path.join(__dirname, '../temp/videos'),
    path.join(__dirname, '../temp/slideshows')
];

/**
 * 🧹 Clean a specific directory
 */
const cleanDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) return;

    fs.readdir(dirPath, (err, files) => {
        if (err) {
            console.error(`❌ [Cleaner] Failed to read dir ${dirPath}:`, err.message);
            return;
        }

        const now = Date.now();
        let deletedCount = 0;

        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;

                // Check if file is older than MAX age
                if (now - stats.mtimeMs > MAX_FILE_AGE_MS) {
                    // Recursive delete for directories (slideshow folders)
                    if (stats.isDirectory()) {
                        fs.rm(filePath, { recursive: true, force: true }, (err) => {
                            if (!err) console.log(`🧹 [Cleaner] Removed old folder: ${file}`);
                        });
                    } else {
                        // Delete file
                        fs.unlink(filePath, (err) => {
                            if (!err) {
                                // console.log(`🧹 [Cleaner] Removed old file: ${file}`);
                                deletedCount++;
                            }
                        });
                    }
                }
            });
        });
    });
};

/**
 * 🚀 Start the Cleanup Job
 */
const startTempCleanupJob = () => {
    console.log(`🧹 [Cleaner] Started. Interval: 5m, Retention: 15m`);

    // Run immediately on start
    TARGET_DIRS.forEach(dir => cleanDirectory(dir));

    // Schedule periodic run
    setInterval(() => {
        TARGET_DIRS.forEach(dir => cleanDirectory(dir));
    }, CLEANUP_INTERVAL_MS);
};

module.exports = { startTempCleanupJob };
