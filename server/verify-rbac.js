const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET_KEY = "girly-shop-secret-key-change-this-in-prod";
const PORT = 5001;

// Mock Users
const adminUser = { id: 1, email: 'admin@test.com', role: 'admin' };
const regularUser = { id: 2, email: 'user@test.com', role: 'customer' };
const regularUser2 = { id: 3, email: 'other@test.com', role: 'customer' };

// Tokens
const adminToken = jwt.sign(adminUser, SECRET_KEY, { expiresIn: '1h' });
const userToken = jwt.sign(regularUser, SECRET_KEY, { expiresIn: '1h' });

function makeRequest(path, token, desc) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`[${res.statusCode}] ${desc}`);
                if (res.statusCode !== 200 && res.statusCode !== 403 && res.statusCode !== 401) {
                    console.log('Response:', data.substring(0, 100)); // Log for debug if unexpected
                }
                resolve({ status: res.statusCode, data: data });
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with request '${desc}': ${e.message}`);
            resolve({ error: e });
        });

        req.end();
    });
}

async function runTests() {
    console.log("🚀 Starting RBAC Verification (Make sure server is running!)...\n");

    // 1. Unauthenticated Access
    await makeRequest('/api/orders', null, 'Unauthenticated GET /api/orders (Expect 401)');

    // 2. Regular User Access
    await makeRequest('/api/orders', userToken, 'User GET /api/orders (Expect 200, Own Only)');

    // 3. Admin Access
    await makeRequest('/api/orders', adminToken, 'Admin GET /api/orders (Expect 200, All)');

    // 4. Admin Filter
    await makeRequest('/api/orders?userId=2', adminToken, 'Admin GET /api/orders?userId=2 (Expect 200, Filtered)');

    // 5. Notifications
    await makeRequest('/api/notifications', userToken, 'User GET /api/notifications (Expect 200, Own Only)');

    console.log("\n✅ Done. Check server logs to confirm SQL queries used correct ID filtering.");
}

runTests();
