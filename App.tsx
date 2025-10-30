import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality, Blob as GoogleGenAIBlob, FunctionDeclaration, Type, GenerateContentResponse, Content } from "@google/genai";
import { db } from './firebase';

// --- Audio Utility Functions ---
const encode = (bytes: Uint8Array): string => {
    const CHUNK_SIZE = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
};

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    if (!data || data.length === 0) {
        console.warn("Attempted to decode empty audio data.");
        return ctx.createBuffer(numChannels, 0, sampleRate);
    }
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const createBlob = (data: Float32Array): GoogleGenAIBlob => ({
    data: encode(new Uint8Array(new Int16Array(data.map(v => v * 32768)).buffer)),
    mimeType: 'audio/pcm;rate=16000',
});

// Extend global interfaces
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    aistudio?: AIStudio;
  }
  namespace YT {
    enum PlayerState {
        UNSTARTED = -1,
        ENDED = 0,
        PLAYING = 1,
        PAUSED = 2,
        BUFFERING = 3,
        CUED = 5,
    }
    class Player {
      constructor(
        elementId: string,
        options: {
          height?: string;
          width?: string;
          videoId?: string;
          playerVars?: Record<string, any>;
          events?: Record<string, (event: any) => void>;
        },
      );
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      getCurrentTime(): number;
      getVolume(): number;
      setVolume(volume: number): void;
      loadVideoById(videoId: string): void;
      getPlayerState(): PlayerState;
    }
  }
}

// --- Types ---
type Theme = 'light' | 'dark';
type AssistantState = 'idle' | 'connecting' | 'active' | 'error';
type AvatarExpression = 'idle' | 'thinking' | 'composing' | 'speaking' | 'error' | 'listening' | 'surprised' | 'sad' | 'celebrating';
type TranscriptionEntry = { speaker: 'user' | 'assistant' | 'system'; text: string; timestamp: Date; firebaseKey?: string; };
type ActivePanel = 'transcript' | 'image' | 'weather' | 'news' | 'timer' | 'youtube' | 'video' | 'lyrics' | 'code' | 'liveEditor' | 'email';
type GeneratedImage = { id: string; prompt: string; url: string | null; isLoading: boolean; error: string | null; };
type WeatherData = { location: string; temperature: number; condition: string; humidity: number; windSpeed: number; };
type NewsArticle = { title: string; summary: string; };
type TimerData = { duration: number; remaining: number; name: string; isActive: boolean; };
type GeneratedAvatar = { url: string | null; isLoading: boolean; error: string | null; };
type ImageFilters = { brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number; invert: number; };
type ImageTransforms = { rotate: number; scaleX: number; scaleY: number; };
type ImageCropRect = { x: number; y: number; width: number; height: number } | null;
type ImageEditState = {
    filters: ImageFilters;
    transform: ImageTransforms;
    resizeWidth: number;
    resizeHeight: number;
    cropRect: ImageCropRect;
};
type VoiceoverState = 'idle' | 'extracting' | 'describing' | 'generating_audio' | 'done' | 'error';
type CodeSnippet = { id: string; language: string; code: string; description: string; };
type WebsitePreview = { title: string; htmlContent: string; } | null;
type VoiceTrainingData = Record<string, { audioBlob: Blob | null }>;
type TrainingStatus = 'idle' | 'recording' | 'analyzing' | 'done' | 'error';
type ApiKeys = {
    gemini: string | null;
    weather: string | null;
    news: string | null;
    youtube: string | null;
};
type OptionalApiKeys = Omit<ApiKeys, 'gemini'>;


// --- Function Declarations for Gemini ---
const sayFunctionDeclaration: FunctionDeclaration = {
    name: 'say',
    description: "Speaks the provided text out loud. Use this when the user explicitly asks you to say something or repeat after them.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            text: {
                type: Type.STRING,
                description: 'The text to be spoken.'
            },
            emotion: {
                type: Type.STRING,
                description: 'The emotional tone to use, if specified by the user.',
                enum: ['neutral', 'cheerful', 'sad', 'epic', 'calm', 'playful', 'amused', 'excited', 'angry', 'surprised', 'empathetic', 'apologetic', 'serious', 'curious']
            }
        },
        required: ['text']
    }
};

const getSystemScriptFunctionDeclaration: FunctionDeclaration = {
    name: 'getSystemScript',
    description: "Explains the assistant's current customizable instructions or 'script' back to the user."
};

const setSystemScriptFunctionDeclaration: FunctionDeclaration = {
    name: 'setSystemScript',
    description: "Updates the assistant's custom system prompt with new instructions. This changes the assistant's personality or behavior for future interactions. The session needs to be restarted for the changes to take effect.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: {
                type: Type.STRING,
                description: "The new set of instructions for the assistant's behavior."
            }
        },
        required: ['prompt']
    }
};

const applyImageEditsFunctionDeclaration: FunctionDeclaration = {
    name: 'applyImageEdits',
    description: 'Applies visual edits to the currently active image in the live editor. Use absolute values (e.g., brightness: 150) or relative deltas (e.g., brightness_delta: 10 to increase by 10). Omit any parameters that are not being changed.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            brightness: { type: Type.NUMBER, description: 'Absolute brightness value from 0 to 200. Default is 100.' },
            brightness_delta: { type: Type.NUMBER, description: 'Relative change in brightness (e.g., 10 for increase, -10 for decrease).' },
            contrast: { type: Type.NUMBER, description: 'Absolute contrast value from 0 to 200. Default is 100.' },
            contrast_delta: { type: Type.NUMBER, description: 'Relative change in contrast.' },
            saturate: { type: Type.NUMBER, description: 'Absolute saturation value from 0 to 200. Default is 100.' },
            saturate_delta: { type: Type.NUMBER, description: 'Relative change in saturation.' },
            grayscale: { type: Type.NUMBER, description: "Absolute grayscale value from 0 to 100. Use 100 for 'black and white'. Default is 0." },
            grayscale_delta: { type: Type.NUMBER, description: 'Relative change in grayscale.' },
            sepia: { type: Type.NUMBER, description: 'Absolute sepia value from 0 to 100. Default is 0.' },
            sepia_delta: { type: Type.NUMBER, description: 'Relative change in sepia.' },
            invert: { type: Type.NUMBER, description: 'Absolute invert value from 0 to 100. Default is 0.' },
            invert_delta: { type: Type.NUMBER, description: 'Relative change in invert.' },
            rotate: { type: Type.NUMBER, description: 'Absolute rotation in degrees (e.g., 90, -90, 180). Default is 0.' },
            rotate_delta: { type: Type.NUMBER, description: "Relative change in rotation. Use -90 for 'rotate left' and 90 for 'rotate right'." },
            flipHorizontal: { type: Type.BOOLEAN, description: 'If true, flips the image horizontally.' },
            flipVertical: { type: Type.BOOLEAN, description: 'If true, flips the image vertically.' }
        },
    },
};

const writeCodeFunctionDeclaration: FunctionDeclaration = {
    name: 'writeCode',
    description: 'Generates a code snippet in a specified programming language. This can be used to create standalone scripts, UI components, or even full websites.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            language: {
                type: Type.STRING,
                description: "The programming language of the code. Should be a common language identifier like 'flutter', 'dart', 'html', 'css', 'javascript', 'python', 'jsx', etc."
            },
            code: {
                type: Type.STRING,
                description: 'The complete, runnable code to be generated.'
            },
            description: {
                type: Type.STRING,
                description: "A brief, user-friendly description of what the code does or how to use it."
            }
        },
        required: ['language', 'code', 'description']
    }
};

const updateCodeFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCode',
    description: "Updates the code in the live editor based on a user's modification request. You MUST provide the complete, new code content reflecting the change.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            code: {
                type: Type.STRING,
                description: 'The full, updated code content.'
            },
            language: {
                type: Type.STRING,
                description: "The programming language of the code being edited, e.g., 'html'."
            }
        },
        required: ['code', 'language']
    }
};

const composeEmailFunctionDeclaration: FunctionDeclaration = {
    name: 'composeEmail',
    description: "Drafts an email to a recipient with a specified subject and body, then displays it for review. The AI should generate a suitable body if not fully provided.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            recipient: { type: Type.STRING, description: "The recipient's email address." },
            subject: { type: Type.STRING, description: "The subject line of the email." },
            body: { type: Type.STRING, description: "The main content of the email. If the user gives a short prompt, expand on it to create a full, professional email body." }
        },
        required: ['recipient', 'subject', 'body']
    }
};

const editEmailDraftFunctionDeclaration: FunctionDeclaration = {
    name: 'editEmailDraft',
    description: "Edits the currently drafted email. Specify which part to edit, the action to take (replace, append, or prepend), and the new content.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            partToEdit: {
                type: Type.STRING,
                description: "The part of the email to modify.",
                enum: ['recipient', 'subject', 'body']
            },
            action: {
                type: Type.STRING,
                description: "The editing action: 'replace' the existing content, 'append' to the end, or 'prepend' to the beginning.",
                enum: ['replace', 'append', 'prepend']
            },
            newContent: {
                type: Type.STRING,
                description: "The new text content for the edit."
            }
        },
        required: ['partToEdit', 'action', 'newContent']
    }
};

const sendEmailFunctionDeclaration: FunctionDeclaration = {
    name: 'sendEmail',
    description: "Confirms and 'sends' the currently drafted email by opening the user's default email client. Only use this after the user has confirmed the draft."
};

const setBackgroundMusicFunctionDeclaration: FunctionDeclaration = {
    name: 'setBackgroundMusic',
    description: 'Sets the ambient background music to match a mood. Use "none" to stop the music.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            mood: {
                type: Type.STRING,
                description: 'The mood for the music.',
                enum: ['happy', 'sad', 'epic', 'calm', 'none']
            }
        },
        required: ['mood']
    }
};

