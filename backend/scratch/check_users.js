require('dotenv').config();
const prisma = require('../utils/prisma');
async function run() {
    try {
        const users = await prisma.user.findMany({ take: 5 });
        console.log("👥 Users in DB:", users.map(u => u.email));
    } catch (err) {
        console.error("❌ Prisma Error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
