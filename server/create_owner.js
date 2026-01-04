const db = require('./db');
const bcrypt = require('bcryptjs');

async function createOwner() {
    console.log("👑 Creating Owner Account...");
    const email = "owner@girlyshop.com";
    const password = "123";
    const username = "Seab";

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Check if exists
        const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (check.rows.length > 0) {
            console.log("User exists, updating role to OWNER and resetting password...");
            await db.query(`
                UPDATE users 
                SET role = 'owner', password = $1, username = $2
                WHERE email = $3
            `, [hashedPassword, username, email]);
        } else {
            console.log("Creating new OWNER user...");
            await db.query(`
                INSERT INTO users (username, email, password, role, avatar, wishlist)
                VALUES ($1, $2, $3, 'owner', '/user-avatar.jpg', '[]')
            `, [username, email, hashedPassword]);
        }

        console.log("✅ Owner account ready: owner@girlyshop.com / 123");
    } catch (err) {
        console.error("❌ Failed:", err);
    } finally {
        process.exit();
    }
}

createOwner();