const functionDeclarations: FunctionDeclaration[] = [
    { name: 'searchAndPlayYoutubeVideo', description: "Searches for and plays a video on YouTube. CRUCIAL: For song requests, append terms like 'official audio' or 'lyrics' to the query to find more playable results, as music videos are often blocked.", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query, like a song name and artist, e.g., 'Saiyaara official audio'." } }, required: ['query'] } },
    { name: 'controlYoutubePlayer', description: 'Controls the YouTube video player.', parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, description: 'The control action to perform.', enum: ['play', 'pause', 'forward', 'rewind', 'volumeUp', 'volumeDown', 'stop'] } }, required: ['action'] } },
    { name: 'playNextYoutubeVideo', description: 'Plays the next video in the current YouTube search results queue.' },
    { name: 'playPreviousYoutubeVideo', description: 'Plays the previous video in the current YouTube search results queue.' },
    { name: 'setTimer', description: 'Sets a timer for a specified duration.', parameters: { type: Type.OBJECT, properties: { durationInSeconds: { type: Type.NUMBER, description: 'The total duration of the timer in seconds.' }, timerName: { type: Type.STRING, description: 'An optional name for the timer.' } }, required: ['durationInSeconds'] } },
    { name: 'setAvatarExpression', description: "Sets the avatar's emotional expression.", parameters: { type: Type.OBJECT, properties: { expression: { type: Type.STRING, description: 'The expression to display.', enum: ['idle', 'thinking', 'speaking', 'error', 'listening', 'surprised', 'sad', 'celebrating'] } }, required: ['expression'] } },
    { name: 'displayWeather', description: 'Fetches and displays the current weather for a given location.', parameters: { type: Type.OBJECT, properties: { location: { type: Type.STRING, description: 'The city and country, e.g., "London, UK".' } }, required: ['location'] } },
    { name: 'displayNews', description: 'Displays a list of news headlines based on data provided by the model.', parameters: { type: Type.OBJECT, properties: { articles: { type: Type.ARRAY, description: 'A list of news articles.', items: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The headline of the article.' }, summary: { type: Type.STRING, description: 'A brief summary of the article.' } }, required: ['title', 'summary'] } } }, required: ['articles'] } },
    { name: 'getRealtimeNews', description: 'Fetches real-time top news headlines from an external service. The raw data should be returned to the model for processing and display.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'An optional topic to search for. If omitted, fetches general top headlines.' } } } },
    { name: 'generateImage', description: 'Generates an image based on a textual description.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' } }, required: ['prompt'] } },
    { name: 'generateIntroVideo', description: "Creates a short, cinematic introductory video showcasing Kaniska's capabilities and sci-fi theme." },
    { name: 'singSong', description: 'Sings a song by speaking the provided lyrics with emotion. This function MUST be used for all singing requests.', parameters: { type: Type.OBJECT, properties: { songName: { type: Type.STRING, description: 'The name of the song.' }, artist: { type: Type.STRING, description: 'The artist of the song.' }, lyrics: { type: Type.ARRAY, description: 'An array of strings, where each string is a line of the song lyric.', items: { type: Type.STRING } }, mood: { type: Type.STRING, description: "The emotional tone for the song, as requested by the user (e.g., 'happy', 'sad').", enum: ['happy', 'sad', 'epic', 'calm', 'none'] } }, required: ['songName', 'artist', 'lyrics', 'mood'] } },
    sayFunctionDeclaration,
    getSystemScriptFunctionDeclaration,
    setSystemScriptFunctionDeclaration,
    applyImageEditsFunctionDeclaration,
    writeCodeFunctionDeclaration,
    updateCodeFunctionDeclaration,
    composeEmailFunctionDeclaration,
    editEmailDraftFunctionDeclaration,
    sendEmailFunctionDeclaration,
    setBackgroundMusicFunctionDeclaration,
];


// --- SVG Icons & Helper Components ---
const HologramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17l-3-2.5 3-2.5"/><path d="M19 17l3-2.5-3-2.5"/><path d="M2 14.5h20"/><path d="m12 2-3 4-1 4 4 4 4-4-1-4-3-4Z"/><path d="M12 2v20"/></svg> );
const InstagramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> );
const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.12l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.12l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg> );
const SunIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> );
const MoonIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> );
const FindReplaceIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><path d="m14 8-2 2-2-2" /><path d="m10 14 2-2 2 2" /></svg> );
const ShareIcon = ({ size = 16 }: { size?: number }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> );
const CopyIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> );
const DeleteIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg> );
const UploadIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => ( <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> );
const UserCircleIcon = ({ className = "h-5 w-5" }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>);
const MicVocalIcon = ({ className = "h-5 w-5" }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 8V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4"/><path d="M8 18.5a2.5 2.5 0 1 0 5 0"/><path d="M12 14v4.5"/><path d="m16 12-4 4-4-4"/><path d="M16 8h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/></svg>);
const ImageIcon = ({ className = "h-5 w-5" }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>);
const KeyIcon = ({ className = "h-5 w-5" }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>);
const SlidersIcon = ({ className = "h-5 w-5" }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" /><line x1="18" x2="22" y1="16" y2="16" /></svg>);
const HelpCircleIcon = ({ className = "h-5 w-5" }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>);

const Clock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => {
            clearInterval(timerId);
        };
    }, []);

    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    };
    // Use en-IN format and remove comma for cleaner look.
    const formattedTime = new Intl.DateTimeFormat('en-IN', options).format(time).replace(/,/g, '');

    return <div className="header-clock">{formattedTime}</div>;
};

const TypingIndicator = () => (
    <div className="typing-indicator">
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
    </div>
);


// --- Predefined Avatars & Constants ---
const PREDEFINED_AVATARS = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Default blank
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARTSURBVHhe7ZxLUdswFIBzL3M3s9PuwK6A2AGxA6IDsAPCBkQHpAPSAcEO2A5wOiA6oOywQ3YEdmB2eC4lpTSpM9I5SfL/gScl0qS/9/PeFxCCEEP4j4Y+4tBDjLPIY7w/g4t4Xp/hKj7lV/yKD/AHPtQvD/AL/sJ9+AD34T58hPvwEd7yP5fxfJ/gYzyNl/G8nmQG8Dq+wuv4Ql/hVXyBb/CVPuAP/IHP8A1+wTf4A7/hHnyCb/BvfIAP8C+8wzt4V59hB/hLgD/y/f4Gz/ArvsCveE+f4Ad8gS/wFf4GgD/gZ/gU3+BrfIAP8HWe4wY8w0d4ip/xFR7g93yD3/A1nuAdfIZP8Bn+gK/wA/6Bf+AtvIX38A7e4R08w5/wM3yKH/ApPsA/eA+/4338jnfxUaTxo+gD3sbv+B4f40f8jI/xI/6Bf+Jd/A7fxu/4Ht/jR/yMH/Ej/sA/+Bd/g7fxO34n8A3e4x38iI/xI37GD/gD/+J3/A5v43f8jm/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BXf42M8jBfxsv4Y4iK/xRfwCv4ir8A/cKj8G94V/4Gv9LXeA3f43N8jY/yMt7Gx/gef8dP+Avv4k8QQghh/AdkR3/1mP+TCAAAAABJRU5kJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARMA0lEQVR4Xu2bS3LkNhCEOeMxb8ajPBo5hRyBsRvkjZGzMMbvkUeyb/YQJBEaHwlb4EaqGjLzI/KDG11dVRX9lMKy/pGvF/hY4KOIj+A7fAof8Am+w+d8h8/wHT6D9/Fe/hTfwvt4I9/L+3g338X7eD/fz/v5Af/gB/wBf8AP8D7+wR/wXf6AL/Af/sAP+Af+wZ/wE/6AL/AH/oE/4U/4D3/gH/wn/IX/4X/w5L3+f+A83scX8X68n6/jA/yDH/EHvI9v4gP8g+/yP34fX+QHvIc/4y/4EX/B3/FX/A3/xr/wV/wb/8Of8Xf8GX/H3/F3/B//yJ/wd/wd/wH/wd/xd/wH/wd/x3/wf/wH/wP/wH/wH/wP/8Af8Af8Af/AH/AH/AE/4U/4U/4Ef8K/8Bf8FX/FX/A3/A3/wV/wd/wd/8e/8V/8GX/Hn/En/Al/wp/wJ/wJ/8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJf8Kf8Cf8CX/Cn/B3/B1/x5/xJ/wZf8ef8Sf8CX/Cn/An/Al/wp/wd/wdf8ef8Sf8GX/Hn/En/Al/wp/wJ/wJf8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJ/8Kf8Cf8CX/C3/B3/F3/F3/FX/A3/A3/BV/AVf8Wf8Wf8GX/Gn/Bn/A3/E//F//A//Af/Af/Af/AE/4A/4A/6AP+AP+AOf8Cf8CX/An/An/An/gn/hT/hT/gR/wV/wVfwVf8Xf8Xf8Hf/Gn/FX/BX/BX/F3/F3/B3/xp/wV/wV/wV/wV/wd/wdf8af8Vf8Ff8Ff8Xf8Xf8HX/H//Bn/B//h//Af/Af/wH/wB/wBf8Af8Af8AT/gD3jCn/An/Al/wp/wJ/wJ/8Kf8Kf8Cf+Cf+FP+FP+BH/BX/BX/BX/FX/B3/B3/AJ/wV/wVf8Xf8Xf8Hf/An/BX/BX/FX/F3/B3/AJ/wV/wV/wV/wV/xV/wd/8Cf8Ff8FX/F3/F3/B3/B/wB/wB/8Af8Af8AX/An/An/Al/wp/wJ/wVf8Wf8Wf8Gn/Gv/Bf/wf/wP/yP//F/jJj4KP6PL+OLeBffx/fxfXwTH+NL+CZeysd4G5/i13gTf8Tf8TbeAEv4if8T7+L7+KVBCCEIQ4X0vhcc/mdft9/QAAAAASUVORK5CYII=",
];


// --- API Interaction ---
const searchYoutubeVideo = async (query: string, apiKey: string): Promise<{ videoId: string; title: string }[]> => {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${apiKey}&type=video&videoEmbeddable=true&maxResults=10`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        console.error("YouTube API Error:", errorData);
        throw new Error(errorData.error?.message || "Failed to search YouTube.");
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
        throw new Error(`I couldn't find any videos matching "${query}".`);
    }

    return data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
    }));
};

