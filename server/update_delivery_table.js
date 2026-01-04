const db = require('./db');

async function updateDeliveryTable() {
    try {
        console.log("🚚 Creating delivery_options table...");

        await db.query(`
            CREATE TABLE IF NOT EXISTS delivery_options (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                duration VARCHAR(100),
                description VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Seed with defaults if empty
        const countRes = await db.query('SELECT COUNT(*) FROM delivery_options');
        if (parseInt(countRes.rows[0].count) === 0) {
            console.log("🌱 Seeding default delivery options...");
            await db.query(`
                INSERT INTO delivery_options (name, price, duration, description) VALUES
                ('Virak Buntham', 1.50, '1-2 Days', 'Standard Delivery'),
                ('J&T Express', 1.50, '1-2 Days', 'Reliable Service'),
                ('Grab Express', 2.50, 'Instant', 'Same Day Delivery')
            `);
        }

        console.log("✅ Delivery table setup complete!");
        process.exit();
    } catch (err) {
        console.error("❌ Error setting up delivery table:", err);
        process.exit(1);
    }
}

updateDeliveryTable();
