
const axios = require('axios');

async function testViral() {
    console.log("🚀 Testing Viral Finder (Video Type)...");
    try {
        // Mocking the call inside tiktok.js
        const region = 'US';
        const count = 20;

        console.log(`📡 Fetching from TikWM (Region: ${region})...`);
        const response = await axios.post("https://www.tikwm.com/api/feed/list",
            new URLSearchParams({ region: region, count: count }),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': 'https://www.tikwm.com',
                    'Referer': 'https://www.tikwm.com/'
                },
                timeout: 10000
            }
        );

        console.log("✅ Response Status:", response.status);
        console.log("✅ Response Code:", response.data.code);

        if (response.data.code === 0 && response.data.data) {
            console.log(`📦 Got ${response.data.data.length} items`);

            // Test Filtering Logic
            const videos = response.data.data.map(v => ({
                id: v.video_id,
                title: v.title ? v.title.substring(0, 20) : "No Title",
                stats: { likes: v.digg_count }
            }));

            console.log("First 3 Videos:", videos.slice(0, 3));

            // Test CapCut Logic
            const capcut = response.data.data.filter(v => {
                const str = JSON.stringify(v).toLowerCase();
                return str.includes("capcut");
            });
            console.log(`✂️ Found ${capcut.length} CapCut templates`);

        } else {
            console.error("❌ TikWM API Error Data:", response.data);
        }

    } catch (e) {
        console.error("❌ Test Failed:", e.message);
        if (e.response) console.error("   Response:", e.response.status, e.response.data);
    }
}

testViral();
