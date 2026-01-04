const db = require('./db');

const runMigration = async () => {
    try {
        console.log("🚚 Starting Migration: Creating 'delivery_options' table...");

        await db.query(`
            CREATE TABLE IF NOT EXISTS delivery_options (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                duration VARCHAR(100) DEFAULT '1-2 Days',
                description TEXT
            );
        `);

        // Check if empty, seed default data
        const count = await db.query('SELECT COUNT(*) FROM delivery_options');
        if (parseInt(count.rows[0].count) === 0) {
            console.log("🌱 Seeding default delivery options...");
            await db.query(`
                INSERT INTO delivery_options (name, price, duration, description) VALUES
                ('Standard Delivery', 1.50, '2-3 Days', 'Reliable standard shipping'),
                ('Express Delivery', 3.00, 'Next Day', 'Fast delivery for urgent orders'),
                ('Same Day Delivery', 5.00, 'Today', 'Order before 2PM for same-day delivery');
            `);
        }

        console.log("✅ Table 'delivery_options' ready!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Failed:", err);
        process.exit(1);
    }
};

runMigration();
