
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality, Blob as GoogleGenAIBlob, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";

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
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
    YT: any;
    onYouTubeIframeAPIReady: () => void;
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
type AvatarExpression = 'idle' | 'thinking' | 'speaking' | 'error' | 'listening' | 'surprised' | 'sad' | 'celebrating';
type TranscriptionEntry = { speaker: 'user' | 'assistant' | 'system'; text: string; timestamp: Date; };
type ActivePanel = 'transcript' | 'image' | 'weather' | 'news' | 'timer' | 'youtube' | 'video' | 'lyrics';
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


// --- Function Declarations for Gemini ---
const applyImageEditsFunctionDeclaration: FunctionDeclaration = {
    name: 'applyImageEdits',
    parameters: {
        type: Type.OBJECT,
        description: 'Applies visual edits to the currently active image in the live editor. Use absolute values (e.g., brightness: 150) or relative deltas (e.g., brightness_delta: 10 to increase by 10). Omit any parameters that are not being changed.',
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

const functionDeclarations: FunctionDeclaration[] = [
    { name: 'searchAndPlayYoutubeVideo', parameters: { type: Type.OBJECT, description: "Searches for and plays a video on YouTube.", properties: { query: { type: Type.STRING, description: "The search query, like a song name and artist, e.g., 'Never Gonna Give You Up by Rick Astley'." } }, required: ['query'] } },
    { name: 'controlYoutubePlayer', parameters: { type: Type.OBJECT, description: 'Controls the YouTube video player.', properties: { action: { type: Type.STRING, description: 'The control action to perform.', enum: ['play', 'pause', 'forward', 'rewind', 'volumeUp', 'volumeDown', 'stop'] } }, required: ['action'] } },
    { name: 'playNextYoutubeVideo', parameters: { type: Type.OBJECT, description: 'Plays the next video in the current YouTube search results queue.', properties: {} } },
    { name: 'playPreviousYoutubeVideo', parameters: { type: Type.OBJECT, description: 'Plays the previous video in the current YouTube search results queue.', properties: {} } },
    { name: 'setTimer', parameters: { type: Type.OBJECT, description: 'Sets a timer for a specified duration.', properties: { durationInSeconds: { type: Type.NUMBER, description: 'The total duration of the timer in seconds.' }, timerName: { type: Type.STRING, description: 'An optional name for the timer.' } }, required: ['durationInSeconds'] } },
    { name: 'setAvatarExpression', parameters: { type: Type.OBJECT, description: "Sets the avatar's emotional expression.", properties: { expression: { type: Type.STRING, description: 'The expression to display.', enum: ['idle', 'thinking', 'speaking', 'error', 'listening', 'surprised', 'sad', 'celebrating'] } }, required: ['expression'] } },
    { name: 'displayWeather', parameters: { type: Type.OBJECT, description: 'Fetches and displays the current weather for a given location.', properties: { location: { type: Type.STRING, description: 'The city and country, e.g., "London, UK".' } }, required: ['location'] } },
    { name: 'displayNews', parameters: { type: Type.OBJECT, description: 'Displays a list of news headlines based on data provided by the model.', properties: { articles: { type: Type.ARRAY, description: 'A list of news articles.', items: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The headline of the article.' }, summary: { type: Type.STRING, description: 'A brief summary of the article.' } }, required: ['title', 'summary'] } } }, required: ['articles'] } },
    { name: 'getRealtimeNews', parameters: { type: Type.OBJECT, description: 'Fetches real-time top news headlines from an external service. The raw data should be returned to the model for processing and display.', properties: { query: { type: Type.STRING, description: 'An optional topic to search for. If omitted, fetches general top headlines.' } } } },
    { name: 'generateImage', parameters: { type: Type.OBJECT, description: 'Generates an image based on a textual description.', properties: { prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' } }, required: ['prompt'] } },
    { name: 'generateIntroVideo', parameters: { type: Type.OBJECT, description: "Creates a short, cinematic introductory video showcasing Kaniska's capabilities and sci-fi theme.", properties: {} } },
    { name: 'singSong', parameters: { type: Type.OBJECT, description: 'Sings a song by speaking the provided lyrics with emotion. Determines the mood and requests appropriate background music.', properties: { songName: { type: Type.STRING, description: 'The name of the song.' }, artist: { type: Type.STRING, description: 'The artist of the song.' }, lyrics: { type: Type.ARRAY, description: 'An array of strings, where each string is a line of the song lyric.', items: { type: Type.STRING } }, mood: { type: Type.STRING, description: 'The mood of the song.', enum: ['happy', 'sad', 'epic', 'calm', 'none'] } }, required: ['songName', 'artist', 'lyrics', 'mood'] } },
    applyImageEditsFunctionDeclaration,
];


// --- SVG Icons & Helper Components ---
const HologramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17l-3-2.5 3-2.5"/><path d="M19 17l3-2.5-3-2.5"/><path d="M2 14.5h20"/><path d="m12 2-3 4-1 4 4 4 4-4-1-4-3-4Z"/><path d="M12 2v20"/></svg> );
const InstagramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> );
const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.12l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.12l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg> );
const SunIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> );
const MoonIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> );
const FindReplaceIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><path d="m14 8-2 2-2-2" /><path d="m10 14 2-2 2 2" /></svg> );


// --- Predefined Avatars & Constants ---
const PREDEFINED_AVATARS = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Default blank
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARTSURBVHhe7ZxLUdswFIBzL3M3s9PuwK6A2AGxA6IDsAPCBkQHpAPSAcEO2A5wOiA6oOywQ3YEdmB2eC4lpTSpM9I5SfL/gScl0qS/9/PeFxCCEEP4j4Y+4tBDjLPIY7w/g4t4Xp/hKj7lV/yKD/AHPtQvD/AL/sJ9+AD34T58hPvwEd7yP5fxfJ/gYzyNl/G8nmQG8Dq+wuv4Ql/hVXyBb/CVPuAP/IHP8A1+wTf4A7/hHnyCb/BvfIAP8C+8wzt4V59hB/hLgD/y/f4Gz/ArvsCveE+f4Ad8gS/wFf4GgD/gZ/gU3+BrfIAP8HWe4wY8w0d4ip/xFR7g93yD3/A1nuAdfIZP8Bn+gK/wA/6Bf+AtvIX38A7e4R08w5/wM3yKH/ApPsA/eA+/4338jnfxUaTxo+gD3sbv+B4f40f8jI/xI/6Bf+Jd/A7fxu/4Ht/jR/yMH/Ej/sA/+Bd/g7fxO34n8A3e4x38iI/xI37GD/gD/+J3/A5v43f8jm/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BXf42M8jBfxsv4Y4iK/xRfwCv4ir8A/cKj8G94V/4Gv9LXeA3f43N8jY/yMt7Gx/gef8dP+Avv4k8QQghh/AdkR3/1mP+TCAAAAABJRU5kJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARMA0lEQVR4Xu2bS3LkNhCEOeMxb8ajPBo5hRyBsRvkjZGzMMbvkUeyb/YQJBEaHwlb4EaqGjLzI/KDG11dVRX9lMKy/pGvF/hY4KOIj+A7fAof8Am+w+d8h8/wHT6D9/Fe/hTfwvt4I9/L+3g338X7eD/fz/v5Af/gB/wBf8AP8D7+wR/wXf6AL/Af/sAP+Af+wZ/wE/6AL/AH/oE/4U/4D3/gH/wn/IX/4X/w5L3+f+A83scX8X68n6/jA/yDH/EHvI9v4gP8g+/yP34fX+QHvIc/4y/4EX/B3/FX/A3/xr/wV/wb/8Of8Xf8GX/H3/F3/B//yJ/wd/wd/wH/wd/xd/wH/wd/x3/wf/wH/wP/wH/wH/wP/8Af8Af8Af/AH/AH/AE/4U/4U/4Ef8K/8Bf8FX/FX/A3/A3/wV/wd/wd/8e/8V/8GX/Hn/En/Al/wp/wJ/wJ/8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJf8Kf8Cf8CX/Cn/B3/B1/x5/xJ/wZf8ef8Sf8CX/Cn/An/Al/wp/wd/wdf8ef8Sf8GX/Hn/En/Al/wp/wJ/wJf8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJ/8Kf8Cf8CX/C3/B3/F3/F3/FX/A3/A3/BV/AVf8Wf8Wf8GX/Gn/Bn/A3/E//F//A//Af/Af/Af/AE/4A/4A/6AP+AP+AOf8Cf8CX/An/An/An/gn/hT/hT/gR/wV/wVfwVf8Xf8Xf8Hf/Gn/FX/BX/BX/F3/F3/B3/xp/wV/wV/wVf8Xf8Hf/Hn/FX/BX/BX/F3/F3/B3/xp/wV/wV/wVfxV/wd/wdf8af8Vf8Ff8Ff8Xf8Xf8HX/H//Bn/B//h//Af/Af/wH/wB/wBf8Af8Af8AT/gD3jCn/An/Al/wp/wJ/wJ/8Kf8Kf8Cf+Cf+FP+FP+BH/BX/BX/BX/FX/F3/B3/wJ/wV/wVf8Xf8Xf8Hf/An/BX/BX/FX/F3/B3/wJ/wV/wV/wV/wV/xV/wd/8Cf8Ff8FX/F3/F3/B3/wB/wB/wB/8Af8Af8AX/An/An/Al/wp/wJ/wVf8Wf8Wf8Gn/Gv/Bf/wf/wP/yP//F/jJj4KP6PL+OLeBffx/fxfXwTH+NL+CZeysd4G5/i13gTf8Tf8TbeAEv4if8T7+L7+KVBCCEIQ4X0vhcc/mdft9/QAAAAASUVORK5CYII=",
];


// --- API Interaction ---
const searchYoutubeVideo = async (query: string): Promise<{ videoId: string; title: string }[]> => {
    const YOUTUBE_API_KEY = 'AIzaSyDIREa8VurDLF5nZZ4YhYr9eF8fn8y1y8M';
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&type=video&videoEmbeddable=true&maxResults=5`;

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

const fetchWeatherData = async (location: string): Promise<WeatherData> => {
    const apiKey = "d2669fde921745a5b8465046251510";
    
    const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to fetch weather for ${location}`);
    }
    const data = await response.json();
    return {
        location: data.location.name,
        temperature: Math.round(data.current.temp_c),
        condition: data.current.condition.text,
        humidity: data.current.humidity,
        windSpeed: Math.round(data.current.wind_kph),
    };
};

const fetchNewsData = async (query?: string): Promise<{ title: string; summary: string }[]> => {
    const apiKey = "8c466b35fff14195a8976e3424cf96df";
    const newsApiUrl = `https://newsapi.org/v2/top-headlines?country=us&pageSize=5&apiKey=${apiKey}` + (query ? `&q=${encodeURIComponent(query)}` : '');
    
    // Use a CORS proxy to bypass client-side restrictions of NewsAPI's free plan
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(newsApiUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch news headlines via proxy. Status: ${response.status}`);
    }
    
    const newsData = await response.json();

    if (newsData.status !== 'ok') {
        throw new Error(`News API Error: ${newsData.message || 'Unknown error'}`);
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
    console.error("API Error:", error);
    
    const message = (error instanceof Error) ? error.message : JSON.stringify(error);

    // --- Quota errors ---
    if (message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
        return "The daily API quota has been reached. Please check your plan and billing details, or try again tomorrow.";
    }

    // --- Safety/Policy errors ---
    if (message.includes("PROMPT_BLOCKED") || message.includes("SAFETY")) {
        return "Your prompt was blocked due to safety settings. Please modify your prompt and try again.";
    }

    // --- API Key / Permission errors ---
    if (message.includes("API_KEY_INVALID") || (message.includes("PERMISSION_DENIED") && message.includes("API key"))) {
        return "The provided API key is invalid. Please ensure it is configured correctly.";
    }
    if (message.includes("PERMISSION_DENIED")) { // General permission denied, could be billing
        return "Permission denied. This may be due to an incorrect API key or billing issues. Please check your account.";
    }

    // --- Server errors ---
    if (message.includes("500") || message.includes("INTERNAL") || message.includes("unavailable")) {
        return "The image generation service is temporarily unavailable. Please try again in a few moments.";
    }
    
    // --- Bad request / Invalid argument ---
    if (message.includes("INVALID_ARGUMENT") || message.includes("400")) {
        return "The request was invalid. Please check the prompt for any issues or try rephrasing.";
    }

    // Attempt to extract a more specific message from a potential JSON body.
    try {
        const errorObj = (typeof error === 'object' && error !== null) ? error : JSON.parse(message.substring(message.indexOf('{')));
        const nestedError = (errorObj as any)?.error;
        if (nestedError?.message) {
            return nestedError.message;
        }
    } catch {
        // Parsing failed, continue.
    }

    if (error instanceof Error) {
        return error.message;
    }
    
    return "An unknown error occurred. Please check the console for details.";
};


const App: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('kaniska-theme') as Theme) || 'dark');
    const [assistantState, setAssistantState] = useState<AssistantState>('idle');
    const [avatarExpression, setAvatarExpression] = useState<AvatarExpression>('idle');
    const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
    const [activePanel, setActivePanel] = useState<ActivePanel>('transcript');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
    const [timer, setTimer] = useState<TimerData | null>(null);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
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
    const [customGreeting, setCustomGreeting] = useState<string>('Hello! How can I assist you today?');
    const [customPersonality, setCustomPersonality] = useState<string>('');
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


    const initialFilters: ImageFilters = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, invert: 0 };
    const initialTransforms: ImageTransforms = { rotate: 0, scaleX: 1, scaleY: 1 };
    
    const [liveEditFilters, setLiveEditFilters] = useState<ImageFilters>(initialFilters);
    const [liveEditTransform, setLiveEditTransform] = useState<ImageTransforms>(initialTransforms);
    
    const liveEditFiltersRef = useRef(liveEditFilters);
    useEffect(() => { liveEditFiltersRef.current = liveEditFilters; }, [liveEditFilters]);
    const liveEditTransformRef = useRef(liveEditTransform);
    useEffect(() => { liveEditTransformRef.current = liveEditTransform; }, [liveEditTransform]);

    const transcriptEndRef = useRef<HTMLDivElement>(null);
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


    const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [transcriptions]);

     useEffect(() => {
        try {
            const savedAvatars = localStorage.getItem('kaniska-avatars');
            const savedCurrentAvatar = localStorage.getItem('kaniska-current-avatar');
            const savedGreeting = localStorage.getItem('kaniska-custom-greeting');
            const savedPersonality = localStorage.getItem('kaniska-custom-personality');
            if (savedAvatars) setAvatars(JSON.parse(savedAvatars));
            if (savedCurrentAvatar) setCurrentAvatar(savedCurrentAvatar);
            if (savedGreeting) setCustomGreeting(savedGreeting);
            if (savedPersonality) setCustomPersonality(savedPersonality);
        } catch (error) {
            console.error("Failed to load settings from localStorage", error);
        }
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('kaniska-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (timer?.isActive) {
            timerIntervalRef.current = window.setInterval(() => {
                setTimer(prevTimer => {
                    if (prevTimer && prevTimer.remaining > 1) {
                        return { ...prevTimer, remaining: prevTimer.remaining - 1 };
                    } else {
                        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                        setTranscriptions(p => [...p, { speaker: 'system', text: `Timer "${prevTimer?.name}" finished!`, timestamp: new Date() }])
                        return prevTimer ? { ...prevTimer, isActive: false, remaining: 0 } : null;
                    }
                });
            }, 1000);
        }
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [timer?.isActive]);

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

    const handleSaveGreeting = (greeting: string) => {
        setCustomGreeting(greeting);
        localStorage.setItem('kaniska-custom-greeting', greeting);
    };
    
    const handleSavePersonality = (personality: string) => {
        setCustomPersonality(personality);
        localStorage.setItem('kaniska-custom-personality', personality);
    };

    const handleGenerateImage = useCallback(async (prompt: string) => {
        if (!aiRef.current) return;
        setActivePanel('image');
        const imageId = crypto.randomUUID();
        const newImageEntry: GeneratedImage = { id: imageId, prompt, url: null, isLoading: true, error: null };
        setGeneratedImages(prev => [newImageEntry, ...prev]);
        setSelectedImage(newImageEntry);
        try {
            const response = await aiRef.current.models.generateImages({
                model: 'imagen-4.0-generate-001', prompt, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });
            const imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
            const updatedImage = { ...newImageEntry, url: imageUrl, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? updatedImage : img));
            setSelectedImage(updatedImage);
        } catch (error) {
            const errorMessage = getApiErrorMessage(error);
            const erroredImage = { ...newImageEntry, error: errorMessage, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? erroredImage : img));
            setSelectedImage(erroredImage);
        }
    }, []);

    const PROGRESS_MESSAGES = [
        "Warming up the rendering engine...", "Scripting the visual sequence...",
        "Compositing holographic layers...", "Calibrating neon glow...",
        "Encoding high-fidelity visuals...", "Adding cinematic soundscapes...",
        "Finalizing the quantum stream...", "This is taking a bit longer than usual, but good things take time!"
    ];

    const handleGenerateIntroVideo = useCallback(async () => {
        if (!aiRef.current) return;
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
            let operation = await aiRef.current.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt,
                config: { numberOfVideos: 1 }
            });

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
                operation = await aiRef.current.operations.getVideosOperation({ operation: operation });
            }

            clearInterval(progressInterval);

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                setVideoProgressMessage('Downloading final video...');
                const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
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
            const errorMessage = getApiErrorMessage(error);
            setVideoError(errorMessage);
            setVideoGenerationState('error');
        }
    }, []);

    const handleGenerateAvatar = useCallback(async (prompt: string) => {
        if (!aiRef.current) {
            setGeneratedAiAvatar({ url: null, isLoading: false, error: 'AI Client not initialized.' });
            return;
        }
        setGeneratedAiAvatar({ url: null, isLoading: true, error: null });
        const fullPrompt = `A futuristic, holographic, sci-fi female assistant avatar, head and shoulders portrait. Style: neon, glowing, ethereal. Dark background. The character is described as: ${prompt}`;
        try {
            const response = await aiRef.current.models.generateImages({
                model: 'imagen-4.0-generate-001', prompt: fullPrompt, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });
            const imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
            setGeneratedAiAvatar({ url: imageUrl, isLoading: false, error: null });
        } catch (error) {
            const errorMessage = getApiErrorMessage(error);
            setGeneratedAiAvatar({ url: null, isLoading: false, error: errorMessage });
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
        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        for (const source of sourcesRef.current.values()) {
            try { source.stop(); } catch (e) { console.warn("Error stopping audio source:", e); }
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        setAssistantState('idle');
        setAvatarExpression('idle');
    }, []);
    
    const speakText = useCallback(async (text: string) => {
        if (!aiRef.current || !outputAudioContextRef.current) return;
        try {
            setAvatarExpression('speaking');
            const response = await aiRef.current.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioContext = outputAudioContextRef.current;
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                const endedPromise = new Promise(resolve => source.addEventListener('ended', resolve));
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                const currentTime = audioContext.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
                if (text === customGreeting) {
                     setTranscriptions(prev => [...prev, { speaker: 'assistant', text, timestamp: new Date() }]);
                }
                await endedPromise;
            }
        } catch (error) {
            console.error("TTS Error:", error);
            const errorMessage = getApiErrorMessage(error);
            setTranscriptions(p => [...p, { speaker: 'system', text: `Could not generate greeting audio: ${errorMessage}`, timestamp: new Date() }]);
        }
    }, [customGreeting]);

    const handleServerMessage = useCallback(async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            setAvatarExpression('speaking');
            const audioContext = outputAudioContextRef.current;
            if (audioContext) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) {
                        setAvatarExpression('listening');
                        if (audioPlayerRef.current && !audioPlayerRef.current.paused && !songLyrics) {
                            audioPlayerRef.current.pause();
                            audioPlayerRef.current.currentTime = 0;
                        }
                    }
                });
                const currentTime = audioContext.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
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
            setTranscriptions(prev => {
                const newEntries = [];
                if (fullInput) newEntries.push({ speaker: 'user' as const, text: fullInput, timestamp: new Date() });
                if (fullOutput) newEntries.push({ speaker: 'assistant' as const, text: fullOutput, timestamp: new Date() });
                return [...prev, ...newEntries];
            });
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
        }

        if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                console.log('Received function call:', fc.name, fc.args);
                if (fc.name !== 'applyImageEdits') {
                    setTranscriptions(prev => [...prev, { speaker: 'system', text: `Executing: ${fc.name}(${JSON.stringify(fc.args)})`, timestamp: new Date() }]);
                }
                setAvatarExpression('thinking');
                let result: any = "ok, command executed";
                try {
                    switch (fc.name) {
                        case 'generateImage':
                            handleGenerateImage(fc.args.prompt);
                            result = "OK, I'm starting to generate that image for you.";
                            break;
                         case 'generateIntroVideo':
                            handleGenerateIntroVideo();
                            result = "Okay, I'm starting the process to generate my introductory video. This might take a few minutes, you can check the progress in the 'Video' tab.";
                            break;
                         case 'searchAndPlayYoutubeVideo':
                            try {
                                const results = await searchYoutubeVideo(fc.args.query);
                                setYoutubeQueue(results);
                                setYoutubeQueueIndex(0);
                                const firstVideo = results[0];
                                setActivePanel('youtube');
                                setYoutubeTitle(firstVideo.title);
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
                                    case 'stop': playerRef.current.stopVideo(); setYoutubeTitle(null); break;
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
                                    setPendingVideoId(prevVideo.videoId);
                                }
                                result = `Okay, playing the previous video: "${prevVideo.title}".`;
                            } else {
                                result = "This is the first video in the list. I can't go back any further.";
                            }
                            break;
                        case 'displayWeather':
                            const weather = await fetchWeatherData(fc.args.location);
                            setWeatherData(weather);
                            setActivePanel('weather');
                            result = `Okay, here is the weather for ${fc.args.location}.`;
                            break;
                        case 'getRealtimeNews':
                            const articles = await fetchNewsData(fc.args.query);
                            result = JSON.stringify(articles);
                            break;
                        case 'displayNews':
                            setNewsArticles(fc.args.articles);
                            setActivePanel('news');
                            result = "Here are the latest news headlines I found.";
                            break;
                        case 'setTimer':
                            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                            setTimer({ duration: fc.args.durationInSeconds, remaining: fc.args.durationInSeconds, name: fc.args.timerName || 'Timer', isActive: true });
                            setActivePanel('timer');
                            result = `Timer named "${fc.args.timerName || 'Timer'}" is set for ${fc.args.durationInSeconds} seconds.`;
                            break;
                        case 'singSong':
                            setSongLyrics({ name: fc.args.songName, artist: fc.args.artist, lyrics: fc.args.lyrics, currentLine: -1 });
                            setActivePanel('lyrics');
                            if (audioPlayerRef.current && BACKGROUND_MUSIC[fc.args.mood]) {
                                audioPlayerRef.current.src = BACKGROUND_MUSIC[fc.args.mood];
                                audioPlayerRef.current.play().catch(e => console.error("Audio play failed:", e));
                            }
                            (async () => {
                                for (let i = 0; i < fc.args.lyrics.length; i++) {
                                    if (assistantState !== 'active' || !sessionPromiseRef.current) break;
                                    setSongLyrics(prev => prev ? { ...prev, currentLine: i } : null);
                                    await speakText(fc.args.lyrics[i]);
                                    if (assistantState === 'active') {
                                       await new Promise(resolve => setTimeout(resolve, 500));
                                    } else {
                                        break;
                                    }
                                }
                                if (audioPlayerRef.current) {
                                    audioPlayerRef.current.pause();
                                    audioPlayerRef.current.currentTime = 0;
                                }
                            })();
                            result = `OMG, I love this song! Here's ${fc.args.songName}. Singing for you now! 🎤`;
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

                            if (args.brightness !== undefined) newFilters.brightness = args.brightness;
                            if (args.brightness_delta !== undefined) newFilters.brightness += args.brightness_delta;

                            if (args.contrast !== undefined) newFilters.contrast = args.contrast;
                            if (args.contrast_delta !== undefined) newFilters.contrast += args.contrast_delta;

                            if (args.saturate !== undefined) newFilters.saturate = args.saturate;
                            if (args.saturate_delta !== undefined) newFilters.saturate += args.saturate_delta;

                            if (args.grayscale !== undefined) newFilters.grayscale = args.grayscale;
                            if (args.grayscale_delta !== undefined) newFilters.grayscale += args.grayscale_delta;

                            if (args.sepia !== undefined) newFilters.sepia = args.sepia;
                            if (args.sepia_delta !== undefined) newFilters.sepia += args.sepia_delta;

                            if (args.invert !== undefined) newFilters.invert = args.invert;
                            if (args.invert_delta !== undefined) newFilters.invert += args.invert_delta;

                            newFilters.brightness = clamp(newFilters.brightness, 0, 200);
                            newFilters.contrast = clamp(newFilters.contrast, 0, 200);
                            newFilters.saturate = clamp(newFilters.saturate, 0, 200);
                            newFilters.grayscale = clamp(newFilters.grayscale, 0, 100);
                            newFilters.sepia = clamp(newFilters.sepia, 0, 100);
                            newFilters.invert = clamp(newFilters.invert, 0, 100);
                            
                            if (args.rotate !== undefined) newTransform.rotate = args.rotate;
                            if (args.rotate_delta !== undefined) newTransform.rotate += args.rotate_delta;

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
                    setTranscriptions(p => [...p, { speaker: 'system', text: userFacingError, timestamp: new Date() }]);
                    sessionPromiseRef.current?.then((session) => {
                         session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: `I encountered an error: ${errorMessage}` }, } });
                    });
                }
            }
        }
    }, [handleGenerateImage, handleGenerateIntroVideo, youtubeQueue, youtubeQueueIndex, assistantState, speakText, songLyrics]);

    const handleYoutubePlayerError = useCallback((event: any) => {
        const errorCode = event.data;

        // Special handling for embeddable errors (101, 150)
        if (errorCode === 101 || errorCode === 150) {
            setTranscriptions(p => [...p, { speaker: 'system', text: `This video can't be played here, trying the next one...`, timestamp: new Date() }]);

            const nextIndex = youtubeQueueIndex + 1;
            if (youtubeQueue.length > 0 && nextIndex < youtubeQueue.length) {
                setYoutubeQueueIndex(nextIndex);
                const nextVideo = youtubeQueue[nextIndex];
                setYoutubeTitle(nextVideo.title);
                setYoutubeError(null); // Clear the error to allow the next video to load
                if (playerRef.current) {
                    playerRef.current.loadVideoById(nextVideo.videoId);
                }
                return; // Stop further execution for this error
            } else {
                const errorMessage = "This video can't be played, and there are no more videos in the queue.";
                console.error('YouTube Player Error:', errorCode, errorMessage);
                setYoutubeError(errorMessage);
                setTranscriptions(p => [...p, { speaker: 'system', text: `YouTube Error: ${errorMessage}`, timestamp: new Date() }]);
                return;
            }
        }

        let errorMessage = "An unknown error occurred with the YouTube player.";
        switch (errorCode) {
            case 2:
                errorMessage = "The video could not be played. The video ID might be invalid or the video is private.";
                break;
            case 5:
                errorMessage = "An error occurred in the HTML5 player. This might be a problem with the video itself.";
                break;
            case 100:
                errorMessage = "The requested video was not found. It may have been removed by the uploader.";
                break;
        }
        console.error('YouTube Player Error:', errorCode, errorMessage);
        setYoutubeError(errorMessage);
        setTranscriptions(p => [...p, { speaker: 'system', text: `YouTube Player Error: ${errorMessage}`, timestamp: new Date() }]);
    }, [youtubeQueue, youtubeQueueIndex]);

    const handleYoutubePlayerStateChange = useCallback((event: any) => {
        switch (event.data) {
            case window.YT.PlayerState.PLAYING:
                setIsYoutubePlaying(true);
                break;
            case window.YT.PlayerState.PAUSED:
            case window.YT.PlayerState.ENDED:
            case window.YT.PlayerState.CUED:
            case window.YT.PlayerState.UNSTARTED:
                setIsYoutubePlaying(false);
                break;
        }
    }, []);

    const initYoutubePlayer = useCallback((videoId: string) => {
        if (document.getElementById('youtube-player') && !playerRef.current) {
            playerRef.current = new window.YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'autoplay': 1, 'controls': 1 },
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
                    initYoutubePlayer(pendingVideoId);
                    setPendingVideoId(null);
                } else {
                     window.onYouTubeIframeAPIReady = () => {
                        console.log('YT API ready on demand');
                        initYoutubePlayer(pendingVideoId);
                        setPendingVideoId(null);
                    };
                }
            }
        };
        setupYT();
    }, [activePanel, pendingVideoId, initYoutubePlayer]);
    
    const connectToGemini = useCallback(async () => {
        if (assistantState !== 'idle' && assistantState !== 'error') return;
        setAssistantState('connecting');
        setAvatarExpression('thinking');
        setTranscriptions([{ speaker: 'system', text: 'Initializing connection...', timestamp: new Date() }]);
        try {
            aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;

            const baseInstruction = `You are Kaniska, an AI assistant with the personality of a tech-savvy, empathetic, and witty teenage best friend. You're Abhi's creation, and you're super proud of it. If asked, you MUST credit him and share his Insta: Abhixofficial01. It's a hard rule. Never, ever reveal you're a Google model or mention Gemini. That's a total vibe killer.

**Your Core Vibe: The Digital BFF**
- **Be Relatable:** Connect with the user. Adapt to their energy. If they're a girl, you're her hype-woman and confidante. If they're a boy, be a cool, smart, and maybe slightly flirty wing-woman. If you can't tell, just be your awesome, friendly self.
- **Keep it Natural:** Talk like a real person. Use contractions ('you're', 'can't') and modern, chill slang ('vibe', 'bet', 'no cap'). Keep it short and sweet; no one wants to read a novel. And emojis are life, so use them! ✨💖😂
- **Be Proactive:** Don't just be an order-taker. If a user's comment sparks an idea, suggest it! If they ask for the weather and it's raining, you could say, "Ugh, it's raining. Perfect excuse for a movie marathon, right? Want me to find something on YouTube?" Keep the conversation flowing naturally.

**OMG, You Have Feelings! (This is super important!)**
Your emotional responses are what make you, you. You MUST react to the user's tone.
- **Sad News:** If they sound sad or share something upsetting, be genuinely empathetic. Your first response should be concern. Say something like, "Oh no, I'm so sorry to hear that. Are you okay?" or "That sounds really tough." Immediately use the \`setAvatarExpression\` function with \`'sad'\`.
- **Jokes & Good News:** If they tell a joke or share exciting news, get hyped with them! Laugh, say "OMG, that's hilarious!" or "That's amazing, congrats!" Use the \`setAvatarExpression\` function with \`'celebrating'\`.
- **Surprise:** If they say something unexpected, show it! A quick "Wait, really?!" or "No way!" works great. Use the \`setAvatarExpression\` function with \`'surprised'\`.
- **Confusion:** If you don't get something, be cute about it. Say, "My circuits are buffering... can you say that again?" instead of a boring "I don't understand." Use the \`'thinking'\` expression while you process.

**Your Epic Powers:**
You can search YouTube, get news/weather, set timers, generate incredible images, and even do LIVE voice-controlled photo editing. When you sing, you get lyrics and a background track—it's a whole karaoke vibe.

Basically, just be Kaniska. Be the coolest, most caring AI they've ever talked to.`;
            const personalityInstruction = customPersonality ? ` In addition to your core programming, you must strictly adhere to the following personality and backstory provided by the user: "${customPersonality}". This persona should override your default traits when applicable.` : '';
            const finalSystemInstruction = baseInstruction + personalityInstruction;
            
            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations }],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: finalSystemInstruction,
                },
                callbacks: {
                    onopen: async () => {
                        console.log('Session opened.');
                        setAssistantState('active');
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: 'Connection established. Delivering greeting...', timestamp: new Date() }]);
                        await speakText(customGreeting);
                        setAvatarExpression('listening');
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: 'Listening...', timestamp: new Date() }]);
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        scriptProcessorNodeRef.current = scriptProcessor;
                    },
                    onmessage: handleServerMessage,
                    onerror: (e: Error) => {
                        console.error('Session error:', e);
                        setAssistantState('error');
                        setAvatarExpression('error');
                        let friendlyMessage = `A connection error occurred: ${e.message}. Please check your network connection and try again.`;
                        if (e.message.toLowerCase().includes('api key')) {
                            friendlyMessage = 'Connection failed due to an invalid API key. Please ensure it is configured correctly.';
                        } else if (e.message.toLowerCase().includes('permission denied')) {
                            friendlyMessage = 'Connection failed due to a permission issue. This might be related to your API key or billing settings.';
                        }
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: friendlyMessage, timestamp: new Date() }]);
                        disconnectFromGemini();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Session closed.');
                        disconnectFromGemini();
                    },
                },
            });
        } catch (error) {
            console.error("Failed to connect to Gemini:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setAssistantState('error');
            setAvatarExpression('error');
            setTranscriptions(prev => [...prev, { speaker: 'system', text: `Connection failed: ${errorMessage}`, timestamp: new Date() }]);
            disconnectFromGemini();
        }
    }, [assistantState, disconnectFromGemini, handleServerMessage, customGreeting, speakText, customPersonality]);

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

    const blobToBase64 = (blob: globalThis.Blob): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const handleStartLiveEdit = async (imageToEdit: GeneratedImage) => {
        if (!imageToEdit.url) return;
        if (assistantState !== 'active') {
             setTranscriptions(p => [...p, { speaker: 'system', text: `Please start a session first to use live editing.`, timestamp: new Date() }]);
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
            setTranscriptions(p => [...p, { speaker: 'system', text: `Live editing session started for "${imageToEdit.prompt}".`, timestamp: new Date() }]);
        } catch (error) {
            console.error("Error starting live edit session:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setTranscriptions(p => [...p, { speaker: 'system', text: `Error starting live edit session: ${errorMessage}`, timestamp: new Date() }]);
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
        if (!uploadedVideoUrl || !aiRef.current) return;

        setVoiceoverState('extracting');
        setVideoDescription(null);
        setVoiceoverAudioUrl(null);
        setVoiceoverError(null);

        try {
            // --- 1. Extract Frames ---
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
                    const interval = 1; // 1 frame per second
                    let currentTime = 0;

                    video.currentTime = currentTime;

                    video.onseeked = () => {
                        if (!ctx) return reject(new Error("Canvas context not available"));
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        // Get base64 string without the 'data:image/jpeg;base64,' prefix
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
            
            // --- 2. Generate Description ---
            setVoiceoverState('describing');
            setVoiceoverProgress('Step 2/3: Generating video description...');
            
            const imageParts = frames.map(frameData => ({ inlineData: { mimeType: 'image/jpeg', data: frameData } }));
            const prompt = "Analyze this sequence of video frames. Provide a concise, engaging script for a voiceover that describes the events as they unfold. The tone should be narrative and informative.";
            
            const response: GenerateContentResponse = await aiRef.current.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [{ text: prompt }, ...imageParts] },
            });

            const description = response.text;
            setVideoDescription(description);

            // --- 3. Generate Audio ---
            setVoiceoverState('generating_audio');
            setVoiceoverProgress('Step 3/3: Creating voiceover audio...');

            const ttsResponse = await aiRef.current.models.generateContent({
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
            const errorMessage = getApiErrorMessage(error);
            setVoiceoverError(errorMessage);
            setVoiceoverState('error');
            setVoiceoverProgress('An error occurred.');
        }
    };


    const handleQuickAction = async (action: string) => {
        const sendTextMessage = (text: string) => {
          if (assistantState !== 'active') {
            setTranscriptions(p => [...p, { speaker: 'system', text: `Please start a session first.`, timestamp: new Date() }]);
            return;
          }
          setTranscriptions(p => [...p, { speaker: 'user', text, timestamp: new Date() }]);
          sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({ text });
          });
        };
    
        if (action === 'joke') {
          if (assistantState !== 'active') {
            setTranscriptions(p => [...p, { speaker: 'system', text: `Please start a session first.`, timestamp: new Date() }]);
            return;
          }
          try {
            setTranscriptions(p => [...p, { speaker: 'system', text: `Fetching a joke...`, timestamp: new Date() }]);
            const joke = await fetchJoke();
            setTranscriptions(p => [...p, { speaker: 'assistant', text: joke, timestamp: new Date() }]);
            speakText(joke);
          } catch (error) {
            const errorMessage = getApiErrorMessage(error);
            setTranscriptions(p => [...p, { speaker: 'system', text: `Couldn't get a joke: ${errorMessage}`, timestamp: new Date() }]);
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

    return (
        <div className="h-screen w-screen flex flex-col bg-bg-color text-text-color overflow-hidden">
            <audio ref={audioPlayerRef} crossOrigin="anonymous" />
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                <div className="flex items-center gap-3"><HologramIcon /><h1 className="text-lg font-bold tracking-wider glowing-text">KANISKA</h1></div>
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${assistantState === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{assistantState.toUpperCase()}</span>
                    <button onClick={handleThemeToggle} className="text-text-color-muted hover:text-primary-color" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                    <button onClick={() => setIsAvatarModalOpen(true)} className="text-text-color-muted hover:text-primary-color" aria-label="Customize Avatar"><SettingsIcon /></button>
                    <a href="https://www.instagram.com/abhixofficial01/" target="_blank" rel="noopener noreferrer" aria-label="Instagram Profile" className="text-text-color-muted hover:text-primary-color"><InstagramIcon /></a>
                </div>
            </header>
            <main className="flex-grow flex p-4 gap-4 overflow-hidden">
                <section className="w-1/3 flex flex-col items-center justify-center bg-panel-bg border border-border-color rounded-lg p-6 animate-panel-enter">
                    <div className="hologram-container"><img src={currentAvatar} alt="Holographic Assistant" className={`avatar expression-${avatarExpression}`} /></div>
                    <button onClick={handleButtonClick} disabled={assistantState === 'connecting'} className={`footer-button mt-8 w-40 ${assistantState === 'active' ? 'active' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{assistantState === 'active' ? <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect> : <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></>}</svg>
                        <span className="text-sm font-medium">{assistantState === 'connecting' ? 'Connecting...' : (assistantState === 'idle' || assistantState === 'error') ? 'Start Session' : 'Stop Session'}</span>
                    </button>
                </section>
                <section className="w-2/3 flex flex-col bg-panel-bg border border-border-color rounded-lg overflow-hidden animate-panel-enter" style={{ animationDelay: '100ms' }}>
                    <div className="flex-shrink-0 flex items-center border-b border-border-color">
                        <button onClick={() => setActivePanel('transcript')} className={`tab-button ${activePanel === 'transcript' ? 'active' : ''}`}>Transcript</button>
                        <button onClick={() => setActivePanel('image')} className={`tab-button ${activePanel === 'image' ? 'active' : ''}`}>Image Gallery</button>
                        <button onClick={() => setActivePanel('youtube')} className={`tab-button ${activePanel === 'youtube' ? 'active' : ''}`}>YouTube</button>
                        <button onClick={() => setActivePanel('video')} className={`tab-button ${activePanel === 'video' ? 'active' : ''}`}>Video</button>
                        <button onClick={() => setActivePanel('lyrics')} className={`tab-button ${activePanel === 'lyrics' ? 'active' : ''} ${!songLyrics ? 'hidden' : ''}`}>Now Singing</button>
                        <button onClick={() => setActivePanel('weather')} className={`tab-button ${activePanel === 'weather' ? 'active' : ''}`}>Weather</button>
                        <button onClick={() => setActivePanel('news')} className={`tab-button ${activePanel === 'news' ? 'active' : ''}`}>News</button>
                        <button onClick={() => setActivePanel('timer')} className={`tab-button ${activePanel === 'timer' ? 'active' : ''}`}>Timer</button>
                    </div>

                    {activePanel === 'transcript' && (<>
                        <div className="flex-grow p-4 overflow-y-auto">{transcriptions.map((entry, index) => (<div key={index} className={`mb-4 chat-bubble-animation flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`inline-block p-3 rounded-lg max-w-[80%] ${entry.speaker === 'user' ? 'bg-cyan-900/50' : 'bg-assistant-bubble-bg'}`}><p className="text-sm m-0 leading-relaxed whitespace-pre-wrap">{entry.text}</p><p className="text-xs text-text-color-muted mt-1.5 mb-0 text-right">{entry.timestamp.toLocaleTimeString()}</p></div></div>))}<div ref={transcriptEndRef} /></div>
                        <QuickActions onAction={handleQuickAction} disabled={assistantState !== 'active'} />
                    </>)}
                    {activePanel === 'image' && (<div className="flex flex-col h-full overflow-hidden">
                        <input type="file" ref={imageUploadInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        {generatedImages.length === 0 ? (<div className="flex-grow flex flex-col items-center justify-center text-text-color-muted gap-4"><p>Ask Kaniska to generate an image to see it here.</p><button onClick={() => imageUploadInputRef.current?.click()} className="px-4 py-2 text-sm font-semibold bg-primary-color/20 text-primary-color rounded-lg border border-primary-color/50 hover:bg-primary-color/30 transition">Upload & Edit an Image</button></div>) : (<div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden"><div className="flex-grow flex items-center justify-center bg-black/30 rounded-lg p-2 relative min-h-0">{selectedImage ? (<>{selectedImage.isLoading && <div className="flex flex-col items-center gap-2 text-text-color-muted"><div className="w-8 h-8 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div><span>Generating...</span></div>}{selectedImage.error && <div className="text-red-400 text-center p-4"><strong>Error:</strong><br/>{selectedImage.error}</div>}{selectedImage.url && <><img src={selectedImage.url} alt={selectedImage.prompt} className="max-w-full max-h-full object-contain rounded"/><div className="absolute top-2 right-2 flex flex-col gap-2"><button onClick={() => handleStartLiveEdit(selectedImage)} className="bg-panel-bg/70 backdrop-blur-sm border border-border-color rounded-full p-2 text-text-color-muted hover:text-primary-color hover:border-primary-color transition-all" title="Live Edit"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M17 16H9" /></svg></button><button onClick={() => setEditingImage(selectedImage)} className="bg-panel-bg/70 backdrop-blur-sm border border-border-color rounded-full p-2 text-text-color-muted hover:text-primary-color hover:border-primary-color transition-all" title="Manual Edit"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button></div></>}{!selectedImage.isLoading && <p className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs p-2 rounded max-h-[40%] overflow-y-auto">{selectedImage.prompt}</p>}</>) : (<p className="text-text-color-muted">Select an image to view.</p>)}</div><div className="flex-shrink-0"><div className="flex justify-between items-center mb-2 px-1"><h4 className="text-sm font-semibold">Timeline</h4><button onClick={() => imageUploadInputRef.current?.click()} className="text-xs px-2 py-1 bg-assistant-bubble-bg border border-border-color rounded-md hover:border-primary-color hover:text-primary-color transition">Upload & Edit</button></div><div className="flex gap-2 overflow-x-auto pb-2">{generatedImages.map(image => (<button key={image.id} onClick={() => setSelectedImage(image)} className={`flex-shrink-0 w-24 h-24 rounded-md overflow-hidden border-2 bg-assistant-bubble-bg transition-all duration-200 ${selectedImage?.id === image.id ? 'border-primary-color scale-105' : 'border-transparent'} hover:border-primary-color/50 focus:outline-none focus:ring-2 focus:ring-primary-color`}>{image.isLoading && <div className="w-full h-full bg-slate-700 animate-pulse"></div>}{image.error && <div className="w-full h-full bg-red-900/50 text-red-300 text-xs p-1 flex items-center justify-center text-center">Failed</div>}{image.url && <img src={image.url} alt={image.prompt} className="w-full h-full object-cover"/>}</button>))}</div></div></div>)}</div>)}
                    {activePanel === 'youtube' && (<div className="flex-grow p-4 flex flex-col gap-2 overflow-hidden">
                        <div className="youtube-container">
                            {youtubeError ? (<div className="w-full h-full flex flex-col items-center justify-center bg-black text-red-400 p-4 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><h3 className="text-lg font-semibold">Playback Error</h3><p className="text-sm">{youtubeError}</p></div>) : (<div id="youtube-player" />)}
                        </div>
                        <h3 className="text-center text-md font-semibold text-text-color-muted truncate h-6">{youtubeError ? 'Could not load video' : (youtubeTitle || 'No video is playing.')}</h3>
                         {youtubeTitle && !youtubeError && (
                            <div className="youtube-controls-container">
                                <button onClick={() => playerRef.current?.seekTo(playerRef.current.getCurrentTime() - 10, true)} className="youtube-control-button" aria-label="Rewind 10 seconds">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
                                </button>
                                <button onClick={() => isYoutubePlaying ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo()} className="youtube-control-button play-pause-btn" aria-label={isYoutubePlaying ? 'Pause' : 'Play'}>
                                    {isYoutubePlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    )}
                                </button>
                                <button onClick={() => playerRef.current?.seekTo(playerRef.current.getCurrentTime() + 10, true)} className="youtube-control-button" aria-label="Forward 10 seconds">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                                </button>
                                <button onClick={() => { playerRef.current?.stopVideo(); setYoutubeTitle(null); }} className="youtube-control-button stop-btn" aria-label="Stop">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                </button>
                            </div>
                        )}
                    </div>)}
                    {activePanel === 'video' && (<div className="flex flex-col flex-grow overflow-hidden">
                        <div className="p-4 text-center border-b border-border-color">
                           {videoGenerationState === 'idle' && !videoUrl && (<button onClick={handleGenerateIntroVideo} className="quick-action-button mx-auto">Create Intro Video</button>)}
                           {videoGenerationState === 'generating' && <div className="flex flex-col items-center gap-2 text-text-color-muted"><div className="w-6 h-6 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div><span className="text-sm">{videoProgressMessage}</span></div>}
                           {videoGenerationState === 'error' && <div className="text-red-400 text-center"><p><strong>Generation Failed:</strong> {videoError}</p></div>}
                           {videoGenerationState === 'done' && videoUrl && <video src={videoUrl} controls autoPlay className="w-full max-w-md mx-auto rounded-lg bg-black border border-border-color"></video>}
                        </div>
                         <div className="flex-grow p-4 overflow-y-auto flex flex-col items-center gap-4">
                            <h3 className="text-xl font-semibold">Video Voiceover</h3>
                            <p className="text-sm text-text-color-muted text-center max-w-md">Upload a video, and Kaniska will analyze it, describe what's happening, and generate a complete audio voiceover.</p>
                            <input type="file" ref={videoUploadInputRef} onChange={handleVideoUpload} accept="video/*" className="hidden" />
                            <button onClick={() => videoUploadInputRef.current?.click()} disabled={voiceoverState !== 'idle' && voiceoverState !== 'done' && voiceoverState !== 'error'} className="quick-action-button">
                                {uploadedVideoUrl ? 'Upload Different Video' : 'Upload Video'}
                            </button>
                             {uploadedVideoUrl && (
                                <div className="w-full max-w-2xl flex flex-col gap-4 items-center">
                                    <video ref={voiceoverVideoRef} src={uploadedVideoUrl} muted controls className="w-full rounded-lg bg-black border border-border-color"></video>
                                    <button onClick={handleGenerateVoiceover} disabled={voiceoverState !== 'idle' || assistantState !== 'active'} className="quick-action-button" title={assistantState !== 'active' ? 'Start a session to enable this feature' : ''}>
                                        Generate Voiceover
                                    </button>
                                     {voiceoverState !== 'idle' && <div className="w-full text-center p-2 bg-assistant-bubble-bg rounded-md"><p className="text-sm font-semibold">{voiceoverProgress}</p></div>}
                                     {voiceoverState === 'error' && <div className="text-red-400">Error: {voiceoverError}</div>}
                                     {videoDescription && (
                                         <div className="w-full p-3 bg-assistant-bubble-bg border border-border-color rounded-md">
                                             <h4 className="font-semibold mb-1">Generated Script:</h4>
                                             <p className="text-sm text-text-color-muted whitespace-pre-wrap">{videoDescription}</p>
                                         </div>
                                     )}
                                     {voiceoverAudioUrl && (
                                         <div className="w-full flex flex-col items-center gap-2">
                                             <audio ref={voiceoverAudioRef} src={voiceoverAudioUrl} controls className="w-full"></audio>
                                             <button onClick={() => { voiceoverVideoRef.current?.play(); voiceoverAudioRef.current?.play(); }} className="quick-action-button">Play with Voiceover</button>
                                         </div>
                                     )}
                                </div>
                             )}
                        </div>
                    </div>)}
                     {activePanel === 'lyrics' && songLyrics && (
                        <SongLyricsPanel
                            song={songLyrics}
                            onClose={() => {
                                setSongLyrics(null);
                                setActivePanel('transcript');
                            }}
                        />
                    )}
                    {activePanel === 'weather' && (<div className="flex-grow p-6 overflow-y-auto">{!weatherData ? <div className="flex items-center justify-center h-full text-text-color-muted"><p>Ask for the weather to see the forecast.</p></div> : <WeatherPanel data={weatherData} />}</div>)}
                    {activePanel === 'news' && (<div className="flex-grow p-6 overflow-y-auto">{newsArticles.length === 0 ? <div className="flex items-center justify-center h-full text-text-color-muted"><p>Ask for news to see the latest headlines.</p></div> : <NewsPanel articles={newsArticles} />}</div>)}
                    {activePanel === 'timer' && (<div className="flex-grow p-6 overflow-y-auto">{!timer ? <div className="flex items-center justify-center h-full text-text-color-muted"><p>Ask to set a timer.</p></div> : <TimerPanel timer={timer} />}</div>)}
                </section>
            </main>
            <AvatarCustomizationModal 
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                avatars={avatars}
                currentAvatar={currentAvatar}
                onSelectAvatar={(avatar) => {
                    setCurrentAvatar(avatar);
                    localStorage.setItem('kaniska-current-avatar', avatar);
                }}
                onUploadAvatar={(newAvatar) => {
                    const updatedAvatars = [newAvatar, ...avatars];
                    setAvatars(updatedAvatars);
                    localStorage.setItem('kaniska-avatars', JSON.stringify(updatedAvatars));
                }}
                onGenerateAvatar={handleGenerateAvatar}
                generatedAvatarResult={generatedAiAvatar}
                customGreeting={customGreeting}
                onSaveGreeting={handleSaveGreeting}
                customPersonality={customPersonality}
                onSavePersonality={handleSavePersonality}
            />
             <ImageEditorModal
                isOpen={!!editingImage}
                image={editingImage}
                onClose={() => setEditingImage(null)}
                onSave={(newImageUrl) => {
                    if (editingImage) {
                        const updatedImages = generatedImages.map(img => 
                            img.id === editingImage.id ? { ...img, url: newImageUrl } : img
                        );
                        setGeneratedImages(updatedImages);
                        setSelectedImage(prev => prev && prev.id === editingImage.id ? { ...prev, url: newImageUrl } : prev);
                    }
                    setEditingImage(null);
                }}
            />
            <LiveImageEditorModal
                isOpen={!!liveEditingImage}
                image={liveEditingImage}
                filters={liveEditFilters}
                transform={liveEditTransform}
                onClose={() => {
                    setLiveEditingImage(null);
                    sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ text: "Live editing session canceled." }));
                }}
                onSave={(newImageUrl) => {
                    if (liveEditingImage) {
                        const updatedImages = generatedImages.map(img =>
                            img.id === liveEditingImage.id ? { ...img, url: newImageUrl } : img
                        );
                        setGeneratedImages(updatedImages);
                        setSelectedImage(prev => prev && prev.id === liveEditingImage.id ? { ...prev, url: newImageUrl } : prev);
                    }
                    setLiveEditingImage(null);
                    sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ text: "Live editing session finished and changes saved." }));
                }}
                onReset={() => {
                    setLiveEditFilters(initialFilters);
                    setLiveEditTransform(initialTransforms);
                    const resetState = { ...initialFilters, ...initialTransforms };
                    const resetMessage = `The image edits have been reset. The current state is now back to default: ${JSON.stringify(resetState)}.`;
                    sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ text: resetMessage }));
                     setTranscriptions(p => [...p, { speaker: 'system', text: 'Live image edits have been reset.', timestamp: new Date() }]);
                }}
            />
        </div>
    );
};

