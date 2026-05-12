// Migrate ScheduledPost media to ScheduledMedia
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

async function migrateScheduledMedia() {
  const prisma = new PrismaClient();
  try {
    console.log('🔄 Starting scheduled media migration...');

    const posts = await ScheduledPost.find({});

    console.log(`Found ${posts.length} posts to check for media`);

    let migratedCount = 0;
    for (const post of posts) {
      let mediaCount = 0;

      // Migrate video_url if exists
      if (post.video_url) {
        try {
          await prisma.scheduledMedia.create({
            data: {
              postId: post.id,
              type: 'video',
              url: post.video_url,
              order: 0
            }
          });
          mediaCount++;
        } catch (error) {
          console.error(`❌ Error migrating video_url for post ${post.id}:`, error.message);
        }
      }

      // Migrate mediaFiles array
      if (post.mediaFiles && Array.isArray(post.mediaFiles)) {
        for (let i = 0; i < post.mediaFiles.length; i++) {
          try {
            await prisma.scheduledMedia.create({
              data: {
                postId: post.id,
                type: post.postType === 'carousel' ? 'image' : 'video',
                url: post.mediaFiles[i],
                order: i + (post.video_url ? 1 : 0) // Offset if video_url exists
              }
            });
            mediaCount++;
          } catch (error) {
            console.error(`❌ Error migrating media file ${i} for post ${post.id}:`, error.message);
          }
        }
      }

      if (mediaCount > 0) {
        console.log(`Migrated ${mediaCount} media items for post ${post.id}`);
        migratedCount++;
      }
    }

    console.log(`✅ Migrated media for ${migratedCount} posts`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateScheduledMedia();