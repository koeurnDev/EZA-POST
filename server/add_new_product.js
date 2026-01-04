
require('dotenv').config({ path: './.env' });
const cloudinary = require('cloudinary').v2;
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

const imagePath = String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_1765707451714.png`;

async function addProduct() {
    try {
        console.log('🚀 Starting Product Addition: KLEN Herbal Shampoo & Conditioner...');

        // 1. Upload Image
        console.log(`\n📤 Uploading image...`);
        if (!fs.existsSync(imagePath)) {
            throw new Error('Image file not found!');
        }

        const uploadResult = await cloudinary.uploader.upload(imagePath, {
            folder: 'girly-shop/products',
            public_id: 'klen-herbal-shampoo-conditioner',
            overwrite: true
        });

        console.log(`✅ Image uploaded: ${uploadResult.secure_url}`);

        // 2. Prepare Data
        const newProduct = {
            name: "KLEN Herbal Hair Shampoo & Conditioner",
            price: 8.50,
            image: uploadResult.secure_url,
            category: "Treat",
            rating: 4.8,
            reviews: 0,
            isNew: true,
            stock: 50,
            brand: "KLEN",
            volume: "Standard",
            description: "Advanced Korean herbal formula hair care range. Available for different hair needs: Anti-Dandruff (Men/Women), Hair Fall Control, Damaged Hair Repair, and Normal Hair maintenance.",
            howToUse: [
                "Apply to wet hair and massage into scalp.",
                "Rinse thoroughly.",
                "Follow with KLEN Conditioner for best results."
            ],
            ingredients: "Korean Ginseng, Herbal Extracts, Keratin, Zinc Pyrithione...",
            highlights: [
                "Korean Herbal Formula",
                "Anti-Dandruff Expert",
                "Hair Fall Control",
                "Scalp Care"
            ]
        };

        // 3. Insert into DB
        const res = await db.query(
            `INSERT INTO products (
                name, price, image, category, rating, reviews, 
                is_new, stock, brand, volume, description, 
                how_to_use, ingredients, highlights
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id`,
            [
                newProduct.name,
                newProduct.price,
                newProduct.image,
                newProduct.category,
                newProduct.rating,
                newProduct.reviews,
                newProduct.isNew,
                newProduct.stock,
                newProduct.brand,
                newProduct.volume,
                newProduct.description,
                JSON.stringify(newProduct.howToUse),
                newProduct.ingredients,
                JSON.stringify(newProduct.highlights)
            ]
        );

        console.log(`🎉 Product added successfully to DB with ID: ${res.rows[0].id}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

addProduct();
