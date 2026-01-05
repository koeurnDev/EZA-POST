const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../utils/auth');
const User = require('../models/User');
const CreditPackage = require('../models/CreditPackage');
const CreditTransaction = require('../models/CreditTransaction');

/* -------------------------------------------------------------------------- */
/* GET / — Get user credit balance                                            */
/* -------------------------------------------------------------------------- */
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            credits: user.credits || 0,
            totalSpent: user.totalCreditsSpent || 0,
            totalPurchased: user.totalCreditsPurchased || 0
        });
    } catch (err) {
        console.error('❌ Get credits error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* GET /packages — Get available credit packages                              */
/* -------------------------------------------------------------------------- */
router.get('/packages', async (req, res) => {
    try {
        const packages = await CreditPackage.find({ active: true }).sort({ credits: 1 });

        // Debug info
        const debug = {
            dbName: mongoose.connection.name,
            host: mongoose.connection.host,
            totalPackages: await CreditPackage.countDocuments({}),
            activePackages: packages.length,
            allPackageNames: (await CreditPackage.find({}, 'name')).map(p => p.name)
        };

        console.log('📦 Packages Debug:', debug);

        res.json({ success: true, packages, debug });
    } catch (err) {
        console.error('❌ Get packages error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* GET /transactions — Get credit transaction history                         */
/* -------------------------------------------------------------------------- */
router.get('/transactions', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const transactions = await CreditTransaction.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit);

        res.json({ success: true, transactions });
    } catch (err) {
        console.error('❌ Get transactions error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST /add — Manually add credits (admin/testing)                           */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* POST /seed — Force seed packages (admin only)                              */
/* -------------------------------------------------------------------------- */
router.post('/seed', async (req, res) => {
    try {
        await CreditPackage.deleteMany({});

        const packages = [
            { name: "Starter", credits: 100, price: 2, priceKHR: 8000, discount: 0, popular: false, active: true },
            { name: "Popular", credits: 500, price: 9, priceKHR: 36000, discount: 10, popular: true, active: true },
            { name: "Pro", credits: 1000, price: 16, priceKHR: 64000, discount: 20, popular: false, active: true },
            { name: "Enterprise", credits: 5000, price: 70, priceKHR: 280000, discount: 30, popular: false, active: true }
        ];

        await CreditPackage.insertMany(packages);

        const count = await CreditPackage.countDocuments();

        res.json({
            success: true,
            message: `Seeded ${count} packages`,
            packages
        });
    } catch (err) {
        console.error('❌ Seed error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/add', requireAuth, async (req, res) => {
    try {
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        const user = await User.findOne({ id: req.user.id });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Add credits
        user.credits += amount;
        user.totalCreditsPurchased += amount;
        await user.save();

        // Log transaction
        await CreditTransaction.create({
            userId: req.user.id,
            type: 'bonus',
            amount: amount,
            balance: user.credits,
            description: description || `Manual credit addition: ${amount} credits`
        });

        res.json({
            success: true,
            credits: user.credits,
            message: `Added ${amount} credits`
        });
    } catch (err) {
        console.error('❌ Add credits error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
