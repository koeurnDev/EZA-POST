
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

const promosPath = path.join(__dirname, 'data/promotions.json');
const imagePath = String.raw`C:/Users/ASUS/.gemini/antigravity/brain/1bedac30-b5c2-4a5d-9f07-8210c04f2b4a/uploaded_image_1765708590993.png`;

async function addPromo() {
    try {
        console.log('🚀 Adding Bebe Tint Promo...');

        let promoData = [];
        if (fs.existsSync(promosPath)) {
            promoData = JSON.parse(fs.readFileSync(promosPath, 'utf8'));
        }

        // Upload Image
        if (!fs.existsSync(imagePath)) {
            throw new Error('Image file not found!');
        }

        const uploadResult = await cloudinary.uploader.upload(imagePath, {
            folder: 'girly-shop/promotions',
            public_id: 'promo-amuse-bebe-tint',
            overwrite: true
        });
        console.log(`✅ Image uploaded: ${uploadResult.secure_url}`);

        // Create Promo Entry
        const maxId = promoData.reduce((max, p) => (p.id > max ? p.id : max), 0);
        const newPromo = {
            id: maxId + 1,
            title: "Amuse x Wonyoung",
            subtitle: "New Bebe Tint Mini Collection",
            image: uploadResult.secure_url,
            type: "campaign",
            dateAdded: new Date().toISOString()
        };

        promoData.push(newPromo);
        fs.writeFileSync(promosPath, JSON.stringify(promoData, null, 2));
        console.log('🎉 Promo added successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

addPromo();
