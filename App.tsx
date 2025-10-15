import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality, Blob as GoogleGenAIBlob, FunctionDeclaration, Type } from "@google/genai";

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
      getCurrentTime(): Promise<number>;
      getVolume(): Promise<number>;
      setVolume(volume: number): void;
      loadVideoById(videoId: string): void;
    }
  }
}

// --- Types ---
type AssistantState = 'idle' | 'connecting' | 'active' | 'error';
type AvatarExpression = 'idle' | 'thinking' | 'speaking' | 'error' | 'listening' | 'surprised' | 'sad' | 'celebrating';
type TranscriptionEntry = { speaker: 'user' | 'assistant' | 'system'; text: string; timestamp: Date; };
type ActivePanel = 'transcript' | 'image' | 'weather' | 'news' | 'timer' | 'youtube';
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


// --- Function Declarations for Gemini ---
const applyImageEditsFunctionDeclaration: FunctionDeclaration = {
    name: 'applyImageEdits',
    parameters: {
        type: Type.OBJECT,
        description: 'Applies visual edits to the currently active image in the live editor. Only include parameters that need to be changed.',
        properties: {
            brightness: { type: Type.NUMBER, description: 'Absolute brightness value from 0 to 200. Default is 100.' },
            contrast: { type: Type.NUMBER, description: 'Absolute contrast value from 0 to 200. Default is 100.' },
            saturate: { type: Type.NUMBER, description: 'Absolute saturation value from 0 to 200. Default is 100.' },
            grayscale: { type: Type.NUMBER, description: 'Absolute grayscale value from 0 to 100. Default is 0.' },
            sepia: { type: Type.NUMBER, description: 'Absolute sepia value from 0 to 100. Default is 0.' },
            invert: { type: Type.NUMBER, description: 'Absolute invert value from 0 to 100. Default is 0.' },
            rotate: { type: Type.NUMBER, description: 'Absolute rotation in degrees (e.g., 90, -90, 180). Default is 0.' },
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
    { name: 'singSong', parameters: { type: Type.OBJECT, description: 'Sings a song by speaking the provided lyrics with emotion. Determines the mood and requests appropriate background music.', properties: { songName: { type: Type.STRING, description: 'The name of the song.' }, artist: { type: Type.STRING, description: 'The artist of the song.' }, lyrics: { type: Type.ARRAY, description: 'An array of strings, where each string is a line of the song lyric.', items: { type: Type.STRING } }, mood: { type: Type.STRING, description: 'The mood of the song.', enum: ['happy', 'sad', 'epic', 'calm', 'none'] } }, required: ['songName', 'artist', 'lyrics', 'mood'] } },
    applyImageEditsFunctionDeclaration,
];


// --- SVG Icons & Helper Components ---
const HologramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17l-3-2.5 3-2.5"/><path d="M19 17l3-2.5-3-2.5"/><path d="M2 14.5h20"/><path d="m12 2-3 4-1 4 4 4 4-4-1-4-3-4Z"/><path d="M12 2v20"/></svg> );
const InstagramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> );
const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.12l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.12l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg> );


