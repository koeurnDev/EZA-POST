const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// 🔌 Redis Connection Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('❌ Redis unreachable after 3 attempts. Background tasks disabled.');
            return null; // Stop retrying and fail gracefully
        }
        return Math.min(times * 500, 2000);
    }
});

connection.on('connect', () => console.log('✅ Redis connected successfully'));
connection.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.warn('⚠️ Warning: Redis is not running. Using synchronous processing fallback (if implemented).');
    } else {
        console.error('❌ Redis error:', err.message);
    }
});


// 📦 Initialize Queues
const postQueue = new Queue('post-queue', { 
    connection,
    defaultJobOptions: {
        attempts: 3, // Retry 3 times if failed
        backoff: {
            type: 'exponential',
            delay: 10000, // Wait 10s before first retry, then 20s, 40s...
        },
        removeOnComplete: true, // Auto-cleanup finished jobs
        removeOnFail: false,    // Keep failed jobs for debugging
    }
});

module.exports = {
    postQueue,
    connection
};
