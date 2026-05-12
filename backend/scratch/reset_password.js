const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: connectionString + (connectionString.includes('?') ? '&' : '?') + 'connect_timeout=30',
    ssl: connectionString?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = 'test@example.com';
    const newPassword = 'password123';
    
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const user = await prisma.user.upsert({
            where: { email },
            update: { password: hashedPassword },
            create: {
                email,
                password: hashedPassword,
                name: 'Test User',
                plan: 'free',
                role: 'admin'
            }
        });
        
        console.log(`✅ Success! User ${email} now has password: ${newPassword}`);
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
