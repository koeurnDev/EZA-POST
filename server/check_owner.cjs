const db = require('./db');
const bcrypt = require('bcryptjs');

async function checkOwner() {
    try {
        const res = await db.query("SELECT * FROM users WHERE email = 'owner@girlyshop.com'");
        if (res.rows.length > 0) {
            console.log("Owner found. Resetting password to 'admin123'...");
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query("UPDATE users SET password = $1 WHERE email = 'owner@girlyshop.com'", [hashedPassword]);
            console.log("Password reset successful.");
        } else {
            console.log("Owner NOT found. Creating owner@girlyshop.com...");
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query(`
                INSERT INTO users (username, email, password, role, avatar, wishlist)
                VALUES ('Owner', 'owner@girlyshop.com', $1, 'owner', '/user-avatar.jpg', '[]')
            `, [hashedPassword]);
            console.log("Owner account created.");
        }
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkOwner();
