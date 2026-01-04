const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a YouTube thumbnail based on a topic.
 * @param {string} topic 
 * @returns {Promise<string>} - URL of the generated image
 */
exports.generateThumbnail = async (topic) => {
    try {
        const prompt = `
            Create a highly clickable, viral YouTube video thumbnail about: "${topic}".
            
            Style: High contrast, vivid colors, hyper-realistic 4k detailed.
            Elements: Expressive facial expression (shocked/excited) if applicable to topic, big bold text (but keep text minimal), 
            clean background separation. The image should look professional and eye-catching. 
            Aspect Ratio: 16:9.
        `;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024", // DALL-E 3 standard, crop to 16:9 in UI or prompt for aspect ratio if supported
            quality: "hd",
            style: "vivid"
        });

        return response.data[0].url;
    } catch (error) {
        console.error("Thumbnail Generation Error:", error);
        throw new Error("Failed to generate thumbnail: " + error.message);
    }
};
