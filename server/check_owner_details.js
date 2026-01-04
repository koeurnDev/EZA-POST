const db = require('./db');

async function checkOwner() {
    const email = 'owner@girlyshop.com';
    try {
        const result = await db.query('SELECT username, email, role FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            console.log('User not found!');
        } else {
            console.log('User Details:');
            console.log(result.rows[0]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkOwner();
