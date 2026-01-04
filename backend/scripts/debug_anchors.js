
const axios = require('axios');

async function checkAnchors() {
    try {
        console.log("Fetching TikTok Trends...");
        const response = await axios.post("https://www.tikwm.com/api/feed/list",
            new URLSearchParams({ region: 'VN', count: '10' }), // checking VN/TH for templates
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            }
        );

        if (response.data.data) {
            response.data.data.forEach((v, i) => {
                const isCapCut = JSON.stringify(v).toLowerCase().includes("capcut");
                console.log(`\nVH[${i}] Title: ${v.title.substring(0, 30)}...`);
                console.log(`   Has CapCut Keyword: ${isCapCut}`);
                if (v.anchors) {
                    console.log(`   Anchors:`, v.anchors);
                }
                if (v.music_info) {
                    // sometimes music title has "CapCut"
                    console.log(`   Music: ${v.music_info.title}`);
                }
            });
        }
    } catch (e) {
        console.error(e);
    }
}

checkAnchors();
