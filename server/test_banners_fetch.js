const db = require('./db');

async function testFetch() {
    try {
        console.log("Testing SELECT with ORDER BY...");
        const result = await db.query('SELECT * FROM banners ORDER BY id ASC');
        console.log("Rows fetched:", result.rows.length);

        console.log("Attempting JSON serialization...");
        const json = JSON.stringify(result.rows);
        console.log("Serialization successful.");
        console.log("First row:", json.substring(0, 100)); // Print start of JSON

    } catch (err) {
        console.error("❌ Error caught:", err);
    } finally {
        process.exit();
    }
}

testFetch();
