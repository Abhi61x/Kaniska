
import { GoogleGenAI, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Browser } from '@capacitor/browser';

// Internal API Keys
const WEATHER_API_KEY = "a9d473331d424f9699a82612250812"; // WeatherAPI.com
const NEWSDATA_API_KEY = "pub_1d16fd143f30495db9c3bb7b5698c2fd"; // NewsData.io

/**
 * YouTube API Key Retrieval
 * Prioritizes VITE_ prefix for browser safety, falls back to standard name
 */
const ENV_YOUTUBE_KEY = 
  (import.meta as any).env?.VITE_YOUTUBE_API_KEY || 
  (process.env as any).YOUTUBE_API_KEY || 
  "";

// MANDATORY: Use process.env.API_KEY for Gemini initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class ApiKeyError extends Error {
  keyType: string;
  constructor(message: string, keyType: string) {
    super(message);
    this.name = 'ApiKeyError';
    this.keyType = keyType;
    Object.setPrototypeOf(this, ApiKeyError.prototype);
  }
}

export class MainApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainApiKeyError';
    Object.setPrototypeOf(this, MainApiKeyError.prototype);
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

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
    if (errorMessage.includes('unavailable') || errorMessage.includes('503')) {
        return new ServiceError("The AI service is currently unavailable (High Load). Please try again in a few seconds.");
    }
    if (error instanceof TypeError && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
         return new Error("I'm unable to connect to Gemini services. Please check your internet connection and try again.");
    }
    return new ServiceError(`I encountered an unexpected issue while ${context}. The service might be temporarily busy.`);
}

export const openSettingsTool: FunctionDeclaration = {
    name: 'openSettings',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens the application settings menu.',
        properties: { confirm: { type: Type.BOOLEAN, description: 'Always set to true.' } },
        required: ['confirm']
    },
};

export const setTimerTool: FunctionDeclaration = {
    name: 'setTimer',
    parameters: {
        type: Type.OBJECT,
        description: 'Sets a countdown timer.',
        properties: { duration: { type: Type.NUMBER, description: 'The duration in seconds.' } },
        required: ['duration'],
    },
};

export const searchYouTubeTool: FunctionDeclaration = {
    name: 'searchYouTube',
    parameters: {
        type: Type.OBJECT,
        description: 'Play a video inside the app.',
        properties: { query: { type: Type.STRING, description: 'Search query.' } },
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
                enum: ['play', 'pause', 'stop', 'forward_10', 'forward_60', 'rewind_10', 'rewind_600', 'minimize', 'maximize']
            },
        },
        required: ['command'],
    },
};

export const openExternalAppTool: FunctionDeclaration = {
    name: 'open_external_app',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens an external app.',
        properties: {
            appName: { 
                type: Type.STRING, 
                enum: ['youtube', 'google', 'browser', 'instagram', 'facebook', 'twitter', 'maps', 'whatsapp']
            },
            query: { type: Type.STRING }
        },
        required: ['appName'],
    },
};

export const automatePhoneTool: FunctionDeclaration = {
    name: 'automatePhone',
    parameters: {
        type: Type.OBJECT,
        description: 'Perform native automation actions using Accessibility Services.',
        properties: {
            action: { 
                type: Type.STRING, 
                enum: ['click', 'scroll_down', 'scroll_up', 'type_text', 'read_screen', 'go_back', 'go_home']
            },
            target: { type: Type.STRING },
            textValue: { type: Type.STRING }
        },
        required: ['action']
    },
};

export function speakWithBrowser(text: string, lang = 'hi-IN') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) return resolve(false);
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        let voice = voices.find(v => v.lang.includes(lang.split('-')[0]));
        if (voice) utterance.voice = voice;
        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);
        window.speechSynthesis.speak(utterance);
    });
}

async function retryOperation(operation: () => Promise<any>, retries = 2, delay = 2000): Promise<any> {
    try { return await operation(); } catch (error: any) {
        if (retries <= 0 || error instanceof MainApiKeyError) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryOperation(operation, retries - 1, delay * 1.5);
    }
}

export async function connectLiveSession(callbacks: any, config: any) {
    const { 
        customInstructions, coreProtocol, voiceName = 'Aoede', 
        assistantName = 'Kaniska', userName = '', greetingMessage = "Namaste!", personality
    } = config;

    const baseSystemInstruction = `
    **IDENTITY:**
    You are ${assistantName}. You can control the phone via 'automatePhone'.
    
    **USER:** ${userName}
    **PERSONALITY:** ${personality}
    **GREETING:** "${greetingMessage}"
    
    ${coreProtocol || ''}
    `;

    const activeKey = process.env.API_KEY;
    if (!activeKey) throw new MainApiKeyError("Gemini API Key missing in process.env.API_KEY");

    const client = new GoogleGenAI({ apiKey: activeKey });

    const sessionConfig: any = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            tools: [{ functionDeclarations: [
                openSettingsTool, setTimerTool, searchYouTubeTool, controlMediaTool, 
                openExternalAppTool, automatePhoneTool
            ] }],
            systemInstruction: baseSystemInstruction,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        }
    };

    try {
        const connectOp = () => client.live.connect({
            model: sessionConfig.model,
            callbacks: {
                ...callbacks,
                onmessage: async (msg: any) => {
                    if (msg.toolCall?.functionCalls) {
                        for (const call of msg.toolCall.functionCalls) {
                            if (call.name === 'automatePhone') {
                                window.dispatchEvent(new CustomEvent('kaniska-phone-control', { detail: call.args }));
                            }
                        }
                    }
                    if (callbacks.onmessage) callbacks.onmessage(msg);
                }
            },
            config: sessionConfig.config
        });

        const session = await retryOperation(connectOp);
        return session;
    } catch (e: any) {
        throw handleGeminiError(e, 'connecting to session');
    }
}

export async function fetchWeatherSummary(location: string) { return `Weather in ${location} is nice.`; }
export async function fetchNews(apiKey: string | null, query: string) { return "Top news updates..."; }

export async function searchYouTube(userApiKey: string, query: string) {
    const apiKey = userApiKey || ENV_YOUTUBE_KEY;
    if (!apiKey) throw new ApiKeyError("Missing YouTube API Key", 'youtube');
    
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] ? { 
        videoId: data.items[0].id.videoId, 
        title: data.items[0].snippet.title, 
        channelTitle: data.items[0].snippet.channelTitle 
    } : null;
}

export async function generateSpeech(text: string, voiceName: string) {
    const client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await client.models.generateContentStream({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { voiceName } } },
    });
}

export async function validateYouTubeKey(k: string) { return { success: !!k }; }
export async function validateAuddioKey(k: string) { return { success: !!k }; }
export async function createCashfreeOrder() { return "mock_session"; }
export async function validateWeatherKey() { return { success: true }; }
export async function validateNewsKey() { return { success: true }; }
export async function processUserCommand() { return { reply: "Command processed" }; }
export async function recognizeSong() { return null; }
export async function generateImage() { return null; }
export async function fetchLyrics() { return null; }
export async function generateSong() { return null; }
export async function processCodeCommand() { return {}; }
export async function getSupportResponse() { return ""; }
