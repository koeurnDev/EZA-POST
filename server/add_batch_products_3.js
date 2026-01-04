
require('dotenv').config({ path: './.env' });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const productsPath = path.join(__dirname, 'data/products.json');

const newProductsBatch = [
    {
        name: "Kate Somerville Goat Milk Moisturizing Cleanser",
        price: 44.00,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_0_1765707875030.png`,
        publicId: "kate-somerville-goat-milk-cleanser",
        category: "Cleanse",
        rating: 4.8,
        reviews: 320,
        brand: "Kate Somerville",
        volume: "120ml",
        description: "A gentle, daily foaming cleanser that deeply cleanses without stripping skin. Formulated with Goat Milk to soothe and moisturize dry, sensitive skin.",
        highlights: ["Sulfate-Free", "Goat Milk Soothing", "Manuka Honey", "For Sensitive Skin"]
    },
    {
        name: "KLEN Anti-Hairfall Shampoo",
        price: 8.50,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_1_1765707875030.png`,
        publicId: "klen-anti-hairfall-shampoo",
        category: "Treat", // Hair Care
        rating: 4.7,
        reviews: 12,
        brand: "KLEN",
        volume: "Standard",
        description: "Specialized formula to reduce hair fall and strengthen hair roots. Enriched with herbal extracts to promote healthy hair growth.",
        highlights: ["Reduces Hair Fall", "Strengthens Roots", "Herbal Formula", "Daily Use"]
    },
    {
        name: "KLEN Sport Cool Men Anti-Dandruff Shampoo",
        price: 8.50,
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_2_1765707875030.png`,
        publicId: "klen-sport-cool-men-shampoo",
        category: "Treat", // Hair Care
        rating: 4.9,
        reviews: 25,
        brand: "KLEN",
        volume: "Standard",
        description: "Refreshing cool menthol shampoo designed for men. effectively fights dandruff while providing an icy cool sensation for the scalp.",
        highlights: ["Anti-Dandruff", "Icy Cool Menthol", "Scalp Care", "For Men"]
    },
    {
        name: "Fresh Rose Face Mask",
        price: 64.00, // Premium pricing for 100ml
        imagePath: String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_3_1765707875030.png`,
        publicId: "fresh-rose-face-mask",
        category: "Treat", // Mask
        rating: 4.9,
        reviews: 580,
        brand: "Fresh",
        volume: "100ml",
        description: "An instant hydrating mask with real rose petals suspended in a silky gel that gently soothes and tones by plumping the skin with hydration.",
        highlights: ["Real Rose Petals", "Hydrates & Tones", "Cucumber & Aloe", "All Skin Types"]
    }
];

async function addBatch() {
    try {
        console.log('🚀 Starting Batch 3 Addition...');

        let productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
        let maxId = productsData.reduce((max, p) => (p.id > max ? p.id : max), 0);

        for (const item of newProductsBatch) {
            console.log(`\n📤 Processing: ${item.name}`);

            if (!fs.existsSync(item.imagePath)) {
                console.error(`❌ Image not found: ${item.imagePath}`);
                continue;
            }

            // Upload Image
            const uploadResult = await cloudinary.uploader.upload(item.imagePath, {
                folder: 'girly-shop/products',
                public_id: item.publicId,
                overwrite: true
            });
            console.log(`   ✅ Image uploaded: ${uploadResult.secure_url}`);

            // Create Product
            maxId++;
            const newProduct = {
                id: maxId,
                name: item.name,
                price: item.price,
                image: uploadResult.secure_url,
                category: item.category,
                rating: item.rating,
                reviews: item.reviews,
                isNew: true,
                stock: 50,
                brand: item.brand,
                volume: item.volume,
                description: item.description,
                howToUse: ["Apply as directed.", "Suitable for daily use."],
                ingredients: "",
                highlights: item.highlights
            };

            productsData.push(newProduct);
            console.log(`   🎉 Added ID: ${maxId}`);
        }

        // Save All
        fs.writeFileSync(productsPath, JSON.stringify(productsData, null, 2));
        console.log('\n✅ Batch 3 completed successfully!');

    } catch (error) {
        console.error('❌ Batch Error:', error);
    }
}

addBatch();
