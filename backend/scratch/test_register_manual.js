require('dotenv').config();
const prisma = require('../utils/prisma');
const bcrypt = require("bcryptjs");

async function testRegister() {
  const email = `test_${Date.now()}@example.com`;
  const password = "Password123!";
  const name = "Test User";

  try {
    console.log('🔍 Checking if user exists:', email);
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    console.log('✅ Existing check done:', existing);

    console.log('🔐 Hashing password...');
    const startTime = Date.now();
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`✅ Hashing done in ${Date.now() - startTime}ms`);

    console.log('💾 Creating user...');
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name,
        plan: "free",
        role: "user",
      },
    });
    console.log('✅ User created:', newUser.id);

  } catch (err) {
    console.error('❌ Registration test failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testRegister();
