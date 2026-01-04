require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const db = require('./db');

async function initNotifications() {
    console.log('--- Initializing Notifications Table ---');
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Create Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER, -- Nullable for system-wide notifs
                type VARCHAR(50) NOT NULL, -- 'welcome', 'order', 'promo'
                title VARCHAR(255) NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Table "notifications" created/verified.');

        // Seed Data check
        const res = await client.query('SELECT COUNT(*) FROM notifications');
        if (parseInt(res.rows[0].count) === 0) {
            console.log('🌱 Seeding initial notifications...');

            const seedData = [
                {
                    type: 'welcome',
                    title: 'Welcome to Lovely Boutique! 🎀',
                    message: "Thanks for joining our community. Here's a 10% off voucher for your first order.",
                    user_id: 1
                },
                {
                    type: 'order',
                    title: 'Order #1234 on the way 🚚',
                    message: "Good news! Your order has been shipped and will arrive in 2-3 days.",
                    user_id: 1
                },
                {
                    type: 'promo',
                    title: 'New Collection Drop: Phka Blush 🌸',
                    message: "Discover our new organic blush collection inspired by Cambodian flowers.",
                    user_id: 1
                }
            ];

            for (const notif of seedData) {
                await client.query(`
                    INSERT INTO notifications (type, title, message, user_id)
                    VALUES ($1, $2, $3, $4)
                `, [notif.type, notif.title, notif.message, notif.user_id]);
            }
            console.log('✅ Seed data inserted.');
        } else {
            console.log('ℹ️ Table already has data. Skipping seed.');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error initializing notifications:', err);
    } finally {
        client.release();
        process.exit();
    }
}

initNotifications();
