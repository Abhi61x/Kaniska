
import { GoogleGenAI, Modality } from '@google/genai';

// A custom error class to signal API key issues that the user can fix.
export class ApiKeyError extends Error {
  keyType: string;
  constructor(message, keyType) {
    super(message);
    this.name = 'ApiKeyError';
    this.keyType = keyType;
    Object.setPrototypeOf(this, ApiKeyError.prototype);
  }
}

// A custom error for the main, environment-set API key which the user cannot fix.
export class MainApiKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MainApiKeyError';
    Object.setPrototypeOf(this, MainApiKeyError.prototype);
  }
}

// A custom error class for rate limit/quota issues.
export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// A custom error class for general service-side issues (e.g., 5xx errors).
export class ServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const VALID_EMOTIONS = ['neutral', 'happy', 'sad', 'excited', 'empathetic', 'singing', 'formal', 'chirpy', 'surprised', 'curious', 'thoughtful', 'joking'];

// --- Cashfree Configuration ---
const CASHFREE_APP_ID = "1101869ed2c0377169521b1819d9681011";
const CASHFREE_SECRET_KEY = "cfsk_ma_prod_2385fe07d4c1aab3e55ebc75d8e9fe76_de8436d3";

// Centralized error handler for all Gemini API calls to provide consistent, specific feedback.
function handleGeminiError(error, context = 'processing your request') {
    console.error(`Error calling the Gemini API during ${context}:`, error);
    const errorMessage = (error.message || error.toString() || '').toLowerCase();

    if (errorMessage.includes('api key not valid')) {
        return new MainApiKeyError("I can't connect to my core services. This app's main API key seems to be invalid or missing.");
    }
    if (errorMessage.includes('rate limit')) {
        return new RateLimitError("I'm receiving a lot of requests right now. To avoid interruptions, please wait a moment before trying again.");
    }
    if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        return new Error("I am unable to provide a response to that due to my safety guidelines. Please try a different topic.");
    }
    if (error instanceof TypeError && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
         return new Error("I'm unable to connect to Gemini services. Please check your internet connection and try again.");
    }
    // Generic error for other cases (500 errors, etc.)
    return new ServiceError(`I encountered an unexpected issue while ${context}. The service might be temporarily busy. Please try again in a few moments.`);
}

