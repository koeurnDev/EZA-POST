// Migrate User.selectedPages to UserPageSelections
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const User = require('../models/User'); // Old Mongoose model

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

async function migrateUserSelections() {
  const prisma = new PrismaClient();
  try {
    console.log('🔄 Starting user page selections migration...');

    const users = await User.find({
      selectedPages: { $exists: true, $ne: [] }
    });

    console.log(`Found ${users.length} users with selected pages`);

    let migratedCount = 0;
    for (const user of users) {
      const pageIds = Array.isArray(user.selectedPages) ? user.selectedPages : [];

      if (pageIds.length === 0) continue;

      console.log(`Migrating user ${user._id}: ${pageIds.length} pages`);

      for (const pageId of pageIds) {
        try {
          await prisma.userPageSelections.create({
            data: {
              userId: user._id.toString(),
              pageId: pageId.toString()
            }
          });
        } catch (error) {
          console.error(`❌ Error migrating page ${pageId} for user ${user._id}:`, error.message);
        }
      }
      migratedCount++;
    }

    console.log(`✅ Migrated page selections for ${migratedCount} users`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUserSelections();