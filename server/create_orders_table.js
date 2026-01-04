const db = require('./db');

async function createOrdersTable() {
    try {
        console.log("Creating 'orders' table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(50) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id),
                items JSONB NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                shipping DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending', -- pending, paid, shipped, cancelled
                payment_method VARCHAR(50),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table 'orders' created successfully.");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

createOrdersTable();
