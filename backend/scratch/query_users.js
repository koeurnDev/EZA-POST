const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const res = await pool.query('SELECT email, name FROM users LIMIT 10');
  console.log('Users found in DB:');
  console.log(res.rows);
  await pool.end();
}

main().catch(console.error);
