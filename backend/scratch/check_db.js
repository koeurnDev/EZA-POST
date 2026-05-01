const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🐘 Testing Prisma connection...');
    const usersCount = await prisma.user.count();
    console.log('✅ Connection successful! Total users:', usersCount);
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
