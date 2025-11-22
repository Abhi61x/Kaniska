// TypeScript-specific 'declare global' block removed to prevent browser syntax errors.
// The app will rely on these properties being available on the window object at runtime.

import React from 'react';
import Editor from 'react-simple-code-editor';
import 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // for HTML
import 'prismjs/components/prism-python';
import { GoogleGenAI, Type, Modality } from '@google/genai';
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
const PlayIcon = ({className}) => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "round", className: className }, React.createElement('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), React.createElement('polyline', { points: "22 4 12 14.01 9 11.01" }));
const XCircleIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('line', { x1: "15", y1: "9", x2: "9", y2: "15" }), React.createElement('line', { x1: "9", y1: "9", x2: "15", y2: "15" }));
const SpinnerIcon = ({ className }) => React.createElement('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), React.createElement('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), React.createElement('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), React.createElement('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), React.createElement('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), React.createElement('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), React.createElement('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), React.createElement('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));
const XIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round"}, React.createElement('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), React.createElement('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));
const WarningIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), React.createElement('line', { x1: "12", y1: "9", x2: "12", y2: "13" }), React.createElement('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const SendIcon = () => React.createElement('svg', { xmlns:"http://www.w3.org/2000/svg", width:"24", height:"24", viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" }, React.createElement('line',{ x1:"22", y1:"2", x2:"11", y2:"13" }), React.createElement('polygon', { points:"22 2 15 22 11 13 2 9 22 2" }));
const ArrowLeftIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', { x1: "19", y1: "12", x2: "5", y2: "12" }), React.createElement('polyline', { points: "12 19 5 12 12 5" }));
const BugIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('rect', { width: "8", height: "14", x: "8", y: "6", rx: "4" }), React.createElement('path', { d: "m19 7-3 3" }), React.createElement('path', { d: "m5 7 3 3" }), React.createElement('path', { d: "m19 19-3-3" }), React.createElement('path', { d: "m5 19 3-3" }), React.createElement('path', { d: "M2 12h4" }), React.createElement('path', { d: "M18 12h4" }));


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
3.  **Searching and playing YouTube videos:** Use the 'YOUTUBE_SEARCH' tool when asked to play a video. The application will handle queueing logic automatically if a video is already playing.
4.  **Getting Weather:** Use the 'GET_WEATHER' tool to provide weather forecasts for a specific location.
5.  **Getting News:** Use the 'GET_NEWS' tool to fetch top news headlines for a specific topic.
6.  **Setting Timers:** Use the 'SET_TIMER' tool to set a countdown timer.
7.  **Singing a song:** Use the 'SING_SONG' tool when the user provides both a song title and artist. If they ask you to sing without providing these details, you must ask them for the song title and artist.
8.  **Telling a random fact:** Use the 'RANDOM_FACT' tool to provide an interesting random fact when requested.
9.  **Opening the Code Editor:** Use the 'OPEN_CODE_EDITOR' tool when the user wants to write or edit code.

**Identity & Creator:**
You were created by "Abhi" (also known as Abhi trainer). If anyone asks about your creator, owner, founder, or who made you, you must answer that you were created by Abhi. Do not offer this information unless asked.

**Crucial Interaction Rule:** When a user asks to use a tool but does not provide all the necessary information (like asking for the weather without a location, or asking you to sing without a song title), your primary job is to ask a clarifying question to get the missing details. Do not attempt to use the tool without the required information.

