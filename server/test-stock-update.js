const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

let jwt;
try {
    jwt = require('jsonwebtoken');
} catch (e) {
    console.warn("⚠️ 'jsonwebtoken' missing. Auth may fail.");
}

// Helper: wrapper for http.request returning a Promise
function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // Try parsing JSON, fallback to text if fails (or if empty)
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ statusCode: res.statusCode, data: parsed, raw: data });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: null, raw: data });
                }
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function testStockUpdate() {
    console.log('--- Testing Product Stock Update API ---');

    // 1. Get a valid product from DB
    let targetProduct;
    try {
        const res = await db.query('SELECT id, name, price, stock FROM products LIMIT 1');
        if (res.rows.length === 0) {
            console.error('❌ No products found in database to test.');
            process.exit(1);
        }
        targetProduct = res.rows[0];
        console.log(`🎯 Target Product: ID ${targetProduct.id} (${targetProduct.name})`);
        console.log(`   Current Stock: ${targetProduct.stock}`);
    } catch (dbError) {
        console.error('❌ Database Error:', dbError);
        process.exit(1);
    }

    // 2. Generate Auth Token
    let token = '';
    if (jwt && process.env.JWT_SECRET) {
        token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    }

    // 3. Prepare Update Payload
    const newStock = targetProduct.stock + 10;
    const updatePayload = JSON.stringify({
        stock: newStock,
        // API might require other fields if it's a full update, usually PATCH is partial. 
        // Assuming PUT requires all or handles partials. 
        // Safe bet: send key fields or check if API is PATCH.
        // Previous script sent name/price too. Let's include them to be safe for PUT.
        name: targetProduct.name,
        price: targetProduct.price
    });

    const updateOptions = {
        hostname: 'localhost',
        port: 5001,
        path: `/api/products/${targetProduct.id}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updatePayload),
            'Authorization': `Bearer ${token}`
        }
    };

    try {
        // 4. Perform Update
        console.log(`\n📤 Updating stock to ${newStock}...`);
        const updateRes = await makeRequest(updateOptions, updatePayload);

        console.log(`   Status: ${updateRes.statusCode}`);
        if (updateRes.statusCode >= 200 && updateRes.statusCode < 300) {
            console.log('   ✅ Update Request Successful');
        } else {
            console.error('   ❌ Update Failed:', updateRes.data || updateRes.raw);
            return; // Stop if update failed
        }

        // 5. Verify Update
        console.log('\n🔍 Verifying via API GET...');
        const getOptions = {
            hostname: 'localhost',
            port: 5001,
            path: `/api/products/${targetProduct.id}`,
            method: 'GET'
        };
        const verifyRes = await makeRequest(getOptions);

        if (verifyRes.data && verifyRes.data.stock === newStock) {
            console.log(`   ✅ Verification Passed! Stock is now ${verifyRes.data.stock}`);
        } else {
            console.error(`   ❌ Verification Failed. Expected ${newStock}, got ${verifyRes.data?.stock}`);
        }

        // 6. Cleanup (Restore Stock)
        console.log('\n🧹 Restoring original stock...');
        await db.query('UPDATE products SET stock = $1 WHERE id = $2', [targetProduct.stock, targetProduct.id]);
        console.log('   ✅ Original stock restored in DB.');

    } catch (err) {
        console.error('❌ Test Execution Error:', err);
    } finally {
        // Close DB connection
        // db.pool is likely exposed or db itself is a pool. 
        // Based on previous files (db.js is `module.exports = { query: (text, params) => pool.query(text, params), pool };`)
        if (db.pool) {
            await db.pool.end();
        }
    }
}

testStockUpdate();
