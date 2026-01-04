const db = require('./db');

async function createMessagesTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                room TEXT NOT NULL,
                sender TEXT NOT NULL, -- 'admin' or 'user' (or user_id)
                text TEXT,
                media_url TEXT,
                media_type TEXT, -- 'image', 'video', 'audio'
                type TEXT DEFAULT 'text', -- 'text' or 'media'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ 'messages' table created successfully");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        process.exit();
    }
}

createMessagesTable();
