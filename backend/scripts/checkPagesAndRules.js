require('dotenv').config();
const prisma = require('../utils/prisma');

async function check() {
  try {
    const pages = await prisma.facebookPage.findMany({
      select: { id: true, name: true, userId: true }
    });
    console.log('Facebook pages:', pages.length, pages);

    const rules = await prisma.botRule.findMany({
      select: { id: true, userId: true, enabled: true }
    });
    console.log('Bot rules:', rules.length, rules.filter(r => r.enabled).length, 'enabled');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
