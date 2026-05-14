require('dotenv').config();
const prisma = require('../utils/prisma');

async function main() {
  try {
    const history = await prisma.botHistory.findMany({
      where: { status: 'failed' },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    console.log(JSON.stringify(history, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
