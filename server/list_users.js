const db = require('./db');

async function listUsers() {
    try {
        const res = await db.query('SELECT id, email, username, role FROM users ORDER BY id');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(); // Force exit to close pool
    }
}

listUsers();
