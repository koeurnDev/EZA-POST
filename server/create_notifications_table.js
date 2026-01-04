const db = require('./db');

async function createTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Notifications table created");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        process.exit();
    }
}

createTable();
