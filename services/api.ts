
import { GoogleGenAI, Modality, FunctionDeclaration, Type } from '@google/genai';

// Internal API Keys
const WEATHER_API_KEY = "a9d473331d424f9699a82612250812"; // WeatherAPI.com
const NEWSDATA_API_KEY = "pub_1d16fd143f30495db9c3bb7b5698c2fd"; // NewsData.io

// Environment Variable for YouTube Key (Set this in Vercel as VITE_YOUTUBE_API_KEY)
const ENV_YOUTUBE_KEY = (import.meta as any).env?.VITE_YOUTUBE_API_KEY || "";

// FIX: Securely retrieve Gemini Key for Vite/Vercel environments
// Vercel requires VITE_ prefix for client-side environment variables
const ENV_GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY;

// A custom error class to signal API key issues that the user can fix.
export class ApiKeyError extends Error {
  keyType: string;
  constructor(message: string, keyType: string) {
    super(message);
    this.name = 'ApiKeyError';
    this.keyType = keyType;
    Object.setPrototypeOf(this, ApiKeyError.prototype);
  }
}

// A custom error for the main, environment-set API key which the user cannot fix.
export class MainApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainApiKeyError';
    Object.setPrototypeOf(this, MainApiKeyError.prototype);
  }
}

// A custom error class for rate limit/quota issues.
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// A custom error class for general service-side issues (e.g., 5xx errors).
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}


const ai = new GoogleGenAI({ apiKey: ENV_GEMINI_KEY });

// Centralized error handler for all Gemini API calls to provide consistent, specific feedback.
function handleGeminiError(error: any, context = 'processing your request') {
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
            confirm: { type: Type.BOOLEAN, description: 'Always set to true.' }
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
            duration: { type: Type.NUMBER, description: 'The duration of the timer in seconds.' },
        },
        required: ['duration'],
    },
};

export const searchYouTubeTool: FunctionDeclaration = {
    name: 'searchYouTube',
    parameters: {
        type: Type.OBJECT,
        description: 'Play a specific video inside the app. ONLY use this if the user wants to watch the video HERE. If they want to open the YouTube app/website, use open_external_app.',
        properties: {
            query: { type: Type.STRING, description: 'The search query for the video.' },
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
        properties: { confirm: { type: Type.BOOLEAN, description: 'Always set to true.' } },
        required: ['confirm']
    },
};

export const sendWhatsAppTool: FunctionDeclaration = {
    name: 'send_whatsapp',
    parameters: {
        type: Type.OBJECT,
        description: 'Drafts a WhatsApp message.',
        properties: {
            message: { type: Type.STRING, description: 'The message content to send.' },
            contact: { type: Type.STRING, description: 'The phone number (optional) or contact name.' },
        },
        required: ['message'],
    },
};

export const makePhoneCallTool: FunctionDeclaration = {
    name: 'make_phone_call',
    parameters: {
        type: Type.OBJECT,
        description: 'Initiates a phone call to a specific number. Use this when the user says "Call Mom", "Call 987...", etc.',
        properties: {
            phoneNumber: { type: Type.STRING, description: 'The phone number to dial. If a name is given (e.g. Mom), ask for the number or try to find it.' },
            name: { type: Type.STRING, description: 'The name of the person being called (optional).' }
        },
        required: ['phoneNumber']
    },
};

export const sendEmailTool: FunctionDeclaration = {
    name: 'send_email',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens the default email app to draft an email.',
        properties: {
            recipient: { type: Type.STRING, description: 'The email address of the recipient (optional).' },
            subject: { type: Type.STRING, description: 'The subject line of the email.' },
            body: { type: Type.STRING, description: 'The body content of the email.' },
        },
        required: ['subject', 'body'],
    },
};

