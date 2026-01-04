const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
let jwt;
try {
    jwt = require('jsonwebtoken');
} catch (e) {
    console.warn("⚠️ 'jsonwebtoken' module not found. Authentication might fail if not manually handled.");
}

async function testUpdate() {
    console.log('--- Testing User Update API ---');

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    if (majorVersion < 18 || !global.fetch) {
        console.error(`❌ Node.js v18+ required for native fetch. Current: ${nodeVersion}`);
        return;
    }

    // 1. Generate Auth Token (Mocking a logged-in user)
    let token = '';
    if (jwt && process.env.JWT_SECRET) {
        // Create a token for User ID 1 (Assuming Admin or Owner)
        token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('🔑 Generated Test JWT Token.');
    } else {
        console.warn('⚠️ No JWT_SECRET or jsonwebtoken library. Request will rely on server not checking auth (unlikely).');
    }

    // 2. Prepare Request
    // Port: 5001 (Corrected from 5000)
    // ID: 1 (Corrected from "u1")
    const userId = 1;
    const url = `http://localhost:5001/api/users/${userId}`;

    console.log(`📡 Sending PUT request to: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Added Auth Header
            },
            body: JSON.stringify({
                username: "Ashwin Updated",
                email: "ashwin@gmail.com",
                // Sending a simplified text payload for avatar to verify update logic, 
                // assuming backend handles base64 or url strings.
                avatar: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg"
            })
        });

        const status = response.status;
        console.log(`\n🔹 Status Code: ${status}`);

        if (response.ok) {
            const data = await response.json();
            console.log("✅ Success! Response Data:", data);
        } else {
            console.log("❌ Request Failed.");
            const text = await response.text();
            console.log("   Server Message:", text);
            if (status === 401) console.log("   (Reason: Unauthorized - Token Issue)");
            if (status === 403) console.log("   (Reason: Forbidden - Permissions Issue)");
            if (status === 404) console.log("   (Reason: Not Found - User ID Issue)");
            if (status === 500) console.log("   (Reason: Server Error - Check Backend Logs)");
        }

    } catch (e) {
        console.error("❌ Network/Fetch Error:", e.message);
        if (e.message.includes('ECONNREFUSED')) {
            console.log("   (Hint: Is your backend server running on port 5001?)");
        }
    }
}

testUpdate();
