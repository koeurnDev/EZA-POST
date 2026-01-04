const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Generates a video script based on a topic in Khmer.
 * @param {string} topic 
 * @returns {Promise<string>}
 */
exports.generateScript = async (topic) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Act as a professional viral video scriptwriter for TikTok and Reels.
            Write a script in Khmer (Cambodian) about the following topic: "${topic}".
            
            Structure the script as follows:
            1. **Hook** (0-3 seconds): Grab attention immediately.
            2. **Body**: Explain the main point clearly and engagingly.
            3. **Call to Action (CTA)**: Encourage likes, shares, or follows.
            
            Keep the tone exciting, friendly, and easy to understand (Spoken Khmer style).
            Use emojis where appropriate.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Script Generation Error:", error);
        throw new Error("Failed to generate script: " + error.message);
    }
};
