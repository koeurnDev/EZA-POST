// ============================================================
// 📊 Viral Score Calculator Service
// ============================================================

/**
 * Calculate viral potential score for a post based on engagement metrics
 * @param {Object} metrics - Post engagement metrics
 * @param {Date} createdAt - Post creation timestamp
 * @returns {Object} { viralScore, viralTier }
 */
function calculateViralScore(metrics, createdAt) {
    const {
        likes = 0,
        comments = 0,
        shares = 0,
        reactions = {},
        reach = 0,
        impressions = 0
    } = metrics;

    // Calculate hours since post creation
    const now = new Date();
    const postAge = (now - new Date(createdAt)) / (1000 * 60 * 60); // hours
    const hoursOld = Math.max(postAge, 1); // Minimum 1 hour to avoid division by zero

    // Weighted engagement score
    const loveReactions = (reactions.love || 0) + (reactions.wow || 0);
    const negativeReactions = (reactions.sad || 0) + (reactions.angry || 0);

    const engagementScore = (
        (likes * 1.0) +
        (comments * 2.0) +      // Comments weighted higher (more valuable)
        (shares * 3.0) +        // Shares weighted highest (viral indicator)
        (loveReactions * 1.5) - // Positive reactions boost
        (negativeReactions * 0.5) // Negative reactions slightly reduce
    );

    // Time decay factor - newer posts with same engagement score higher
    const timeDecayFactor = 1 / Math.sqrt(hoursOld);

    // Reach efficiency - how well the post converts views to engagement
    const reachEfficiency = reach > 0 ? (engagementScore / reach) * 100 : 0;

    // Calculate raw score
    const rawScore = (engagementScore * timeDecayFactor) + (reachEfficiency * 0.5);

    // Normalize to 0-100 scale (using logarithmic scaling for better distribution)
    const viralScore = Math.min(100, Math.max(0, Math.log10(rawScore + 1) * 25));

    // Determine viral tier
    let viralTier;
    if (viralScore >= 76) {
        viralTier = 'viral';
    } else if (viralScore >= 51) {
        viralTier = 'high';
    } else if (viralScore >= 26) {
        viralTier = 'medium';
    } else {
        viralTier = 'low';
    }

    return {
        viralScore: Math.round(viralScore * 10) / 10, // Round to 1 decimal
        viralTier,
        metadata: {
            engagementScore,
            hoursOld: Math.round(hoursOld * 10) / 10,
            reachEfficiency: Math.round(reachEfficiency * 100) / 100
        }
    };
}

/**
 * Determine if a post is worth boosting based on viral score
 * @param {Number} viralScore - Calculated viral score
 * @param {Number} minScore - Minimum score threshold (default: 50)
 * @returns {Boolean}
 */
function isBoostWorthy(viralScore, minScore = 50) {
    return viralScore >= minScore;
}

/**
 * Get recommended boost budget based on viral score and engagement
 * @param {Number} viralScore - Calculated viral score
 * @param {Object} metrics - Post engagement metrics
 * @returns {Object} { minBudget, maxBudget, recommended }
 */
function getRecommendedBudget(viralScore, metrics) {
    const { reach = 0, engagement = 0 } = metrics;

    let recommended;

    if (viralScore >= 76) {
        // Viral posts - aggressive boost
        recommended = 50;
    } else if (viralScore >= 51) {
        // High potential - moderate boost
        recommended = 25;
    } else {
        // Medium potential - conservative boost
        recommended = 10;
    }

    // Adjust based on current reach
    if (reach > 10000) {
        recommended *= 1.5;
    } else if (reach > 5000) {
        recommended *= 1.2;
    }

    return {
        minBudget: 5,
        maxBudget: 500,
        recommended: Math.min(500, Math.max(5, Math.round(recommended)))
    };
}

module.exports = {
    calculateViralScore,
    isBoostWorthy,
    getRecommendedBudget
};
