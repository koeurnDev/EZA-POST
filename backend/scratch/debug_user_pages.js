const prisma = require('../utils/prisma');

async function debug() {
  try {
    const lastUser = await prisma.user.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        facebookPages: true
      }
    });

    if (!lastUser) {
      console.log("No users found.");
      return;
    }

    console.log("--- Last Updated User ---");
    console.log(`ID: ${lastUser.id}`);
    console.log(`Name: ${lastUser.name}`);
    console.log(`Facebook Name: ${lastUser.facebookName}`);
    console.log(`Facebook ID: ${lastUser.facebookId}`);
    console.log(`Updated At: ${lastUser.updatedAt}`);
    
    console.log("\n--- Connected Pages (from User table) ---");
    console.log(JSON.stringify(lastUser.connectedPages, null, 2));

    console.log("\n--- FacebookPage Table Entries ---");
    console.log(JSON.stringify(lastUser.facebookPages, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
