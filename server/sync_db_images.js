const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

let jwt;
try {
    jwt = require('jsonwebtoken');
} catch (e) {
    console.warn("⚠️ 'jsonwebtoken' missing. Auth may fail.");
}

async function testUploadAndUpdate() {
    console.log('--- Testing API: Upload Image + Update User Profile ---');

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    if (majorVersion < 18 || !global.fetch || !global.FormData || !global.Blob) {
        console.error(`❌ Node.js v18+ required for native fetch/FormData. Current: ${nodeVersion}`);
        process.exit(1);
    }

    // 1. Generate Auth Token
    let token = '';
    if (jwt && process.env.JWT_SECRET) {
        token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('🔑 Generated Auth Token.');
    }

    // 2. Prepare Dummy Image (Valid PNG Buffer)
    // 1x1 Transparent PNG
    const pngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082', 'hex');
    const blob = new Blob([pngBuffer], { type: 'image/png' });

    // 3. Step 1: Upload Image
    console.log('\n📤 Step 1: Uploading Image...');
    const formData = new FormData();
    formData.append('image', blob, 'test-profile-update.png');

    let imageUrl = '';
    try {
        const uploadRes = await fetch('http://localhost:5001/api/upload', {
            method: 'POST',
            body: formData
            // Note: fetch automatically sets Content-Type for FormData
        });

        if (!uploadRes.ok) {
            throw new Error(`Upload Failed: ${uploadRes.status} ${await uploadRes.text()}`);
        }

        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) {
            imageUrl = uploadData.url;
            console.log(`   ✅ Upload Success: ${imageUrl}`);
        } else {
            throw new Error('Upload response missing URL');
        }

    } catch (err) {
        console.error('❌ Step 1 Failed:', err.message);
        return;
    }

    // 4. Step 2: Update User Profile
    console.log('\n👤 Step 2: Updating User Profile (ID: 1)...');
    try {
        const updateUrl = 'http://localhost:5001/api/users/1';
        const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                avatar: imageUrl
            })
        });

        if (updateRes.ok) {
            const userData = await updateRes.json();
            console.log('   ✅ User Update Success!');
            console.log(`      User ID: ${userData.id}`);
            console.log(`      New Avatar: ${userData.avatar}`);
        } else {
            console.error(`   ❌ Update Failed: ${updateRes.status}`);
            console.log('      Reason:', await updateRes.text());
        }

    } catch (err) {
        console.error('❌ Step 2 Failed:', err.message);
    } finally {
        // Close DB pool if it was opened (though we didn't use it directly here, require('./db') might init it)
        if (db.pool) {
            await db.pool.end();
        }
    }
}

testUploadAndUpdate();
