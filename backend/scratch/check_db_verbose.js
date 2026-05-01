require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
console.log(`🕒 [Prisma] Initializing with: ${connectionString ? connectionString.substring(0, 30) + '...' : 'MISSING'}`);

const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: connectionString?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('❌ [pg Pool] Unexpected error:', err);
});

async function main() {
  try {
    console.log('🐘 Testing DB connection via pg pool...');
    const client = await pool.connect();
    console.log('✅ pg connected!');
    const res = await client.query('SELECT NOW()');
    console.log('🕒 DB Time:', res.rows[0].now);
    client.release();

    console.log('💎 Initializing Prisma with adapter...');
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    console.log('🔍 Running prisma.user.count()...');
    const count = await prisma.user.count();
    console.log('✅ Prisma Count success:', count);
    
    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    await pool.end();
  }
}

main();
