require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const posts = await prisma.scheduledPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('=== RECENT POSTS ===');
  for (const p of posts) {
    console.log({
      id: p.id,
      status: p.status,
      attempts: p.attempts,
      postType: p.postType,
      scheduleTime: p.scheduleTime,
      createdAt: p.createdAt,
      lastError: p.lastError,
      publishedIds: p.publishedIds,
      accounts: p.accounts,
      carouselCards: p.carouselCards ? p.carouselCards.length : 0
    });
  }

  const pages = await prisma.facebookPage.findMany();
  console.log('=== PAGES ===');
  for (const pg of pages) {
    console.log({
      id: pg.id,
      name: pg.name,
      isConnected: pg.isConnected,
      enableSchedule: pg.enableSchedule,
      enableBot: pg.enableBot
    });
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