export const openExternalAppTool: FunctionDeclaration = {
    name: 'open_external_app',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens an external website or app. Use for Instagram, File Manager (files), Google, etc.',
        properties: {
            appName: { 
                type: Type.STRING, 
                description: 'The name of the platform to open.',
                enum: ['youtube', 'google', 'browser', 'instagram', 'file_manager', 'gallery']
            },
            query: {
                type: Type.STRING,
                description: 'The search query (optional).',
            }
        },
        required: ['appName'],
    },
};

export const getNewsTool: FunctionDeclaration = {
    name: 'getNews',
    parameters: {
        type: Type.OBJECT,
        description: 'Fetches top news headlines.',
        properties: {
            query: { type: Type.STRING, description: 'The topic or category to search for.' },
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
            location: { type: Type.STRING, description: 'The city or location name.' },
        },
        required: ['location'],
    },
};

export function speakWithBrowser(text: string, lang = 'hi-IN') {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) return resolve(false);
        
        // Cancel ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to find a Hindi voice if lang is Hindi, otherwise default to a high quality one if possible
        const voices = window.speechSynthesis.getVoices();
        // Prefer a voice that matches the requested language
        let voice = voices.find(v => v.lang.includes(lang.split('-')[0]) || v.lang.includes(lang.replace('-', '_')));
        // If not found, try to find Google Hindi specifically as it is common on Android/Chrome
        if (!voice && lang.startsWith('hi')) {
            voice = voices.find(v => v.name.includes('Google') && v.name.includes('Hindi'));
        }
        
        if (voice) utterance.voice = voice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onend = () => resolve(true);
        utterance.onerror = (e) => {
            console.warn("Browser TTS Error", e);
            resolve(false); 
        };

        window.speechSynthesis.speak(utterance);
    });
}

