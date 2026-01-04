const db = require('./db');

const createNotificationsTable = async () => {
    try {
        console.log('Creating notifications table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Notifications table created.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating notifications table:', err);
        process.exit(1);
    }
};

createNotificationsTable();
