
import { GoogleGenAI, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Browser } from '@capacitor/browser';

// Internal API Keys
const WEATHER_API_KEY = "a9d473331d424f9699a82612250812"; // WeatherAPI.com
const NEWSDATA_API_KEY = "pub_1d16fd143f30495db9c3bb7b5698c2fd"; // NewsData.io
const ENV_YOUTUBE_KEY = (import.meta as any).env?.VITE_YOUTUBE_API_KEY || "";
const ENV_GEMINI_KEY = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;

export const openSettingsTool: FunctionDeclaration = {
    name: 'openSettings',
    parameters: {
        type: Type.OBJECT,
        description: 'Opens the application settings menu.',
        properties: { confirm: { type: Type.BOOLEAN, description: 'Always set to true.' } },
        required: ['confirm']
    },
};

export const automatePhoneTool: FunctionDeclaration = {
    name: 'automatePhone',
    parameters: {
        type: Type.OBJECT,
        description: 'Perform native automation actions using Accessibility Services. Use this to interact with other apps.',
        properties: {
            action: { 
                type: Type.STRING, 
                description: 'The type of action to perform.',
                enum: ['click', 'scroll_down', 'scroll_up', 'type_text', 'read_screen', 'go_back', 'go_home']
            },
            target: { type: Type.STRING, description: 'The text of the button to click or the text to find on screen.' },
            textValue: { type: Type.STRING, description: 'The text to type (if action is type_text).' }
        },
        required: ['action']
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

export async function connectLiveSession(callbacks: any, config: any) {
    const { 
        customInstructions, coreProtocol, voiceName = 'Aoede', 
        apiKey = null, assistantName = 'Kaniska', personality, greetingMessage
    } = config;

    const baseSystemInstruction = `
    **IDENTITY:**
    You are ${assistantName}. You have the power to control the user's phone via Accessibility Services.
    
    **AUTOMATION PROTOCOL:**
    1. If the user says "Like the first post on Instagram", first use 'open_external_app' to open Instagram.
    2. Then use 'automatePhone' with action='click' and target='Like'.
    3. If you need to scroll Reels, use action='scroll_down'.
    
    **PERSONALITY:** ${personality}
    **GREETING:** "${greetingMessage}"
    
    ${coreProtocol || ''}
    `;

    const activeKey = apiKey || ENV_GEMINI_KEY;
    const client = new GoogleGenAI({ apiKey: activeKey });

    const sessionConfig: any = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            tools: [
               { functionDeclarations: [
                   openSettingsTool, setTimerTool, searchYouTubeTool, 
                   openExternalAppTool, automatePhoneTool
               ] }
            ],
            systemInstruction: baseSystemInstruction,
            inputAudioTranscription: { },
            outputAudioTranscription: { },
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
            },
        }
    };

    return await client.live.connect({
        model: sessionConfig.model,
        callbacks: {
            ...callbacks,
            onmessage: async (msg: any) => {
                if (msg.toolCall?.functionCalls) {
                    for (const call of msg.toolCall.functionCalls) {
                        if (call.name === 'automatePhone') {
                            // Dispatch a custom event for the UI to handle/log or pass to native
                            window.dispatchEvent(new CustomEvent('kaniska-phone-control', { detail: call.args }));
                        }
                    }
                }
                if (callbacks.onmessage) callbacks.onmessage(msg);
            }
        },
        config: sessionConfig.config
    });
}

export async function fetchWeatherSummary(location: string) { return `Weather in ${location} is sunny.`; }
export async function fetchNews(apiKey: string | null, query: string) { return "Top news..."; }
export async function searchYouTube(userApiKey: string, query: string) { return { videoId: 'dQw4w9WgXcQ', title: 'Sample', channelTitle: 'Artist' }; }
export async function generateSpeech(text: string, voiceName: string, apiKey: string) {
    const client = new GoogleGenAI({ apiKey });
    return await client.models.generateContentStream({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { voiceName } } },
    });
}
export async function validateYouTubeKey(k: string) { return { success: !!k }; }
export async function validateAuddioKey(k: string) { return { success: !!k }; }
export async function speakWithBrowser(text: string, lang = 'hi-IN') { return true; }
