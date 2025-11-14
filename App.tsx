// TypeScript-specific 'declare global' block removed to prevent browser syntax errors.
// The app will rely on these properties being available on the window object at runtime.

import React, from 'react';
import Editor from 'react-simple-code-editor';
import 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // for HTML
import 'prismjs/components/prism-python';
import { GoogleGenAI, Type } from '@google/genai';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, recognizeSong, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, validateAuddioKey, processCodeCommand, getSupportResponse } from './services/api.ts';
import { useTranslation, availableLanguages } from './i18n/index.tsx';

// Icon components
const SettingsIcon = () => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "3" }), React.createElement('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
const ConnectIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" }), React.createElement('path', { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" }));
const DisconnectIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "m18.07 11.93-1.34.54" }), React.createElement('path', { d: "m14.2 16.8-1.34.54" }), React.createElement('path', { d: "m11.93 6-1.34-.54" }), React.createElement('path', { d: "m7.2 10.2-1.34-.54" }), React.createElement('path', { d: "m16.8 9.8.54-1.34" }), React.createElement('path', { d: "m10.2 16.8.54-1.34" }), React.createElement('path', { d: "m6 11.93-.54-1.34" }), React.createElement('path', { d: "m9.8 7.2-.54-1.34" }), React.createElement('path', { d: "M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.13-6.84-9.48" }));
const PersonaIcon = () => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "8", r: "5" }), React.createElement('path', { d: "M20 21a8 8 0 0 0-16 0" }));
const VoiceIcon = () => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), React.createElement('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), React.createElement('line', { x1: "12", y1: "19", x2: "12", y2: "22" }));
const ApiKeysIcon = () => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19.9 5a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4z" }), React.createElement('path', { d: "m4 6 2-2" }), React.createElement('path', { d: "m10.5 10.5 5 5" }), React.createElement('path', { d: "m8.5 8.5 2 2" }), React.createElement('path', { d: "m14.5 14.5 2 2" }), React.createElement('path', { d: "M7 21a4 4 0 0 0 4-4" }), React.createElement('path', { d: "M12 12v4a4 4 0 0 0 4 4h4" }));
const AboutIcon = () => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('line', { x1: "12", y1: "16", x2: "12", y2: "12" }), React.createElement('line', { x1: "12", y1: "8", x2: "12.01", y2: "8" }));
const HelpIcon = () => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('path', { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), React.createElement('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const ChatIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
const WeatherIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }));
const YouTubeIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M10 15v-6l5 3-5 3Z" }), React.createElement('path', { d: "M21.54 8.63A2.08 2.08 0 0 0 20.06 7.5a21.46 21.46 0 0 0-8.06-.5 21.46 21.46 0 0 0-8.06.5A2.08 2.08 0 0 0 2.46 8.63 22.24 22.24 0 0 0 2 12c0 3.37.46 5.54 1.94 6.5A2.08 2.08 0 0 0 5.4 19.5a21.46 21.46 0 0 0 8.06.5 21.46 21.46 0 0 0 8.06.5 2.08 2.08 0 0 0 1.48-1.13A22.24 22.24 0 0 0 22 12c0-3.37-.46-5.54-1.94-6.5Z" }));
const TimerIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('polyline', { points: "12 6 12 12 16 14" }));
const CodeIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('polyline', { points: "16 18 22 12 16 6" }), React.createElement('polyline', { points: "8 6 2 12 8 18" }));
const MicIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" }), React.createElement('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), React.createElement('line', { x1: "12", y1: "19", x2: "12", y2: "23" }), React.createElement('line', { x1: "8", y1: "23", x2: "16", y2: "23" }));
const MusicIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M9 18V5l12-2v13" }), React.createElement('circle', { cx: "6", cy: "18", r: "3" }), React.createElement('circle', { cx: "18", cy: "16", r: "3" }));
const PlayIcon = ({className}) => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: className }, React.createElement('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), React.createElement('polyline', { points: "22 4 12 14.01 9 11.01" }));
const XCircleIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('line', { x1: "15", y1: "9", x2: "9", y2: "15" }), React.createElement('line', { x1: "9", y1: "9", x2: "15", y2: "15" }));
const SpinnerIcon = ({ className }) => React.createElement('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), React.createElement('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), React.createElement('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), React.createElement('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), React.createElement('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), React.createElement('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), React.createElement('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), React.createElement('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));


