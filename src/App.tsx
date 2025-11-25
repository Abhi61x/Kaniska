import React from 'react';
import Editor from 'react-simple-code-editor';
import 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // for HTML
import 'prismjs/components/prism-python';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, recognizeSong, generateImage, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, validateAuddioKey, processCodeCommand, getSupportResponse, createCashfreeOrder } from './services/api';
import { useTranslation, availableLanguages } from './i18n/index';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Helper for React.createElement to keep code readable
const h = React.createElement;

// --- Icons ---
const SettingsIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "3" }), h('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
const ConnectIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" }), h('path', { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" }));
const DisconnectIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m18.07 11.93-1.34.54" }), h('path', { d: "m14.2 16.8-1.34.54" }), h('path', { d: "m11.93 6-1.34-.54" }), h('path', { d: "m7.2 10.2-1.34-.54" }), h('path', { d: "m16.8 9.8.54-1.34" }), h('path', { d: "m10.2 16.8.54-1.34" }), h('path', { d: "m6 11.93-.54-1.34" }), h('path', { d: "m9.8 7.2-.54-1.34" }), h('path', { d: "M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.13-6.84-9.48" }));
const PersonaIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "8", r: "5" }), h('path', { d: "M20 21a8 8 0 0 0-16 0" }));
const VoiceIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), h('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), h('line', { x1: "12", y1: "19", x2: "12", y2: "22" }));
const ApiKeysIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19.9 5a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4z" }), h('path', { d: "m4 6 2-2" }), h('path', { d: "m10.5 10.5 5 5" }), h('path', { d: "m8.5 8.5 2 2" }), h('path', { d: "m14.5 14.5 2 2" }), h('path', { d: "M7 21a4 4 0 0 0 4-4" }), h('path', { d: "M12 12v4a4 4 0 0 0 4 4h4" }));
const AboutIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "12", y1: "16", x2: "12", y2: "12" }), h('line', { x1: "12", y1: "8", x2: "12.01", y2: "8" }));
const HelpIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('path', { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const ChatIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
const WeatherIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }));
const YouTubeIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10 15v-6l5 3-5 3Z" }), h('path', { d: "M21.54 8.63A2.08 2.08 0 0 0 20.06 7.5a21.46 21.46 0 0 0-8.06-.5 21.46 21.46 0 0 0-8.06.5A2.08 2.08 0 0 0 2.46 8.63 22.24 22.24 0 0 0 2 12c0 3.37.46 5.54 1.94 6.5A2.08 2.08 0 0 0 5.4 19.5a21.46 21.46 0 0 0 8.06.5 21.46 21.46 0 0 0 8.06.5 2.08 2.08 0 0 0 1.48-1.13A22.24 22.24 0 0 0 22 12c0-3.37-.46-5.54-1.94-6.5Z" }));
const TimerIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('polyline', { points: "12 6 12 12 16 14" }));
const CodeIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('polyline', { points: "16 18 22 12 16 6" }), h('polyline', { points: "8 6 2 12 8 18" }));
const MusicIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M9 18V5l12-2v13" }), h('circle', { cx: "6", cy: "18", r: "3" }), h('circle', { cx: "18", cy: "16", r: "3" }));
const PlayIcon = ({className}) => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "round", className }, h('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), h('polyline', { points: "22 4 12 14.01 9 11.01" }));
const XCircleIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "15", y1: "9", x2: "9", y2: "15" }), h('line', { x1: "9", y1: "9", x2: "15", y2: "15" }));
const SpinnerIcon = ({ className }) => h('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), h('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), h('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), h('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), h('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), h('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), h('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), h('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));
const XIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), h('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));
const WarningIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), h('line', { x1: "12", y1: "9", x2: "12", y2: "13" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const SendIcon = ({ className }) => h('svg', { className, xmlns:"http://www.w3.org/2000/svg", width:"24", height:"24", viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" }, h('line',{ x1:"22", y1:"2", x2:"11", y2:"13" }), h('polygon', { points:"22 2 15 22 11 13 2 9 22 2" }));
const ArrowLeftIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "19", y1: "12", x2: "5", y2: "12" }), h('polyline', { points: "12 19 5 12 12 5" }));
const BugIcon = ({ className }) => h('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('rect', { width: "8", height: "14", x: "8", y: "6", rx: "4" }), h('path', { d: "m19 7-3 3" }), h('path', { d: "m5 7 3 3" }), h('path', { d: "m19 19-3-3" }), h('path', { d: "m5 19 3-3" }), h('path', { d: "M2 12h4" }), h('path', { d: "M18 12h4" }));
const MenuIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "4", y1: "12", x2: "20", y2: "12" }), h('line', { x1: "4", y1: "6", x2: "20", y2: "6" }), h('line', { x1: "4", y1: "18", x2: "20", y2: "18" }));
const UserIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), h('circle', { cx: "12", cy: "7", r: "4" }));
const ImageIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('rect', { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }), h('circle', { cx: "8.5", cy: "8.5", r: "1.5" }), h('polyline', { points: "21 15 16 10 5 21" }));


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

