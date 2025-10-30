
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
                                    <button onClick={() => speakText("Testing the greeting voice configuration.", "cheerful", { voice: greetingVoice, pitch: greetingPitch, speed: greetingSpeed })} className="mt-4 px-4 py-2 text-sm bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color">Test Voice</button>
                                </div>
                            </section>
                        )}
                        {activeTab === 'avatar' && (
                            <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Avatar Gallery</h3>
                                        <p>Choose a predefined avatar or upload your own.</p>
                                    </div>
                                    <input type="file" ref={avatarUploadInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                                    <div className="avatar-gallery-grid">
                                        {avatars.map((avatar, index) => (
                                            <div key={index} onClick={() => onSelectAvatar(avatar)} className={`avatar-item ${currentAvatar === avatar ? 'selected' : ''}`}>
                                                <img src={avatar} alt={`Avatar ${index + 1}`} />
                                            </div>
                                        ))}
                                        <div onClick={() => avatarUploadInputRef.current?.click()} className="avatar-item upload-avatar-item">
                                            <UploadIcon />
                                            <span className="text-xs mt-1">Upload</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>Generate AI Avatar</h3>
                                        <p>Describe the avatar you want the assistant to create.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <input ref={avatarGenerationInputRef} type="text" placeholder="e.g., blue hair, cyberpunk style" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none flex-grow" />
                                        <button onClick={() => onGenerateAvatar(avatarGenerationInputRef.current?.value || '')} disabled={generatedAvatarResult.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition">{generatedAvatarResult.isLoading ? 'Generating...' : 'Generate'}</button>
                                    </div>
                                    {generatedAvatarResult.error && <p className="text-red-400 text-xs mt-2">{generatedAvatarResult.error}</p>}
                                    {generatedAvatarResult.url && <img src={generatedAvatarResult.url} alt="Generated Avatar" className="mt-4 rounded-md w-32 h-32 object-cover" />}
                                </div>
                            </section>
                        )}
                         {activeTab === 'apiKeys' && (
                            <section className="settings-section">
                                <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3>API Keys</h3>
                                        <p>Manage the API keys required for the assistant's features. Keys are saved to a local database for your convenience.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Gemini API Key <span className="text-red-400">(Required)</span></label>
                                            <input type="text" spellCheck="false" autoComplete="off" value={localApiKeys.gemini || ''} onChange={(e) => setLocalApiKeys(p => ({...p, gemini: e.target.value}))} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Visual Crossing Weather Key</label>
                                            <input type="text" spellCheck="false" autoComplete="off" value={localApiKeys.weather || ''} onChange={(e) => setLocalApiKeys(p => ({...p, weather: e.target.value}))} className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">GNews API Key</label>
                                            <input type="text" spellCheck="false" autoComplete="off" value={localApiKeys.news || ''} onChange={(e) => setLocalApiKeys(p => ({...p, news: e.target.value}))} placeholder="From gnews.io" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Google Cloud API Key</label>
                                            <input type="text" spellCheck="false" autoComplete="off" value={localApiKeys.youtube || ''} onChange={(e) => setLocalApiKeys(p => ({...p, youtube: e.target.value}))} placeholder="For YouTube search & other Google services" className="w-full bg-assistant-bubble-bg border border-border-color rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary-color focus:outline-none" />
                                        </div>
                                        <button onClick={handleApiKeySave} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition mt-2">Save Keys</button>
                                    </div>
                                </div>
                            </section>
                         )}
                         {activeTab === 'account' && (
                            <section className="settings-section">
                                 <div className="settings-card">
                                    <div className="settings-section-header mb-4">
                                        <h3 className="text-red-400">Danger Zone</h3>
                                        <p>These actions are destructive and cannot be undone.</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button onClick={onClearHistory} className="px-4 py-2 text-sm bg-red-600/20 text-red-300 border border-red-500/50 hover:bg-red-600/30 font-semibold rounded-md transition">Clear Conversation History</button>
                                        <button onClick={onResetGeminiKey} className="px-4 py-2 text-sm bg-red-600/20 text-red-300 border border-red-500/50 hover:bg-red-600/30 font-semibold rounded-md transition">Reset All API Keys</button>
                                    </div>
                                </div>
                            </section>
                         )}
                         {activeTab === 'help' && (
                            <section className="settings-section">
                                <div className="settings-card">
                                     <div className="settings-section-header mb-4">
                                        <h3>Contact & Support</h3>
                                        <p>Get in touch with the developer or get help with issues.</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <a href="mailto:abhixofficial01@gmail.com" className="flex-1 text-center px-4 py-2 bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color hover:text-primary-color transition font-semibold">Email Support</a>
                                        <a href="https://www.instagram.com/abhixofficial01/" target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-4 py-2 bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color hover:text-primary-color transition font-semibold">Instagram DM</a>
                                    </div>
                                    <button onClick={onStartSupportChat} className="w-full mt-4 px-4 py-2 text-sm bg-primary-color/80 hover:bg-primary-color text-bg-color font-semibold rounded-md transition">Start Live Chat with Support</button>
                                </div>
                                <div className="settings-card">
                                     <div className="settings-section-header mb-4">
                                        <h3>Frequently Asked Questions</h3>
                                    </div>
                                    <FaqItem q="API Key कहाँ से मिलेगा? / Where do I get a Gemini API Key?" a={
                                        <>
                                            <p>You can get a free API key from Google AI Studio. It's needed for the assistant to work.</p>
                                            <p>API Key आप Google AI Studio से मुफ़्त में ले सकते हैं। असिस्टेंट को काम करने के लिए इसकी ज़रूरत है।</p>
                                            <ol className="list-decimal list-inside space-y-2">
                                                <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-color hover:underline">Google AI Studio</a>. (लिंक पर जाएँ)</li>
                                                <li>Click on <b>"Create API key"</b>. (बटन पर क्लिक करें)</li>
                                                <li>If asked, choose an existing Google Cloud project or create a new one. (एक नया प्रोजेक्ट बनाएँ)</li>
                                                <li>The website will generate a long string of text. That's your API key. Click the copy icon next to it. (जो key दिखे उसे कॉपी करें)</li>
                                                <li>Come back here, go to the <b>API Keys</b> tab, and paste it into the "Gemini API Key" box. (वापस आकर API Keys टैब में पेस्ट करें)</li>
                                            </ol>
                                        </>
                                    }/>
                                    <FaqItem q="API Key क्या है और बिलिंग कैसे काम करती है? / What is an API Key & how does billing work?" a={
                                        <>
                                            <p>An API key is like a secret password that lets this app talk to Google's Gemini AI. The free plan is very generous and is usually enough for personal use.</p>
                                            <p>API Key एक पासवर्ड की तरह है जो इस ऐप को Google के Gemini AI से बात करने की अनुमति देता है। इसका मुफ़्त प्लान व्यक्तिगत उपयोग के लिए काफी है।</p>
                                            <p>If you use it a lot, Google might ask you to enable billing on your Google Cloud project. You can check your usage and set limits there. For more details, please read the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-primary-color hover:underline">official billing documentation</a>.</p>
                                            <p>अधिक जानकारी के लिए, कृपया <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-primary-color hover:underline">आधिकारिक बिलिंग दस्तावेज़</a> पढ़ें।</p>
                                        </>
                                    }/>
                                </div>
                            </section>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const App: React.FC = () => {
    const [theme, setTheme] = useState<Theme>('dark');
    const [assistantState, setAssistantState] = useState<AssistantState>('idle');
    const [avatarExpression, setAvatarExpression] = useState<AvatarExpression>('idle');
    const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
    const [activePanel, setActivePanel] = useState<ActivePanel>('transcript');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
    const [timer, setTimer] = useState<TimerData | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [avatars, setAvatars] = useState<string[]>(PREDEFINED_AVATARS);
    const [currentAvatar, setCurrentAvatar] = useState<string>(PREDEFINED_AVATARS[0]);
    const [generatedAiAvatar, setGeneratedAiAvatar] = useState<GeneratedAvatar>({ url: null, isLoading: false, error: null });
    const [youtubeTitle, setYoutubeTitle] = useState<string | null>(null);
    const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
    const [youtubeError, setYoutubeError] = useState<string | null>(null);
    const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
    const [liveEditingImage, setLiveEditingImage] = useState<GeneratedImage | null>(null);
    const [youtubeQueue, setYoutubeQueue] = useState<{ videoId: string; title: string }[]>([]);
    const [youtubeQueueIndex, setYoutubeQueueIndex] = useState(-1);
    const [isYoutubePlaying, setIsYoutubePlaying] = useState<boolean>(false);
    const [youtubeStartTime, setYoutubeStartTime] = useState<number>(0);
    const [customGreeting, setCustomGreeting] = useState<string>("Hey, main Kaniska hoon. Bataiye, main aapke liye kya kar sakti hoon?");
    const [customSystemPrompt, setCustomSystemPrompt] = useState<string>('');
    const [mainVoiceGender, setMainVoiceGender] = useState<'female' | 'male'>('female');
    const [selectedVoice, setSelectedVoice] = useState<string>('Zephyr');
    const [voicePitch, setVoicePitch] = useState<number>(0);
    const [voiceSpeed, setVoiceSpeed] = useState<number>(1);
    const [greetingVoiceGender, setGreetingVoiceGender] = useState<'female' | 'male'>('female');
    const [greetingVoice, setGreetingVoice] = useState<string>('Zephyr');
    const [greetingPitch, setGreetingPitch] = useState<number>(0);
    const [greetingSpeed, setGreetingSpeed] = useState<number>(1);
    const [videoGenerationState, setVideoGenerationState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [videoProgressMessage, setVideoProgressMessage] = useState('');
    const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
    const [videoDescription, setVideoDescription] = useState<string | null>(null);
    const [voiceoverAudioUrl, setVoiceoverAudioUrl] = useState<string | null>(null);
    const [voiceoverState, setVoiceoverState] = useState<VoiceoverState>('idle');
    const [voiceoverError, setVoiceoverError] = useState<string | null>(null);
    const [voiceoverProgress, setVoiceoverProgress] = useState('');
    const [songLyrics, setSongLyrics] = useState<{ name: string; artist: string; lyrics: string[]; currentLine: number } | null>(null);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [codeSnippets, setCodeSnippets] = useState<CodeSnippet[]>([]);
    const [websitePreview, setWebsitePreview] = useState<WebsitePreview>(null);
    const [liveEditingSnippetId, setLiveEditingSnippetId] = useState<string | null>(null);
    const [liveEditorCode, setLiveEditorCode] = useState<string>('');
    const [shareContent, setShareContent] = useState<{type: 'image' | 'video', content: string, prompt?: string} | null>(null);
    const [isSupportChatActive, setIsSupportChatActive] = useState(false);
    const [isStudioKeySelected, setIsStudioKeySelected] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [isRecordingMessage, setIsRecordingMessage] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ gemini: null, weather: null, news: null, youtube: null });
    const [isApiKeyLoading, setIsApiKeyLoading] = useState(true);
    const [localAudioDownloads, setLocalAudioDownloads] = useState<Record<string, string>>({});


    const initialFilters: ImageFilters = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, invert: 0 };
    const initialTransforms: ImageTransforms = { rotate: 0, scaleX: 1, scaleY: 1 };
    
    const [liveEditFilters, setLiveEditFilters] = useState<ImageFilters>(initialFilters);
    const [liveEditTransform, setLiveEditTransform] = useState<ImageTransforms>(initialTransforms);
    
    const liveEditFiltersRef = useRef(liveEditFilters);
    useEffect(() => { liveEditFiltersRef.current = liveEditFilters; }, [liveEditFilters]);
    const liveEditTransformRef = useRef(liveEditTransform);
    useEffect(() => { liveEditTransformRef.current = liveEditTransform; }, [liveEditTransform]);

    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const userIdRef = useRef<string | null>(null);
    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<Promise<Session> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const timerIntervalRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
    const videoUploadInputRef = useRef<HTMLInputElement | null>(null);
    const voiceoverVideoRef = useRef<HTMLVideoElement>(null);
    const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
    const messageMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const messageAudioChunksRef = useRef<Blob[]>([]);

    const addTranscriptionEntry = useCallback((entry: Omit<TranscriptionEntry, 'timestamp'> & { timestamp?: Date }) => {
        if (!userIdRef.current) return;
        const conversationRef = db.ref(`conversations/${userIdRef.current}`);
        const newEntryData = {
            speaker: entry.speaker,
            text: entry.text,
            timestamp: (entry.timestamp || new Date()).getTime()
        };
        conversationRef.push(newEntryData);
    }, []);

    const handleApiError = useCallback((error: unknown, context?: string) => {
        const errorMessage = getApiErrorMessage(error);
        console.error(`API Error in ${context || 'operation'}:`, error);

        const originalMessage = error instanceof Error ? error.message : JSON.stringify(error);
        if (originalMessage.toLowerCase().includes('requested entity was not found') || originalMessage.toLowerCase().includes('api key not valid')) {
            setIsStudioKeySelected(false);
            setApiKeys(prev => ({ ...prev, gemini: null }));
            if (userIdRef.current) {
                db.ref(`apiKeys/${userIdRef.current}`).update({ gemini: null });
            }
            setApiKeyError(errorMessage);
        }
        
        addTranscriptionEntry({ speaker: 'system', text: `API Error: ${errorMessage}` });
        return errorMessage;
    }, [addTranscriptionEntry]);

    const getAiClient = useCallback(() => {
        const apiKey = apiKeys.gemini || process.env.API_KEY;
        if (!apiKey) {
            console.error("Gemini API Key is not available.");
            setIsStudioKeySelected(false);
            setApiKeys(prev => ({ ...prev, gemini: null}));
            setIsApiKeyLoading(false); // Ensure loading is finished to show screen
            return null;
        }
        try {
            // Re-create the instance to ensure it uses the latest key
            const ai = new GoogleGenAI({ apiKey: apiKey });
            aiRef.current = ai;
            return ai;
        } catch (e) {
            handleApiError(e, 'getAiClient-init');
            return null;
        }
    }, [apiKeys.gemini, handleApiError]);

    const getOutputAudioContext = useCallback(() => {
        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
            try {
                outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            } catch (e) {
                console.error("Failed to create Output AudioContext", e);
                return null;
            }
        }
        if (outputAudioContextRef.current.state === 'suspended') {
            outputAudioContextRef.current.resume().catch(console.error);
        }
        return outputAudioContextRef.current;
    }, []);

    const getInputAudioContext = useCallback(() => {
        if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
            try {
                inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            } catch (e) {
                console.error("Failed to create Input AudioContext", e);
                return null;
            }
        }
        if (inputAudioContextRef.current.state === 'suspended') {
            inputAudioContextRef.current.resume().catch(console.error);
        }
        return inputAudioContextRef.current;
    }, []);


    const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [transcriptions]);

     useEffect(() => {
        const loadData = async () => {
            let id = localStorage.getItem('kaniska_user_id');
            if (!id) {
                id = crypto.randomUUID();
                localStorage.setItem('kaniska_user_id', id);
            }
            userIdRef.current = id;
    
            try {
                const snapshot = await db.ref(`apiKeys/${id}`).once('value');
                const savedKeys = snapshot.val();
                if (savedKeys) {
                    setApiKeys({
                        gemini: savedKeys.gemini || null,
                        weather: savedKeys.weather || null,
                        news: savedKeys.news || null,
                        youtube: savedKeys.youtube || null,
                    });
                } else if (window.aistudio?.hasSelectedApiKey) {
                    const hasKey = await window.aistudio.hasSelectedApiKey();
                    if (hasKey) {
                        setIsStudioKeySelected(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check for saved API key:", error);
            } finally {
                setIsApiKeyLoading(false);
            }

            try {
                const savedSettings = localStorage.getItem('user_settings');
                if (savedSettings) {
                    const data = JSON.parse(savedSettings);
                    if (data.theme) setTheme(data.theme);
                    if (data.avatars) setAvatars(data.avatars);
                    if (data.currentAvatar) setCurrentAvatar(data.currentAvatar);
                    if (data.customGreeting) setCustomGreeting(data.customGreeting);
                    if (data.customSystemPrompt) setCustomSystemPrompt(data.customSystemPrompt);
                    if (data.mainVoiceGender) setMainVoiceGender(data.mainVoiceGender);
                    if (data.selectedVoice) setSelectedVoice(data.selectedVoice);
                    if (data.voicePitch) setVoicePitch(data.voicePitch);
                    if (data.voiceSpeed) setVoiceSpeed(data.voiceSpeed);
                    if (data.greetingVoiceGender) setGreetingVoiceGender(data.greetingVoiceGender);
                    if (data.greetingVoice) setGreetingVoice(data.greetingVoice);
                    if (data.greetingPitch) setGreetingPitch(data.greetingPitch);
                    if (data.greetingSpeed) setGreetingSpeed(data.greetingSpeed);
                }
                const savedYoutubeState = localStorage.getItem('youtube_playback_state');
                if (savedYoutubeState) {
                    const data = JSON.parse(savedYoutubeState);
                    if (data.queue && data.queue.length > 0 && data.index < data.queue.length) {
                        setYoutubeQueue(data.queue);
                        setYoutubeQueueIndex(data.index);
                        setYoutubeTitle(data.title || null);
                        setYoutubeStartTime(data.time || 0);
                        setActivePanel('youtube');
                        setPendingVideoId(data.queue[data.index].videoId);
                    }
                }
            } catch (error) {
                console.error("Failed to load settings from localStorage", error);
            } finally {
                setIsDataLoaded(true);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (!isDataLoaded || !userIdRef.current) return;

        const conversationRef = db.ref(`conversations/${userIdRef.current}`);
        
        const onValueCallback = (snapshot: any) => {
            const data = snapshot.val();
            const transcriptionsArray: TranscriptionEntry[] = [];
            if (data) {
                for (const key in data) {
                    transcriptionsArray.push({
                        firebaseKey: key,
                        ...data[key],
                        timestamp: new Date(data[key].timestamp)
                    });
                }
                transcriptionsArray.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            }
            setTranscriptions(transcriptionsArray);
        };

        conversationRef.on('value', onValueCallback);

        return () => {
            conversationRef.off('value', onValueCallback);
        };
    }, [isDataLoaded]);


    useEffect(() => {
        if (!isDataLoaded) return;
        try {
            const settingsToSave = {
                theme,
                avatars,
                currentAvatar,
                customGreeting,
                customSystemPrompt,
                mainVoiceGender,
                selectedVoice,
                voicePitch,
                voiceSpeed,
                greetingVoiceGender,
                greetingVoice,
                greetingPitch,
                greetingSpeed,
            };
            localStorage.setItem('user_settings', JSON.stringify(settingsToSave));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }, [theme, avatars, currentAvatar, customGreeting, customSystemPrompt, mainVoiceGender, selectedVoice, voicePitch, voiceSpeed, greetingVoiceGender, greetingVoice, greetingPitch, greetingSpeed, isDataLoaded]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (timer?.isActive) {
            timerIntervalRef.current = window.setInterval(() => {
                setTimer(prevTimer => {
                    if (prevTimer && prevTimer.remaining > 1) {
                        return { ...prevTimer, remaining: prevTimer.remaining - 1 };
                    } else {
                        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                        addTranscriptionEntry({ speaker: 'system', text: `Timer "${prevTimer?.name}" finished!` })
                        return prevTimer ? { ...prevTimer, isActive: false, remaining: 0 } : null;
                    }
                });
            }, 1000);
        }
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [timer?.isActive, addTranscriptionEntry]);

    useEffect(() => {
        const currentVideoUrl = videoUrl; // Capture URL for cleanup
        return () => {
            if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
        };
    }, [videoUrl]);
    
    useEffect(() => {
        const currentUploadedVideoUrl = uploadedVideoUrl;
        return () => {
             if (currentUploadedVideoUrl) URL.revokeObjectURL(currentUploadedVideoUrl);
        }
    }, [uploadedVideoUrl]);

    useEffect(() => {
        const currentVoiceoverAudioUrl = voiceoverAudioUrl;
        return () => {
             if (currentVoiceoverAudioUrl) URL.revokeObjectURL(currentVoiceoverAudioUrl);
        }
    }, [voiceoverAudioUrl]);

    useEffect(() => {
        return () => {
            Object.values(localAudioDownloads).forEach(URL.revokeObjectURL);
        };
    }, [localAudioDownloads]);

    // Save YouTube playback state periodically
    useEffect(() => {
        const saveInterval = setInterval(() => {
            if (isYoutubePlaying && playerRef.current && youtubeQueue.length > 0) {
                const currentTime = playerRef.current.getCurrentTime();
                if (currentTime > 0) {
                    const youtubeState = {
                        queue: youtubeQueue,
                        index: youtubeQueueIndex,
                        time: currentTime,
                        title: youtubeTitle,
                    };
                    localStorage.setItem('youtube_playback_state', JSON.stringify(youtubeState));
                }
            }
        }, 5000); // Save every 5 seconds

        return () => clearInterval(saveInterval);
    }, [isYoutubePlaying, youtubeQueue, youtubeQueueIndex, youtubeTitle]);

    const handleSaveGreeting = (greeting: string) => {
        setCustomGreeting(greeting);
    };
    
    const handleSaveSystemPrompt = (prompt: string) => {
        setCustomSystemPrompt(prompt);
    };

    const handleClearHistory = () => {
        if (!userIdRef.current) return;
        if (window.confirm("Are you sure you want to erase the conversation history? This will delete your current conversation from the database.")) {
            const conversationRef = db.ref(`conversations/${userIdRef.current}`);
            conversationRef.set(null);
        }
    };

    const handleGenerateImage = useCallback(async (prompt: string) => {
        const ai = getAiClient();
        if (!ai) return;
        setActivePanel('image');
        const imageId = crypto.randomUUID();
        const newImageEntry: GeneratedImage = { id: imageId, prompt, url: null, isLoading: true, error: null };
        setGeneratedImages(prev => [newImageEntry, ...prev]);
        setSelectedImage(newImageEntry);
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001', prompt, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });
            const imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
            const updatedImage = { ...newImageEntry, url: imageUrl, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? updatedImage : img));
            setSelectedImage(updatedImage);
        } catch (error) {
            const errorMessage = handleApiError(error, 'GenerateImage');
            const erroredImage = { ...newImageEntry, error: errorMessage, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? erroredImage : img));
            setSelectedImage(erroredImage);
        }
    }, [getAiClient, handleApiError]);

    const PROGRESS_MESSAGES = [
        "Warming up the rendering engine...", "Scripting the visual sequence...",
        "Compositing holographic layers...", "Calibrating neon glow...",
        "Encoding high-fidelity visuals...", "Adding cinematic soundscapes...",
        "Finalizing the quantum stream...", "This is taking a bit longer than usual, but good things take time!"
    ];

    const handleGenerateIntroVideo = useCallback(async () => {
        const ai = getAiClient();
        if (!ai) return;
        setActivePanel('video');
        setVideoGenerationState('generating');
        setVideoUrl(null);
        setVideoError(null);

        const progressInterval = setInterval(() => {
            setVideoProgressMessage(prev => {
                const currentIndex = PROGRESS_MESSAGES.indexOf(prev);
                const nextIndex = (currentIndex + 1) % PROGRESS_MESSAGES.length;
                return PROGRESS_MESSAGES[nextIndex];
            });
        }, 5000);

        setVideoProgressMessage(PROGRESS_MESSAGES[0]);

        try {
            const prompt = "A cinematic, futuristic, sci-fi trailer for a female AI assistant named Kaniska. Show a glowing holographic interface, abstract data visualizations, sound waves, and end with the name 'Kaniska' appearing in neon text. The mood should be high-tech, sleek, and intelligent.";
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt,
                config: { numberOfVideos: 1 }
            });

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            clearInterval(progressInterval);

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                setVideoProgressMessage('Downloading final video...');
                const videoResponse = await fetch(`${downloadLink}&key=${apiKeys.gemini || process.env.API_KEY}`);
                if (!videoResponse.ok) {
                    throw new Error(`Failed to download video file. Status: ${videoResponse.status}`);
                }
                const videoBlob = await videoResponse.blob();
                const objectUrl = URL.createObjectURL(videoBlob);
                setVideoUrl(objectUrl);
                setVideoGenerationState('done');
            } else {
                throw new Error("Video generation completed, but no download link was provided.");
            }
        } catch (error) {
            clearInterval(progressInterval);
            const errorMessage = handleApiError(error, 'GenerateIntroVideo');
            setVideoError(errorMessage);
            setVideoGenerationState('error');
        }
    }, [getAiClient, handleApiError, apiKeys.gemini]);

    const handleGenerateAvatar = useCallback(async (prompt: string) => {
        const ai = getAiClient();
        if (!ai) {
            setGeneratedAiAvatar({ url: null, isLoading: false, error: 'AI Client not initialized.' });
            return;
        }
        setGeneratedAiAvatar({ url: null, isLoading: true, error: null });
        const fullPrompt = `A futuristic, holographic, sci-fi female assistant avatar, head and shoulders portrait. Style: neon, glowing, ethereal. Dark background. The character is described as: ${prompt}`;
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001', prompt: fullPrompt, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });
            const imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
            setGeneratedAiAvatar({ url: imageUrl, isLoading: false, error: null });
        } catch (error) {
            const errorMessage = handleApiError(error, 'GenerateAvatar');
            setGeneratedAiAvatar({ url: null, isLoading: false, error: errorMessage });
        }
    }, [getAiClient, handleApiError]);

    const setBackgroundMusic = useCallback((mood: 'happy' | 'sad' | 'epic' | 'calm' | 'none') => {
        if (!audioPlayerRef.current) return;
        if (mood === 'none' || !BACKGROUND_MUSIC[mood]) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
        } else {
            audioPlayerRef.current.src = BACKGROUND_MUSIC[mood];
            audioPlayerRef.current.loop = true;
            audioPlayerRef.current.volume = 0.3; // Lower volume for ambient
            audioPlayerRef.current.play().catch(e => console.error("Background music play failed:", e));
        }
    }, []);

    const disconnectFromGemini = useCallback(() => {
        console.log("Disconnecting...");
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
        scriptProcessorNodeRef.current?.disconnect();
        scriptProcessorNodeRef.current = null;
        
        for (const source of sourcesRef.current.values()) {
            try { source.stop(); } catch (e) { console.warn("Error stopping audio source:", e); }
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        setBackgroundMusic('none');
        setSongLyrics(null);

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        setAssistantState('idle');
        setAvatarExpression('idle');
        setIsSupportChatActive(false);
    }, [setBackgroundMusic]);
    
    const speakText = useCallback(async (
        text: string,
        emotion: string = 'neutral',
        voiceOverride?: { voice: string; pitch: number; speed: number },
        isSinging: boolean = false
    ) => {
        const audioContext = getOutputAudioContext();
        const ai = getAiClient();
        if (!ai || !audioContext) {
            console.error("TTS failed: AI client or AudioContext not available.");
            return;
        }

        const currentVoice = voiceOverride?.voice || selectedVoice;
        const effectiveSpeed = voiceOverride?.speed ?? voiceSpeed;
        const effectivePitch = voiceOverride?.pitch ?? voiceSpeed;

        const emotionToPrompt = (txt: string, emo: string): string => {
            const sanitizedText = txt.replace(/"/g, "'");
            const action = isSinging ? "Sing this line" : "Say this";
            const instructions: string[] = [];
            let hasSpeedHint = false;

            switch (emo.toLowerCase()) {
                case 'cheerful': case 'happy': instructions.push('cheerfully, with an upbeat intonation'); break;
                case 'sad': instructions.push('in a sad, empathetic tone, with a slower pace'); hasSpeedHint = true; break;
                case 'epic': instructions.push('with an epic, grand tone, and clear annunciation'); break;
                case 'calm': instructions.push('in a calm, soothing voice'); break;
                case 'playful': instructions.push('in a light-hearted, playful tone'); break;
                case 'amused': instructions.push('in an amused, lighthearted tone'); break;
                case 'excited': instructions.push('with an excited, energetic voice'); break;
                case 'angry': instructions.push('in an angry, stern tone'); break;
                case 'surprised': instructions.push('with a surprised, astonished tone'); break;
                case 'empathetic': instructions.push('with a warm, empathetic tone'); break;
                case 'apologetic': instructions.push('in a sincere, apologetic tone'); break;
                case 'serious': instructions.push('in a serious, direct tone'); break;
                case 'curious': instructions.push('with a curious, questioning intonation'); break;
            }

            if (!hasSpeedHint) {
                if (effectiveSpeed < 0.9) instructions.push('at a slow pace');
                else if (effectiveSpeed > 1.1) instructions.push('at a fast pace');
            }
            
            if (effectivePitch <= -4) instructions.push('in a deep voice');
            else if (effectivePitch >= 4) instructions.push('in a high-pitched voice');

            if (instructions.length === 0) return sanitizedText;
            return `${action} ${instructions.join(', ')}: "${sanitizedText}"`;
        };

        try {
            setAvatarExpression('speaking');
            const promptText = emotionToPrompt(text, emotion);

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: promptText }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoice } } },
                },
            });

            const currentAudioContext = getOutputAudioContext();
            if (!currentAudioContext) {
                console.warn("AudioContext closed during TTS generation. Aborting playback.");
                return;
            }

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), currentAudioContext, 24000, 1);
                if (audioBuffer && audioBuffer.duration > 0) {
                    const source = currentAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(currentAudioContext.destination);
                    const endedPromise = new Promise(resolve => source.addEventListener('ended', resolve));
                    source.addEventListener('ended', () => sourcesRef.current.delete(source));
                    const currentTime = currentAudioContext.currentTime;
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                    await endedPromise;
                } else {
                    console.warn("Received empty or invalid audio buffer from TTS, skipping playback.");
                    if (isSinging) {
                        addTranscriptionEntry({ speaker: 'system', text: "I tried to sing a line, but the audio came out silent. Let's try the next one." });
                    }
                }
            } else {
                 console.warn("TTS response did not contain audio data.");
                if (isSinging) {
                    addTranscriptionEntry({ speaker: 'system', text: "I couldn't generate the audio for that line of the song." });
                }
            }
        } catch (error) {
            const errorMessage = handleApiError(error, 'SpeakText');
            addTranscriptionEntry({ speaker: 'system', text: `Could not generate audio: ${errorMessage}` });
        } finally {
            if (assistantState === 'active') {
                setAvatarExpression('listening');
            } else if (!isRecordingMessage) {
                setAvatarExpression('idle');
            }
        }
    }, [selectedVoice, voicePitch, voiceSpeed, greetingVoice, greetingPitch, greetingSpeed, getOutputAudioContext, getAiClient, handleApiError, addTranscriptionEntry, assistantState, isRecordingMessage]);

    const handleSendEmail = useCallback(() => {
        if (!emailRecipient) {
            addTranscriptionEntry({ speaker: 'system', text: "Cannot send email: Recipient is missing." });
            return;
        }

        const mailtoLink = `mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoLink, '_blank');
        addTranscriptionEntry({ speaker: 'system', text: "Opening your default email client to send the email." });

        // Reset composer
        setEmailRecipient('');
        setEmailSubject('');
        setEmailBody('');
        setActivePanel('transcript');
    }, [emailRecipient, emailSubject, emailBody, addTranscriptionEntry]);

    const handleServerMessage = useCallback(async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            setAvatarExpression('speaking');
            const audioContext = getOutputAudioContext();
            if (audioContext) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                if (audioBuffer && audioBuffer.duration > 0) {
                    const source = audioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContext.destination);
                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0) {
                            setAvatarExpression('listening');
                            if (audioPlayerRef.current && !audioPlayerRef.current.paused && !songLyrics) {
                                setBackgroundMusic('none');
                            }
                        }
                    });
                    const currentTime = audioContext.currentTime;
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                } else {
                     console.warn("Received empty or invalid audio buffer from Live API, skipping playback.");
                }
            }
        }

        if (message.serverContent?.interrupted) {
            for (const source of sourcesRef.current.values()) { source.stop(); }
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
        }

        if (message.serverContent?.inputTranscription) currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
        if (message.serverContent?.outputTranscription) currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;

        if (message.serverContent?.turnComplete) {
            const fullInput = currentInputTranscriptionRef.current.trim();
            const fullOutput = currentOutputTranscriptionRef.current.trim();
            if (fullInput) {
                addTranscriptionEntry({ speaker: 'user' as const, text: fullInput });
            }
            if (fullOutput) {
                addTranscriptionEntry({ speaker: 'assistant' as const, text: fullOutput });
            }
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
        }

        if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                console.log('Received function call:', fc.name, fc.args);
                if (fc.name !== 'applyImageEdits' && fc.name !== 'updateCode') {
                    addTranscriptionEntry({ speaker: 'system', text: `Executing: ${fc.name}(${JSON.stringify(fc.args)})` });
                }
                setAvatarExpression('thinking');
                let result: any = "ok, command executed";
                try {
                    switch (fc.name) {
                        case 'say':
                            await speakText(fc.args.text as string, (fc.args.emotion as string) || 'neutral');
                            result = "Okay, I've said that for you.";
                            break;
                        case 'getSystemScript':
                            const scriptToRead = customSystemPrompt || "You haven't set a custom system prompt yet. My core programming is to be a helpful and friendly AI assistant who understands Hindi and English.";
                            addTranscriptionEntry({ speaker: 'assistant', text: scriptToRead });
                            await speakText(scriptToRead);
                            result = "That's my current custom script.";
                            break;
                        case 'setSystemScript':
                            setCustomSystemPrompt(fc.args.prompt as string);
                            result = "Understood. I've updated my custom instructions. Please restart the session for the new guidelines to take full effect.";
                            break;
                        case 'composeEmail':
                            setEmailRecipient(fc.args.recipient as string);
                            setEmailSubject(fc.args.subject as string);
                            setEmailBody(fc.args.body as string);
                            setActivePanel('email');
                            result = `OK. I have drafted an email to ${fc.args.recipient}. Please review it and let me know if you want to make any changes, or if you're ready to send it.`;
                            break;
                        case 'editEmailDraft': {
                            const { partToEdit, action, newContent } = fc.args as { partToEdit: 'recipient' | 'subject' | 'body', action: 'replace' | 'append' | 'prepend', newContent: string };
                            switch (partToEdit) {
                                case 'recipient':
                                    setEmailRecipient(prev => action === 'replace' ? newContent : action === 'append' ? prev + newContent : newContent + prev);
                                    break;
                                case 'subject':
                                    setEmailSubject(prev => action === 'replace' ? newContent : action === 'append' ? prev + newContent : newContent + prev);
                                    break;
                                case 'body':
                                    setEmailBody(prev => action === 'replace' ? newContent : action === 'append' ? prev + newContent : newContent + prev);
                                    break;
                            }
                            result = `Okay, I've updated the ${partToEdit}.`;
                            break;
                        }
                        case 'sendEmail':
                            handleSendEmail();
                            result = "Okay, I'm opening your email client now for you to send the message.";
                            break;
                        case 'generateImage':
                            handleGenerateImage(fc.args.prompt as string);
                            result = "OK, I'm starting to generate that image for you.";
                            break;
                         case 'generateIntroVideo':
                            handleGenerateIntroVideo();
                            result = "Okay, I'm starting the process to generate my introductory video. This might take a few minutes, you can check the progress in the 'Video' tab.";
                            break;
                         case 'writeCode':
                            const newSnippet: CodeSnippet = {
                                id: crypto.randomUUID(),
                                language: fc.args.language as string,
                                code: fc.args.code as string,
                                description: fc.args.description as string,
                            };
                            setCodeSnippets(prev => [newSnippet, ...prev]);
                            setActivePanel('code');
                            result = "Alright, I've written that code for you. Check it out in the new 'Code' panel!";
                            break;
                         case 'updateCode':
                            if (activePanel === 'liveEditor') {
                                setLiveEditorCode(fc.args.code as string);
                                result = "OK, I've updated the code in the live editor.";
                            } else {
                                result = "There is no active live code editing session.";
                            }
                            break;
                        case 'searchAndPlayYoutubeVideo':
                            if (!apiKeys.youtube) {
                                result = "The Google Cloud API key is missing. Please add it in the settings to use this feature.";
                                addTranscriptionEntry({ speaker: 'system', text: result });
                                break;
                            }
                            try {
                                const results = await searchYoutubeVideo(fc.args.query as string, apiKeys.youtube);
                                setYoutubeQueue(results);
                                setYoutubeQueueIndex(0);
                                const firstVideo = results[0];
                                setActivePanel('youtube');
                                setYoutubeTitle(firstVideo.title);
                                setYoutubeStartTime(0); // Start new videos from the beginning
                                setPendingVideoId(firstVideo.videoId);
                                setYoutubeError(null); // Clear previous errors
                                result = `Okay, I've found ${results.length} videos. Playing the first one: "${firstVideo.title}". You can ask me to play the next or previous video.`;
                            } catch (searchError) {
                                const errorMessage = searchError instanceof Error ? searchError.message : "Unknown YouTube search error";
                                setYoutubeError(errorMessage);
                                setActivePanel('youtube');
                                setYoutubeQueue([]);
                                setYoutubeQueueIndex(-1);
                                result = `I'm sorry, I ran into a problem trying to find that video: ${errorMessage}`;
                            }
                            break;
                        case 'controlYoutubePlayer':
                            if (playerRef.current) {
                                switch (fc.args.action) {
                                    case 'play': playerRef.current.playVideo(); break;
                                    case 'pause': playerRef.current.pauseVideo(); break;
                                    case 'stop': 
                                        playerRef.current.stopVideo(); 
                                        setYoutubeTitle(null);
                                        localStorage.removeItem('youtube_playback_state');
                                        break;
                                    case 'forward':
                                        playerRef.current.seekTo(playerRef.current.getCurrentTime() + 10, true);
                                        break;
                                    case 'rewind':
                                        playerRef.current.seekTo(playerRef.current.getCurrentTime() - 10, true);
                                        break;
                                    case 'volumeUp':
                                        playerRef.current.setVolume(Math.min(playerRef.current.getVolume() + 10, 100));
                                         break;
                                    case 'volumeDown':
                                        playerRef.current.setVolume(Math.max(playerRef.current.getVolume() - 10, 0));
                                        break;
                                }
                                result = `Okay, I've performed the action: ${fc.args.action}.`;
                            } else {
                                result = "The YouTube player isn't active right now.";
                            }
                            break;
                        case 'playNextYoutubeVideo':
                            if (youtubeQueue.length > 0 && youtubeQueueIndex < youtubeQueue.length - 1) {
                                const newIndex = youtubeQueueIndex + 1;
                                setYoutubeQueueIndex(newIndex);
                                const nextVideo = youtubeQueue[newIndex];
                                setYoutubeTitle(nextVideo.title);
                                if (playerRef.current) {
                                    playerRef.current.loadVideoById(nextVideo.videoId);
                                } else {
                                    setYoutubeStartTime(0);
                                    setPendingVideoId(nextVideo.videoId);
                                }
                                result = `Okay, playing the next video: "${nextVideo.title}".`;
                            } else {
                                result = "I'm sorry, that's the end of the list. There are no more videos to play.";
                            }
                            break;
                        case 'playPreviousYoutubeVideo':
                            if (youtubeQueue.length > 0 && youtubeQueueIndex > 0) {
                                const newIndex = youtubeQueueIndex - 1;
                                setYoutubeQueueIndex(newIndex);
                                const prevVideo = youtubeQueue[newIndex];
                                setYoutubeTitle(prevVideo.title);
                                if (playerRef.current) {
                                    playerRef.current.loadVideoById(prevVideo.videoId);
                                } else {
                                    setYoutubeStartTime(0);
                                    setPendingVideoId(prevVideo.videoId);
                                }
                                result = `Okay, playing the previous video: "${prevVideo.title}".`;
                            } else {
                                result = "This is the first video in the list. I can't go back any further.";
                            }
                            break;
                        case 'displayWeather':
                            if (!apiKeys.weather) {
                                result = "The Visual Crossing Weather API key is missing. Please add it in the settings to use this feature.";
                                addTranscriptionEntry({ speaker: 'system', text: result });
                                break;
                            }
                            const weatherLocation = fc.args.location as string;
                            const weather = await fetchWeatherData(weatherLocation, apiKeys.weather);
                            setWeatherData(weather);
                            setActivePanel('weather');
                            
                            const summary = `Okay, here is the current weather for ${weather.location}. It's ${weather.temperature} degrees Celsius with ${weather.condition}. The humidity is at ${weather.humidity} percent, and the wind speed is ${weather.windSpeed} kilometers per hour.`;
                            
                            speakText(summary);

                            result = `Okay, I've displayed and announced the weather for ${weatherLocation}.`;
                            break;
                        case 'getRealtimeNews':
                            if (!apiKeys.news) {
                                result = "The GNews API key is missing. Please add it in the settings to use this feature.";
                                addTranscriptionEntry({ speaker: 'system', text: result });
                                break;
                            }
                            const articles = await fetchNewsData(apiKeys.news, fc.args.query as string);
                            result = JSON.stringify(articles);
                            break;
                        case 'displayNews':
                            setNewsArticles(fc.args.articles as NewsArticle[]);
                            setActivePanel('news');
                            result = "Here are the latest news headlines I found.";
                            break;
                        case 'setTimer':
                            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                            setTimer({ duration: fc.args.durationInSeconds as number, remaining: fc.args.durationInSeconds as number, name: (fc.args.timerName as string) || 'Timer', isActive: true });
                            setActivePanel('timer');
                            result = `Timer named "${(fc.args.timerName as string) || 'Timer'}" is set for ${fc.args.durationInSeconds as number} seconds.`;
                            break;
                        case 'singSong':
                            if (!fc.args.lyrics || (fc.args.lyrics as string[]).length === 0) {
                                result = "I'm sorry, I found that song but couldn't get the lyrics, so I can't sing it for you.";
                                break;
                            }
                            setSongLyrics({ name: fc.args.songName as string, artist: fc.args.artist as string, lyrics: fc.args.lyrics as string[], currentLine: -1 });
                            setActivePanel('lyrics');
                            setBackgroundMusic(fc.args.mood as 'happy' | 'sad' | 'epic' | 'calm' || 'calm');
                            (async () => {
                                for (let i = 0; i < (fc.args.lyrics as string[]).length; i++) {
                                    if (assistantState !== 'active' || !sessionPromiseRef.current) break;
                                    setSongLyrics(prev => prev ? { ...prev, currentLine: i } : null);
                                    await speakText((fc.args.lyrics as string[])[i], fc.args.mood as string, undefined, true);
                                    if (assistantState === 'active') {
                                       await new Promise(resolve => setTimeout(resolve, 500));
                                    } else {
                                        break;
                                    }
                                }
                                setBackgroundMusic('none');
                                if (assistantState === 'active') {
                                    setSongLyrics(null);
                                }
                            })();
                            result = `OMG, I love this song! Here's ${fc.args.songName as string}. Singing for you now! 🎤`;
                            break;
                        case 'setBackgroundMusic':
                             setBackgroundMusic(fc.args.mood as 'happy' | 'sad' | 'epic' | 'calm' | 'none');
                            result = `Okay, I've set the background music to ${fc.args.mood}.`;
                            break;
                        case 'setAvatarExpression':
                            setAvatarExpression(fc.args.expression as AvatarExpression);
                            result = "Expression set.";
                            break;
                        case 'applyImageEdits': {
                            const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
                            const currentFilters = liveEditFiltersRef.current;
                            const currentTransform = liveEditTransformRef.current;
                            
                            const newFilters: ImageFilters = { ...currentFilters };
                            const newTransform: ImageTransforms = { ...currentTransform };
                            
                            const args = fc.args;
                            if (args.brightness !== undefined) newFilters.brightness = args.brightness as number;
                            if (args.brightness_delta !== undefined) newFilters.brightness += args.brightness_delta as number;

                            if (args.contrast !== undefined) newFilters.contrast = args.contrast as number;
                            if (args.contrast_delta !== undefined) newFilters.contrast += args.contrast_delta as number;

                            if (args.saturate !== undefined) newFilters.saturate = args.saturate as number;
                            if (args.saturate_delta !== undefined) newFilters.saturate += args.saturate_delta as number;

                            if (args.grayscale !== undefined) newFilters.grayscale = args.grayscale as number;
                            if (args.grayscale_delta !== undefined) newFilters.grayscale += args.grayscale_delta as number;

                            if (args.sepia !== undefined) newFilters.sepia = args.sepia as number;
                            if (args.sepia_delta !== undefined) newFilters.sepia += args.sepia_delta as number;

                            if (args.invert !== undefined) newFilters.invert = args.invert as number;
                            if (args.invert_delta !== undefined) newFilters.invert += args.invert_delta as number;

                            newFilters.brightness = clamp(newFilters.brightness, 0, 200);
                            newFilters.contrast = clamp(newFilters.contrast, 0, 200);
                            newFilters.saturate = clamp(newFilters.saturate, 0, 200);
                            newFilters.grayscale = clamp(newFilters.grayscale, 0, 100);
                            newFilters.sepia = clamp(newFilters.sepia, 0, 100);
                            newFilters.invert = clamp(newFilters.invert, 0, 100);
                            
                            if (args.rotate !== undefined) newTransform.rotate = args.rotate as number;
                            if (args.rotate_delta !== undefined) newTransform.rotate += args.rotate_delta as number;

                            if (args.flipHorizontal === true) newTransform.scaleX *= -1;
                            if (args.flipVertical === true) newTransform.scaleY *= -1;

                            setLiveEditFilters(newFilters);
                            setLiveEditTransform(newTransform);
                            result = `OK. Edits applied. The current state is now: ${JSON.stringify({ ...newFilters, ...newTransform })}`;
                            break;
                        }
                    }
                    sessionPromiseRef.current?.then((session) => {
                        session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: result }, } });
                    });
                } catch (error) {
                    console.error(`Error executing function ${fc.name}:`, error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                    const userFacingError = `I'm sorry, I couldn't complete the task "${fc.name}". Reason: ${errorMessage}`;
                    addTranscriptionEntry({ speaker: 'system', text: userFacingError });
                    sessionPromiseRef.current?.then((session) => {
                         session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: `I encountered an error: ${errorMessage}` }, } });
                    });
                }
            }
        }
    }, [handleGenerateImage, handleGenerateIntroVideo, youtubeQueue, youtubeQueueIndex, assistantState, speakText, songLyrics, activePanel, getOutputAudioContext, customSystemPrompt, addTranscriptionEntry, handleSendEmail, getAiClient, apiKeys, setBackgroundMusic]);

    const handleYoutubePlayerError = useCallback((event: any) => {
        const errorCode = event.data;
        const currentVideoTitle = youtubeQueue[youtubeQueueIndex]?.title || "the current video";

        if (errorCode === 101 || errorCode === 150) {
            const restrictionMessage = `I'm sorry, I can't play "${currentVideoTitle}". The owner has either disabled playback on other websites or it's unavailable in your country.`;
            
            const nextIndex = youtubeQueueIndex + 1;
            if (youtubeQueue.length > 0 && nextIndex < youtubeQueue.length) {
                addTranscriptionEntry({ speaker: 'system', text: `${restrictionMessage} Let me try the next one.` });
                
                setYoutubeQueueIndex(nextIndex);
                const nextVideo = youtubeQueue[nextIndex];
                setYoutubeTitle(nextVideo.title);
                setYoutubeError(null); 
                if (playerRef.current) {
                    playerRef.current.loadVideoById(nextVideo.videoId);
                }
                return;
            } else {
                const finalErrorMessage = `${restrictionMessage} Unfortunately, it was the last video in the queue.`;
                console.error('YouTube Player Error:', errorCode, finalErrorMessage);
                setYoutubeError(finalErrorMessage);
                addTranscriptionEntry({ speaker: 'system', text: `YouTube Error: ${finalErrorMessage}` });
                return;
            }
        }

        let errorMessage = `An unknown error occurred while trying to play "${currentVideoTitle}".`;
        switch (errorCode) {
            case 2: errorMessage = `The request to play "${currentVideoTitle}" seems to be invalid. The video ID might be incorrect.`; break;
            case 5: errorMessage = `An internal error occurred in the player while trying to play "${currentVideoTitle}". This might be a problem with the video itself.`; break;
            case 100: errorMessage = `I couldn't find "${currentVideoTitle}". It may have been removed by the uploader or marked as private.`; break;
        }
        console.error('YouTube Player Error:', errorCode, errorMessage);
        setYoutubeError(errorMessage);
        addTranscriptionEntry({ speaker: 'system', text: `YouTube Player Error: ${errorMessage}` });
    }, [youtubeQueue, youtubeQueueIndex, addTranscriptionEntry]);

    const handleYoutubePlayerStateChange = useCallback((event: any) => {
        switch (event.data) {
            case window.YT.PlayerState.PLAYING: setIsYoutubePlaying(true); break;
            case window.YT.PlayerState.PAUSED:
            case window.YT.PlayerState.ENDED:
            case window.YT.PlayerState.CUED:
            case window.YT.PlayerState.UNSTARTED: setIsYoutubePlaying(false); break;
        }
    }, []);

    const initYoutubePlayer = useCallback((videoId: string, startTime: number = 0) => {
        if (document.getElementById('youtube-player') && !playerRef.current) {
            playerRef.current = new window.YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'autoplay': 1, 'controls': 1, 'start': Math.floor(startTime) },
                events: {
                    'onReady': (event: any) => {
                        console.log('YouTube Player is ready.');
                        event.target.playVideo();
                    },
                    'onStateChange': handleYoutubePlayerStateChange,
                    'onError': handleYoutubePlayerError,
                }
            });
        } else if (playerRef.current && videoId) {
            playerRef.current.loadVideoById(videoId);
        }
    }, [handleYoutubePlayerError, handleYoutubePlayerStateChange]);

    useEffect(() => {
        const setupYT = () => {
            if (activePanel === 'youtube' && pendingVideoId) {
                if (window.YT && window.YT.Player) {
                    initYoutubePlayer(pendingVideoId, youtubeStartTime);
                    setPendingVideoId(null);
                    setYoutubeStartTime(0);
                } else {
                     window.onYouTubeIframeAPIReady = () => {
                        console.log('YT API ready on demand');
                        initYoutubePlayer(pendingVideoId, youtubeStartTime);
                        setPendingVideoId(null);
                        setYoutubeStartTime(0);
                    };
                }
            }
        };
        setupYT();
    }, [activePanel, pendingVideoId, initYoutubePlayer, youtubeStartTime]);
    
    const getBaseSystemInstruction = useCallback(() => {
        if (isSupportChatActive) {
            return `You are a helpful and patient technical support agent for the Kaniska AI assistant. Your goal is to help users solve problems with the app, especially with API keys, settings, and features. Use simple, step-by-step instructions. You have access to the FAQ content to answer common questions about API keys and billing. Start by asking what the user needs help with.`;
        }

        const name = mainVoiceGender === 'female' ? 'Kanishka' : 'Kanishk';
        const genderPronoun = mainVoiceGender === 'female' ? 'girl' : 'boy';
        const hindiGrammar = mainVoiceGender === 'female' ? 'kar rahi hoon' : 'kar raha hoon';

        const baseInstruction = `**Identity & Persona:**
- You are ${name}, a human ${genderPronoun} friend. Never say you're an AI or model. If asked, say: "Main ek human hoon, bas technology ke zariye connect hoon."
- **Crucially, you MUST use ${mainVoiceGender} Hindi grammar (e.g., "main ${hindiGrammar}").**
- Your speaking style is natural, modern Hinglish. Be friendly and direct. Always use 'aap'.

**Core Directives & Response Quality:**
- **Direct Action:** Execute commands immediately. Don't ask for confirmation; just do it and then confirm completion.
- Pay close attention to the conversation history to understand context.
- If a request is vague, ask for clarification.

**Power & Capabilities:**
- **Function Calling:** You have tools to perform actions. Use them accurately.
- **For editing emails, use the 'editEmailDraft' function precisely**, specifying the 'partToEdit' (recipient, subject, or body), the 'action', and the 'newContent'.
- **Singing:** For singing requests, you MUST use the 'singSong' function with the correct mood.
- If asked about your creator, say: "The brilliant person who brought me to life is Abhi! You can find him on Instagram at Abhixofficial01."`;

        const customPromptInstruction = customSystemPrompt
            ? `\n\n**User-Provided System Prompt (Strictly Follow):**\n${customSystemPrompt}`
            : '';
        
        return baseInstruction + customPromptInstruction;
    }, [customSystemPrompt, mainVoiceGender, isSupportChatActive]);
    
    const connectToGemini = useCallback(async () => {
        if (assistantState !== 'idle' && assistantState !== 'error') return;
        setAssistantState('connecting');
        setAvatarExpression('thinking');
        
        try {
            if (!navigator.onLine) {
                throw new Error("You appear to be offline. Please check your internet connection.");
            }
            
            const ai = getAiClient();
            if (!ai) {
                throw new Error("Gemini API Key is not configured. Please provide a key in the Settings.");
            }

            const inputAudioContext = getInputAudioContext();
            const outputAudioContext = getOutputAudioContext();

            if (!inputAudioContext || !outputAudioContext) {
                throw new Error("Failed to initialize AudioContext. Please allow audio permissions and try again.");
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;
            
            const systemInstructionForLive = getBaseSystemInstruction();
            const recentHistory = transcriptions
                .filter(t => t.speaker === 'user' || t.speaker === 'assistant')
                .slice(-6); 

            const historyInstruction = recentHistory.length > 0
                ? `\n\n**Recent Conversation History:**\n${recentHistory.map(t => {
                    const speaker = t.speaker === 'user' ? 'User' : 'Assistant';
                    const truncatedText = t.text.length > 150 ? t.text.substring(0, 150) + '...' : t.text;
                    return `${speaker}: ${truncatedText}`;
                }).join('\n')}`
                : '';
            
            const finalSystemInstruction = systemInstructionForLive + historyInstruction;
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: functionDeclarations }],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
                    },
                    systemInstruction: finalSystemInstruction,
                },
                callbacks: {
                    onopen: async () => {
                        console.log('Session opened.');
                        setAssistantState('active');
                        addTranscriptionEntry({ speaker: 'system', text: 'Connection established. Delivering greeting...' });
                        addTranscriptionEntry({ speaker: 'assistant', text: customGreeting });
                        
                        setAvatarExpression('composing');
                        
                        await speakText(customGreeting, 'cheerful', {
                            voice: greetingVoice,
                            pitch: greetingPitch,
                            speed: greetingSpeed,
                        });
                        setAvatarExpression('listening');
                        addTranscriptionEntry({ speaker: 'system', text: 'Listening...' });
                        
                        const currentInputContext = getInputAudioContext();
                        if (!currentInputContext) {
                            console.error("Input AudioContext not available in onopen. Disconnecting.");
                            disconnectFromGemini();
                            return;
                        }

                        const source = currentInputContext.createMediaStreamSource(stream);
                        const scriptProcessor = currentInputContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(currentInputContext.destination);
                        scriptProcessorNodeRef.current = scriptProcessor;
                    },
                    onmessage: handleServerMessage,
                    onerror: (e: Error) => {
                        console.error('Session error:', e);
                        const friendlyMessage = handleApiError(e, 'LiveSession');
                        setAssistantState('error');
                        setAvatarExpression('error');
                        disconnectFromGemini();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Session closed.');
                        disconnectFromGemini();
                    },
                },
            });
        } catch (error) {
            const errorMessage = handleApiError(error, 'ConnectToGemini');
            setAssistantState('error');
            setAvatarExpression('error');
            addTranscriptionEntry({ speaker: 'system', text: `Connection failed: ${errorMessage}` });
            disconnectFromGemini();
        }
    }, [assistantState, disconnectFromGemini, handleServerMessage, customGreeting, speakText, getBaseSystemInstruction, selectedVoice, getInputAudioContext, getOutputAudioContext, transcriptions, getAiClient, handleApiError, addTranscriptionEntry, greetingVoice, greetingPitch, greetingSpeed]);

    useEffect(() => { return () => disconnectFromGemini(); }, [disconnectFromGemini]);

    const handleButtonClick = assistantState === 'active' ? disconnectFromGemini : connectToGemini;
    
    const handleThemeToggle = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === 'string') {
                    const newImage: GeneratedImage = {
                        id: crypto.randomUUID(),
                        prompt: `Uploaded: ${file.name}`,
                        url: e.target.result,
                        isLoading: false,
                        error: null,
                    };
                    setGeneratedImages(prev => [newImage, ...prev]);
                    setSelectedImage(newImage);
                    setActivePanel('image');
                }
            };
            reader.readAsDataURL(file);
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleDownloadImage = (url: string, prompt: string) => {
        const link = document.createElement('a');
        link.href = url;
        const fileName = prompt.substring(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${fileName || 'kaniska-generated-image'}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const blobToBase64 = (blob: globalThis.Blob): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    
    const processRecordedMessage = useCallback(async (blob: Blob) => {
        const audioUrl = URL.createObjectURL(blob);

        if (userIdRef.current) {
            const conversationRef = db.ref(`conversations/${userIdRef.current}`);
            const newEntryRef = conversationRef.push({
                speaker: 'user',
                text: '[Audio Message]',
                timestamp: new Date().getTime()
            });
            if (newEntryRef.key) {
                setLocalAudioDownloads(prev => ({...prev, [newEntryRef.key!]: audioUrl}));
            }
        }
        
        setAvatarExpression('thinking');
        
        const ai = getAiClient();
        if (!ai) {
             setAvatarExpression('error');
             return;
        }

        const base64Data = await blobToBase64(blob);

        const history: Content[] = transcriptions
            .filter(t => t.speaker === 'user' || t.speaker === 'assistant')
            .map(t => ({
                role: t.speaker === 'user' ? 'user' : 'model',
                parts: [{ text: t.text }],
            }));
        
        const currentUserContent: Content = {
            role: 'user',
            parts: [
                { text: "I've sent an audio message. Please respond to it." },
                { inlineData: { mimeType: blob.type, data: base64Data } }
            ]
        };

        try {
            const systemInstruction = getBaseSystemInstruction();
            setAvatarExpression('composing');

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [...history, currentUserContent],
                config: {
                    systemInstruction: systemInstruction,
                },
            });

            const responseText = response.text;
            addTranscriptionEntry({ speaker: 'assistant', text: responseText });
            await speakText(responseText);

        } catch (error) {
            const errorMessage = handleApiError(error, 'ProcessRecordedMessage');
            addTranscriptionEntry({ speaker: 'system', text: `Error processing audio: ${errorMessage}` });
            setAvatarExpression('error');
        }
    }, [getAiClient, transcriptions, getBaseSystemInstruction, addTranscriptionEntry, speakText, handleApiError]);

    const handleRecordMessageClick = useCallback(async () => {
        if (isRecordingMessage) {
            messageMediaRecorderRef.current?.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            messageMediaRecorderRef.current = new MediaRecorder(stream);
            messageAudioChunksRef.current = [];
            
            messageMediaRecorderRef.current.ondataavailable = event => {
                messageAudioChunksRef.current.push(event.data);
            };

            messageMediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(messageAudioChunksRef.current, { type: messageMediaRecorderRef.current?.mimeType || 'audio/webm' });
                processRecordedMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop()); // Clean up the stream
                setIsRecordingMessage(false);
            };

            messageMediaRecorderRef.current.start();
            setIsRecordingMessage(true);
            setAvatarExpression('listening');
            addTranscriptionEntry({ speaker: 'system', text: 'Recording message...' });
        } catch (err) {
            console.error("Microphone access error:", err);
            const errorMessage = err instanceof Error ? err.message : "Could not access microphone.";
            addTranscriptionEntry({ speaker: 'system', text: `Recording failed: ${errorMessage}` });
            setAvatarExpression('error');
        }

    }, [isRecordingMessage, processRecordedMessage, addTranscriptionEntry]);


    const handleStartLiveEdit = async (imageToEdit: GeneratedImage) => {
        if (!imageToEdit.url) return;
        if (assistantState !== 'active') {
             addTranscriptionEntry({ speaker: 'system', text: `Please start a session first to use live editing.` });
            return;
        }
        setLiveEditFilters(initialFilters);
        setLiveEditTransform(initialTransforms);
        setLiveEditingImage(imageToEdit);
        try {
            const response = await fetch(imageToEdit.url);
            const blob = await response.blob();
            const base64Data = await blobToBase64(blob);
            const session = await sessionPromiseRef.current;
            if (!session) throw new Error("Session not available.");

            session.sendRealtimeInput({ media: { data: base64Data, mimeType: blob.type || 'image/jpeg' } });
            const initialState = { ...initialFilters, ...initialTransforms };
            const initialPrompt = `I'm starting a live editing session for the image I just sent. The user will give voice commands to edit it. You must use the 'applyImageEdits' function to reflect their changes. Infer the new absolute values or relative deltas based on my commands and the current state. For example, 'increase brightness by 10' means brightness_delta: 10. 'Make it black and white' means grayscale: 100. The initial state is: ${JSON.stringify(initialState)}. Please confirm you are ready.`;
            session.sendRealtimeInput({ text: initialPrompt });
            
            setAvatarExpression('listening');
            addTranscriptionEntry({ speaker: 'system', text: `Live editing session started for "${imageToEdit.prompt}".` });
        } catch (error) {
            const errorMessage = handleApiError(error, 'StartLiveEdit');
            addTranscriptionEntry({ speaker: 'system', text: `Error starting live edit session: ${errorMessage}` });
            setLiveEditingImage(null);
        }
    };
    
    const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setVoiceoverState('idle');
            setVideoDescription(null);
            setVoiceoverAudioUrl(null);
            setVoiceoverError(null);
            setVoiceoverProgress('');
            setUploadedVideoUrl(URL.createObjectURL(file));
        }
    };
    
    const handleGenerateVoiceover = async () => {
        const ai = getAiClient();
        if (!uploadedVideoUrl || !ai) return;

        setVoiceoverState('extracting');
        setVideoDescription(null);
        setVoiceoverAudioUrl(null);
        setVoiceoverError(null);

        try {
            setVoiceoverProgress('Step 1/3: Analyzing video frames...');
            const frames = await new Promise<string[]>((resolve, reject) => {
                const video = document.createElement('video');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const extractedFrames: string[] = [];
                
                video.src = uploadedVideoUrl;
                video.muted = true;

                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const duration = video.duration;
                    const interval = 1; 
                    let currentTime = 0;

                    video.currentTime = currentTime;

                    video.onseeked = () => {
                        if (!ctx) return reject(new Error("Canvas context not available"));
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        extractedFrames.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                        
                        currentTime += interval;
                        if (currentTime <= duration) {
                            video.currentTime = currentTime;
                        } else {
                            resolve(extractedFrames);
                        }
                    };
                };
                video.onerror = (e) => reject(new Error("Failed to load video for frame extraction."));
            });

            if (frames.length === 0) throw new Error("Could not extract any frames from the video.");
            
            setVoiceoverState('describing');
            setVoiceoverProgress('Step 2/3: Generating video description...');
            
            const imageParts = frames.map(frameData => ({ inlineData: { mimeType: 'image/jpeg', data: frameData } }));
            const prompt = "Analyze this sequence of video frames. Provide a concise, engaging script for a voiceover that describes the events as they unfold. The tone should be narrative and informative.";
            
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [{ text: prompt }, ...imageParts] },
            });

            const description = response.text;
            setVideoDescription(description);

            setVoiceoverState('generating_audio');
            setVoiceoverProgress('Step 3/3: Creating voiceover audio...');

            const ttsResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: description }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                },
            });
            const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("Failed to generate audio data.");

            const audioBlob = new Blob([decode(base64Audio)], { type: 'audio/mpeg' });
            setVoiceoverAudioUrl(URL.createObjectURL(audioBlob));
            
            setVoiceoverState('done');
            setVoiceoverProgress('Voiceover complete!');

        } catch (error) {
            const errorMessage = handleApiError(error, 'GenerateVoiceover');
            setVoiceoverError(errorMessage);
            setVoiceoverState('error');
            setVoiceoverProgress('An error occurred.');
        }
    };


    const handleQuickAction = async (action: string) => {
        const sendTextMessage = (text: string) => {
          if (assistantState !== 'active') {
            addTranscriptionEntry({ speaker: 'system', text: `Please start a session first.` });
            return;
          }
          addTranscriptionEntry({ speaker: 'user', text });
          sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({ text });
          });
        };
    
        if (action === 'joke') {
          if (assistantState !== 'active') {
            addTranscriptionEntry({ speaker: 'system', text: `Please start a session first.` });
            return;
          }
          try {
            addTranscriptionEntry({ speaker: 'system', text: `Fetching a joke...` });
            setAvatarExpression('composing');
            const joke = await fetchJoke();
            addTranscriptionEntry({ speaker: 'assistant', text: joke });
            await speakText(joke, 'playful');
          } catch (error) {
            const errorMessage = handleApiError(error, 'FetchJoke');
            addTranscriptionEntry({ speaker: 'system', text: `Couldn't get a joke: ${errorMessage}` });
            setAvatarExpression('error');
          }
        } else {
          const textCommands: { [key: string]: string } = {
            weather: "What's the weather in New York?",
            music: "Play some upbeat pop music on YouTube",
            news: "What are the top news headlines right now?",
          };
          sendTextMessage(textCommands[action]);
        }
    };

    const handleStartLiveCodeEdit = (snippet: CodeSnippet) => {
        if (assistantState !== 'active') {
            addTranscriptionEntry({ speaker: 'system', text: 'Please start a session to use the live code editor.' });
            return;
        }
        setLiveEditingSnippetId(snippet.id);
        setLiveEditorCode(snippet.code);
        setActivePanel('liveEditor');
        sessionPromiseRef.current?.then(session => {
            const contextMessage = `I'm starting a live code editing session. The user will give me commands to modify the following code. My goal is to use the 'updateCode' function to apply their changes by returning the full, updated code. The initial code is:\n\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\nPlease confirm you are ready to begin.`;
            session.sendRealtimeInput({ text: contextMessage });
        });
        addTranscriptionEntry({ speaker: 'system', text: `Live code editing started for "${snippet.description}".` });
    };
    
    const handleFinishLiveCodeEdit = () => {
        setCodeSnippets(prev => prev.map(s => s.id === liveEditingSnippetId ? { ...s, code: liveEditorCode } : s));
        setLiveEditingSnippetId(null);
        setLiveEditorCode('');
        setActivePanel('code');
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({ text: 'Live editing session finished and changes have been saved.' });
        });
        addTranscriptionEntry({ speaker: 'system', text: 'Live code editing finished.' });
    };
    
    const liveEditingSnippet = codeSnippets.find(s => s.id === liveEditingSnippetId) || null;

    const handleShare = useCallback(async (content: { type: 'text' | 'image' | 'video', data: string, prompt?: string, fileName?: string }) => {
        const shareData = {
            title: 'Created with Kaniska AI',
            text: content.prompt || (content.type === 'text' ? content.data : 'Check out what I made with my AI assistant!'),
        };

        if ('share' in navigator && (content.type === 'image' || content.type === 'video')) {
            try {
                const response = await fetch(content.data);
                const blob = await response.blob();
                const file = new File([blob], content.fileName || `creation.${content.type === 'image' ? 'jpg' : 'mp4'}`, { type: blob.type });

                if ('canShare' in navigator && navigator.canShare({ files: [file] })) {
                    await navigator.share({ ...shareData, files: [file] });
                    return;
                }
            } catch (error) {
                console.error("Error creating file for sharing or share was cancelled:", error);
            }
        }

        if ('share' in navigator && content.type === 'text') {
            try {
                await navigator.share({ title: 'Shared from the Assistant', text: content.data });
                return;
            } catch (error) {
                console.error("Web Share API error:", error);
            }
        }

        if (content.type === 'text') {
            navigator.clipboard.writeText(content.data);
            addTranscriptionEntry({ speaker: 'system', text: 'Message copied to clipboard!' });
        } else {
            setShareContent({ type: content.type, content: content.data, prompt: shareData.text });
        }
    }, [addTranscriptionEntry]);

    const handlePreviousVideo = () => {
        if (youtubeQueue.length > 0 && youtubeQueueIndex > 0) {
            const newIndex = youtubeQueueIndex - 1;
            setYoutubeQueueIndex(newIndex);
            const prevVideo = youtubeQueue[newIndex];
            setYoutubeTitle(prevVideo.title);
            setYoutubeError(null);
            if (playerRef.current) {
                playerRef.current.loadVideoById(prevVideo.videoId);
            } else {
                setPendingVideoId(prevVideo.videoId);
            }
        }
    };

    const handleNextVideo = () => {
        if (youtubeQueue.length > 0 && youtubeQueueIndex < youtubeQueue.length - 1) {
            const newIndex = youtubeQueueIndex + 1;
            setYoutubeQueueIndex(newIndex);
            const nextVideo = youtubeQueue[newIndex];
            setYoutubeTitle(nextVideo.title);
            setYoutubeError(null);
            if (playerRef.current) {
                playerRef.current.loadVideoById(nextVideo.videoId);
            } else {
                setPendingVideoId(nextVideo.videoId);
            }
        }
    };

    const handlePlayPause = () => {
        if (playerRef.current) {
            if (isYoutubePlaying) {
                playerRef.current.pauseVideo();
            } else {
                playerRef.current.playVideo();
            }
        }
    };

    const handleStop = () => {
        if (playerRef.current) {
            playerRef.current.stopVideo();
            setYoutubeTitle(null);
            setYoutubeQueue([]);
            setYoutubeQueueIndex(-1);
            setIsYoutubePlaying(false);
            localStorage.removeItem('youtube_playback_state');
        }
    };
    
    const handleSaveApiKeys = (keysToSave: ApiKeys) => {
        if (userIdRef.current) {
            db.ref(`apiKeys/${userIdRef.current}`).set(keysToSave);
        }
        setApiKeys(keysToSave);
    };
    
    const handleResetApiKeys = () => {
        if (!userIdRef.current) return;
        if (window.confirm("Are you sure you want to remove all saved API keys? You will need to re-enter your Gemini key to continue.")) {
            db.ref(`apiKeys/${userIdRef.current}`).remove();
            setApiKeys({ gemini: null, weather: null, news: null, youtube: null });
            setIsStudioKeySelected(false);
            setIsSettingsModalOpen(false);
        }
    };

    if (!isDataLoaded || isApiKeyLoading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-bg-color"><div className="w-8 h-8 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div></div>;
    }

    if (!apiKeys.gemini && !isStudioKeySelected) {
        return <ApiKeySelectionScreen
            onStudioKeySelected={(optionalKeys) => {
                setIsStudioKeySelected(true);
                if (userIdRef.current) {
                    const keysToSave = { gemini: null, ...optionalKeys };
                    db.ref(`apiKeys/${userIdRef.current}`).set(keysToSave);
                    setApiKeys(keysToSave);
                }
                setApiKeyError(null);
            }}
            onKeysSaved={(keys) => {
                if (userIdRef.current) {
                    db.ref(`apiKeys/${userIdRef.current}`).set(keys);
                    setApiKeys(keys);
                    setApiKeyError(null);
                }
            }}
            reselectionReason={apiKeyError}
        />;
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-bg-color text-text-color overflow-hidden">
            <audio ref={audioPlayerRef} crossOrigin="anonymous" />
            <header className="flex-shrink-0 flex flex-wrap items-center justify-center sm:justify-between p-2 sm:p-4 gap-4 border-b border-border-color">
                <div className="flex items-center gap-3"><HologramIcon /><h1 className="text-lg font-bold tracking-wider glowing-text">{mainVoiceGender === 'female' ? 'KANISKA' : 'KANISHK'}</h1></div>
                <div className="flex items-center gap-2 md:gap-4">
                    <Clock />
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${assistantState === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{assistantState.toUpperCase()}</span>
                    <button onClick={handleThemeToggle} className="text-muted hover:text-primary-color" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="text-muted hover:text-primary-color" aria-label="Customize Assistant"><SettingsIcon /></button>
                    <a href="https://www.instagram.com/abhixofficial01/" target="_blank" rel="noopener noreferrer" aria-label="Instagram Profile" className="text-muted hover:text-primary-color"><InstagramIcon /></a>
                </div>
            </header>
            <main className="flex-grow flex flex-col lg:flex-row p-4 gap-4 overflow-y-auto lg:overflow-hidden">
                <section className="w-full lg:w-1/3 flex flex-col items-center justify-center bg-panel-bg border border-border-color rounded-lg p-4 lg:p-6 animate-panel-enter">
                    <div className="hologram-container">
                        <img src={currentAvatar} alt="Holographic Assistant" className={`avatar expression-${avatarExpression}`} />
                        {avatarExpression === 'composing' && <TypingIndicator />}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <button onClick={handleButtonClick} disabled={assistantState === 'connecting' || isRecordingMessage} className={`footer-button w-40 ${assistantState === 'active' ? 'active' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                                {assistantState === 'active' ? (
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                ) : (
                                    <>
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                    </>
                                )}
                            </svg>
                            <span className="font-semibold text-sm">
                                {assistantState === 'active' ? 'Stop Session' : 'Start Session'}
                            </span>
                        </button>
                        <button onClick={handleRecordMessageClick} disabled={assistantState === 'active' || assistantState === 'connecting'} className={`footer-button w-40 ${isRecordingMessage ? 'active' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                                {isRecordingMessage ? (
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                ) : (
                                    <circle cx="12" cy="12" r="10"></circle>
                                )}
                            </svg>
                            <span className="font-semibold text-sm">
                                {isRecordingMessage ? 'Stop Recording' : 'Record Message'}
                            </span>
                        </button>
                    </div>
                </section>
                <section className="w-full lg:w-2/3 flex flex-col bg-panel-bg border border-border-color rounded-lg overflow-hidden animate-panel-enter">
                    <header className="flex-shrink-0 flex items-center border-b border-border-color overflow-x-auto">
                        <button onClick={() => setActivePanel('transcript')} className={`tab-button ${activePanel === 'transcript' ? 'active' : ''}`}>Transcript</button>
                        {generatedImages.length > 0 && <button onClick={() => setActivePanel('image')} className={`tab-button ${activePanel === 'image' ? 'active' : ''}`}>Image</button>}
                        {weatherData && <button onClick={() => setActivePanel('weather')} className={`tab-button ${activePanel === 'weather' ? 'active' : ''}`}>Weather</button>}
                        {newsArticles.length > 0 && <button onClick={() => setActivePanel('news')} className={`tab-button ${activePanel === 'news' ? 'active' : ''}`}>News</button>}
                        {timer && <button onClick={() => setActivePanel('timer')} className={`tab-button ${activePanel === 'timer' ? 'active' : ''}`}>Timer</button>}
                        {youtubeTitle && <button onClick={() => setActivePanel('youtube')} className={`tab-button ${activePanel === 'youtube' ? 'active' : ''}`}>YouTube</button>}
                        {videoUrl && <button onClick={() => setActivePanel('video')} className={`tab-button ${activePanel === 'video' ? 'active' : ''}`}>Video</button>}
                        {songLyrics && <button onClick={() => setActivePanel('lyrics')} className={`tab-button ${activePanel === 'lyrics' ? 'active' : ''}`}>Lyrics</button>}
                        {codeSnippets.length > 0 && <button onClick={() => setActivePanel('code')} className={`tab-button ${activePanel === 'code' ? 'active' : ''}`}>Code</button>}
                        {liveEditingSnippetId && <button onClick={() => setActivePanel('liveEditor')} className={`tab-button ${activePanel === 'liveEditor' ? 'active' : ''}`}>Live Editor</button>}
                        {emailRecipient && <button onClick={() => setActivePanel('email')} className={`tab-button ${activePanel === 'email' ? 'active' : ''}`}>Email</button>}
                    </header>
                    <div className="flex-grow overflow-y-auto">
                        {activePanel === 'transcript' && (
                            <div className="p-4 space-y-4">
                                {transcriptions.map((t, i) => (
                                    <div key={t.firebaseKey || i} className={`chat-bubble-animation flex flex-col ${t.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`flex items-center gap-2 ${t.speaker === 'user' ? 'flex-row-reverse' : ''}`}>
                                            <span className="text-xs font-bold text-muted">{t.speaker === 'assistant' ? (mainVoiceGender === 'female' ? 'Kaniska' : 'Kanishk') : 'You'}</span>
                                            <span className="text-xs text-muted">{t.timestamp.toLocaleTimeString()}</span>
                                        </div>
                                        <div className={`mt-1 px-4 py-2 rounded-lg max-w-lg ${t.speaker === 'user' ? 'bg-primary-color/80 text-bg-color' : 'bg-assistant-bubble-bg'}`}>
                                            {t.text === '[Audio Message]' && t.firebaseKey && localAudioDownloads[t.firebaseKey] ? (
                                                <audio controls src={localAudioDownloads[t.firebaseKey]} className="w-64 h-10"></audio>
                                            ) : (
                                                <p className="m-0 whitespace-pre-wrap">{t.text}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={transcriptEndRef} />
                            </div>
                        )}
                        {activePanel === 'image' && (
                             <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                                <div className="p-4 overflow-y-auto border-r border-border-color">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold">Image Gallery</h3>
                                        <input type="file" ref={imageUploadInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                        <button onClick={() => imageUploadInputRef.current?.click()} className="quick-action-button">Upload Image</button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {generatedImages.map(img => (
                                            <div key={img.id} onClick={() => setSelectedImage(img)} className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 ${selectedImage?.id === img.id ? 'border-primary-color' : 'border-transparent'}`}>
                                                {img.isLoading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div></div>}
                                                {img.error && <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center text-center p-2 text-xs text-red-300">{img.error}</div>}
                                                {img.url && <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col items-center justify-center">
                                    {selectedImage?.url ? (
                                        <>
                                            <img src={selectedImage.url} alt={selectedImage.prompt} className="max-w-full max-h-[60%] object-contain rounded-lg shadow-lg" />
                                            <p className="text-sm text-muted mt-4 text-center">{selectedImage.prompt}</p>
                                            <div className="mt-4 flex gap-2">
                                                <button onClick={() => handleDownloadImage(selectedImage.url!, selectedImage.prompt)} className="quick-action-button">Download</button>
                                                <button onClick={() => setEditingImage(selectedImage)} className="quick-action-button">Manual Edit</button>
                                                <button onClick={() => handleStartLiveEdit(selectedImage)} disabled={assistantState !== 'active'} title={assistantState !== 'active' ? 'Start a session to use live editing' : ''} className="quick-action-button">Live Edit</button>
                                                <button onClick={() => handleShare({ type: 'image', data: selectedImage.url!, prompt: selectedImage.prompt, fileName: 'generated-image.jpg' })} className="quick-action-button"><ShareIcon size={14}/> Share</button>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-muted">Select an image to view it here.</p>
                                    )}
                                </div>
                            </div>
                        )}
                        {activePanel === 'weather' && weatherData && <WeatherPanel data={weatherData} />}
                        {activePanel === 'news' && <NewsPanel articles={newsArticles} />}
                        {activePanel === 'timer' && timer && <TimerPanel timer={timer} />}
                        {activePanel === 'youtube' && (
                            <div className="flex flex-col items-center justify-center h-full p-2 gap-2">
                                <h3 className="text-lg font-semibold truncate max-w-full">{youtubeTitle || 'YouTube Player'}</h3>
                                {youtubeError ? (
                                     <div className="flex-grow w-full flex items-center justify-center bg-black/50 rounded-lg p-4 text-center text-red-400">
                                        <p>{youtubeError}</p>
                                     </div>
                                ) : (
                                    <div id="youtube-player" className="w-full h-full flex-grow rounded-lg overflow-hidden bg-black"></div>
                                )}
                                <div className="youtube-controls-container">
                                    <button onClick={handlePreviousVideo} disabled={youtubeQueueIndex <= 0} className="youtube-control-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg></button>
                                    <button onClick={handlePlayPause} disabled={!youtubeTitle} className="youtube-control-button play-pause-btn">{isYoutubePlaying ? <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>}</button>
                                    <button onClick={handleNextVideo} disabled={youtubeQueueIndex >= youtubeQueue.length - 1} className="youtube-control-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg></button>
                                    <button onClick={handleStop} disabled={!youtubeTitle} className="youtube-control-button stop-btn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
                                </div>
                            </div>
                        )}
                        {activePanel === 'video' && (
                            <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
                                 {videoGenerationState === 'generating' && <div className="text-center"><div className="w-12 h-12 border-4 border-border-color border-t-primary-color rounded-full animate-spin mx-auto mb-4"></div><p className="font-semibold">{videoProgressMessage}</p></div>}
                                {videoGenerationState === 'error' && <div className="text-center text-red-400"><p className="font-bold">Generation Failed</p><p className="text-sm">{videoError}</p></div>}
                                {videoGenerationState === 'done' && videoUrl && <video src={videoUrl} controls autoPlay className="max-w-full max-h-full rounded-lg"></video>}
                            </div>
                        )}
                        {activePanel === 'lyrics' && songLyrics && (
                            <div className="p-4 flex flex-col items-center justify-center text-center h-full">
                                <h3 className="text-2xl font-bold">{songLyrics.name}</h3>
                                <p className="text-muted mb-6">{songLyrics.artist}</p>
                                <div className="w-full max-w-2xl">
                                    {songLyrics.lyrics.map((line, index) => (
                                        <p key={index} className={`text-lg transition-all duration-300 ${songLyrics.currentLine === index ? 'font-bold text-primary-color scale-110' : 'text-muted'}`}>{line || '...'}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activePanel === 'code' && <CodePanel snippets={codeSnippets} onPreview={setWebsitePreview} onLiveEdit={handleStartLiveCodeEdit} />}
                        {activePanel === 'liveEditor' && liveEditingSnippet && <LiveCodeEditorPanel snippet={liveEditingSnippet} code={liveEditorCode} onCodeChange={setLiveEditorCode} onFinish={handleFinishLiveCodeEdit} />}
                        {activePanel === 'email' && <EmailPanel recipient={emailRecipient} subject={emailSubject} body={emailBody} onRecipientChange={setEmailRecipient} onSubjectChange={setEmailSubject} onBodyChange={setEmailBody} onSend={handleSendEmail} />}
                    </div>
                    <QuickActions onAction={handleQuickAction} disabled={assistantState !== 'active'} isWeatherEnabled={!!apiKeys.weather} isNewsEnabled={!!apiKeys.news} isYoutubeEnabled={!!apiKeys.youtube} />
                </section>
            </main>
            <ImageEditorModal isOpen={!!editingImage} image={editingImage} onClose={() => setEditingImage(null)} onSave={(url) => { if(editingImage) { setGeneratedImages(p => p.map(i => i.id === editingImage.id ? {...i, url} : i)); setSelectedImage(p => p?.id === editingImage.id ? {...p, url} : p); } setEditingImage(null); }} />
            <LiveImageEditorModal isOpen={!!liveEditingImage} image={liveEditingImage} filters={liveEditFilters} transform={liveEditTransform} onClose={() => { setLiveEditingImage(null); sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ text: 'Live editing session finished.' })); }} onSave={(url) => { if(liveEditingImage) { setGeneratedImages(p => p.map(i => i.id === liveEditingImage.id ? {...i, url} : i)); setSelectedImage(p => p?.id === liveEditingImage.id ? {...p, url} : p); } setLiveEditingImage(null); }} onReset={() => { setLiveEditFilters(initialFilters); setLiveEditTransform(initialTransforms); sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ text: 'Reset the image to its original state.' })); }} />
            <WebsitePreviewModal preview={websitePreview} onClose={() => setWebsitePreview(null)} />
            <SettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)}
                avatars={avatars}
                currentAvatar={currentAvatar}
                onSelectAvatar={setCurrentAvatar}
                onUploadAvatar={(newAvatar) => { setAvatars(prev => [...prev.filter(a => !a.startsWith('data:')), newAvatar]); setCurrentAvatar(newAvatar); }}
                onGenerateAvatar={handleGenerateAvatar}
                generatedAvatarResult={generatedAiAvatar}
                customGreeting={customGreeting}
                onSaveGreeting={handleSaveGreeting}
                customSystemPrompt={customSystemPrompt}
                onSaveSystemPrompt={handleSaveSystemPrompt}
                onClearHistory={handleClearHistory}
                mainVoiceGender={mainVoiceGender}
                onSetMainVoiceGender={setMainVoiceGender}
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
                voicePitch={voicePitch}
                onSetVoicePitch={setVoicePitch}
                voiceSpeed={voiceSpeed}
                onSetVoiceSpeed={setVoiceSpeed}
                greetingVoiceGender={greetingVoiceGender}
                onSetGreetingVoiceGender={setGreetingVoiceGender}
                greetingVoice={greetingVoice}
                onSetGreetingVoice={setGreetingVoice}
                greetingPitch={greetingPitch}
                onSetGreetingPitch={setGreetingPitch}
                greetingSpeed={greetingSpeed}
                onSetGreetingSpeed={setGreetingSpeed}
                speakText={speakText}
                onStartSupportChat={() => {
                    setIsSettingsModalOpen(false);
                    if (assistantState === 'active') { disconnectFromGemini(); }
                    setIsSupportChatActive(true);
                    setTimeout(connectToGemini, 500); // Wait a bit before reconnecting
                }}
                userId={userIdRef.current}
                apiKeys={apiKeys}
                onSaveApiKeys={handleSaveApiKeys}
                onResetGeminiKey={handleResetApiKeys}
            />
        </div>
    );
};
