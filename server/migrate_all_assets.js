const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const PUBLIC_DIR = path.join(__dirname, '../public');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const db = require('./db');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const PUBLIC_DIR = path.join(__dirname, '../public');

async function uploadImage(localPath, folder) {
    // localPath might be "/banners/banner-laneige.jpg"
    // Public file path: "../public/banners/banner-laneige.jpg"

    // Remove leading slash if present for path joining
    const relativePath = localPath.startsWith('/') ? localPath.slice(1) : localPath;
    const fullPath = path.join(PUBLIC_DIR, relativePath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ File not found: ${fullPath} (Original: ${localPath})`);
        return null;
    }

    try {
        console.log(`☁️ Uploading: ${relativePath}...`);
        const result = await cloudinary.uploader.upload(fullPath, {
            folder: `girly-shop/${folder}`,
            use_filename: true,
            unique_filename: true
        });
        console.log(`✅ Success: ${result.secure_url}`);
        return result.secure_url;
    } catch (error) {
        console.error(`❌ Failed to upload ${relativePath}:`, error);
        return null;
    }
}

async function migrateBanners() {
    console.log('\n--- Migrating Banners (DB) ---');
    try {
        const res = await db.query('SELECT id, src FROM banners');
        const banners = res.rows;
        let updateCount = 0;

        for (let banner of banners) {
            if (banner.src && !banner.src.startsWith('http')) {
                // It's a local path
                const newUrl = await uploadImage(banner.src, 'banners');
                if (newUrl) {
                    await db.query('UPDATE banners SET src = $1 WHERE id = $2', [newUrl, banner.id]);
                    console.log(`   Updated Banner ID ${banner.id}`);
                    updateCount++;
                }
            }
        }
        console.log(`\n💾 Updated ${updateCount} banners in DB.`);
    } catch (error) {
        console.error('Error migrating banners:', error);
    }
}

async function migrateProducts() {
    console.log('\n--- Migrating Products (DB) ---');
    try {
        const res = await db.query('SELECT id, image FROM products');
        const products = res.rows;
        let updateCount = 0;

        for (let product of products) {
            if (product.image && !product.image.startsWith('http')) {
                // It's a local path
                const newUrl = await uploadImage(product.image, 'products');
                if (newUrl) {
                    await db.query('UPDATE products SET image = $1 WHERE id = $2', [newUrl, product.id]);
                    console.log(`   Updated Product ID ${product.id}`);
                    updateCount++;
                }
            }
        }
        console.log(`\n💾 Updated ${updateCount} products in DB.`);
    } catch (error) {
        console.error('Error migrating products:', error);
    }
}

async function migrateUIAssets() {
    console.log('\n--- Migrating UI Assets ---');
    const assets = ['login-premium-products.png', 'user-avatar.jpg'];

    for (const asset of assets) {
        const newUrl = await uploadImage(asset, 'ui');
        if (newUrl) {
            console.log(`✨ REPLACE IN CODE: "/${asset}" -> "${newUrl}"`);
        }
    }
}

async function main() {
    await migrateBanners();
    await migrateProducts();
    await migrateUIAssets();
    console.log('\n🎉 Migration Complete!');
    process.exit();
}

main();
