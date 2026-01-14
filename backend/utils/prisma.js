const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
console.log(`🕒 [Prisma] Initializing with connection string: ${connectionString ? connectionString.substring(0, 20) + '...' : 'MISSING'}`);

const pool = new Pool({
    connectionString,
    ssl: connectionString?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('❌ [pg Pool] Unexpected error on idle client', err);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
