const db = require('./db');

async function updateTable() {
    try {
        await db.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS address TEXT,
            ADD COLUMN IF NOT EXISTS courier TEXT;
        `);
        console.log("✅ Orders table updated with address/courier columns");
    } catch (err) {
        console.error("❌ Error updating table:", err);
    } finally {
        process.exit();
    }
}

updateTable();
