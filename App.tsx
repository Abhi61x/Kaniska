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

// --- Icons ---
const SettingsIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "3" }), React.createElement('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
const ConnectIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" }), React.createElement('path', { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" }));
const DisconnectIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "m18.07 11.93-1.34.54" }), React.createElement('path', { d: "m14.2 16.8-1.34.54" }), React.createElement('path', { d: "m11.93 6-1.34-.54" }), React.createElement('path', { d: "m7.2 10.2-1.34-.54" }), React.createElement('path', { d: "m16.8 9.8.54-1.34" }), React.createElement('path', { d: "m10.2 16.8.54-1.34" }), React.createElement('path', { d: "m6 11.93-.54-1.34" }), React.createElement('path', { d: "m9.8 7.2-.54-1.34" }), React.createElement('path', { d: "M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.13-6.84-9.48" }));
const PersonaIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "8", r: "5" }), React.createElement('path', { d: "M20 21a8 8 0 0 0-16 0" }));
const VoiceIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), React.createElement('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), React.createElement('line', { x1: "12", y1: "19", x2: "12", y2: "22" }));
const ApiKeysIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19.9 5a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4z" }), React.createElement('path', { d: "m4 6 2-2" }), React.createElement('path', { d: "m10.5 10.5 5 5" }), React.createElement('path', { d: "m8.5 8.5 2 2" }), React.createElement('path', { d: "m14.5 14.5 2 2" }), React.createElement('path', { d: "M7 21a4 4 0 0 0 4-4" }), React.createElement('path', { d: "M12 12v4a4 4 0 0 0 4 4h4" }));
const AboutIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('line', { x1: "12", y1: "16", x2: "12", y2: "12" }), React.createElement('line', { x1: "12", y1: "8", x2: "12.01", y2: "8" }));
const HelpIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('path', { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), React.createElement('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const ChatIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
const WeatherIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }));
const YouTubeIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M10 15v-6l5 3-5 3Z" }), React.createElement('path', { d: "M21.54 8.63A2.08 2.08 0 0 0 20.06 7.5a21.46 21.46 0 0 0-8.06-.5 21.46 21.46 0 0 0-8.06.5A2.08 2.08 0 0 0 2.46 8.63 22.24 22.24 0 0 0 2 12c0 3.37.46 5.54 1.94 6.5A2.08 2.08 0 0 0 5.4 19.5a21.46 21.46 0 0 0 8.06.5 21.46 21.46 0 0 0 8.06.5 2.08 2.08 0 0 0 1.48-1.13A22.24 22.24 0 0 0 22 12c0-3.37-.46-5.54-1.94-6.5Z" }));
const TimerIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('polyline', { points: "12 6 12 12 16 14" }));
const CodeIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('polyline', { points: "16 18 22 12 16 6" }), React.createElement('polyline', { points: "8 6 2 12 8 18" }));
const MusicIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M9 18V5l12-2v13" }), React.createElement('circle', { cx: "6", cy: "18", r: "3" }), React.createElement('circle', { cx: "18", cy: "16", r: "3" }));
const PlayIcon = ({className}) => React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "round", className }, React.createElement('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), React.createElement('polyline', { points: "22 4 12 14.01 9 11.01" }));
const XCircleIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('line', { x1: "15", y1: "9", x2: "9", y2: "15" }), React.createElement('line', { x1: "9", y1: "9", x2: "15", y2: "15" }));
const SpinnerIcon = ({ className }) => React.createElement('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), React.createElement('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), React.createElement('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), React.createElement('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), React.createElement('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), React.createElement('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), React.createElement('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), React.createElement('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));
const XIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), React.createElement('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));
const WarningIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), React.createElement('line', { x1: "12", y1: "9", x2: "12", y2: "13" }), React.createElement('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const SendIcon = ({ className }) => React.createElement('svg', { className, xmlns:"http://www.w3.org/2000/svg", width:"24", height:"24", viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" }, React.createElement('line',{ x1:"22", y1:"2", x2:"11", y2:"13" }), React.createElement('polygon', { points:"22 2 15 22 11 13 2 9 22 2" }));
const ArrowLeftIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', { x1: "19", y1: "12", x2: "5", y2: "12" }), React.createElement('polyline', { points: "12 19 5 12 12 5" }));
const BugIcon = ({ className }) => React.createElement('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('rect', { width: "8", height: "14", x: "8", y: "6", rx: "4" }), React.createElement('path', { d: "m19 7-3 3" }), React.createElement('path', { d: "m5 7 3 3" }), React.createElement('path', { d: "m19 19-3-3" }), React.createElement('path', { d: "m5 19 3-3" }), React.createElement('path', { d: "M2 12h4" }), React.createElement('path', { d: "M18 12h4" }));
const MenuIcon = ({ className }) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', { x1: "4", y1: "12", x2: "20", y2: "12" }), React.createElement('line', { x1: "4", y1: "6", x2: "20", y2: "6" }), React.createElement('line', { x1: "4", y1: "18", x2: "20", y2: "18" }));


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

**Crucial Interaction Rule:** When a user asks to use a tool but does not provide all the necessary information (like asking for the weather without a location, or asking for the song title), your primary job is to ask a clarifying question to get the missing details. Do not attempt to use the tool without the required information.

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


// --- Components ---

const Avatar = ({ state, activity }) => {
    let expressionClass = 'expression-idle';
    if (state === 'error') expressionClass = 'expression-error';
    else if (activity === 'singing') expressionClass = 'expression-singing';
    else if (state === 'speaking') expressionClass = 'expression-speaking';
    else if (state === 'listening') expressionClass = 'expression-listening';
    else if (state === 'recognizing') expressionClass = 'expression-recognizing-song';
    else if (state === 'thinking') expressionClass = 'expression-thinking';

    return (
        <div className="hologram-container">
            <div className="waveform-circle"></div>
            <div className="waveform-circle"></div>
            <div className="waveform-circle"></div>
            <img
                src="https://storage.googleapis.com/aai-web-samples/kaniska-avatar.png"
                alt="Kaniska Avatar"
                className={`avatar ${expressionClass}`}
            />
        </div>
    );
};

const SettingsModal = ({ 
    isOpen, onClose, activeTab, setActiveTab, 
    theme, setTheme, gender, setGender, 
    greetingMessage, setGreetingMessage, 
    systemPrompt, setSystemPrompt, 
    emotionTuning, setEmotionTuning, 
    apiKeys, setApiKeys, 
    lang, setLang, 
    femaleVoices, setFemaleVoices, 
    maleVoices, setMaleVoices, 
    ambientVolume, setAmbientVolume 
}) => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(true);

    React.useEffect(() => {
        if (isOpen) setIsMobileMenuOpen(true);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'persona':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Appearance & Gender Group */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="bg-black/20 p-5 rounded-xl border border-gray-800">
                                <h3 className="font-semibold text-lg mb-1 text-cyan-400">{t('settings.personaTab.appearance.title')}</h3>
                                <p className="text-xs text-gray-500 mb-4">{t('settings.personaTab.appearance.description')}</p>
                                <div className="flex bg-black/40 rounded-lg p-1 border border-gray-700">
                                    {['light', 'dark'].map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setTheme(mode)}
                                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${theme === mode ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            {t(`settings.personaTab.appearance.${mode}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div className="bg-black/20 p-5 rounded-xl border border-gray-800">
                                <h3 className="font-semibold text-lg mb-1 text-cyan-400">{t('settings.personaTab.gender.title')}</h3>
                                <p className="text-xs text-gray-500 mb-4">{t('settings.personaTab.gender.description')}</p>
                                <div className="flex bg-black/40 rounded-lg p-1 border border-gray-700">
                                    {['female', 'male'].map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setGender(g)}
                                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${gender === g ? 'bg-pink-600/80 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            {t(`settings.personaTab.gender.${g}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Greeting */}
                        <div className="bg-black/20 p-5 rounded-xl border border-gray-800">
                             <div className="mb-3">
                                <h3 className="font-semibold text-lg text-cyan-400">{t('settings.personaTab.greeting.title')}</h3>
                                <p className="text-xs text-gray-500">{t('settings.personaTab.greeting.description')}</p>
                            </div>
                             <textarea
                                className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none text-sm"
                                rows={2}
                                value={greetingMessage}
                                onChange={(e) => setGreetingMessage(e.target.value)}
                            />
                        </div>
                        
                        {/* Ambient Volume */}
                        <div className="bg-black/20 p-5 rounded-xl border border-gray-800">
                             <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-cyan-400">{t('settings.personaTab.ambient.title')}</h3>
                                    <p className="text-xs text-gray-500">{t('settings.personaTab.ambient.description')}</p>
                                </div>
                                <span className="text-sm font-mono bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded border border-cyan-900/50">{Math.round(ambientVolume * 100)}%</span>
                            </div>
                             <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={ambientVolume}
                                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>

                        {/* Emotional Tuning */}
                        <div className="bg-black/20 p-5 rounded-xl border border-gray-800">
                             <div className="mb-6">
                                <h3 className="font-semibold text-lg text-cyan-400">{t('settings.personaTab.tuning.title')}</h3>
                                <p className="text-xs text-gray-500">{t('settings.personaTab.tuning.description')}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                {Object.entries(emotionTuning).map(([trait, value]) => (
                                    <div key={trait} className="relative">
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-medium capitalize text-gray-300">{t(`settings.personaTab.tuning.${trait}`) || trait}</label>
                                            <span className="text-xs text-gray-500">{value}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={value as number}
                                            onChange={(e) => setEmotionTuning({ ...emotionTuning, [trait]: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'voice':
                 const currentVoices = gender === 'female' ? femaleVoices : maleVoices;
                 const setVoices = gender === 'female' ? setFemaleVoices : setMaleVoices;
                 const voicesList = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];

                return (
                     <div className="space-y-6 animate-fade-in">
                        <div className="bg-black/20 p-6 rounded-xl border border-gray-800">
                             <div className="mb-6">
                                <h3 className="font-semibold text-lg text-cyan-400">{gender === 'female' ? t('settings.voiceTab.female.title') : t('settings.voiceTab.male.title')}</h3>
                                <p className="text-xs text-gray-500">{t('settings.voiceTab.description')}</p>
                            </div>
                             <div className="grid grid-cols-1 gap-8">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">{t('settings.voiceTab.mainVoiceLabel')}</label>
                                    <div className="flex gap-3 flex-wrap">
                                        {voicesList.map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setVoices({...currentVoices, main: v})}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${currentVoices.main === v ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">{t('settings.voiceTab.greetingVoiceLabel')}</label>
                                     <div className="flex gap-3 flex-wrap">
                                        {voicesList.map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setVoices({...currentVoices, greeting: v})}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${currentVoices.greeting === v ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>
                );
             case 'apiKeys':
                 const [localKeys, setLocalKeys] = React.useState(apiKeys);
                 const [validationStatus, setValidationStatus] = React.useState({});
                 const [isValidating, setIsValidating] = React.useState(false);

                 const handleSaveKeys = async () => {
                     setIsValidating(true);
                     setValidationStatus({});
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

                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-black/20 p-6 rounded-xl border border-gray-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-cyan-900/30 rounded-lg">
                                    <ApiKeysIcon className="w-6 h-6 text-cyan-400"/>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-cyan-400">{t('settings.apiKeysTab.optional.title')}</h3>
                                    <p className="text-xs text-gray-500">{t('settings.apiKeysTab.optional.description')}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-6 mt-6">
                                {['weather', 'news', 'youtube', 'auddio'].map(keyType => (
                                     <div key={keyType} className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs uppercase tracking-wider font-semibold text-gray-400">{t(`settings.apiKeysTab.${keyType}Key`)}</label>
                                            {validationStatus[keyType] && (
                                                <span className={`text-xs flex items-center gap-1 ${validationStatus[keyType].success ? 'text-green-400' : 'text-red-400'}`}>
                                                    {validationStatus[keyType].success ? <CheckCircleIcon className="w-3 h-3"/> : <WarningIcon className="w-3 h-3"/>}
                                                    {validationStatus[keyType].success ? 'Valid' : 'Invalid'}
                                                </span>
                                            )}
                                        </div>
                                        <input 
                                            type="password" 
                                            className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder-gray-600"
                                            value={localKeys[keyType]}
                                            onChange={(e) => setLocalKeys({...localKeys, [keyType]: e.target.value})}
                                            placeholder="Enter your API key here..."
                                        />
                                        {validationStatus[keyType] && !validationStatus[keyType].success && (
                                            <p className="text-xs text-red-400 mt-2 pl-1">{validationStatus[keyType].message}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <button 
                                onClick={handleSaveKeys} 
                                disabled={isValidating}
                                className="mt-8 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-800 disabled:to-gray-800 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
                            >
                                {isValidating ? <SpinnerIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                {t('settings.apiKeysTab.save')}
                            </button>
                        </div>
                    </div>
                );
            case 'help':
                 return (
                    <div className="space-y-6 animate-fade-in">
                         <div className="bg-black/20 p-6 rounded-xl border border-gray-800">
                            <h3 className="font-semibold text-lg mb-6 text-cyan-400">{t('settings.helpTab.faqTitle')}</h3>
                             <div className="space-y-4">
                                <div className="border border-gray-700/50 rounded-lg overflow-hidden">
                                    <details className="group bg-black/40">
                                        <summary className="cursor-pointer p-4 text-sm font-medium text-white flex items-center justify-between hover:bg-white/5 transition-colors">
                                            <span className="flex items-center gap-3"><HelpIcon className="w-4 h-4 text-cyan-400"/> {t('settings.helpTab.q1')}</span>
                                            <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <div className="px-4 pb-4 pt-0 text-sm text-gray-400 leading-relaxed border-t border-gray-700/50 mt-2">
                                            <p className="pt-2">{t('settings.helpTab.a1')}</p>
                                        </div>
                                    </details>
                                </div>

                                <div className="border border-gray-700/50 rounded-lg overflow-hidden">
                                    <details className="group bg-black/40" open>
                                        <summary className="cursor-pointer p-4 text-sm font-medium text-white flex items-center justify-between hover:bg-white/5 transition-colors">
                                            <span className="flex items-center gap-3"><ApiKeysIcon className="w-4 h-4 text-cyan-400"/> {t('settings.helpTab.q2')}</span>
                                            <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <div className="px-4 pb-4 pt-0 text-sm text-gray-400 space-y-6 border-t border-gray-700/50 mt-2">
                                            <div className="pt-2">
                                                <strong className="text-cyan-200 block mb-2 text-xs uppercase tracking-wider">{t('settings.helpTab.a2.weatherTitle')}</strong>
                                                <div className="whitespace-pre-line pl-3 border-l-2 border-gray-700">{t('settings.helpTab.a2.weatherSteps').replace(/<1>/g, '').replace(/<\/1>/g, '')}</div>
                                            </div>
                                             <div>
                                                <strong className="text-cyan-200 block mb-2 text-xs uppercase tracking-wider">{t('settings.helpTab.a2.youtubeTitle')}</strong>
                                                <div className="whitespace-pre-line pl-3 border-l-2 border-gray-700">{t('settings.helpTab.a2.youtubeSteps').replace(/<1>/g, '').replace(/<\/1>/g, '')}</div>
                                            </div>
                                             <div>
                                                <strong className="text-cyan-200 block mb-2 text-xs uppercase tracking-wider">{t('settings.helpTab.a2.inputTitle')}</strong>
                                                <div className="whitespace-pre-line pl-3 border-l-2 border-gray-700">{t('settings.helpTab.a2.inputSteps')}</div>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                             </div>
                         </div>
                    </div>
                );
             case 'about':
                return (
                     <div className="flex flex-col items-center justify-center h-full animate-fade-in py-10">
                        <div className="bg-black/20 p-8 rounded-2xl border border-gray-800 max-w-md w-full text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"></div>
                            <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full mx-auto mb-6 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                                <span className="text-4xl filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">🤖</span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-white tracking-tight">{t('appName')}</h2>
                            <p className="text-gray-400 text-sm mb-8 leading-relaxed">{t('settings.aboutTab.description')}</p>
                             <div className="text-xs text-gray-600 border-t border-gray-800 pt-6">
                                <p className="font-mono mb-4 opacity-70">{t('settings.aboutTab.version')}: 1.0.0 (Beta)</p>
                                <div className="flex justify-center gap-6">
                                    <a href="#" className="text-gray-500 hover:text-cyan-400 transition-colors">{t('settings.aboutTab.privacyPolicy')}</a>
                                    <a href="#" className="text-gray-500 hover:text-cyan-400 transition-colors flex items-center gap-1"><BugIcon className="w-3 h-3"/> {t('settings.aboutTab.reportBug')}</a>
                                </div>
                            </div>
                        </div>
                     </div>
                );
            case 'subscription':
                 return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-gradient-to-br from-gray-900 to-black p-1 rounded-2xl border border-cyan-900/50 shadow-2xl">
                            <div className="bg-black/40 rounded-xl p-8 text-center backdrop-blur-sm">
                                <h3 className="text-cyan-400 font-bold tracking-wider uppercase text-sm mb-2">{t('settings.subscriptionTab.currentPlan')}</h3>
                                <h2 className="text-3xl font-bold text-white mb-2">{t('settings.subscriptionTab.planName')}</h2>
                                <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">
                                    {t('settings.subscriptionTab.price')}
                                </div>
                                
                                <div className="space-y-3 text-left max-w-xs mx-auto mb-8">
                                    <p className="text-gray-400 text-sm font-medium border-b border-gray-800 pb-2 mb-4">{t('settings.subscriptionTab.featuresTitle')}</p>
                                    <div className="flex items-start gap-3 text-sm text-gray-300">
                                        <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0"/>
                                        <span>{t('settings.subscriptionTab.feature1')}</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-gray-300">
                                        <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0"/>
                                        <span>{t('settings.subscriptionTab.feature2')}</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-gray-300">
                                        <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0"/>
                                        <span>{t('settings.subscriptionTab.feature3')}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors">
                                        {t('settings.subscriptionTab.subscribeButton')}
                                    </button>
                                    <button className="w-full py-3 bg-transparent border border-gray-700 text-gray-400 font-medium rounded-lg hover:border-gray-500 hover:text-white transition-colors">
                                        {t('settings.subscriptionTab.cancelButton')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                 );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}>
            <div 
                className="bg-panel-bg w-full h-full md:w-[90vw] md:h-[85vh] md:max-w-5xl md:rounded-2xl shadow-2xl border border-border-color overflow-hidden flex flex-col md:flex-row relative animate-panel-enter"
                onClick={e => e.stopPropagation()}
            >
                {/* Sidebar */}
                <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 bg-panel-bg md:bg-black/20 md:border-r border-border-color h-full absolute md:relative z-20`}>
                    {/* Header */}
                    <div className="p-6 border-b border-border-color flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-3 text-cyan-400">
                            <SettingsIcon className="w-6 h-6"/> 
                            {t('settings.title')}
                        </h2>
                        <button onClick={onClose} className="md:hidden p-2 text-gray-400 hover:text-white">
                            <XIcon className="w-6 h-6"/>
                        </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-1">
                        {[
                            { id: 'persona', icon: PersonaIcon, label: t('settings.tabs.persona') },
                            { id: 'voice', icon: VoiceIcon, label: t('settings.tabs.voice') },
                            { id: 'apiKeys', icon: ApiKeysIcon, label: t('settings.tabs.apiKeys') },
                            { id: 'subscription', icon: null, label: t('settings.tabs.subscription') },
                            { id: 'help', icon: HelpIcon, label: t('settings.tabs.help') },
                            { id: 'about', icon: AboutIcon, label: t('settings.tabs.about') },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    activeTab === tab.id 
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' 
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                                }`}
                            >
                                {tab.icon ? <tab.icon className="w-5 h-5" /> : <span className="w-5 h-5 flex items-center justify-center font-bold">$</span>}
                                <span>{tab.label}</span>
                                <span className="ml-auto md:hidden text-gray-600">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                                </span>
                            </button>
                        ))}
                    </div>
                    
                    {/* Footer (Lang) */}
                     <div className="p-4 border-t border-border-color bg-black/10">
                        <label className="text-xs text-gray-500 uppercase font-semibold mb-2 block px-1">Language</label>
                        <div className="flex gap-2">
                            {availableLanguages.map(l => (
                                <button 
                                    key={l.code} 
                                    onClick={() => setLang(l.code)} 
                                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                                        lang === l.code ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'border-border-color text-gray-500 hover:border-gray-600'
                                    }`}
                                >
                                    {l.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className={`${!isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full overflow-hidden bg-panel-bg relative`}>
                     {/* Mobile Header for Content */}
                     <div className="md:hidden flex items-center justify-between p-4 border-b border-border-color">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="flex items-center gap-2 text-gray-400 hover:text-white">
                            <ArrowLeftIcon className="w-5 h-5"/>
                            <span className="text-sm font-medium">Back</span>
                        </button>
                        <h3 className="font-semibold text-white capitalize">{t(`settings.tabs.${activeTab}`)}</h3>
                        <button onClick={onClose} className="p-2 text-gray-400">
                            <XIcon className="w-5 h-5"/>
                        </button>
                     </div>
                     
                     {/* Desktop Close Button */}
                     <button onClick={onClose} className="hidden md:block absolute top-4 right-4 p-2 text-gray-500 hover:text-white z-10 rounded-full hover:bg-white/5 transition-colors">
                        <XIcon className="w-6 h-6"/>
                     </button>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
                        <div className="max-w-3xl mx-auto">
                            <div className="hidden md:block mb-8 pb-4 border-b border-border-color">
                                <h2 className="text-2xl font-bold text-white">{t(`settings.tabs.${activeTab}`)}</h2>
                            </div>
                            {renderTabContent()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---
export const App = () => {
    const { t, lang, setLang } = useTranslation();
    
    // --- State Management ---
    const [assistantState, setAssistantState] = React.useState('idle'); 
    const [activityState, setActivityState] = React.useState('idle'); 
    const [isModelSpeaking, setIsModelSpeaking] = React.useState(false);
    const [chatHistory, setChatHistory] = usePersistentState('kaniska-chatHistory', []);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [settingsTab, setSettingsTab] = React.useState('persona'); // State lifted to App
    const [activePanel, setActivePanel] = React.useState('chat'); // chat, youtube, weather, timer, code
    
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
    }, []); 
    
    const onPlayerStateChange = React.useCallback((event) => {
        if (event.data === (window as any).YT.PlayerState.ENDED) {
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
        if (!(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            if(firstScriptTag && firstScriptTag.parentNode) {
              firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
        }

        (window as any).onYouTubeIframeAPIReady = () => {
            playerRef.current = new (window as any).YT.Player('youtube-player', {
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

    const handleCodeCommand = React.useCallback(async () => {
        if (!codeInstruction.trim() || isCodeLoading) return;
        setIsCodeLoading(true);
        try {
            const { newCode, explanation } = await processCodeCommand(code, codeLanguage, codeInstruction);
            setCode(newCode);
            addMessageToHistory('assistant', explanation);
            setCodeInstruction('');
        } catch (error) {
            const isApiError = error instanceof ApiKeyError || error instanceof MainApiKeyError;
             const keyType = error instanceof ApiKeyError ? error.keyType : undefined;
            addMessageToHistory('assistant', error.message, { isError: true, isApiKeyError: isApiError, keyType });
        } finally {
            setIsCodeLoading(false);
        }
    }, [code, codeLanguage, codeInstruction, isCodeLoading, addMessageToHistory, setCode]);
    
    const handleFunctionCall = React.useCallback(async (fc) => {
        let result = { success: false, detail: "Unknown command" };
        try {
            switch (fc.name) {
                case 'YOUTUBE_SEARCH':
                    const videoDetails = await searchYouTube(apiKeys.youtube, fc.args.youtubeQuery);
                    if (videoDetails) {
                        const playerState = playerRef.current?.getPlayerState();
                        const isPlaying = playerState === 1 || playerState === 3;
                        
                        if (isPlaying || youtubeQueue.length > 0) {
                            setYoutubeQueue(prev => [...prev, videoDetails]);
                            result = { success: true, detail: `I've added "${videoDetails.title}" to the queue.` };
                        } else {
                            setYoutubeVideoDetails(videoDetails);
                            setActivePanel('youtube');
                            if (playerRef.current && playerRef.current.loadVideoById) {
                                playerRef.current.loadVideoById(videoDetails.videoId);
                                playerRef.current.playVideo();
                            }
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
            const keyType = e instanceof ApiKeyError ? e.keyType : undefined;
            const message = e.message || 'An error occurred.';
            addMessageToHistory('assistant', message, { isError: true, isApiKeyError: isApiError, keyType });
        }
        return result;
    }, [addMessageToHistory, apiKeys, gender, femaleVoices, maleVoices, setYoutubeQueue, setYoutubeVideoDetails, setActivePanel, setWeatherData, setTimerData, setRecentYouTubeSearches, setActivityState, setIsModelSpeaking, emotionTuning, youtubeQueue, timerData]);

    const onPlayerError = React.useCallback((event) => {
        console.warn("YouTube Player Error:", event.data);
        addMessageToHistory('system', 'An error occurred with the video player.', { isError: true });
    }, [addMessageToHistory]);

    const connect = React.useCallback(async () => {
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;
        setAssistantState('live');
        setWasConnected(true);

        try {
            if (!process.env.API_KEY) {
                throw new MainApiKeyError("API Key not found in environment.");
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            inputAudioContextRef.current = inputCtx;
            outputAudioContextRef.current = outputCtx;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const config = {
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: gender === 'female' ? femaleVoices.main : maleVoices.main } }
                    },
                    systemInstruction: systemPrompt,
                    tools: [{ googleSearch: {} }, { functionDeclarations: [
                        { name: 'YOUTUBE_SEARCH', description: 'Search and play a video on YouTube.', parameters: { type: Type.OBJECT, properties: { youtubeQuery: { type: Type.STRING } }, required: ['youtubeQuery'] } },
                        { name: 'GET_WEATHER', description: 'Get weather.', parameters: { type: Type.OBJECT, properties: { location: { type: Type.STRING } }, required: ['location'] } },
                        { name: 'GET_NEWS', description: 'Get news.', parameters: { type: Type.OBJECT, properties: { newsQuery: { type: Type.STRING } }, required: ['newsQuery'] } },
                        { name: 'SET_TIMER', description: 'Set timer.', parameters: { type: Type.OBJECT, properties: { timerDurationSeconds: { type: Type.NUMBER } }, required: ['timerDurationSeconds'] } },
                        { name: 'SING_SONG', description: 'Sing a song.', parameters: { type: Type.OBJECT, properties: { songTitle: { type: Type.STRING }, songArtist: { type: Type.STRING } }, required: ['songTitle', 'songArtist'] } },
                        { name: 'OPEN_CODE_EDITOR', description: 'Open code editor.', parameters: { type: Type.OBJECT, properties: {} } },
                        { name: 'RANDOM_FACT', description: 'Random fact.', parameters: { type: Type.OBJECT, properties: {} } }
                    ]}],
                }
            };

            const session = await ai.live.connect({
                ...config,
                callbacks: {
                    onopen: () => {
                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;
                        
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                            const base64Data = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
                            
                            sessionRef.current.sendRealtimeInput({
                                media: {
                                    mimeType: 'audio/pcm;rate=16000',
                                    data: base64Data
                                }
                            });
                        };
                        
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (msg) => {
                         if (msg.toolCall) {
                             for (const fc of msg.toolCall.functionCalls) {
                                 const result = await handleFunctionCall(fc);
                                 sessionRef.current.sendToolResponse({
                                     functionResponses: [{
                                         id: fc.id,
                                         name: fc.name,
                                         response: { result }
                                     }]
                                 });
                             }
                         }
                         if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                             const audioData = msg.serverContent.modelTurn.parts[0].inlineData.data;
                             const audioCtx = outputAudioContextRef.current;
                             const queue = audioQueueRef.current;
                             
                             queue.nextStartTime = Math.max(queue.nextStartTime, audioCtx.currentTime);
                             const bytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
                             const buffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
                             
                             const source = audioCtx.createBufferSource();
                             source.buffer = buffer;
                             source.connect(audioCtx.destination);
                             source.addEventListener('ended', () => {
                                 queue.sources.delete(source);
                                 if(queue.sources.size === 0) setIsModelSpeaking(false);
                             });
                             setIsModelSpeaking(true);
                             source.start(queue.nextStartTime);
                             queue.nextStartTime += buffer.duration;
                             queue.sources.add(source);
                         }
                         if (msg.serverContent?.interrupted) {
                            audioQueueRef.current.sources.forEach(s => s.stop());
                            audioQueueRef.current.sources.clear();
                            audioQueueRef.current.nextStartTime = 0;
                            setIsModelSpeaking(false);
                         }
                    },
                    onclose: () => setAssistantState('idle'),
                    onerror: (err) => {
                        console.error(err);
                        setAssistantState('error');
                    }
                }
            });
            sessionRef.current = session;

        } catch (error) {
            console.error(error);
            setAssistantState('error');
            addMessageToHistory('system', "Connection failed: " + error.message, { isError: true });
        } finally {
            isConnectingRef.current = false;
        }
    }, [gender, femaleVoices, maleVoices, systemPrompt, handleFunctionCall, addMessageToHistory, setWasConnected, apiKeys]);

    const disconnect = React.useCallback(() => {
        try { sessionRef.current?.close(); } catch(e) {}
        sessionRef.current = null;
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        inputAudioContextRef.current?.close();
        inputAudioContextRef.current = null;
        outputAudioContextRef.current?.close();
        outputAudioContextRef.current = null;
        setAssistantState('idle');
        setWasConnected(false);
        setIsModelSpeaking(false);
    }, [setWasConnected]);
    
    // Helper for the setup instruction click
    const handleSetupClick = () => {
        setSettingsTab('help');
        setIsSettingsOpen(true);
    };

    return (
        <div className="relative flex flex-col h-screen w-screen overflow-hidden font-sans text-white selection:bg-cyan-500/30 selection:text-cyan-100" style={{ backgroundColor: 'transparent' }}>
            {/* Header */}
            <header className="flex-shrink-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent z-20">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-wider text-cyan-400 glowing-text header-logo">KANISKA</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors relative group">
                        <SettingsIcon className="w-6 h-6 text-cyan-100" />
                    </button>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-grow flex flex-col items-center justify-center relative p-4 z-10">
                {/* Avatar - Centered Background Element */}
                 <div className={`transition-all duration-700 ease-in-out transform ${activePanel !== 'chat' && activePanel !== 'idle' ? 'scale-75 opacity-60 blur-sm translate-y-[-10%]' : 'scale-100 opacity-100'}`}>
                    <Avatar state={isModelSpeaking ? 'speaking' : assistantState} activity={activityState} />
                </div>

                {/* Chat Panel - Overlay */}
                {activePanel === 'chat' && (
                     <div className="absolute bottom-24 left-0 right-0 mx-auto w-full max-w-3xl h-[40vh] flex flex-col justify-end pointer-events-none px-4">
                        <div className="chat-container overflow-y-auto space-y-3 pointer-events-auto px-2 pb-2 mask-image-gradient scrollbar-hide">
                            {chatHistory.length === 0 && (
                                <div className="text-center text-gray-400 text-sm opacity-0 animate-fade-in pb-4">
                                    {t('chat.placeholder.title')}
                                </div>
                            )}
                            {chatHistory.map(msg => (
                                <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} chat-bubble-animation`}>
                                    <div className={`max-w-[80%] px-5 py-3 rounded-2xl backdrop-blur-md border ${
                                        msg.sender === 'user' 
                                            ? 'bg-cyan-900/50 border-cyan-500/30 text-cyan-50 rounded-tr-none' 
                                            : msg.isError 
                                                ? 'error-bubble rounded-tl-none'
                                                : 'bg-assistant-bubble-bg border-border-color text-text-color rounded-tl-none shadow-lg'
                                    }`}>
                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                        
                                        {msg.isApiKeyError && msg.keyType && (
                                            <button 
                                                onClick={handleSetupClick}
                                                className="mt-2 text-xs font-bold uppercase tracking-wide underline decoration-dotted hover:text-white transition-colors flex items-center gap-1"
                                            >
                                                <HelpIcon className="w-3 h-3"/> {t('chat.setupInstructions') || 'View Setup Instructions'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                             <div id="chat-end" />
                        </div>
                    </div>
                )}
                
                {/* YouTube Panel */}
                {activePanel === 'youtube' && (
                     <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-md animate-panel-enter p-6">
                         <div className="w-full max-w-4xl bg-panel-bg rounded-xl overflow-hidden border border-border-color shadow-2xl flex flex-col h-[80vh]">
                             <div className="flex items-center justify-between p-4 border-b border-border-color bg-black/20">
                                 <h3 className="text-lg font-bold flex items-center gap-2"><YouTubeIcon className="w-5 h-5 text-red-500"/> {t('youtubePanel.title')}</h3>
                                 <button onClick={() => { setActivePanel('chat'); playerRef.current?.pauseVideo(); }} className="p-2 hover:bg-white/10 rounded-full"><XIcon className="w-5 h-5"/></button>
                             </div>
                             <div className="flex-1 flex flex-col lg:flex-row">
                                 <div className="flex-1 bg-black relative">
                                     <div id="youtube-player" className="absolute inset-0 w-full h-full"/>
                                 </div>
                                 <div className="w-full lg:w-80 border-l border-border-color bg-panel-bg flex flex-col">
                                     <div className="p-4 border-b border-border-color">
                                         <h4 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-2">{t('youtubePanel.upNext')}</h4>
                                         <div className="space-y-2 max-h-60 overflow-y-auto">
                                             {youtubeQueue.length === 0 ? (
                                                 <p className="text-sm text-gray-500 italic">Queue is empty.</p>
                                             ) : (
                                                 youtubeQueue.map((video, i) => (
                                                     <div key={i} className="youtube-queue-item flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                                                         <div className="w-16 h-9 bg-gray-800 rounded overflow-hidden flex-shrink-0 relative">
                                                             <img src={`https://img.youtube.com/vi/${video.videoId}/default.jpg`} alt="" className="w-full h-full object-cover opacity-70"/>
                                                             <div className="absolute inset-0 flex items-center justify-center"><PlayIcon className="w-4 h-4 text-white drop-shadow-md"/></div>
                                                         </div>
                                                         <div className="flex-1 min-w-0">
                                                             <p className="text-sm font-medium truncate">{video.title}</p>
                                                             <p className="text-xs text-gray-500 truncate">{video.channelTitle}</p>
                                                         </div>
                                                     </div>
                                                 ))
                                             )}
                                         </div>
                                     </div>
                                      {youtubeVideoDetails && (
                                         <div className="p-4 flex-1 overflow-y-auto">
                                             <h4 className="font-bold text-lg leading-tight mb-1">{youtubeVideoDetails.title}</h4>
                                             <p className="text-cyan-400 text-sm font-medium mb-4">{youtubeVideoDetails.channelTitle}</p>
                                             {youtubeVideoDetails.viewCount && <p className="text-xs text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> {t('youtubePanel.views', {count: youtubeVideoDetails.viewCount.toLocaleString()})}</p>}
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>
                     </div>
                )}

                {/* Weather Panel */}
                {activePanel === 'weather' && weatherData && (
                     <div className="absolute top-1/4 right-8 z-20 animate-panel-enter">
                         <div className="glass-panel bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-72 shadow-2xl">
                             <div className="flex justify-between items-start mb-4">
                                 <div>
                                     <h2 className="text-2xl font-bold">{weatherData.location.split(',')[0]}</h2>
                                     <p className="text-gray-400 text-sm">{new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})}</p>
                                 </div>
                                 <button onClick={() => setActivePanel('chat')} className="text-gray-400 hover:text-white"><XIcon className="w-5 h-5"/></button>
                             </div>
                             <div className="flex items-center gap-4 mb-6">
                                 <div className="text-5xl font-thin">{weatherData.temp}°</div>
                                 <div className="text-right flex-1">
                                     <WeatherIcon className="w-8 h-8 text-yellow-400 mb-1 ml-auto weather-icon-glow"/>
                                     <p className="text-sm font-medium">{weatherData.conditions}</p>
                                 </div>
                             </div>
                             <p className="text-sm text-gray-300 border-t border-white/10 pt-4 leading-relaxed">{weatherData.summary}</p>
                         </div>
                     </div>
                )}
                
                {/* Timer Panel */}
                {activePanel === 'timer' && (
                    <div className="absolute top-24 left-8 z-20 animate-panel-enter">
                         <div className="glass-panel bg-black/40 backdrop-blur-xl border border-white/10 rounded-full w-32 h-32 flex items-center justify-center relative shadow-2xl">
                              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                 <circle className="timer-circle-bg" cx="50" cy="50" r="45" fill="none" strokeWidth="4" />
                                 <circle 
                                    className="timer-circle-progress" 
                                    cx="50" cy="50" r="45" 
                                    fill="none" 
                                    strokeWidth="4" 
                                    strokeDasharray="283"
                                    strokeDashoffset={283 - (283 * timerData.remaining / timerData.duration)}
                                 />
                             </svg>
                             <div className="text-center">
                                 <span className="text-2xl font-mono font-bold block">{Math.floor(timerData.remaining / 60)}:{(timerData.remaining % 60).toString().padStart(2, '0')}</span>
                                 {timerData.remaining === 0 && <button onClick={() => setActivePanel('chat')} className="text-xs uppercase text-gray-400 hover:text-white mt-1">Dismiss</button>}
                             </div>
                         </div>
                    </div>
                )}
                
                {/* Code Panel */}
                {activePanel === 'code' && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-lg animate-panel-enter p-8">
                         <div className="w-full max-w-6xl h-[85vh] bg-[#0d1117] rounded-xl border border-border-color shadow-2xl flex flex-col code-editor-container">
                             <div className="editor-controls-pane">
                                 <div className="flex items-center gap-2 mr-4">
                                     <CodeIcon className="w-5 h-5 text-purple-400"/>
                                     <span className="font-bold text-sm">Code Editor</span>
                                 </div>
                                 <div className="editor-control-group">
                                     <select 
                                         value={codeLanguage} 
                                         onChange={(e) => setCodeLanguage(e.target.value)}
                                         className="editor-language-select text-xs uppercase"
                                     >
                                         <option value="javascript">JavaScript</option>
                                         <option value="html">HTML</option>
                                         <option value="css">CSS</option>
                                         <option value="python">Python</option>
                                     </select>
                                 </div>
                                 <div className="flex-1 mx-4">
                                     <input 
                                         type="text" 
                                         value={codeInstruction}
                                         onChange={(e) => setCodeInstruction(e.target.value)}
                                         onKeyDown={(e) => e.key === 'Enter' && handleCodeCommand()}
                                         placeholder="Type instructions to edit code (e.g., 'Fix the bug', 'Add a button')..."
                                         className="w-full bg-black/30 border border-border-color rounded px-3 py-1.5 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                     />
                                 </div>
                                 <button 
                                    onClick={handleCodeCommand}
                                    disabled={isCodeLoading}
                                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                                 >
                                     {isCodeLoading ? <SpinnerIcon className="w-4 h-4"/> : <SendIcon className="w-4 h-4"/>}
                                     Apply
                                 </button>
                                 <button onClick={() => setActivePanel('chat')} className="ml-2 p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white"><XIcon className="w-5 h-5"/></button>
                             </div>
                             <div className="editor-main-pane">
                                 <div className="editor-pane">
                                     <Editor
                                         value={code}
                                         onValueChange={setCode}
                                         highlight={code => (window as any).Prism.highlight(code, (window as any).Prism.languages[codeLanguage] || (window as any).Prism.languages.javascript, codeLanguage)}
                                         padding={20}
                                         style={{ fontFamily: '"Fira Code", "Fira Mono", monospace', fontSize: 14, backgroundColor: 'transparent', minHeight: '100%' }}
                                         textareaClassName="focus:outline-none"
                                     />
                                 </div>
                                 {/* Simple preview pane for HTML only */}
                                 {codeLanguage === 'html' && (
                                     <div className="preview-pane">
                                         <iframe srcDoc={code} title="preview" sandbox="allow-scripts" />
                                     </div>
                                 )}
                             </div>
                         </div>
                    </div>
                )}
            </main>

            {/* Footer Controls */}
            <footer className="flex-shrink-0 p-6 flex justify-center items-end z-20 pb-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                <div className="flex items-center gap-6 backdrop-blur-md bg-black/40 border border-white/10 px-8 py-3 rounded-full shadow-2xl">
                    {assistantState === 'idle' || assistantState === 'error' ? (
                        <button 
                            onClick={connect}
                            disabled={isConnectingRef.current}
                            className="group flex flex-col items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-all"
                        >
                            <div className={`p-4 rounded-full bg-cyan-500/20 border border-cyan-500/50 group-hover:bg-cyan-500/30 group-hover:scale-110 transition-all ${isConnectingRef.current ? 'animate-pulse' : ''}`}>
                                <ConnectIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium tracking-wider uppercase">{isConnectingRef.current ? 'Connecting...' : t('footer.connect')}</span>
                        </button>
                    ) : (
                        <>
                            <div className="flex flex-col items-center gap-1 text-gray-400">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border border-gray-600 bg-gray-800`}>
                                     <div className={`w-3 h-3 rounded-full ${assistantState === 'listening' || assistantState === 'recognizing' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-gray-500'}`}/>
                                </div>
                                <span className="text-[10px] font-medium tracking-wider uppercase">Rec</span>
                            </div>

                            <button 
                                onClick={disconnect}
                                className="group flex flex-col items-center gap-1 text-red-400 hover:text-red-300 transition-all"
                            >
                                <div className="p-4 rounded-full bg-red-500/20 border border-red-500/50 group-hover:bg-red-500/30 group-hover:scale-110 transition-all">
                                    <DisconnectIcon className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-medium tracking-wider uppercase">{t('footer.disconnect')}</span>
                            </button>
                            
                            <button 
                                onClick={() => recognizeSong(apiKeys.auddio, null).catch(e => handleFunctionCall({name:'ERROR', args:{}, error: e}))} // Simple trigger for demo, ideally needs audio blob
                                className="group flex flex-col items-center gap-1 text-purple-400 hover:text-purple-300 transition-all"
                                title="Feature requires Audd.io key"
                            >
                                 <div className="p-3 rounded-full bg-purple-500/10 border border-purple-500/30 group-hover:bg-purple-500/20 transition-all">
                                    <MusicIcon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-medium tracking-wider uppercase">Song</span>
                            </button>
                        </>
                    )}
                </div>
            </footer>

            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                activeTab={settingsTab}
                setActiveTab={setSettingsTab}
                theme={theme} setTheme={setTheme}
                gender={gender} setGender={setGender}
                greetingMessage={greetingMessage} setGreetingMessage={setGreetingMessage}
                systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt}
                emotionTuning={emotionTuning} setEmotionTuning={setEmotionTuning}
                apiKeys={apiKeys} setApiKeys={setApiKeys}
                lang={lang} setLang={setLang}
                femaleVoices={femaleVoices} setFemaleVoices={setFemaleVoices}
                maleVoices={maleVoices} setMaleVoices={setMaleVoices}
                ambientVolume={ambientVolume} setAmbientVolume={setAmbientVolume}
            />
        </div>
    );
};