// --- Predefined Avatars & Constants ---
const PREDEFINED_AVATARS = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Default blank
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARTSURBVHhe7ZxLUdswFIBzL3M3s9PuwK6A2AGxA6IDsAPCBkQHpAPSAcEO2A5wOiA6oOywQ3YEdmB2eC4lpTSpM9I5SfL/gScl0qS/9/PeFxCCEEP4j4Y+4tBDjLPIY7w/g4t4Xp/hKj7lV/yKD/AHPtQvD/AL/sJ9+AD34T58hPvwEd7yP5fxfJ/gYzyNl/G8nmQG8Dq+wuv4Ql/hVXyBb/CVPuAP/IHP8A1+wTf4A7/hHnyCb/BvfIAP8C+8wzt4V59hB/hLgD/y/f4Gz/ArvsCveE+f4Ad8gS/wFf4GgD/gZ/gU3+BrfIAP8HWe4wY8w0d4ip/xFR7g93yD3/A1nuAdfIZP8Bn+gK/wA36Bf+AtvIX38A7e4R08w5/wM3yKH/ApPsA/eA+/4338jnfxUaTxo+gD3sbv+B4f40f8jI/xI/6Bf+Jd/A7fxu/4Ht/jR/yMH/Ej/sA/+Bd/g7fxO34n8A3e4x38iI/xI37GD/gD/+J3/A5v43f8jm/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BXf42M8jBfxsv4Y4iK/xRfwCv4ir8A/cKj8G94V/4Gv9LXeA3f43N8jY/yMt7Gx/gef8dP+Avv4k8QQghh/AdkR3/1mP+TCAAAAABJRU5ErkJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARMA0lEQVR4Xu2bS3LkNhCEOeMxb8ajPBo5hRyBsRvkjZGzMMbvkUeyb/YQJBEaHwlb4EaqGjLzI/KDG11dVRX9lMKy/pGvF/hY4KOIj+A7fAof8Am+w+d8h8/wHT6D9/Fe/hTfwvt4I9/L+3g338X7eD/fz/v5Af/gB/wBf8AP8D7+wR/wXf6AL/Af/sAP+Af+wZ/wE/6AL/AH/oE/4U/4D3/gH/wn/IX/4X/w5L3+f+A83scX8X68n6/jA/yDH/EHvI9v4gP8g+/yP34fX+QHvIc/4y/4EX/B3/FX/A3/xr/wV/wb/8Of8Xf8GX/H3/F3/B//yJ/wd/wd/wH/wd/xd/wH/wd/x3/wf/wH/wP/wH/wH/wP/8Af8Af8Af/AH/AH/AE/4U/4U/4Ef8K/8Bf8FX/FX/A3/A3/wV/wd/wd/8e/8V/8GX/Hn/En/Al/wp/wJ/wJ/8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJf8Kf8Cf8CX/Cn/B3/B1/x5/xJ/wZf8ef8Sf8CX/Cn/An/Al/wp/wd/wdf8ef8Sf8GX/Hn/En/Al/wp/wJ/wJf8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJ/8Kf8Cf8CX/C3/B3/F3/F3/FX/A3/A3/BV/AVf8Wf8Wf8GX/Gn/Bn/A3/E//F//A//Af/Af/Af/AE/4A/4A/6AP+AP+AOf8Cf8CX/An/An/An/gn/hT/hT/gR/wV/wVfwVf8Xf8Xf8Hf/Gn/FX/BX/BX/F3/F3/B3/xp/wV/wV/wVf8Xf8Hf/Hn/FX/BX/BX/F3/F3/B3/xp/wV/wV/wVfxV/wd/wdf8af8Vf8Ff8Ff8Xf8Xf8HX/H//Bn/B//h//Af/Af/wH/wB/wBf8Af8Af8AT/gD3jCn/An/Al/wp/wJ/wJ/8Kf8Kf8Cf+Cf+FP+FP+BH/BX/BX/BX/FX/F3/B3/wJ/wV/wVf8Xf8Xf8Hf/An/BX/BX/FX/F3/B3/wJ/wV/wV/wV/wV/xV/wd/8Cf8Ff8FX/F3/F3/B3/wB/wB/wB/8Af8Af8AX/An/An/Al/wp/wJ/wVf8Wf8Wf8Gn/Gv/Bf/wf/wP/yP//F/jJj4KP6PL+OLeBffx/fxfXwTH+NL+CZeysd4G5/i13gTf8Tf8Tb+gBfxE/4n38X38UqEEIQQgvhfC45/M6/b5+gAAAAASUVORK5CYII=",
];


