const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const email = 'admin@school.com';
  const newPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const res = await pool.query(
    'UPDATE users SET password = $1 WHERE email = $2 RETURNING email',
    [hashedPassword, email]
  );
  
  if (res.rowCount > 0) {
    console.log(`✅ Password reset successfully for ${email}`);
    console.log(`🔑 New Password: ${newPassword}`);
  } else {
    console.log(`❌ User ${email} not found.`);
  }
  
  await pool.end();
}

main().catch(console.error);
