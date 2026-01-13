// 🛠️ Simple wrapper to use system installed yt-dlp (via pip)
// avoiding youtube-dl-exec npm package issues on Render

const { spawn, execFile } = require('child_process');
const path = require('path');

// Helper to run yt-dlp with arguments
const runYtDlp = (args, options = {}) => {
    return new Promise((resolve, reject) => {
        // Detect OS and command
        const command = 'yt-dlp'; // Assumes it's in PATH (installed via pip)

        const child = spawn(command, args, {
            maxBuffer: 1024 * 1024 * 50, // 50MB buffer
            ...options
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data;
        });

        child.stderr.on('data', (data) => {
            stderr += data;
        });

        child.on('close', (code) => {
            if (code !== 0) {
                // If it fails, reject with stderr
                reject(new Error(stderr || `yt-dlp process exited with code ${code}`));
            } else {
                // Try to parse JSON if requested
                try {
                    if (args.includes('--dump-json') || args.includes('-j')) {
                        // Sometimes yt-dlp outputs warnings before JSON, so we look for the last valid JSON line or trim
                        const lines = stdout.trim().split('\n');
                        const jsonLine = lines.find(l => l.startsWith('{'));
                        if (jsonLine) {
                            resolve(JSON.parse(jsonLine));
                        } else {
                            resolve(stdout);
                        }
                    } else {
                        resolve(stdout);
                    }
                } catch (e) {
                    resolve(stdout);
                }
            }
        });

        child.on('error', (err) => {
            reject(new Error(`Failed to start yt-dlp: ${err.message}`));
        });
    });
};

/**
 * Executes yt-dlp with arguments and returns JSON output (Promisified)
 */
const lookup = async (url, options = {}) => {
    try {
        const args = [
            url,
            '--dump-json',
            '--no-warnings',
            '--no-check-certificates',
            '--prefer-free-formats',
            '--no-playlist',
            '--ffmpeg-location', require('ffmpeg-static')
        ];

        // Handles options
        if (options.flatPlaylist) args.push('--flat-playlist');
        if (options.playlistEnd) args.push('--playlist-end', options.playlistEnd);
        if (options.userAgent) args.push('--user-agent', options.userAgent);

        const output = await runYtDlp(args);
        return output;
    } catch (err) {
        throw new Error(`yt-dlp lookup failed: ${err.message}`);
    }
};

/**
 * Streams video content.
 * Returns the child process.
 */
const stream = (url, res) => {
    const command = 'yt-dlp';

    // Arguments for streaming to stdout
    const args = [
        url,
        '-o', '-',
        '-f', 'best',
        '--no-part', // Write directly, no .part files
        '--no-cache-dir',
        '--no-check-certificates',
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--ffmpeg-location', require('ffmpeg-static')
    ];

    const subprocess = spawn(command, args);

    subprocess.stdout.pipe(res);

    subprocess.stderr.on('data', (data) => {
        const msg = data.toString();
        // Ignore progress bars or small info
        if (msg.includes('ERROR')) console.error("❌ yt-dlp stream stderr:", msg);
    });

    return subprocess;
};

/**
 * Downloads file to local path
 */
const download = (url, outputPath, options = {}) => {
    const ffmpegPath = require('ffmpeg-static');
    const args = [
        url,
        '-o', outputPath,
        '--no-warnings',
        '--no-check-certificates',
        '--ffmpeg-location', ffmpegPath
    ];

    if (options.format) args.push('-f', options.format);
    if (options.cookies) args.push('--cookies', options.cookies);
    if (options.userAgent) args.push('--user-agent', options.userAgent);

    return runYtDlp(args);
};

module.exports = {
    lookup,
    stream,
    download
};
