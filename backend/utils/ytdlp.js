// 🛠️ Wrapper for youtube-dl-exec to ensure consistent binary usage
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

// Helper to get binary path (useful for production/Render)
const getBinaryPath = () => {
    // Check for explicit local binary override or production path
    return process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../bin/yt-dlp')
        : undefined; // Local dev: use node_modules binary from youtube-dl-exec
};

/**
 * Executes yt-dlp with arguments and returns JSON output (Promisified)
 */
const lookup = async (url, options = {}) => {
    try {
        const flags = {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificates: true,
            preferFreeFormats: true,
            noPlaylist: true,
            ffmpegLocation: require('ffmpeg-static')
        };

        // Handles options
        if (options.flatPlaylist) flags.flatPlaylist = true;
        if (options.playlistEnd) flags.playlistEnd = options.playlistEnd;
        if (options.userAgent) flags.userAgent = options.userAgent;
        if (options.cookies) flags.cookies = options.cookies;
        if (options.ignoreErrors) flags.ignoreErrors = true;

        const output = await youtubedl(url, flags, { execPath: getBinaryPath() });
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
    // For streaming, we use .exec() to get the subprocess
    const flags = {
        output: '-',
        format: 'best',
        noPart: true,
        noCacheDir: true,
        noCheckCertificates: true,
        noWarnings: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ffmpegLocation: require('ffmpeg-static')
    };

    // Direct stream
    const subprocess = youtubedl.exec(url, flags, { execPath: getBinaryPath() });

    // Pipe stdout to response
    subprocess.stdout.pipe(res);

    subprocess.stderr.on('data', (data) => {
        const msg = data.toString();
        // Ignore progress bars
        if (msg.includes('ERROR')) console.error("❌ yt-dlp stream stderr:", msg);
    });

    return subprocess;
};

/**
 * Downloads file to local path
 */
const download = (url, outputPath, options = {}) => {
    const flags = {
        output: outputPath,
        noWarnings: true,
        noCheckCertificates: true,
        ffmpegLocation: require('ffmpeg-static')
    };

    if (options.format) flags.format = options.format;
    if (options.cookies) flags.cookies = options.cookies;
    if (options.userAgent) flags.userAgent = options.userAgent;
    if (options.noPlaylist) flags.noPlaylist = true;
    if (options.ignoreErrors) flags.ignoreErrors = true;

    // Returns Promise
    return youtubedl(url, flags, { execPath: getBinaryPath() });
};

module.exports = {
    lookup,
    stream,
    download
};
