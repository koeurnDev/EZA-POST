require('dotenv').config();
const prisma = require('../utils/prisma');

async function check() {
  try {
    const counts = {};
    counts.users = await prisma.user.count();
    counts.posts = await prisma.scheduledPost.count();
    counts.botHistory = await prisma.botHistory.count();
    counts.pendingReplies = await prisma.pendingReply.count();
    counts.repliedComments = await prisma.repliedComment.count();
    console.log('Database counts:', counts);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
