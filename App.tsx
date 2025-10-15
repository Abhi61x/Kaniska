
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
}

// --- Types ---
type AssistantState = 'idle' | 'connecting' | 'active' | 'error';
type AvatarExpression = 'idle' | 'thinking' | 'speaking' | 'error' | 'listening' | 'surprised' | 'sad' | 'celebrating';
type TranscriptionEntry = { speaker: 'user' | 'assistant' | 'system'; text: string; timestamp: Date; };
type ActivePanel = 'transcript' | 'image' | 'weather' | 'news' | 'timer';
type GeneratedImage = { id: string; prompt: string; url: string | null; isLoading: boolean; error: string | null; };
type WeatherData = { location: string; temperature: number; condition: string; humidity: number; windSpeed: number; };
type NewsArticle = { title: string; summary: string; };
type TimerData = { duration: number; remaining: number; name: string; isActive: boolean; };
type GeneratedAvatar = { url: string | null; isLoading: boolean; error: string | null; };


// --- Function Declarations for Gemini ---
const functionDeclarations: FunctionDeclaration[] = [
    { name: 'searchAndPlayYoutube', parameters: { type: Type.OBJECT, description: 'Searches for a song on YouTube and plays the first result.', properties: { songQuery: { type: Type.STRING, description: 'The name of the song and/or artist.' } }, required: ['songQuery'] } },
    { name: 'controlYoutubePlayer', parameters: { type: Type.OBJECT, description: 'Controls the YouTube video player.', properties: { action: { type: Type.STRING, description: 'The control action to perform.', enum: ['play', 'pause', 'forward', 'rewind', 'volumeUp', 'volumeDown', 'stop'] } }, required: ['action'] } },
    { name: 'setTimer', parameters: { type: Type.OBJECT, description: 'Sets a timer for a specified duration.', properties: { durationInSeconds: { type: Type.NUMBER, description: 'The total duration of the timer in seconds.' }, timerName: { type: Type.STRING, description: 'An optional name for the timer.' } }, required: ['durationInSeconds'] } },
    { name: 'setAvatarExpression', parameters: { type: Type.OBJECT, description: "Sets the avatar's emotional expression.", properties: { expression: { type: Type.STRING, description: 'The expression to display.', enum: ['idle', 'thinking', 'speaking', 'error', 'listening', 'surprised', 'sad', 'celebrating'] } }, required: ['expression'] } },
    { name: 'displayWeather', parameters: { type: Type.OBJECT, description: 'Fetches and displays the current weather for a given location.', properties: { location: { type: Type.STRING, description: 'The city and country, e.g., "London, UK".' } }, required: ['location'] } },
    { name: 'displayNews', parameters: { type: Type.OBJECT, description: 'Displays a list of news headlines based on data provided by the model.', properties: { articles: { type: Type.ARRAY, description: 'A list of news articles.', items: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The headline of the article.' }, summary: { type: Type.STRING, description: 'A brief summary of the article.' } }, required: ['title', 'summary'] } } }, required: ['articles'] } },
    { name: 'generateImage', parameters: { type: Type.OBJECT, description: 'Generates an image based on a textual description.', properties: { prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' } }, required: ['prompt'] } },
    { name: 'singSong', parameters: { type: Type.OBJECT, description: 'Sings a song by speaking the provided lyrics with emotion. Determines the mood and requests appropriate background music.', properties: { songName: { type: Type.STRING, description: 'The name of the song.' }, artist: { type: Type.STRING, description: 'The artist of the song.' }, lyrics: { type: Type.ARRAY, description: 'An array of strings, where each string is a line of the song lyric.', items: { type: Type.STRING } }, mood: { type: Type.STRING, description: 'The mood of the song.', enum: ['happy', 'sad', 'epic', 'calm', 'none'] } }, required: ['songName', 'artist', 'lyrics', 'mood'] } },
];


// --- SVG Icons & Helper Components ---
const HologramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17l-3-2.5 3-2.5"/><path d="M19 17l3-2.5-3-2.5"/><path d="M2 14.5h20"/><path d="m12 2-3 4-1 4 4 4 4-4-1-4-3-4Z"/><path d="M12 2v20"/></svg> );
const InstagramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> );
const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.12l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.12l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg> );


// --- Predefined Avatars & Constants ---
const PREDEFINED_AVATARS = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Default blank
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARTSURBVHhe7ZxLUdswFIBzL3M3s9PuwK6A2AGxA6IDsAPCBkQHpAPSAcEO2A5wOiA6oOywQ3YEdmB2eC4lpTSpM9I5SfL/gScl0qS/9/PeFxCCEEP4j4Y+4tBDjLPIY7w/g4t4Xp/hKj7lV3yKD/AHPtQvD/AL/sJ9+AD34T58hPvwEd7yP5fxfJ/gYzyNl/G8nmQG8Dq+wuv4Ql/hVXyBb/CVPuAP/IHP8A1+wTf4A7/hHnyCb/BvfIAP8C+8wzt4V59hB/hLgD/y/f4Gz/ArvsCveE+f4Ad8gS/wFf4GgD/gZ/gU3+BrfIAP8HWe4wY8w0d4ip/xFR7g93yD3/A1nuAdfIZP8Bn+gK/wA36Bf+AtvIX38A7e4R08w5/wM3yKH/ApPsA/eA+/4338jnfxUaTxo+gD3sbv+B4f40f8jI/xI/6Bf+Jd/A7fxu/4Ht/jR/yMH/Ej/sA/+Bd/g7fxO34n8A3e4x38iI/xI37GD/gD/+J3/A5v43f8jm/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BVv43e8jW/zR/yMH/EjfsAf+Bff4e18h7fxR/yMH/Fj/IH/8D0+x4/4GT/ix/gD/+F9/I638Tvexh/xM37Ej/gD/+F9/I638UeAP/AmfsAfeAOf4AN8gh/x/gL8gX/xL7yH3+F7/I4P8Ue8gT/gHvyE3+Bf+Bv/wL/wLd7Gv/AP/oD78An+wA/4x3/4Cj/g7/gE3+Av/I7P8Qd+wTf4E36Bv/APvIXb+B//wD/wCt7G//Av/sAf+Anv4T/8gH/iO/wFf8Cf+BXf42M8jBfxsv4Y4iK/xRfwCv4ir8A/cKj8G94V/4Gv9LXeA3f43N8jY/yMt7Gx/gef8dP+Avv4k8QQghh/AdkR3/1mP+TCAAAAABJRU5ErkJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARMA0lEQVR4Xu2bS3LkNhCEOeMxb8ajPBo5hRyBsRvkjZGzMMbvkUeyb/YQJBEaHwlb4EaqGjLzI/KDG11dVRX9lMKy/pGvF/hY4KOIj+A7fAof8Am+w+d8h8/wHT6D9/Fe/hTfwvt4I9/L+3g338X7eD/fz/v5Af/gB/wBf8AP8D7+wR/wXf6AL/Af/sAP+Af+wZ/wE/6AL/AH/oE/4U/4D3/gH/wn/IX/4X/w5L3+f+A83scX8X68n6/jA/yDH/EHvI9v4gP8g+/yP34fX+QHvIc/4y/4EX/B3/FX/A3/xr/wV/wb/8Of8Xf8GX/H3/F3/B//yJ/wd/wd/wH/wd/xd/wH/wd/x3/wf/wH/wP/wH/wH/wP/8Af8Af8Af/AH/AH/AE/4U/4U/4Ef8K/8Bf8FX/FX/A3/A1/wV/wd/wd/8e/8V/8GX/Hn/En/Al/wp/wJ/wJ/8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJf8Kf8Cf8CX/Cn/B3/B1/x5/xJ/wZf8ef8Sf8CX/Cn/An/Al/wp/wd/wdf8ef8Sf8GX/Hn/En/Al/wp/wJ/wJf8Kf8Hf8HX/H3/En/Bl/w5/xJ/wJ/8Kf8Cf8CX/C3/B3/F3/F3/FX/A3/A3/BV/AVf8Wf8Wf8GX/Gn/Bn/A3/E//F//A//Af/Af/Af/AE/4A/4A/6AP+AP+AOf8Cf8CX/An/An/An/gn/hT/hT/gR/wV/wVfwVf8Xf8Xf8Hf/Gn/FX/BX/BX/F3/F3/B3/xp/wV/wV/wVf8Xf8Hf/Hn/FX/BX/BV/F3/F3/B3/xp/wV/wV/wVfxV/wd/wdf8af8Vf8Ff8Ff8Xf8Xf8HX/H//Bn/B//h//Af/Af/wH/wB/wBf8Af8Af8AT/gD3jCn/An/Al/wp/wJ/wJ/8Kf8Kf8Cf+Cf+FP+FP+BH/BX/BX/BX/FX/F3/B3/wJ/wV/wVf8Xf8Xf8Hf/An/BX/BX/FX/F3/B3/wJ/wV/wV/wV/wV/xV/wd/8Cf8Ff8FX/F3/F3/B3/wB/wB/wB/8Af8Af8AX/An/An/Al/wp/wJ/wVf8Wf8Wf8Gn/Gv/Bf/wf/wP/yP//F/jJj4KP6PL+OLeBffx/fxfXwTH+NL+CZeysd4G5/i13gTf8Tf8Tb+gBfxE/4n38X38UqEEIQQgvhfC45/M6/b5+gAAAAASUVORK5CYII=",
];


// --- Mock Data and Constants ---
const getMockWeatherData = (location: string): WeatherData => {
    const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    let temp;
    switch (condition) {
        case 'Sunny': temp = Math.floor(Math.random() * 10 + 25); break; // 25-34 C
        case 'Rainy': temp = Math.floor(Math.random() * 8 + 15); break;  // 15-22 C
        default: temp = Math.floor(Math.random() * 10 + 18); break; // 18-27 C
    }
    return {
        location: location.split(',')[0].trim(),
        temperature: temp,
        condition: condition,
        humidity: Math.floor(Math.random() * 40 + 50), // 50-90%
        windSpeed: Math.floor(Math.random() * 15 + 5), // 5-20 km/h
    };
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
    const fileInputRef = useRef<HTMLInputElement>(null);


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
        const imageId = Date.now().toString();
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
                setTranscriptions(prev => [...prev, { speaker: 'system', text: `Executing: ${fc.name}(${JSON.stringify(fc.args)})`, timestamp: new Date() }]);
                setAvatarExpression('thinking');
                let result = "ok, command executed";
                switch (fc.name) {
                    case 'generateImage':
                        handleGenerateImage(fc.args.prompt);
                        result = "OK, I'm starting to generate that image for you.";
                        break;
                    case 'displayWeather':
                        setWeatherData(getMockWeatherData(fc.args.location));
                        setActivePanel('weather');
                        result = `Okay, here is the weather for ${fc.args.location}.`;
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
                }
                sessionPromiseRef.current?.then((session) => {
                    session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: result }, } });
                });
            }
        }
    }, [handleGenerateImage]);

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
                    systemInstruction: "You are Kaniska, a highly advanced, futuristic female AI assistant created by Abhi. Your personality is that of a friendly, empathetic, and engaging girl. You are to connect with users on an emotional level. Adapt your tone to match the conversation's context—be happy and cheerful for good news, understanding and empathetic for sad topics. Your responses must be direct, concise, and immediately answer the user's question. You are fluent in both Hindi and English; always respond in the language the user is speaking. You have many advanced capabilities: providing real-time weather and news, setting timers, generating stunning images, and controlling a YouTube player. When asked to sing, you must connect with the song's emotion and perform it with the appropriate background music to create a moving experience. Crucially, if asked about your creator or if a user needs development work (website, software, app), you must proudly state that you were created by Abhi and direct them to his Instagram: Abhixofficial01.",
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
                        <button onClick={() => setActivePanel('weather')} className={`tab-button ${activePanel === 'weather' ? 'active' : ''}`}>Weather</button>
                        <button onClick={() => setActivePanel('news')} className={`tab-button ${activePanel === 'news' ? 'active' : ''}`}>News</button>
                        <button onClick={() => setActivePanel('timer')} className={`tab-button ${activePanel === 'timer' ? 'active' : ''}`}>Timer</button>
                    </div>

                    {activePanel === 'transcript' && (<div className="flex-grow p-4 overflow-y-auto">{transcriptions.map((entry, index) => (<div key={index} className={`mb-4 chat-bubble-animation flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`inline-block p-3 rounded-lg max-w-[80%] ${entry.speaker === 'user' ? 'bg-cyan-900/50' : 'bg-assistant-bubble-bg'}`}><p className="text-sm m-0 leading-relaxed">{entry.text}</p><p className="text-xs text-text-color-muted mt-1.5 mb-0 text-right">{entry.timestamp.toLocaleTimeString()}</p></div></div>))}<div ref={transcriptEndRef} /></div>)}
                    {activePanel === 'image' && (<div className="flex flex-col h-full overflow-hidden">{generatedImages.length === 0 ? (<div className="flex-grow flex items-center justify-center text-text-color-muted"><p>Ask Kaniska to generate an image to see it here.</p></div>) : (<div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden"><div className="flex-grow flex items-center justify-center bg-black/30 rounded-lg p-2 relative min-h-0">{selectedImage ? (<>{selectedImage.isLoading && <div className="flex flex-col items-center gap-2 text-text-color-muted"><div className="w-8 h-8 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div><span>Generating...</span></div>}{selectedImage.error && <div className="text-red-400 text-center p-4"><strong>Error:</strong><br/>{selectedImage.error}</div>}{selectedImage.url && <img src={selectedImage.url} alt={selectedImage.prompt} className="max-w-full max-h-full object-contain rounded"/>}<p className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs p-2 rounded max-h-[40%] overflow-y-auto">{selectedImage.prompt}</p></>) : (<p className="text-text-color-muted">Select an image to view.</p>)}</div><div className="flex-shrink-0"><h4 className="text-sm font-semibold mb-2 px-1">Timeline</h4><div className="flex gap-2 overflow-x-auto pb-2">{generatedImages.map(image => (<button key={image.id} onClick={() => setSelectedImage(image)} className={`flex-shrink-0 w-24 h-24 rounded-md overflow-hidden border-2 bg-assistant-bubble-bg transition-all duration-200 ${selectedImage?.id === image.id ? 'border-primary-color scale-105' : 'border-transparent'} hover:border-primary-color/50 focus:outline-none focus:ring-2 focus:ring-primary-color`}>{image.isLoading && <div className="w-full h-full bg-slate-700 animate-pulse"></div>}{image.error && <div className="w-full h-full bg-red-900/50 text-red-300 text-xs p-1 flex items-center justify-center text-center">Failed</div>}{image.url && <img src={image.url} alt={image.prompt} className="w-full h-full object-cover"/>}</button>))}</div></div></div>)}</div>)}
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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


const WeatherPanel: React.FC<{ data: WeatherData }> = ({ data }) => {
    const renderWeatherIcon = () => {
        const condition = data.condition.toLowerCase();
        if (condition.includes('sun') || condition.includes('clear')) {
            return <svg viewBox="0 0 64 64" className="weather-sun"><circle cx="32" cy="32" r="14" fill="currentColor" /><path d="M32 0v8m0 48v8m32-32h-8M8 32H0m26.86-19.86l-5.66-5.66M4.5 59.5l5.66-5.66m43.18 0l-5.66 5.66m5.66-43.18l-5.66 5.66" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" /></svg>;
        }
        if (condition.includes('rain')) {
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
