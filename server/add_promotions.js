
require('dotenv').config({ path: './.env' });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const db = require('./db');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const newPromos = [
    {
        title: "Portré: Capture the Moment",
        subtitle: "Blur Texture Tint & Essentials",
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_0_1765708218111.png`,
        publicId: "promo-portre-model",
        type: "campaign"
    },
    {
        title: "Innisfree x Wonyoung: Sun Care",
        subtitle: "Green Tea Hyaluronic Moist Sun Serum",
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_1_1765708218111.png`,
        publicId: "promo-innisfree-sun-serum",
        type: "campaign"
    },
    {
        title: "Brighten Your Day",
        subtitle: "Vitamin C Green Tea Enzyme Brightening Cream",
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_2_1765708218111.png`,
        publicId: "promo-innisfree-vit-c",
        type: "campaign"
    },
    {
        title: "Hydration Powerhouse",
        subtitle: "The New Green Tea Seed Hyaluronic Line",
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_3_1765708218111.png`,
        publicId: "promo-innisfree-green-tea-line",
        type: "campaign"
    }
];

async function addPromos() {
    try {
        console.log('🚀 Starting Promotion Images Addition to DB...');

        for (const item of newPromos) {
            console.log(`\n📤 Processing: ${item.title}`);

            if (!fs.existsSync(item.imagePath)) {
                console.error(`❌ Image not found: ${item.imagePath}`);
                continue;
            }

            // 1. Upload Image
            const uploadResult = await cloudinary.uploader.upload(item.imagePath, {
                folder: 'girly-shop/promotions',
                public_id: item.publicId,
                overwrite: true
            });
            console.log(`   ✅ Image uploaded: ${uploadResult.secure_url}`);

            // 2. Insert into PostgreSQL (using banners table as fallback for promotions)
            // Generate a unique ID (Schema uses BIGINT, so timestamp is safe)
            const newId = Date.now() + Math.floor(Math.random() * 1000);

            // Mapping 'promotions' to 'banners' table structure:
            // src <- image
            // title <- title
            // subtitle <- subtitle
            // alt <- title
            // btn_text <- "View Details" (default)
            const res = await db.query(
                `INSERT INTO banners (id, src, alt, title, subtitle, btn_text)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [
                    newId,
                    uploadResult.secure_url,
                    item.title, // alt
                    item.title,
                    item.subtitle,
                    "View Details" // default btn_text
                ]
            );

            console.log(`   🎉 Added promotion to DB (banners table) with ID: ${res.rows[0].id}`);
        }

        console.log('\n✅ All promotion images processed successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

addPromos();
