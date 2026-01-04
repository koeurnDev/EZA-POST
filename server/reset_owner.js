const db = require('./db');
const bcrypt = require('bcryptjs');

async function resetPassword() {
    const email = 'owner@girlyshop.com';
    const newPassword = 'owner123!'; // Lowercase 'o' per user attempt

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);

        console.log('✅ Password updated successfully!');
        console.log(`Email: ${email}`);
        console.log(`New Password: ${newPassword}`);

    } catch (err) {
        console.error('Error updating password:', err);
    } finally {
        process.exit();
    }
}

resetPassword();