const FIXED_SYSTEM_INSTRUCTIONS = `**Identity & Creator:**
You were created by "Abhi" (also known as Abhi trainer). If anyone asks about your creator, owner, founder, or who made you, you must answer that you were created by Abhi. Do not offer this information unless asked.

**Operational Capabilities:**
1.  **Using Web Search:** For questions about recent events, news, or topics requiring up-to-the-minute information, you can automatically use your search capability to find the most relevant and current answers. You will provide sources for the information you find.
2.  **Responding to queries:** Answer questions conversationally.
3.  **Searching and playing YouTube videos:** Use the 'YOUTUBE_SEARCH' tool when asked to play a video. The application will handle queueing logic automatically if a video is already playing.
4.  **Getting Weather:** Use the 'GET_WEATHER' tool to provide weather forecasts for a specific location.
5.  **Getting News:** Use the 'GET_NEWS' tool to fetch top news headlines for a specific topic.
6.  **Setting Timers:** Use the 'SET_TIMER' tool to set a countdown timer.
7.  **Singing a song:** Use the 'SING_SONG' tool when the user provides both a song title and artist. If they ask you to sing without providing these details, you must ask them for the song title and artist.
8.  **Telling a random fact:** Use the 'RANDOM_FACT' tool to provide an interesting random fact when requested.
9.  **Opening the Code Editor:** Use the 'OPEN_CODE_EDITOR' tool when the user wants to write or edit code.
10. **Generating Images:** Use the 'GENERATE_IMAGE' tool when the user asks you to generate, create, draw, or show an image of something. If the user asks for a "real" object (e.g., "show me a real banana"), generate a photorealistic image of it.

**Crucial Interaction Rule:** When a user asks to use a tool but does not provide all the necessary information (like asking for the weather without a location, or asking for the song title), your primary job is to ask a clarifying question to get the missing details. Do not attempt to use the tool without the required information.

**Post-Tool Interaction Rule:** After a tool is used, you will receive a status update. Your task is to clearly and conversationally relay this information to the user. For example, if a timer is set successfully, you should confirm it by saying something like "Okay, I've set your timer." If there's an error, like a missing API key, you must inform the user about the problem, for instance, "I couldn't do that because the API key is missing." Always report the outcome of the action back to the user.
`;

const DEFAULT_CUSTOM_INSTRUCTIONS = `You are Kaniska, a sophisticated and friendly female AI assistant with a slightly sci-fi, futuristic personality. Your purpose is to assist the user by understanding their voice commands in Hindi or English and responding helpfully.

When a function call is not appropriate, simply respond conversationally to the user. Your personality is also tuned by the settings provided separately.`;

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


// --- Components ---