export async function processUserCommand(
    history, 
    systemInstruction, 
    temperature,
    emotionTuning
) {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.sender !== 'user' || !lastMessage.text.trim()) {
      // This case should ideally not be retried as it's not an API failure.
      throw new Error("I didn't hear that. Could you please say it again?");
  }
  try {
    const contents = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    const emotionInstruction = `
PERSONALITY TUNING:
When formulating your 'reply', first analyze the emotional tone of the user's most recent message. Adapt your 'emotion' value and the tone of your 'reply' to be appropriate to the user's detected emotion. For example, if the user sounds frustrated, adopt an 'empathetic' and helpful tone. If they are excited, share their excitement with a 'happy' or 'excited' tone. While doing this, still generally adhere to your core personality traits defined below on a scale of 0 to 100.
- Happiness: ${emotionTuning.happiness}. (0 is melancholic, 100 is extremely joyful).
- Empathy: ${emotionTuning.empathy}. (0 is clinical and detached, 100 is deeply compassionate).
- Formality: ${emotionTuning.formality}. (0 is very casual and uses slang, 100 is extremely formal and professional).
- Excitement: ${emotionTuning.excitement}. (0 is calm and monotonous, 100 is highly energetic and expressive).
- Sadness: ${emotionTuning.sadness}. (0 is optimistic, 100 is sorrowful and somber).
- Curiosity: ${emotionTuning.curiosity}. (0 is passive, 100 is inquisitive and might ask clarifying questions).
Your 'emotion' value in the JSON output must reflect this adaptive process.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            // FIX: When using googleSearch, responseMimeType and responseSchema are not allowed.
            // The model is instructed to return JSON via the system prompt.
            tools: [{googleSearch: {}}],
            systemInstruction: `${systemInstruction}\n${emotionInstruction}`,
            temperature: temperature,
        }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("I'm sorry, but I can't provide a response to that due to my safety guidelines.");
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks
        ?.map(chunk => chunk.web)
        .filter((web) => !!(web?.uri && web.title))
        .map(web => ({ uri: web.uri, title: web.title })) || [];

    try {
        const jsonText = response.text.trim();
        const cleanJsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleanJsonText);

        if (typeof parsed.command !== 'string' || typeof parsed.reply !== 'string' || typeof parsed.youtubeQuery !== 'string' || typeof parsed.location !== 'string' || typeof parsed.emotion !== 'string' || typeof parsed.newsQuery !== 'string' || typeof parsed.imagePrompt !== 'string' || typeof parsed.songTitle !== 'string' || typeof parsed.songArtist !== 'string' || typeof parsed.timerDurationSeconds !== 'number') {
            throw new Error('Invalid JSON structure from Gemini');
        }

        const validatedEmotion = VALID_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral';

        return {
            command: parsed.command,
            reply: parsed.reply,
            youtubeQuery: parsed.youtubeQuery || '',
            newsQuery: parsed.newsQuery || '',
            location: parsed.location || '',
            imagePrompt: parsed.imagePrompt || '',
            emotion: validatedEmotion,
            sources,
            songTitle: parsed.songTitle || '',
            songArtist: parsed.songArtist || '',
            timerDurationSeconds: parsed.timerDurationSeconds || 0,
        };
    } catch (jsonError) {
        console.warn("Failed to parse Gemini response as JSON. Falling back to plain text reply.", {
            error: jsonError,
            originalText: response.text
        });
        // If JSON parsing fails, the model likely returned a plain text response.
        // We can salvage this by wrapping it in a default REPLY command, making the assistant more robust.
        return {
            command: 'REPLY',
            reply: response.text.trim(),
            youtubeQuery: '',
            newsQuery: '',
            location: '',
            imagePrompt: '',
            emotion: 'neutral',
            sources,
            songTitle: '',
            songArtist: '',
            timerDurationSeconds: 0,
        };
    }
  } catch (apiError) {
    throw handleGeminiError(apiError, 'processing your command');
  }
}

export async function getSupportResponse(history) {
    const systemInstruction = `You are a helpful and friendly support assistant for an AI voice assistant application called Kaniska. Your role is to answer user questions about the app's features, settings, API keys, and troubleshooting. Do not go off-topic. Keep your answers concise and easy to understand.

The app's features include:
- Live voice conversations with an AI.
- Searching and playing YouTube videos.
- Getting weather forecasts (requires a Visual Crossing API key).
- Fetching top news headlines (requires a GNews API key).
- Setting timers.
- Singing songs (requires Gemini to find lyrics).
- Recognizing songs playing nearby (requires an Audd.io API key).
- A code editor for writing and modifying code with AI assistance.
- Generating images and visualizing concepts (holographic display).

**Subscription Plans:**
- **Free Plan:** 1 hour of usage per day. (Price: ₹0)
- **Monthly Plan:** Unlimited usage, high priority. (Price: ₹100/month)
- **Quarterly Plan:** Unlimited usage, high priority. (Price: ₹200/3 months)
- **Half-Yearly Plan:** Unlimited usage, high priority. (Price: ₹350/6 months)
- **Yearly Plan:** Unlimited usage, high priority, best value. (Price: ₹500/year)

Users can configure:
- Persona: Gender (male/female), greeting message, and emotional tuning.
- Voice: Specific TTS voices for each gender.
- API Keys: For weather, news, YouTube, and song recognition.
- Theme: Light or dark mode.

When asked about API keys, guide them to the FAQ section in the Help & Support tab for detailed, step-by-step instructions.`;

    try {
        const contents = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            }
        });

        return response.text.trim();
    } catch (apiError) {
        throw handleGeminiError(apiError, 'getting support response');
    }
}


export async function processCodeCommand(
    code,
    language,
    instruction
) {
    const systemInstruction = `You are an expert coding assistant. Your task is to modify the provided code based on the user's instruction.
Return ONLY a valid JSON object with the following structure:
{
  "newCode": "The full, updated code as a single string. Do not use markdown.",
  "explanation": "A brief, conversational explanation of the changes you made. This will be spoken to the user."
}

If the user's instruction is to debug, find and fix any errors in the code. If the user asks to write new code, the "current code" might be empty.
Do not add any comments to the code unless specifically asked to.
The user's instruction is: "${instruction}".
The programming language is: "${language}".`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Use a more powerful model for coding
            contents: [{ role: 'user', parts: [{ text: `Current code:\n\`\`\`${language}\n${code}\n\`\`\`` }] }],
            config: {
                systemInstruction: systemInstruction,
                // FIX: Removed responseMimeType and responseSchema to rely on the system prompt for JSON output, which is a more robust method.
                temperature: 0.1, // Be precise for coding
            },
        });
        
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);

        if (typeof parsed.newCode !== 'string' || typeof parsed.explanation !== 'string') {
            throw new Error('Invalid JSON structure from Gemini for code command');
        }

        return {
            newCode: parsed.newCode,
            explanation: parsed.explanation,
        };

    } catch (apiError) {
        throw handleGeminiError(apiError, 'processing the code');
    }
}

