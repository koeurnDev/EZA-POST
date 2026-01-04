const db = require('./db');

const runMigration = async () => {
    try {
        console.log("🔄 Starting Migration: Adding 'shipping_address' to 'orders' table...");

        // Check if column exists
        const check = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='shipping_address';
        `);

        if (check.rows.length === 0) {
            await db.query(`
                ALTER TABLE orders 
                ADD COLUMN shipping_address JSONB DEFAULT '{}';
            `);
            console.log("✅ Column 'shipping_address' added successfully.");
        } else {
            console.log("⚠️ Column 'shipping_address' already exists.");
        }

        console.log("🎉 Migration Complete!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Failed:", err);
        process.exit(1);
    }
};

runMigration();