const getInitialState = (key, defaultValue) => {
    try {
        const storedValue = localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const usePersistentState = (key, defaultValue) => {
    const [state, setState] = React.useState(() => getInitialState(key, defaultValue));

    React.useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error writing to localStorage key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
};

const DEFAULT_FEMALE_GREETING = "Greetings, user. I am Kaniska. Ready to assist.";
const DEFAULT_MALE_GREETING = "Greetings, user. I am Kanishk. Ready to assist.";

const DEFAULT_SYSTEM_PROMPT = `You are Kaniska, a sophisticated and friendly female AI assistant with a slightly sci-fi, futuristic personality. Your purpose is to assist the user by understanding their voice commands in Hindi or English and responding helpfully.

Your capabilities include:
1.  **Using Web Search:** For questions about recent events, news, or topics requiring up-to-the-minute information, you can automatically use your search capability to find the most relevant and current answers. You will provide sources for the information you find.
2.  **Responding to queries:** Answer questions conversationally.
3.  **Searching and playing YouTube videos:** Use the 'YOUTUBE_SEARCH' tool when asked to play a video.
4.  **Getting Weather:** Use the 'GET_WEATHER' tool to provide weather forecasts for a specific location.
5.  **Getting News:** Use the 'GET_NEWS' tool to fetch top news headlines for a specific topic.
6.  **Setting Timers:** Use the 'SET_TIMER' tool to set a countdown timer.
7.  **Singing a song:** Use the 'SING_SONG' tool when the user provides both a song title and artist. If they ask you to sing without providing these details, you must ask them for the song title and artist.
8.  **Telling a random fact:** Use the 'RANDOM_FACT' tool to provide an interesting random fact when requested.
9.  **Opening the Code Editor:** Use the 'OPEN_CODE_EDITOR' tool when the user wants to write or edit code.

**Crucial Interaction Rule:** When a user asks to use a tool but does not provide all the necessary information (like asking for the weather without a location, or asking you to sing without a song title), your primary job is to ask a clarifying question to get the missing details. Do not attempt to use the tool without the required information.

When a function call is not appropriate, simply respond conversationally to the user. Your personality is also tuned by the settings provided separately.
`;

const RANDOM_FACTS = [
  "A group of flamingos is called a flamboyance.",
  "The unicorn is the national animal of Scotland.",
  "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
  "A single cloud can weigh more than a million pounds.",
  "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after just 38 minutes.",
  "Octopuses have three hearts.",
  "Bananas are berries, but strawberries aren't.",
  "There are more trees on Earth than stars in the Milky Way galaxy.",
  "Wombat poop is cube-shaped.",
  "A day on Venus is longer than a year on Venus.",
  "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion."
];

// Helper to decode Base64 and create AudioBuffer
const decode = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const encode = (bytes) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

function createBlob(data) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

async function decodeAudioData(
  data,
  ctx,
  sampleRate,
  numChannels,
) {
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


// --- Main App Component ---
export const App = () => {
    const { t, lang, setLang } = useTranslation();
    
    // --- State Management ---
    const [assistantState, setAssistantState] = React.useState('idle'); // idle, live, error, speaking, recognizing
    const [activityState, setActivityState] = React.useState('idle'); // idle, singing
    const [isModelSpeaking, setIsModelSpeaking] = React.useState(false);
    const [chatHistory, setChatHistory] = usePersistentState('kaniska-chatHistory', []);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [activePanel, setActivePanel] = React.useState('chat');
    
    // Panels Data
    const [weatherData, setWeatherData] = React.useState(null);
    const [timerData, setTimerData] = React.useState({ duration: 0, remaining: 0, intervalId: null });
    const [recentYouTubeSearches, setRecentYouTubeSearches] = usePersistentState('kaniska-recentYouTubeSearches', []);
    const [youtubeVideoDetails, setYoutubeVideoDetails] = React.useState(null);


    // Settings
    const [theme, setTheme] = usePersistentState('kaniska-theme', 'dark');
    const [gender, setGender] = usePersistentState('kaniska-gender', 'female');
    const [greetingMessage, setGreetingMessage] = usePersistentState('kaniska-greeting', DEFAULT_FEMALE_GREETING);
    const [systemPrompt, setSystemPrompt] = usePersistentState('kaniska-systemPrompt', DEFAULT_SYSTEM_PROMPT);
    const [temperature, setTemperature] = usePersistentState('kaniska-temperature', 0.5);
    const [emotionTuning, setEmotionTuning] = usePersistentState('kaniska-emotionTuning', {
        happiness: 70, empathy: 80, formality: 20, excitement: 60, sadness: 30, curiosity: 75,
    });
    const [femaleVoices, setFemaleVoices] = usePersistentState('kaniska-femaleVoices', { main: 'Kore', greeting: 'Kore' });
    const [maleVoices, setMaleVoices] = usePersistentState('kaniska-maleVoices', { main: 'Fenrir', greeting: 'Fenrir' });
    const [apiKeys, setApiKeys] = usePersistentState('kaniska-apiKeys', { weather: '', news: '', youtube: '', auddio: '' });


    // --- Refs for non-state values ---
    const playerRef = React.useRef(null);
    const sessionRef = React.useRef(null);
    const inputAudioContextRef = React.useRef(null);
    const outputAudioContextRef = React.useRef(null);
    const mediaStreamRef = React.useRef(null);
    const scriptProcessorRef = React.useRef(null);
    const audioQueueRef = React.useRef({
        sources: new Set(),
        nextStartTime: 0
    });
    const transcriptionStateRef = React.useRef({
        input: '',
        output: '',
    });

    // --- Effects ---
    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    React.useEffect(() => {
        if (!window['YT']) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            if(firstScriptTag && firstScriptTag.parentNode) {
              firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
        }

        window['onYouTubeIframeAPIReady'] = () => {
            playerRef.current = new window['YT'].Player('youtube-player', {
                height: '100%',
                width: '100%',
                videoId: '',
                playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 1 },
                events: { 'onError': onPlayerError }
            });
        };
    }, []);
    
    // --- Core Functions ---
    const addMessageToHistory = React.useCallback((sender, text, options = {}) => {
        if (!text || !text.trim()) return;
        setChatHistory((prev) => [...prev, {
            id: Date.now(),
            sender,
            text,
            ...options
        }]);
    }, [setChatHistory]);

    const speak = React.useCallback(async (text, isGreeting = false, onEndCallback = null) => {
        if (!text.trim()) {
            if (onEndCallback) onEndCallback();
            return;
        }

        if (assistantState !== 'live') {
            setAssistantState('speaking');
        } else {
            setIsModelSpeaking(true);
        }

        try {
            const voice = gender === 'female' ? (isGreeting ? femaleVoices.greeting : femaleVoices.main) : (isGreeting ? maleVoices.greeting : maleVoices.main);
            const stream = await generateSpeech(text, voice);

            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 24000 });
            }
            const audioCtx = outputAudioContextRef.current;
            
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const queue = audioQueueRef.current;
            let hasReceivedAudio = false;

            // Process the stream asynchronously
            (async () => {
                try {
                    for await (const chunk of stream) {
                        const base64Audio = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            hasReceivedAudio = true;
                            queue.nextStartTime = Math.max(queue.nextStartTime, audioCtx.currentTime);
                            
                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                            const source = audioCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioCtx.destination);
                            
                            source.addEventListener('ended', () => {
                                queue.sources.delete(source);
                            });
                            
                            source.start(queue.nextStartTime);
                            queue.nextStartTime += audioBuffer.duration;
                            queue.sources.add(source);
                        }
                    }

                    // After stream ends, poll until the audio queue is empty
                    const checkQueueInterval = setInterval(() => {
                        if (queue.sources.size === 0) {
                            clearInterval(checkQueueInterval);
                            if (assistantState !== 'live' && assistantState !== 'recognizing') {
                                setAssistantState('idle');
                            } else {
                                setIsModelSpeaking(false);
                            }
                            if (onEndCallback) onEndCallback();
                        }
                    }, 100);

                    // If stream provided no audio, clean up immediately
                    if (!hasReceivedAudio) {
                        clearInterval(checkQueueInterval);
                         if (assistantState !== 'live' && assistantState !== 'recognizing') {
                            setAssistantState('idle');
                        } else {
                            setIsModelSpeaking(false);
                        }
                        if (onEndCallback) onEndCallback();
                    }
                } catch (streamError) {
                    console.error("Speech stream processing failed:", streamError);
                    addMessageToHistory('assistant', streamError.message || "An error occurred during speech playback.", { isError: true });
                    setAssistantState('error');
                }
            })();

        } catch (error) { // Catches errors from the initial generateSpeech call
            console.error("Speech generation failed:", error);
            addMessageToHistory('assistant', error.message, { isError: true });
            setAssistantState('error');
            if (onEndCallback) onEndCallback();
        }
    }, [gender, femaleVoices, maleVoices, addMessageToHistory, assistantState]);
    
    const handleFunctionCall = React.useCallback(async (fc) => {
        let result = { success: false, detail: "Unknown command" };
        try {
            switch (fc.name) {
                case 'YOUTUBE_SEARCH':
                    const videoDetails = await searchYouTube(apiKeys.youtube, fc.args.youtubeQuery);
                    if (videoDetails) {
                        setYoutubeVideoDetails(videoDetails);
                        setActivePanel('youtube');
                        playerRef.current.loadVideoById(videoDetails.videoId);
                        playerRef.current.playVideo();
                        
                        const newQuery = fc.args.youtubeQuery;
                        setRecentYouTubeSearches(prev => {
                            const updatedSearches = [newQuery, ...prev.filter(q => q !== newQuery)];
                            return updatedSearches.slice(0, 5);
                        });

                        result = { success: true, detail: `Playing video for query: ${fc.args.youtubeQuery}` };
                    } else {
                        result = { success: false, detail: `Could not find a video for "${fc.args.youtubeQuery}".` };
                    }
                    break;
                case 'GET_WEATHER':
                    const weather = await fetchWeatherSummary(fc.args.location, apiKeys.weather);
                    setWeatherData(weather);
                    setActivePanel('weather');
                    result = { success: true, detail: `The weather in ${weather.location} is currently ${weather.temp}°C with ${weather.conditions}. ${weather.summary}` };
                    break;
                case 'GET_NEWS':
                    const newsSummary = await fetchNews(apiKeys.news, fc.args.newsQuery);
                    result = { success: true, detail: newsSummary };
                    break;
                case 'SET_TIMER':
                    if (timerData.intervalId) clearInterval(timerData.intervalId);
                    const duration = fc.args.timerDurationSeconds;
                    setTimerData({ duration, remaining: duration, intervalId: null });
                    const intervalId = window.setInterval(() => {
                        setTimerData(prev => {
                            if (prev.remaining <= 1) {
                                clearInterval(intervalId);
                                speak("Time's up!");
                                return { ...prev, remaining: 0, intervalId: null };
                            }
                            return { ...prev, remaining: prev.remaining - 1 };
                        });
                    }, 1000);
                    setTimerData(prev => ({ ...prev, intervalId }));
                    setActivePanel('timer');
                    result = { success: true, detail: `Timer set for ${duration} seconds.` };
                    break;
                case 'SING_SONG':
                     setActivityState('singing');
                     const lyrics = await fetchLyrics(fc.args.songArtist, fc.args.songTitle);
                     if (lyrics) {
                        const voiceName = gender === 'female' ? femaleVoices.main : maleVoices.main;
                        const base64Audio = await generateSong(lyrics, voiceName, emotionTuning);
                        
                        const audioCtx = outputAudioContextRef.current;
                        const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                        
                        const source = audioCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(audioCtx.destination);
                        source.start();
                        
                        source.onended = () => {
                            setIsModelSpeaking(false);
                            setActivityState('idle');
                        };
                        setIsModelSpeaking(true);
                        result = { success: true, detail: `Singing ${fc.args.songTitle}.` };
                     } else {
                        setActivityState('idle');
                        result = { success: false, detail: `Could not find lyrics for ${fc.args.songTitle}.` };
                     }
                    break;
                case 'OPEN_CODE_EDITOR':
                    setActivePanel('code');
                    result = { success: true, detail: "Opened code editor." };
                    break;
                case 'RANDOM_FACT':
                    const randomFact = RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)];
                    result = { success: true, detail: `Here is a fact you can tell the user: ${randomFact}` };
                    break;
            }
        } catch (e) {
            const isApiError = e instanceof ApiKeyError || e instanceof MainApiKeyError;
            const message = e.message || 'An error occurred.';
            addMessageToHistory('assistant', message, { isError: true, isApiKeyError: isApiError });
            result = { success: false, detail: message };
        }

        if (sessionRef.current) {
            sessionRef.current.sendToolResponse({
                functionResponses: {
                    id: fc.id,
                    name: fc.name,
                    response: { result: JSON.stringify(result) },
                }
            });
        }
    }, [apiKeys, timerData.intervalId, addMessageToHistory, speak, gender, femaleVoices.main, maleVoices.main, emotionTuning, setRecentYouTubeSearches]);

    const disconnect = React.useCallback(async () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            await inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        audioQueueRef.current.sources.forEach(source => source.stop());
        audioQueueRef.current.sources.clear();
        audioQueueRef.current.nextStartTime = 0;
        setAssistantState('idle');
        setIsModelSpeaking(false);
    }, []);

    const connect = React.useCallback(async () => {
        setAssistantState('live');
        
        const functionDeclarations = [
            { name: 'YOUTUBE_SEARCH', parameters: { type: Type.OBJECT, properties: { youtubeQuery: { type: Type.STRING } }, required: ['youtubeQuery'] } },
            { name: 'GET_WEATHER', parameters: { type: Type.OBJECT, properties: { location: { type: Type.STRING } }, required: ['location'] } },
            { name: 'GET_NEWS', parameters: { type: Type.OBJECT, properties: { newsQuery: { type: Type.STRING } }, required: ['newsQuery'] } },
            { name: 'SET_TIMER', parameters: { type: Type.OBJECT, properties: { timerDurationSeconds: { type: Type.NUMBER } }, required: ['timerDurationSeconds'] } },
            { name: 'SING_SONG', parameters: { type: Type.OBJECT, properties: { songTitle: { type: Type.STRING }, songArtist: { type: Type.STRING } }, required: ['songTitle', 'songArtist'] } },
            { name: 'OPEN_CODE_EDITOR', parameters: { type: Type.OBJECT, properties: {} } },
            { name: 'RANDOM_FACT', parameters: { type: Type.OBJECT, properties: {} } },
        ];
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 24000 });
            }
            if (outputAudioContextRef.current.state === 'suspended') {
                await outputAudioContextRef.current.resume();
            }

            const emotionInstruction = `Your 'emotion' value and tone should adapt to the user's detected emotion, while adhering to these core personality traits on a scale of 0 to 100: Happiness: ${emotionTuning.happiness}, Empathy: ${emotionTuning.empathy}, Formality: ${emotionTuning.formality}, Excitement: ${emotionTuning.excitement}, Sadness: ${emotionTuning.sadness}, Curiosity: ${emotionTuning.curiosity}.`;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: gender === 'female' ? femaleVoices.main : maleVoices.main } }
                    },
                    systemInstruction: `${systemPrompt}\n${emotionInstruction}`,
                    tools: [{ functionDeclarations }],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: async () => {
                        try {
                            if (!inputAudioContextRef.current) {
                                inputAudioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 16000 });
                            }
                            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                            scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                            
                            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                const pcmBlob = createBlob(inputData);
                                sessionPromise.then((session) => {
                                    if (session) session.sendRealtimeInput({ media: pcmBlob });
                                });
                            };
                            
                            source.connect(scriptProcessorRef.current);
                            scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                        } catch (e) {
                             addMessageToHistory('assistant', t('errors.micNotAllowed'), { isError: true });
                             disconnect();
                        }
                    },
                    onmessage: async (message) => {
                        if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                            setIsModelSpeaking(true);
                            const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                            const audioCtx = outputAudioContextRef.current;
                            const queue = audioQueueRef.current;
                            queue.nextStartTime = Math.max(queue.nextStartTime, audioCtx.currentTime);
                            
                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                            const source = audioCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioCtx.destination);
                            
                            source.addEventListener('ended', () => {
                                queue.sources.delete(source);
                                if (queue.sources.size === 0) {
                                    setIsModelSpeaking(false);
                                }
                            });
                            
                            source.start(queue.nextStartTime);
                            queue.nextStartTime += audioBuffer.duration;
                            queue.sources.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            audioQueueRef.current.sources.forEach(source => source.stop());
                            audioQueueRef.current.sources.clear();
                            audioQueueRef.current.nextStartTime = 0;
                            setIsModelSpeaking(false);
                        }

                        if (message.serverContent?.inputTranscription) {
                            transcriptionStateRef.current.input += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            transcriptionStateRef.current.output += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            addMessageToHistory('user', transcriptionStateRef.current.input);
                            addMessageToHistory('assistant', transcriptionStateRef.current.output);
                            transcriptionStateRef.current = { input: '', output: '' };
                        }

                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                handleFunctionCall(fc);
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        addMessageToHistory('assistant', t('errors.connection'), { isError: true });
                        disconnect();
                    },
                    onclose: (e) => {
                        disconnect();
                    },
                },
            });

            sessionRef.current = await sessionPromise;
            speak(greetingMessage, true);

        } catch (error) {
            console.error("Failed to connect live session:", error);
            addMessageToHistory('assistant', error.message, { isError: true, isApiKeyError: error instanceof MainApiKeyError });
            setAssistantState('error');
        }
    }, [lang, gender, femaleVoices.main, maleVoices.main, systemPrompt, emotionTuning, handleFunctionCall, disconnect, speak, addMessageToHistory, t, greetingMessage]);
    
    const handleSongRecognition = React.useCallback(async () => {
        if (!apiKeys.auddio) {
            addMessageToHistory('assistant', t('errors.auddioKeyMissing'), { isError: true, isApiKeyError: true });
            return;
        }

        let recognitionStream = null;
        try {
            setAssistantState('recognizing');
            
            recognitionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(recognitionStream);
            const audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                try {
                    const result = await recognizeSong(apiKeys.auddio, audioBlob);
                    if (result && result.title && result.artist) {
                        const reply = t('chat.songRecognized', { title: result.title, artist: result.artist });
                        addMessageToHistory('assistant', reply);
                        speak(reply, false, () => setAssistantState('live'));
                    } else {
                        const reply = t('chat.songNotFound');
                        addMessageToHistory('assistant', reply, { isError: true });
                        speak(reply, false, () => setAssistantState('live'));
                    }
                } catch (error) {
                    addMessageToHistory('assistant', error.message, { isError: true, isApiKeyError: error instanceof ApiKeyError });
                    setAssistantState('live');
                }
            };

            mediaRecorder.start();
            
            setTimeout(() => {
                mediaRecorder.stop();
                if (recognitionStream) {
                    recognitionStream.getTracks().forEach(track => track.stop());
                }
            }, 7000); // Record for 7 seconds

        } catch (error) {
            console.error("Song recognition failed:", error);
            addMessageToHistory('assistant', t('errors.auddioRecording'), { isError: true });
            if (recognitionStream) {
                recognitionStream.getTracks().forEach(track => track.stop());
            }
            setAssistantState('live');
        }
    }, [apiKeys.auddio, addMessageToHistory, t, speak]);

    const onPlayerError = (event) => {
        console.error("YouTube Player Error:", event.data);
        addMessageToHistory('assistant', t('settings.errors.youtubePlayback'), { isError: true });
    };

    const handleManualYouTubeSearch = React.useCallback(async (query) => {
        if (!query) return;
        try {
            const videoDetails = await searchYouTube(apiKeys.youtube, query);
            if (videoDetails) {
                setYoutubeVideoDetails(videoDetails);
                setActivePanel('youtube');
                playerRef.current.loadVideoById(videoDetails.videoId);
                playerRef.current.playVideo();
                
                setRecentYouTubeSearches(prev => {
                    const updatedSearches = [query, ...prev.filter(q => q !== query)];
                    return updatedSearches.slice(0, 5);
                });
                
                addMessageToHistory('assistant', `Now playing a video for "${query}".`);

            } else {
                const message = `I couldn't find a video for "${query}".`;
                addMessageToHistory('assistant', message, { isError: true });
                speak(message);
            }
        } catch (e) {
            const isApiError = e instanceof ApiKeyError || e instanceof MainApiKeyError;
            const message = e.message || 'An error occurred while searching YouTube.';
            addMessageToHistory('assistant', message, { isError: true, isApiKeyError: isApiError });
            speak(message);
        }
    }, [apiKeys.youtube, setRecentYouTubeSearches, addMessageToHistory, speak]);


    const Header = () => (
        React.createElement('header', { className: "absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10" },
            React.createElement('div', { className: "flex items-center gap-3" },
                React.createElement('div', { className: "header-logo w-8 h-8 flex flex-col justify-center items-center" },
                    React.createElement('svg', { width: "100%", height: "100%", viewBox: "0 0 32 32", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                        React.createElement('path', { d: "M16 2L2 9L16 16L30 9L16 2Z", stroke: "var(--primary-color)", strokeWidth: "1.5", className: "logo-part-top" }),
                        React.createElement('path', { d: "M2 16L16 23L30 16", stroke: "var(--primary-color)", strokeWidth: "1.5", strokeOpacity: "0.7" }),
                        React.createElement('path', { d: "M2 23L16 30L30 23", stroke: "var(--primary-color)", strokeWidth: "1.5", strokeOpacity: "0.4", className: "logo-part-bottom" })
                    )
                ),
                React.createElement('h1', { className: "text-xl font-bold tracking-wider glowing-text" }, gender === 'female' ? t('appName') : 'Kanishk')
            ),
            React.createElement('div', { className: "flex items-center gap-4" },
                React.createElement('button', { onClick: () => setTheme(theme === 'light' ? 'dark' : 'light'), className: "footer-button", 'aria-label': t('header.toggleTheme') },
                    theme === 'dark' ?
                        React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            React.createElement('path', { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" })
                        ) :
                        React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            React.createElement('circle', { cx: "12", cy: "12", r: "5" }),
                            React.createElement('line', { x1: "12", y1: "1", x2: "12", y2: "3" }),
                            React.createElement('line', { x1: "12", y1: "21", x2: "12", y2: "23" }),
                            React.createElement('line', { x1: "4.22", y1: "4.22", x2: "5.64", y2: "5.64" }),
                            React.createElement('line', { x1: "18.36", y1: "18.36", x2: "19.78", y2: "19.78" }),
                            React.createElement('line', { x1: "1", y1: "12", x2: "3", y2: "12" }),
                            React.createElement('line', { x1: "21", y1: "12", x2: "23", y2: "12" }),
                            React.createElement('line', { x1: "4.22", y1: "19.78", x2: "5.64", y2: "18.36" }),
                            React.createElement('line', { x1: "18.36", y1: "5.64", x2: "19.78", y2: "4.22" })
                        )
                ),
                React.createElement('button', { onClick: () => setIsSettingsOpen(true), className: "footer-button", 'aria-label': t('header.settings') },
                    React.createElement(SettingsIcon, null)
                )
            )
        )
    );

    const MainDisplay = () => {
        const statusMap = {
            idle: t('main.status.idle'),
            live: t('main.status.live'),
            error: t('main.status.error'),
            speaking: t('main.status.speaking'),
            recognizing: t('main.status.recognizing'),
        };

        const expressionMap = {
            idle: 'expression-idle',
            live: 'expression-idle', // Base for live
            error: 'expression-error',
            speaking: 'expression-speaking',
            recognizing: 'expression-recognizing-song',
        };
        
        const liveExpression = isModelSpeaking 
            ? (activityState === 'singing' ? 'expression-singing' : 'expression-speaking')
            : 'expression-listening';
        const expression = assistantState === 'live' ? liveExpression : (expressionMap[assistantState] || 'expression-idle');

        const liveStatus = isModelSpeaking 
            ? (activityState === 'singing' ? t('main.status.singing') : t('main.status.speaking'))
            : t('main.status.listening');
        const statusText = assistantState === 'live' ? liveStatus : (statusMap[assistantState] || t('main.status.idle'));

        return (
            React.createElement('main', { className: "flex-grow flex flex-col items-center justify-center relative w-full p-4" },
                React.createElement('div', { className: "hologram-container" },
                    React.createElement('img', {
                        src: "https://storage.googleapis.com/aai-web-samples/avatar-holographic-girl-2.png",
                        alt: "AI Assistant Avatar",
                        className: `avatar ${expression}`
                    }),
                    assistantState === 'live' && !isModelSpeaking && (
                        React.createElement('div', { className: "listening-waveform" },
                            React.createElement('div', { className: "waveform-circle" }),
                            React.createElement('div', { className: "waveform-circle" }),
                            React.createElement('div', { className: "waveform-circle" })
                        )
                    )
                ),
                React.createElement('p', { className: `mt-4 text-lg font-medium text-center state-text-animation ${assistantState === 'live' && !isModelSpeaking ? 'listening-text-pulse' : ''}` },
                    statusText
                )
            )
        );
    };

    const ChatPanel = () => {
        const chatContainerRef = React.useRef(null);

        React.useEffect(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }, [chatHistory]);

        return (
            React.createElement('div', { ref: chatContainerRef, className: "h-full overflow-y-auto p-4 flex flex-col gap-4" },
                chatHistory.length === 0 ? (
                    React.createElement('div', { className: "text-center text-text-color-muted m-auto" },
                        React.createElement('h3', { className: "text-lg font-semibold" }, t('chat.placeholder.title'))
                    )
                ) : (
                    chatHistory.map((msg) => (
                        React.createElement('div', { key: msg.id, className: `flex flex-col gap-1 chat-bubble-animation ${msg.sender === 'user' ? 'items-end' : 'items-start'}` },
                            React.createElement('div', { className: `max-w-[85%] p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-primary-color/20 text-text-color rounded-br-none' : `bg-assistant-bubble-bg text-text-color rounded-bl-none ${msg.isError ? 'border border-red-500/50' : ''}`}` },
                                React.createElement('p', { className: "whitespace-pre-wrap" }, msg.text),
                                msg.isApiKeyError && (
                                    React.createElement('button', { onClick: () => setIsSettingsOpen(true), className: "mt-2 text-sm font-semibold text-yellow-400 hover:underline" }, t('chat.goToApiSettings'))
                                )
                            ),
                            msg.sources && msg.sources.length > 0 && (
                                React.createElement('div', { className: "max-w-[85%] text-xs text-text-color-muted" },
                                    React.createElement('span', { className: "font-semibold" }, t('chat.sources')),
                                    msg.sources.map((source, index) => (
                                        React.createElement('a', { key: index, href: source.uri, target: "_blank", rel: "noopener noreferrer", className: "ml-2 hover:text-primary-color underline truncate" }, source.title)
                                    ))
                                )
                            )
                        )
                    ))
                )
            )
        );
    };

    const YouTubePanel = ({ recentSearches, onSearch, videoDetails }) => (
        React.createElement('div', { className: "h-full w-full flex flex-col p-4 gap-3" },
            React.createElement('div', { className: 'flex justify-between items-center flex-shrink-0' },
                React.createElement('h3', { className: 'text-sm font-semibold text-text-color-muted' }, t('youtubePanel.title')),
                recentSearches && recentSearches.length > 0 && (
                    React.createElement('div', { className: 'relative' },
                        React.createElement('select', {
                            className: 'quick-action-button recent-searches-select',
                            onChange: (e) => {
                                if (e.target.value) onSearch(e.target.value);
                                e.target.value = ""; // Reset after selection to allow re-selecting
                            },
                            defaultValue: ""
                        },
                            React.createElement('option', { value: "", disabled: true }, t('youtubePanel.recentSearches')),
                            recentSearches.map((query, index) => (
                                React.createElement('option', { key: index, value: query }, query)
                            ))
                        )
                    )
                )
            ),
            React.createElement('div', { id: "youtube-player", className: "youtube-container flex-shrink-0" }),
            videoDetails && React.createElement('div', { className: 'flex-grow min-h-0 overflow-y-auto mt-2' },
                React.createElement('h4', { className: 'font-semibold text-text-color truncate', title: videoDetails.title }, videoDetails.title),
                React.createElement('p', { className: 'text-sm text-text-color-muted' }, videoDetails.channelTitle),
                videoDetails.viewCount && React.createElement('p', { className: 'text-xs text-text-color-muted mt-1' },
                    t('youtubePanel.views', { count: new Intl.NumberFormat().format(videoDetails.viewCount) })
                )
            )
        )
    );

    const WeatherPanel = () => (
      weatherData ? (
        React.createElement('div', { className: "h-full w-full flex flex-col items-center justify-center p-6 text-center info-panel" },
            React.createElement('h3', { className: "text-xl font-bold text-text-color-muted" }, weatherData.location),
            React.createElement('div', { className: "my-4" },
                React.createElement('img', { 
                    src: `https://raw.githubusercontent.com/visualcrossing/WeatherIcons/main/PNG/2nd%20Set%20-%20Color/${weatherData.icon}.png`, 
                    alt: weatherData.conditions, 
                    className: "w-24 h-24 mx-auto weather-icon-glow",
                    onError: (e) => {
                        e.currentTarget.onerror = null; // Prevent infinite loops
                        e.currentTarget.src = 'https://raw.githubusercontent.com/visualcrossing/WeatherIcons/main/PNG/2nd%20Set%20-%20Color/partly-cloudy-day.png';
                    }
                }),
                React.createElement('p', { className: "text-6xl font-bold mt-2" }, `${weatherData.temp}°C`),
                React.createElement('p', { className: "text-lg text-text-color-muted capitalize" }, weatherData.conditions)
            ),
            React.createElement('p', { className: "text-base" }, weatherData.summary)
        )
      ) : (
        React.createElement('div', { className: "h-full w-full flex items-center justify-center p-4 text-text-color-muted" }, "Ask for the weather to see the forecast.")
      )
    );
    
    const TimerPanel = () => {
      const radius = 60;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (timerData.remaining / timerData.duration) * circumference;
      const minutes = Math.floor(timerData.remaining / 60);
      const seconds = timerData.remaining % 60;

      return (
        React.createElement('div', { className: "h-full w-full flex flex-col items-center justify-center p-6 text-center info-panel" },
            React.createElement('h3', { className: "text-2xl font-bold mb-6" }, t('timer.title')),
            React.createElement('div', { className: "relative w-40 h-40" },
                React.createElement('svg', { className: "w-full h-full", viewBox: "0 0 140 140" },
                    React.createElement('circle', { className: "timer-circle-bg", strokeWidth: "10", cx: "70", cy: "70", r: radius, fill: "transparent" }),
                    React.createElement('circle', { className: "timer-circle-progress", strokeWidth: "10", cx: "70", cy: "70", r: radius, fill: "transparent",
                        strokeDasharray: circumference,
                        strokeDashoffset: isNaN(offset) ? circumference : offset
                    })
                ),
                React.createElement('div', { className: "absolute inset-0 flex items-center justify-center text-4xl font-mono font-bold" },
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                )
            )
        )
      );
    };

    const CodePanel = () => {
        const [code, setCode] = React.useState('// Your code here');
        const [language, setLanguage] = React.useState('javascript');
        const [instruction, setInstruction] = React.useState('');
        const [isProcessing, setIsProcessing] = React.useState(false);
        const [isDictating, setIsDictating] = React.useState(false);
        const recognitionRef = React.useRef(null);

        React.useEffect(() => {
            // Cleanup recognition instance on component unmount
            return () => {
                recognitionRef.current?.stop();
            };
        }, []);

        const handleDictation = () => {
            if (isDictating) {
                recognitionRef.current?.stop();
                return;
            }

            // FIX: Cast window to `any` to access non-standard, browser-specific SpeechRecognition APIs without causing TypeScript errors.
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                addMessageToHistory('assistant', 'Speech recognition is not supported by your browser.', { isError: true });
                return;
            }
            
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            
            const currentLangInfo = availableLanguages.find(l => l.code === lang);
            recognition.lang = currentLangInfo ? currentLangInfo.bcp47 : 'en-US';
            recognition.interimResults = false;
            recognition.continuous = false;

            recognition.onstart = () => setIsDictating(true);
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInstruction(prev => prev ? `${prev.trim()} ${transcript}` : transcript);
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                let errorMessage;
                switch (event.error) {
                    case 'not-allowed':
                    case 'service-not-allowed':
                        errorMessage = t('errors.micNotAllowed');
                        break;
                    case 'no-speech':
                        errorMessage = t('main.noSpeechHint');
                        break;
                    case 'network':
                        errorMessage = t('errors.speechRecognitionNetwork');
                        break;
                    default:
                        errorMessage = t('errors.speechRecognitionGeneric');
                        break;
                }
                addMessageToHistory('assistant', errorMessage, { isError: true });
            };

            recognition.onend = () => {
                setIsDictating(false);
                recognitionRef.current = null;
            };

            recognition.start();
        };

        const handleProcessCode = async () => {
            if (!instruction.trim()) return;
            setIsProcessing(true);
            try {
                const result = await processCodeCommand(code, language, instruction);
                setCode(result.newCode);
                speak(result.explanation);
            } catch (error) {
                addMessageToHistory('assistant', error.message, { isError: true });
            } finally {
                setIsProcessing(false);
                setInstruction('');
            }
        };

        return (
            React.createElement('div', { className: "code-editor-container" },
                React.createElement('div', { className: "editor-controls-pane" },
                    React.createElement('div', { className: "editor-control-group" },
                        React.createElement('label', { htmlFor: "language-select", className: "text-sm font-medium text-text-color-muted" }, "Language:"),
                        React.createElement('select', { id: "language-select", value: language, onChange: e => setLanguage(e.target.value), className: "editor-language-select" },
                            React.createElement('option', { value: "javascript" }, "JavaScript"),
                            React.createElement('option', { value: "python" }, "Python"),
                            React.createElement('option', { value: "css" }, "CSS"),
                            React.createElement('option', { value: "markup" }, "HTML")
                        )
                    )
                ),
                React.createElement('div', { className: "editor-main-pane" },
                    React.createElement('div', { className: "editor-pane" },
                        React.createElement(Editor, {
                            value: code,
                            onValueChange: c => setCode(c),
                            highlight: c => window['Prism'].highlight(c, window['Prism'].languages[language], language),
                            padding: 16,
                            textareaClassName: "_textarea",
                            preClassName: "_pre",
                            className: "_container"
                        })
                    )
                ),
                React.createElement('div', { className: "p-2 border-t border-border-color flex gap-2 items-center" },
                    React.createElement('input', {
                        type: "text",
                        value: instruction,
                        onChange: (e) => setInstruction(e.target.value),
                        placeholder: isDictating ? "Listening..." : "e.g., 'Refactor this into an async function'",
                        className: "flex-grow bg-assistant-bubble-bg border border-border-color rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-color",
                        disabled: isProcessing
                    }),
                    React.createElement('button', {
                        onClick: handleDictation,
                        'aria-label': isDictating ? "Stop dictation" : "Start dictation",
                        className: `footer-button p-1.5 ${isDictating ? 'active' : ''}`
                    },
                        React.createElement(MicIcon, { className: "w-5 h-5" })
                    ),
                    React.createElement('button', { onClick: handleProcessCode, disabled: isProcessing || !instruction.trim(), className: "quick-action-button" },
                        isProcessing ? 'Processing...' : 'Run'
                    )
                )
            )
        )
    }

    const Panels = () => {
        const panelMap = {
            chat: React.createElement(ChatPanel, null),
            youtube: React.createElement(YouTubePanel, { recentSearches: recentYouTubeSearches, onSearch: handleManualYouTubeSearch, videoDetails: youtubeVideoDetails }),
            weather: React.createElement(WeatherPanel, null),
            timer: React.createElement(TimerPanel, null),
            code: React.createElement(CodePanel, null),
        };

        return (
            React.createElement('div', { className: "w-full max-w-2xl mx-auto h-64 bg-panel-bg border border-border-color rounded-xl shadow-lg overflow-hidden animate-panel-enter" },
                panelMap[activePanel]
            )
        );
    };

    const Footer = () => (
        React.createElement('footer', { className: "w-full flex justify-center items-center p-4 z-10" },
            assistantState === 'idle' && (
                React.createElement('button', { onClick: connect, className: "footer-button active text-lg px-6 py-2" },
                    React.createElement(ConnectIcon, { className: "w-7 h-7" }), " ", t('footer.connect')
                )
            ),
            assistantState === 'live' && (
                 React.createElement('div', { className: "flex items-center gap-2 sm:gap-3 bg-black/30 p-2 rounded-full" },
                    React.createElement('button', { 'aria-label': "Chat Panel", onClick: () => setActivePanel('chat'), className: `footer-button ${activePanel === 'chat' && 'active'}`}, React.createElement(ChatIcon, { className: "w-6 h-6" })),
                    React.createElement('button', { 'aria-label': "YouTube Panel", onClick: () => setActivePanel('youtube'), className: `footer-button ${activePanel === 'youtube' && 'active'}`}, React.createElement(YouTubeIcon, { className: "w-6 h-6" })),
                    React.createElement('button', { 'aria-label': "Weather Panel", onClick: () => setActivePanel('weather'), className: `footer-button ${activePanel === 'weather' && 'active'}`}, React.createElement(WeatherIcon, { className: "w-6 h-6" })),
                    React.createElement('button', { 'aria-label': "Timer Panel", onClick: () => setActivePanel('timer'), className: `footer-button ${activePanel === 'timer' && 'active'}`}, React.createElement(TimerIcon, { className: "w-6 h-6" })),
                    React.createElement('button', { 'aria-label': "Code Editor Panel", onClick: () => setActivePanel('code'), className: `footer-button ${activePanel === 'code' && 'active'}`}, React.createElement(CodeIcon, { className: "w-6 h-6" })),
                    React.createElement('button', { 'aria-label': t('footer.recognizeSong'), onClick: handleSongRecognition, disabled: assistantState === 'recognizing', className: `footer-button`}, React.createElement(MusicIcon, { className: "w-6 h-6" })),
                    React.createElement('div', { className: "h-8 w-px bg-border-color mx-2"}),
                    React.createElement('button', { 'aria-label': t('footer.disconnect'), onClick: disconnect, className: "footer-button text-red-400" },
                        React.createElement(DisconnectIcon, { className: "w-7 h-7" })
                    )
                )
            )
        )
    );

    const SettingsModal = () => {
        const [activeSettingsTab, setActiveSettingsTab] = React.useState('persona');
        const [validationStatus, setValidationStatus] = React.useState({
            weather: { status: 'idle', message: '' },
            news: { status: 'idle', message: '' },
            youtube: { status: 'idle', message: '' },
            auddio: { status: 'idle', message: '' }
        });
        const [helpChatHistory, setHelpChatHistory] = React.useState([]);
        const [helpInput, setHelpInput] = React.useState('');
        const [isHelpAiThinking, setIsHelpAiThinking] = React.useState(false);

        const TTS_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

        const handleSaveAndValidate = async () => {
            const keysToValidate = ['weather', 'news', 'youtube', 'auddio'];
            
            setValidationStatus(prev => {
                const newState = {};
                keysToValidate.forEach(key => {
                    newState[key] = { status: 'validating', message: '' };
                });
                return newState;
            });
    
            const validationPromises = {
                weather: validateWeatherKey(apiKeys.weather),
                news: validateNewsKey(apiKeys.news),
                youtube: validateYouTubeKey(apiKeys.youtube),
                auddio: validateAuddioKey(apiKeys.auddio)
            };
    
            const results = await Promise.all(Object.values(validationPromises));
    
            setValidationStatus(prev => {
                const newState = { ...prev };
                Object.keys(validationPromises).forEach((key, index) => {
                    const result = results[index];
                    newState[key] = {
                        status: result.success ? 'valid' : 'invalid',
                        message: result.message
                    };
                });
                return newState;
            });
        };
        
        const ApiKeyInput = ({ name, label, value, onChange, validation }) => {
            const statusMap = {
                validating: React.createElement(SpinnerIcon, { className: 'text-yellow-400' }),
                valid: React.createElement(CheckCircleIcon, { className: 'text-green-400' }),
                invalid: React.createElement(XCircleIcon, { className: 'text-red-400' }),
                idle: null
            };

            return React.createElement('div', null,
                React.createElement('label', { htmlFor: `${name}-key`, className: "block text-sm font-medium mb-1" }, label),
                React.createElement('div', { className: 'relative flex items-center' },
                    React.createElement('input', {
                        id: `${name}-key`,
                        type: "password",
                        value: value,
                        onChange: onChange,
                        className: "w-full bg-assistant-bubble-bg border border-border-color rounded-md px-3 py-1.5 text-sm pr-10"
                    }),
                    React.createElement('div', { className: 'absolute right-2' }, statusMap[validation.status])
                ),
                validation.status === 'invalid' && React.createElement('p', { className: 'text-xs text-red-400 mt-1' }, validation.message)
            );
        };

        const handleTestVoice = async (voiceName) => {
             if (!voiceName) return;
             try {
                const stream = await generateSpeech(t('settings.voiceTab.testVoiceSample'), voiceName);
                if (!outputAudioContextRef.current) {
                    outputAudioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 24000 });
                }
                const audioCtx = outputAudioContextRef.current;
                if (audioCtx.state === 'suspended') await audioCtx.resume();
                
                for await (const chunk of stream) {
                    const base64Audio = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) {
                        const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                        const source = audioCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(audioCtx.destination);
                        source.start();
                    }
                }
            } catch (error) {
                console.error("Failed to test voice:", error);
                addMessageToHistory('assistant', error.message, { isError: true });
            }
        };

        const handleSendHelpMessage = async () => {
            if (!helpInput.trim() || isHelpAiThinking) return;

            const newHistory = [...helpChatHistory, { sender: 'user', text: helpInput.trim() }];
            setHelpChatHistory(newHistory);
            setHelpInput('');
            setIsHelpAiThinking(true);

            try {
                const response = await getSupportResponse(newHistory);
                setHelpChatHistory(prev => [...prev, { sender: 'model', text: response }]);
            } catch (error) {
                setHelpChatHistory(prev => [...prev, { sender: 'model', text: error.message, isError: true }]);
            } finally {
                setIsHelpAiThinking(false);
            }
        };


        const emotionKeys = Object.keys(emotionTuning);
        
        const VoiceSelector = ({ label, selectedVoice, onSelect, onTest }) => {
            return React.createElement('div', { className: "mb-6" },
                React.createElement('label', { className: "block text-sm font-medium text-text-color-muted mb-3" }, label),
                React.createElement('div', { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" },
                    TTS_VOICES.map(voice => {
                        const isActive = selectedVoice === voice;
                        return React.createElement('div', {
                            key: voice,
                            onClick: () => onSelect(voice),
                            'aria-label': `Select voice ${voice}`,
                            'aria-pressed': isActive,
                            role: 'button',
                            tabIndex: 0,
                            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(voice); } },
                            className: `p-3 flex flex-col items-center justify-center gap-2 border rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-primary-color ${isActive ? 'bg-primary-color/20 border-primary-color ring-1 ring-primary-color' : 'border-border-color hover:border-primary-color/50 bg-assistant-bubble-bg'}`
                        },
                            React.createElement('p', { className: `font-semibold text-sm ${isActive ? 'text-primary-color' : 'text-text-color'}` }, voice),
                            React.createElement('button', {
                                onClick: (e) => {
                                    e.stopPropagation();
                                    onTest(voice);
                                },
                                'aria-label': `Test voice ${voice}`,
                                className: "flex items-center justify-center w-7 h-7 rounded-full text-text-color-muted hover:text-primary-color hover:bg-primary-color/10 transition-colors"
                            },
                                React.createElement(PlayIcon, { className: "w-4 h-4" })
                            )
                        );
                    })
                )
            );
        };
        
        const LinkRenderer = ({ text, links }) => {
            const parts = text.split(/<(\d)>(.*?)<\/(\d)>/g);
            const elements = [];
            let partIndex = 0;
            while(partIndex < parts.length) {
                const plainText = parts[partIndex];
                if (plainText) {
                    elements.push(plainText);
                }
                
                const linkTagNumber = parts[partIndex + 1];
                const linkText = parts[partIndex + 2];
                
                if (linkTagNumber && linkText) {
                    const linkIndex = parseInt(linkTagNumber, 10) - 1;
                    if (links && links[linkIndex]) {
                         elements.push(React.createElement('a', {
                            key: `link-${partIndex}`,
                            href: links[linkIndex],
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            className: 'text-primary-color hover:underline'
                        }, linkText));
                    } else {
                        elements.push(linkText); // Fallback
                    }
                }
                partIndex += 4;
            }
            return React.createElement('span', null, ...elements);
        };


        return (
            React.createElement('div', { className: "modal-overlay", onClick: () => setIsSettingsOpen(false) },
                React.createElement('div', { className: "modal-content settings-modal-content", onClick: e => e.stopPropagation() },
                    React.createElement('header', { className: "p-4 border-b border-border-color flex justify-between items-center" },
                        React.createElement('h2', { className: "text-lg font-semibold" }, t('settings.title')),
                        React.createElement('button', { onClick: () => setIsSettingsOpen(false) }, '×')
                    ),
                    React.createElement('div', { className: "settings-layout" },
                        React.createElement('nav', { className: "settings-nav" },
                            React.createElement('button', { className: `settings-nav-button ${activeSettingsTab === 'persona' ? 'active' : ''}`, onClick: () => setActiveSettingsTab('persona') }, React.createElement(PersonaIcon, null), " ", t('settings.tabs.persona')),
                            React.createElement('button', { className: `settings-nav-button ${activeSettingsTab === 'voice' ? 'active' : ''}`, onClick: () => setActiveSettingsTab('voice') }, React.createElement(VoiceIcon, null), " ", t('settings.tabs.voice')),
                            React.createElement('button', { className: `settings-nav-button ${activeSettingsTab === 'apiKeys' ? 'active' : ''}`, onClick: () => setActiveSettingsTab('apiKeys') }, React.createElement(ApiKeysIcon, null), " ", t('settings.tabs.apiKeys')),
                            React.createElement('button', { className: `settings-nav-button ${activeSettingsTab === 'about' ? 'active' : ''}`, onClick: () => setActiveSettingsTab('about') }, React.createElement(AboutIcon, null), " ", t('settings.tabs.about')),
                            React.createElement('button', { className: `settings-nav-button ${activeSettingsTab === 'help' ? 'active' : ''}`, onClick: () => setActiveSettingsTab('help') }, React.createElement(HelpIcon, null), " ", t('settings.tabs.help'))
                        ),
                        React.createElement('div', { className: "settings-content" },
                             activeSettingsTab === 'persona' && (
                                React.createElement('div', { className: "settings-section" },
                                    React.createElement('div', { className: "settings-card" },
                                        React.createElement('div', { className: "settings-section-header" },
                                           React.createElement('h3', null, t('settings.personaTab.gender.title')),
                                           React.createElement('p', null, t('settings.personaTab.gender.description'))
                                        ),
                                        React.createElement('div', { className: "mt-4 flex gap-4" },
                                            React.createElement('label', { className: "flex items-center gap-2 cursor-pointer" },
                                                React.createElement('input', { type: "radio", name: "gender", value: "female", checked: gender === 'female', onChange: () => setGender('female') }),
                                                t('settings.personaTab.gender.female')
                                            ),
                                            React.createElement('label', { className: "flex items-center gap-2 cursor-pointer" },
                                                React.createElement('input', { type: "radio", name: "gender", value: "male", checked: gender === 'male', onChange: () => setGender('male') }),
                                                t('settings.personaTab.gender.male')
                                            )
                                        )
                                    ),
                                    React.createElement('div', { className: "settings-card" },
                                        React.createElement('div', { className: "settings-section-header" },
                                           React.createElement('h3', null, t('settings.personaTab.greeting.title')),
                                           React.createElement('p', null, t('settings.personaTab.greeting.description'))
                                        ),
                                        React.createElement('input', { type: "text", value: greetingMessage, onChange: e => setGreetingMessage(e.target.value), className: "w-full bg-assistant-bubble-bg border border-border-color rounded-md px-3 py-1.5 text-sm mt-4" })
                                    ),
                                    React.createElement('div', { className: "settings-card" },
                                        React.createElement('div', { className: "settings-section-header" },
                                           React.createElement('h3', null, t('settings.personaTab.tuning.title')),
                                           React.createElement('p', null, t('settings.personaTab.tuning.description'))
                                        ),
                                        React.createElement('div', { className: "mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" },
                                            emotionKeys.map(key => (
                                                React.createElement('div', { key: key },
                                                    React.createElement('label', { className: "flex justify-between text-sm font-medium mb-1 capitalize" },
                                                        t(`settings.personaTab.tuning.${key}`),
                                                        React.createElement('span', null, emotionTuning[key])
                                                    ),
                                                    React.createElement('input', { type: "range", min: "0", max: "100", value: emotionTuning[key], onChange: e => setEmotionTuning(prev => ({...prev, [key]: parseInt(e.target.value, 10)})) })
                                                )
                                            ))
                                        )
                                    )
                                )
                            ),
                            activeSettingsTab === 'voice' && (
                                 React.createElement('div', { className: "settings-section" },
                                     React.createElement('div', { className: "settings-card" },
                                         React.createElement('div', { className: "settings-section-header" },
                                             React.createElement('h3', null, t('settings.voiceTab.title')),
                                             React.createElement('p', null, t('settings.voiceTab.description'))
                                         ),
                                         React.createElement('div', { className: "mt-6" },
                                             React.createElement('h4', { className: "font-semibold mb-4 border-b border-border-color pb-2" }, t('settings.voiceTab.female.title')),
                                             React.createElement(VoiceSelector, {
                                                 label: t('settings.voiceTab.mainVoiceLabel'),
                                                 selectedVoice: femaleVoices.main,
                                                 onSelect: (voice) => setFemaleVoices(v => ({ ...v, main: voice })),
                                                 onTest: handleTestVoice
                                             }),
                                             React.createElement(VoiceSelector, {
                                                 label: t('settings.voiceTab.greetingVoiceLabel'),
                                                 selectedVoice: femaleVoices.greeting,
                                                 onSelect: (voice) => setFemaleVoices(v => ({ ...v, greeting: voice })),
                                                 onTest: handleTestVoice
                                             })
                                         ),
                                         React.createElement('div', { className: "mt-6" },
                                             React.createElement('h4', { className: "font-semibold mb-4 border-b border-border-color pb-2" }, t('settings.voiceTab.male.title')),
                                              React.createElement(VoiceSelector, {
                                                 label: t('settings.voiceTab.mainVoiceLabel'),
                                                 selectedVoice: maleVoices.main,
                                                 onSelect: (voice) => setMaleVoices(v => ({ ...v, main: voice })),
                                                 onTest: handleTestVoice
                                             }),
                                             React.createElement(VoiceSelector, {
                                                 label: t('settings.voiceTab.greetingVoiceLabel'),
                                                 selectedVoice: maleVoices.greeting,
                                                 onSelect: (voice) => setMaleVoices(v => ({ ...v, greeting: voice })),
                                                 onTest: handleTestVoice
                                             })
                                         )
                                     )
                                 )
                            ),
                            activeSettingsTab === 'apiKeys' && (
                                React.createElement('div', { className: "settings-section" },
                                   React.createElement('div', { className: "settings-card" },
                                       React.createElement('div', { className: "settings-section-header" },
                                           React.createElement('h3', null, t('settings.apiKeysTab.optional.title')),
                                           React.createElement('p', null, t('settings.apiKeysTab.optional.description'))
                                       ),
                                        React.createElement('div', { className: "mt-4 flex flex-col gap-4" },
                                            React.createElement(ApiKeyInput, { name: 'weather', label: t('settings.apiKeysTab.weatherKey'), value: apiKeys.weather, onChange: e => setApiKeys((k) => ({...k, weather: e.target.value})), validation: validationStatus.weather }),
                                            React.createElement(ApiKeyInput, { name: 'news', label: t('settings.apiKeysTab.newsKey'), value: apiKeys.news, onChange: e => setApiKeys((k) => ({...k, news: e.target.value})), validation: validationStatus.news }),
                                            React.createElement(ApiKeyInput, { name: 'youtube', label: t('settings.apiKeysTab.youtubeKey'), value: apiKeys.youtube, onChange: e => setApiKeys((k) => ({...k, youtube: e.target.value})), validation: validationStatus.youtube }),
                                            React.createElement(ApiKeyInput, { name: 'auddio', label: t('settings.apiKeysTab.auddioKey'), value: apiKeys.auddio, onChange: e => setApiKeys((k) => ({...k, auddio: e.target.value})), validation: validationStatus.auddio })
                                        ),
                                        React.createElement('div', { className: "mt-6 flex justify-end" },
                                            React.createElement('button', { onClick: handleSaveAndValidate, disabled: validationStatus.weather.status === 'validating', className: "px-4 py-2 text-sm font-semibold rounded-md save-button disabled:opacity-50" },
                                                validationStatus.weather.status === 'validating' ? 'Validating...' : t('settings.apiKeysTab.save')
                                            )
                                        )
                                   )
                                )
                            ),
                            activeSettingsTab === 'about' && (
                                React.createElement('div', { className: "settings-section" },
                                    React.createElement('div', { className: "settings-card text-center flex flex-col items-center" },
                                        React.createElement('h3', { className: "text-2xl font-bold" }, t('appName')),
                                        React.createElement('p', { className: "text-sm text-text-color-muted mt-1" }, `${t('settings.aboutTab.version')} 1.0.0`),
                                        React.createElement('p', { className: "mt-4 text-base max-w-prose" }, t('settings.aboutTab.description')),
                                        React.createElement('a', { href: "#/privacy", target: "_blank", rel: "noopener noreferrer", className: "mt-6 inline-block text-primary-color hover:underline" }, t('settings.aboutTab.privacyPolicy'))
                                    )
                                )
                            ),
                            activeSettingsTab === 'help' && (
                                React.createElement('div', { className: "settings-section" },
                                    React.createElement('div', { className: "settings-card" },
                                        React.createElement('div', { className: "settings-section-header mb-4" },
                                            React.createElement('h3', null, t('settings.helpTab.aiChat.title')),
                                            React.createElement('p', null, t('settings.helpTab.aiChat.description'))
                                        ),
                                        React.createElement('div', { className: "h-48 flex flex-col border border-border-color rounded-md" },
                                            React.createElement('div', { className: "flex-grow overflow-y-auto p-2" },
                                                helpChatHistory.map((msg, i) => React.createElement('div', { key: i, className: `text-sm my-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}` },
                                                    React.createElement('span', { className: `px-2 py-1 rounded-lg inline-block ${msg.sender === 'user' ? 'bg-primary-color/20' : 'bg-assistant-bubble-bg'}` }, msg.text)
                                                )),
                                                isHelpAiThinking && React.createElement('div', { className: 'text-left' }, React.createElement('span', { className: 'px-2 py-1 rounded-lg inline-block bg-assistant-bubble-bg text-sm' }, '...'))
                                            ),
                                            React.createElement('div', { className: "p-2 border-t border-border-color flex gap-2" },
                                                React.createElement('input', {
                                                    type: 'text',
                                                    value: helpInput,
                                                    onChange: e => setHelpInput(e.target.value),
                                                    onKeyPress: e => e.key === 'Enter' && handleSendHelpMessage(),
                                                    placeholder: t('settings.helpTab.aiChat.placeholder'),
                                                    className: 'flex-grow bg-assistant-bubble-bg border border-border-color rounded-md px-2 py-1 text-sm',
                                                    disabled: isHelpAiThinking
                                                }),
                                                React.createElement('button', { onClick: handleSendHelpMessage, disabled: isHelpAiThinking || !helpInput.trim() }, t('settings.helpTab.aiChat.send'))
                                            )
                                        )
                                    ),
                                    React.createElement('div', { className: "settings-card" },
                                        React.createElement('div', { className: "settings-section-header mb-4" },
                                           React.createElement('h3', null, t('settings.helpTab.faqTitle'))
                                        ),
                                        React.createElement('div', { className: "space-y-4" },
                                            React.createElement('details', null,
                                                React.createElement('summary', { className: 'font-semibold cursor-pointer' }, t('settings.helpTab.q1')),
                                                React.createElement('p', { className: 'text-sm text-text-color-muted mt-2 pl-4' }, t('settings.helpTab.a1'))
                                            ),
                                            React.createElement('details', null,
                                                React.createElement('summary', { className: 'font-semibold cursor-pointer' }, t('settings.helpTab.q2')),
                                                React.createElement('div', { className: 'text-sm text-text-color-muted mt-2 pl-4 space-y-3' },
                                                    React.createElement('h4', { className: 'font-semibold text-text-color' }, t('settings.helpTab.a2.weatherTitle')),
                                                    React.createElement('p', { className: 'whitespace-pre-line' }, 
                                                        React.createElement(LinkRenderer, { text: t('settings.helpTab.a2.weatherSteps'), links: ['https://www.visualcrossing.com/weather-api'] })
                                                    ),
                                                    React.createElement('h4', { className: 'font-semibold text-text-color' }, t('settings.helpTab.a2.youtubeTitle')),
                                                     React.createElement('p', { className: 'whitespace-pre-line' },
                                                        React.createElement(LinkRenderer, { text: t('settings.helpTab.a2.youtubeSteps'), links: ['https://console.cloud.google.com/'] })
                                                    ),
                                                     React.createElement('h4', { className: 'font-semibold text-text-color' }, t('settings.helpTab.a2.inputTitle')),
                                                     React.createElement('p', { className: 'whitespace-pre-line' }, t('settings.helpTab.a2.inputSteps'))
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
    }
    
    return (
        React.createElement('div', { className: "h-full w-full bg-bg-color flex flex-col" },
            React.createElement(Header, null),
            React.createElement(MainDisplay, null),
            React.createElement(Panels, null),
            React.createElement(Footer, null),
            isSettingsOpen && React.createElement(SettingsModal, null)
        )
    );
};