// Migrate ScheduledPost.accounts to PostTarget
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const ScheduledPost = require('../models/ScheduledPost');

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

async function migratePostTargets() {
  const prisma = new PrismaClient();
  try {
    console.log('🔄 Starting post targets migration...');

    const posts = await ScheduledPost.find({
      accounts: { $exists: true, $ne: [] }
    });

    console.log(`Found ${posts.length} posts with target accounts`);

    let migratedCount = 0;
    for (const post of posts) {
      const accountIds = Array.isArray(post.accounts) ? post.accounts : [];

      if (accountIds.length === 0) continue;

      console.log(`Migrating post ${post.id}: ${accountIds.length} targets`);

      for (const pageId of accountIds) {
        try {
          await prisma.postTarget.create({
            data: {
              postId: post.id,
              pageId: pageId.toString(),
              status: 'pending'
            }
          });
        } catch (error) {
          console.error(`❌ Error migrating target ${pageId} for post ${post.id}:`, error.message);
        }
      }
      migratedCount++;
    }

    console.log(`✅ Migrated targets for ${migratedCount} posts`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePostTargets();