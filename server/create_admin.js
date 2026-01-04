const db = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// No manual pool creation needed


async function createAdmin() {
    const email = 'admin@girly.com';
    const password = 'admin123';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
        const res = await db.query(
            `INSERT INTO users (username, email, password, role, avatar, wishlist)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET role = 'admin', password = $3
             RETURNING *`,
            ['Admin User', email, hashedPassword, 'admin', '/user-avatar.jpg', '[]']
        );
        console.log('✅ Admin user created/updated:', res.rows[0].email);
    } catch (err) {
        console.error('❌ Error creating admin:', err);
    } finally {
        // Find a way to exit cleanly if possible, or just let process exit
        process.exit();
    }
}

createAdmin();
