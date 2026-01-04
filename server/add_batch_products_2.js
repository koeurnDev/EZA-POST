require('dotenv').config({ path: './.env' });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { Pool } = require('pg');

// 1. Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configure Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// 3. New Product Data
const newProductsBatch = [
    {
        name: "Hada Labo Koi-Gokujyun UV White Gel SPF50+ PA++++",
        price: 14.50,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_0_1765706929912.png`,
        publicId: "hada-labo-uv-white-gel",
        category: "Protect",
        rating: 4.8,
        reviews: 24,
        brand: "Hada Labo",
        volume: "90g",
        description: "A multi-functional UV gel that acts as a lotion, beauty serum, emulsion, cream, and mask. Provides strong SPF50+ protection while hydrating the skin with Hyaluronic Acid and Vitamin C.",
        highlights: ["All-in-One Gel", "SPF50+ PA++++", "Lightweight", "Vitamin C Infused"]
    },
    {
        name: "Hada Labo Gokujyun Premium Hydrating Lotion",
        price: 13.80,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_1_1765706929912.png`,
        publicId: "hada-labo-premium-lotion",
        category: "Treat",
        rating: 4.9,
        reviews: 45,
        brand: "Hada Labo",
        volume: "170ml",
        description: "A rich, essence-like toner containing 5 types of Hyaluronic Acid to deliver intense moisture to the skin. Perfect for dry skin, leaving it supple and soft.",
        highlights: ["5 Types of Hyaluronic Acid", "Intense Hydration", "Alcohol-Free", "Fragrance-Free"]
    },
    {
        name: "Biore UV Aqua Rich Watery Essence SPF50+ PA++++",
        price: 10.50,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_2_1765706929912.png`,
        publicId: "biore-uv-aqua-rich-essence",
        category: "Protect",
        rating: 4.8,
        reviews: 120,
        brand: "Biore",
        volume: "50g",
        description: "Water-based sunscreen that applies effortlessly like a serum. Features Micro Defense formula to cover uneven skin surfaces. Water resistant yet washes off with soap.",
        highlights: ["Micro Defense Formula", "Watery Texture", "No White Cast", "Hyaluronic Acid"]
    },
    {
        name: "Care:nel Sleeping Lip Care Lime Night Mask",
        price: 8.00,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_4_1765706929912.png`,
        publicId: "carenel-lime-lip-mask",
        category: "Treat",
        rating: 4.7,
        reviews: 15,
        brand: "Care:nel",
        volume: "5g",
        description: "A sleeping mask for dry, chapped lips. Enriched with Lime and Vitamin C to gently exfoliate and deeply moisturize lips overnight.",
        highlights: ["Overnight Lip Repair", "Vitamin C Rich", "Fresh Lime Scent", "Melt-in Texture"]
    }
];

async function addProductBatch() {
    console.log('🚀 Starting Product Batch Addition to Database...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start Transaction

        // Note: With SERIAL/BIGSERIAL 'id' column in Postgres, we don't need to manually calculate ID.
        // We let the database handle it.

        for (const item of newProductsBatch) {
            console.log(`\n📤 Processing: ${item.name}`);

            if (!fs.existsSync(item.imagePath)) {
                console.error(`❌ Image not found: ${item.imagePath}`);
                continue;
            }

            // 1. Upload to Cloudinary
            const uploadResult = await cloudinary.uploader.upload(item.imagePath, {
                folder: 'girly-shop/products',
                public_id: item.publicId,
                overwrite: true
            });
            console.log(`   ✅ Cloudinary: ${uploadResult.secure_url}`);

            // 2. Insert into PostgreSQL
            const query = `
                INSERT INTO products (
                    name, price, image, category, rating, reviews, 
                    is_new, stock, brand, volume, description, 
                    highlights, how_to_use, ingredients
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id;
            `;

            // Default values
            const howToUse = ["Apply as directed.", "Suitable for daily use."];
            const ingredients = "";
            const stock = 50;
            const isNew = true;

            const values = [
                item.name,
                item.price,
                uploadResult.secure_url,
                item.category,
                item.rating,
                item.reviews,
                isNew,
                stock,
                item.brand,
                item.volume,
                item.description,
                JSON.stringify(item.highlights), // Store array as JSON string
                JSON.stringify(howToUse),
                ingredients
            ];

            const res = await client.query(query, values);
            console.log(`   🎉 Database: Inserted Product ID ${res.rows[0].id}`);
        }

        await client.query('COMMIT');
        console.log('\n✅ All products added successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Batch Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

addProductBatch();
