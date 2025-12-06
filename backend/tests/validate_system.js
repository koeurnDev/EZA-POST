const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load .env

// ============================================================
// ⚙️ CONFIG
// ============================================================
const BASE_URL = 'http://localhost:5000/api';
// Use existing test account or random one
const TEST_USER = {
    email: `auto_test_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Automation Tester'
};

const DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mongkul";

// ============================================================
// 🏎️ VALIDATION SCRIPT
// ============================================================
async function runValidation() {
    console.log("🚀 STARTING SYSTEM VALIDATION...");

    try {
        // 1. Connect to DB (for verification)
        console.log(`\n[DB] Connecting to MongoDB: ${DB_URI}...`);
        await mongoose.connect(DB_URI);
        console.log("✅ [DB] Connected.");

        const User = require('../models/User');
        const PostLog = require('../models/PostLog');

        // 2. Auth Flow
        console.log("\n[AUTH] Starting Authentication Flow...");
        let token = null;
        let csrfToken = null;
        let cookieJar = []; // Simple array to hold cookies strings

        // 2a. Get CSRF Token
        console.log("[AUTH] Fetching CSRF Token...");
        try {
            const csrfRes = await axios.get(`${BASE_URL}/csrf-token`, { withCredentials: true });
            csrfToken = csrfRes.data.csrfToken;
            if (csrfRes.headers['set-cookie']) {
                cookieJar = [...cookieJar, ...csrfRes.headers['set-cookie']];
            }
            console.log(`✅ [AUTH] Got CSRF Token: ${csrfToken ? 'Yes' : 'No'}`);
        } catch (e) {
            console.warn(`⚠️ [AUTH] Failed to get CSRF token (maybe disabled?): ${e.message}`);
        }

        const getHeaders = () => {
            const h = { 'Content-Type': 'application/json' };
            if (csrfToken) h['X-CSRF-Token'] = csrfToken;
            // Combine cookies
            if (cookieJar.length > 0) {
                h['Cookie'] = cookieJar.map(c => c.split(';')[0]).join('; ');
            }
            return h;
        };

        // Try login first (in case running repeatedly)
        try {
            console.log(`[AUTH] Attempting login for ${TEST_USER.email}...`);
            const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
                email: TEST_USER.email,
                password: TEST_USER.password
            }, { headers: getHeaders() });

            if (loginRes.headers['set-cookie']) {
                cookieJar = [...cookieJar, ...loginRes.headers['set-cookie']];
            }
            // Extract token if needed for something else, but cookieJar should handle it
            const cookies = loginRes.headers['set-cookie'];
            if (cookies) token = cookies.map(c => c.split(';')[0]).join('; ');

            console.log("✅ [AUTH] Login Successful.");
        } catch (e) {
            if (e.response?.status === 404 || e.response?.status === 401) {
                console.log("[AUTH] User not found, registering...");
                const regRes = await axios.post(`${BASE_URL}/auth/register`, TEST_USER, { headers: getHeaders() });
                console.log("✅ [AUTH] Registration Successful.");

                if (regRes.headers['set-cookie']) {
                    cookieJar = [...cookieJar, ...regRes.headers['set-cookie']];
                }

            } else {
                console.error(`[AUTH] Login Failed Details:`, e.message);
                if (e.code) console.error(`[AUTH] Error Code:`, e.code);

                throw new Error(`Auth failed: ${e.message}`);
            }
        }


        // 3. Post Simulation (Single Video Post - Simulated)
        console.log("\n[POST] Simulating 'Single Video' Post Creation...");

        // Let's try a Link Post first as it's safer/easier without real video files
        const linkPayload = {
            title: "Automated Link Post",
            caption: "This is a test post from automation.",
            tiktokUrl: "https://www.tiktok.com/@someuser/video/1234567890", // Triggers 'tiktok' type
            postType: 'tiktok', // or just let controller decide? Controller checks `tiktokUrl`
            accounts: JSON.stringify([]) // Should trigger "Auto-select all" logic
            // Note: If user has no connected pages, this will fail 400.
            // We should check if user has connected pages.
        };

        // Check if user has connected pages
        const user = await User.findOne({ email: TEST_USER.email });
        if (!user.connectedPages || user.connectedPages.length === 0) {
            console.warn("⚠️ [WARN] Test user has no connected pages. Simulating skipping post step.");
            // We can't really post without pages. 
            // We could inject a fake page into the DB for this user for testing?
            console.log("[SETUP] Injecting fake Facebook Page for testing...");
            user.connectedPages = [{
                id: "123456789",
                name: "Test Page",
                access_token: "fake_token_encrypted_maybe" // This will fail FB API call
            }];
            await user.save();
            console.log("✅ [SETUP] Fake page injected.");
        }

        console.log("[POST] Sending request...");
        try {
            // For link post, JSON body is fine
            const postRes = await axios.post(`${BASE_URL}/posts`, linkPayload, { headers: getHeaders() });
            console.log("✅ [POST] Response:", postRes.data);
        } catch (e) {
            console.log("❌ [POST] Failed as expected (Fake Token):", e.response?.data || e.message);
            // Verify if it logged the failure to DB
        }

        // 4. Trace Database (PostLog)
        console.log("\n[TRACE] Verifying PostLog in Database...");
        const logs = await PostLog.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5);

        if (logs.length > 0) {
            console.log(`✅ [TRACE] Found ${logs.length} logs.`);
            logs.forEach(l => {
                console.log(`   - [${l.status}] ${l.type} | ID: ${l._id} | Error: ${l.error || 'None'}`);
            });
        } else {
            console.log("⚠️ [TRACE] No logs found. Post creation might have crashed before logging.");
        }

        // 5. Check API Responses (Health Check)
        console.log("\n[API] Checking Health Endpoint...");
        const healthRes = await axios.get(`${BASE_URL}/health`);
        console.log(`✅ [API] Health Status: ${healthRes.data.status} | DB: ${healthRes.data.database}`);

    } catch (err) {
        console.error("💥 SYSTEM VALIDATION FAILED:", err.message);
        if (err.response) console.error("   Response Data:", err.response.data);
    } finally {
        await mongoose.disconnect();
        console.log("\n🏁 Validation Complete.");
    }
}

runValidation();
