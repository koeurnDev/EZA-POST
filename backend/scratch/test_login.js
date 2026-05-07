const axios = require('axios');

async function testLogin() {
    const baseURL = 'http://localhost:5001/api';
    const client = axios.create({ baseURL, withCredentials: true });

    try {
        console.log("🔍 Fetching CSRF token...");
        const csrfRes = await client.get('/csrf-token');
        const csrfToken = csrfRes.data.csrfToken;
        console.log("✅ CSRF Token:", csrfToken);

        console.log("🔍 Attempting login...");
        const res = await client.post('/auth/login', 
            { email: 'test@test.com', password: 'wrongpassword' },
            { headers: { 'X-CSRF-Token': csrfToken } }
        );
        console.log("✅ Success:", res.data);
    } catch (err) {
        console.log("❌ Failed Status:", err.response?.status);
        console.log("❌ Failed Data:", JSON.stringify(err.response?.data, null, 2));
    }
}
testLogin();
