const db = require('./db');
const bcrypt = require('bcryptjs');

async function verifyOwner() {
    const email = 'owner@girlyshop.com';
    const password = 'Owner123!';

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            console.log('User not found!');
            return;
        }

        const user = result.rows[0];
        console.log(`User found: ${user.email}, Role: ${user.role}`);
        console.log(`Stored Hash: ${user.password}`);

        const valid = await bcrypt.compare(password, user.password);
        console.log(`Password 'Owner123!' is valid? ${valid}`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

verifyOwner();