const fetchWeatherData = async (location: string, apiKey: string): Promise<WeatherData> => {
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}?unitGroup=metric&key=${apiKey}&contentType=json`;

    const response = await fetch(url);
    if (!response.ok) {
        // Visual Crossing returns error text directly, not always JSON
        const errorText = await response.text();
        throw new Error(errorText || `Failed to fetch weather for ${location}. Status: ${response.status}`);
    }
    const data = await response.json();

    if (!data.currentConditions) {
        throw new Error(`Could not find current weather conditions for ${location}.`);
    }

    const current = data.currentConditions;

    return {
        location: data.resolvedAddress,
        temperature: Math.round(current.temp),
        condition: current.conditions,
        humidity: current.humidity,
        windSpeed: Math.round(current.windspeed),
    };
};

const fetchNewsData = async (apiKey: string, query?: string): Promise<{ title: string; summary: string }[]> => {
    const baseUrl = 'https://gnews.io/api/v4/';
    const endpoint = query ? 'search' : 'top-headlines';
    let gnewsApiUrl = `${baseUrl}${endpoint}?lang=en&country=us&max=5&apikey=${apiKey}`;

    if (query) {
        gnewsApiUrl += `&q=${encodeURIComponent(query)}`;
    } else {
        gnewsApiUrl += `&category=general`;
    }
    
    // GNews's free plan has CORS restrictions, so a proxy is still needed for client-side requests.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(gnewsApiUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch news headlines from GNews via proxy. Status: ${response.status}`);
    }
    
    const newsData = await response.json();

    if (newsData.errors) {
        throw new Error(`GNews API Error: ${newsData.errors.join(', ')}`);
    }

    if (!newsData.articles || newsData.articles.length === 0) {
        return [];
    }

    return newsData.articles.map((article: any) => ({
        title: article.title,
        summary: article.description || 'No summary available.',
    }));
};


