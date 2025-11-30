const { body, validationResult } = require('express-validator');

// 🛡️ Middleware to handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Return the first error message
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    next();
};

// ✅ Validation Rules for Single Post
exports.validatePost = [
    body('caption')
        .optional()
        .trim()
        .isLength({ max: 2200 }).withMessage('Caption cannot exceed 2200 characters')
        .escape(), // Sanitize input

    body('title')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters')
        .escape(),

    body('accounts')
        .notEmpty().withMessage('At least one account is required')
        .custom((value) => {
            try {
                const accounts = JSON.parse(value);
                if (!Array.isArray(accounts) || accounts.length === 0) throw new Error();
                return true;
            } catch {
                throw new Error('Invalid accounts format');
            }
        }),

    validate
];

// ✅ Validation Rules for Mixed Carousel
exports.validateCarousel = [
    body('caption')
        .optional()
        .trim()
        .isLength({ max: 2200 }).withMessage('Caption cannot exceed 2200 characters')
        .escape(),

    body('accounts')
        .notEmpty().withMessage('At least one account is required')
        .custom((value) => {
            try {
                const accounts = JSON.parse(value);
                if (!Array.isArray(accounts) || accounts.length === 0) throw new Error();
                return true;
            } catch {
                throw new Error('Invalid accounts format');
            }
        }),

    body('carouselCards')
        .optional()
        .custom((value) => {
            try {
                const cards = JSON.parse(value);
                if (!Array.isArray(cards)) throw new Error();

                // Validate each card
                cards.forEach(card => {
                    if (card.headline && card.headline.length > 40) throw new Error('Headline too long (max 40 chars)');
                    if (card.description && card.description.length > 20) throw new Error('Description too long (max 20 chars)');
                    if (card.link && !card.link.startsWith('http')) throw new Error('Invalid URL in card');
                });

                return true;
            } catch (e) {
                throw new Error(e.message || 'Invalid carouselCards format');
            }
        }),

    validate
];