export async function fetchWeatherSummary(location, apiKey) {
    if (!apiKey) {
      throw new ApiKeyError("To enable weather forecasts, please go to Settings > API Keys and enter your Visual Crossing API key.", 'weather');
    }

    const encodedLocation = encodeURIComponent(location);
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodedLocation}?unitGroup=metric&key=${apiKey}&contentType=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error response.');
            switch (response.status) {
                case 400:
                    throw new Error(`I couldn't get weather for "${location}". Please check if the location is valid.`);
                case 401:
                    throw new ApiKeyError("The Visual Crossing API key appears to be invalid. Please go to Settings > API Keys to check or update it.", 'weather');
                case 429:
                    throw new RateLimitError("The Visual Crossing service has exceeded its request limit. Please check your account or try again later.");
                default:
                     if (response.status >= 500) {
                        throw new ServiceError("The weather service is currently experiencing issues. Please try again in a few moments.");
                    }
                    throw new Error(`I'm having trouble fetching the weather forecast. The service reported: ${errorText}`);
            }
        }
        const data = await response.json();
        
        if (!data.currentConditions) {
            throw new Error("I couldn't get weather for that location. It may be invalid, or the service is temporarily unavailable.");
        }

        return {
            summary: data.description || 'No summary available.',
            location: data.resolvedAddress || location,
            temp: Math.round(data.currentConditions.temp),
            conditions: data.currentConditions.conditions,
            icon: data.currentConditions.icon,
        };
    } catch (error) {
        if (error instanceof ApiKeyError || error instanceof RateLimitError || error instanceof ServiceError) {
            throw error;
        }
        if (error instanceof TypeError) { // Likely a network error
             // Improve network error feedback
             throw new Error("I'm unable to connect to the weather service. Please check your internet connection.");
        }
        console.error("Error fetching weather data:", error);
        throw new Error(error.message || "An unknown error occurred while fetching weather data.");
    }
}

export async function validateWeatherKey(apiKey) {
    if (!apiKey) {
        return { success: true, message: "No key provided. Weather will be disabled." };
    }
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/London,UK/today?unitGroup=metric&key=${apiKey}&contentType=json`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            return { success: true, message: "Weather key is valid." };
        }
        const errorText = await response.text();
        if (errorText.toLowerCase().includes('invalid api key')) {
            return { success: false, message: "The provided API key is invalid." };
        }
        if (errorText.toLowerCase().includes('exceeded')) {
             return { success: false, message: "This API key has exceeded its daily query limit." };
        }
        return { success: false, message: errorText || "Could not validate the key. The service may be temporarily unavailable." };
    } catch (e) {
        return { success: false, message: "A network error occurred while trying to validate the key." };
    }
}

export async function validateNewsKey(apiKey) {
    if (!apiKey) {
        return { success: true, message: "No key provided. News will be disabled." };
    }
    const url = `https://gnews.io/api/v4/search?q=example&lang=en&max=1&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            return { success: true, message: "News key is valid." };
        }
        const data = await response.json().catch(() => ({}));
        return { success: false, message: data.errors?.[0] || `Invalid API key (Status: ${response.status}).` };
    } catch (e) {
        // GNews API often returns 403 Forbidden without CORS headers if the key is invalid,
        // causing a browser Network Error instead of a readable response.
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
             return { success: false, message: "Validation failed. The GNews API rejected the request. This usually means the API Key is invalid." };
        }
        return { success: false, message: "Network error during validation. Please check your internet connection." };
    }
}

export async function validateYouTubeKey(apiKey) {
    if (!apiKey) {
        return { success: true, message: "No key provided. YouTube search will be disabled." };
    }
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=music&maxResults=1&key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            return { success: true, message: "YouTube key is valid." };
        }
        const data = await response.json();
        return { success: false, message: data.error?.message || "Invalid API key." };
    } catch (e) {
        return { success: false, message: "Network error during validation. Check your connection or key." };
    }
}

