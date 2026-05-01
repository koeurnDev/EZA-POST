const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
console.log(`🕒 [Prisma] Initializing with connection string: ${connectionString ? connectionString.substring(0, 20) + '...' : 'MISSING'}`);

// ⚙️ Configure PG Pool with more resilient settings for Neon/Serverless
const pool = new Pool({
    connectionString,
    ssl: connectionString?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    max: 20, // Increased from 10 to 20
    idleTimeoutMillis: 60000, // Increased from 30000 to 60000
    connectionTimeoutMillis: 30000, // Increased from 5000 to 30000 (Neon wake-up)
});

// 🛡️ Error handler for the pool to prevent crashes on idle disconnects
pool.on('error', (err) => {
    console.error('❌ [pg Pool] Unexpected error on idle client:', err.message);
    if (err.message.includes('Connection terminated')) {
        console.warn('⚠️ [pg Pool] Connection was terminated. Pool will attempt to recreate clients on demand.');
    }
});

// ✅ Initialize Prisma with PG Adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ 
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

/**
 * 🔄 Connect with Retry Logic
 */
const connectWithRetry = async (retries = 5) => {
    while (retries > 0) {
        try {
            await prisma.$connect();
            console.log('✅ [Prisma] Successfully connected to database.');
            return;
        } catch (err) {
            console.error(`❌ [Prisma] Connection failed (${retries} retries left):`, err.message);
            retries -= 1;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

// Start initial connection attempt (async)
connectWithRetry().catch(err => {
    console.error('💥 [Prisma] Fatal connection error:', err.message);
});

module.exports = prisma;
