const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

const getData = (file) => {
    const filePath = path.join(__dirname, '..', 'data', file);
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Creating tables...');

        // Users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'customer',
                avatar TEXT,
                wishlist JSONB DEFAULT '[]'
            );
        `);

        // Products
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                old_price DECIMAL(10, 2),
                image TEXT,
                images JSONB,
                category VARCHAR(100),
                brand VARCHAR(100),
                stock INTEGER DEFAULT 0,
                volume VARCHAR(50),
                description TEXT,
                rating DECIMAL(2, 1) DEFAULT 0,
                reviews INTEGER DEFAULT 0,
                is_new BOOLEAN DEFAULT FALSE,
                highlights JSONB,
                how_to_use JSONB,
                ingredients TEXT
            );
        `);

        // Banners
        await client.query(`
            CREATE TABLE IF NOT EXISTS banners (
                id BIGINT PRIMARY KEY,
                src TEXT NOT NULL,
                alt VARCHAR(255),
                title VARCHAR(255),
                subtitle VARCHAR(255),
                btn_text VARCHAR(100)
            );
        `);

        // Vouchers
        await client.query(`
            CREATE TABLE IF NOT EXISTS vouchers (
                id BIGINT PRIMARY KEY,
                code VARCHAR(100) UNIQUE NOT NULL,
                title VARCHAR(255),
                subtitle VARCHAR(255),
                discount_amount DECIMAL(10, 2),
                type VARCHAR(50),
                display_discount VARCHAR(50),
                valid VARCHAR(100),
                color VARCHAR(100),
                text_color VARCHAR(100)
            );
        `);

        await client.query('COMMIT');
        console.log('Tables created successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error creating tables:', e);
        throw e;
    } finally {
        client.release();
    }
};

const migrateData = async () => {
    const client = await pool.connect();
    try {
        await createTables();
        await client.query('BEGIN');

        console.log('Migrating data...');

        // Migrate Users
        const users = getData('users.json');
        for (const user of users) {
            // Handle "u1", "u2" ids. For Postgres SERIAL, we might want to just let it auto-increment or force ID if we want to preserve.
            // Given user IDs are strings "u1", I will convert them to integers effectively 1, 2... or keep them if I change schema to VARCHAR.
            // The schema used SERIAL (integer). Let's extract number from "u1".
            const idVal = parseInt(user.id.replace('u', ''));

            await client.query(`
                INSERT INTO users (id, username, email, password, role, avatar, wishlist)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    email = EXCLUDED.email,
                    password = EXCLUDED.password,
                    role = EXCLUDED.role,
                    avatar = EXCLUDED.avatar,
                    wishlist = EXCLUDED.wishlist
             `, [idVal, user.username, user.email, user.password, user.role, user.avatar, JSON.stringify(user.wishlist)]);
        }
        console.log(`Migrated ${users.length} users.`);

        // Migrate Products
        const products = getData('products.json');
        for (const product of products) {
            await client.query(`
                INSERT INTO products (id, name, price, old_price, image, images, category, brand, stock, volume, description, rating, reviews, is_new, highlights, how_to_use, ingredients)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    price = EXCLUDED.price,
                    stock = EXCLUDED.stock
            `, [
                product.id,
                product.name,
                product.price,
                product.oldPrice || null,
                product.image,
                JSON.stringify(product.images || []),
                product.category,
                product.brand,
                product.stock,
                product.volume,
                product.description,
                product.rating,
                product.reviews,
                product.isNew,
                JSON.stringify(product.highlights || []),
                JSON.stringify(product.howToUse || []),
                product.ingredients || ""
            ]);

        }
        // Adjust sequence to max id (Performance fix: Run ONCE after loop)
        await client.query(`SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))`);
        // Also fix users sequence just in case
        await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

        console.log(`Migrated ${products.length} products.`);

        // Migrate Banners
        const banners = getData('banners.json');
        for (const banner of banners) {
            await client.query(`
                INSERT INTO banners (id, src, alt, title, subtitle, btn_text)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
            `, [banner.id, banner.src, banner.alt, banner.title, banner.subtitle, banner.btnText]);
        }
        console.log(`Migrated ${banners.length} banners.`);

        // Migrate Vouchers
        const vouchers = getData('vouchers.json');
        for (const voucher of vouchers) {
            await client.query(`
                INSERT INTO vouchers (id, code, title, subtitle, discount_amount, type, display_discount, valid, color, text_color)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (code) DO UPDATE SET
                    title = EXCLUDED.title,
                    subtitle = EXCLUDED.subtitle,
                    discount_amount = EXCLUDED.discount_amount,
                    type = EXCLUDED.type,
                    display_discount = EXCLUDED.display_discount,
                    valid = EXCLUDED.valid,
                    color = EXCLUDED.color,
                    text_color = EXCLUDED.text_color
            `, [
                voucher.id,
                voucher.code,
                voucher.title,
                voucher.subtitle,
                voucher.discountAmount,
                voucher.type,
                voucher.displayDiscount,
                voucher.valid,
                voucher.color,
                voucher.textColor
            ]);
        }
        console.log(`Migrated ${vouchers.length} vouchers.`);

        await client.query('COMMIT');
        console.log('Migration completed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
};

migrateData();
