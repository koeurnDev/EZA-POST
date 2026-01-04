const db = require('../db');
const bcrypt = require('bcryptjs');

async function setSpecificRoles() {
    try {
        console.log('Starting role updates...');

        // 1. Ensure ashwin@gmail.com is admin
        console.log('Processing ashwin@gmail.com...');
        const ashwinCheck = await db.query("SELECT * FROM users WHERE email = 'ashwin@gmail.com'");
        if (ashwinCheck.rows.length > 0) {
            await db.query("UPDATE users SET role = 'admin' WHERE email = 'ashwin@gmail.com'");
            console.log('✅ ashwin@gmail.com set to admin.');
        } else {
            console.log('⚠️ ashwin@gmail.com not found. Creating user...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            await db.query(`
                INSERT INTO users (username, email, password, role, avatar, wishlist)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, ['Ashwin', 'ashwin@gmail.com', hashedPassword, 'admin', '/user-avatar.jpg', '[]']);
            console.log('✅ ashwin@gmail.com created as admin.');
        }

        // 2. Ensure owner@girly.com is owner
        console.log('Processing owner@girly.com...');
        const ownerCheck = await db.query("SELECT * FROM users WHERE email = 'owner@girly.com'");
        if (ownerCheck.rows.length > 0) {
            await db.query("UPDATE users SET role = 'owner' WHERE email = 'owner@girly.com'");
            console.log('✅ owner@girly.com set to owner.');
        } else {
            console.log('Creating owner@girly.com...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('Owner123!', salt);
            await db.query(`
                INSERT INTO users (username, email, password, role, avatar, wishlist)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, ['Owner', 'owner@girly.com', hashedPassword, 'owner', '/user-avatar.jpg', '[]']);
            console.log('✅ owner@girly.com created as owner.');
        }

    } catch (err) {
        console.error('❌ Error setting roles:', err);
    } finally {
        process.exit();
    }
}

setSpecificRoles();