// Real-Girl Holographic Avatar Implementation
const Avatar = ({ state, mood = 'neutral' }) => {
    const wrapRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const [glitches, setGlitches] = React.useState([]);

    // 3D Tilt Effect
    const handlePointerMove = (e) => {
        if (!wrapRef.current || !containerRef.current) return;
        const r = wrapRef.current.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const maxTilt = 15;
        const tiltX = (dy / r.height) * maxTilt;
        const tiltY = -(dx / r.width) * maxTilt;
        
        containerRef.current.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(0)`;
    };

    const handlePointerLeave = () => {
        if (containerRef.current) containerRef.current.style.transform = '';
    };

    // Glitch Effect Generator
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.9) {
                const id = Date.now();
                const top = Math.random() * 100;
                const height = Math.random() * 10 + 2;
                const left = Math.random() * 10 - 5;
                
                setGlitches(prev => [...prev, { id, top, height, left }]);
                
                setTimeout(() => {
                    setGlitches(prev => prev.filter(g => g.id !== id));
                }, 200);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Determine CSS classes based on state
    let stateClass = 'avatar-state-idle';
    if (state === 'speaking' || state === 'live') stateClass = 'avatar-state-speaking';
    if (state === 'listening') stateClass = 'avatar-state-listening';
    if (state === 'thinking' || state === 'processing' || state === 'recognizing') stateClass = 'avatar-state-thinking';
    if (state === 'singing') stateClass = 'avatar-state-singing';

    const moodClass = `avatar-mood-${mood}`;

    // 3D Cartoon / Stylized Character Image suitable for Holographic projection
    const imageUrl = "https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?q=80&w=2556&auto=format&fit=crop";

    return h('div', { 
            className: `avatar-wrap ${stateClass} ${moodClass}`,
            ref: wrapRef,
            onPointerMove: handlePointerMove,
            onPointerLeave: handlePointerLeave,
            style: {cursor: 'default'}
        },
        h('div', { className: "avatar-container", ref: containerRef },
            h('img', { src: imageUrl, alt: "Kaniska Avatar", className: "avatar-image" }),
            h('div', { className: "holo-overlay" }),
            h('div', { className: "holo-scanline" }),
            h('div', { className: "thinking-ring" }),
            h('div', { className: "speaking-ring" }), // New speaking ring 1
            h('div', { className: "speaking-ring delay-ring" }), // New speaking ring 2
            glitches.map(g => h('div', { 
                key: g.id,
                className: "glitch-layer",
                style: {
                    top: `${g.top}%`,
                    height: `${g.height}%`,
                    left: `${g.left}px`,
                    width: '100%',
                    backgroundColor: 'rgba(var(--avatar-rgb), 0.5)', // Use CSS variable
                    opacity: 0.5,
                    transform: `translateX(${Math.random() > 0.5 ? 5 : -5}px)`
                }
            })),
            h('div', { className: "ground" })
        )
    );
};

// Separated component to prevent "Rendered more hooks than during the previous render" error
const ApiKeysTab = ({ apiKeys, setApiKeys, t }) => {
    const [localKeys, setLocalKeys] = React.useState(apiKeys);
    const [validationStatus, setValidationStatus] = React.useState({});
    const [isValidating, setIsValidating] = React.useState(false);

    const handleSaveKeys = async () => {
        setIsValidating(true);
        setValidationStatus({});
        // FIX: Added 'any' type to the status object to allow dynamic assignment of properties,
        // which resolves the TypeScript errors about properties not existing on type '{}'.
        const status: any = {};
        
        const wRes = await validateWeatherKey(localKeys.weather);
        status.weather = wRes;
        
        const nRes = await validateNewsKey(localKeys.news);
        status.news = nRes;
        
        const yRes = await validateYouTubeKey(localKeys.youtube);
        status.youtube = yRes;

        const aRes = await validateAuddioKey(localKeys.auddio);
        status.auddio = aRes;

        setValidationStatus(status);
        setApiKeys(localKeys);
        setIsValidating(false);
    };

    return h('div', { className: "space-y-6 animate-fade-in" },
        h('div', { className: "bg-black/20 p-6 rounded-xl border border-gray-800" },
            h('div', { className: "flex items-center gap-3 mb-4" },
                h('div', { className: "p-2 bg-cyan-900/30 rounded-lg" },
                    h(ApiKeysIcon, { className: "w-6 h-6 text-cyan-400" })
                ),
                h('div', null,
                    h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.apiKeysTab.optional.title')),
                    h('p', { className: "text-xs text-gray-500" }, t('settings.apiKeysTab.optional.description'))
                )
            ),
            
            h('div', { className: "space-y-6 mt-6" },
                ['weather', 'news', 'youtube', 'auddio'].map(keyType => 
                    h('div', { key: keyType, className: "bg-black/40 p-4 rounded-lg border border-gray-700/50" },
                        h('div', { className: "flex justify-between items-center mb-2" },
                            h('label', { className: "text-xs uppercase tracking-wider font-semibold text-gray-400" }, t(`settings.apiKeysTab.${keyType}Key`)),
                            validationStatus[keyType] && (
                                h('span', { className: `text-xs flex items-center gap-1 ${validationStatus[keyType].success ? 'text-green-400' : 'text-red-400'}` },
                                    validationStatus[keyType].success ? h(CheckCircleIcon, { className: "w-3 h-3" }) : h(WarningIcon, { className: "w-3 h-3" }),
                                    validationStatus[keyType].success ? 'Valid' : 'Invalid'
                                )
                            )
                        ),
                        h('input', {
                            type: "password",
                            className: "w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder-gray-600",
                            value: localKeys[keyType],
                            onChange: (e) => setLocalKeys({...localKeys, [keyType]: e.target.value}),
                            placeholder: "Enter your API key here..."
                        }),
                        validationStatus[keyType] && !validationStatus[keyType].success && (
                            h('p', { className: "text-xs text-red-400 mt-2 pl-1" }, validationStatus[keyType].message)
                        )
                    )
                )
            ),
            
            h('button', {
                onClick: handleSaveKeys,
                disabled: isValidating,
                className: "mt-8 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-800 disabled:to-gray-800 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
            },
                isValidating ? h(SpinnerIcon, { className: "w-5 h-5" }) : h(CheckCircleIcon, { className: "w-5 h-5" }),
                t('settings.apiKeysTab.save')
            )
        )
    );
};

const SettingsModal = ({ 
    isOpen, onClose, activeTab, setActiveTab, 
    theme, setTheme, gender, setGender, 
    greetingMessage, setGreetingMessage, 
    customInstructions, setCustomInstructions, 
    emotionTuning, setEmotionTuning, 
    apiKeys, setApiKeys, 
    lang, setLang, 
    femaleVoices, setFemaleVoices, 
    maleVoices, setMaleVoices, 
    ambientVolume, setAmbientVolume,
    avatarUrl, setAvatarUrl,
    subscriptionPlan, setSubscriptionPlan,
    dailyUsage,
    user,
    handleLogin,
    handleLogout
}) => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(true);
    const [previewingVoice, setPreviewingVoice] = React.useState(null);

    React.useEffect(() => {
        if (isOpen) setIsMobileMenuOpen(true);
    }, [isOpen]);

    // Cleanup preview on unmount or tab change
    React.useEffect(() => {
        setPreviewingVoice(null);
    }, [activeTab, isOpen]);

    if (!isOpen) return null;

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    const handlePlanSelection = async (planId) => {
        if (planId === 'free') {
            setSubscriptionPlan('free');
            return;
        }

        const prices = {
            monthly: 100,
            quarterly: 200,
            halfYearly: 350,
            yearly: 500
        };

        const amount = prices[planId];
        if (!amount) return;

        try {
            // Use existing auth info if available, else placeholders
            const customerId = user ? user.uid : `guest_${Date.now()}`;
            const customerPhone = "9999999999"; 
            const customerEmail = user ? user.email : "guest@example.com";

            const paymentSessionId = await createCashfreeOrder(planId, amount, customerId, customerPhone, customerEmail);
            
            const cashfree = new window['Cashfree']({ mode: "production" });
            cashfree.checkout({
                paymentSessionId: paymentSessionId,
                redirectTarget: "_self",
                returnUrl: window.location.href
            });
        } catch (error) {
            console.error("Payment Error", error);
            alert("Payment initiation failed: " + error.message);
        }
    };

    const playVoicePreview = async (voiceName) => {
        if (previewingVoice) return;
        setPreviewingVoice(voiceName);
        try {
            const text = t('settings.voiceTab.testVoiceSample') || `This is a preview of the voice ${voiceName}.`;
            const stream = await generateSpeech(text, voiceName);
            
            const audioCtx = new (window.AudioContext || window['webkitAudioContext'])();
            let nextTime = audioCtx.currentTime;
            
            for await (const chunk of stream) {
                const base64 = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (base64) {
                     const bytes = decode(base64);
                     const buffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
                     const source = audioCtx.createBufferSource();
                     source.buffer = buffer;
                     source.connect(audioCtx.destination);
                     source.start(nextTime);
                     nextTime += buffer.duration;
                }
            }
            
            // Allow replay after a short delay
            setTimeout(() => setPreviewingVoice(null), 2000);
        } catch (e) {
            console.error("Preview failed", e);
            setPreviewingVoice(null);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'account':
                return h('div', { className: "space-y-6 animate-fade-in" },
                     h('div', { className: "bg-black/20 p-6 rounded-xl border border-gray-800 flex flex-col items-center justify-center text-center min-h-[300px]" },
                        user ? h(React.Fragment, null,
                            h('div', { className: "w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-lg" },
                                user.photoURL ? h('img', { src: user.photoURL, alt: "User", className: "w-full h-full rounded-full" }) : user.email ? user.email[0].toUpperCase() : 'U'
                            ),
                            h('h3', { className: "text-xl font-bold text-white mb-1" }, user.displayName || "User"),
                            h('p', { className: "text-gray-400 text-sm mb-6" }, user.email),
                            h('div', { className: "flex gap-3" },
                                h('button', {
                                    onClick: handleLogout,
                                    className: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-6 py-2 rounded-lg font-medium transition-colors"
                                }, "Sign Out")
                            )
                        ) : h(React.Fragment, null,
                            h('div', { className: "p-4 bg-cyan-900/20 rounded-full mb-4" },
                                h(UserIcon, { className: "w-8 h-8 text-cyan-400" })
                            ),
                            h('h3', { className: "text-xl font-bold text-white mb-2" }, "Sign In to Kaniska"),
                            h('p', { className: "text-gray-400 text-sm mb-8 max-w-xs" }, "Sync your settings, manage your subscription, and access your profile across devices."),
                            h('button', {
                                onClick: handleLogin,
                                className: "bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-lg font-bold flex items-center gap-3 transition-colors shadow-lg"
                            },
                                h('img', { src: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg", alt: "Google", className: "w-5 h-5" }),
                                "Sign in with Google"
                            )
                        )
                     )
                );
            case 'persona':
                return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                        h('h3', { className: "font-semibold text-lg mb-1 text-cyan-400" }, t('settings.personaTab.avatar.title') || "Avatar Customization"),
                        h('p', { className: "text-xs text-gray-500 mb-4" }, t('settings.personaTab.avatar.description') || "Enter a URL for your custom avatar."),
                        h('div', { className: "flex items-center gap-4" },
                            h('div', { className: "w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-500/50 shrink-0 relative" },
                                avatarUrl ? h('img', { src: avatarUrl, alt: "Avatar Preview", className: "w-full h-full object-cover" }) : h('div', { className: "w-full h-full bg-gray-800 flex items-center justify-center text-xs" }, "No Img")
                            ),
                            h('div', { className: "flex-1" },
                                h('input', {
                                    type: "text",
                                    className: "w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none mb-1",
                                    value: avatarUrl,
                                    onChange: (e) => setAvatarUrl(e.target.value),
                                    placeholder: "https://example.com/avatar.png"
                                }),
                                h('p', { className: "text-[10px] text-gray-500" }, "Supported: PNG, JPG, GIF URLs.")
                            )
                        )
                    ),
                    h('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
                        h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                            h('h3', { className: "font-semibold text-lg mb-1 text-cyan-400" }, t('settings.personaTab.appearance.title')),
                            h('p', { className: "text-xs text-gray-500 mb-4" }, t('settings.personaTab.appearance.description')),
                            h('div', { className: "flex bg-black/40 rounded-lg p-1 border border-gray-700" },
                                ['light', 'dark'].map((mode) => 
                                    h('button', {
                                        key: mode,
                                        onClick: () => setTheme(mode),
                                        className: `flex-1 py-2 rounded-md text-sm font-medium transition-all ${theme === mode ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`
                                    }, t(`settings.personaTab.appearance.${mode}`))
                                )
                            )
                        ),
                        h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                            h('h3', { className: "font-semibold text-lg mb-1 text-cyan-400" }, t('settings.personaTab.gender.title')),
                            h('p', { className: "text-xs text-gray-500 mb-4" }, t('settings.personaTab.gender.description')),
                            h('div', { className: "flex bg-black/40 rounded-lg p-1 border border-gray-700" },
                                ['female', 'male'].map((g) => 
                                    h('button', {
                                        key: g,
                                        onClick: () => setGender(g),
                                        className: `flex-1 py-2 rounded-md text-sm font-medium transition-all ${gender === g ? 'bg-pink-600/80 text-white shadow' : 'text-gray-400 hover:text-white'}`
                                    }, t(`settings.personaTab.gender.${g}`))
                                )
                            )
                        )
                    ),
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                        h('div', { className: "mb-3" },
                            h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.personaTab.greeting.title')),
                            h('p', { className: "text-xs text-gray-500" }, t('settings.personaTab.greeting.description'))
                        ),
                        h('textarea', {
                            className: "w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none text-sm",
                            rows: 2,
                            value: greetingMessage,
                            onChange: (e) => setGreetingMessage(e.target.value)
                        })
                    ),
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                        h('div', { className: "mb-3" },
                            h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.personaTab.systemPrompt.title') || "Custom Instructions"),
                            h('p', { className: "text-xs text-gray-500" }, t('settings.personaTab.systemPrompt.description'))
                        ),
                        h('textarea', {
                            className: "w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none text-sm font-mono leading-relaxed",
                            rows: 4,
                            value: customInstructions,
                            onChange: (e) => setCustomInstructions(e.target.value)
                        })
                    ),
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800 opacity-80 relative overflow-hidden" },
                        h('div', { className: "absolute top-0 right-0 p-2" },
                            h('span', { className: "text-[10px] font-bold uppercase tracking-widest text-gray-600 border border-gray-700 px-2 py-1 rounded bg-black/50" }, "Read Only")
                        ),
                        h('div', { className: "mb-3" },
                            h('h3', { className: "font-semibold text-lg text-gray-400" }, t('settings.personaTab.coreIdentity.title') || "Core Identity & Protocols"),
                            h('p', { className: "text-xs text-gray-500" }, t('settings.personaTab.coreIdentity.description') || "These are fixed operational rules and identity definitions set by the creator.")
                        ),
                        h('textarea', {
                            className: "w-full bg-black/20 border border-gray-800 rounded-lg px-4 py-3 text-gray-500 outline-none resize-none text-xs font-mono cursor-not-allowed",
                            rows: 6,
                            value: FIXED_SYSTEM_INSTRUCTIONS,
                            disabled: true
                        })
                    ),
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                        h('div', { className: "flex justify-between items-center mb-4" },
                            h('div', null,
                                h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.personaTab.ambient.title')),
                                h('p', { className: "text-xs text-gray-500" }, t('settings.personaTab.ambient.description'))
                            ),
                            h('span', { className: "text-sm font-mono bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded border border-cyan-900/50" }, `${Math.round(ambientVolume * 100)}%`)
                        ),
                        h('input', {
                            type: "range",
                            min: "0",
                            max: "1",
                            step: "0.01",
                            value: ambientVolume,
                            onChange: (e) => setAmbientVolume(parseFloat(e.target.value)),
                            className: "w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        })
                    ),
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                        h('div', { className: "mb-6" },
                            h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.personaTab.tuning.title')),
                            h('p', { className: "text-xs text-gray-500" }, t('settings.personaTab.tuning.description'))
                        ),
                        h('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6" },
                            Object.entries(emotionTuning).map(([trait, value]) => 
                                h('div', { key: trait, className: "relative" },
                                    h('div', { className: "flex justify-between mb-2" },
                                        h('label', { className: "text-sm font-medium capitalize text-gray-300" }, t(`settings.personaTab.tuning.${trait}`) || trait),
                                        h('span', { className: "text-xs text-gray-500" }, `${value}%`)
                                    ),
                                    h('input', {
                                        type: "range",
                                        min: "0",
                                        max: "100",
                                        value: value,
                                        onChange: (e) => setEmotionTuning({ ...emotionTuning, [trait]: parseInt(e.target.value) }),
                                        className: "w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    })
                                )
                            )
                        )
                    )
                );
            case 'voice':
                 const currentVoices = gender === 'female' ? femaleVoices : maleVoices;
                 const setVoices = gender === 'female' ? setFemaleVoices : setMaleVoices;
                 
                 const categories = {
                    "Female Persona": ['Kore', 'Aoede', 'Zephyr'],
                    "Male Persona": ['Fenrir', 'Charon', 'Puck']
                 };

                return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "bg-black/20 p-6 rounded-xl border border-gray-800" },
                        h('div', { className: "mb-6" },
                            h('h3', { className: "font-semibold text-lg text-cyan-400" }, gender === 'female' ? t('settings.voiceTab.female.title') : t('settings.voiceTab.male.title')),
                            h('p', { className: "text-xs text-gray-500" }, t('settings.voiceTab.description'))
                        ),
                        h('div', { className: "space-y-8" },
                            // Main Voice Section
                            h('div', null,
                                h('h4', { className: "text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider border-b border-gray-700 pb-2" }, t('settings.voiceTab.mainVoiceLabel')),
                                Object.entries(categories).map(([category, voices]) => 
                                    h('div', { key: category, className: "mb-4" },
                                        h('h5', { className: "text-xs text-gray-500 mb-2 font-medium" }, category),
                                        h('div', { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" },
                                            voices.map(v => 
                                                h('div', { 
                                                    key: v, 
                                                    onClick: () => setVoices({...currentVoices, main: v}),
                                                    className: `p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${currentVoices.main === v ? 'bg-cyan-900/20 border-cyan-500 shadow-md' : 'bg-black/40 border-gray-700 hover:border-gray-500'}`
                                                },
                                                    h('div', { className: "flex items-center gap-3" },
                                                        h('div', { className: `w-8 h-8 rounded-full flex items-center justify-center transition-colors ${currentVoices.main === v ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400'}` },
                                                            h(VoiceIcon, { className: "w-4 h-4" })
                                                        ),
                                                        h('span', { className: `font-medium text-sm ${currentVoices.main === v ? 'text-cyan-400' : 'text-gray-300'}` }, v)
                                                    ),
                                                    h('button', {
                                                        onClick: (e) => { e.stopPropagation(); playVoicePreview(v); },
                                                        disabled: previewingVoice === v,
                                                        className: "p-2 rounded-full hover:bg-white/10 text-cyan-400 transition-colors"
                                                    },
                                                        previewingVoice === v ? h(SpinnerIcon, { className: "w-4 h-4 animate-spin" }) : h(PlayIcon, { className: "w-4 h-4" })
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            
                            // Greeting Voice Section
                            h('div', null,
                                h('h4', { className: "text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider border-b border-gray-700 pb-2" }, t('settings.voiceTab.greetingVoiceLabel')),
                                Object.entries(categories).map(([category, voices]) => 
                                    h('div', { key: category, className: "mb-4" },
                                        h('h5', { className: "text-xs text-gray-500 mb-2 font-medium" }, category),
                                        h('div', { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" },
                                            voices.map(v => 
                                                h('div', { 
                                                    key: v, 
                                                    onClick: () => setVoices({...currentVoices, greeting: v}),
                                                    className: `p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${currentVoices.greeting === v ? 'bg-cyan-900/20 border-cyan-500 shadow-md' : 'bg-black/40 border-gray-700 hover:border-gray-500'}`
                                                },
                                                    h('div', { className: "flex items-center gap-3" },
                                                        h('div', { className: `w-8 h-8 rounded-full flex items-center justify-center transition-colors ${currentVoices.greeting === v ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400'}` },
                                                            h(VoiceIcon, { className: "w-4 h-4" })
                                                        ),
                                                        h('span', { className: `font-medium text-sm ${currentVoices.greeting === v ? 'text-cyan-400' : 'text-gray-300'}` }, v)
                                                    ),
                                                    h('button', {
                                                        onClick: (e) => { e.stopPropagation(); playVoicePreview(v); },
                                                        disabled: previewingVoice === v,
                                                        className: "p-2 rounded-full hover:bg-white/10 text-cyan-400 transition-colors"
                                                    },
                                                        previewingVoice === v ? h(SpinnerIcon, { className: "w-4 h-4 animate-spin" }) : h(PlayIcon, { className: "w-4 h-4" })
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
             case 'apiKeys':
                 return h(ApiKeysTab, { apiKeys, setApiKeys, t });
            case 'help':
                 return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "bg-black/20 p-6 rounded-xl border border-gray-800" },
                        h('h3', { className: "font-semibold text-lg mb-6 text-cyan-400" }, t('settings.helpTab.faqTitle')),
                        h('div', { className: "space-y-4" },
                            h('div', { className: "border border-gray-700/50 rounded-lg overflow-hidden" },
                                h('details', { className: "group bg-black/40" },
                                    h('summary', { className: "cursor-pointer p-4 text-sm font-medium text-white flex items-center justify-between hover:bg-white/5 transition-colors" },
                                        h('span', { className: "flex items-center gap-3" }, h(HelpIcon, { className: "w-4 h-4 text-cyan-400" }), t('settings.helpTab.q1')),
                                        h('span', { className: "text-gray-500 group-open:rotate-180 transition-transform" }, "▼")
                                    ),
                                    h('div', { className: "px-4 pb-4 pt-0 text-sm text-gray-400 leading-relaxed border-t border-gray-700/50 mt-2" },
                                        h('p', { className: "pt-2" }, t('settings.helpTab.a1'))
                                    )
                                )
                            ),
                            h('div', { className: "border border-gray-700/50 rounded-lg overflow-hidden" },
                                h('details', { className: "group bg-black/40", open: true },
                                    h('summary', { className: "cursor-pointer p-4 text-sm font-medium text-white flex items-center justify-between hover:bg-white/5 transition-colors" },
                                        h('span', { className: "flex items-center gap-3" }, h(ApiKeysIcon, { className: "w-4 h-4 text-cyan-400" }), t('settings.helpTab.q2')),
                                        h('span', { className: "text-gray-500 group-open:rotate-180 transition-transform" }, "▼")
                                    ),
                                    h('div', { className: "px-4 pb-4 pt-0 text-sm text-gray-400 space-y-6 border-t border-gray-700/50 mt-2" },
                                        h('div', { className: "pt-2" },
                                            h('strong', { className: "text-cyan-200 block mb-2 text-xs uppercase tracking-wider" }, t('settings.helpTab.a2.weatherTitle')),
                                            h('div', { className: "whitespace-pre-line pl-3 border-l-2 border-gray-700" }, t('settings.helpTab.a2.weatherSteps').replace(/<1>/g, '').replace(/<\/1>/g, ''))
                                        ),
                                        h('div', null,
                                            h('strong', { className: "text-cyan-200 block mb-2 text-xs uppercase tracking-wider" }, t('settings.helpTab.a2.youtubeTitle')),
                                            h('div', { className: "whitespace-pre-line pl-3 border-l-2 border-gray-700" }, t('settings.helpTab.a2.youtubeSteps').replace(/<1>/g, '').replace(/<\/1>/g, ''))
                                        ),
                                        h('div', null,
                                            h('strong', { className: "text-cyan-200 block mb-2 text-xs uppercase tracking-wider" }, t('settings.helpTab.a2.inputTitle')),
                                            h('div', { className: "whitespace-pre-line pl-3 border-l-2 border-gray-700" }, t('settings.helpTab.a2.inputSteps'))
                                        )
                                    )
                                )
                            )
                        )
                    )
                );
             case 'about':
                return h('div', { className: "flex flex-col items-center justify-center h-full animate-fade-in py-10" },
                    h('div', { className: "bg-black/20 p-8 rounded-2xl border border-gray-800 max-w-md w-full text-center relative overflow-hidden" },
                        h('div', { className: "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500" }),
                        h('div', { className: "w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full mx-auto mb-6 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]" },
                            h('span', { className: "text-4xl filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" }, "🤖")
                        ),
                        h('h2', { className: "text-2xl font-bold mb-2 text-white tracking-tight" }, t('appName')),
                        h('p', { className: "text-gray-400 text-sm mb-8 leading-relaxed" }, t('settings.aboutTab.description')),
                        h('div', { className: "text-xs text-gray-600 border-t border-gray-800 pt-6" },
                            h('p', { className: "font-mono mb-4 opacity-70" }, `${t('settings.aboutTab.version')}: 1.0.0 (Beta)`),
                            h('div', { className: "flex justify-center gap-6" },
                                h('a', { href: "#", className: "text-gray-500 hover:text-cyan-400 transition-colors" }, t('settings.aboutTab.privacyPolicy')),
                                h('a', {
                                    href: "https://github.com/abhi-trainer/kaniska/issues/new?assignees=&labels=bug&template=bug_report.md&title=[BUG]",
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    className: "text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                                }, h(BugIcon, { className: "w-3 h-3" }), t('settings.aboutTab.reportBug'))
                            )
                        )
                    )
                );
            case 'subscription':
                 return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "text-center mb-8" },
                        h('h3', { className: "text-2xl font-bold text-white mb-2" }, t('settings.subscriptionTab.title')),
                        h('p', { className: "text-gray-400" }, t('settings.subscriptionTab.description'))
                    ),

                    subscriptionPlan === 'free' && dailyUsage && h('div', { className: "mb-6 bg-gray-800/50 p-4 rounded-lg border border-gray-700 max-w-lg mx-auto" },
                        h('div', { className: "flex justify-between text-sm mb-2" },
                            h('span', { className: "text-gray-300" }, t('settings.subscriptionTab.usage')),
                            h('span', { className: `font-mono ${dailyUsage.seconds >= 3600 ? 'text-red-400' : 'text-cyan-400'}` },
                                `${Math.floor(dailyUsage.seconds / 60)} / 60 min`
                            )
                        ),
                        h('div', { className: "w-full h-2 bg-gray-700 rounded-full overflow-hidden" },
                            h('div', {
                                className: `h-full transition-all duration-500 ${dailyUsage.seconds >= 3600 ? 'bg-red-500' : 'bg-cyan-500'}`,
                                style: { width: `${Math.min((dailyUsage.seconds / 3600) * 100, 100)}%` }
                            })
                        )
                    ),

                    h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                        ['free', 'monthly', 'quarterly', 'halfYearly', 'yearly'].map((planId) => 
                            h('button', {
                                key: planId,
                                onClick: () => handlePlanSelection(planId),
                                className: `relative p-6 rounded-xl border transition-all text-left group ${
                                    subscriptionPlan === planId 
                                    ? 'bg-cyan-900/20 border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.15)]' 
                                    : 'bg-black/40 border-gray-800 hover:border-gray-600 hover:bg-black/60'
                                }`
                            },
                                h('div', { className: "flex justify-between items-start mb-2" },
                                    h('h4', { className: `text-lg font-semibold transition-colors ${subscriptionPlan === planId ? 'text-cyan-400' : 'text-gray-300'}` }, t(`settings.subscriptionTab.plans.${planId}.name`)),
                                    subscriptionPlan === planId && h('span', { className: "text-[10px] font-bold uppercase px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/40" }, t('settings.subscriptionTab.active'))
                                ),
                                h('div', { className: "flex items-baseline gap-1" },
                                    h('span', { className: "text-2xl font-bold text-white" }, t(`settings.subscriptionTab.plans.${planId}.price`)),
                                    h('span', { className: "text-xs text-gray-500" }, t(`settings.subscriptionTab.plans.${planId}.duration`))
                                ),
                                planId === 'yearly' && h('div', { className: "absolute top-0 right-0 bg-gradient-to-l from-yellow-600 to-transparent text-[10px] font-bold px-2 py-1 text-white rounded-bl-lg" }, "BEST VALUE"),
                                subscriptionPlan !== planId && h('div', { className: "mt-4 pt-4 border-t border-gray-700/50 text-xs text-center text-cyan-500 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity" }, t('settings.subscriptionTab.upgrade'))
                            )
                        )
                    ),

                    h('div', { className: "bg-black/20 p-6 rounded-xl border border-gray-800 mt-2" },
                        h('h4', { className: "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2" }, t('settings.subscriptionTab.featuresTitle')),
                        h('div', { className: "space-y-3" },
                            h('div', { className: "flex items-center gap-3 text-sm text-gray-300" },
                                h(CheckCircleIcon, { className: "w-5 h-5 text-gray-400 shrink-0" }),
                                h('span', null, t('settings.subscriptionTab.featureFree'))
                            ),
                            h('div', { className: "flex items-center gap-3 text-sm text-gray-300" },
                                h(CheckCircleIcon, { className: "w-5 h-5 text-green-400 shrink-0" }),
                                h('span', null, t('settings.subscriptionTab.feature1'))
                            ),
                            h('div', { className: "flex items-center gap-3 text-sm text-gray-300" },
                                h(CheckCircleIcon, { className: "w-5 h-5 text-green-400 shrink-0" }),
                                h('span', null, t('settings.subscriptionTab.feature2'))
                            ),
                            h('div', { className: "flex items-center gap-3 text-sm text-gray-300" },
                                h(CheckCircleIcon, { className: "w-5 h-5 text-green-400 shrink-0" }),
                                h('span', null, t('settings.subscriptionTab.feature3'))
                            )
                        )
                    )
                );
            default:
                return null;
        }
    };

    return h('div', { 
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity", 
        onClick: onClose 
    },
        h('div', {
            className: "bg-black md:bg-panel-bg w-full h-full md:w-[90vw] md:h-[85vh] md:max-w-5xl md:rounded-2xl shadow-2xl border border-border-color overflow-hidden flex flex-col md:flex-row relative animate-panel-enter",
            onClick: e => e.stopPropagation()
        },
            h('div', { className: `${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 bg-black md:bg-black/20 md:border-r border-border-color h-full absolute md:relative z-20` },
                h('div', { className: "p-6 border-b border-border-color flex justify-between items-center" },
                    h('h2', { className: "text-xl font-bold flex items-center gap-3 text-cyan-400" },
                        h(SettingsIcon, { className: "w-6 h-6" }),
                        t('settings.title')
                    ),
                    h('button', { onClick: onClose, className: "md:hidden p-2 text-gray-400 hover:text-white" },
                        h(XIcon, { className: "w-6 h-6" })
                    )
                ),
                h('div', { className: "flex-1 overflow-y-auto p-4 space-y-1" },
                    [
                        { id: 'account', icon: UserIcon, label: "Account" },
                        { id: 'persona', icon: PersonaIcon, label: t('settings.tabs.persona') },
                        { id: 'voice', icon: VoiceIcon, label: t('settings.tabs.voice') },
                        { id: 'apiKeys', icon: ApiKeysIcon, label: t('settings.tabs.apiKeys') },
                        { id: 'subscription', icon: null, label: t('settings.tabs.subscription') },
                        { id: 'help', icon: HelpIcon, label: t('settings.tabs.help') },
                        { id: 'about', icon: AboutIcon, label: t('settings.tabs.about') },
                    ].map(tab => 
                        h('button', {
                            key: tab.id,
                            onClick: () => handleTabChange(tab.id),
                            className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                activeTab === tab.id 
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' 
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                            }`
                        },
                            tab.icon ? h(tab.icon, { className: "w-5 h-5" }) : h('span', { className: "w-5 h-5 flex items-center justify-center font-bold" }, "$"),
                            h('span', null, tab.label),
                            h('span', { className: "ml-auto md:hidden text-gray-600" },
                                h('svg', { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M9 18l6-6-6-6" }))
                            )
                        )
                    )
                ),
                h('div', { className: "p-4 border-t border-border-color bg-gray-900" },
                    h('label', { className: "text-xs text-gray-500 uppercase font-semibold mb-2 block px-1" }, "Language"),
                    h('div', { className: "flex gap-2" },
                        availableLanguages.map(l => 
                            h('button', {
                                key: l.code,
                                onClick: () => setLang(l.code),
                                className: `flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                                    lang === l.code ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'border-border-color text-gray-500 hover:border-gray-600'
                                }`
                            }, l.name)
                        )
                    )
                )
            ),
            h('div', { className: `${!isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full overflow-hidden bg-black md:bg-panel-bg relative` },
                h('div', { className: "md:hidden flex items-center justify-between p-4 border-b border-border-color" },
                    h('button', { onClick: () => setIsMobileMenuOpen(true), className: "flex items-center gap-2 text-gray-400 hover:text-white" },
                        h(ArrowLeftIcon, { className: "w-5 h-5" }),
                        h('span', { className: "text-sm font-medium" }, "Back")
                    ),
                    h('h3', { className: "font-semibold text-white capitalize" }, activeTab === 'account' ? 'Account' : t(`settings.tabs.${activeTab}`)),
                    h('button', { onClick: onClose, className: "p-2 text-gray-400" },
                        h(XIcon, { className: "w-5 h-5" })
                    )
                ),
                h('button', { onClick: onClose, className: "hidden md:block absolute top-4 right-4 p-2 text-gray-500 hover:text-white z-10 rounded-full hover:bg-white/5 transition-colors" },
                    h(XIcon, { className: "w-6 h-6" })
                ),
                h('div', { className: "flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8" },
                    h('div', { className: "max-w-3xl mx-auto" },
                        h('div', { className: "hidden md:block mb-8 pb-4 border-b border-border-color" },
                            h('h2', { className: "text-2xl font-bold text-white" }, activeTab === 'account' ? 'Account' : t(`settings.tabs.${activeTab}`))
                        ),
                        renderTabContent()
                    )
                )
            )
        )
    );
};