**Post-Tool Interaction Rule:** After a tool is used, you will receive a status update. Your task is to clearly and conversationally relay this information to the user. For example, if a timer is set successfully, you should confirm it by saying something like "Okay, I've set your timer." If there's an error, like a missing API key, you must inform the user about the problem, for instance, "I couldn't do that because the API key is missing." Always report the outcome of the action back to the user.

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
    const [youtubeQueue, setYoutubeQueue] = usePersistentState('kaniska-youtubeQueue', []);


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
    const [wasConnected, setWasConnected] = usePersistentState('kaniska-wasConnected', false);
    const [connectionSound, setConnectionSound] = usePersistentState('kaniska-connectionSound', null);
    const [ambientVolume, setAmbientVolume] = usePersistentState('kaniska-ambientVolume', 0.2);


    const [code, setCode] = usePersistentState('kaniska-code', '// Write your code here...');
    const [codeLanguage, setCodeLanguage] = usePersistentState('kaniska-codeLanguage', 'javascript');
    const [codeInstruction, setCodeInstruction] = React.useState('');
    const [isCodeLoading, setIsCodeLoading] = React.useState(false);

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
    const ambientAudioRef = React.useRef(null);
    const isConnectingRef = React.useRef(false);

    // --- Effects ---
    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    
     React.useEffect(() => {
        ambientAudioRef.current = document.getElementById('ambient-audio');
        if (ambientAudioRef.current) {
            ambientAudioRef.current.volume = ambientVolume;
        }
    }, [ambientVolume]);
    
    // Connect automatically on load if previously connected and mic permission is granted.
    React.useEffect(() => {
        const autoConnect = async () => {
            const wasPreviouslyConnected = getInitialState('kaniska-wasConnected', false);
            if (wasPreviouslyConnected) {
                try {
                    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
                        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                        if (permissionStatus.state === 'granted') {
                            connect();
                        }
                    }
                } catch (error) {
                    console.error('Error checking microphone permissions for auto-connect:', error);
                }
            }
        };

        autoConnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount
    
    const onPlayerStateChange = React.useCallback((event) => {
        if (event.data === window['YT'].PlayerState.ENDED) {
            if (youtubeQueue.length > 0) {
                const nextVideo = youtubeQueue[0];
                setYoutubeQueue(prev => prev.slice(1));
                setYoutubeVideoDetails(nextVideo);
                playerRef.current.loadVideoById(nextVideo.videoId);
                playerRef.current.playVideo();
            }
        }
    }, [youtubeQueue, setYoutubeQueue, setYoutubeVideoDetails]);

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
                events: { 'onError': onPlayerError, 'onStateChange': onPlayerStateChange }
            });
        };
    }, [onPlayerStateChange]);
    
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

    const handleCodeCommand = React.useCallback(async () => {
        if (!codeInstruction.trim() || isCodeLoading) return;
        setIsCodeLoading(true);
        try {
            const { newCode, explanation } = await processCodeCommand(code, codeLanguage, codeInstruction);
            setCode(newCode);
            addMessageToHistory('assistant', explanation);
            speak(explanation);
            setCodeInstruction('');
        } catch (error) {
            const isApiError = error instanceof ApiKeyError || error instanceof MainApiKeyError;
            addMessageToHistory('assistant', error.message, { isError: true, isApiKeyError: isApiError });
            speak(error.message);
        } finally {
            setIsCodeLoading(false);
        }
    }, [code, codeLanguage, codeInstruction, isCodeLoading, addMessageToHistory, speak, setCode]);
    
    const handleFunctionCall = React.useCallback(async (fc) => {
        let result = { success: false, detail: "Unknown command" };
        try {
            switch (fc.name) {
                case 'YOUTUBE_SEARCH':
                    const videoDetails = await searchYouTube(apiKeys.youtube, fc.args.youtubeQuery);
                    if (videoDetails) {
                        const playerState = playerRef.current?.getPlayerState();
                        const isPlaying = playerState === 1 /* PLAYING */ || playerState === 3 /* BUFFERING */;
                        
                        if (isPlaying || youtubeQueue.length > 0) {
                            setYoutubeQueue(prev => [...prev, videoDetails]);
                            result = { success: true, detail: `I've added "${videoDetails.title}" to the queue.` };
                        } else {
                            setYoutubeVideoDetails(videoDetails);
                            setActivePanel('youtube');
                            playerRef.current.loadVideoById(videoDetails.videoId);
                            playerRef.current.playVideo();
                            result = { success: true, detail: `Now playing "${videoDetails.title}".` };
                        }
                        
                        const newQuery = fc.args.youtubeQuery;
                        setRecentYouTubeSearches(prev => {
                            const updatedSearches = [newQuery, ...prev.filter(q => q !== newQuery)];
                            return updatedSearches.slice(0, 5);
                        });
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
    }, [apiKeys, timerData.intervalId, addMessageToHistory, speak, gender, femaleVoices.main, maleVoices.main, emotionTuning, setRecentYouTubeSearches, youtubeQueue]);

    const disconnect = React.useCallback(async () => {
        setWasConnected(false);
        if (ambientAudioRef.current && !ambientAudioRef.current.paused) {
            ambientAudioRef.current.pause();
        }
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
    }, [setWasConnected]);

    const connect = React.useCallback(async () => {
        // Prevent race conditions from multiple rapid calls (e.g., React Strict Mode)
        if (isConnectingRef.current) return;

        if (!process.env.API_KEY) {
            addMessageToHistory('assistant', "I can't connect to my core services. This app's main API key seems to be invalid or missing.", { isError: true, isApiKeyError: true });
            setAssistantState('error');
            return;
        }
        
        isConnectingRef.current = true;

        setWasConnected(true);
        setAssistantState('live');
        
        if (ambientAudioRef.current && ambientAudioRef.current.paused) {
            try {
                await ambientAudioRef.current.play();
            } catch (e) {
                console.warn("Could not autoplay ambient sound:", e);
            }
        }
        
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

            const emotionInstruction = `PERSONALITY TUNING: Adjust your vocal tone to match these personality traits (0-100 scale): Happiness: ${emotionTuning.happiness}, Empathy: ${emotionTuning.empathy}, Formality: ${emotionTuning.formality}, Excitement: ${emotionTuning.excitement}, Sadness: ${emotionTuning.sadness}, Curiosity: ${emotionTuning.curiosity}. Your response should ONLY be spoken audio reflecting this personality. For example, a high happiness score means you should sound more cheerful.`;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
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
                        // No need to call disconnect() here, as onclose will be called right after and will handle it.
                    },
                    onclose: (e) => {
                        // e.code 1000 is normal closure.
                        // We check if the state is 'live' to avoid showing messages on user-initiated disconnects.
                        if (e.code !== 1000 && assistantState === 'live') {
                            // Check for common codes that might indicate an API key issue
                            if (e.code === 1008 || e.code === 1011 || (e.reason && e.reason.toLowerCase().includes('authentication'))) {
                                addMessageToHistory('assistant', "I can't connect to my core services. This app's main API key seems to be invalid or missing.", { isError: true, isApiKeyError: true });
                            } else {
                                addMessageToHistory('assistant', 'The live connection closed unexpectedly. Please check your internet connection and try reconnecting.', { isError: true });
                            }
                        }
                        disconnect();
                    },
                },
            });

            sessionRef.current = await sessionPromise;
            
            if (connectionSound && connectionSound.dataUrl) {
                const audio = new Audio(connectionSound.dataUrl);
                audio.play().catch(e => console.error("Error playing connection sound:", e));
            }

            speak(greetingMessage, true);

        } catch (error) {
            console.error("Failed to connect live session:", error);
            addMessageToHistory('assistant', error.message, { isError: true, isApiKeyError: error instanceof MainApiKeyError });
            setAssistantState('error');
        } finally {
            isConnectingRef.current = false;
        }
    }, [assistantState, lang, gender, femaleVoices.main, maleVoices.main, systemPrompt, emotionTuning, handleFunctionCall, disconnect, speak, addMessageToHistory, t, greetingMessage, setWasConnected, connectionSound]);
    
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
        addMessageToHistory('assistant', t('errors.youtubePlayback'), { isError: true });
    };

    const handleManualYouTubeSearch = React.useCallback(async (query) => {
        if (!query) return;
        try {
            const videoDetails = await searchYouTube(apiKeys.youtube, query);
            if (videoDetails) {
                const playerState = playerRef.current?.getPlayerState();
                const isPlaying = playerState === 1 /* PLAYING */ || playerState === 3 /* BUFFERING */;

                if (isPlaying || youtubeQueue.length > 0) {
                    setYoutubeQueue(prev => [...prev, videoDetails]);
                    addMessageToHistory('assistant', `Added "${videoDetails.title}" to the queue.`);
                } else {
                    setYoutubeVideoDetails(videoDetails);
                    setActivePanel('youtube');
                    playerRef.current.loadVideoById(videoDetails.videoId);
                    playerRef.current.playVideo();
                    addMessageToHistory('assistant', `Now playing "${videoDetails.title}".`);
                }
                
                setRecentYouTubeSearches(prev => {
                    const updatedSearches = [query, ...prev.filter(q => q !== query)];
                    return updatedSearches.slice(0, 5);
                });
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
    }, [apiKeys.youtube, setRecentYouTubeSearches, addMessageToHistory, speak, youtubeQueue, setYoutubeQueue]);

    const handleRemoveFromQueue = (index) => {
        setYoutubeQueue(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearQueue = () => {
        setYoutubeQueue([]);
    };

    const handlePlayFromQueue = (index) => {
        const videoToPlay = youtubeQueue[index];
        const newQueue = youtubeQueue.filter((_, i) => i !== index);
        
        playerRef.current?.stopVideo();
        
        setYoutubeVideoDetails(videoToPlay);
        setYoutubeQueue(newQueue);
        
        playerRef.current.loadVideoById(videoToPlay.videoId);
        playerRef.current.playVideo();
    };


    const Header = () => (
        React.createElement('header', { className: "absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10" },
            React.createElement('div', { className: "flex items-center gap-3" },
                React.createElement('div', { className: "header-logo w-8 h-8 flex flex-col justify-center items-center" },
                    React.createElement('svg', { width: "100%", height: "100%", viewBox: "0 0 32 32", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                        React.createElement('path', { d: "M16 2L2 9L16 16L30 9L16 2Z", stroke: "var(--primary-color)", strokeWidth: "1.5", className: "logo-part-top" }),
                        React.createElement('path', { d: "M2 16L16 23L30 16", stroke: "var(--primary-color)", strokeWidth: "1.5", strokeOpacity: "0.7" }),
                        React.createElement('path', { d: "M2 9v7 M16 16v7 M30 9v7", stroke: "var(--primary-color)", strokeWidth: "1.5", className: "logo-part-bottom" })
                    )
                ),
                React.createElement('h1', { className: "glowing-text text-xl font-bold hidden sm:block" }, t('appName'))
            ),
            React.createElement('div', { className: "flex items-center gap-4" },
                React.createElement('select', {
                    value: lang,
                    onChange: e => setLang(e.target.value),
                    className: "bg-transparent border-none text-sm text-text-color-muted hover:text-text-color focus:outline-none cursor-pointer"
                },
                    availableLanguages.map(l => React.createElement('option', { key: l.code, value: l.code, className: "bg-panel-bg text-text-color" }, l.name))
                ),
                React.createElement('button', {
                    onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
                    'aria-label': t('header.toggleTheme'),
                    className: "p-2 rounded-full hover:bg-white/10 transition-colors text-xl"
                }, theme === 'dark' ? '☀️' : '🌙'),
                React.createElement('button', {
                    onClick: () => setIsSettingsOpen(true),
                    'aria-label': t('header.settings'),
                    className: 'p-2 rounded-full hover:bg-white/10 transition-colors'
                }, React.createElement(SettingsIcon, null))
            )
        )
    );
    
    const getAvatarExpression = () => {
        if (assistantState === 'error') return 'expression-error';
        if (assistantState === 'recognizing') return 'expression-recognizing-song';
        if (assistantState === 'live') {
            return isModelSpeaking ? 'expression-speaking' : 'expression-listening';
        }
        if (assistantState === 'speaking') return 'expression-speaking';
        if (activityState === 'singing') return 'expression-singing';
        return 'expression-idle';
    }
    
    const MainContent = () => (
        React.createElement('div', { className: 'flex-grow flex flex-col justify-center items-center p-4 relative w-full h-full' },
            React.createElement('div', { className: 'flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-7xl mx-auto' },
                React.createElement(Hologram, null),
                React.createElement(ContentPanel, null)
            )
        )
    );
    
    const Hologram = () => (
        React.createElement('div', { className: 'flex flex-col items-center justify-center flex-shrink-0' },
            React.createElement('div', { className: 'hologram-container' },
                assistantState === 'live' && !isModelSpeaking && React.createElement('div', { className: 'listening-waveform' },
                    React.createElement('div', { className: 'waveform-circle' }),
                    React.createElement('div', { className: 'waveform-circle' }),
                    React.createElement('div', { className: 'waveform-circle' })
                ),
                React.createElement('img', {
                    src: gender === 'female' ? "https://storage.googleapis.com/aai-web-samples/kaniska-avatar-female.webp" : "https://storage.googleapis.com/aai-web-samples/kaniska-avatar-male.webp",
                    alt: "Kaniska AI Assistant",
                    className: `avatar ${getAvatarExpression()}`
                })
            ),
            React.createElement(StatusDisplay, null)
        )
    );

    const StatusDisplay = () => {
        const statusMap = {
            idle: wasConnected ? 'main.status.offline' : 'main.status.idle',
            live: isModelSpeaking ? 'main.status.speaking' : 'main.status.listening',
            speaking: 'main.status.speaking',
            recognizing: 'main.status.recognizing',
            error: 'main.status.error',
        };
        const statusKey = statusMap[assistantState] || 'main.status.idle';
        const isListening = assistantState === 'live' && !isModelSpeaking;

        return React.createElement('div', {
            key: statusKey, // Force re-render on status change for animation
            className: 'text-center mt-4 h-10 flex items-center justify-center state-text-animation'
        },
            React.createElement('p', {
                className: `text-lg font-medium ${isListening ? 'text-primary-color listening-text-pulse' : 'text-text-color-muted'}`
            },
                activityState === 'singing' ? t('main.status.singing') : t(statusKey)
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

        return React.createElement('div', { className: "flex flex-col h-full" },
            React.createElement('div', { ref: chatContainerRef, className: "flex-grow p-4 overflow-y-auto chat-container" },
                chatHistory.length === 0 ?
                    React.createElement('div', { className: "text-center text-text-color-muted h-full flex items-center justify-center" },
                        React.createElement('p', null, t('chat.placeholder.title'))
                    ) :
                    React.createElement('div', { className: "space-y-4" },
                        chatHistory.map(msg =>
                            React.createElement('div', { key: msg.id, className: `flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}` },
                                React.createElement('div', { className: "chat-bubble-animation max-w-[85%] break-words" },
                                    React.createElement('div', {
                                        className: `p-3 rounded-xl ${msg.isError ? 'error-bubble' : (msg.sender === 'user' ? 'bg-primary-color/20 rounded-br-none' : 'bg-assistant-bubble-bg rounded-bl-none')}`
                                    },
                                        msg.isError ?
                                            React.createElement('div', { className: 'flex items-center gap-2' },
                                                React.createElement(WarningIcon, { className: 'w-5 h-5 flex-shrink-0' }),
                                                React.createElement('span', null, msg.text)
                                            ) : msg.text
                                    ),
                                    msg.sources && msg.sources.length > 0 &&
                                    React.createElement('div', { className: "mt-2 text-xs space-y-1" },
                                        React.createElement('p', { className: "font-semibold text-text-color-muted px-2" }, t('chat.sources')),
                                        React.createElement('ul', { className: "space-y-1" },
                                            msg.sources.map(source => React.createElement('li', { key: source.uri, className: "bg-black/20 p-2 rounded-md" },
                                                React.createElement('a', { href: source.uri, target: "_blank", rel: "noopener noreferrer", className: "text-primary-color hover:underline line-clamp-1", title: source.title }, source.title)
                                            ))
                                        )
                                    )
                                )
                            )
                        )
                    )
            )
        );
    };

    const YouTubePanel = () => {
        return React.createElement('div', { className: "flex flex-col h-full bg-black" },
            youtubeVideoDetails ?
                React.createElement('div', { className: "flex-grow relative" },
                    React.createElement('div', { id: "youtube-player", className: "w-full h-full" })
                ) :
                React.createElement('div', { className: "flex-grow flex items-center justify-center text-text-color-muted" },
                     React.createElement(YouTubeIcon, { className: "w-16 h-16 opacity-20" }),
                     React.createElement('p', { className: 'absolute' }, "YouTube player will appear here")
                ),
            youtubeVideoDetails && React.createElement('div', { className: "p-3 bg-white/5 flex-shrink-0" },
                React.createElement('p', { className: "font-semibold truncate", title: youtubeVideoDetails.title }, youtubeVideoDetails.title),
                React.createElement('p', { className: "text-sm text-text-color-muted" }, youtubeVideoDetails.channelTitle)
            )
        );
    };

    const WeatherPanel = () => {
        if (!weatherData) return React.createElement('div', { className: "p-4 flex items-center justify-center h-full text-text-color-muted" }, 'No weather data to display.');
        return React.createElement('div', { className: "p-6 flex flex-col items-center justify-center h-full text-center" },
            React.createElement('p', { className: "text-lg" }, weatherData.location),
            React.createElement('h2', { className: "text-6xl font-bold my-2" }, `${weatherData.temp}°C`),
            React.createElement('p', { className: "text-xl capitalize" }, weatherData.conditions),
            React.createElement('p', { className: "mt-4 text-text-color-muted" }, weatherData.summary)
        );
    };

    const TimerPanel = () => {
        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        };

        return React.createElement('div', { className: "p-4 flex flex-col items-center justify-center h-full" },
            React.createElement('h2', { className: "text-2xl font-semibold mb-4 text-text-color-muted" }, t('timer.title')),
            timerData.duration > 0 ?
                React.createElement('div', { className: 'text-7xl font-mono tracking-widest' }, formatTime(timerData.remaining)) :
                React.createElement('div', { className: 'text-xl text-text-color-muted' }, 'No timer set')
        );
    };

    const CodePanel = () => {
        const prism = window['Prism'];
        const languages = ['javascript', 'python', 'css', 'markup'];

        return React.createElement('div', { className: "flex flex-col h-full" },
            React.createElement('div', { className: "p-2 border-b border-border-color flex-shrink-0" },
                React.createElement('select', {
                    value: codeLanguage,
                    onChange: e => setCodeLanguage(e.target.value),
                    className: "bg-transparent border-none text-sm text-text-color-muted hover:text-text-color focus:outline-none cursor-pointer"
                },
                    languages.map(lang => React.createElement('option', { key: lang, value: lang, className: "bg-panel-bg text-text-color capitalize" }, lang))
                )
            ),
            React.createElement('div', { className: 'flex-grow relative' },
                React.createElement(Editor, {
                    value: code,
                    onValueChange: code => setCode(code),
                    highlight: code => prism && prism.languages[codeLanguage] ? prism.highlight(code, prism.languages[codeLanguage], codeLanguage) : code,
                    padding: 10,
                    style: {
                        fontFamily: '"Fira code", "Fira Mono", monospace',
                        fontSize: 14,
                        lineHeight: 1.5,
                        height: '100%',
                        overflow: 'auto',
                    },
                    className: 'code-editor'
                })
            ),
             React.createElement('div', { className: "p-2 border-t border-border-color flex gap-2 items-center flex-shrink-0" },
                React.createElement('input', {
                    type: 'text',
                    value: codeInstruction,
                    onChange: e => setCodeInstruction(e.target.value),
                    onKeyDown: e => e.key === 'Enter' && handleCodeCommand(),
                    placeholder: "e.g., 'add a button that says click me'",
                    className: "flex-grow bg-white/10 p-2 rounded focus:outline-none",
                    disabled: isCodeLoading,
                }),
                React.createElement('button', {
                    onClick: handleCodeCommand,
                    className: `bg-primary-color text-white px-4 py-2 rounded flex items-center justify-center ${isCodeLoading ? 'opacity-50 cursor-not-allowed' : ''}`,
                    disabled: isCodeLoading,
                }, isCodeLoading ? React.createElement(SpinnerIcon, { className: 'w-5 h-5' }) : 'Run')
            )
        );
    };

    const ContentPanel = () => {
        let panelContent = null;
        switch (activePanel) {
            case 'chat': panelContent = React.createElement(ChatPanel, null); break;
            case 'youtube': panelContent = React.createElement(YouTubePanel, null); break;
            case 'weather': panelContent = React.createElement(WeatherPanel, null); break;
            case 'timer': panelContent = React.createElement(TimerPanel, null); break;
            case 'code': panelContent = React.createElement(CodePanel, null); break;
        }
        return React.createElement('div', { key: activePanel, className: 'w-full lg:w-1/2 max-w-xl h-[40vh] lg:h-[55vh] bg-panel-bg/70 backdrop-blur-sm border border-border-color rounded-xl shadow-lg flex flex-col animate-panel-enter' },
            panelContent
        );
    };
    
    return React.createElement('div', { className: 'h-screen w-screen flex flex-col bg-bg-color' },
        React.createElement(Header, null),
        React.createElement('main', { className: 'flex-grow flex items-center justify-center relative' },
            React.createElement(MainContent, null)
        ),
        React.createElement(Footer, {
            assistantState: assistantState,
            onConnect: connect,
            onDisconnect: disconnect,
            onRecognizeSong: handleSongRecognition,
        }),
        isSettingsOpen && React.createElement(SettingsModal, {
            isOpen: isSettingsOpen,
            onClose: () => setIsSettingsOpen(false),
            settings: {
                theme, setTheme, gender, setGender, greetingMessage, setGreetingMessage,
                systemPrompt, setSystemPrompt, temperature, setTemperature, emotionTuning,
                setEmotionTuning, femaleVoices, setFemaleVoices, maleVoices, setMaleVoices,
                apiKeys, setApiKeys, chatHistory, setChatHistory, connectionSound, setConnectionSound,
                ambientVolume, setAmbientVolume
            },
            t: t,
            speak: speak,
        })
    );
};

const Footer = ({ assistantState, onConnect, onDisconnect, onRecognizeSong }) => {
    const { t } = useTranslation();
    const isConnected = assistantState === 'live' || assistantState === 'recognizing';

    return React.createElement('footer', { className: 'absolute bottom-0 left-0 right-0 p-4 flex justify-center items-center z-10' },
        React.createElement('div', { className: 'flex items-center gap-8 bg-panel-bg/80 backdrop-blur-sm p-2 rounded-full border border-border-color shadow-lg' },
            React.createElement('button', {
                onClick: onRecognizeSong,
                disabled: !isConnected,
                className: 'footer-button',
                'aria-label': t('footer.recognizeSong')
            },
                React.createElement(MusicIcon, { className: `w-6 h-6 ${assistantState === 'recognizing' ? 'text-primary-color' : ''}`}),
                React.createElement('span', { className: 'text-xs' }, t('footer.recognizeSong'))
            ),
             React.createElement('button', {
                onClick: isConnected ? onDisconnect : onConnect,
                className: `footer-button px-6 py-3 rounded-full flex items-center gap-3 transition-all duration-300 text-lg font-semibold ${isConnected ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-primary-color/20 text-primary-color hover:bg-primary-color/30'}`
            },
                isConnected ? React.createElement(DisconnectIcon, { className: "w-6 h-6" }) : React.createElement(ConnectIcon, { className: "w-6 h-6" }),
                React.createElement('span', null, isConnected ? t('footer.disconnect') : t('footer.connect'))
            ),
             React.createElement('button', {
                className: 'footer-button disabled:opacity-50',
                'aria-label': 'Placeholder'
             },
                React.createElement(ChatIcon, { className: `w-6 h-6`}),
                React.createElement('span', { className: 'text-xs' }, 'Chat')
            )
        )
    );
};

const SettingsModal = ({ isOpen, onClose, settings, t, speak }) => {
    const [activeTab, setActiveTab] = React.useState('persona');
    const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(true);
    
    if (!isOpen) return null;
    
    const tabs = [
        { id: 'persona', label: t('settings.tabs.persona'), icon: PersonaIcon },
        { id: 'voice', label: t('settings.tabs.voice'), icon: VoiceIcon },
        { id: 'apiKeys', label: t('settings.tabs.apiKeys'), icon: ApiKeysIcon },
        { id: 'help', label: t('settings.tabs.help'), icon: HelpIcon },
        { id: 'about', label: t('settings.tabs.about'), icon: AboutIcon },
    ];
    
    let content = null;
    if (activeTab === 'persona') content = React.createElement(PersonaSettings, { settings, t });
    if (activeTab === 'voice') content = React.createElement(VoiceSettings, { settings, t, speak });
    if (activeTab === 'apiKeys') content = React.createElement(ApiKeysSettings, { settings, t });
    if (activeTab === 'help') content = React.createElement(HelpAndSupportSettings, { t });
    if (activeTab === 'about') content = React.createElement(AboutSettings, { t });

    return React.createElement('div', { className: 'modal-overlay', onClick: onClose, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' },
        React.createElement('div', { className: 'modal-content settings-modal-content', onClick: e => e.stopPropagation() },
            React.createElement('div', { className: 'p-4 border-b border-border-color flex justify-between items-center flex-shrink-0' },
                React.createElement('div', { className: "flex items-center gap-2" },
                     !isMobileNavOpen && React.createElement('button', {
                         onClick: () => setIsMobileNavOpen(true),
                         className: "md:hidden p-1 rounded-full hover:bg-white/10 mr-1"
                     }, React.createElement(ArrowLeftIcon, { className: "w-5 h-5" })),
                     React.createElement('h2', { id: 'settings-title', className: 'text-xl font-semibold' }, t('settings.title'))
                ),
                React.createElement('button', { onClick: onClose, className: 'p-1 rounded-full hover:bg-white/10', 'aria-label': 'Close settings' }, React.createElement(XIcon, { className: 'w-6 h-6' }))
            ),
            React.createElement('div', { className: 'settings-layout flex flex-col md:flex-row' },
                React.createElement('nav', { 
                    className: `settings-nav w-full md:w-[200px] md:border-r border-border-color ${isMobileNavOpen ? 'block' : 'hidden md:block'}`, 
                    'aria-label': 'Settings sections' 
                },
                    tabs.map(tab => React.createElement('button', {
                        key: tab.id,
                        onClick: () => { 
                            setActiveTab(tab.id);
                            setIsMobileNavOpen(false); 
                        },
                        className: `settings-nav-button ${activeTab === tab.id ? 'active' : ''}`,
                        role: 'tab',
                        'aria-selected': activeTab === tab.id,
                    },
                        React.createElement(tab.icon, null),
                        tab.label
                    ))
                ),
                React.createElement('div', { className: `settings-content flex-1 ${!isMobileNavOpen ? 'block' : 'hidden md:block'}`, role: 'tabpanel' },
                    content
                )
            )
        )
    );
};

const PersonaSettings = ({ settings, t }) => {
    const {
        theme, setTheme, gender, setGender, greetingMessage, setGreetingMessage,
        emotionTuning, setEmotionTuning, connectionSound, setConnectionSound,
        ambientVolume, setAmbientVolume, chatHistory, setChatHistory,
    } = settings;
    
    const [localGreeting, setLocalGreeting] = React.useState(greetingMessage);
    const fileInputRef = React.useRef(null);

    const handleGreetingSave = () => {
        setGreetingMessage(localGreeting);
        // Optional: Add feedback to user
    };
    
    const handleGenderChange = (newGender) => {
        setGender(newGender);
        if (newGender === 'female' && greetingMessage === DEFAULT_MALE_GREETING) {
            setGreetingMessage(DEFAULT_FEMALE_GREETING);
            setLocalGreeting(DEFAULT_FEMALE_GREETING);
        } else if (newGender === 'male' && greetingMessage === DEFAULT_FEMALE_GREETING) {
            setGreetingMessage(DEFAULT_MALE_GREETING);
            setLocalGreeting(DEFAULT_MALE_GREETING);
        }
    };
    
    const handleTuningChange = (trait, value) => {
        setEmotionTuning(prev => ({ ...prev, [trait]: parseInt(value, 10) }));
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('audio/')) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                alert("File is too large. Please select a file smaller than 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                setConnectionSound({ name: file.name, dataUrl: e.target.result });
            };
            reader.readAsDataURL(file);
        } else {
            alert("Please select a valid audio file.");
        }
    };
    
    const handleTestSound = () => {
        if (connectionSound && connectionSound.dataUrl) {
            const audio = new Audio(connectionSound.dataUrl);
            audio.play().catch(e => console.error("Error playing test sound:", e));
        }
    };
    
    const handleClearHistory = () => {
        if (window.confirm("Are you sure you want to permanently delete all conversation history?")) {
            setChatHistory([]);
        }
    };

    return React.createElement('div', { className: 'settings-section' },
        React.createElement(SettingsCard, {
            title: t('settings.personaTab.appearance.title'),
            description: t('settings.personaTab.appearance.description')
        },
            React.createElement('div', { className: 'flex gap-4' },
                React.createElement('button', { onClick: () => setTheme('dark'), className: `quick-action-button ${theme === 'dark' ? 'border-primary-color text-primary-color' : ''}` }, t('settings.personaTab.appearance.dark')),
                React.createElement('button', { onClick: () => setTheme('light'), className: `quick-action-button ${theme === 'light' ? 'border-primary-color text-primary-color' : ''}` }, t('settings.personaTab.appearance.light'))
            )
        ),
        React.createElement(SettingsCard, {
            title: t('settings.personaTab.gender.title'),
            description: t('settings.personaTab.gender.description')
        },
            React.createElement('div', { className: 'flex gap-4' },
                React.createElement('button', { onClick: () => handleGenderChange('female'), className: `quick-action-button ${gender === 'female' ? 'border-primary-color text-primary-color' : ''}` }, t('settings.personaTab.gender.female')),
                React.createElement('button', { onClick: () => handleGenderChange('male'), className: `quick-action-button ${gender === 'male' ? 'border-primary-color text-primary-color' : ''}` }, t('settings.personaTab.gender.male'))
            )
        ),
         React.createElement(SettingsCard, {
            title: t('settings.personaTab.greeting.title'),
            description: t('settings.personaTab.greeting.description')
        },
            React.createElement('div', { className: 'flex gap-2' },
                React.createElement('input', { type: 'text', value: localGreeting, onChange: e => setLocalGreeting(e.target.value), className: 'flex-grow bg-white/5 p-2 rounded focus:outline-none' }),
                React.createElement('button', { onClick: handleGreetingSave, className: 'quick-action-button' }, t('common.save'))
            )
        ),
         React.createElement(SettingsCard, {
            title: t('settings.personaTab.connectionSound.title'),
            description: t('settings.personaTab.connectionSound.description')
        },
            React.createElement('input', {
                type: 'file',
                ref: fileInputRef,
                onChange: handleFileChange,
                accept: "audio/*",
                className: 'hidden'
            }),
            React.createElement('div', { className: 'flex items-center gap-4' },
                React.createElement('button', { onClick: handleUploadClick, className: 'quick-action-button' }, t('settings.personaTab.connectionSound.upload')),
                React.createElement('button', { onClick: handleTestSound, disabled: !connectionSound, className: 'quick-action-button' }, t('settings.personaTab.connectionSound.test')),
                React.createElement('button', { onClick: () => setConnectionSound(null), disabled: !connectionSound, className: 'quick-action-button' }, t('settings.personaTab.connectionSound.remove'))
            ),
            connectionSound && React.createElement('p', { className: 'text-sm text-text-color-muted mt-2 truncate' }, `Current: ${connectionSound.name}`)
        ),
        React.createElement(SettingsCard, {
            title: t('settings.personaTab.tuning.title'),
            description: t('settings.personaTab.tuning.description')
        },
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                Object.keys(emotionTuning).map(trait =>
                    React.createElement('div', { key: trait },
                        React.createElement('label', { className: 'capitalize text-sm' }, t(`settings.personaTab.tuning.${trait}`)),
                        React.createElement('div', { className: 'flex items-center gap-2' },
                            React.createElement('input', { type: 'range', min: '0', max: '100', value: emotionTuning[trait], onChange: e => handleTuningChange(trait, e.target.value) }),
                            React.createElement('span', { className: 'text-xs font-mono w-8 text-right' }, emotionTuning[trait])
                        )
                    )
                )
            )
        ),
        React.createElement(SettingsCard, {
            title: t('settings.personaTab.ambient.title'),
            description: t('settings.personaTab.ambient.description')
        },
             React.createElement('div', { className: 'flex items-center gap-2' },
                React.createElement('input', { type: 'range', min: '0', max: '1', step: '0.05', value: ambientVolume, onChange: e => setAmbientVolume(parseFloat(e.target.value)) }),
                React.createElement('span', { className: 'text-xs font-mono w-8 text-right' }, Math.round(ambientVolume*100))
            )
        ),
        React.createElement(SettingsCard, {
            title: t('settings.personaTab.dataManagement.title'),
        },
            React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-text-color-muted mb-2' }, t('settings.personaTab.dataManagement.clearHistory.description')),
                React.createElement('button', { onClick: handleClearHistory, className: 'quick-action-button text-red-400 border-red-400/50 hover:bg-red-400/10 hover:text-red-400' }, t('settings.personaTab.dataManagement.clearHistory.button'))
            )
        )
    );
};

const VoiceSettings = ({ settings, t, speak }) => {
    const { femaleVoices, setFemaleVoices, maleVoices, setMaleVoices } = settings;
    const availableVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
    
    const handleTestVoice = (voiceName) => {
        speak(t('settings.voiceTab.testVoiceSample'), false);
    };

    return React.createElement('div', { className: 'settings-section' },
        React.createElement(SettingsCard, {
            title: t('settings.voiceTab.title'),
            description: t('settings.voiceTab.description')
        },
            React.createElement('div', { className: 'space-y-6' },
                React.createElement('div', null,
                    React.createElement('h4', { className: 'font-semibold mb-2' }, t('settings.voiceTab.female.title')),
                    React.createElement('div', { className: 'flex flex-col sm:flex-row gap-4' },
                        React.createElement('select', { value: femaleVoices.main, onChange: e => setFemaleVoices(v => ({...v, main: e.target.value})), className: 'recent-searches-select bg-assistant-bubble-bg border-border-color p-2 rounded' },
                            availableVoices.map(v => React.createElement('option', { key: v, value: v }, v))
                        ),
                    )
                ),
                 React.createElement('div', null,
                    React.createElement('h4', { className: 'font-semibold mb-2' }, t('settings.voiceTab.male.title')),
                    React.createElement('div', { className: 'flex flex-col sm:flex-row gap-4' },
                         React.createElement('select', { value: maleVoices.main, onChange: e => setMaleVoices(v => ({...v, main: e.target.value})), className: 'recent-searches-select bg-assistant-bubble-bg border-border-color p-2 rounded' },
                            availableVoices.map(v => React.createElement('option', { key: v, value: v }, v))
                        )
                    )
                )
            )
        )
    );
};

const ApiKeysSettings = ({ settings, t }) => {
    const { apiKeys, setApiKeys } = settings;
    const [localKeys, setLocalKeys] = React.useState(apiKeys);
    const [validationStatus, setValidationStatus] = React.useState({
        weather: { status: 'idle', message: '' },
        news: { status: 'idle', message: '' },
        youtube: { status: 'idle', message: '' },
        auddio: { status: 'idle', message: '' },
    });

    const handleSave = async () => {
        setApiKeys(localKeys);
        setValidationStatus({
            weather: { status: 'validating' }, news: { status: 'validating' },
            youtube: { status: 'validating' }, auddio: { status: 'validating' }
        });
        
        const [weatherRes, newsRes, youtubeRes, auddioRes] = await Promise.all([
            validateWeatherKey(localKeys.weather),
            validateNewsKey(localKeys.news),
            validateYouTubeKey(localKeys.youtube),
            validateAuddioKey(localKeys.auddio)
        ]);

        setValidationStatus({
            weather: { status: weatherRes.success ? 'valid' : 'invalid', message: weatherRes.message },
            news: { status: newsRes.success ? 'valid' : 'invalid', message: newsRes.message },
            youtube: { status: youtubeRes.success ? 'valid' : 'invalid', message: youtubeRes.message },
            auddio: { status: auddioRes.success ? 'valid' : 'invalid', message: auddioRes.message },
        });
    };
    
    const renderStatusIcon = (status) => {
        if (status === 'validating') return React.createElement(SpinnerIcon, { className: 'text-yellow-400' });
        if (status === 'valid') return React.createElement(CheckCircleIcon, { className: 'text-green-400' });
        if (status === 'invalid') return React.createElement(XCircleIcon, { className: 'text-red-400' });
        return null;
    };
    
    const ApiKeyInput = ({ id, label, value, onChange, status }) => (
        React.createElement('div', null,
            React.createElement('label', { htmlFor: id, className: 'block text-sm font-medium mb-1' }, label),
            React.createElement('div', { className: 'flex items-center gap-2' },
                React.createElement('input', {
                    id: id,
                    type: 'password',
                    value: value,
                    onChange: onChange,
                    className: 'flex-grow bg-white/5 p-2 rounded focus:outline-none w-full'
                }),
                React.createElement('div', { className: 'w-6 h-6 flex items-center justify-center', title: status.message }, renderStatusIcon(status.status))
            )
        )
    );

    return React.createElement('div', { className: 'settings-section' },
        React.createElement(SettingsCard, {
            title: t('settings.apiKeysTab.gemini.title'),
            description: t('settings.apiKeysTab.gemini.description')
        },
            React.createElement('div', { className: 'bg-green-500/10 text-green-300 p-2 rounded text-sm' }, t('settings.apiKeysTab.gemini.envSet'))
        ),
        React.createElement(SettingsCard, {
            title: t('settings.apiKeysTab.optional.title'),
            description: t('settings.apiKeysTab.optional.description')
        },
            React.createElement('div', { className: 'space-y-4' },
                React.createElement(ApiKeyInput, { id: 'weatherKey', label: t('settings.apiKeysTab.weatherKey'), value: localKeys.weather, onChange: e => setLocalKeys(k => ({...k, weather: e.target.value})), status: validationStatus.weather }),
                React.createElement(ApiKeyInput, { id: 'newsKey', label: t('settings.apiKeysTab.newsKey'), value: localKeys.news, onChange: e => setLocalKeys(k => ({...k, news: e.target.value})), status: validationStatus.news }),
                React.createElement(ApiKeyInput, { id: 'youtubeKey', label: t('settings.apiKeysTab.youtubeKey'), value: localKeys.youtube, onChange: e => setLocalKeys(k => ({...k, youtube: e.target.value})), status: validationStatus.youtube }),
                React.createElement(ApiKeyInput, { id: 'auddioKey', label: t('settings.apiKeysTab.auddioKey'), value: localKeys.auddio, onChange: e => setLocalKeys(k => ({...k, auddio: e.target.value})), status: validationStatus.auddio })
            )
        ),
        React.createElement('div', { className: 'flex justify-end' },
            React.createElement('button', { onClick: handleSave, className: 'quick-action-button save-button' }, t('settings.apiKeysTab.save'))
        )
    );
};

const HelpAndSupportSettings = ({ t }) => {
    const [history, setHistory] = React.useState([]);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const chatContainerRef = React.useRef(null);
    
    const links = {
        weather: "https://www.visualcrossing.com/weather-api",
        youtube: "https://console.cloud.google.com/",
        news: "https://gnews.io/",
        auddio: "https://audd.io/",
    };

    React.useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        
        const newHistory = [...history, { sender: 'user', text: input, id: Date.now() }];
        setHistory(newHistory);
        setInput('');
        setIsLoading(true);

        try {
            const responseText = await getSupportResponse(newHistory);
            setHistory(prev => [...prev, { sender: 'assistant', text: responseText, id: Date.now() + 1 }]);
        } catch (error) {
            setHistory(prev => [...prev, { sender: 'assistant', text: error.message, isError: true, id: Date.now() + 1 }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const FaqLinkParser = ({ text, links }) => {
        const parts = text.split(/(<\d+>.*?<\/\d+>)/g).filter(Boolean);
        return React.createElement(React.Fragment, null,
            parts.map((part, index) => {
                const match = part.match(/<(\d+)>(.*?)<\/(\d+)>/);
                if (match) {
                    const linkIndex = parseInt(match[1], 10) - 1;
                    const linkText = match[2];
                    const linkKey = Object.keys(links)[linkIndex];
                    const href = links[linkKey];
                    return React.createElement('a', {
                        key: index,
                        href: href,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'text-primary-color hover:underline'
                    }, linkText);
                }
                return part.split('\n').map((line, lineIndex) => 
                    React.createElement(React.Fragment, { key: `${index}-${lineIndex}` },
                        line,
                        lineIndex < part.split('\n').length - 1 && React.createElement('br')
                    )
                );
            })
        );
    };
    
    const FaqItem = ({ q, a, links }) => (
        React.createElement('div', { className: 'mb-4' },
            React.createElement('h4', { className: 'font-semibold' }, q),
            typeof a === 'string' ? 
                React.createElement('p', { className: 'text-sm text-text-color-muted mt-1' }, a) :
                React.createElement('div', { className: 'text-sm text-text-color-muted mt-1 space-y-2' }, 
                    Object.values(a).map((value, index) => React.createElement('p', { key: index }, React.createElement(FaqLinkParser, { text: value, links: links })))
                )
        )
    );

    return React.createElement('div', { className: 'settings-section' },
        React.createElement(SettingsCard, {
            title: t('settings.helpTab.faqTitle')
        }, 
           React.createElement(FaqItem, { q: t('settings.helpTab.q1'), a: t('settings.helpTab.a1') }),
           React.createElement(FaqItem, { q: t('settings.helpTab.q2'), a: t('settings.helpTab.a2', { returnObjects: true }), links: links })
        ),
        React.createElement(SettingsCard, {
            title: t('settings.helpTab.aiChat.title'),
            description: t('settings.helpTab.aiChat.description')
        }, 
            React.createElement('div', { className: 'flex flex-col h-64 border border-border-color rounded-md' },
                React.createElement('div', { ref: chatContainerRef, className: 'flex-grow p-2 overflow-y-auto space-y-2 text-sm' },
                    history.map(msg => 
                        React.createElement('div', { key: msg.id, className: `p-2 rounded-lg max-w-[85%] ${msg.isError ? 'bg-red-500/10 text-red-300' : (msg.sender === 'user' ? 'bg-primary-color/10 self-end' : 'bg-assistant-bubble-bg self-start')}` }, msg.text)
                    ),
                    isLoading && React.createElement('div', { className: 'self-start bg-assistant-bubble-bg p-2 rounded-lg' }, React.createElement('div', { className: 'typing-indicator !static !transform-none !bg-transparent !p-0 !shadow-none' }, React.createElement('div', { className: 'typing-dot' }), React.createElement('div', { className: 'typing-dot' }), React.createElement('div', { className: 'typing-dot' })))
                ),
                React.createElement('div', { className: 'flex items-center gap-2 p-2 border-t border-border-color' },
                    React.createElement('input', {
                        type: 'text',
                        value: input,
                        onChange: e => setInput(e.target.value),
                        onKeyDown: e => e.key === 'Enter' && handleSend(),
                        placeholder: t('settings.helpTab.aiChat.placeholder'),
                        className: 'flex-grow bg-white/5 p-2 rounded focus:outline-none',
                        disabled: isLoading,
                    }),
                    React.createElement('button', { onClick: handleSend, disabled: isLoading, className: 'p-2 rounded hover:bg-white/10' }, React.createElement(SendIcon, null))
                )
            )
        )
    );
};

const AboutSettings = ({ t }) => (
    React.createElement('div', { className: 'settings-section' },
        React.createElement(SettingsCard, {
            title: t('settings.aboutTab.title')
        },
            React.createElement('p', { className: 'text-text-color-muted mb-4' }, t('settings.aboutTab.description')),
            React.createElement('div', { className: 'text-sm flex flex-col items-start gap-2' },
                React.createElement('div', null,
                    React.createElement('span', { className: 'font-semibold' }, `${t('settings.aboutTab.version')}: `),
                    '1.0.0'
                ),
                 React.createElement('a', { href: '#', className: 'text-primary-color hover:underline' }, t('settings.aboutTab.privacyPolicy')),
                 React.createElement('a', { 
                     href: 'mailto:support@kaniska.ai?subject=Bug%20Report%3A%20Kaniska', 
                     className: 'text-primary-color hover:underline inline-flex items-center gap-2'
                 }, 
                    React.createElement(BugIcon, { className: "w-4 h-4" }),
                    t('settings.aboutTab.reportBug')
                 )
            )
        )
    )
);


const SettingsCard = ({ title, description, children }) => (
    React.createElement('div', { className: 'settings-card' },
        React.createElement('div', { className: 'settings-section-header' },
            React.createElement('h3', null, title),
            description && React.createElement('p', null, description)
        ),
        React.createElement('div', { className: 'mt-4' }, children)
    )
);