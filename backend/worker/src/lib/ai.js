const suggestionPrompt = `Generate 5 creative and engaging auto-reply rules for a social media bot.
Each rule must have a trigger "keyword", a friendly and professional "reply", and a "category".
Return only a JSON array of objects with those three string properties.`;

const suggestionSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      keyword: { type: "STRING" },
      reply: { type: "STRING" },
      category: { type: "STRING" },
    },
    required: ["keyword", "reply", "category"],
  },
};

export async function generateBotSuggestions(env) {
  if (typeof env.GEMINI_API_KEY !== "string" || !env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY Worker secret is not configured.");
  }

  const cleanKey = env.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, "");
  const modelEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const bodyStr = JSON.stringify({
    contents: [{ parts: [{ text: suggestionPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: suggestionSchema,
    },
  });

  const callDirectGemini = () =>
    fetch(modelEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey,
      },
      body: bodyStr,
    });

  let response;
  if (env.GEMINI_PROXY) {
    try {
      const doId = env.GEMINI_PROXY.idFromName("gemini-us-west-1");
      const stub = env.GEMINI_PROXY.get(doId, { locationHint: "wnam" });
      response = await stub.fetch("https://gemini-proxy/forward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-target-url": `${modelEndpoint}?key=${cleanKey}`,
        },
        body: bodyStr,
      });
      if (!response.ok) {
        console.warn("Gemini proxy returned non-OK status:", response.status);
        response = await callDirectGemini();
      }
    } catch (proxyError) {
      console.warn("Gemini proxy fetch failed, falling back to direct Gemini:", proxyError);
      response = await callDirectGemini();
    }
  } else {
    response = await callDirectGemini();
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Gemini suggestions response was not valid JSON:", error);
    throw new Error("Gemini returned an invalid response.");
  }
  if (!response.ok) {
    console.error("Gemini suggestions request failed:", response.status, result?.error?.message || "");
    throw new Error(result?.error?.message || "Gemini suggestions request failed.");
  }

  const text = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part) => typeof part === "string")
    .join("");
  if (!text) throw new Error("Gemini returned no suggestion content.");

  let suggestions;
  try {
    suggestions = JSON.parse(text);
  } catch (error) {
    console.error("Gemini suggestions content was not valid JSON:", error);
    throw new Error("Gemini returned invalid suggestions.");
  }
  if (!Array.isArray(suggestions) || suggestions.length !== 5 ||
      suggestions.some((item) =>
        !item || typeof item !== "object" ||
        typeof item.keyword !== "string" || !item.keyword.trim() ||
        typeof item.reply !== "string" || !item.reply.trim() ||
        typeof item.category !== "string" || !item.category.trim()
      )) {
    throw new Error("Gemini returned suggestions with an invalid format.");
  }

  return suggestions;
}
