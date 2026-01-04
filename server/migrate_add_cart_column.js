const db = require('./db');

const runMigration = async () => {
    try {
        console.log("🔄 Starting Migration: Adding 'cart' to 'users' table...");

        // Check if column exists
        const check = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='cart';
        `);

        if (check.rows.length === 0) {
            await db.query(`
                ALTER TABLE users 
                ADD COLUMN cart JSONB DEFAULT '[]';
            `);
            console.log("✅ Column 'cart' added successfully.");
        } else {
            console.log("⚠️ Column 'cart' already exists.");
        }

        console.log("🎉 Migration Complete!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Failed:", err);
        process.exit(1);
    }
};

runMigration();
