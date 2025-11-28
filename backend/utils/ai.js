// ============================================================
// 🧠 utils/ai.js — Google Gemini Integration
// ============================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const ai = {
    /**
     * Generate creative auto-reply suggestions
     * @returns {Promise<Array<{keyword: string, reply: string, category: string}>>}
     */
    generateSuggestions: async () => {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY is missing. Returning fallback suggestions.");
            return ai.getFallbackSuggestions();
        }

        try {
            const prompt = `
        Generate 5 creative and engaging auto-reply rules for a social media bot.
        Each rule should have a trigger 'keyword' and a 'reply' message.
        The replies should be friendly, professional, and encourage engagement.
        Return ONLY a raw JSON array (no markdown, no code blocks) with this structure:
        [{"keyword": "example", "reply": "response", "category": "support"}]
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up potential markdown formatting
            const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();

            return JSON.parse(jsonStr);
        } catch (err) {
            console.error("❌ AI Generation Error:", err.message);
            return ai.getFallbackSuggestions();
        }
    },

    /**
     * Fallback suggestions if AI fails or key is missing
     */
    getFallbackSuggestions: () => [
        {
            keyword: "price",
            reply: "Our pricing is very competitive! Check the link in bio for details. 💰",
            category: "sales",
        },
        {
            keyword: "shipping",
            reply: "We ship worldwide! 🌍 Delivery usually takes 3-5 business days.",
            category: "support",
        },
        {
            keyword: "collab",
            reply: "We'd love to collaborate! DM us your portfolio. 🤝",
            category: "collaboration",
        },
        {
            keyword: "love",
            reply: "Thank you so much for the love! ❤️ We appreciate you!",
            category: "engagement",
        },
        {
            keyword: "help",
            reply: "We're here to help! Send us a DM and we'll sort it out. 🛠️",
            category: "support",
        },
    ],
};

module.exports = ai;
