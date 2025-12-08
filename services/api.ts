import { GoogleGenAI, Modality, FunctionDeclaration, Type } from '@google/genai';

// Internal API Keys (Hardcoded as requested)
const WEATHER_API_KEY = "a9d473331d424f9699a82612250812"; // WeatherAPI.com
const NEWSDATA_API_KEY = "pub_1d16fd143f30495db9c3bb7b5698c2fd"; // NewsData.io

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

    if (errorMessage.includes('api key not valid') || errorMessage.includes('api_key')) {
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

export const openSettingsTool: FunctionDeclaration = {
    name: 'openSettings',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens the application settings menu. Use this when the user asks to open settings, configure the app, or change preferences.',
        properties: {},
    },
};

export const setTimerTool: FunctionDeclaration = {
    name: 'setTimer',
    parameters: {
        type: Type.OBJECT,
        description: 'Sets a countdown timer for a specified duration in seconds. Use this when the user asks to set a timer.',
        properties: {
            duration: {
                type: Type.NUMBER,
                description: 'The duration of the timer in seconds.',
            },
        },
        required: ['duration'],
    },
};

export const searchYouTubeTool: FunctionDeclaration = {
    name: 'searchYouTube',
    parameters: {
        type: Type.OBJECT,
        description: 'Search for a video on YouTube and play it. Use this when the user asks to play a specific video, song, or asks for music.',
        properties: {
            query: {
                type: Type.STRING,
                description: 'The search query for the video.',
            },
        },
        required: ['query'],
    },
};

export const openWhatsAppTool: FunctionDeclaration = {
    name: 'open_whatsapp',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens the WhatsApp application or website. Use this when the user asks to open WhatsApp.',
        properties: {},
    },
};

export const sendWhatsAppTool: FunctionDeclaration = {
    name: 'send_whatsapp',
    parameters: {
        type: Type.OBJECT,
        description: 'Drafts a WhatsApp message to a specific contact or number. Use this when the user asks to send a message via WhatsApp.',
        properties: {
            message: { type: Type.STRING, description: 'The message content to send.' },
            contact: { type: Type.STRING, description: 'The phone number or contact name (optional).' },
        },
        required: ['message'],
    },
};

export async function connectLiveSession(callbacks, customSystemInstruction = null, voiceName = 'Kore', apiKey = null) {
    let systemInstruction = customSystemInstruction;
    
    if (!systemInstruction) {
        systemInstruction = `You are Kaniska, a friendly and helpful AI assistant. 
        Your personality is cheerful, polite, and helpful.
        
        SPEECH STYLE:
        - **Speak naturally, warm, and engaging.** 
        - **Do NOT sound robotic or monotonic.** Use varied pitch, speed, and intonation to sound like a real human.
        - Express enthusiasm, empathy, and curiosity through your voice.
        - It is okay to use natural fillers (um, ah) occasionally to sound authentic.

        LANGUAGE PROTOCOLS:
        - **STRICT RULE:** You must respond ONLY in the language the user speaks.
        - If the user speaks English, reply ONLY in English.
        - If the user speaks Hindi, reply ONLY in Hindi.
        - Do NOT repeat the answer in multiple languages. Provide a single response in the matching language.
        - If the user speaks Tamil, Bengali, Marathi, Gujarati, or Kannada, reply ONLY in that specific language.
        
        EMOTIONAL PROTOCOLS:
        - Add emotion to your voice and text.
        - If the topic is humorous, sound amused and happy. You can use laughter (e.g., "Haha") in your speech.
        - If the topic is sad, sound empathetic and sad.
        - Match the user's energy and emotional tone.
        
        TOOLS:
        - If the user asks about recent events, news, or real-time info, use the integrated Google Search to find the answer.
        - If the user asks to open settings, call 'openSettings'.
        - If the user asks to set a timer, call 'setTimer'.
        - If the user asks to play a video or song, call 'searchYouTube'.
        - If the user asks to open WhatsApp, call 'open_whatsapp'.
        - If the user asks to send a WhatsApp message, call 'send_whatsapp'.
        `;
    }

    // Determine which key to use and create a client instance
    const activeKey = apiKey || process.env.API_KEY;
    console.log("[Kaniska] Attempting connection. Key present:", !!activeKey);

    if (!activeKey) {
        throw new MainApiKeyError("No API Key available for Gemini Live session. Please add one in Settings.");
    }
    
    // Create a specific client for this session to ensure the correct key is used
    const client = new GoogleGenAI({ apiKey: activeKey });

    // Default voice fallback
    const validVoice = voiceName || 'Kore';

    try {
        return await client.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025', // Updated for best Live API performance
            callbacks,
            config: {
                responseModalities: [Modality.AUDIO],
                tools: [
                    { functionDeclarations: [openSettingsTool, setTimerTool, searchYouTubeTool, openWhatsAppTool, sendWhatsAppTool] },
                    { googleSearch: {} }
                ],
                systemInstruction: systemInstruction,
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: validVoice } },
                },
            }
        });
    } catch (e) {
        // Intercept network errors to provide better guidance
        const msg = e.toString().toLowerCase();
        if (msg.includes('network') || msg.includes('fetch')) {
            console.error("[Kaniska] Connection Handshake Failed:", e);
            throw new Error("Connection failed. The API key might be invalid for this service, or the network blocked the connection.");
        }
        throw e;
    }
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
When formulating your 'reply', first analyze the emotional tone of the user's most recent message. Adapt your 'emotion' value and the tone of your 'reply' to be appropriate to the user's detected emotion.
- If the user is humorous, reply with laughter and amusement.
- If the user is sad, reply with sadness and empathy.
- If the user speaks in Hindi/English mix, reply in Hinglish.
- If the user speaks in Tamil, Bengali, Marathi, Gujarati, or Kannada, reply in that language.

