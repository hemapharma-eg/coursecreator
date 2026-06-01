export const getActiveApiKey = () => {
    const customKey = localStorage.getItem('user_gemini_api_key');
    if (customKey && customKey.trim() !== "") {
        return customKey.trim();
    }
    return "";
};

async function fetchWithRetry(url, options, retries = 5) {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) throw new Error("RATE_LIMIT_EXCEEDED");
            if (response.status === 400 || response.status === 403) {
                const errBody = await response.json().catch(() => ({}));
                const errMsg = errBody?.error?.message?.toLowerCase() || "";
                if (errMsg.includes("key") || errMsg.includes("api") || errBody?.error?.status?.includes("INVALID_ARGUMENT")) {
                    throw new Error("INVALID_API_KEY");
                }
            }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (error.message === "RATE_LIMIT_EXCEEDED" || error.message === "INVALID_API_KEY") throw error;
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delays[i]));
        }
    }
}

export async function callGeminiText(promptOrParts) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const parts = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const payload = { contents: [{ parts: parts }], tools: [{ google_search: {} }] };
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function callGeminiJSON(promptOrParts, schema) {
    const activeKey = getActiveApiKey();
    if (!activeKey) throw new Error("MISSING_API_KEY");
    const parts = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const payload = { contents: [{ parts: parts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = await fetchWithRetry(url, options);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
}

export const mcqResponseSchema = {
    type: "OBJECT",
    properties: {
        mcqs: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctOptionIndex: { type: "INTEGER" },
                    explanation: { type: "STRING" }
                },
                required: ["question", "options", "correctOptionIndex", "explanation"]
            }
        }
    },
    required: ["mcqs"]
};
