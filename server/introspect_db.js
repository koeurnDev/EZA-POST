const db = require('./db');

async function inspect() {
    try {
        console.log("Checking tables...");
        const tables = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("Tables:", tables.rows.map(r => r.table_name));

        const ordersTable = tables.rows.find(r => r.table_name === 'orders');
        if (ordersTable) {
            console.log("Checking columns for 'orders' table...");
            const columns = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'orders'
            `);
            console.log("Columns:", columns.rows);
        } else {
            console.log("⚠️ Table 'orders' DOES NOT EXIST.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        // Exit process
        setTimeout(() => process.exit(0), 1000);
    }
}

inspect();