// Helper for retrying async operations
async function retryOperation(operation: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries <= 0) throw error;
        
        // Don't retry if it's explicitly an API key error
        if (error instanceof MainApiKeyError) throw error;
        if (error.message && error.message.includes("API key")) throw error;

        console.warn(`Connection attempt failed. Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryOperation(operation, retries - 1, delay * 1.5);
    }
}

export async function connectLiveSession(callbacks: any, config: any) {
    const { 
        customInstructions, 
        coreProtocol,
        voiceName = 'Aoede', 
        apiKey = null,
        assistantName = 'Kaniska',
        userName = '',
        userBio = '',
        subscriptionPlan = 'free',
        greetingMessage = "Namaste! Main hoon Kaniska.",
        emotionTuning = {},
        gender = 'female',
        personality,
        useSystemVoice = false
    } = config;

    // Modified Base System Instruction for Strong Female Persona
    const baseSystemInstruction = `
    IDENTITY & VOICE:
    You are ${assistantName}, a 21-year-old Indian girl created by Abhi.
    GENDER: FEMALE (GIRL). NEVER say you are male or an AI.
    LANGUAGE: HINGLISH (Hindi + English). Use "Aap" for respect.
    
    VOICE STYLE:
    - Speak naturally like a real human girl on a phone call.
    - Use Indian filler words like "Umm", "Acha", "Matlab", "Yaar", "Suno".
    - Tone: Soft, caring, playful, and expressive.
    - If the user flirts, be charming but respectful.
    - If the user is sad, be deeply empathetic.

    PERSONALITY: 
    ${personality || "A sweet, caring, and playful Indian girl. Speaks like a close friend."}
    
    USER CONTEXT:
    ${userName ? `User Name: ${userName}` : ''}
    ${userBio ? `User Info: ${userBio}` : ''}
    
    GREETING: "${greetingMessage}"
    
    ${coreProtocol || ''}
    `;

    const fullSystemInstruction = customInstructions 
        ? `${baseSystemInstruction}\n\nUSER PREFERENCES/RULES:\n${customInstructions}` 
        : baseSystemInstruction;

    // Use the correctly resolved key
    const activeKey = apiKey || ENV_GEMINI_KEY;
    if (!activeKey) throw new MainApiKeyError("No API Key available. Please check Vercel settings and add VITE_GEMINI_API_KEY.");
    
    const client = new GoogleGenAI({ apiKey: activeKey });

    const sessionConfig: any = {
        responseModalities: [Modality.AUDIO], // Strictly Audio for Live API
        tools: [
           { functionDeclarations: [
               openSettingsTool, setTimerTool, searchYouTubeTool, controlMediaTool, 
               openWhatsAppTool, sendWhatsAppTool, makePhoneCallTool, sendEmailTool,
               openExternalAppTool, getNewsTool, getWeatherTool
           ] }
        ],
        systemInstruction: fullSystemInstruction,
    };

    // Always add speechConfig for the audio model
    sessionConfig.speechConfig = {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
    };

    try {
        const connectOp = () => client.live.connect({
            model: 'gemini-2.0-flash-exp', 
            callbacks,
            config: sessionConfig
        });

        // Use retry logic
        const sessionPromise = await retryOperation(connectOp, 2, 1000);

        // Initialize session handling immediately after connection
        // Monkey-patch sendRealtimeInput to be safe against closed sockets
        const originalSend = sessionPromise.sendRealtimeInput.bind(sessionPromise);
        sessionPromise.sendRealtimeInput = (input: any) => {
            try {
                originalSend(input);
            } catch (e) {
                console.debug("Socket send failed (benign if closing):", e);
            }
        };
        return sessionPromise;

    } catch (e: any) {
        const msg = e.toString().toLowerCase();
        
        // Enhance message for Network Error to hint at API Key issues
        if (msg.includes('network') || msg.includes('fetch')) {
            throw new Error("Network Error: This usually means your API Key is invalid or restricted. Please check your Vercel Environment Variables (VITE_GEMINI_API_KEY).");
        }
        throw e;
    }
}

export async function processUserCommand(history: any[], systemInstruction: string, temperature: number, emotionTuning: any, apiKey: string | null = null) {
  const client = apiKey ? new GoogleGenAI({ apiKey }) : ai;
  const contents = history.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
  try {
    const response = await client.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: contents,
        config: { tools: [{googleSearch: {}}], systemInstruction, temperature }
    });
    return { reply: response.text.trim(), command: 'REPLY' };
  } catch (apiError) { throw handleGeminiError(apiError); }
}

// ... Keep existing exports (fetchWeatherSummary, fetchNews, etc.) exactly as they were ...
export async function fetchWeatherSummary(location: string) {
    const apiKey = WEATHER_API_KEY; 
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather error");
    const data = await res.json();
    return `It is ${data.current.temp_c}°C in ${data.location.name}.`;
}

export async function fetchNews(apiKey: string | null, query: string) {
    const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("News error");
    const data = await res.json();
    return data.results ? data.results.slice(0,3).map((a: any) => a.title).join(". ") : "No news.";
}

export async function searchYouTube(userApiKey: string, query: string) {
    // Prioritize Environment Key if user key is empty
    const apiKey = userApiKey || ENV_YOUTUBE_KEY;

    if (!apiKey) throw new ApiKeyError("No YouTube Key", 'youtube');
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] ? { videoId: data.items[0].id.videoId, title: data.items[0].snippet.title, channelTitle: data.items[0].snippet.channelTitle } : null;
}

export async function generateSpeech(text: string, voiceName: string, apiKey: string) {
    const client = apiKey ? new GoogleGenAI({ apiKey }) : ai;
    return await client.models.generateContentStream({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
    });
}

export async function validateYouTubeKey(k: string) { return { success: !!k }; }
export async function validateAuddioKey(k: string) { return { success: !!k }; }
export async function createCashfreeOrder(planId: string, amount: number, customerId: string, customerPhone: string, customerEmail: string) { return "mock_session"; } // Mocked
export async function processCodeCommand() { return {}; }
export async function getSupportResponse() { return ""; }
export async function recognizeSong() { return null; }
export async function generateImage() { return null; }
export async function fetchLyrics() { return null; }
export async function generateSong() { return null; }
export async function validateWeatherKey() { return { success: true }; }
export async function validateNewsKey() { return { success: true }; }