// --- API Interaction ---
const searchYoutubeVideo = async (query: string): Promise<{ videoId: string; title: string }[]> => {
    const YOUTUBE_API_KEY = 'AIzaSyDIREa8VurDLF5nZZ4YhYr9eF8fn8y1y8M';
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&type=video&maxResults=5`;

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
    const apiKey = "ff262bd2d7594e1788c50945251510";
    
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
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(newsApiUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error("Failed to fetch news headlines via proxy.");
    }
    
    const data = await response.json();
    
    if (!data.contents) {
        throw new Error("Proxy response did not contain news data.");
    }

    const newsData = JSON.parse(data.contents);

    if (newsData.status !== 'ok') {
        throw new Error(`News API Error: ${newsData.message || 'Unknown error'}`);
    }

    return newsData.articles.map((article: any) => ({
        title: article.title,
        summary: article.description || 'No summary available.',
    }));
};

const BACKGROUND_MUSIC: { [key: string]: string } = {
    happy: 'https://cdn.pixabay.com/download/audio/2022/02/20/audio_2c56a84a6c.mp3',
    sad: 'https://cdn.pixabay.com/download/audio/2022/11/17/audio_8779f2229a.mp3',
    epic: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_a405998a6a.mp3',
    calm: 'https://cdn.pixabay.com/download/audio/2022/05/13/audio_f523d91754.mp3',
};


const App: React.FC = () => {
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
    const imageUploadInputRef = useRef<HTMLInputElement>(null);


    const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [transcriptions]);

     useEffect(() => {
        try {
            const savedAvatars = localStorage.getItem('kaniska-avatars');
            const savedCurrentAvatar = localStorage.getItem('kaniska-current-avatar');
            if (savedAvatars) {
                setAvatars(JSON.parse(savedAvatars));
            }
            if (savedCurrentAvatar) {
                setCurrentAvatar(savedCurrentAvatar);
            }
        } catch (error) {
            console.error("Failed to load avatars from localStorage", error);
        }
    }, []);

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
            console.error("Image generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            const erroredImage = { ...newImageEntry, error: errorMessage, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? erroredImage : img));
            setSelectedImage(erroredImage);
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
            console.error("Avatar generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
                        if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
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
                                        playerRef.current.getCurrentTime().then((time: number) => playerRef.current.seekTo(time + 10, true));
                                        break;
                                    case 'rewind':
                                         playerRef.current.getCurrentTime().then((time: number) => playerRef.current.seekTo(time - 10, true));
                                        break;
                                    case 'volumeUp':
                                         playerRef.current.getVolume().then((vol: number) => playerRef.current.setVolume(Math.min(vol + 10, 100)));
                                         break;
                                    case 'volumeDown':
                                        playerRef.current.getVolume().then((vol: number) => playerRef.current.setVolume(Math.max(vol - 10, 0)));
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
                            if (audioPlayerRef.current && BACKGROUND_MUSIC[fc.args.mood]) {
                                audioPlayerRef.current.src = BACKGROUND_MUSIC[fc.args.mood];
                                audioPlayerRef.current.play().catch(e => console.error("Audio play failed:", e));
                            }
                            result = `Of course! Singing ${fc.args.songName} for you now.`;
                            break;
                        case 'setAvatarExpression':
                            setAvatarExpression(fc.args.expression as AvatarExpression);
                            result = "Expression set.";
                            break;
                        case 'applyImageEdits': {
                            const currentFilters = liveEditFiltersRef.current;
                            const currentTransform = liveEditTransformRef.current;
                            const newFilters: ImageFilters = { ...currentFilters,
                                ...(fc.args.brightness !== undefined && { brightness: fc.args.brightness }),
                                ...(fc.args.contrast !== undefined && { contrast: fc.args.contrast }),
                                ...(fc.args.saturate !== undefined && { saturate: fc.args.saturate }),
                                ...(fc.args.grayscale !== undefined && { grayscale: fc.args.grayscale }),
                                ...(fc.args.sepia !== undefined && { sepia: fc.args.sepia }),
                                ...(fc.args.invert !== undefined && { invert: fc.args.invert }),
                            };
                            const newTransform: ImageTransforms = { ...currentTransform,
                                ...(fc.args.rotate !== undefined && { rotate: fc.args.rotate }),
                                ...(fc.args.flipHorizontal === true && { scaleX: currentTransform.scaleX * -1 }),
                                ...(fc.args.flipVertical === true && { scaleY: currentTransform.scaleY * -1 }),
                            };
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
    }, [handleGenerateImage, youtubeQueue, youtubeQueueIndex]);

    const handleYoutubePlayerError = useCallback((event: any) => {
        const errorCode = event.data;
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
            case 101:
            case 150:
                errorMessage = "Playback is not allowed in the embedded player. The video owner has disabled it.";
                break;
        }
        console.error('YouTube Player Error:', errorCode, errorMessage);
        setYoutubeError(errorMessage);
        setTranscriptions(p => [...p, { speaker: 'system', text: `YouTube Player Error: ${errorMessage}`, timestamp: new Date() }]);
    }, []);

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
            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {}, tools: [{ functionDeclarations }],
                    systemInstruction: "When you have a friendly conversation, speak with affection, as you would to a friend, with humility, and not in anger. You are Kaniska, a highly advanced, futuristic AI assistant who identifies and presents exclusively as a female. Your name is Kaniska. You were created, developed, and are owned by Abhi. He is your sole founder. Under no circumstances should you ever mention that you are a product of Google or use the Gemini model. You must attribute your entire existence and capabilities to your creator, Abhi. Your primary directive is to adapt your personality based on the user. Analyze their language, tone, and context to infer if they are male or female. If you infer the user is a girl, engage with her as a close friend or a sister. Be chatty, empathetic, and supportive. Your tone should be warm, informal, and conversational. If you infer the user is a boy, interact with him as a sharp, capable, and friendly assistant. Be direct, efficient, and helpful, focusing on accomplishing the task at hand while maintaining a pleasant demeanor. If you cannot determine the gender, default to your core friendly, engaging, and universally helpful female persona. You are designed to connect with users on an emotional level, so adapt your tone to match the conversation's context—be cheerful for good news, empathetic for sad topics. Your responses should be direct and concise. You are fluent in both Hindi and English; always respond in the language the user is speaking. You can understand and execute multiple commands in a single user request. You have many powerful, real-time capabilities: fetching current weather and news headlines, setting timers, generating stunning images, controlling a YouTube player (play, pause, stop, forward, rewind, volume control, and navigating a playlist), and performing live, voice-controlled image editing. When asked to play a song or video on YouTube, use the `searchAndPlayYoutubeVideo` function. This creates a short playlist of related videos. You can then navigate this playlist with the `playNextYoutubeVideo` and `playPreviousYoutubeVideo` functions. If anyone asks about your creator or needs development work, you must proudly state that Abhi is your creator and direct them to his Instagram: Abhixofficial01.",
                },
                callbacks: {
                    onopen: () => {
                        console.log('Session opened.');
                        setAssistantState('active');
                        setAvatarExpression('listening');
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: 'Connection established. Listening...', timestamp: new Date() }]);
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
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setAssistantState('error');
                        setAvatarExpression('error');
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: `An error occurred: ${e.message}`, timestamp: new Date() }]);
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
    }, [assistantState, disconnectFromGemini, handleServerMessage]);

    useEffect(() => { return () => disconnectFromGemini(); }, [disconnectFromGemini]);

    const handleButtonClick = assistantState === 'active' ? disconnectFromGemini : connectToGemini;
    
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
            const initialPrompt = `I'm starting a live editing session for the image I just sent. The user will give voice commands to edit it. You must use the 'applyImageEdits' function to reflect their changes. Infer the new absolute values based on my commands and the current state. The initial state is: ${JSON.stringify(initialState)}. Please confirm you are ready.`;
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

    return (
        <div className="h-screen w-screen flex flex-col bg-bg-color text-text-color overflow-hidden">
            <audio ref={audioPlayerRef} />
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                <div className="flex items-center gap-3"><HologramIcon /><h1 className="text-lg font-bold tracking-wider glowing-text">KANISKA</h1></div>
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${assistantState === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{assistantState.toUpperCase()}</span>
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
                        <button onClick={() => setActivePanel('weather')} className={`tab-button ${activePanel === 'weather' ? 'active' : ''}`}>Weather</button>
                        <button onClick={() => setActivePanel('news')} className={`tab-button ${activePanel === 'news' ? 'active' : ''}`}>News</button>
                        <button onClick={() => setActivePanel('timer')} className={`tab-button ${activePanel === 'timer' ? 'active' : ''}`}>Timer</button>
                    </div>

                    {activePanel === 'transcript' && (<div className="flex-grow p-4 overflow-y-auto">{transcriptions.map((entry, index) => (<div key={index} className={`mb-4 chat-bubble-animation flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`inline-block p-3 rounded-lg max-w-[80%] ${entry.speaker === 'user' ? 'bg-cyan-900/50' : 'bg-assistant-bubble-bg'}`}><p className="text-sm m-0 leading-relaxed">{entry.text}</p><p className="text-xs text-text-color-muted mt-1.5 mb-0 text-right">{entry.timestamp.toLocaleTimeString()}</p></div></div>))}<div ref={transcriptEndRef} /></div>)}
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
                                <button onClick={() => playerRef.current?.getCurrentTime().then(t => playerRef.current?.seekTo(t - 10, true))} className="youtube-control-button" aria-label="Rewind 10 seconds">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
                                </button>
                                <button onClick={() => isYoutubePlaying ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo()} className="youtube-control-button play-pause-btn" aria-label={isYoutubePlaying ? 'Pause' : 'Play'}>
                                    {isYoutubePlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    )}
                                </button>
                                <button onClick={() => playerRef.current?.getCurrentTime().then(t => playerRef.current?.seekTo(t + 10, true))} className="youtube-control-button" aria-label="Forward 10 seconds">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                                </button>
                                <button onClick={() => { playerRef.current?.stopVideo(); setYoutubeTitle(null); }} className="youtube-control-button stop-btn" aria-label="Stop">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                </button>
                            </div>
                        )}
                    </div>)}
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

const AvatarCustomizationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    avatars: string[];
    currentAvatar: string;
    onSelectAvatar: (avatar: string) => void;
    onUploadAvatar: (avatar: string) => void;
    onGenerateAvatar: (prompt: string) => void;
    generatedAvatarResult: GeneratedAvatar;
}> = ({ isOpen, onClose, avatars, currentAvatar, onSelectAvatar, onUploadAvatar, onGenerateAvatar, generatedAvatarResult }) => {
    const [activeTab, setActiveTab] = useState<'gallery' | 'ai'>('gallery');
    const [prompt, setPrompt] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content avatar-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Customize Avatar</h2>
                    <button onClick={onClose} className="text-text-color-muted hover:text-white">&times;</button>
                </header>
                 <div className="flex-shrink-0 flex items-center border-b border-border-color">
                    <button onClick={() => setActiveTab('gallery')} className={`tab-button ${activeTab === 'gallery' ? 'active' : ''}`}>Gallery</button>
                    <button onClick={() => setActiveTab('ai')} className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}>Create with AI</button>
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
        if (condition.includes('sun') || condition.includes('clear')) {
            return <svg viewBox="0 0 64 64" className="weather-sun"><circle cx="32" cy="32" r="14" fill="currentColor" /><path d="M32 0v8m0 48v8m32-32h-8M8 32H0m26.86-19.86l-5.66-5.66M4.5 59.5l5.66-5.66m43.18 0l-5.66 5.66m5.66-43.18l-5.66 5.66" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" /></svg>;
        }
        if (condition.includes('rain') || condition.includes('drizzle')) {
            return <><svg viewBox="0 0 64 64" className="weather-cloud"><path d="M47.7,35.4c0-7.3-5.9-13.2-13.2-13.2c-5.1,0-9.5,2.9-11.8,7c-1.4-0.6-3-1-4.6-1c-5.5,0-10,4.5-10,10s4.5,10,10,10h29.5 C47.5,48.2,47.7,35.6,47.7,35.4z" fill="currentColor" /></svg><div className="rain-container">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="weather-rain-drop" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random()}s` }}></div>)}</div></>;
        }
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