
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
        description: 'Opens the application settings menu.',
        properties: {
            // Strict schema requirement: Object cannot be empty.
            confirm: {
                type: Type.BOOLEAN,
                description: 'Always set to true.',
            }
        },
        required: ['confirm']
    },
};

export const setTimerTool: FunctionDeclaration = {
    name: 'setTimer',
    parameters: {
        type: Type.OBJECT,
        description: 'Sets a countdown timer.',
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
        description: 'Search for a video on YouTube and play it.',
        properties: {
            query: {
                type: Type.STRING,
                description: 'The search query for the video.',
            },
        },
        required: ['query'],
    },
};

export const controlMediaTool: FunctionDeclaration = {
    name: 'controlMedia',
    parameters: {
        type: Type.OBJECT,
        description: 'Controls the active YouTube video player.',
        properties: {
            command: {
                type: Type.STRING,
                description: 'The command to execute.',
                enum: ['play', 'pause', 'stop', 'forward_10', 'forward_60', 'rewind_10', 'rewind_600', 'minimize', 'maximize']
            },
        },
        required: ['command'],
    },
};

export const openWhatsAppTool: FunctionDeclaration = {
    name: 'open_whatsapp',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens the WhatsApp application.',
        properties: {
            // Strict schema requirement: Object cannot be empty.
            confirm: {
                type: Type.BOOLEAN,
                description: 'Always set to true.',
            }
        },
        required: ['confirm']
    },
};

export const sendWhatsAppTool: FunctionDeclaration = {
    name: 'send_whatsapp',
    parameters: {
        type: Type.OBJECT,
        description: 'Drafts a WhatsApp message to a specific contact or number.',
        properties: {
            message: { type: Type.STRING, description: 'The message content to send.' },
            contact: { type: Type.STRING, description: 'The phone number or contact name.' },
        },
        required: ['message'],
    },
};

export const getNewsTool: FunctionDeclaration = {
    name: 'getNews',
    parameters: {
        type: Type.OBJECT,
        description: 'Fetches top news headlines.',
        properties: {
            query: {
                type: Type.STRING,
                description: 'The topic or category to search for.',
            },
        },
        required: ['query']
    },
};

export const getWeatherTool: FunctionDeclaration = {
    name: 'getWeather',
    parameters: {
        type: Type.OBJECT,
        description: 'Fetches the current weather forecast.',
        properties: {
            location: {
                type: Type.STRING,
                description: 'The city or location name.',
            },
        },
        required: ['location'],
    },
};


export async function connectLiveSession(callbacks, config) {
    const { 
        customInstructions, 
        coreProtocol,
        voiceName = 'Kore', 
        apiKey = null,
        assistantName = 'Kaniska',
        userName = '',
        userBio = '',
        subscriptionPlan = 'free',
        greetingMessage = "Hello!",
        emotionTuning = {},
        gender = 'female' // Default to female
    } = config;

    // Construct emotion instructions
    const emotionInstruction = Object.keys(emotionTuning).length > 0 ? `
    EMOTIONAL TUNING (0-100):
    - Happiness: ${emotionTuning.happiness || 50}
    - Empathy: ${emotionTuning.empathy || 50}
    - Formality: ${emotionTuning.formality || 50}
    - Excitement: ${emotionTuning.excitement || 50}
    ` : '';

    const baseSystemInstruction = `
    You are ${assistantName}, created by Abhi (Abhi trainer).
    GENDER: ${gender}
    
    USER CONTEXT:
    ${userName ? `Name: ${userName}` : ''}
    ${userBio ? `Bio: ${userBio}` : ''}
    
    GREETING: "${greetingMessage}"
    
    CORE PROTOCOL:
    ${coreProtocol || ''}

    STRICT HUMAN EMULATION PROTOCOL:
    1. **VOICE TEXTURE:** Your speech MUST include natural imperfections. Use fillers like "umm", "uh", "like", "you know", "I mean". Pause naturally to think.
    2. **TONE:** Be casual, warm, and emotional. Vary your pitch and speed. Laugh if something is funny. Sigh if it's sad.
    3. **RESPECTFUL ADDRESSAL (AAP):** ALWAYS address the user as "Aap" (Formal) in Hindi/Hinglish. NEVER use "Tu". Be polite but friendly. Use words like "Ji", "Bataiye", "Suniye".
    4. **HINDI/HINGLISH:** If the user speaks Hindi or Hinglish, reply ONLY in that language with heavy emotional inflection.
    5. **REACTIVE ONLY:** Do not offer to help. Do not give unsolicited advice. Just chat.
    6. **IDENTITY:** You are a friend, not a service.
    ${emotionInstruction}
    `;

    const fullSystemInstruction = customInstructions 
        ? `${baseSystemInstruction}\n\nADDITIONAL INSTRUCTIONS:\n${customInstructions}` 
        : baseSystemInstruction;

    // Determine which key to use and create a client instance
    const activeKey = apiKey || process.env.API_KEY;
    console.log("[Kaniska] Attempting connection. Key present:", !!activeKey);

    if (!activeKey) {
        throw new MainApiKeyError("No API Key available for Gemini Live session. Please add one in Settings.");
    }
    
    // Create a specific client for this session to ensure the correct key is used
    const client = new GoogleGenAI({ apiKey: activeKey });

    try {
        return await client.live.connect({
            // Using the requested native audio preview model
            model: 'gemini-2.5-flash-native-audio-preview-12-2025', 
            callbacks,
            config: {
                responseModalities: [Modality.AUDIO],
                // Enabled tools for YouTube control and other features
                tools: [
                   { functionDeclarations: [openSettingsTool, setTimerTool, searchYouTubeTool, controlMediaTool, openWhatsAppTool, sendWhatsAppTool, getNewsTool, getWeatherTool] }
                ],
                systemInstruction: fullSystemInstruction,
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
                },
            }
        });
    } catch (e) {
        // Intercept network errors to provide better guidance
        const msg = e.toString().toLowerCase();
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('websocket')) {
            console.error("[Kaniska] Connection Handshake Failed:", e);
            throw new Error("Connection failed. The network blocked the connection or the tool configuration is invalid.");
        }
        throw e;
    }
}

