const db = require('./db');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const res = await db.query(
            `UPDATE users SET password = $1 WHERE email = 'ashwin@gmail.com' RETURNING *`,
            [hashedPassword]
        );
        console.log('Updated:', res.rows[0]);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetAdmin();
