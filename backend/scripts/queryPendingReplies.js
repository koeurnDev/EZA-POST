require('dotenv').config();
const prisma = require('../utils/prisma');

async function main() {
  try {
    const pending = await prisma.pendingReply.findMany({
      where: { status: 'pending' },
      orderBy: { sendAt: 'asc' },
      take: 5,
    });
    console.log('Pending replies:', JSON.stringify(pending, null, 2));

    const failed = await prisma.pendingReply.findMany({
      where: { status: 'failed' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    console.log('Failed replies:', JSON.stringify(failed, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
