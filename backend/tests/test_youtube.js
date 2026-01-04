const axios = require('axios');

async function testDownload() {
    try {
        console.log("🚀 Testing YouTube Download...");
        const response = await axios.post('http://localhost:5000/api/tools/youtube/download', {
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll (Always available)
            quality: 'highest',
            format: 'mp4'
        }, {
            headers: {
                'Content-Type': 'application/json',
                // Mock session cookie if needed, but we might hit auth error. 
                // Let's assume auth middleware is disabled or we need to login relative to actual environment.
                // Wait, requireAuth is on. 
                // I'll temporarily disable requireAuth in youtube.js for this test or mock it? 
                // Actually, I can't easily mock the session.
                // Better approach: Check the error log directly. 
                // If it's auth error, it will be 401, not 500. 
                // The user reported 500, so it passed Auth.
            }
        });
        console.log("✅ Success:", response.data);
    } catch (error) {
        console.error("❌ Error:", error.response ? error.response.data : error.message);
    }
}

testDownload();
