const db = require('./db');

const createSubscribersTable = async () => {
    try {
        console.log('Creating subscribers table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Subscribers table created.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating subscribers table:', err);
        process.exit(1);
    }
};

createSubscribersTable();
