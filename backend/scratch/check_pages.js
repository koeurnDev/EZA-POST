require("dotenv").config();
const prisma = require("../utils/prisma");

async function checkUserPages() {
  try {
    const user = await prisma.user.findFirst({
      where: { facebookId: { not: null } },
      include: { facebookPages: true }
    });

    if (!user) {
      console.log("❌ No user found with connected Facebook in DB.");
      return;
    }

    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log(`🆔 FB ID: ${user.facebookId}`);
    console.log(`📄 Pages in DB (${user.facebookPages.length}):`);
    
    user.facebookPages.forEach(p => {
      console.log(`   - [${p.id}] ${p.name} (Selected: ${p.isSelected})`);
    });

    if (user.facebookPages.length === 0) {
      console.log("\n⚠️ WARNING: User is connected but has ZERO pages in DB.");
    }

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPages();
