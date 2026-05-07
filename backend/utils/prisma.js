const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;

// ⚙️ Configure PG Pool
const pool = new Pool({
    connectionString: connectionString + (connectionString.includes('?') ? '&' : '?') + 'connect_timeout=30',
    ssl: connectionString?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
});

// ✅ Initialize Prisma with Adapter
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
