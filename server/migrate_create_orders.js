const db = require('./db');

const createOrdersTable = async () => {
    try {
        console.log("🛠️ Starting migration: Create Orders Table...");

        // Drop if exists (optional, mostly for dev/reset)
        // await db.query(`DROP TABLE IF EXISTS orders;`);

        // Create Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(50) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                items JSONB DEFAULT '[]',
                total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'pending',
                payment_method VARCHAR(50),
                shipping_address JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ Orders table created successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
};

createOrdersTable();
