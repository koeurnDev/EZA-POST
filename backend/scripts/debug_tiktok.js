
const axios = require('axios');

async function testTikWM() {
    console.log("🔥 Testing TikWM Feed API...");
    try {
        const region = "US";
        const count = 10;

        console.log(`Payload: region=${region}, count=${count}`);

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

        console.log("Status:", response.status);
        console.log("Data Code:", response.data.code);
        console.log("Data Msg:", response.data.msg);
        console.log("Data Keys:", Object.keys(response.data));

        if (response.data.data) {
            console.log("First Item:", JSON.stringify(response.data.data[0], null, 2));
        } else {
            console.log("No data field found in response.");
            console.log("Full Response:", JSON.stringify(response.data, null, 2));
        }

    } catch (err) {
        console.error("Request Failed:", err.message);
        if (err.response) {
            console.error("Response Status:", err.response.status);
            console.error("Response Data:", err.response.data);
        }
    }
}

testTikWM();
