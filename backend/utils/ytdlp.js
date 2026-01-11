const { spawn } = require('child_process');
const path = require('path');

// Helper to get binary (assumes system installed 'yt-dlp' on Linux, or local on Dev)
// On Render, user MUST install yt-dlp via build command: apt-get update && apt-get install -y yt-dlp
const getBinary = () => {
    return 'yt-dlp'; // Simple and clean. Relies on PATH.
};

/**
 * Executes yt-dlp with arguments and returns JSON output (Promisified)
 * Equivalent to: yt-dlp --dump-single-json ...
 */
const lookup = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const args = [
            url,
            '--dump-single-json',
            '--no-warnings',
            '--no-check-certificates',
            '--prefer-free-formats',
            '--no-playlist' // Default to single video unless specified
        ];

        // Add extra options
        if (options.flatPlaylist) args.push('--flat-playlist');
        if (options.playlistEnd) args.push('--playlist-end', options.playlistEnd);

        // Construct process
        const process = spawn(getBinary(), args);

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => stdout += data.toString());
        process.stderr.on('data', (data) => stderr += data.toString());

        process.on('close', (code) => {
            if (code === 0) {
                try {
                    const json = JSON.parse(stdout);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Failed to parse yt-dlp JSON: ' + e.message));
                }
            } else {
                reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
            }
        });

        process.on('error', (err) => {
            reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Is it installed?`));
        });
    });
};

/**
 * Streams video content to a writable stream (usually res)
 */
const stream = (url, res) => {
    const args = [
        url,
        '-o', '-',             // Output to stdout
        '-f', 'best',           // Best format
        '--no-part',
        '--no-cache-dir',
        '--no-check-certificates',
        '--no-warnings'
    ];

    const process = spawn(getBinary(), args);

    process.stdout.pipe(res);

    process.stderr.on('data', (data) => {
        // Log errors but don't crash stream instantly unless critical
        const msg = data.toString();
        if (msg.includes('ERROR')) console.error("❌ yt-dlp stream stderr:", msg);
    });

    process.on('close', (code) => {
        if (code !== 0) {
            console.error(`❌ yt-dlp stream exited with code ${code}`);
            // If headers aren't sent, we can send error
            if (!res.headersSent) res.status(502).send('Stream failed');
        }
    });

    // Return process to allow caller to kill it if needed
    return process;
};

/**
 * Downloads file to local path
 */
const download = (url, outputPath, options = {}) => {
    return new Promise((resolve, reject) => {
        const args = [
            url,
            '-o', outputPath,
            '--no-warnings',
            '--no-check-certificates'
        ];

        if (options.format) args.push('-f', options.format);
        if (options.cookies) args.push('--cookies', options.cookies);

        const process = spawn(getBinary(), args);

        process.stderr.on('data', d => console.log(`[yt-dlp] ${d}`)); // Verbose logging for download

        process.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`Download failed with code ${code}`));
        });
    });
};


module.exports = {
    lookup,
    stream,
    download
};