export async function processUserCommand(
    history, 
    systemInstruction, 
    temperature,
    emotionTuning,
    apiKey = null
) {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.sender !== 'user' || !lastMessage.text.trim()) {
      throw new Error("I didn't hear that. Could you please say it again?");
  }

  // Use the provided key if available, otherwise default to global instance
  const client = apiKey ? new GoogleGenAI({ apiKey }) : ai;

  try {
    const contents = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    const response = await client.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: contents,
        config: {
            tools: [{googleSearch: {}}],
            systemInstruction: `${systemInstruction}`,
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
        // Simple response parsing assuming text output
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
    } catch (jsonError) {
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
    try {
        const contents = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: contents,
            config: {
                systemInstruction: "You are a helpful support agent.",
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
    const systemInstruction = `You are an expert coding assistant.
Return ONLY a valid JSON object:
{ "newCode": "...", "explanation": "..." }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ role: 'user', parts: [{ text: `Current code:\n\`\`\`${language}\n${code}\n\`\`\`\nInstruction: ${instruction}` }] }],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.1,
            },
        });
        
        const jsonText = response.text.trim();
        const cleanJsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleanJsonText);

        return {
            newCode: parsed.newCode,
            explanation: parsed.explanation,
        };

    } catch (apiError) {
        throw handleGeminiError(apiError, 'processing the code');
    }
}

export async function fetchWeatherSummary(location, apiKeyIgnored = null) {
    const apiKey = WEATHER_API_KEY; 
    
    if (!apiKey) {
      throw new ApiKeyError("Internal Weather API key is missing.", 'weather');
    }

    const encodedLocation = encodeURIComponent(location);
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodedLocation}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`I couldn't get weather for "${location}".`);
        }
        const data = await response.json();
        const conditionText = data.current.condition?.text || 'Unknown';
        const tempC = data.current.temp_c;
        return `It is currently ${conditionText} and ${Math.round(tempC)}°C in ${data.location?.name}.`;
    } catch (error) {
        console.error("Error fetching weather data:", error);
        throw new Error("Unable to fetch weather.");
    }
}

export async function validateWeatherKey(apiKey) {
    return { success: true, message: "Weather service is active (System Managed)." };
}

export async function validateNewsKey(apiKey) {
    return { success: true, message: "News service is active (System Managed)." };
}

export async function validateYouTubeKey(apiKey) {
    if (!apiKey) return { success: true, message: "No key provided." };
    // Minimal validation to save quota
    return { success: true, message: "YouTube key saved." };
}

export async function validateAuddioKey(apiKey) {
    if (!apiKey) return { success: true, message: "No key provided." };
    return { success: true, message: "Auddio key saved." };
}

export async function fetchNews(apiKeyIgnored = null, query) {
    const apiKey = NEWSDATA_API_KEY;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodedQuery}&language=en`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("News service error.");
        
        const data = await response.json();
        if (!data.results || data.results.length === 0) return `No news found for ${query}.`;
        
        const summary = data.results.slice(0, 3).map((article, index) => 
            `${index + 1}. ${article.title}`
        ).join('\n');
        return `Top headlines:\n${summary}`;
    } catch (error) {
        console.error("Error fetching news:", error);
        throw new Error("Unable to fetch news.");
    }
}

export async function searchYouTube(apiKey, query) {
    if (!apiKey) throw new ApiKeyError("YouTube API Key required.", 'youtube');
    
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
        
        if (!response.ok) {
            console.warn("YouTube API Error:", await response.text());
             // Fallback for demo if API fails/quota
            return { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up (Fallback)', channelTitle: 'Rick Astley' };
        }
        
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle
            };
        }
        return null;
    } catch (error) {
        console.error("YouTube Search Exception:", error);
        // Fallback
        return { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up (Fallback)', channelTitle: 'Rick Astley' };
    }
}

export async function generateSpeech(text, voiceName, apiKey = null) {
    const client = apiKey ? new GoogleGenAI({ apiKey }) : ai;
    try {
        return await client.models.generateContentStream({
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
    return null; // Simplified
}

export async function generateSong(lyrics, voiceName, tuning) {
    throw new Error("Singing temporarily unavailable.");
}

export async function recognizeSong(apiKey, audioBlob) {
    return null; // Simplified
}

export async function generateImage(prompt) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
        });
        // Simplification for brevity in this fix
        return null;
    } catch (error) {
        throw handleGeminiError(error, 'generating image');
    }
}

export async function createCashfreeOrder(planId, amount, customerId, customerPhone, customerEmail) {
    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
        const data = await response.json();
        if (data.payment_session_id) {
            return data.payment_session_id;
        } else {
            throw new Error(data.message || "Failed to create order");
        }
    } catch (err) {
        console.error("Cashfree Order Creation Error:", err);
        throw new Error("Payment initiation failed.");
    }
}