export async function validateAuddioKey(apiKey) {
    if (!apiKey) {
        return { success: true, message: "No key provided. Song recognition will be disabled." };
    }
    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('url', 'https://audd.tech/example.mp3');

    try {
        const response = await fetch('https://api.audd.io/', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (data.status === 'success') {
            return { success: true, message: "Audd.io key is valid." };
        }
        return { success: false, message: data.error?.error_message || "Invalid API key." };
    } catch (e) {
        return { success: false, message: "Network error during validation." };
    }
}

export async function fetchNews(apiKey, query) {
    if (!apiKey) {
        throw new ApiKeyError("To get news updates, please go to Settings > API Keys and enter your GNews API key.", 'news');
    }
    const encodedQuery = encodeURIComponent(query);
    const url = `https://gnews.io/api/v4/search?q=${encodedQuery}&lang=en&max=5&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
             const data = await response.json().catch(() => ({}));
             const apiMessage = data.errors?.[0] || 'The service returned an unspecified error.';
             switch (response.status) {
                case 401:
                case 403:
                    // Treat 403 Forbidden as an API key issue as well for GNews
                    throw new ApiKeyError("The GNews API key appears to be invalid or expired. Please go to Settings > API Keys to check or update it.", 'news');
                case 429:
                    throw new RateLimitError("The GNews API key has exceeded its quota. Please check your GNews account or try again later.");
                default:
                    if (response.status >= 500) {
                        throw new ServiceError("The news service is currently unavailable. Please try again in a few moments.");
                    }
                    throw new Error(`The news service reported an error: ${apiMessage}`);
             }
        }
        const data = await response.json();
        if (!data.articles || data.articles.length === 0) {
            return `I couldn't find any recent news articles about "${query}".`;
        }
        const summary = data.articles.map((article, index) => 
            `${index + 1}. ${article.title}`
        ).join('\n');
        return `Here are the top headlines about "${query}":\n${summary}`;
    } catch (error) {
        if (error instanceof ApiKeyError || error instanceof RateLimitError || error instanceof ServiceError) {
            throw error;
        }
        // Check for specific TypeError messages that indicate network issues/CORS which might be invalid key disguised
        if (error instanceof TypeError) { 
            // If we are here, it could be a CORS error caused by a 403 from GNews (invalid key).
            // We can't know for sure, but we can give a hint.
            if (error.message === 'Failed to fetch') {
                throw new ApiKeyError("I couldn't connect to the news service. This usually means the GNews API Key is invalid or restricted, causing the browser to block the request. Please check your key in Settings.", 'news');
            }
            throw new Error("I'm unable to connect to the news service. Please check your internet connection.");
        }
        console.error("Error fetching news:", error);
        throw new Error(error.message || "An unknown error occurred while fetching news.");
    }
}

export async function searchYouTube(apiKey, query) {
    if (!apiKey) {
        throw new ApiKeyError("To search YouTube, please go to Settings > API Keys and enter your Google Cloud API key.", 'youtube');
    }
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&maxResults=1&key=${apiKey}`;
    
    try {
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
            const error = searchData.error;
            const reason = error?.errors?.[0]?.reason;
            switch (reason) {
                case 'keyInvalid':
                case 'forbidden':
                    throw new ApiKeyError("The YouTube API key is invalid or does not have the YouTube Data API v3 enabled. Please go to Settings > API Keys to check it.", 'youtube');
                case 'quotaExceeded':
                    throw new RateLimitError("The YouTube API key has exceeded its daily quota. Please check your Google Cloud project or try again tomorrow.");
                default:
                    if (error?.code >= 500) {
                        throw new ServiceError("The YouTube service is currently experiencing issues. Please try again later.");
                    }
                    throw new Error(error?.message || "I couldn't search YouTube right now. The service may be temporarily unavailable.");
            }
        }
        
        const videoItem = searchData.items?.[0];
        if (!videoItem?.id?.videoId) {
            return null;
        }

        const videoId = videoItem.id.videoId;
        const title = videoItem.snippet.title;
        const channelTitle = videoItem.snippet.channelTitle;

        // Now fetch view count
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (!detailsResponse.ok) {
            // We have the video, but can't get stats. Log the error but proceed.
            console.warn(`Could not fetch YouTube video statistics for ${videoId}:`, detailsData.error?.message);
            return { videoId, title, channelTitle, viewCount: null };
        }

        const viewCount = detailsData.items?.[0]?.statistics?.viewCount || null;
        
        return {
            videoId,
            title,
            channelTitle,
            viewCount: viewCount ? parseInt(viewCount, 10) : null,
        };

    } catch (error) {
         if (error instanceof ApiKeyError || error instanceof RateLimitError || error instanceof ServiceError) {
            throw error;
        }
        if (error instanceof TypeError) { // Likely a network error
            throw new Error("I'm having trouble connecting to YouTube. Please check your internet connection.");
        }
        console.error("Error searching YouTube:", error);
        throw new Error(error.message || "An unknown error occurred while searching YouTube.");
    }
}

export async function generateSpeech(text, voiceName) {
    try {
        // Return the stream iterator directly for low-latency playback
        return await ai.models.generateContentStream({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
    } catch (error) {
        throw handleGeminiError(error, 'speech generation');
    }
}

export async function fetchLyrics(artist, title) {
    try {
        const prompt = `Please provide the full lyrics for the song "${title}" by ${artist}. Only return the lyrics text, with no extra commentary or formatting.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            // FIX: The `contents` property must be used to pass the prompt string.
            contents: prompt,
            config: {
                temperature: 0.1,
            }
        });

        const responseText = response.text.trim();
        if (responseText.toLowerCase().includes("i'm sorry") || responseText.toLowerCase().includes("i cannot provide") || responseText.length < 20) {
            // Treat this as a valid response where lyrics couldn't be found, not an error.
            return null;
        }

        return responseText;
    } catch (error) {
        // This catches API-level errors (network, auth, etc.)
        throw handleGeminiError(error, 'fetching lyrics');
    }
}

