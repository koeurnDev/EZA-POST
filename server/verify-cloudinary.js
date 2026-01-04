const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function verifyCloudinary() {
    console.log('--- Verifying Cloudinary Configuration ---');

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    // 1. Check for basic API connectivity (Works on all Node versions)
    try {
        console.log('📡 Pinging Cloudinary API...');
        const res = await cloudinary.api.ping();
        if (res.status === 'ok') {
            console.log('✅ Cloudinary Connection Established (API Ping Passed).');
        }
    } catch (error) {
        console.error('❌ Cloudinary Connection Failed:', error.message);
        return;
    }

    // 2. Component Test: Try to simulate an upload if environment supports it
    if (majorVersion >= 18 && global.fetch && global.Blob && global.FormData) {
        console.log('\n--- Running Client-Side Upload Simulation (Node v18+) ---');

        const testFilePath = path.join(__dirname, 'uploads', 'angkeadey-1.png');
        if (!fs.existsSync(testFilePath)) {
            console.warn("⚠️ Test file not found for upload simulation:", testFilePath);
            return;
        }

        try {
            const fileBuffer = fs.readFileSync(testFilePath);
            const blob = new Blob([fileBuffer], { type: 'image/png' });
            const formData = new FormData();
            formData.append('image', blob, 'angkeadey-1.png');

            const res = await fetch('http://localhost:5001/api/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                console.log('Upload Response:', data);
                if (data.success && data.url.includes('cloudinary.com')) {
                    console.log('✅ [PASS] /api/upload endpoint is working correctly.');
                } else {
                    console.log('❌ [FAIL] /api/upload returned unexpected data.');
                }
            } else {
                console.log(`❌ [FAIL] Server returned status: ${res.status}`);
            }
        } catch (e) {
            console.error('❌ [FAIL] Error during upload simulation:', e.message);
            console.log('   (Ensure your server is running on port 5001)');
        }
    } else {
        console.log('\nℹ️ Skipping Client-Side Upload Simulation.');
        console.log('   Reason: Requires Node.js v18+ for native fetch/Blob support.');
        console.log('   Current Version:', nodeVersion);
        console.log('   (API credentials are verified via Ping, so your backend should likely work if configured correctly.)');
    }
}

// Run immediately
verifyCloudinary();
