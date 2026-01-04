
require('dotenv').config({ path: './.env' });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const db = require('./db');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const newBanners = [
    {
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_0_1765705593498.png`,
        title: "New Makeup Collection",
        subtitle: "Express yourself with our latest vibrant shades.",
        btnText: "Explore Makeup",
        publicId: "banner-new-makeup"
    },
    {
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_1_1765705593498.png`,
        title: "New Skincare Arrival",
        subtitle: "Hydrate and glow with our premium skincare line.",
        btnText: "Shop Skincare",
        publicId: "banner-new-skincare"
    }
];

async function addBannersBatch() {
    try {
        console.log('🚀 Starting Banner Addition...');

        for (const item of newBanners) {
            console.log(`\n📤 Processing Banner: ${item.title}`);

            if (!fs.existsSync(item.imagePath)) {
                console.error(`❌ Image not found: ${item.imagePath}`);
                continue;
            }

            // Upload Image
            const uploadResult = await cloudinary.uploader.upload(item.imagePath, {
                folder: 'girly-shop/banners',
                public_id: item.publicId,
                overwrite: true
            });
            console.log(`   ✅ Image uploaded: ${uploadResult.secure_url}`);

            // Insert into PostgreSQL
            // We use a big random ID or let Serial handle it if we changed schema, but schema had BIGINT PRIMARY KEY.
            // Let's generate a timestamp-based ID to be safe or just let the DB handle it if it was SERIAL.
            // Looking at migration script: "id BIGINT PRIMARY KEY". It's not SERIAL in the CREATE TABLE provided earlier (migrate-json-to-pg.js:58).
            // So we must provide an ID.
            const newId = Date.now() + Math.floor(Math.random() * 1000);

            const res = await db.query(
                `INSERT INTO banners (id, src, title, subtitle, btn_text)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [newId, uploadResult.secure_url, item.title, item.subtitle, item.btnText]
            );

            console.log(`   🎉 Added banner to DB with ID: ${res.rows[0].id}`);
        }

        console.log('\n✅ All banners processed successfully!');

    } catch (error) {
        console.error('❌ Banner Batch Error:', error);
    } finally {
        process.exit();
    }
}

addBannersBatch();
