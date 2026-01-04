const fetch = require('node-fetch'); // Use node-fetch if available or native fetch

async function verify() {
    const BASE_URL = 'http://localhost:5001';

    console.log('--- Verifying PostgreSQL Endpoints ---');

    // 1. Get Products
    try {
        const res = await fetch(`${BASE_URL}/api/products`);
        if (res.ok) {
            const products = await res.json();
            console.log(`[PASS] GET /api/products returned ${products.length} products`);
            if (products.length > 0) {
                console.log(`       Sample: ${products[0].name} (ID: ${products[0].id})`);
            }
        } else {
            console.log(`[FAIL] GET /api/products status: ${res.status}`);
        }
    } catch (e) {
        console.log(`[FAIL] GET /api/products error: ${e.message}`);
    }

    // 2. Login (using migrated user 'ashwin@gmail.com' from users.json)
    // users.json had: email: "ashwin@gmail.com", password: "123"
    let token = '';
    let userId = null;
    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'ashwin@gmail.com', password: '123' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                console.log(`[PASS] POST /api/auth/login successful. User ID: ${data.user.id}`);
                token = data.token;
                userId = data.user.id;
            } else {
                console.log(`[FAIL] Login failed: ${data.message}`);
            }
        } else {
            console.log(`[FAIL] POST /api/auth/login status: ${res.status}`);
        }
    } catch (e) {
        console.log(`[FAIL] Login error: ${e.message}`);
    }

    // 3. Authenticated Request (Get Profile)
    if (token && userId) {
        try {
            const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`[PASS] GET /api/users/${userId} (Auth) returned: ${data.user.email}`);
            } else {
                console.log(`[FAIL] GET /api/users/${userId} status: ${res.status}`);
            }
        } catch (e) {
            console.log(`[FAIL] Profile fetch error: ${e.message}`);
        }
    }
}

verify();