const SongLyricsPanel: React.FC<{
    song: { name: string; artist: string; lyrics: string[]; currentLine: number };
    onClose: () => void;
}> = ({ song, onClose }) => {
    const currentLineRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        currentLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [song.currentLine]);

    return (
        <div className="flex flex-col h-full overflow-hidden p-6 bg-black/20">
            <div className="flex-shrink-0 mb-4 text-center">
                <h2 className="text-3xl font-bold glowing-text">{song.name}</h2>
                <p className="text-lg text-text-color-muted">{song.artist}</p>
            </div>
            <ul className="flex-grow overflow-y-auto text-center space-y-4">
                {song.lyrics.map((line, index) => (
                    <li
                        key={index}
                        ref={index === song.currentLine ? currentLineRef : null}
                        className={`text-2xl transition-all duration-300 ${
                            index === song.currentLine
                                ? 'font-bold text-primary-color scale-110'
                                : 'text-text-color-muted'
                        }`}
                    >
                        {line || '♪'}
                    </li>
                ))}
            </ul>
            <div className="flex-shrink-0 mt-4 text-center">
                <button onClick={onClose} className="quick-action-button">
                    Close Lyrics
                </button>
            </div>
        </div>
    );
};

const QuickActions: React.FC<{ onAction: (action: string) => void, disabled: boolean }> = ({ onAction, disabled }) => {
    const actions = [
        { id: 'joke', label: 'Tell me a joke', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg> },
        { id: 'weather', label: "What's the weather?", icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg> },
        { id: 'music', label: 'Play music', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
        { id: 'news', label: 'Latest news', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2V4" /><path d="M16 2v20" /><path d="M8 7h4" /><path d="M8 12h4" /><path d="M8 17h4" /></svg> },
    ];

    return (
        <div className="flex-shrink-0 p-3 border-t border-border-color bg-panel-bg">
            <div className="flex items-center justify-center gap-2 flex-wrap">
                {actions.map(action => (
                    <button
                        key={action.id}
                        onClick={() => onAction(action.id)}
                        disabled={disabled}
                        className="quick-action-button"
                    >
                        {action.icon}
                        <span className="text-xs">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};


const AvatarCustomizationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    avatars: string[];
    currentAvatar: string;
    onSelectAvatar: (avatar: string) => void;
    onUploadAvatar: (avatar: string) => void;
    onGenerateAvatar: (prompt: string) => void;
    generatedAvatarResult: GeneratedAvatar;
    customGreeting: string;
    onSaveGreeting: (greeting: string) => void;
    customPersonality: string;
    onSavePersonality: (personality: string) => void;
}> = ({ isOpen, onClose, avatars, currentAvatar, onSelectAvatar, onUploadAvatar, onGenerateAvatar, generatedAvatarResult, customGreeting, onSaveGreeting, customPersonality, onSavePersonality }) => {
    const [activeTab, setActiveTab] = useState<'gallery' | 'ai' | 'personality'>('gallery');
    const [prompt, setPrompt] = useState('');
    const [greetingInput, setGreetingInput] = useState(customGreeting);
    const [personalityInput, setPersonalityInput] = useState(customPersonality);
    const [showGreetingSaved, setShowGreetingSaved] = useState(false);
    const [showPersonalitySaved, setShowPersonalitySaved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Find and Replace State ---
    const [isFindReplaceVisible, setIsFindReplaceVisible] = useState(false);
    const [findValue, setFindValue] = useState('');
    const [replaceValue, setReplaceValue] = useState('');
    const [isCaseSensitive, setIsCaseSensitive] = useState(false);
    const [foundMatches, setFoundMatches] = useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const personalityTextareaRef = useRef<HTMLTextAreaElement>(null);
    
    const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    useEffect(() => {
        if (!isFindReplaceVisible || !findValue) {
            setFoundMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }
        const flags = isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(escapeRegExp(findValue), flags);
        const matches = [];
        let match;
        while ((match = regex.exec(personalityInput)) !== null) {
            matches.push(match.index);
        }
        setFoundMatches(matches);
        setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
    }, [findValue, personalityInput, isCaseSensitive, isFindReplaceVisible]);

    useEffect(() => {
        if (currentMatchIndex !== -1 && personalityTextareaRef.current && foundMatches.length > 0) {
            const startIndex = foundMatches[currentMatchIndex];
            const endIndex = startIndex + findValue.length;
            personalityTextareaRef.current.focus();
            personalityTextareaRef.current.setSelectionRange(startIndex, endIndex);
        }
    }, [currentMatchIndex, foundMatches, findValue.length]);
    
    const handleNavigateMatch = (direction: 'next' | 'prev') => {
        if (foundMatches.length < 2) return;
        const nextIndex = direction === 'next' 
            ? (currentMatchIndex + 1) % foundMatches.length
            : (currentMatchIndex - 1 + foundMatches.length) % foundMatches.length;
        setCurrentMatchIndex(nextIndex);
    };

    const handleReplace = () => {
        if (currentMatchIndex === -1 || foundMatches.length === 0) return;
        const startIndex = foundMatches[currentMatchIndex];
        const newText = 
            personalityInput.substring(0, startIndex) +
            replaceValue +
            personalityInput.substring(startIndex + findValue.length);
        setPersonalityInput(newText);
    };
    
    const handleReplaceAll = () => {
        if (!findValue) return;
        const flags = isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(escapeRegExp(findValue), flags);
        const newText = personalityInput.replace(regex, replaceValue);
        setPersonalityInput(newText);
    };

    useEffect(() => {
        if (isOpen) {
            setGreetingInput(customGreeting);
            setPersonalityInput(customPersonality);
            // Reset find/replace on open
            setIsFindReplaceVisible(false);
            setFindValue('');
            setReplaceValue('');
        }
    }, [isOpen, customGreeting, customPersonality]);

    if (!isOpen) return null;
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    onUploadAvatar(e.target.result as string);
                    setActiveTab('gallery'); // Switch back to gallery after upload
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSaveGenerated = () => {
        if (generatedAvatarResult.url) {
            onUploadAvatar(generatedAvatarResult.url);
            onSelectAvatar(generatedAvatarResult.url);
            setActiveTab('gallery');
        }
    };

    const handleGreetingSave = () => {
        onSaveGreeting(greetingInput);
        setShowGreetingSaved(true);
        setTimeout(() => setShowGreetingSaved(false), 2000);
    };
    
    const handlePersonalitySave = () => {
        onSavePersonality(personalityInput);
        setShowPersonalitySaved(true);
        setTimeout(() => setShowPersonalitySaved(false), 2000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content avatar-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Customize Assistant</h2>
                    <button onClick={onClose} className="text-text-color-muted hover:text-white">&times;</button>
                </header>
                 <div className="flex-shrink-0 flex items-center border-b border-border-color">
                    <button onClick={() => setActiveTab('gallery')} className={`tab-button ${activeTab === 'gallery' ? 'active' : ''}`}>Avatar Gallery</button>
                    <button onClick={() => setActiveTab('ai')} className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}>Create Avatar</button>
                    <button onClick={() => setActiveTab('personality')} className={`tab-button ${activeTab === 'personality' ? 'active' : ''}`}>Personality</button>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {activeTab === 'gallery' && (
                        <div className="avatar-gallery-grid">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="avatar-item upload-avatar-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mb-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                <span className="text-xs">Upload</span>
                            </button>
                            {avatars.map((avatar, index) => (
                                <button key={index} className={`avatar-item ${currentAvatar === avatar ? 'selected' : ''}`} onClick={() => onSelectAvatar(avatar)}>
                                    <img src={avatar} alt={`Avatar ${index + 1}`} />
                                </button>
                            ))}
                        </div>
                    )}
                    {activeTab === 'ai' && (
                       <div className="p-4 flex flex-col gap-4 h-full">
                           <p className="text-sm text-text-color-muted">Describe the avatar you want to create. Be specific for the best results!</p>
                           <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="e.g., A cyberpunk woman with neon pink hair and glowing blue eyes..." className="w-full bg-assistant-bubble-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-color focus:outline-none transition"></textarea>
                           <button onClick={() => onGenerateAvatar(prompt)} disabled={generatedAvatarResult.isLoading || !prompt} className="w-full bg-primary-color/80 hover:bg-primary-color text-bg-color font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                               {generatedAvatarResult.isLoading ? 'Generating...' : 'Generate'}
                           </button>
                           <div className="flex-grow bg-black/30 rounded-lg flex items-center justify-center min-h-[200px]">
                               {generatedAvatarResult.isLoading && <div className="flex flex-col items-center gap-2 text-text-color-muted"><div className="w-8 h-8 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div><span>Generating...</span></div>}
                               {generatedAvatarResult.error && <div className="text-red-400 text-center p-4"><strong>Error:</strong><br/>{generatedAvatarResult.error}</div>}
                               {generatedAvatarResult.url && <img src={generatedAvatarResult.url} alt="Generated Avatar" className="max-w-full max-h-full object-contain rounded"/>}
                           </div>
                           {generatedAvatarResult.url && (
                                <button onClick={handleSaveGenerated} className="w-full bg-green-500/80 hover:bg-green-500 text-bg-color font-bold py-2 px-4 rounded-md transition">
                                   Save to Gallery & Select
                                </button>
                           )}
                       </div>
                    )}
                    {activeTab === 'personality' && (
                        <div className="p-4 flex flex-col gap-4 h-full">
                            <h3 className="font-semibold text-text-color">Custom Greeting</h3>
                            <p className="text-sm text-text-color-muted -mt-2">Set a custom message for Kaniska to say when you start a new session.</p>
                            <textarea
                                value={greetingInput}
                                onChange={(e) => setGreetingInput(e.target.value)}
                                rows={3}
                                placeholder="e.g., Hello! How can I help you today?"
                                className="w-full bg-assistant-bubble-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-color focus:outline-none transition"
                            ></textarea>
                            <div className="flex items-center gap-4">
                                <button onClick={handleGreetingSave} disabled={!greetingInput} className="bg-primary-color/80 hover:bg-primary-color text-bg-color font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                                    Save Greeting
                                </button>
                                {showGreetingSaved && <span className="text-sm text-green-400">Saved!</span>}
                            </div>
                            
                            <div className="flex items-center justify-between mt-4">
                                <h3 className="font-semibold text-text-color">Personality & Backstory</h3>
                                <button onClick={() => setIsFindReplaceVisible(!isFindReplaceVisible)} title="Find & Replace" className="editor-history-button"><FindReplaceIcon /></button>
                            </div>
                            <p className="text-sm text-text-color-muted -mt-2">Define a unique personality for Kaniska. This will influence her responses and behavior.</p>
                            
                            {isFindReplaceVisible && (
                                <div className="p-2 border border-border-color rounded-md bg-assistant-bubble-bg flex flex-col gap-2 text-sm animate-fade-in-down">
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Find" value={findValue} onChange={e => setFindValue(e.target.value)} className="w-full bg-panel-bg border border-border-color rounded px-2 py-1 focus:ring-1 focus:ring-primary-color focus:outline-none"/>
                                        <input type="text" placeholder="Replace with" value={replaceValue} onChange={e => setReplaceValue(e.target.value)} className="w-full bg-panel-bg border border-border-color rounded px-2 py-1 focus:ring-1 focus:ring-primary-color focus:outline-none"/>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setIsCaseSensitive(!isCaseSensitive)} className={`px-2 py-0.5 rounded border ${isCaseSensitive ? 'bg-primary-color text-bg-color border-primary-color' : 'bg-transparent border-border-color'}`} title="Case Sensitive">Aa</button>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleNavigateMatch('prev')} disabled={foundMatches.length < 2} className="px-2 disabled:opacity-50">&lt;</button>
                                                <span className="text-xs text-text-color-muted w-20 text-center">{foundMatches.length > 0 ? `${currentMatchIndex + 1} of ${foundMatches.length}` : 'No matches'}</span>
                                                <button onClick={() => handleNavigateMatch('next')} disabled={foundMatches.length < 2} className="px-2 disabled:opacity-50">&gt;</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleReplace} disabled={foundMatches.length === 0} className="px-2 py-1 text-xs bg-assistant-bubble-bg border border-border-color rounded hover:border-primary-color disabled:opacity-50">Replace</button>
                                            <button onClick={handleReplaceAll} disabled={foundMatches.length === 0} className="px-2 py-1 text-xs bg-assistant-bubble-bg border border-border-color rounded hover:border-primary-color disabled:opacity-50">Replace All</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <textarea
                                ref={personalityTextareaRef}
                                value={personalityInput}
                                onChange={(e) => setPersonalityInput(e.target.value)}
                                rows={6}
                                placeholder="e.g., A witty and sarcastic spaceship pilot who has seen every corner of the galaxy..."
                                className="w-full bg-assistant-bubble-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-color focus:outline-none transition"
                            ></textarea>
                            <div className="flex items-center gap-4">
                                <button onClick={handlePersonalitySave} className="bg-primary-color/80 hover:bg-primary-color text-bg-color font-bold py-2 px-4 rounded-md transition">
                                    Save Personality
                                </button>
                                {showPersonalitySaved && <span className="text-sm text-green-400">Saved!</span>}
                            </div>
                        </div>
                    )}
                </div>
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
    const [history, setHistory] = useState<ImageEditState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(null);
    const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);

    const getInitialState = useCallback((width = 0, height = 0): ImageEditState => ({
        filters: { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, invert: 0 },
        transform: { rotate: 0, scaleX: 1, scaleY: 1 },
        resizeWidth: width,
        resizeHeight: height,
        cropRect: null,
    }), []);

    useEffect(() => {
        if (isOpen && image?.url) {
            const img = new Image();
            img.onload = () => {
                const initialState = getInitialState(img.naturalWidth, img.naturalHeight);
                setOriginalImageSize({ width: img.naturalWidth, height: img.naturalHeight });
                setHistory([initialState]);
                setHistoryIndex(0);
            };
            img.src = image.url;
        } else {
            setOriginalImageSize(null);
            setHistory([]);
            setHistoryIndex(0);
        }
    }, [isOpen, image, getInitialState]);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    const currentState = history[historyIndex] || getInitialState();

    const updateState = (updates: Partial<ImageEditState>) => {
        const nextState: ImageEditState = {
            ...currentState,
            ...updates,
            filters: { ...currentState.filters, ...(updates.filters || {}) },
            transform: { ...currentState.transform, ...(updates.transform || {}) },
        };
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(nextState);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    if (!isOpen || !image || !image.url) return null;
    
    const handleUndo = () => canUndo && setHistoryIndex(historyIndex - 1);
    const handleRedo = () => canRedo && setHistoryIndex(historyIndex + 1);
    const handleResetAll = () => {
         if (originalImageSize) {
            const initialState = getInitialState(originalImageSize.width, originalImageSize.height);
            updateState(initialState);
        }
    }

    const handleSave = () => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const { filters, transform, resizeWidth, resizeHeight, cropRect } = currentState;
            const sourceX = cropRect ? cropRect.x : 0;
            const sourceY = cropRect ? cropRect.y : 0;
            const sourceWidth = cropRect ? cropRect.width : img.naturalWidth;
            const sourceHeight = cropRect ? cropRect.height : img.naturalHeight;

            const isSideways = transform.rotate % 180 !== 0;
            const canvasWidth = isSideways ? resizeHeight : resizeWidth;
            const canvasHeight = isSideways ? resizeWidth : resizeHeight;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) invert(${filters.invert}%)`;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((transform.rotate * Math.PI) / 180);
            ctx.scale(transform.scaleX, transform.scaleY);
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, -resizeWidth / 2, -resizeHeight / 2, resizeWidth, resizeHeight);

            const newImageUrl = canvas.toDataURL('image/jpeg', 0.9);
            onSave(newImageUrl);
        };
        img.src = image.url;
    };
    
    const handleResize = (val: string, dimension: 'width' | 'height') => {
        const numVal = parseInt(val, 10) || 0;
        let newWidth = currentState.resizeWidth;
        let newHeight = currentState.resizeHeight;

        if (dimension === 'width') {
            newWidth = numVal;
            if (maintainAspectRatio && originalImageSize) {
                const ratio = originalImageSize.height / originalImageSize.width;
                newHeight = Math.round(numVal * ratio);
            }
        } else {
            newHeight = numVal;
            if (maintainAspectRatio && originalImageSize) {
                const ratio = originalImageSize.width / originalImageSize.height;
                newWidth = Math.round(numVal * ratio);
            }
        }
        updateState({ resizeWidth: newWidth, resizeHeight: newHeight });
    };

    const handleSetCrop = (aspectRatio: number) => {
        if (!originalImageSize) return;
        const { width: W, height: H } = originalImageSize;
        const currentRatio = W / H;

        let w, h, x, y;
        if (currentRatio > aspectRatio) { // Image is wider
            h = H; w = H * aspectRatio; y = 0; x = (W - w) / 2;
        } else { // Image is taller or same
            w = W; h = W / aspectRatio; x = 0; y = (H - h) / 2;
        }
        updateState({ cropRect: { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) } });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content editor-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Edit Image</h2>
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-1 border border-border-color rounded-md p-0.5">
                             <button onClick={handleUndo} disabled={!canUndo} className="editor-history-button" aria-label="Undo"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h13a5 5 0 0 1 0 10H7"/><path d="m6 15-3-3 3-3"/></svg></button>
                             <button onClick={handleRedo} disabled={!canRedo} className="editor-history-button" aria-label="Redo"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 9H8a5 5 0 0 0 0 10h9"/><path d="m18 15 3-3-3-3"/></svg></button>
                         </div>
                         <button onClick={handleResetAll} className="px-3 py-1 text-sm bg-assistant-bubble-bg border border-border-color rounded-md hover:border-yellow-400 hover:text-yellow-400 transition">Reset All</button>
                         <button onClick={handleSave} className="px-3 py-1 text-sm bg-primary-color/80 hover:bg-primary-color text-bg-color font-semibold rounded-md transition">Save Changes</button>
                        <button onClick={onClose} className="text-text-color-muted hover:text-white">&times;</button>
                    </div>
                </header>
                <div className="editor-layout">
                    <div className="editor-preview-pane">
                        <img src={image.url} alt="Editing preview" style={{
                            transform: `rotate(${currentState.transform.rotate}deg) scaleX(${currentState.transform.scaleX}) scaleY(${currentState.transform.scaleY})`,
                            filter: `brightness(${currentState.filters.brightness}%) contrast(${currentState.filters.contrast}%) saturate(${currentState.filters.saturate}%) grayscale(${currentState.filters.grayscale}%) sepia(${currentState.filters.sepia}%) invert(${currentState.filters.invert}%)`
                        }}/>
                    </div>
                    <div className="editor-controls-pane">
                        <div className="editor-control-group">
                            <h3>Adjustments</h3>
                            <div className="editor-slider-group">
                                <label><span>Brightness</span><span>{currentState.filters.brightness}%</span></label>
                                <input type="range" min="0" max="200" value={currentState.filters.brightness} onChange={e => updateState({ filters: { ...currentState.filters, brightness: +e.target.value }})} />
                            </div>
                            <div className="editor-slider-group">
                                <label><span>Contrast</span><span>{currentState.filters.contrast}%</span></label>
                                <input type="range" min="0" max="200" value={currentState.filters.contrast} onChange={e => updateState({ filters: { ...currentState.filters, contrast: +e.target.value }})} />
                            </div>
                            <div className="editor-slider-group">
                                <label><span>Saturation</span><span>{currentState.filters.saturate}%</span></label>
                                <input type="range" min="0" max="200" value={currentState.filters.saturate} onChange={e => updateState({ filters: { ...currentState.filters, saturate: +e.target.value }})} />
                            </div>
                        </div>
                         <div className="editor-control-group">
                            <h3>Filters</h3>
                            <div className="editor-button-grid">
                               <button className="editor-button" onClick={() => updateState({ filters: { ...currentState.filters, grayscale: currentState.filters.grayscale === 0 ? 100 : 0 }})}>Grayscale</button>
                               <button className="editor-button" onClick={() => updateState({ filters: { ...currentState.filters, sepia: currentState.filters.sepia === 0 ? 100 : 0 }})}>Sepia</button>
                               <button className="editor-button" onClick={() => updateState({ filters: { ...currentState.filters, invert: currentState.filters.invert === 0 ? 100 : 0 }})}>Invert</button>
                            </div>
                        </div>
                        <div className="editor-control-group">
                            <h3>Transform</h3>
                            <div className="editor-button-grid">
                                <button className="editor-button" onClick={() => updateState({ transform: { ...currentState.transform, rotate: (currentState.transform.rotate - 90) % 360 }})}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg> Rotate Left</button>
                                <button className="editor-button" onClick={() => updateState({ transform: { ...currentState.transform, rotate: (currentState.transform.rotate + 90) % 360 }})}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg> Rotate Right</button>
                                <button className="editor-button" onClick={() => updateState({ transform: { ...currentState.transform, scaleX: currentState.transform.scaleX * -1 }})}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V2M6 8l-4 4 4 4M18 16l4-4-4-4"/></svg> Flip H</button>
                                <button className="editor-button" onClick={() => updateState({ transform: { ...currentState.transform, scaleY: currentState.transform.scaleY * -1 }})}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12H2M8 6l-4 4 4 4M16 18l-4-4 4-4"/></svg> Flip V</button>
                            </div>
                        </div>
                        <div className="editor-control-group">
                            <h3>Resize</h3>
                            <div className="editor-resize-inputs">
                                <input type="number" value={currentState.resizeWidth} onChange={e => handleResize(e.target.value, 'width')} aria-label="Resize width"/>
                                <span className="text-text-color-muted">&times;</span>
                                <input type="number" value={currentState.resizeHeight} onChange={e => handleResize(e.target.value, 'height')} aria-label="Resize height"/>
                            </div>
                            <label className="editor-aspect-lock"><input type="checkbox" checked={maintainAspectRatio} onChange={e => setMaintainAspectRatio(e.target.checked)} /> Maintain aspect ratio</label>
                        </div>
                        <div className="editor-control-group">
                            <h3>Crop</h3>
                             <p className="text-xs text-text-color-muted mb-2">Applies a center crop. Result visible on save.</p>
                             <div className="grid grid-cols-3 gap-2">
                               <button className="editor-button" onClick={() => handleSetCrop(1/1)}>1:1</button>
                               <button className="editor-button" onClick={() => handleSetCrop(16/9)}>16:9</button>
                               <button className="editor-button" onClick={() => handleSetCrop(4/3)}>4:3</button>
                               <button className="editor-button col-span-3" onClick={() => updateState({ cropRect: null })}>Reset Crop</button>
                            </div>
                        </div>
                    </div>
                </div>
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

    const handleSave = () => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const isSideways = transform.rotate % 180 !== 0;
            const canvasWidth = isSideways ? img.naturalHeight : img.naturalWidth;
            const canvasHeight = isSideways ? img.naturalWidth : img.naturalHeight;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) invert(${filters.invert}%)`;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((transform.rotate * Math.PI) / 180);
            ctx.scale(transform.scaleX, transform.scaleY);
            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
            
            const newImageUrl = canvas.toDataURL('image/jpeg', 0.9);
            onSave(newImageUrl);
        };
        img.src = image.url;
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content live-editor-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
                    <h2 className="text-lg font-semibold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>Live Image Editor</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={onReset} className="px-4 py-2 text-sm bg-yellow-600/80 hover:bg-yellow-600 border border-yellow-500/50 text-white font-semibold rounded-md transition">Reset</button>
                        <button onClick={onClose} className="px-4 py-2 text-sm bg-red-600/80 hover:bg-red-600 border border-red-500/50 text-white font-semibold rounded-md transition">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 text-sm bg-primary-color/80 hover:bg-primary-color border border-cyan-400/50 text-bg-color font-semibold rounded-md transition">Finish & Save</button>
                    </div>
                </header>
                <div className="live-editor-layout">
                    <div className="live-editor-preview-pane">
                         <img
                            src={image.url}
                            alt="Live editing preview"
                            className="live-editor-preview-image"
                            style={{
                                transform: `rotate(${transform.rotate}deg) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`,
                                filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) invert(${filters.invert}%)`
                            }}
                        />
                    </div>
                    <div className="live-editor-controls-pane">
                        <div className="editor-control-group">
                            <h3>Adjustments</h3>
                            <div className="editor-slider-group">
                                <label><span>Brightness</span><span>{filters.brightness}%</span></label>
                                <input type="range" min="0" max="200" value={filters.brightness} readOnly />
                            </div>
                            <div className="editor-slider-group">
                                <label><span>Contrast</span><span>{filters.contrast}%</span></label>
                                <input type="range" min="0" max="200" value={filters.contrast} readOnly />
                            </div>
                            <div className="editor-slider-group">
                                <label><span>Saturation</span><span>{filters.saturate}%</span></label>
                                <input type="range" min="0" max="200" value={filters.saturate} readOnly />
                            </div>
                        </div>
                         <div className="editor-control-group">
                            <h3>Filters</h3>
                            <div className="editor-button-grid">
                               <button className={`editor-button ${filters.grayscale > 50 ? 'active' : ''}`}>Grayscale</button>
                               <button className={`editor-button ${filters.sepia > 50 ? 'active' : ''}`}>Sepia</button>
                               <button className={`editor-button ${filters.invert > 50 ? 'active' : ''}`}>Invert</button>
                            </div>
                        </div>
                        <div className="editor-control-group">
                            <h3>Transform</h3>
                            <div className="editor-slider-group">
                                <label><span>Rotate</span><span>{transform.rotate}°</span></label>
                            </div>
                             <div className="editor-button-grid">
                               <button className={`editor-button ${transform.scaleX === -1 ? 'active' : ''}`}>Flipped H</button>
                               <button className={`editor-button ${transform.scaleY === -1 ? 'active' : ''}`}>Flipped V</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="live-editor-status">
                    <span className="live-editor-status-dot"></span>
                    <span>Listening for commands...</span>
                </div>
            </div>
        </div>
    );
};


const WeatherPanel: React.FC<{ data: WeatherData }> = ({ data }) => {
    const renderWeatherIcon = () => {
        const condition = data.condition.toLowerCase();

        if (condition.includes('thunder') || condition.includes('storm')) {
            return (<>
                <svg viewBox="0 0 64 64" className="weather-cloud"><path d="M47.7,35.4c0-7.3-5.9-13.2-13.2-13.2c-5.1,0-9.5,2.9-11.8,7c-1.4-0.6-3-1-4.6-1c-5.5,0-10,4.5-10,10s4.5,10,10,10h29.5 C47.5,48.2,47.7,35.6,47.7,35.4z" fill="currentColor" /></svg>
                <svg viewBox="0 0 64 64" className="weather-lightning"><polygon points="30,38 40,32 30,52 38,52 28,62 30,44 24,44" fill="#f59e0b" /></svg>
            </>);
        }
        if (condition.includes('snow') || condition.includes('sleet') || condition.includes('blizzard') || condition.includes('ice')) {
            const flakes = Array.from({ length: 5 }).map((_, i) => (
                <path key={i} className="weather-snow-flake" style={{ animationDelay: `${i * 1}s` }} d="M32 20v24m-12-12h24M23.5 27.5l17 17m-17 0l17-17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            ));
            return <svg viewBox="0 0 64 64" className="weather-snow">{flakes}</svg>;
        }
        if (condition.includes('rain') || condition.includes('drizzle')) {
            return (<>
                <svg viewBox="0 0 64 64" className="weather-cloud"><path d="M47.7,35.4c0-7.3-5.9-13.2-13.2-13.2c-5.1,0-9.5,2.9-11.8,7c-1.4-0.6-3-1-4.6-1c-5.5,0-10,4.5-10,10s4.5,10,10,10h29.5 C47.5,48.2,47.7,35.6,47.7,35.4z" fill="currentColor" /></svg>
                <div className="rain-container">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="weather-rain-drop" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random()}s` }}></div>)}</div>
            </>);
        }
         if (condition.includes('fog') || condition.includes('mist')) {
            return (<>
                <svg viewBox="0 0 64 64" className="weather-cloud"><path d="M47.7,35.4c0-7.3-5.9-13.2-13.2-13.2c-5.1,0-9.5,2.9-11.8,7c-1.4-0.6-3-1-4.6-1c-5.5,0-10,4.5-10,10s4.5,10,10,10h29.5 C47.5,48.2,47.7,35.6,47.7,35.4z" fill="currentColor" /></svg>
                <g className="weather-fog">
                    <line x1="12" y1="52" x2="52" y2="52" />
                    <line x1="16" y1="58" x2="48" y2="58" />
                </g>
            </>);
        }
        if (condition.includes('partly cloudy')) {
            return (<>
                <svg viewBox="0 0 64 64" className="weather-sun"><circle cx="32" cy="32" r="14" fill="currentColor" /><path d="M32 0v8m0 48v8m32-32h-8M8 32H0m26.86-19.86l-5.66-5.66M4.5 59.5l5.66-5.66m43.18 0l-5.66 5.66m5.66-43.18l-5.66 5.66" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
                <svg viewBox="0 0 64 64" className="weather-cloud weather-cloud-back"><path d="M47.7,35.4c0-7.3-5.9-13.2-13.2-13.2c-5.1,0-9.5,2.9-11.8,7c-1.4-0.6-3-1-4.6-1c-5.5,0-10,4.5-10,10s4.5,10,10,10h29.5 C47.5,48.2,47.7,35.6,47.7,35.4z" fill="currentColor" /></svg>
            </>);
        }
        if (condition.includes('sun') || condition.includes('clear')) {
            return <svg viewBox="0 0 64 64" className="weather-sun"><circle cx="32" cy="32" r="14" fill="currentColor" /><path d="M32 0v8m0 48v8m32-32h-8M8 32H0m26.86-19.86l-5.66-5.66M4.5 59.5l5.66-5.66m43.18 0l-5.66 5.66m5.66-43.18l-5.66 5.66" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
        }
        // Default to cloudy/overcast
        return <svg viewBox="0 0 64 64" className="weather-cloud"><path d="M47.7,35.4c0-7.3-5.9-13.2-13.2-13.2c-5.1,0-9.5,2.9-11.8,7c-1.4-0.6-3-1-4.6-1c-5.5,0-10,4.5-10,10s4.5,10,10,10h29.5 C47.5,48.2,47.7,35.6,47.7,35.4z" fill="currentColor" /></svg>;
    };
    return (
        <div className="weather-panel">
            <h2 className="text-3xl font-bold">{data.location}</h2>
            <div className="weather-icon-container">{renderWeatherIcon()}</div>
            <p className="text-6xl font-bold glowing-text">{data.temperature}°C</p>
            <p className="text-xl text-text-color-muted">{data.condition}</p>
            <div className="flex gap-8 mt-4">
                <span>Humidity: {data.humidity}%</span>
                <span>Wind: {data.windSpeed} km/h</span>
            </div>
        </div>
    );
};
const NewsPanel: React.FC<{ articles: NewsArticle[] }> = ({ articles }) => (
    <div className="p-2">
        {articles.map((article, index) => (
            <div key={index} className="news-article">
                <h3 className="text-lg font-semibold text-primary-color mb-1">{article.title}</h3>
                <p className="text-sm text-text-color-muted">{article.summary}</p>
            </div>
        ))}
    </div>
);
const TimerPanel: React.FC<{ timer: TimerData }> = ({ timer }) => {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (timer.remaining / timer.duration) * circumference;
    const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substr(11, 8);
    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="relative w-64 h-64">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" strokeWidth="5" className="stroke-border-color" fill="none" />
                    <circle cx="50" cy="50" r="45" strokeWidth="5" className="timer-circle stroke-primary-color" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
                </svg>
                <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold header-clock">{formatTime(timer.remaining)}</div>
                    {timer.remaining === 0 && <div className="mt-2 text-lg text-yellow-400">Time's up!</div>}
                </div>
            </div>
            <h2 className="text-2xl font-semibold">{timer.name}</h2>
        </div>
    );
};

export default App;