export async function generateSong(lyrics, voiceName, tuning) {
    let emotionalPrompt = "sing the following lyrics";
    if (tuning.excitement > 70) emotionalPrompt = "energetically sing the following lyrics";
    else if (tuning.happiness > 70) emotionalPrompt = "cheerfully sing the following lyrics";
    else if (tuning.sadness > 70) emotionalPrompt = "sadly sing the following lyrics";

    const fullPrompt = `${emotionalPrompt}:\n\n${lyrics}`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS API for singing.");
        }
        return base64Audio;
    } catch (error) {
        throw handleGeminiError(error, 'singing');
    }
}

export async function recognizeSong(apiKey, audioBlob) {
    if (!apiKey) {
        throw new ApiKeyError("To use song recognition, please go to Settings > API Keys and enter your Audd.io API key.", 'auddio');
    }

    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('file', audioBlob);
    formData.append('return', 'apple_music,spotify');

    try {
        const response = await fetch('https://api.audd.io/', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (data.status === 'error') {
            const errorCode = data.error?.error_code;
            const errorMessage = data.error?.error_message || 'The service returned an unspecified error.';
            switch (errorCode) {
                case 300: // Invalid API Token
                     throw new ApiKeyError("The Audd.io API key is invalid. Please go to Settings > API Keys to check or update it.", 'auddio');
                case 500: // Rate limit exceeded
                     throw new RateLimitError("The Audd.io API key has exceeded its rate limit. Please wait a moment before trying again.");
                case 800: // Endpoint error
                     throw new ServiceError("The song recognition service is currently experiencing issues. Please try again later.");
                default:
                    throw new Error(`The song recognition service reported an error: ${errorMessage}`);
            }
        }

        if (data.status === 'success' && data.result) {
            return {
                artist: data.result.artist,
                title: data.result.title,
                album: data.result.album,
            };
        } else {
            // This means success status but no result found.
            return null;
        }
    } catch (error) {
        if (error instanceof ApiKeyError || error instanceof RateLimitError || error instanceof ServiceError) {
            throw error;
        }
        if (error instanceof TypeError) { // Likely a network error
            throw new Error("I couldn't connect to the song recognition service. Please check your internet connection.");
        }
        console.error("Error recognizing song:", error);
        throw new Error(error.message || "An unknown error occurred while recognizing the song.");
    }
}

export async function generateImage(prompt) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                 // No responseMimeType or responseSchema for this model as per instructions
            }
        });
        
        // Iterate to find image part
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image generated.");
    } catch (error) {
        throw handleGeminiError(error, 'generating image');
    }
}

// --- Cashfree Payment Integration ---
export async function createCashfreeOrder(planId, amount, customerId, customerPhone, customerEmail) {
    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Use corsproxy.io which is more reliable for production APIs in frontend demos
    const targetUrl = "https://api.cashfree.com/pg/orders"; 
    const url = `https://corsproxy.io/?${targetUrl}`;

    const options = {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-version': '2023-08-01',
            'x-client-id': CASHFREE_APP_ID,
            'x-client-secret': CASHFREE_SECRET_KEY
        },
        body: JSON.stringify({
            customer_details: {
                customer_id: customerId,
                customer_phone: customerPhone,
                customer_email: customerEmail,
                customer_name: "Kaniska User"
            },
            order_meta: {
               return_url: window.location.href
            },
            order_id: orderId,
            order_amount: amount,
            order_currency: "INR"
        })
    };

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (data.payment_session_id) {
            return data.payment_session_id;
        } else {
            console.error("Cashfree API Error Response:", data);
            throw new Error(data.message || "Failed to create order");
        }
    } catch (err) {
        console.error("Cashfree Order Creation Error:", err);
        throw new Error("Payment initiation failed. Please ensure you are online and try again.");
    }
}