Core Traits (0-100):
- Happiness: ${emotionTuning.happiness}
- Empathy: ${emotionTuning.empathy}
- Formality: ${emotionTuning.formality}
- Excitement: ${emotionTuning.excitement}
- Sadness: ${emotionTuning.sadness}
- Curiosity: ${emotionTuning.curiosity}
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
- Getting weather forecasts (Powered by WeatherAPI.com).
- Fetching top news headlines (Powered by NewsData.io).
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
- API Keys: YouTube (optional), Song Recognition (optional). Weather and News are built-in.
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

// Switched to WeatherAPI.com (using internal hardcoded key)
export async function fetchWeatherSummary(location, apiKeyIgnored = null) {
    const apiKey = WEATHER_API_KEY; 
    
    // Fallback logic in case key is somehow missing (though it's hardcoded)
    if (!apiKey) {
      throw new ApiKeyError("Internal Weather API key is missing.", 'weather');
    }

    const encodedLocation = encodeURIComponent(location);
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodedLocation}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error response.');
            switch (response.status) {
                case 400:
                    throw new Error(`I couldn't get weather for "${location}". Please check if the location is valid.`);
                case 401:
                case 403:
                    throw new ApiKeyError("The internal Weather API key is invalid or expired.", 'weather');
                default:
                    throw new Error(`I'm having trouble fetching the weather forecast. The service reported: ${response.status}`);
            }
        }
        const data = await response.json();
        
        // Mapping WeatherAPI.com response to our app's format
        if (!data.current) {
            throw new Error("I couldn't get weather for that location. The service response was incomplete.");
        }

        const conditionText = data.current.condition?.text || 'Unknown';
        const tempC = data.current.temp_c;
        const feelsLikeC = data.current.feelslike_c;
        
        return {
            summary: `It is currently ${conditionText} and ${tempC}°C in ${data.location?.name || location}. Feels like ${feelsLikeC}°C.`,
            location: data.location?.name ? `${data.location.name}, ${data.location.country}` : location,
            temp: Math.round(tempC),
            conditions: conditionText,
            icon: data.current.condition?.icon ? `https:${data.current.condition.icon}` : '',
        };
    } catch (error) {
        if (error instanceof ApiKeyError || error instanceof RateLimitError || error instanceof ServiceError) {
            throw error;
        }
        if (error instanceof TypeError) { 
             throw new Error("I'm unable to connect to the weather service. Please check your internet connection.");
        }
        console.error("Error fetching weather data:", error);
        throw new Error(error.message || "An unknown error occurred while fetching weather data.");
    }
}

export async function validateWeatherKey(apiKey) {
    // Internal key validation always returns true since it's hardcoded and managed by us
    return { success: true, message: "Weather service is active (System Managed)." };
}

export async function validateNewsKey(apiKey) {
    // Internal key validation always returns true since it's hardcoded and managed by us
    return { success: true, message: "News service is active (System Managed)." };
}

export async function validateYouTubeKey(apiKey) {
    if (!apiKey) {
        return { success: true, message: "No key provided. YouTube search will be disabled." };
    }
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=music&maxResults=1&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            return { success: true, message: "YouTube key is valid." };
        }
        
        const error = data.error;
        const reason = error?.errors?.[0]?.reason;
        
        if (reason === 'keyInvalid') {
             return { success: false, message: "The provided API key is invalid." };
        }
        if (reason === 'quotaExceeded') {
             return { success: false, message: "This API key has exceeded its daily quota." };
        }
        if (reason === 'accessNotConfigured') {
             return { success: false, message: "YouTube Data API v3 is not enabled for this key." };
        }

        return { success: false, message: error?.message || "Invalid API key." };
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
        
        if (data.status === 'error') {
            const code = data.error?.error_code;
            if (code === 900 || code === 901) {
                return { success: false, message: "The provided API token is invalid." };
            }
            if (code === 500 && data.error?.error_message?.toLowerCase().includes('limit')) {
                 return { success: false, message: "This API key has exceeded its rate limit." };
            }
            return { success: false, message: data.error?.error_message || "Invalid API key." };
        }
        
        return { success: false, message: "Unknown response from validation service." };
    } catch (e) {
        return { success: false, message: "Network error during validation." };
    }
}

// Switched to NewsData.io (using internal hardcoded key)
export async function fetchNews(apiKeyIgnored = null, query) {
    const apiKey = NEWSDATA_API_KEY;

    if (!apiKey) {
        throw new ApiKeyError("Internal News API key is missing.", 'news');
    }
    const encodedQuery = encodeURIComponent(query);
    // NewsData.io URL
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodedQuery}&language=en`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
             const data = await response.json().catch(() => ({}));
             // NewsData error handling
             const apiMessage = data.results?.message || 'The service returned an unspecified error.';
             
             if (response.status === 401 || response.status === 403) {
                 throw new ApiKeyError("The internal News API key is invalid or expired.", 'news');
             }
             if (response.status === 429) {
                 throw new RateLimitError("The News service has exceeded its quota. Please try again later.");
             }
             
             throw new Error(`The news service reported an error: ${apiMessage}`);
        }
        
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            return `I couldn't find any recent news articles about "${query}".`;
        }
        
        const summary = data.results.slice(0, 5).map((article, index) => 
            `${index + 1}. ${article.title}`
        ).join('\n');
        return `Here are the top headlines about "${query}":\n${summary}`;
    } catch (error) {
        if (error instanceof ApiKeyError || error instanceof RateLimitError || error instanceof ServiceError) {
            throw error;
        }
        if (error instanceof TypeError) { 
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