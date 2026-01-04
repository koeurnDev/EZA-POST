/**
 * Randomizer Utility for Stealth Mode
 * Mimics human behavior with variable delays and jitter.
 */

/**
 * Pause execution for a random duration between min and max.
 * @param {number} min - Minimum wait time in milliseconds.
 * @param {number} max - Maximum wait time in milliseconds.
 * @returns {Promise<void>}
 */
exports.humanDelay = (min = 1000, max = 5000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Adds random "jitter" to a base timestamp.
 * Useful for scheduling posts so they don't go out at exact :00 seconds every time.
 * @param {Date} baseTime - The original scheduled time.
 * @param {number} jitterMinutes - Max jitter in minutes (default 5).
 * @returns {Date} - New adjusted Date object.
 */
exports.scheduleJitter = (baseTime, jitterMinutes = 5) => {
    const jitterMs = Math.floor(Math.random() * jitterMinutes * 60 * 1000);
    // 50% chance to be early or late
    const sign = Math.random() < 0.5 ? -1 : 1;
    return new Date(baseTime.getTime() + (sign * jitterMs));
};

/**
 * Returns true with a certain probability.
 * Useful for randomizing optional actions (like "watching" a video before downloading).
 * @param {number} probability - 0.0 to 1.0 (e.g., 0.8 for 80%)
 * @returns {boolean}
 */
exports.coinFlip = (probability = 0.5) => {
    return Math.random() < probability;
};
