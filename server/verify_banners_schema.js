const db = require('./db');

async function checkBanners() {
    try {
        console.log("Checking banners table...");
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'banners'
        `);
        console.log("Columns:", res.rows);

        console.log("Trying SELECT *...");
        const rows = await db.query('SELECT * FROM banners LIMIT 1');
        console.log("Rows:", rows.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkBanners();
