const ytDlpExec = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

// 🛠️ Wrapper to unify usage
// youtube-dl-exec returns a promise that resolves to the output (stdout or formatted object)

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
            ...options
        };

        // Handles flatPlaylist mapping
        if (options.flatPlaylist) flags.flatPlaylist = true;
        if (options.playlistEnd) flags.playlistEnd = options.playlistEnd;

        const output = await ytDlpExec(url, flags);
        return output;
    } catch (err) {
        throw new Error(`yt-dlp lookup failed: ${err.message}`);
    }
};

/**
 * Streams video content.
 * Note: youtube-dl-exec is a promise wrapper, but it exposes the child process via .exec()
 * However, simpler to use raw spawn for streaming if we know where the binary is.
 * youtube-dl-exec downloads the binary to node_modules/youtube-dl-exec/bin/yt-dlp
 */
const stream = (url, res) => {
    // We need to find the binary path that youtube-dl-exec uses
    const ytDlpBinary = require('youtube-dl-exec/src/constants').YOUTUBE_DL_PATH || 'yt-dlp';

    // Fallback to searching in node_modules if the constant isn't exposed (it varies by version)
    // Actually, asking youtube-dl-exec to stream to stdout is effectively just running it.

    // Let's use the 'exec' method which gives us the process
    const subprocess = ytDlpExec.exec(url, {
        output: '-',
        format: 'best',
        noPart: true,
        noCacheDir: true,
        noCheckCertificates: true,
        noWarnings: true
    });

    subprocess.stdout.pipe(res);

    subprocess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('ERROR')) console.error("❌ yt-dlp stream stderr:", msg);
    });

    return subprocess;
};

/**
 * Downloads file to local path
 */
const download = (url, outputPath, options = {}) => {
    return ytDlpExec(url, {
        output: outputPath,
        noWarnings: true,
        noCheckCertificates: true,
        format: options.format,
        cookies: options.cookies
    });
};

module.exports = {
    lookup,
    stream,
    download
};
