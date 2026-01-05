const mongoose = require('mongoose');
const CreditPackage = require('../models/CreditPackage');

async function seedCreditPackages() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mongkul');

        // Clear existing packages
        await CreditPackage.deleteMany({});

        const packages = [
            {
                name: "Starter",
                credits: 100,
                price: 2.00,
                priceKHR: 8000,
                discount: 0,
                popular: false
            },
            {
                name: "Popular",
                credits: 500,
                price: 9.00,
                priceKHR: 36000,
                discount: 10,
                popular: true
            },
            {
                name: "Pro",
                credits: 1000,
                price: 16.00,
                priceKHR: 64000,
                discount: 20,
                popular: false
            },
            {
                name: "Enterprise",
                credits: 5000,
                price: 70.00,
                priceKHR: 280000,
                discount: 30,
                popular: false
            }
        ];

        await CreditPackage.insertMany(packages);

        console.log('✅ Credit packages seeded successfully!');
        console.log(`Created ${packages.length} packages`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding credit packages:', err);
        process.exit(1);
    }
}

seedCreditPackages();