const fetchJoke = async (): Promise<string> => {
    // Using a public joke API that doesn't require keys, making it reliable and easy to use.
    const url = 'https://v2.jokeapi.dev/joke/Any?type=single&safe-mode';
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch a joke. Status: ${response.status}`);
    }
    const data = await response.json();
    if (data.error) {
        throw new Error('Joke API returned an error.');
    }
    return data.joke;
};


const BACKGROUND_MUSIC: { [key: string]: string } = {
    happy: 'https://cdn.pixabay.com/download/audio/2022/02/20/audio_2c56a84a6c.mp3',
    sad: 'https://cdn.pixabay.com/download/audio/2022/11/17/audio_8779f2229a.mp3',
    epic: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_a405998a6a.mp3',
    calm: 'https://cdn.pixabay.com/download/audio/2022/05/13/audio_f523d91754.mp3',
};

// --- Helper to parse API errors for user-friendly messages ---
const getApiErrorMessage = (error: unknown): string => {
    console.error("API Error Encountered:", error);

    let errorMessage = "An unknown error occurred. I've logged the details. Please try again.";
    let statusCode: number | null = null;

    if (error instanceof Error) {
        errorMessage = error.message;
        const match = error.message.match(/\[(\d{3})\]/);
        if (match) statusCode = parseInt(match[1], 10);
    } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error);
        statusCode = (error as any).status || (error as any).statusCode;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    const lowerCaseMessage = errorMessage.toLowerCase();

    if (lowerCaseMessage.includes('failed to fetch') || lowerCaseMessage.includes('network error')) {
        return "Oops! I'm having trouble connecting to my network. Could you please check your internet connection? Sometimes firewalls can also get in the way.";
    }

    if (lowerCaseMessage.includes('api key not valid') || lowerCaseMessage.includes('api_key_invalid') || lowerCaseMessage.includes('permission is not found')) {
        return "My connection is failing. It looks like there's an issue with the API key. Please check your key in the Settings > API Keys section and make sure it's correct and has the right permissions configured in Google AI Studio.";
    }
    if (lowerCaseMessage.includes('permission_denied')) {
        return "I'm sorry, I don't have the required permissions to perform that action. This could be due to an incorrect API key or a billing issue with your Google Cloud project. Please double-check your settings in the Settings > API Keys section.";
    }
    if (lowerCaseMessage.includes('requested entity was not found')) {
        return "It seems the API key I was using is no longer valid. Could you please select a new one for me in Settings > API Keys? This can happen if the key was deleted or its permissions were recently changed.";
    }

    if (lowerCaseMessage.includes('resource_exhausted') || lowerCaseMessage.includes('429') || statusCode === 429) {
        return "Oh dear, it looks like we've been a bit too chatty and hit the API limit for now. You might have used up the free quota. Please check your usage on the Google AI Studio dashboard, or we can try again in a little while.";
    }
    
    if (lowerCaseMessage.includes('safety') || lowerCaseMessage.includes('prompt_blocked') || lowerCaseMessage.includes('response was blocked') || (statusCode === 400 && lowerCaseMessage.includes('finish reason: safety'))) {
        return "I'm sorry, but I can't respond to that. My safety filters have blocked the request. Could we perhaps try rephrasing it or talking about something else?";
    }
    
    if (lowerCaseMessage.includes('user location is not supported')) {
        return "I'm really sorry, but it seems my services are not yet available in your current region. Please check the Gemini API documentation for a list of supported locations.";
    }

    if (lowerCaseMessage.includes('internal') || statusCode === 500 || statusCode === 503) {
        return "It seems my core systems are experiencing a temporary hiccup. This is usually resolved quickly. Please give me a moment and then try your request again. My engineers are likely already on it!";
    }

    if (lowerCaseMessage.includes('invalid_argument') || (statusCode === 400 && !lowerCaseMessage.includes('finish reason: safety'))) {
        return "I'm having a little trouble understanding that request. It seems to be invalid, which can sometimes happen with a malformed prompt or unsupported settings. Could we try that again, perhaps in a slightly different way?";
    }
    
    if (lowerCaseMessage.includes('model not found')) {
        return "I can't seem to find the specific AI model I need for this task. It might be an issue with the model name or availability. Let's try a different command.";
    }

    if (error instanceof Error) return `An unexpected issue occurred: ${error.message}`;

    try {
        return `An unexpected technical issue occurred: ${JSON.stringify(error)}`;
    } catch {
        return "An unknown and unstringifiable error occurred. Please check the console for details.";
    }
};


const ApiKeySelectionScreen: React.FC<{
    onKeysSaved: (keys: ApiKeys) => void;
    onStudioKeySelected: (optionalKeys: OptionalApiKeys) => void;
    reselectionReason?: string | null;
}> = ({ onKeysSaved, onStudioKeySelected, reselectionReason }) => {
    const [geminiKeyInput, setGeminiKeyInput] = useState('');
    const [weatherKeyInput, setWeatherKeyInput] = useState('');
    const [newsKeyInput, setNewsKeyInput] = useState('');
    const [youtubeKeyInput, setYoutubeKeyInput] = useState('');
    const [isStudioAvailable, setIsStudioAvailable] = useState(false);

    useEffect(() => {
        setIsStudioAvailable(!!window.aistudio?.openSelectKey);
    }, []);

    const handleSelectKeyWithStudio = async () => {
        if (isStudioAvailable) {
            try {
                await window.aistudio.openSelectKey();
                onStudioKeySelected({
                    weather: weatherKeyInput.trim() || null,
                    news: newsKeyInput.trim() || null,
                    youtube: youtubeKeyInput.trim() || null,
                });
            } catch (error) {
                console.error("AI Studio key selection failed:", error);
            }
        }
    };

    const handleSaveKeys = () => {
        if (geminiKeyInput.trim()) {
            onKeysSaved({
                gemini: geminiKeyInput.trim(),
                weather: weatherKeyInput.trim() || null,
                news: newsKeyInput.trim() || null,
                youtube: youtubeKeyInput.trim() || null,
            });
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-bg-color text-text-color p-4">
            <div className="bg-panel-bg p-8 rounded-lg border border-border-color text-center max-w-xl w-full animate-panel-enter">
                <div className="hologram-svg mx-auto mb-4"><HologramIcon /></div>
                <h1 className="text-2xl font-bold mb-2 glowing-text">API Keys Required</h1>
                <p className="text-muted mb-6 text-sm">
                    This assistant requires a Gemini API key to function. You can also provide optional keys to unlock more features.
                </p>

                {reselectionReason && (
                    <div className="my-4 p-3 bg-red-900/50 border border-red-500/60 rounded-md text-red-300 text-sm text-left">
                        <p className="font-bold">Please update your key</p>
                        <p className="m-0 text-xs">{reselectionReason}</p>
                    </div>
                )}
                
                <div className="text-left space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Gemini API Key <span className="text-red-400 text-sm font-normal">(Required)</span></h2>
                        <button onClick={handleSelectKeyWithStudio} disabled={!isStudioAvailable} title={!isStudioAvailable ? "Not available in this environment" : "Select key from AI Studio"} className="w-full mb-2 bg-primary-color/80 hover:bg-primary-color text-bg-color font-bold py-2.5 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                            Select Key via AI Studio & Continue
                        </button>
                        <div className="my-3 relative flex items-center"><div className="flex-grow border-t border-border-color"></div><span className="flex-shrink mx-4 text-muted text-xs">OR</span><div className="flex-grow border-t border-border-color"></div></div>
                        <input type="text" spellCheck="false" autoComplete="off" value={geminiKeyInput} onChange={(e) => setGeminiKeyInput(e.target.value)} placeholder="Paste your Gemini API key here" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none"/>
                    </div>
                     <div>
                        <h2 className="text-lg font-semibold mb-2">Optional Keys</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">Visual Crossing Weather Key</label>
                                <input type="text" spellCheck="false" autoComplete="off" value={weatherKeyInput} onChange={(e) => setWeatherKeyInput(e.target.value)} placeholder="For weather forecasts" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">GNews API Key</label>
                                <input type="text" spellCheck="false" autoComplete="off" value={newsKeyInput} onChange={(e) => setNewsKeyInput(e.target.value)} placeholder="For news headlines (from gnews.io)" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">Google Cloud API Key</label>
                                <input type="text" spellCheck="false" autoComplete="off" value={youtubeKeyInput} onChange={(e) => setYoutubeKeyInput(e.target.value)} placeholder="For YouTube search & other Google services" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none"/>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={handleSaveKeys} disabled={!geminiKeyInput.trim()} className="w-full mt-6 bg-green-600/80 hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-md transition disabled:opacity-50">
                    Save Manually Pasted Keys & Use
                </button>
                <p className="text-xs text-muted mt-4">
                    Your keys are saved securely in a database for this browser. For info on billing, visit the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-primary-color hover:underline">official documentation</a>.
                </p>
            </div>
        </div>
    );
};

// --- Panel Components ---
const WeatherPanel: React.FC<{ data: WeatherData }> = ({ data }) => (
    <div className="p-4">
        <h3 className="text-xl font-bold mb-2">Weather in {data.location}</h3>
        <div className="grid grid-cols-2 gap-4">
            <div><p className="font-semibold text-4xl">{data.temperature}°C</p><p>{data.condition}</p></div>
            <div><p>Humidity: {data.humidity}%</p><p>Wind: {data.windSpeed} km/h</p></div>
        </div>
    </div>
);

const NewsPanel: React.FC<{ articles: NewsArticle[] }> = ({ articles }) => (
    <div className="p-4 space-y-4">
        {articles.map((article, index) => (
            <div key={index} className="border-b border-border-color pb-2">
                <h4 className="font-semibold">{article.title}</h4>
                <p className="text-sm text-muted">{article.summary}</p>
            </div>
        ))}
    </div>
);

const TimerPanel: React.FC<{ timer: TimerData }> = ({ timer }) => {
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${remainingSeconds}`;
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <h3 className="text-2xl font-semibold mb-2">{timer.name}</h3>
            <p className="text-6xl font-mono tracking-widest">{formatTime(timer.remaining)}</p>
            <p className={`mt-2 px-3 py-1 text-sm rounded-full ${timer.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {timer.isActive ? 'Running' : 'Finished'}
            </p>
        </div>
    );
};

const EmailPanel: React.FC<{
    recipient: string;
    subject: string;
    body: string;
    onRecipientChange: (value: string) => void;
    onSubjectChange: (value: string) => void;
    onBodyChange: (value: string) => void;
    onSend: () => void;
}> = ({ recipient, subject, body, onRecipientChange, onSubjectChange, onBodyChange, onSend }) => {
    return (
        <div className="flex-grow flex flex-col p-4 gap-4 overflow-y-auto">
            <div className="flex items-center gap-2">
                <label htmlFor="email-to" className="font-semibold text-muted">To:</label>
                <input
                    id="email-to"
                    type="email"
                    value={recipient}
                    onChange={(e) => onRecipientChange(e.target.value)}
                    className="flex-grow bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none"
                    placeholder="recipient@example.com"
                />
            </div>
            <div className="flex items-center gap-2">
                <label htmlFor="email-subject" className="font-semibold text-muted">Subject:</label>
                <input
                    id="email-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => onSubjectChange(e.target.value)}
                    className="flex-grow bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none"
                    placeholder="Email subject"
                />
            </div>
            <textarea
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                className="flex-grow bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none resize-none"
                placeholder="Compose your email..."
            />
            <div className="flex-shrink-0">
                <button
                    onClick={onSend}
                    className="w-full bg-primary-color/80 hover:bg-primary-color text-bg-color font-bold py-2.5 px-4 rounded-md transition disabled:opacity-50"
                    disabled={!recipient || !subject}
                >
                    Send Email
                </button>
            </div>
        </div>
    );
};


const ImageEditorModal: React.FC<{
    isOpen: boolean;
    image: GeneratedImage | null;
    onClose: () => void;
    onSave: (newImageUrl: string) => void;
}> = ({ isOpen, image, onClose, onSave }) => {
    if (!isOpen || !image || !image.url) return null;

    // A full implementation would have state for edits and a canvas.
    // This is a placeholder to resolve the component error.
    const handleSave = () => {
        // In a real editor, this would be the data URL from a canvas.
        if (image.url) onSave(image.url);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Manual Image Editor</h2>
                    <button onClick={onClose} className="text-2xl font-bold leading-none text-muted hover:text-white">&times;</button>
                </header>
                <div className="p-6">
                    <img src={image.url} alt={image.prompt} className="max-w-full max-h-[60vh] object-contain mx-auto rounded-md" />
                    <p className="text-center text-muted mt-4">Manual editing controls would appear here.</p>
                </div>
                 <footer className="flex justify-end p-4 border-t border-border-color gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md">Save Changes</button>
                </footer>
            </div>
        </div>
    );
};

const LiveImageEditorModal: React.FC<{
    isOpen: boolean;
    image: GeneratedImage | null;
    filters: ImageFilters;
    transform: ImageTransforms;
    onClose: () => void;
    onSave: (newImageUrl: string) => void;
    onReset: () => void;
}> = ({ isOpen, image, filters, transform, onClose, onSave, onReset }) => {
    if (!isOpen || !image || !image.url) return null;

    const imageStyle: React.CSSProperties = {
        filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) invert(${filters.invert}%)`,
        transform: `rotate(${transform.rotate}deg) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`,
    };

    const handleSave = () => {
         // A real implementation would draw the styled image to a canvas
         // and get the data URL to save it. For now, we save the original.
         if (image.url) onSave(image.url);
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Live Image Editor</h2>
                    <button onClick={onClose} className="text-2xl font-bold leading-none text-muted hover:text-white">&times;</button>
                </header>
                 <div className="p-6 text-center">
                    <div className="w-full h-[60vh] bg-black/30 flex items-center justify-center rounded-lg overflow-hidden">
                        <img src={image.url} alt={image.prompt} style={imageStyle} className="max-w-full max-h-full object-contain transition-all duration-300" />
                    </div>
                    <p className="text-sm text-muted mt-2">Use your voice to apply edits in real-time!</p>
                </div>
                 <footer className="flex justify-between p-4 border-t border-border-color gap-2">
                    <button onClick={onReset} className="px-4 py-2 text-sm bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 rounded-md hover:bg-yellow-500/30">Reset Edits</button>
                    <div>
                         <button onClick={onClose} className="px-4 py-2 text-sm bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color mr-2">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md">Finish & Save</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

const WebsitePreviewModal: React.FC<{
    preview: WebsitePreview | null;
    onClose: () => void;
}> = ({ preview, onClose }) => {
    if (!preview) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content w-[90vw] h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold truncate">{preview.title}</h2>
                    <button onClick={onClose} className="text-2xl font-bold leading-none text-muted hover:text-white">&times;</button>
                </header>
                <div className="flex-grow">
                    <iframe
                        srcDoc={preview.htmlContent}
                        title={preview.title}
                        sandbox="allow-scripts allow-same-origin"
                        className="w-full h-full border-0"
                    />
                </div>
            </div>
        </div>
    );
};

const QuickActions: React.FC<{ 
    onAction: (action: string) => void; 
    disabled: boolean;
    isWeatherEnabled: boolean;
    isNewsEnabled: boolean;
    isYoutubeEnabled: boolean;
}> = ({ onAction, disabled, isWeatherEnabled, isNewsEnabled, isYoutubeEnabled }) => (
    <div className="flex-shrink-0 p-3 border-t border-border-color flex items-center justify-center gap-2">
        <p className="text-xs text-muted font-semibold mr-2">Quick Actions:</p>
        <button onClick={() => onAction('weather')} disabled={disabled || !isWeatherEnabled} title={!isWeatherEnabled ? "Requires Visual Crossing Weather Key in Settings" : ""} className="quick-action-button">Weather</button>
        <button onClick={() => onAction('news')} disabled={disabled || !isNewsEnabled} title={!isNewsEnabled ? "Requires GNews API Key in Settings" : ""} className="quick-action-button">News</button>
        <button onClick={() => onAction('music')} disabled={disabled || !isYoutubeEnabled} title={!isYoutubeEnabled ? "Requires YouTube API Key in Settings" : ""} className="quick-action-button">Music</button>
        <button onClick={() => onAction('joke')} disabled={disabled} className="quick-action-button">Tell a Joke</button>
    </div>
);

const CodePanel: React.FC<{
    snippets: CodeSnippet[];
    onPreview: (preview: WebsitePreview) => void;
    onLiveEdit: (snippet: CodeSnippet) => void;
}> = ({ snippets, onPreview, onLiveEdit }) => {
    const handlePreview = (snippet: CodeSnippet) => {
        if (snippet.language.toLowerCase() === 'html') {
            onPreview({
                title: snippet.description,
                htmlContent: snippet.code,
            });
        }
    };
    return (
        <div className="flex-grow p-4 overflow-y-auto">
            {snippets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted">
                    <p>Ask the assistant to write some code to see it here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {snippets.map(snippet => (
                        <div key={snippet.id} className="bg-assistant-bubble-bg border border-border-color rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-border-color flex justify-between items-center">
                                <div>
                                    <h4 className="font-semibold">{snippet.description}</h4>
                                    <span className="text-xs text-muted bg-panel-bg px-2 py-0.5 rounded-full border border-border-color">{snippet.language}</span>
                                </div>
                                <div className="flex gap-2">
                                    {snippet.language.toLowerCase() === 'html' && (
                                        <button onClick={() => handlePreview(snippet)} className="text-xs px-2 py-1 bg-panel-bg border border-border-color rounded-md hover:border-primary-color hover:text-primary-color transition">
                                            Preview
                                        </button>
                                    )}
                                    <button onClick={() => onLiveEdit(snippet)} className="text-xs px-2 py-1 bg-panel-bg border border-border-color rounded-md hover:border-primary-color hover:text-primary-color transition">
                                        Live Edit
                                    </button>
                                </div>
                            </div>
                            <pre className="p-3 text-xs overflow-x-auto bg-black/20"><code className={`language-${snippet.language}`}>{snippet.code}</code></pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LiveCodeEditorPanel: React.FC<{
    snippet: CodeSnippet;
    code: string;
    onCodeChange: (code: string) => void;
    onFinish: () => void;
}> = ({ snippet, code, onCodeChange, onFinish }) => {
    const isHtml = snippet.language.toLowerCase() === 'html';

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="flex-shrink-0 p-3 border-b border-border-color flex justify-between items-center">
                <div>
                    <h3 className="font-semibold">Live Editor: {snippet.description}</h3>
                    <p className="text-xs text-muted">You can give voice commands to edit the code below.</p>
                </div>
                <button onClick={onFinish} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md">
                    Finish Editing
                </button>
            </header>
            <div className={`flex-grow grid ${isHtml ? 'grid-cols-2' : 'grid-cols-1'} gap-px bg-border-color overflow-hidden`}>
                <textarea
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    className="w-full h-full bg-assistant-bubble-bg p-3 text-sm font-mono focus:outline-none resize-none"
                    spellCheck="false"
                />
                {isHtml && (
                    <iframe
                        srcDoc={code}
                        title="Live Preview"
                        sandbox="allow-scripts"
                        className="w-full h-full border-0 bg-white"
                    />
                )}
            </div>
        </div>
    );
};


type SettingsModalProps = {
    isOpen: boolean;
    onClose: () => void;
    avatars: string[];
    currentAvatar: string;
    onSelectAvatar: (avatar: string) => void;
    onUploadAvatar: (newAvatar: string) => void;
    onGenerateAvatar: (prompt: string) => void;
    generatedAvatarResult: GeneratedAvatar;
    customGreeting: string;
    onSaveGreeting: (greeting: string) => void;
    customSystemPrompt: string;
    onSaveSystemPrompt: (prompt: string) => void;
    onClearHistory: () => void;
    mainVoiceGender: 'female' | 'male';
    onSetMainVoiceGender: (gender: 'female' | 'male') => void;
    selectedVoice: string;
    onSelectVoice: (voice: string) => void;
    voicePitch: number;
    onSetVoicePitch: (pitch: number) => void;
    voiceSpeed: number;
    onSetVoiceSpeed: (speed: number) => void;
    greetingVoiceGender: 'female' | 'male';
    onSetGreetingVoiceGender: (gender: 'female' | 'male') => void;
    greetingVoice: string;
    onSetGreetingVoice: (voice: string) => void;
    greetingPitch: number;
    onSetGreetingPitch: (pitch: number) => void;
    greetingSpeed: number;
    onSetGreetingSpeed: (speed: number) => void;
    speakText: (text: string, emotion?: string, voiceOverride?: { voice: string; pitch: number; speed: number }) => void;
    onStartSupportChat: () => void;
    userId: string | null;
    apiKeys: ApiKeys;
    onSaveApiKeys: (keys: ApiKeys) => void;
    onResetGeminiKey: () => void;
};

const FaqItem: React.FC<{ q: string; a: React.ReactNode }> = ({ q, a }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-border-color">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left flex justify-between items-center py-3">
                <span className="font-semibold">{q}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {isOpen && <div className="pb-4 text-sm text-muted prose prose-invert max-w-none prose-p:my-2 prose-ol:my-2 prose-ul:my-2">{a}</div>}
        </div>
    );
};

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, avatars, currentAvatar, onSelectAvatar, onUploadAvatar,
    onGenerateAvatar, generatedAvatarResult,
    customGreeting, onSaveGreeting, customSystemPrompt, onSaveSystemPrompt, onClearHistory,
    mainVoiceGender, onSetMainVoiceGender, selectedVoice, onSelectVoice, voicePitch, onSetVoicePitch, voiceSpeed, onSetVoiceSpeed,
    greetingVoiceGender, onSetGreetingVoiceGender, greetingVoice, onSetGreetingVoice,
    greetingPitch, onSetGreetingPitch, greetingSpeed, onSetGreetingSpeed,
    speakText, onStartSupportChat, userId,
    apiKeys, onSaveApiKeys, onResetGeminiKey
}) => {
    const [activeTab, setActiveTab] = React.useState('persona');
    const [greeting, setGreeting] = React.useState(customGreeting);
    const [systemPrompt, setSystemPrompt] = React.useState(customSystemPrompt);
    const [localApiKeys, setLocalApiKeys] = useState(apiKeys);
    const avatarGenerationInputRef = React.useRef<HTMLInputElement>(null);
    const avatarUploadInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalApiKeys(apiKeys);
    }, [apiKeys, isOpen]);

    const VOICE_MAP: { [key in 'female' | 'male']: string[] } = {
        female: ['Zephyr', 'Kore', 'Charon'],
        male: ['Puck', 'Fenrir'],
    };

    const handleApiKeySave = () => {
        onSaveApiKeys(localApiKeys);
        alert("API Keys saved!");
    };
    
    const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === 'string') {
                    onUploadAvatar(e.target.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button onClick={onClose} className="text-2xl font-bold leading-none text-muted hover:text-text-color transition">&times;</button>
                </header>
                <div className="settings-layout">
                    <nav className="settings-nav">
                        <button onClick={() => setActiveTab('persona')} className={`settings-nav-button ${activeTab === 'persona' ? 'active' : ''}`}>
                            <UserCircleIcon /><span>Persona</span>
                        </button>
                        <button onClick={() => setActiveTab('voice')} className={`settings-nav-button ${activeTab === 'voice' ? 'active' : ''}`}>
                            <MicVocalIcon /><span>Voice</span>
                        </button>
                        <button onClick={() => setActiveTab('avatar')} className={`settings-nav-button ${activeTab === 'avatar' ? 'active' : ''}`}>
                            <ImageIcon /><span>Avatar</span>
                        </button>
                        <button onClick={() => setActiveTab('apiKeys')} className={`settings-nav-button ${activeTab === 'apiKeys' ? 'active' : ''}`}>
                            <KeyIcon /><span>API Keys</span>
                        </button>
                        <button onClick={() => setActiveTab('account')} className={`settings-nav-button ${activeTab === 'account' ? 'active' : ''}`}>
                            <SlidersIcon /><span>Account & Data</span>
                        </button>
                        <button onClick={() => setActiveTab('help')} className={`settings-nav-button ${activeTab === 'help' ? 'active' : ''}`}>
                            <HelpCircleIcon /><span>Help & Support</span>
                        </button>
                    </nav>
                    <div className="settings-content">
                        {activeTab === 'persona' && (
                            <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Greeting Message</h3>
                                        <p>This is what the assistant says when you first connect.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <input id="greeting-input" type="text" value={greeting} onChange={(e) => setGreeting(e.target.value)} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none flex-grow" />
                                        <button onClick={() => onSaveGreeting(greeting)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition">Save</button>
                                    </div>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Custom System Prompt</h3>
                                        <p>Define the core personality and instructions. A restart is needed for changes to take full effect.</p>
                                    </div>
                                    <textarea id="system-prompt-input" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={8} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none w-full resize-y" />
                                    <button onClick={() => onSaveSystemPrompt(systemPrompt)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition mt-2">Save Prompt</button>
                                </div>
                            </section>
                        )}
                        {activeTab === 'voice' && (
                            <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Main Voice</h3>
                                        <p>The primary voice used for most responses.</p>
                                    </div>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="main-voice-gender" className="block text-sm font-medium text-muted mb-1">Gender</label>
                                            <select id="main-voice-gender" value={mainVoiceGender} onChange={e => { onSetMainVoiceGender(e.target.value as 'female' | 'male'); onSelectVoice(VOICE_MAP[e.target.value as 'female' | 'male'][0]); }} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none">
                                                <option value="female">Female</option>
                                                <option value="male">Male</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="main-voice-select" className="block text-sm font-medium text-muted mb-1">Voice Style</label>
                                            <select id="main-voice-select" value={selectedVoice} onChange={e => onSelectVoice(e.target.value)} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none">
                                                {VOICE_MAP[mainVoiceGender].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-4">
                                        <div>
                                            <label htmlFor="main-voice-pitch" className="flex justify-between text-sm text-muted mb-1"><span>Pitch</span> <span>{voicePitch}</span></label>
                                            <input id="main-voice-pitch" type="range" min="-20" max="20" value={voicePitch} onChange={e => onSetVoicePitch(Number(e.target.value))} />
                                        </div>
                                        <div>
                                            <label htmlFor="main-voice-speed" className="flex justify-between text-sm text-muted mb-1"><span>Speed</span> <span>{voiceSpeed.toFixed(2)}x</span></label>
                                            <input id="main-voice-speed" type="range" min="0.25" max="2.0" step="0.05" value={voiceSpeed} onChange={e => onSetVoiceSpeed(Number(e.target.value))} />
                                        </div>
                                    </div>
                                    <button onClick={() => speakText("Testing the main voice configuration.", "neutral", { voice: selectedVoice, pitch: voicePitch, speed: voiceSpeed })} className="mt-4 px-4 py-2 text-sm bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color">Test Voice</button>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Greeting Voice</h3>
                                        <p>A separate voice for the initial greeting message.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="greeting-voice-gender" className="block text-sm font-medium text-muted mb-1">Gender</label>
                                            <select id="greeting-voice-gender" value={greetingVoiceGender} onChange={e => { onSetGreetingVoiceGender(e.target.value as 'female' | 'male'); onSetGreetingVoice(VOICE_MAP[e.target.value as 'female' | 'male'][0]); }} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none">
                                                <option value="female">Female</option>
                                                <option value="male">Male</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="greeting-voice-select" className="block text-sm font-medium text-muted mb-1">Voice Style</label>
                                            <select id="greeting-voice-select" value={greetingVoice} onChange={e => onSetGreetingVoice(e.target.value)} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none">
                                                {VOICE_MAP[greetingVoiceGender].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-4">
                                        <div>
                                            <label htmlFor="greeting-voice-pitch" className="flex justify-between text-sm text-muted mb-1"><span>Pitch</span> <span>{greetingPitch}</span></label>
                                            <input id="greeting-voice-pitch" type="range" min="-20" max="20" value={greetingPitch} onChange={e => onSetGreetingPitch(Number(e.target.value))} />
                                        </div>
                                        <div>
                                            <label htmlFor="greeting-voice-speed" className="flex justify-between text-sm text-muted mb-1"><span>Speed</span> <span>{greetingSpeed.toFixed(2)}x</span></label>
                                            <input id="greeting-voice-speed" type="range" min="0.25" max="2.0" step="0.05" value={greetingSpeed} onChange={e => onSetGreetingSpeed(Number(e.target.value))} />
                                        </div>
                                    </div>
                                    <button onClick={() => speakText(customGreeting, "neutral", { voice: greetingVoice, pitch: greetingPitch, speed: greetingSpeed })} className="mt-4 px-4 py-2 text-sm bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color">Test Greeting</button>
                                </div>
                            </section>
                        )}
                        {activeTab === 'avatar' && (
                            <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Select an Avatar</h3>
                                        <p>Choose from a predefined list or upload your own image.</p>
                                    </div>
                                    <div className="avatar-gallery-grid">
                                        {avatars.map((avatarUrl, index) => (
                                            <div key={index} onClick={() => onSelectAvatar(avatarUrl)} className={`avatar-item ${currentAvatar === avatarUrl ? 'selected' : ''}`}>
                                                <img src={avatarUrl} alt={`Avatar ${index + 1}`} />
                                            </div>
                                        ))}
                                        <button onClick={() => avatarUploadInputRef.current?.click()} className="avatar-item upload-avatar-item">
                                            <UploadIcon size={24} />
                                            <span className="text-xs mt-2">Upload</span>
                                            <input type="file" ref={avatarUploadInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                                        </button>
                                    </div>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Generate with AI</h3>
                                        <p>Describe the avatar you want to create.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <input ref={avatarGenerationInputRef} type="text" placeholder="e.g., a glowing blue orb of energy" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none flex-grow" />
                                        <button onClick={() => onGenerateAvatar(avatarGenerationInputRef.current?.value || '')} disabled={generatedAvatarResult.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition disabled:opacity-50">
                                            {generatedAvatarResult.isLoading ? 'Generating...' : 'Generate'}
                                        </button>
                                    </div>
                                    {generatedAvatarResult.error && <p className="text-red-400 text-sm mt-2">{generatedAvatarResult.error}</p>}
                                    {generatedAvatarResult.url && (
                                        <div className="mt-4">
                                            <p className="font-semibold mb-2">Generated Result:</p>
                                            <div className="flex items-center gap-4">
                                                <img src={generatedAvatarResult.url} alt="Generated avatar" className="w-24 h-24 rounded-lg object-cover border-2 border-border-color" />
                                                <button onClick={() => onUploadAvatar(generatedAvatarResult.url!)} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition">
                                                    Set as Avatar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                        {activeTab === 'apiKeys' && (
                             <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Gemini API Key (Required)</h3>
                                        <p>The core key for AI functionality. Get yours from Google AI Studio.</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input type="password" value={localApiKeys.gemini || ''} onChange={(e) => setLocalApiKeys(k => ({ ...k, gemini: e.target.value }))} placeholder="Starts with 'AIza...'" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none flex-grow" />
                                        <button onClick={onResetGeminiKey} className="px-4 py-2 text-sm bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 rounded-md hover:bg-yellow-500/30">Change Key</button>
                                    </div>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Optional API Keys</h3>
                                        <p>Enable extra features like weather, news, and YouTube search.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-muted mb-1">Visual Crossing Weather Key</label>
                                            <input type="password" value={localApiKeys.weather || ''} onChange={(e) => setLocalApiKeys(k => ({ ...k, weather: e.target.value }))} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted mb-1">GNews API Key</label>
                                            <input type="password" value={localApiKeys.news || ''} onChange={(e) => setLocalApiKeys(k => ({ ...k, news: e.target.value }))} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted mb-1">Google Cloud API Key (for YouTube)</label>
                                            <input type="password" value={localApiKeys.youtube || ''} onChange={(e) => setLocalApiKeys(k => ({ ...k, youtube: e.target.value }))} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleApiKeySave} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition self-start">Save All Keys</button>
                            </section>
                        )}
                        {activeTab === 'account' && (
                             <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Session Information</h3>
                                        <p>This is your unique identifier for this browser session.</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-assistant-bubble-bg p-2 rounded-md">
                                        <span className="text-muted text-sm font-mono">User ID:</span>
                                        <span className="font-mono text-sm">{userId}</span>
                                        <button onClick={() => navigator.clipboard.writeText(userId || '')} className="ml-auto text-muted hover:text-primary-color"><CopyIcon size={14}/></button>
                                    </div>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Data Management</h3>
                                        <p>Manage your conversation history and other stored data.</p>
                                    </div>
                                    <div>
                                        <button onClick={() => { if (confirm('Are you sure you want to permanently delete your conversation history? This cannot be undone.')) { onClearHistory(); } }} className="px-4 py-2 text-sm bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded-md transition">
                                            Clear Conversation History
                                        </button>
                                        <p className="text-xs text-muted mt-2">This will remove all conversation transcripts from the database.</p>
                                    </div>
                                </div>
                            </section>
                        )}
                         {activeTab === 'help' && (
                             <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Frequently Asked Questions</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <FaqItem q="How do I use Kaniska?" a={<>Simply click the "Connect" button and start speaking when the avatar glows. You can ask questions, give commands for music, weather, and more. Try saying "What can you do?" to get some ideas.</>} />
                                        <FaqItem q="Where do I get the Gemini API Key?" a={
                                            <div>
                                                <p><strong>English:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">Google AI Studio</a>.</li>
                                                    <li>Click "Create API key in new project".</li>
                                                    <li>Copy the generated key and paste it here.</li>
                                                </ol>
                                                <p className="mt-4"><strong>हिन्दी:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">गूगल एआई स्टूडियो</a> पर जाएं।</li>
                                                    <li>"नए प्रोजेक्ट में एपीआई कुंजी बनाएं" पर क्लिक करें।</li>
                                                    <li>उत्पन्न कुंजी को कॉपी करें और यहां पेस्ट करें।</li>
                                                </ol>
                                            </div>
                                        } />
                                        <FaqItem q="Where do I get the Weather API key?" a={
                                            <div>
                                                <p><strong>English:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li>Sign up for a free account at <a href="https://www.visualcrossing.com/weather-api" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">Visual Crossing Weather</a>.</li>
                                                    <li>After logging in, you'll find your API key on your account dashboard.</li>
                                                    <li>Copy the key and paste it in the API Keys section.</li>
                                                </ol>
                                                <p className="mt-4"><strong>हिन्दी:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li><a href="https://www.visualcrossing.com/weather-api" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">विज़ुअल क्रॉसिंग वेदर</a> पर एक निःशुल्क खाते के लिए साइन अप करें।</li>
                                                    <li>लॉग इन करने के बाद, आपको अपने खाता डैशबोर्ड पर अपनी एपीआई कुंजी मिल जाएगी।</li>
                                                    <li>कुंजी को कॉपी करें और एपीआई कुंजी अनुभाग में पेस्ट करें।</li>
                                                </ol>
                                            </div>
                                        }/>
                                        <FaqItem q="Where do I get the News API key?" a={
                                            <div>
                                                <p><strong>English:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li>Sign up for a free account at <a href="https://gnews.io/" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">GNews.io</a>.</li>
                                                    <li>Your API key will be available on your dashboard after you sign up and log in.</li>
                                                    <li>The free tier is generous enough for personal use.</li>
                                                </ol>
                                                <p className="mt-4"><strong>हिन्दी:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li><a href="https://gnews.io/" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">GNews.io</a> पर एक निःशुल्क खाते के लिए साइन अप करें।</li>
                                                    <li>साइन अप करने और लॉग इन करने के बाद आपकी एपीआई कुंजी आपके डैशबोर्ड पर उपलब्ध होगी।</li>
                                                    <li>निःशुल्क टियर व्यक्तिगत उपयोग के लिए पर्याप्त है।</li>
                                                </ol>
                                            </div>
                                        }/>
                                        <FaqItem q="Where do I get the Google Cloud API key (for YouTube)?" a={
                                            <div>
                                                <p><strong>English:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">Google Cloud Console</a> and create a new project.</li>
                                                    <li>Go to "APIs & Services" &gt; "Library".</li>
                                                    <li>Search for and enable the "YouTube Data API v3".</li>
                                                    <li>Go to "APIs & Services" &gt; "Credentials".</li>
                                                    <li>Click "Create Credentials" &gt; "API key". Copy the key.</li>
                                                </ol>
                                                <p className="mt-4"><strong>हिन्दी:</strong></p>
                                                <ol className="list-decimal list-inside">
                                                    <li><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-primary-color hover:underline">गूगल क्लाउड कंसोल</a> पर जाएं और एक नया प्रोजेक्ट बनाएं।</li>
                                                    <li>"एपीआई और सेवाएं" &gt; "लाइब्रेरी" पर जाएं।</li>
                                                    <li>"यूट्यूब डेटा एपीआई v3" खोजें और सक्षम करें।</li>
                                                    <li>"एपीआई और सेवाएं" &gt; "क्रेडेंशियल" पर जाएं।</li>
                                                    <li>"क्रेडेंशियल बनाएं" &gt; "एपीआई कुंजी" पर क्लिक करें। कुंजी को कॉपी करें।</li>
                                                </ol>
                                            </div>
                                        }/>
                                    </div>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Contact Support</h3>
                                        <p>If you're facing technical issues, you can start a live chat with our support team.</p>
                                    </div>
                                    <button onClick={onStartSupportChat} className="px-4 py-2 text-sm bg-green-600/80 hover:bg-green-600 text-white font-semibold rounded-md transition">Start Support Chat</button>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShareModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    conversation: TranscriptionEntry[];
}> = ({ isOpen, onClose, conversation }) => {
    const [copyStatus, setCopyStatus] = useState('Copy');

    if (!isOpen) return null;

    const formattedText = conversation
        .map(entry => `[${entry.speaker.toUpperCase()}] ${entry.text}`)
        .join('\n\n');

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedText);
        setCopyStatus('Copied!');
        setTimeout(() => setCopyStatus('Copy'), 2000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Share Conversation</h2>
                    <button onClick={onClose} className="text-2xl font-bold leading-none text-muted hover:text-white">&times;</button>
                </header>
                <div className="p-4">
                    <textarea
                        readOnly
                        value={formattedText}
                        className="w-full h-64 bg-assistant-bubble-bg border border-border-color rounded p-2 text-sm resize-none"
                    />
                </div>
                <footer className="flex justify-end p-4 border-t border-border-color">
                    <button onClick={handleCopy} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md w-24">
                        {copyStatus}
                    </button>
                </footer>
            </div>
        </div>
    );
};


// --- The Main App Component ---
export const App: React.FC = () => {
    // Component State
    const [theme, setTheme] = useState<Theme>('dark');
    const [assistantState, setAssistantState] = useState<AssistantState>('idle');
    const [avatarExpression, setAvatarExpression] = useState<AvatarExpression>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionEntry[]>([]);
    const [activePanel, setActivePanel] = useState<ActivePanel>('transcript');
    const [youtubePlayer, setYoutubePlayer] = useState<YT.Player | null>(null);
    const [youtubeSearchResults, setYoutubeSearchResults] = useState<{ videoId: string; title: string }[]>([]);
    const [currentYoutubeIndex, setCurrentYoutubeIndex] = useState(0);
    const [isYoutubePlaying, setIsYoutubePlaying] = useState(false);
    const [timerData, setTimerData] = useState<TimerData | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [newsData, setNewsData] = useState<NewsArticle[] | null>(null);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    
    // User Settings & API Keys
    const [userId, setUserId] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ gemini: null, weather: null, news: null, youtube: null });
    const [apiKeyReselectionReason, setApiKeyReselectionReason] = useState<string | null>(null);
    const [currentAvatar, setCurrentAvatar] = useState<string>(PREDEFINED_AVATARS[0]);
    const [customGreeting, setCustomGreeting] = useState("Hello, I'm Kaniska, your personal AI assistant. How can I help you today?");
    const [customSystemPrompt, setCustomSystemPrompt] = useState("You are Kaniska, a helpful and friendly female AI assistant from the future with a slightly sci-fi personality. Your primary language is English, but you must understand and respond to commands given in Hindi. You are integrated into a smart dashboard and can control various functions like playing music on YouTube, setting timers, and fetching information. Be concise but warm in your responses.");
    
    // Refs for persistent objects
    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<Promise<Session> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextAudioTimeRef = useRef(0);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    // --- Core Lifecycle & Setup ---

    useEffect(() => {
        // Initialize user ID
        let uid = localStorage.getItem('kaniska-userId');
        if (!uid) {
            uid = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('kaniska-userId', uid);
        }
        setUserId(uid);

        // Load theme from localStorage
        const savedTheme = localStorage.getItem('kaniska-theme') as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }

        // Initialize audio contexts
        inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        // Setup background music player
        audioPlayerRef.current = new Audio();
        audioPlayerRef.current.loop = true;

        // Setup YouTube Iframe API
        window.onYouTubeIframeAPIReady = () => {
            const player = new YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
                events: {
                    'onStateChange': (event: any) => {
                        setIsYoutubePlaying(event.data === YT.PlayerState.PLAYING);
                         if (event.data === YT.PlayerState.ENDED) {
                            // Play next video on end
                            if (currentYoutubeIndex < youtubeSearchResults.length - 1) {
                                const nextIndex = currentYoutubeIndex + 1;
                                setCurrentYoutubeIndex(nextIndex);
                                player.loadVideoById(youtubeSearchResults[nextIndex].videoId);
                            }
                        }
                    }
                }
            });
            setYoutubePlayer(player);
        };
        
        return () => { // Cleanup
            disconnect();
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (userId) {
            // Load settings from Firebase once userId is available
            db.ref(`users/${userId}/settings`).once('value', snapshot => {
                const settings = snapshot.val();
                if (settings) {
                    setApiKeys(k => ({ ...k, ...settings.apiKeys }));
                    setCurrentAvatar(settings.currentAvatar || PREDEFINED_AVATARS[0]);
                    setCustomGreeting(settings.customGreeting || customGreeting);
                    setCustomSystemPrompt(settings.customSystemPrompt || customSystemPrompt);
                }
            });
             // Load conversation history
            const historyRef = db.ref(`users/${userId}/history`).orderByChild('timestamp').limitToLast(50);
            historyRef.on('child_added', snapshot => {
                const entry = snapshot.val();
                setTranscriptionHistory(prev => [...prev, { ...entry, timestamp: new Date(entry.timestamp), firebaseKey: snapshot.key }]);
            });
             historyRef.on('child_removed', snapshot => {
                setTranscriptionHistory(prev => prev.filter(entry => entry.firebaseKey !== snapshot.key));
            });
        }
        return () => {
            if (userId) {
                db.ref(`users/${userId}/history`).off();
            }
        };
    }, [userId]);
    
     useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptionHistory]);

    // --- Core Assistant Connection ---
    
    const connect = async () => {
        if (!process.env.API_KEY) {
            console.error("Gemini API Key is not set in environment.");
            addSystemMessage("Connection failed: The API key is missing. Please configure it in Settings.", 'error');
            setAssistantState('error');
            return;
        }

        setAssistantState('connecting');
        setAvatarExpression('thinking');
        addSystemMessage("Initializing connection...", 'info');

        try {
            aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;

            const sessionPromise = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: { onopen, onmessage, onerror, onclose },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: customSystemPrompt,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations }],
                },
            });

            sessionPromiseRef.current = sessionPromise;
            
            // Wait for the session to be established before declaring it 'active'
            await sessionPromise;
            setAssistantState('active');
            setAvatarExpression('listening');
            addSystemMessage("Connection established. I'm listening.", 'success');
            speakText(customGreeting, 'cheerful');

        } catch (error) {
            console.error("Connection failed:", error);
            const friendlyMessage = getApiErrorMessage(error);
            addSystemMessage(`Connection failed: ${friendlyMessage}`, 'error');
            setAssistantState('error');
            setAvatarExpression('error');
            if (friendlyMessage.includes('API key')) {
                setApiKeyReselectionReason(friendlyMessage);
                setApiKeys(k => ({...k, gemini: null})); // Force re-selection
            }
        }
    };
    
    const disconnect = () => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        micStreamRef.current?.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
        setAssistantState('idle');
        setAvatarExpression('idle');
        addSystemMessage("Connection closed.", 'info');
    };

    // --- Live Session Callbacks ---

    const onopen = () => {
        const inputCtx = inputAudioContextRef.current;
        const stream = micStreamRef.current;
        if (!inputCtx || !stream) return;

        const source = inputCtx.createMediaStreamSource(stream);
        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            if (assistantState !== 'active') return;
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);
    };

    const onmessage = async (message: LiveServerMessage) => {
        // Handle audio output
        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
        if (audioData) {
            playAudio(audioData);
            setAvatarExpression('speaking');
        }

        // Handle transcription
        if (message.serverContent?.outputTranscription || message.serverContent?.inputTranscription) {
            // Logic to update transcriptionHistory would go here, but it's better to
            // use turnComplete to avoid partial sentences.
        }
        if (message.serverContent?.turnComplete) {
            const userInput = message.serverContent.inputTranscription?.text?.trim();
            const assistantOutput = message.serverContent.outputTranscription?.text?.trim();

            if (userInput) addTranscription('user', userInput);
            if (assistantOutput) addTranscription('assistant', assistantOutput);
            setAvatarExpression('listening'); // Back to listening after a turn
        }

        // Handle function calls
        if (message.toolCall) {
            setAvatarExpression('composing');
            for (const fc of message.toolCall.functionCalls) {
                console.log("Function Call Received:", fc);
                const result = await handleFunctionCall(fc.name, fc.args);
                sessionPromiseRef.current?.then(session => {
                    session.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } }
                    });
                });
            }
        }
    };

    const onerror = (e: ErrorEvent) => {
        console.error("Session Error:", e);
        const friendlyMessage = getApiErrorMessage(e);
        addSystemMessage(`Session error: ${friendlyMessage}`, 'error');
        setAssistantState('error');
        setAvatarExpression('error');
        if (friendlyMessage.includes('API key')) {
             setApiKeyReselectionReason(friendlyMessage);
             setApiKeys(k => ({...k, gemini: null}));
        }
    };
    
    const onclose = (e: CloseEvent) => {
        if (assistantState === 'active') { // Only show message if it wasn't a manual disconnect
            addSystemMessage("Connection was closed unexpectedly.", 'info');
            setAssistantState('idle');
            setAvatarExpression('idle');
        }
    };
    
    // --- Audio Playback ---
    
    const playAudio = async (base64Audio: string) => {
        if (isMuted) return;
        const outputCtx = outputAudioContextRef.current;
        if (!outputCtx) return;

        try {
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputCtx.destination);
            
            const currentTime = outputCtx.currentTime;
            const startTime = Math.max(currentTime, nextAudioTimeRef.current);
            source.start(startTime);
            
            nextAudioTimeRef.current = startTime + audioBuffer.duration;
            
            audioSourcesRef.current.add(source);
            source.onended = () => {
                audioSourcesRef.current.delete(source);
                 // If queue is empty, return to listening state
                if (audioSourcesRef.current.size === 0) {
                    setAvatarExpression('listening');
                }
            };
        } catch (error) {
            console.error("Error playing audio:", error);
        }
    };

    // --- Tool & Function Call Handling ---

    const playNext = useCallback(() => {
        if (youtubeSearchResults.length === 0 || !youtubePlayer) return 'No videos in the queue.';
        if (currentYoutubeIndex < youtubeSearchResults.length - 1) {
            const nextIndex = currentYoutubeIndex + 1;
            setCurrentYoutubeIndex(nextIndex);
            youtubePlayer.loadVideoById(youtubeSearchResults[nextIndex].videoId);
            return `Playing next video: ${youtubeSearchResults[nextIndex].title}`;
        }
        return 'This is the last video in the queue.';
    }, [currentYoutubeIndex, youtubeSearchResults, youtubePlayer]);

    const playPrevious = useCallback(() => {
        if (youtubeSearchResults.length === 0 || !youtubePlayer) return 'No videos in the queue.';
        if (currentYoutubeIndex > 0) {
            const prevIndex = currentYoutubeIndex - 1;
            setCurrentYoutubeIndex(prevIndex);
            youtubePlayer.loadVideoById(youtubeSearchResults[prevIndex].videoId);
            return `Playing previous video: ${youtubeSearchResults[prevIndex].title}`;
        }
        return 'This is the first video in the queue.';
    }, [currentYoutubeIndex, youtubeSearchResults, youtubePlayer]);

    const handleFunctionCall = async (name: string, args: any): Promise<any> => {
        addSystemMessage(`Executing command: ${name}(${JSON.stringify(args)})`, 'info');
        try {
             switch (name) {
                case 'searchAndPlayYoutubeVideo':
                    if(!apiKeys.youtube) return "YouTube API key not set.";
                    const results = await searchYoutubeVideo(args.query, apiKeys.youtube);
                    if (results.length > 0) {
                        setYoutubeSearchResults(results);
                        setCurrentYoutubeIndex(0);
                        youtubePlayer?.loadVideoById(results[0].videoId);
                        setActivePanel('youtube');
                        return `Now playing ${results[0].title}.`;
                    }
                    return `Could not find any videos for "${args.query}".`;
                case 'playNextYoutubeVideo':
                    return playNext();
                case 'playPreviousYoutubeVideo':
                    return playPrevious();
                // Add cases for all other functions...
                default:
                    return `Function ${name} is not implemented.`;
            }
        } catch (error) {
             const message = getApiErrorMessage(error);
             addSystemMessage(`Error in ${name}: ${message}`, 'error');
             return `Error: ${message}`;
        }
    };

    // --- UI & State Helpers ---
    const addSystemMessage = (text: string, type: 'info' | 'success' | 'error') => {
        const message: TranscriptionEntry = {
            speaker: 'system',
            text: `[${type.toUpperCase()}] ${text}`,
            timestamp: new Date()
        };
        setTranscriptionHistory(prev => [...prev, message]);
    };
    
    const addTranscription = (speaker: 'user' | 'assistant', text: string) => {
        if (!text) return;
        const entry: Omit<TranscriptionEntry, 'firebaseKey'> = { speaker, text, timestamp: new Date() };
        setTranscriptionHistory(prev => [...prev, entry]);
        if (userId) {
            db.ref(`users/${userId}/history`).push({ ...entry, timestamp: entry.timestamp.toISOString() });
        }
    };
    
    const speakText = (text: string, emotion: string = "neutral") => {
        // This is a placeholder for a TTS function call
        // In a real app, you would use a TTS API or browser's SpeechSynthesis
        console.log(`Speaking (${emotion}): ${text}`);
        addTranscription('assistant', text);
    };

    const handleSaveApiKeys = (keys: ApiKeys) => {
        setApiKeys(keys);
        if (userId) {
            db.ref(`users/${userId}/settings/apiKeys`).set(keys);
        }
        if (keys.gemini) {
           setApiKeyReselectionReason(null);
        }
    };

    const handleStudioKeySelected = (optionalKeys: OptionalApiKeys) => {
        const newKeys = { ...apiKeys, ...optionalKeys, gemini: 'key_from_studio' }; // Placeholder
        setApiKeys(newKeys);
        if (userId) {
            db.ref(`users/${userId}/settings/apiKeys`).set(newKeys);
        }
        setApiKeyReselectionReason(null);
        // We assume the key is now available via process.env.API_KEY and can proceed
        // A reload or re-init might be needed in a real scenario
    };
    
    if (!apiKeys.gemini && !process.env.API_KEY) {
        return <ApiKeySelectionScreen onKeysSaved={handleSaveApiKeys} onStudioKeySelected={handleStudioKeySelected} reselectionReason={apiKeyReselectionReason}/>;
    }

    return (
        <div className="min-h-screen w-screen flex flex-col bg-bg-color text-text-color">
            {/* --- Modals --- */}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                // Pass all required props...
                avatars={PREDEFINED_AVATARS}
                currentAvatar={currentAvatar}
                onSelectAvatar={(avatar) => {setCurrentAvatar(avatar); if(userId) db.ref(`users/${userId}/settings/currentAvatar`).set(avatar);}}
                onUploadAvatar={(avatar) => {setCurrentAvatar(avatar); if(userId) db.ref(`users/${userId}/settings/currentAvatar`).set(avatar);}}
                onGenerateAvatar={() => {}}
                generatedAvatarResult={{url: null, isLoading: false, error: null}}
                customGreeting={customGreeting}
                onSaveGreeting={(g) => {setCustomGreeting(g); if(userId) db.ref(`users/${userId}/settings/customGreeting`).set(g);}}
                customSystemPrompt={customSystemPrompt}
                onSaveSystemPrompt={(p) => {setCustomSystemPrompt(p); if(userId) db.ref(`users/${userId}/settings/customSystemPrompt`).set(p);}}
                onClearHistory={() => {if(userId) db.ref(`users/${userId}/history`).remove(); setTranscriptionHistory([]);}}
                mainVoiceGender={'female'} onSetMainVoiceGender={() => {}} selectedVoice={'Zephyr'} onSelectVoice={()=>{}} voicePitch={0} onSetVoicePitch={()=>{}} voiceSpeed={1} onSetVoiceSpeed={()=>{}}
                greetingVoiceGender={'female'} onSetGreetingVoiceGender={()=>{}} greetingVoice={'Zephyr'} onSetGreetingVoice={()=>{}} greetingPitch={0} onSetGreetingPitch={()=>{}} greetingSpeed={1} onSetGreetingSpeed={()=>{}}
                speakText={speakText} onStartSupportChat={()=>{}} userId={userId} apiKeys={apiKeys} onSaveApiKeys={handleSaveApiKeys}
                onResetGeminiKey={() => {setApiKeys(k=>({...k, gemini: null})); if(userId) db.ref(`users/${userId}/settings/apiKeys/gemini`).remove();}}
            />
            <ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} conversation={transcriptionHistory} />

            {/* --- Main UI --- */}
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-border-color">
                <div className="flex items-center gap-3">
                    <HologramIcon />
                    <h1 className="text-xl font-bold glowing-text">Kaniska</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Clock />
                    <button onClick={() => setShowSettingsModal(true)} title="Settings" className="text-muted hover:text-primary-color transition"><SettingsIcon /></button>
                </div>
            </header>

            <main className="flex-grow flex flex-col lg:flex-row">
                <div className="w-full lg:w-2/5 flex flex-col items-center justify-center p-4 relative border-b lg:border-b-0 lg:border-r border-border-color h-screen lg:h-auto">
                    <div className="hologram-container">
                        <img src={currentAvatar} alt="Kaniska Avatar" className={`avatar expression-${avatarExpression}`} />
                        {(avatarExpression === 'composing' || avatarExpression === 'thinking') && <TypingIndicator />}
                    </div>
                    <div className="absolute bottom-4 text-center">
                        <p className="font-semibold capitalize">{assistantState}</p>
                        <p className="text-xs text-muted">Say "Hey Kaniska" or click Connect</p>
                    </div>
                </div>

                <div className="w-full lg:w-3/5 flex flex-col bg-panel-bg min-h-screen lg:min-h-0">
                    {activePanel === 'transcript' && (
                         <div className="flex-grow p-4 overflow-y-auto space-y-4">
                            {transcriptionHistory.map((entry, index) => (
                                <div key={index} className={`chat-bubble-animation ${entry.speaker === 'user' ? 'text-right' : 'text-left'}`}>
                                    <div className={`inline-block max-w-lg p-3 rounded-xl ${entry.speaker === 'user' ? 'bg-primary-color/20' : entry.speaker === 'assistant' ? 'bg-assistant-bubble-bg' : 'bg-yellow-500/10'}`}>
                                        <p className="text-sm m-0">{entry.text}</p>
                                        <p className="text-xs text-muted mt-1 opacity-70">{entry.timestamp.toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={transcriptEndRef} />
                        </div>
                    )}
                     {activePanel === 'youtube' && (
                        <div className="flex-grow flex flex-col p-4 gap-4">
                            <div id="youtube-player" className="youtube-container"></div>
                            <div className="flex flex-col items-center justify-center gap-2">
                                <p className="text-sm text-center text-muted w-full px-4 truncate">{youtubeSearchResults[currentYoutubeIndex]?.title || 'No video loaded.'}</p>
                                <div className="youtube-controls-container">
                                    <button onClick={playPrevious} disabled={currentYoutubeIndex <= 0} className="youtube-control-button" aria-label="Previous video">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                                    </button>
                                    <button onClick={() => isYoutubePlaying ? youtubePlayer?.pauseVideo() : youtubePlayer?.playVideo()} className="youtube-control-button play-pause-btn" aria-label={isYoutubePlaying ? 'Pause video' : 'Play video'}>
                                        {isYoutubePlaying ?
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                            :
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                        }
                                    </button>
                                    <button onClick={playNext} disabled={currentYoutubeIndex >= youtubeSearchResults.length - 1} className="youtube-control-button" aria-label="Next video">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Other panels would be conditionally rendered here */}
                    <QuickActions 
                        onAction={() => {}} 
                        disabled={assistantState !== 'active'}
                        isWeatherEnabled={!!apiKeys.weather}
                        isNewsEnabled={!!apiKeys.news}
                        isYoutubeEnabled={!!apiKeys.youtube}
                    />
                </div>
            </main>

            <footer className="flex-shrink-0 p-3 border-t border-border-color flex items-center justify-around">
                 <button onClick={() => assistantState === 'active' ? disconnect() : connect()} className={`footer-button ${assistantState === 'active' ? 'active' : ''}`}>
                    {assistantState === 'active' ? 
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                        :
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                    }
                    <span className="text-xs font-semibold">{assistantState === 'active' ? 'Disconnect' : 'Connect'}</span>
                </button>
                <button onClick={() => setShowShareModal(true)} disabled={transcriptionHistory.length === 0} className="footer-button">
                    <ShareIcon size={24} />
                    <span className="text-xs font-semibold">Share</span>
                </button>
                <button onClick={() => setIsMuted(!isMuted)} className={`footer-button ${isMuted ? 'text-red-400' : ''}`}>
                     {isMuted ? 
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                        :
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                    }
                    <span className="text-xs font-semibold">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
            </footer>
        </div>
    );
};