const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../utils/auth');

/* -------------------------------------------------------------------------- */
/* GET / — Get user credit balance                                            */
/* -------------------------------------------------------------------------- */
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ 
            where: { id: req.user.id },
            select: {
                credits: true,
                totalCreditsSpent: true,
                totalCreditsPurchased: true
            }
        });

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
        const packages = await prisma.creditPackage.findMany({
            where: { active: true },
            orderBy: { credits: 'asc' }
        });

        res.json({ success: true, packages });
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
        const transactions = await prisma.creditTransaction.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.json({ success: true, transactions });
    } catch (err) {
        console.error('❌ Get transactions error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST /seed — Force seed packages (admin only)                              */
/* -------------------------------------------------------------------------- */
router.post('/seed', async (req, res) => {
    try {
        // Clear old packages
        await prisma.creditPackage.deleteMany({});

        const packages = [
            { name: "Starter", credits: 100, price: 2, priceKHR: 8000, discount: 0, popular: false, active: true },
            { name: "Popular", credits: 500, price: 9, priceKHR: 36000, discount: 10, popular: true, active: true },
            { name: "Pro", credits: 1000, price: 16, priceKHR: 64000, discount: 20, popular: false, active: true },
            { name: "Enterprise", credits: 5000, price: 70, priceKHR: 280000, discount: 30, popular: false, active: true }
        ];

        // Bulk insert
        await prisma.creditPackage.createMany({
            data: packages
        });

        const count = await prisma.creditPackage.count();

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

/* -------------------------------------------------------------------------- */
/* POST /add — Manually add credits (admin/testing)                           */
/* -------------------------------------------------------------------------- */
router.post('/add', requireAuth, async (req, res) => {
    try {
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        // Use transaction to ensure data integrity
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id: req.user.id } });
            if (!user) throw new Error('User not found');

            const newCredits = (user.credits || 0) + amount;
            const newTotalPurchased = (user.totalCreditsPurchased || 0) + amount;

            const updatedUser = await tx.user.update({
                where: { id: req.user.id },
                data: {
                    credits: newCredits,
                    totalCreditsPurchased: newTotalPurchased
                }
            });

            const transaction = await tx.creditTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'bonus',
                    amount: amount,
                    balance: newCredits,
                    description: description || `Manual credit addition: ${amount} credits`
                }
            });

            return { credits: updatedUser.credits, transaction };
        });

        res.json({
            success: true,
            credits: result.credits,
            message: `Added ${amount} credits`
        });
    } catch (err) {
        console.error('❌ Add credits error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
