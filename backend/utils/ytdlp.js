/**
 * ============================================================
 * 🛠️ Native Space-Safe Wrapper for yt-dlp
 * ============================================================
 * Replaces tinyspawn / youtube-dl-exec which crashes on paths
 * with spaces (e.g. "D:\EZA POST") due to buggy `input.split(' ')`.
 * 
 * Uses Node child_process.execFile and spawn directly.
 * ============================================================
 */

const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let ffmpegPath = null;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (e) {}

/**
 * 🔍 Locate yt-dlp binary across environments
 */
function getBinaryPath() {
    // 1. Explicit environment variable override
    if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
        return process.env.YTDLP_PATH;
    }

    // 2. Production / Render binary directory
    const prodBin = path.join(__dirname, '../bin/yt-dlp');
    if (fs.existsSync(prodBin)) return prodBin;
    if (fs.existsSync(prodBin + '.exe')) return prodBin + '.exe';

    // 3. Bundled node_modules binary from youtube-dl-exec
    const nmBinWin = path.join(__dirname, '../node_modules/youtube-dl-exec/bin/yt-dlp.exe');
    if (fs.existsSync(nmBinWin)) return nmBinWin;

    const nmBin = path.join(__dirname, '../node_modules/youtube-dl-exec/bin/yt-dlp');
    if (fs.existsSync(nmBin)) return nmBin;

    // 4. Fallback to system PATH
    return 'yt-dlp';
}

/**
 * Convert JS flags object to CLI arguments
 */
function flagsToArgs(flags = {}) {
    const args = [];
    for (const [key, val] of Object.entries(flags)) {
        if (key === 'execPath' || val === undefined || val === null) continue;

        // Convert camelCase to kebab-case
        const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

        if (val === true) {
            args.push(`--${kebab}`);
        } else if (val === false) {
            if (kebab.startsWith('no-')) {
                args.push(`--yes-${kebab.slice(3)}`);
            } else {
                args.push(`--no-${kebab}`);
            }
        } else {
            args.push(`--${kebab}`, String(val));
        }
    }
    return args;
}

/**
 * 🚀 Callable Function: Matches youtube-dl-exec signature
 * ytdlp(url, flags, options)
 */
function ytdlp(url, flags = {}, options = {}) {
    return new Promise((resolve, reject) => {
        const bin = options.execPath || getBinaryPath();
        const cliArgs = [];

        // Add auto ffmpeg location if available
        if (ffmpegPath && !flags.ffmpegLocation) {
            flags.ffmpegLocation = ffmpegPath;
        }

        cliArgs.push(...flagsToArgs(flags));
        if (url) cliArgs.push(url);

        const execOptions = {
            maxBuffer: 50 * 1024 * 1024, // 50MB for large channel metadata
            windowsHide: true,
            ...options
        };

        execFile(bin, cliArgs, execOptions, (error, stdout, stderr) => {
            if (error) {
                const enhancedError = new Error(stderr || error.message);
                enhancedError.code = error.code;
                enhancedError.stderr = stderr;
                enhancedError.stdout = stdout;
                return reject(enhancedError);
            }

            const trimmed = (stdout || '').trim();
            if (flags.dumpSingleJson || flags.dumpJson) {
                try {
                    return resolve(JSON.parse(trimmed));
                } catch (parseErr) {
                    return resolve(trimmed);
                }
            }
            resolve(trimmed);
        });
    });
}

/**
 * 🔍 Lookup: Returns parsed video/playlist JSON metadata
 */
async function lookup(url, options = {}) {
    const flags = {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        noPlaylist: !options.flatPlaylist,
        ...options
    };

    return ytdlp(url, flags, { execPath: getBinaryPath() });
}

/**
 * 📥 Download: Saves video directly to outputPath
 */
async function download(url, outputPath, options = {}) {
    const flags = {
        output: outputPath,
        noWarnings: true,
        noCheckCertificates: true,
        noPlaylist: true,
        ...options
    };

    return ytdlp(url, flags, { execPath: getBinaryPath() });
}

/**
 * 🌊 Stream: Pipes stdout video stream directly to response
 */
function stream(url, res, options = {}) {
    const bin = options.execPath || getBinaryPath();
    const flags = {
        output: '-',
        format: 'best',
        noPart: true,
        noCacheDir: true,
        noCheckCertificates: true,
        noWarnings: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options
    };

    if (ffmpegPath && !flags.ffmpegLocation) {
        flags.ffmpegLocation = ffmpegPath;
    }

    const cliArgs = [...flagsToArgs(flags), url];
    const subprocess = spawn(bin, cliArgs, { windowsHide: true });

    subprocess.stdout.pipe(res);

    subprocess.stderr.on('data', (chunk) => {
        const msg = chunk.toString();
        if (msg.includes('ERROR')) {
            console.error('❌ yt-dlp stream error:', msg);
        }
    });

    return subprocess;
}

// Support both callable function and named methods
module.exports = ytdlp;
module.exports.ytdlp = ytdlp;
module.exports.lookup = lookup;
module.exports.download = download;
module.exports.stream = stream;
module.exports.getBinaryPath = getBinaryPath;
