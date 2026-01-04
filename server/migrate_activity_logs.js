const db = require('./db');

const createTable = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                "user" VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                ip VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table 'activity_logs' created successfully.");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        process.exit();
    }
};

createTable();
