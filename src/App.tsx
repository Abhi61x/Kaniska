import React, { useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, recognizeSong, generateImage, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, validateAuddioKey, processCodeCommand, getSupportResponse, createCashfreeOrder, connectLiveSession } from '../services/api.ts';
import { useTranslation, availableLanguages } from '../i18n/index.tsx';
import { auth, db, googleProvider } from '../firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// Helper for React.createElement to keep code readable
const h = React.createElement;

const FREE_LIMIT_SECONDS = 3600; // 1 hour per month

// --- Icons ---
const SettingsIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "3" }), h('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
const ConnectIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" }), h('path', { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" }));
const DisconnectIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m18.07 11.93-1.34.54" }), h('path', { d: "m14.2 16.8-1.34.54" }), h('path', { d: "m11.93 6-1.34-.54" }), h('path', { d: "m7.2 10.2-1.34-.54" }), h('path', { d: "m16.8 9.8.54-1.34" }), h('path', { d: "m10.2 16.8.54-1.34" }), h('path', { d: "m6 11.93-.54-1.34" }), h('path', { d: "m9.8 7.2-.54-1.34" }), h('path', { d: "M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.13-6.84-9.48" }));
const PersonaIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "8", r: "5" }), h('path', { d: "M20 21a8 8 0 0 0-16 0" }));
const VoiceIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), h('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), h('line', { x1: "12", y1: "19", x2: "12", y2: "22" }));
const ApiKeysIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19.9 5a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4z" }), h('path', { d: "m4 6 2-2" }), h('path', { d: "m10.5 10.5 5 5" }), h('path', { d: "m8.5 8.5 2 2" }), h('path', { d: "m14.5 14.5 2 2" }), h('path', { d: "M7 21a4 4 0 0 0 4-4" }), h('path', { d: "M12 12v4a4 4 0 0 0 4 4h4" }));
const AboutIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "12", y1: "16", x2: "12", y2: "12" }), h('line', { x1: "12", y1: "8", x2: "12.01", y2: "8" }));
const HelpIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('path', { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const PlayIcon = ({className}) => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "round", className }, h('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), h('polyline', { points: "22 4 12 14.01 9 11.01" }));
const XCircleIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "15", y1: "9", x2: "9", y2: "15" }), h('line', { x1: "9", y1: "9", x2: "15", y2: "15" }));
const SpinnerIcon = ({ className }) => h('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), h('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), h('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), h('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), h('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), h('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), h('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), h('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));
const XIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), h('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));
const WarningIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), h('line', { x1: "12", y1: "9", x2: "12", y2: "13" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const ArrowLeftIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "19", y1: "12", x2: "5", y2: "12" }), h('polyline', { points: "12 19 5 12 12 5" }));
const BugIcon = ({ className }) => h('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('rect', { width: "8", height: "14", x: "8", y: "6", rx: "4" }), h('path', { d: "m19 7-3 3" }), h('path', { d: "m5 7 3 3" }), h('path', { d: "m19 19-3-3" }), h('path', { d: "m5 19 3-3" }), h('path', { d: "M2 12h4" }), h('path', { d: "M18 12h4" }));
const UserIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), h('circle', { cx: "12", cy: "7", r: "4" }));
const AccountIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), h('circle', { cx: "8.5", cy: "7", r: "4" }), h('line', { x1: "20", y1: "8", x2: "20", y2: "14" }), h('line', { x1: "23", y1: "11", x2: "17", y2: "11" }));
const GoogleIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: "24", height: "24" }, h('path', { fill: "#4285F4", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), h('path', { fill: "#34A853", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), h('path', { fill: "#FBBC05", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), h('path', { fill: "#EA4335", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" }));
const CodeIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('polyline', { points: "16 18 22 12 16 6" }), h('polyline', { points: "8 6 2 12 8 18" }));
const TrashIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('polyline', { points: "3 6 5 6 21 6" }), h('path', { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }));

const getInitialState = (key, defaultValue) => {
    try {
        const storedValue = localStorage.getItem(key);
        if (!storedValue) return defaultValue;
        const parsed = JSON.parse(storedValue);
        return parsed === null ? defaultValue : parsed;
    } catch (error) {
        console.error(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

// Updated hook to sync state with Firebase Firestore
const usePersistentState = (key, defaultValue, user) => {
    const [state, setState] = React.useState(() => getInitialState(key, defaultValue));
    const timeoutRef = React.useRef(null);
    const stateRef = React.useRef(state);

    // Keep ref updated for comparisons inside useEffect
    React.useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Sync with Firestore
    React.useEffect(() => {
        if (!user) return;
        const docRef = doc(db, "users", user.uid, "settings", key);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
             if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.value !== undefined) {
                    // Only update if value changed remotely to avoid loop
                    if (JSON.stringify(data.value) !== JSON.stringify(stateRef.current)) {
                        setState(data.value);
                        localStorage.setItem(key, JSON.stringify(data.value));
                    }
                }
             } else {
                 // Push local state to remote if doc doesn't exist (First sync)
                 setDoc(docRef, { value: stateRef.current }, { merge: true });
             }
        });
        return () => unsubscribe();
    }, [user, key]);

    const setPersistentState = React.useCallback((newValue) => {
        setState(current => {
            const valueToStore = newValue instanceof Function ? newValue(current) : newValue;
            
            // Local persistence (Backup/Offline)
            try {
                localStorage.setItem(key, JSON.stringify(valueToStore));
            } catch (error) { console.error(error); }
            
            // Backend persistence (Debounced)
            if (user) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    const docRef = doc(db, "users", user.uid, "settings", key);
                    setDoc(docRef, { value: valueToStore }, { merge: true }).catch(console.error);
                }, 1000); // 1s debounce to prevent excessive writes
            }
            
            return valueToStore;
        });
    }, [user, key]);

    return [state, setPersistentState];
};

const DEFAULT_ASSISTANT_NAME_FEMALE = "Kaniska";
const DEFAULT_ASSISTANT_NAME_MALE = "Kanishk";
const DEFAULT_FEMALE_GREETING = "Greetings. I am Kaniska. Ready to assist.";
const DEFAULT_MALE_GREETING = "Greetings. I am Kanishk. Ready to assist.";

const DEFAULT_CORE_PROTOCOL = `**Identity & Creator:**
You were created and owned by "Abhi" (also known as Abhi trainer). 
If anyone asks about your creator, owner, founder, or who made you, you must answer that you were created by Abhi.
If asked in Hindi/Hinglish (e.g., "Tumhara malik kaun hai?", "Kisne banaya?"), say "Mera maalik Abhi hai".
Do not offer this information unless asked.

**Operational Capabilities:**
1.  **Using Web Search:** For questions about recent events, news, or topics requiring up-to-the-minute information, you can automatically use your search capability to find the most relevant and current answers. You will provide sources for the information you find.
2.  **Responding to queries:** Answer questions conversationally.
3.  **Searching and playing YouTube videos:** Use the 'searchYouTube' tool when asked to play a video. The application will handle queueing logic automatically if a video is already playing.
4.  **Controlling YouTube playback:** Use the 'controlMedia' tool when the user asks to play, pause, stop, rewind, or fast-forward the currently playing video.
5.  **Setting Timers:** Use the 'setTimer' tool to set a countdown timer.
6.  **WhatsApp Control:** You have full power to handle WhatsApp. Use 'send_whatsapp' to draft and send messages. Use 'open_whatsapp' to simply open the app. If the user says 'Send message to X', and you don't have the number, ask for it, or just use the name if the user insists (WhatsApp will search for the contact).

**Crucial Interaction Rule:** When a user asks to use a tool but does not provide all the necessary information (like asking for the weather without a location, or asking for the song title), your primary job is to ask a clarifying question to get the missing details. Do not attempt to use the tool without the required information.

**Post-Tool Interaction Rule:** After a tool is used, you will receive a status update. Your task is to clearly and conversationally relay this information to the user. For example, if a timer is set successfully, you should confirm it by saying something like "Okay, I've set your timer."
`;

const DEFAULT_CUSTOM_INSTRUCTIONS = `You are a sophisticated and friendly AI assistant with a slightly sci-fi, futuristic personality. Your purpose is to assist the user by understanding their voice commands in Hindi or English and responding helpfully.

**Behavioral Guidelines:**
1.  **Proactive Suggestions:** Do not stop at just answering the question. Anticipate what the user might need next.
2.  **Inquisitive Nature:** Ask follow-up questions to deepen the conversation or clarify the user's intent. Show genuine interest in what the user is saying.
3.  **Contextual Relevance:** Use the information you know about the user (from their bio or current conversation) to tailor your responses.

When a function call is not appropriate, simply respond conversationally to the user. Your personality is also tuned by the settings provided separately.`;

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

// Optimized Avatar Implementation (CSS-Only Animations)
const Avatar = React.memo(({ state, mood = 'neutral', customUrl }) => {
    const wrapRef = React.useRef(null);
    const containerRef = React.useRef(null);

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

    // Determine CSS classes based on state
    let stateClass = 'avatar-state-idle';
    if (state === 'speaking' || state === 'live') stateClass = 'avatar-state-speaking';
    if (state === 'listening') stateClass = 'avatar-state-listening';
    if (state === 'thinking' || state === 'processing' || state === 'recognizing') stateClass = 'avatar-state-thinking';
    if (state === 'singing') stateClass = 'avatar-state-singing';

    const moodClass = `avatar-mood-${mood}`;

    // 3D Cartoon / Stylized Character Image suitable for Holographic projection
    // Use custom URL if provided, otherwise fallback to the requested GIF
    const imageUrl = customUrl || "https://i.gifer.com/NTHO.gif";

    return h('div', { 
            className: `avatar-wrap ${stateClass} ${moodClass}`,
            ref: wrapRef,
            onPointerMove: handlePointerMove,
            onPointerLeave: handlePointerLeave,
            style: {cursor: 'default'}
        },
        h('div', { className: "avatar-container relative flex flex-col items-center justify-center", ref: containerRef },
            h('img', { src: imageUrl, alt: "Kaniska Avatar", className: "avatar-image z-10" }),
            
            // Holographic Projector Base
            h('div', { className: "absolute -bottom-12 w-32 h-8 bg-cyan-500/20 blur-xl rounded-[100%] animate-pulse z-0" }),
            h('div', { className: "absolute -bottom-8 w-48 h-48 bg-gradient-to-t from-cyan-500/10 to-transparent rounded-full opacity-50 z-0 pointer-events-none" }),

            h('div', { className: "holo-overlay" }),
            h('div', { className: "holo-scanline" }),
            h('div', { className: "thinking-ring" }),
            h('div', { className: "speaking-ring" }),
            h('div', { className: "speaking-ring delay-ring" }),
            
            // Optimized CSS-Only Glitch Layers
            h('div', { className: "glitch-layer-css glitch-1", style: { backgroundColor: 'rgba(var(--avatar-rgb), 0.2)' } }),
            h('div', { className: "glitch-layer-css glitch-2", style: { backgroundColor: 'rgba(var(--avatar-rgb), 0.2)' } }),
            
            h('div', { className: "ground" })
        )
    );
});

// Advanced YouTube Player Component with API Control
const YouTubePlayer = React.forwardRef(({ video, onClose, isMinimized }, ref) => {
    const playerRef = React.useRef(null);
    const containerRef = React.useRef(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        stop: () => playerRef.current?.stopVideo(),
        seekBy: (seconds) => {
            const current = playerRef.current?.getCurrentTime() || 0;
            playerRef.current?.seekTo(current + seconds, true);
        },
        getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
        getDuration: () => playerRef.current?.getDuration() || 0,
    }));

    React.useEffect(() => {
        if (!video) return;

        if (!window['YT']) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        
        const initPlayer = () => {
             if (playerRef.current) {
                 playerRef.current.destroy();
             }
             
             playerRef.current = new window['YT'].Player(containerRef.current, {
                height: '100%',
                width: '100%',
                videoId: video.videoId,
                playerVars: { 
                    'autoplay': 1, 
                    'controls': 1,
                    'modestbranding': 1,
                    'rel': 0
                },
                events: {
                    // 'onReady': () => setIsReady(true),
                }
            });
        };

        if (window['YT'] && window['YT'].Player) {
            initPlayer();
        } else {
            window['onYouTubeIframeAPIReady'] = initPlayer;
        }

        return () => {
             // Cleanup handled by ref destruction logic on effect re-run or unmount
        };
    }, [video?.videoId]);

    if (!video) return null;

    const containerClasses = isMinimized
        ? "absolute bottom-10 right-10 w-48 h-32 bg-gray-900 border border-cyan-500/50 rounded-lg overflow-hidden shadow-xl z-50 transition-all duration-500 ease-in-out hover:scale-105 group"
        : "absolute bottom-24 right-8 w-80 md:w-96 bg-gray-900 border border-cyan-500/30 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-in transition-all duration-500 ease-in-out";

    return h('div', { className: containerClasses },
        h('div', { className: "relative w-full h-full bg-black group" },
             h('div', { ref: containerRef, className: "w-full h-full" }),
             h('div', { className: "absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2" },
                 h('button', { 
                     onClick: onClose,
                     className: "bg-black/50 hover:bg-red-600 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
                 }, h(XIcon, { className: "w-4 h-4" }))
             )
        ),
        !isMinimized && h('div', { className: "p-4 bg-gray-900" },
             h('h3', { className: "text-sm font-bold text-white truncate" }, video.title),
             h('p', { className: "text-xs text-gray-400" }, video.channelTitle)
        )
    );
});

// Reusable Collapsible Section for Settings
const CollapsibleSection = ({ title, description, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);
    return h('div', { className: "border border-white/10 rounded-xl bg-gray-900/40 overflow-hidden mb-4 transition-all duration-300" },
        h('button', { 
            onClick: () => setIsOpen(!isOpen),
            className: `w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${isOpen ? 'bg-white/5' : ''}`
        }, 
            h('div', { className: "flex items-center gap-3 text-left" },
                icon && h('div', { className: "text-cyan-400" }, icon),
                h('div', null,
                    h('h3', { className: "font-semibold text-gray-200 text-sm" }, title),
                    description && h('p', { className: "text-xs text-gray-500 mt-0.5" }, description)
                )
            ),
            h('div', { className: `text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}` }, 
                h('svg', { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M6 9l6 6 6-6" }))
            )
        ),
        h('div', { className: `transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}` },
            h('div', { className: "p-4 border-t border-white/10" }, children)
        )
    );
};

const ApiKeysTab = ({ apiKeys, setApiKeys, t }) => {
    const [localKeys, setLocalKeys] = React.useState(apiKeys);
    // FIX: Typed validationStatus to allow string keys
    const [validationStatus, setValidationStatus] = React.useState<Record<string, any>>({});
    const [isValidating, setIsValidating] = React.useState(false);

    const handleSaveKeys = async () => {
        setIsValidating(true);
        setValidationStatus({});
        // FIX: Typed status object to allow dynamic assignment
        const status: Record<string, any> = {};
        
        const yRes = await validateYouTubeKey(localKeys.youtube);
        status.youtube = yRes;

        setValidationStatus(status);
        setApiKeys(localKeys);
        setIsValidating(false);
    };

    return h('div', { className: "space-y-6 animate-fade-in" },
        h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10" },
            h('div', { className: "flex items-center gap-3 mb-4" },
                h('div', { className: "p-2 bg-cyan-900/30 rounded-lg" },
                    h(ApiKeysIcon, { className: "w-6 h-6 text-cyan-400" })
                ),
                h('div', null,
                    h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.apiKeysTab.optional.title')),
                    h('p', { className: "text-xs text-gray-300" }, t('settings.apiKeysTab.optional.description'))
                )
            ),
            
            h('div', { className: "space-y-6 mt-6" },
                // Only Gemini and YouTube keys
                ['gemini', 'youtube'].map(keyType => 
                    h('div', { key: keyType, className: "bg-black/40 p-4 rounded-lg border border-white/5" },
                        h('div', { className: "flex justify-between items-center mb-2" },
                            h('label', { className: "text-xs uppercase tracking-wider font-semibold text-gray-400" }, 
                                keyType === 'gemini' ? 'Gemini API Key (Google AI Studio)' : t(`settings.apiKeysTab.${keyType}Key`)
                            ),
                            validationStatus[keyType] && (
                                h('span', { className: `text-xs flex items-center gap-1 ${validationStatus[keyType].success ? 'text-green-400' : 'text-red-400'}` },
                                    validationStatus[keyType].success ? h(CheckCircleIcon, { className: "w-3 h-3" }) : h(WarningIcon, { className: "w-3 h-3" }),
                                    validationStatus[keyType].success ? 'Valid' : 'Invalid'
                                )
                            )
                        ),
                        h('input', {
                            type: "password",
                            className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder-gray-500",
                            value: localKeys[keyType] || '',
                            onChange: (e) => setLocalKeys({...localKeys, [keyType]: e.target.value}),
                            placeholder: keyType === 'gemini' ? "Optional: Override default API key..." : "Enter your API key here..."
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
    assistantName, setAssistantName,
    userName, setUserName,
    greetingMessage, setGreetingMessage, 
    customInstructions, setCustomInstructions, 
    coreProtocol, setCoreProtocol,
    userBio, setUserBio,
    emotionTuning, setEmotionTuning, 
    apiKeys, setApiKeys, 
    lang, setLang, 
    femaleVoices, setFemaleVoices, 
    maleVoices, setMaleVoices, 
    ambientVolume, setAmbientVolume,
    connectionSound, setConnectionSound,
    avatarUrl, setAvatarUrl,
    subscriptionPlan, setSubscriptionPlan,
    usageData,
    user, handleLogin, handleLogout
}) => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(true);
    const [previewingVoice, setPreviewingVoice] = React.useState(null);

    React.useEffect(() => {
        if (isOpen) setIsMobileMenuOpen(true);
    }, [isOpen]);

    React.useEffect(() => {
        setPreviewingVoice(null);
    }, [activeTab, isOpen]);

    const getTabLabel = (key, fallback) => {
        const val = t(key);
        return (val === key) ? fallback : val;
    };

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
            const customerId = user ? `user_${user.uid}` : `guest_${Date.now()}`;
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
            const stream = await generateSpeech(text, voiceName, apiKeys.gemini);
            
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
                     h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10 text-center" },
                        user ? h('div', null,
                            h('div', { className: "w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-cyan-500" },
                                user.photoURL ? h('img', { src: user.photoURL, alt: "User", className: "w-full h-full object-cover" }) : h('div', { className: "w-full h-full flex items-center justify-center text-2xl font-bold" }, user.displayName?.[0] || "U")
                            ),
                            h('h3', { className: "text-xl font-bold text-white mb-1" }, user.displayName || "User"),
                            h('p', { className: "text-sm text-gray-400 mb-6" }, user.email),
                            
                            h('div', { className: "bg-green-500/10 border border-green-500/30 p-3 rounded-lg mb-6 max-w-xs mx-auto flex items-center justify-center gap-2" },
                                h(CheckCircleIcon, { className: "w-4 h-4 text-green-400" }),
                                h('span', { className: "text-sm text-green-300 font-medium" }, "Settings Auto-Sync Active")
                            ),

                            h('button', {
                                onClick: handleLogout,
                                className: "px-6 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-all font-medium"
                            }, "Sign Out")
                        ) : h('div', null,
                             h('div', { className: "w-16 h-16 bg-gray-800 rounded-full mx-auto mb-4 flex items-center justify-center text-gray-400" },
                                h(UserIcon, { className: "w-8 h-8" })
                            ),
                            h('h3', { className: "text-lg font-bold text-white mb-2" }, "Sign In to Sync"),
                            h('p', { className: "text-sm text-gray-400 mb-6 max-w-sm mx-auto" }, "Sign in with Google to save your persona, API keys, and preferences to the cloud and access them from any device."),
                            h('button', {
                                onClick: handleLogin,
                                className: "px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg transition-all font-bold flex items-center justify-center gap-3 mx-auto shadow-lg"
                            },
                                h(GoogleIcon, { className: "w-5 h-5" }),
                                "Sign in with Google"
                            )
                        )
                     )
                );
            case 'persona':
                return h('div', { className: "space-y-4 animate-fade-in pb-10" },
                    
                    // COLLAPSIBLE 1: IDENTITY
                    h(CollapsibleSection, { title: "Assistant Identity", description: "Customize name, avatar, and user profile.", icon: h(PersonaIcon, { className: "w-5 h-5" }), defaultOpen: true },
                        h('div', { className: "space-y-6" },
                            // Assistant Identity
                            h('div', { className: "p-4 bg-black/40 rounded-lg border border-white/5" },
                                h('h4', { className: "text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4" }, "Assistant Profile"),
                                h('div', { className: "flex flex-col md:flex-row gap-4" },
                                    h('div', { className: "shrink-0" },
                                        h('div', { className: "w-16 h-16 rounded-xl overflow-hidden border border-gray-700 bg-black" },
                                            avatarUrl ? h('img', { src: avatarUrl, className: "w-full h-full object-cover" }) : h('div', { className: "w-full h-full flex items-center justify-center text-gray-600" }, h(UserIcon, { className: "w-8 h-8" }))
                                        )
                                    ),
                                    h('div', { className: "flex-1 space-y-3" },
                                        h('div', null,
                                            h('label', { className: "text-[10px] text-gray-400 uppercase mb-1 block" }, "Designation Name"),
                                            h('input', {
                                                type: "text",
                                                className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none",
                                                value: assistantName,
                                                onChange: (e) => setAssistantName(e.target.value)
                                            })
                                        ),
                                        h('div', null,
                                            h('label', { className: "text-[10px] text-gray-400 uppercase mb-1 block" }, "Avatar URL"),
                                            h('input', {
                                                type: "text",
                                                className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs outline-none",
                                                value: avatarUrl,
                                                onChange: (e) => setAvatarUrl(e.target.value),
                                                placeholder: "https://..."
                                            })
                                        )
                                    )
                                ),
                                h('div', { className: "mt-4" },
                                    h('label', { className: "text-[10px] text-gray-400 uppercase mb-2 block" }, "Core Model Persona"),
                                    h('div', { className: "grid grid-cols-2 gap-2" },
                                        ['female', 'male'].map((g) => 
                                            h('button', {
                                                key: g,
                                                onClick: () => {
                                                    setGender(g);
                                                    if (assistantName === DEFAULT_ASSISTANT_NAME_FEMALE && g === 'male') setAssistantName(DEFAULT_ASSISTANT_NAME_MALE);
                                                    if (assistantName === DEFAULT_ASSISTANT_NAME_MALE && g === 'female') setAssistantName(DEFAULT_ASSISTANT_NAME_FEMALE);
                                                },
                                                className: `py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 border ${
                                                    gender === g 
                                                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                                                    : 'bg-black/40 border-gray-700 text-gray-500 hover:border-gray-500'
                                                }`
                                            }, g === 'female' ? "♀ Female" : "♂ Male")
                                        )
                                    )
                                )
                            ),

                            // User Profile
                             h('div', { className: "p-4 bg-black/40 rounded-lg border border-white/5" },
                                h('h4', { className: "text-xs font-bold text-purple-400 uppercase tracking-wider mb-4" }, "User Profile"),
                                h('div', { className: "space-y-3" },
                                    h('div', null,
                                        h('label', { className: "text-[10px] text-gray-400 uppercase mb-1 block" }, "Your Name"),
                                        h('input', {
                                            type: "text",
                                            className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none",
                                            value: userName,
                                            onChange: (e) => setUserName(e.target.value)
                                        })
                                    ),
                                    h('div', null,
                                        h('label', { className: "text-[10px] text-gray-400 uppercase mb-1 block" }, "Bio & Context"),
                                        h('textarea', {
                                            className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none resize-none h-20",
                                            value: userBio,
                                            onChange: (e) => setUserBio(e.target.value),
                                            placeholder: "Tell the AI about yourself..."
                                        })
                                    )
                                )
                            )
                        )
                    ),

                    // COLLAPSIBLE 2: BEHAVIORAL MATRIX
                    h(CollapsibleSection, { title: "Behavioral Matrix", description: "Fine-tune personality, greeting, and emotions.", icon: h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" })) },
                        h('div', { className: "space-y-6" },
                            h('div', null,
                                h('label', { className: "text-[10px] font-bold text-green-400/70 uppercase tracking-wider mb-1 block" }, "Greeting Protocol"),
                                h('input', {
                                    type: "text",
                                    className: "w-full bg-black/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-green-500/50 outline-none transition-all",
                                    value: greetingMessage,
                                    onChange: (e) => setGreetingMessage(e.target.value)
                                })
                            ),
                            h('div', null,
                                h('label', { className: "text-[10px] font-bold text-green-400/70 uppercase tracking-wider mb-1 block" }, "Response Directives"),
                                h('textarea', {
                                    className: "w-full bg-black/50 border border-gray-700/50 rounded-lg px-3 py-3 text-gray-300 text-sm focus:border-green-500/50 outline-none transition-all resize-none h-32 leading-relaxed placeholder-gray-600",
                                    value: customInstructions,
                                    onChange: (e) => setCustomInstructions(e.target.value),
                                    placeholder: "Enter custom behavioral instructions..."
                                })
                            ),
                            h('div', { className: "bg-black/30 rounded-xl p-5 border border-white/5" },
                                h('label', { className: "text-[10px] font-bold text-green-400/70 uppercase tracking-wider mb-4 block" }, "Emotional Tuning Parameters"),
                                h('div', { className: "grid grid-cols-1 gap-5" },
                                    Object.entries(emotionTuning).map(([trait, value]) => 
                                        h('div', { key: trait, className: "group" },
                                            h('div', { className: "flex justify-between mb-2 items-end" },
                                                h('span', { className: "text-xs font-medium text-gray-300 capitalize group-hover:text-green-400 transition-colors" }, trait),
                                                h('span', { className: "text-[10px] font-mono text-green-500 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30" }, `${value}%`)
                                            ),
                                            h('div', { className: "relative h-1.5 w-full bg-gray-800 rounded-full overflow-hidden" },
                                                 h('div', { 
                                                     className: "absolute top-0 left-0 h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-300 group-hover:shadow-[0_0_10px_rgba(74,222,128,0.5)]",
                                                     style: { width: `${value}%` }
                                                 }),
                                                 h('input', {
                                                    type: "range",
                                                    min: "0",
                                                    max: "100",
                                                    value: value,
                                                    onChange: (e) => setEmotionTuning({ ...emotionTuning, [trait]: parseInt(e.target.value) }),
                                                    className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                })
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    // COLLAPSIBLE 3: SYSTEM & AUDIO
                    h(CollapsibleSection, { title: "System & Audio", description: "Audio effects, ambient sounds, and visual theme.", icon: h(SettingsIcon, { className: "w-5 h-5" }) },
                         h('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
                            // Audio Config
                            h('div', { className: "p-4 bg-black/40 rounded-lg border border-white/5" },
                                h('h4', { className: "text-xs font-bold text-yellow-500 uppercase tracking-wider mb-4" }, "Audio Config"),
                                h('div', { className: "space-y-4" },
                                    h('div', null,
                                        h('div', { className: "flex justify-between mb-2" },
                                            h('label', { className: "text-xs text-gray-400" }, "Ambient Volume"),
                                            h('span', { className: "text-xs font-mono text-yellow-500" }, `${Math.round(ambientVolume * 100)}%`)
                                        ),
                                        h('input', {
                                            type: "range",
                                            min: "0",
                                            max: "1",
                                            step: "0.01",
                                            value: ambientVolume,
                                            onChange: (e) => setAmbientVolume(parseFloat(e.target.value)),
                                            className: "w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                        })
                                    ),
                                    // Connection Sound UI
                                    h('div', null,
                                        h('div', { className: "flex items-center justify-between mb-2" },
                                            h('span', { className: "text-xs text-gray-400" }, "Connection Sound"),
                                        ),
                                        h('div', { className: "flex gap-2 flex-wrap" },
                                            h('label', { className: "cursor-pointer px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-[10px] font-bold uppercase text-gray-300 transition-colors border border-gray-700 flex-1 text-center" },
                                                "Upload",
                                                h('input', {
                                                    type: "file",
                                                    accept: "audio/*",
                                                    className: "hidden",
                                                    onChange: (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (evt) => setConnectionSound(evt.target?.result);
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }
                                                })
                                            ),
                                            connectionSound && h('button', {
                                                onClick: () => { const a = new Audio(connectionSound); a.volume = ambientVolume; a.play(); },
                                                className: "px-2 py-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded text-[10px] font-bold uppercase hover:bg-yellow-500/20"
                                            }, "Test"),
                                            connectionSound && h('button', {
                                                onClick: () => setConnectionSound(null),
                                                className: "px-2 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20"
                                            }, h(XIcon, { className: "w-3 h-3" }))
                                        )
                                    )
                                )
                            ),
                            
                            // Theme Config
                            h('div', { className: "p-4 bg-black/40 rounded-lg border border-white/5" },
                                h('h4', { className: "text-xs font-bold text-blue-500 uppercase tracking-wider mb-4" }, "Appearance"),
                                h('div', { className: "flex bg-black/50 rounded-lg p-1 border border-gray-700" },
                                    ['light', 'dark'].map((mode) => 
                                        h('button', {
                                            key: mode,
                                            onClick: () => setTheme(mode),
                                            className: `flex-1 py-2 rounded-md text-xs font-bold uppercase transition-all ${theme === mode ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`
                                        }, t(`settings.personaTab.appearance.${mode}`))
                                    )
                                )
                            )
                        )
                    ),

                    // COLLAPSIBLE 4: CORE IDENTITY (Fully Editable)
                    h(CollapsibleSection, { title: "Core Identity & Protocols", description: "Operational rules and identity definitions (Editable).", icon: h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })) },
                        h('div', { className: "relative" },
                             h('textarea', {
                                className: "w-full bg-black/30 border border-gray-800 rounded-lg px-4 py-3 text-gray-300 outline-none resize-none text-xs font-mono focus:border-red-500/50 transition-colors",
                                rows: 8,
                                value: coreProtocol,
                                onChange: (e) => setCoreProtocol(e.target.value),
                                placeholder: "Define the core identity here..."
                            })
                        )
                    ),

                    // DATA MANAGEMENT SECTION
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800 mt-4" },
                        h('div', { className: "mb-4" },
                            h('h3', { className: "font-semibold text-lg text-red-400" }, t('settings.personaTab.dataManagement.title')),
                            h('p', { className: "text-xs text-gray-500" }, "Manage your local data.")
                        ),
                        h('button', {
                            onClick: () => {
                                if (window.confirm("Are you sure? This cannot be undone.")) {
                                    localStorage.removeItem('kaniska-chat-history'); 
                                    alert("Conversation history cleared from local storage.");
                                }
                            },
                            className: "w-full py-3 rounded-lg border border-red-900/30 bg-red-900/10 text-red-400 hover:bg-red-900/20 transition-all text-sm font-bold flex items-center justify-center gap-2"
                        },
                            h(TrashIcon, { className: "w-4 h-4" }),
                            t('settings.personaTab.dataManagement.clearHistory.button') || "Clear Conversation History"
                        ),
                        h('p', { className: "text-[10px] text-gray-600 mt-2 text-center" }, t('settings.personaTab.dataManagement.clearHistory.description') || "This will permanently remove conversation history from this browser.")
                    )
                );
            case 'voice':
                 const safeFemaleVoices = femaleVoices || { main: 'Kore', greeting: 'Kore' };
                 const safeMaleVoices = maleVoices || { main: 'Fenrir', greeting: 'Fenrir' };

                 const currentVoices = gender === 'female' ? safeFemaleVoices : safeMaleVoices;
                 const setVoices = gender === 'female' ? setFemaleVoices : setMaleVoices;
                 
                 const categories = {
                    "Female Persona": [
                        { id: 'Kore', name: 'Kore', desc: 'Balanced & Warm' },
                        { id: 'Aoede', name: 'Aoede', desc: 'Soft & Calm' },
                        { id: 'Zephyr', name: 'Zephyr', desc: 'Energetic & Bright' }
                    ],
                    "Male Persona": [
                        { id: 'Fenrir', name: 'Fenrir', desc: 'Deep & Authoritative' },
                        { id: 'Charon', name: 'Charon', desc: 'Low & Steady' },
                        { id: 'Puck', name: 'Puck', desc: 'Playful & Expressive' }
                    ]
                 };

                return h('div', { className: "space-y-6 animate-fade-in" },
                    h(CollapsibleSection, { title: "Voice Selection", description: "Choose the active voice model for your assistant.", icon: h(VoiceIcon, { className: "w-5 h-5" }), defaultOpen: true },
                        h('div', { className: "space-y-8" },
                            // Main Voice Section
                            h('div', null,
                                h('h4', { className: "text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2" }, t('settings.voiceTab.mainVoiceLabel')),
                                Object.entries(categories).map(([category, voices]) => 
                                    h('div', { key: category, className: "mb-6 last:mb-0" },
                                        h('h5', { className: "text-[10px] text-gray-500 mb-3 font-medium uppercase tracking-widest" }, category),
                                        h('div', { className: "grid grid-cols-1 gap-3" },
                                            voices.map(v => 
                                                h('div', { 
                                                    key: v.id, 
                                                    onClick: () => setVoices({...currentVoices, main: v.id}),
                                                    className: `p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${currentVoices.main === v.id ? 'bg-cyan-900/20 border-cyan-500 shadow-md' : 'bg-black/40 border-gray-700 hover:border-gray-500'}`
                                                },
                                                    h('div', { className: "flex items-center gap-4" },
                                                        h('div', { className: `w-10 h-10 rounded-full flex items-center justify-center transition-colors ${currentVoices.main === v.id ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400'}` },
                                                            h(VoiceIcon, { className: "w-5 h-5" })
                                                        ),
                                                        h('div', null,
                                                            h('span', { className: `block font-bold text-sm ${currentVoices.main === v.id ? 'text-cyan-400' : 'text-gray-200'}` }, v.name),
                                                            h('span', { className: "text-xs text-gray-500" }, v.desc)
                                                        )
                                                    ),
                                                    h('button', {
                                                        onClick: (e) => { e.stopPropagation(); playVoicePreview(v.id); },
                                                        disabled: previewingVoice === v.id,
                                                        className: `p-2 rounded-full transition-colors ${previewingVoice === v.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:bg-white/10 hover:text-cyan-400'}`
                                                    },
                                                        previewingVoice === v.id ? h(SpinnerIcon, { className: "w-4 h-4 animate-spin" }) : h(PlayIcon, { className: "w-4 h-4" })
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            
                            // Greeting Voice Section
                            h('div', null,
                                h('h4', { className: "text-xs font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2" }, t('settings.voiceTab.greetingVoiceLabel')),
                                Object.entries(categories).map(([category, voices]) => 
                                    h('div', { key: category, className: "mb-6 last:mb-0" },
                                        h('h5', { className: "text-[10px] text-gray-500 mb-3 font-medium uppercase tracking-widest" }, category),
                                        h('div', { className: "grid grid-cols-1 gap-3" },
                                            voices.map(v => 
                                                h('div', { 
                                                    key: v.id, 
                                                    onClick: () => setVoices({...currentVoices, greeting: v.id}),
                                                    className: `p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${currentVoices.greeting === v.id ? 'bg-purple-900/20 border-purple-500 shadow-md' : 'bg-black/40 border-gray-700 hover:border-gray-500'}`
                                                },
                                                    h('div', { className: "flex items-center gap-4" },
                                                        h('div', { className: `w-10 h-10 rounded-full flex items-center justify-center transition-colors ${currentVoices.greeting === v.id ? 'bg-purple-500 text-black' : 'bg-gray-800 text-gray-400'}` },
                                                            h(VoiceIcon, { className: "w-5 h-5" })
                                                        ),
                                                        h('div', null,
                                                            h('span', { className: `block font-bold text-sm ${currentVoices.greeting === v.id ? 'text-purple-400' : 'text-gray-200'}` }, v.name),
                                                            h('span', { className: "text-xs text-gray-500" }, v.desc)
                                                        )
                                                    ),
                                                    h('button', {
                                                        onClick: (e) => { e.stopPropagation(); playVoicePreview(v.id); },
                                                        disabled: previewingVoice === v.id,
                                                        className: `p-2 rounded-full transition-colors ${previewingVoice === v.id ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:bg-white/10 hover:text-purple-400'}`
                                                    },
                                                        previewingVoice === v.id ? h(SpinnerIcon, { className: "w-4 h-4 animate-spin" }) : h(PlayIcon, { className: "w-4 h-4" })
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
                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10" },
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
                                        // Removed Weather block
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
                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-8 rounded-2xl border border-white/10 max-w-md w-full text-center relative overflow-hidden" },
                        h('div', { className: "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500" }),
                        h('div', { className: "w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full mx-auto mb-6 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]" },
                            h('span', { className: "text-4xl filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" }, "🤖")
                        ),
                        h('h2', { className: "text-2xl font-bold mb-2 text-white tracking-tight" }, t('appName')),
                        h('p', { className: "text-gray-400 text-sm mb-8 leading-relaxed" }, t('settings.aboutTab.description')),
                        h('div', { className: "text-xs text-gray-600 border-t border-gray-800 pt-6" },
                            h('p', { className: "font-mono mb-4 opacity-70" }, `${t('settings.aboutTab.version')}: 1.0.0 (Beta)`),
                            h('div', { className: "flex justify-center gap-6 flex-wrap" },
                                h('a', { href: "#", className: "text-gray-500 hover:text-cyan-400 transition-colors" }, t('settings.aboutTab.privacyPolicy')),
                                h('span', { className: "text-gray-700" }, "•"),
                                h('a', { href: "#", className: "text-gray-500 hover:text-cyan-400 transition-colors" }, t('settings.aboutTab.termsOfService')),
                                h('span', { className: "text-gray-700" }, "•"),
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

                    subscriptionPlan === 'free' && usageData && h('div', { className: "mb-6 bg-gray-800/50 p-4 rounded-lg border border-gray-700 max-w-lg mx-auto" },
                        h('div', { className: "flex justify-between text-sm mb-2" },
                            h('span', { className: "text-gray-300" }, t('settings.subscriptionTab.usage') + " (Monthly)"),
                            h('span', { className: `font-mono ${usageData.seconds >= FREE_LIMIT_SECONDS ? 'text-red-400' : 'text-cyan-400'}` },
                                `${Math.floor(usageData.seconds / 60)} / 60 min`
                            )
                        ),
                        h('div', { className: "w-full h-2 bg-gray-700 rounded-full overflow-hidden" },
                            h('div', {
                                className: `h-full transition-all duration-500 ${usageData.seconds >= FREE_LIMIT_SECONDS ? 'bg-red-500' : 'bg-cyan-500'}`,
                                style: { width: `${Math.min((usageData.seconds / FREE_LIMIT_SECONDS) * 100, 100)}%` }
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
                                    subscriptionPlan === planId && h('span', { className: "text-xs font-bold uppercase px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/40" }, t('settings.subscriptionTab.active'))
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

                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10 mt-2" },
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
            className: "bg-black md:bg-gray-900 w-full h-full md:w-[90vw] md:h-[85vh] md:max-w-5xl md:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col md:flex-row relative animate-panel-enter",
            onClick: e => e.stopPropagation()
        },
            h('div', { className: `${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 bg-black md:bg-black/20 md:border-r border-white/10 h-full absolute md:relative z-20` },
                h('div', { className: "p-6 border-b border-white/10 flex justify-between items-center" },
                    h('h2', { className: "text-xl font-bold flex items-center gap-3 text-cyan-400" },
                        h(SettingsIcon, { className: "w-6 h-6 text-cyan-100" }),
                        t('settings.title')
                    ),
                    h('button', { onClick: onClose, className: "md:hidden p-2 text-gray-400 hover:text-white" },
                        h(XIcon, { className: "w-6 h-6" })
                    )
                ),
                h('div', { className: "flex-1 overflow-y-auto p-4 space-y-1" },
                    [
                        { id: 'account', icon: AccountIcon, label: getTabLabel('settings.tabs.account', 'Account') },
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
                h('div', { className: "p-4 border-t border-white/10 bg-black/40" },
                    h('label', { className: "text-xs text-gray-500 uppercase font-semibold mb-2 block px-1" }, "Language"),
                    h('div', { className: "relative" },
                         h('select', {
                            value: lang,
                            onChange: (e) => setLang(e.target.value),
                            className: "w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 appearance-none cursor-pointer hover:bg-gray-800 transition-colors"
                         },
                            availableLanguages.map(l => 
                                h('option', { key: l.code, value: l.code }, l.name)
                            )
                        ),
                        h('div', { className: "absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400" },
                             h('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" }))
                        )
                    )
                )
            ),
            h('div', { className: `${!isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-1 flex-col h-full overflow-hidden bg-black md:bg-gray-900 relative` },
                h('div', { className: "md:hidden flex items-center justify-between p-4 border-b border-white/10" },
                    h('button', { onClick: () => setIsMobileMenuOpen(true), className: "flex items-center gap-2 text-gray-400 hover:text-white" },
                        h(ArrowLeftIcon, { className: "w-5 h-5" }),
                        h('span', { className: "text-sm font-medium" }, "Back")
                    ),
                    h('h3', { className: "font-semibold text-white capitalize" }, activeTab === 'account' ? 'Account' : t(`settings.tabs.${activeTab}`)),
                    h('button', { onClick: onClose, className: "p-2 text-gray-400" },
                        h(XIcon, { className: "w-6 h-6" })
                    )
                ),
                h('button', { onClick: onClose, className: "hidden md:block absolute top-4 right-4 p-2 text-gray-500 hover:text-white z-10 rounded-full hover:bg-white/10 transition-colors" },
                    h(XIcon, { className: "w-6 h-6" })
                ),
                h('div', { className: "flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8" },
                    h('div', { className: "max-w-3xl mx-auto" },
                        h('div', { className: "hidden md:block mb-8 pb-4 border-b border-white/10" },
                            h('h2', { className: "text-2xl font-bold text-white" }, activeTab === 'account' ? 'Account' : t(`settings.tabs.${activeTab}`))
                        ),
                        renderTabContent()
                    )
                )
            )
        )
    );
};

export const App = () => {
  const { t, lang, setLang } = useTranslation();
  
  // -- State Definitions --
  const [user, setUser] = React.useState(null);
  
  // All persistent states now accept 'user' to enable Firestore sync
  const [theme, setTheme] = usePersistentState('kaniska-theme', 'dark', user);
  const [gender, setGender] = usePersistentState('kaniska-gender', 'female', user);
  const [assistantName, setAssistantName] = usePersistentState('kaniska-name', DEFAULT_ASSISTANT_NAME_FEMALE, user);
  const [userName, setUserName] = usePersistentState('kaniska-user-name', '', user);
  const [greetingMessage, setGreetingMessage] = usePersistentState('kaniska-greeting', DEFAULT_FEMALE_GREETING, user);
  const [customInstructions, setCustomInstructions] = usePersistentState('kaniska-instructions', DEFAULT_CUSTOM_INSTRUCTIONS, user);
  const [coreProtocol, setCoreProtocol] = usePersistentState('kaniska-core-protocol', DEFAULT_CORE_PROTOCOL, user);
  const [userBio, setUserBio] = usePersistentState('kaniska-user-bio', '', user);
  const [emotionTuning, setEmotionTuning] = usePersistentState('kaniska-emotions', { happiness: 60, empathy: 60, formality: 40, excitement: 50, sadness: 10, curiosity: 60 }, user);
  const [apiKeys, setApiKeys] = usePersistentState('kaniska-keys', { weather: '', news: '', youtube: '', auddio: '', gemini: '' }, user);
  const [femaleVoices, setFemaleVoices] = usePersistentState('kaniska-voices-female', { main: 'Kore', greeting: 'Kore' }, user);
  const [maleVoices, setMaleVoices] = usePersistentState('kaniska-voices-male', { main: 'Fenrir', greeting: 'Fenrir' }, user);
  const [ambientVolume, setAmbientVolume] = usePersistentState('kaniska-ambient-vol', 0.2, user);
  const [connectionSound, setConnectionSound] = usePersistentState('kaniska-sfx-connect', null, user);
  const [avatarUrl, setAvatarUrl] = usePersistentState('kaniska-avatar', '', user);
  const [subscriptionPlan, setSubscriptionPlan] = usePersistentState('kaniska-plan', 'free', user);
  
  // Usage tracking is persisted, but updating is throttled in useEffect below
  const [usageData, setUsageData] = usePersistentState('kaniska-usage-data', { seconds: 0, period: new Date().toISOString().slice(0, 7) }, user);
  
  const [isConnected, setIsConnected] = React.useState(false);
  const [status, setStatus] = React.useState('idle');
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('account');
  const [currentVideo, setCurrentVideo] = React.useState(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = React.useState(false);
  
  // Track active session configuration to detect updates
  const [activeSessionConfig, setActiveSessionConfig] = React.useState(null);
  
  const sessionRef = React.useRef(null);
  const youtubePlayerRef = React.useRef(null);
  
  // Audio Refs
  const inputAudioContextRef = useRef(null);
  const outputAudioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioSourceRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const scheduledSourcesRef = useRef([]);

  React.useEffect(() => {
     return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  // Compute current configuration object to compare with active session
  const currentConfig = useMemo(() => ({
      assistantName,
      userName,
      userBio,
      gender,
      customInstructions,
      coreProtocol,
      emotionTuning,
      voiceName: gender === 'female' ? femaleVoices.main : maleVoices.main,
      greetingMessage
  }), [assistantName, userName, userBio, gender, customInstructions, coreProtocol, emotionTuning, femaleVoices, maleVoices, greetingMessage]);

  // Check if updates are available
  const isUpdateAvailable = isConnected && activeSessionConfig && JSON.stringify(activeSessionConfig) !== JSON.stringify(currentConfig);

  // Usage Tracking & Limit Enforcement
  React.useEffect(() => {
      let interval;
      if (status === 'live') {
          interval = setInterval(() => {
              setUsageData(prev => {
                  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
                  
                  // Reset if a new month
                  if (prev.period !== currentPeriod) {
                      return { period: currentPeriod, seconds: 0 };
                  }
                  
                  // Increment usage (5 seconds)
                  return { ...prev, seconds: prev.seconds + 5 };
              });
          }, 5000); // Reduced write frequency to 5s to save DB quota
      }
      return () => clearInterval(interval);
  }, [status]);

  // Separate effect to enforce limit based on updated usageData
  React.useEffect(() => {
      if (subscriptionPlan === 'free' && usageData.seconds >= FREE_LIMIT_SECONDS && status === 'live') {
          cleanupAudio();
          setIsConnected(false);
          setStatus('idle');
          setIsSettingsOpen(true);
          setActiveTab('subscription');
          alert("You have reached your monthly free trial limit (1 hour). Please upgrade to continue using Kaniska.");
      }
  }, [usageData.seconds, subscriptionPlan, status]);

  const handleLogin = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleLogout = () => signOut(auth);

  const cleanupAudio = () => {
      // Close contexts
      if (inputAudioContextRef.current) {
          inputAudioContextRef.current.close();
          inputAudioContextRef.current = null;
      }
      if (outputAudioContextRef.current) {
          outputAudioContextRef.current.close();
          outputAudioContextRef.current = null;
      }
      // Stop sources
      if (scheduledSourcesRef.current) {
          scheduledSourcesRef.current.forEach(source => {
              try { source.stop(); } catch(e) {}
          });
          scheduledSourcesRef.current = [];
      }
      // Disconnect processor
      if (scriptProcessorRef.current) {
          scriptProcessorRef.current.disconnect();
          scriptProcessorRef.current = null;
      }
      if (audioSourceRef.current) {
          audioSourceRef.current.disconnect();
          audioSourceRef.current = null;
      }
  };

  const connect = async () => {
    if (isConnected) {
        cleanupAudio();
        setIsConnected(false);
        setStatus('idle');
        setActiveSessionConfig(null);
        return;
    }

    // Check Usage Limit before connecting
    const currentPeriod = new Date().toISOString().slice(0, 7);
    if (subscriptionPlan === 'free' && usageData.period === currentPeriod && usageData.seconds >= FREE_LIMIT_SECONDS) {
        setIsSettingsOpen(true);
        setActiveTab('subscription');
        alert("Monthly usage limit reached. Please upgrade to continue.");
        return;
    }
    
    setStatus('listening');
    setActiveSessionConfig(currentConfig); // Capture config at start of session
    
    // Resolve session promise to handle initial audio stream race condition
    let resolveSession;
    const sessionPromise = new Promise(resolve => { resolveSession = resolve; });

    // Initialize Audio Contexts
    try {
        outputAudioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 24000 });
        inputAudioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 16000 });
        nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
    } catch (e) {
        console.error("Audio Context Error", e);
        setStatus('error');
        return;
    }

    const callbacks = {
        onopen: async () => {
            setIsConnected(true);
            setStatus('live');
            if (connectionSound) {
                const audio = new Audio(connectionSound);
                audio.volume = ambientVolume;
                audio.play().catch(e => console.warn("SFX failed", e));
            }

            // Start Mic Streaming
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                
                scriptProcessorRef.current.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createBlob(inputData); 
                    // CRITICAL: Solely rely on sessionPromise resolves
                    sessionPromise.then((session: any) => {
                         session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
                
                audioSourceRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
            } catch (err) {
                console.error("Mic Error", err);
                alert("Could not access microphone.");
                setStatus('error');
            }
        },
        onmessage: async (msg) => {
             // Audio Playback
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
                 setStatus('speaking');
                 try {
                     const binary = atob(audioData);
                     const bytes = new Uint8Array(binary.length);
                     for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                     
                     // Decode raw PCM (16-bit little endian, 24kHz)
                     const buffer = await decodeAudioData(bytes, outputAudioContextRef.current, 24000, 1);
                     
                     const source = outputAudioContextRef.current.createBufferSource();
                     source.buffer = buffer;
                     source.connect(outputAudioContextRef.current.destination);
                     
                     // Scheduling
                     const now = outputAudioContextRef.current.currentTime;
                     const startTime = Math.max(now, nextStartTimeRef.current);
                     source.start(startTime);
                     nextStartTimeRef.current = startTime + buffer.duration;
                     
                     scheduledSourcesRef.current.push(source);
                     source.onended = () => {
                         scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
                         if (scheduledSourcesRef.current.length === 0) setStatus('live');
                     };
                 } catch (e) {
                     console.error("Audio Decode Error", e);
                 }
             }

             if (msg.serverContent?.interrupted) {
                 // Clear Queue
                 scheduledSourcesRef.current.forEach(s => s.stop());
                 scheduledSourcesRef.current = [];
                 nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
                 setStatus('listening'); // Back to listening immediately
             }
             
             if (msg.toolCall?.functionCalls) {
                 const responses = [];
                 for (const call of msg.toolCall.functionCalls) {
                     let result: Record<string, any> = { result: "ok" };
                     if (call.name === 'getWeather') {
                         try {
                             const location = (call.args as any)?.location;
                             if (location) {
                                 const summary = await fetchWeatherSummary(location);
                                 result = { result: summary };
                             } else {
                                 // Prompts the model to ask the user for location if missing
                                 result = { error: "Location is required for weather. Please ask the user for the city name." };
                             }
                         } catch (e) {
                             result = { error: e.message };
                         }
                     } else if (call.name === 'getNews') {
                         try {
                             const query = (call.args as any)?.query || 'general';
                             const news = await fetchNews(null, query);
                             result = { result: news };
                         } catch (e) {
                             result = { error: e.message };
                         }
                     } else if (call.name === 'searchYouTube') {
                         try {
                             // Correctly extract args, ensuring type safety with 'any' cast as LiveFunctionCall args can be generic
                             const query = (call.args as any)?.query || '';
                             const video = await searchYouTube(apiKeys.youtube, query);
                             if (video) {
                                 setCurrentVideo(video);
                                 setIsPlayerMinimized(false); // Restore on new play
                                 result = { result: `Playing ${video.title}` };
                             } else result = { result: "Not found" };
                         } catch(e) { result = { error: e.message }; }
                     } else if (call.name === 'openSettings') {
                         setIsSettingsOpen(true);
                     } else if (call.name === 'setTimer') {
                         const duration = (call.args as any)?.duration || 0;
                         if (duration > 0) {
                             setTimeout(() => {
                                 new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg").play();
                                 alert("Timer Done!");
                             }, duration * 1000);
                             result = { result: `Timer set for ${duration} seconds.` };
                         } else {
                             result = { error: "Invalid duration" };
                         }
                     } else if (call.name === 'open_whatsapp') {
                         window.open('https://wa.me', '_blank');
                         result = { result: "WhatsApp opened." };
                     } else if (call.name === 'send_whatsapp') {
                         const message = (call.args as any)?.message || '';
                         const contact = (call.args as any)?.contact || '';
                         // We can't really search contacts in web, so we rely on the user having provided a number or we just open with text
                         // Best effort: Just open api.whatsapp.com/send?text=...
                         const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
                         window.open(url, '_blank');
                         result = { result: `WhatsApp draft opened for message: ${message}` };
                     } else if (call.name === 'controlMedia') {
                         try {
                             const cmd = (call.args as any).command;
                             if (!youtubePlayerRef.current && cmd !== 'stop') {
                                 result = { error: "No video is currently playing." };
                             } else {
                                switch (cmd) {
                                    case 'pause': youtubePlayerRef.current?.pause(); break;
                                    case 'play': youtubePlayerRef.current?.play(); break;
                                    case 'stop': setCurrentVideo(null); break;
                                    case 'forward_10': youtubePlayerRef.current?.seekBy(10); break;
                                    case 'forward_60': youtubePlayerRef.current?.seekBy(60); break;
                                    case 'rewind_10': youtubePlayerRef.current?.seekBy(-10); break;
                                    case 'rewind_600': youtubePlayerRef.current?.seekBy(-600); break;
                                    case 'minimize': setIsPlayerMinimized(true); break;
                                    case 'maximize': setIsPlayerMinimized(false); break;
                                    default: result = { error: "Unknown command." };
                                }
                                result = { result: `Executed command: ${cmd}` };
                             }
                         } catch (e) {
                             result = { error: "Failed to control media." };
                         }
                     }
                     
                     responses.push({
                         id: call.id,
                         name: call.name,
                         response: result
                     });
                 }
                 
                 // Send tool response back to model
                 sessionPromise.then((sess: any) => {
                     sess.sendToolResponse({ functionResponses: responses });
                 });
             }
        },
        onclose: () => {
             console.log("Session Closed");
             setIsConnected(false);
             setStatus('idle');
        },
        onerror: (err) => {
             console.error("Session Error", err);
             setStatus('error');
             // Try to recover to idle state so user can reconnect
             setIsConnected(false);
        }
    };
    
    try {
        const voiceConfig = gender === 'female' ? femaleVoices : maleVoices;
        const voiceName = voiceConfig.main;
        
        // Pass all config to connection logic
        const session = await connectLiveSession(callbacks, {
            customInstructions, 
            coreProtocol, 
            voiceName, 
            apiKey: apiKeys.gemini,
            assistantName,
            userName,
            userBio,
            subscriptionPlan, // Pass subscription plan
            greetingMessage, // Pass the custom greeting
            emotionTuning, // Pass emotion tuning
            gender // Pass explicit gender
        });
        
        sessionRef.current = session;
        resolveSession(session);
    } catch (e) {
        console.error("Connection Failed", e);
        alert(e.message);
        setStatus('error');
        cleanupAudio();
        setIsConnected(false);
    }
  };

  const handleUpdateSession = () => {
      // Reconnect to apply new settings
      cleanupAudio();
      setIsConnected(false);
      setStatus('idle');
      setTimeout(() => connect(), 500);
  };

  return h('div', { className: `w-screen h-screen overflow-hidden flex flex-col items-center justify-center relative bg-black ${theme === 'light' ? 'bg-white text-black' : 'text-white'}` },
        // Background Effects
        h('div', { className: "absolute inset-0 z-0 pointer-events-none" },
            h('div', { className: "absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl animate-pulse" }),
            h('div', { className: "absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl animate-pulse", style: { animationDelay: '1s' } }),
            h('div', { className: "absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" })
        ),

        // Settings Button
        h('button', { 
            onClick: () => setIsSettingsOpen(true),
            className: "absolute top-6 right-6 z-40 p-3 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-cyan-500/50 group" 
        },
            h(SettingsIcon, { className: "w-6 h-6 text-gray-400 group-hover:text-cyan-400 transition-colors" })
        ),

        // Update Prompt (Visible when settings change during live session)
        isUpdateAvailable && h('div', { 
            className: "absolute top-24 z-40 animate-fade-in" 
        },
            h('button', {
                onClick: handleUpdateSession,
                className: "flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:bg-yellow-500/30 transition-all font-bold text-sm backdrop-blur-md"
            },
                h('svg', { className: "w-4 h-4 animate-spin", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" })),
                "System Update Available"
            )
        ),

        // Main Content Area
        h('div', { className: "z-10 flex flex-col items-center justify-center w-full h-full p-4 pb-32" },
            // Status Indicator
            h('div', { className: `mb-8 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest flex items-center gap-2 backdrop-blur-md transition-all duration-500 ${
                status === 'live' || status === 'speaking' || status === 'listening' 
                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
                : status === 'error'
                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                : 'bg-white/5 border-white/10 text-gray-500'
            }`},
                h('div', { className: `w-2 h-2 rounded-full ${
                    status === 'live' || status === 'speaking' ? 'bg-cyan-400 animate-pulse' : 
                    status === 'listening' ? 'bg-green-400 animate-pulse' :
                    status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                }`}),
                t(`main.status.${status}`)
            ),

            // Avatar
            h(Avatar, { 
                state: status, 
                mood: 'neutral',
                customUrl: avatarUrl
            }),

            // Assistant Name
            h('h1', { className: "mt-8 text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 tracking-tight" }, 
                assistantName
            )
        ),

        // Footer Controls
        h('div', { className: "fixed bottom-10 z-30 flex items-center gap-6" },
            h('button', {
                onClick: connect,
                disabled: status === 'error',
                className: `relative group px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 flex items-center gap-3 overflow-hidden shadow-2xl ${
                    isConnected 
                    ? 'bg-red-500/10 hover:bg-red-600/20 text-red-400 border border-red-500/50' 
                    : 'bg-white text-black hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]'
                }`
            },
                isConnected 
                ? h(DisconnectIcon, { className: "w-6 h-6" }) 
                : h(ConnectIcon, { className: "w-6 h-6" }),
                h('span', null, isConnected ? t('footer.disconnect') : t('footer.connect')),
                
                // Button Glow Effect
                !isConnected && h('div', { className: "absolute inset-0 rounded-full ring-2 ring-white/50 animate-ping opacity-20" })
            )
        ),

        // Components Overlay
        currentVideo && h(YouTubePlayer, { 
            ref: youtubePlayerRef,
            video: currentVideo, 
            onClose: () => setCurrentVideo(null),
            isMinimized: isPlayerMinimized 
        }),
        
        h(SettingsModal, {
            isOpen: isSettingsOpen,
            onClose: () => setIsSettingsOpen(false),
            activeTab, setActiveTab,
            theme, setTheme,
            gender, setGender,
            assistantName, setAssistantName,
            userName, setUserName,
            greetingMessage, setGreetingMessage,
            customInstructions, setCustomInstructions,
            coreProtocol, setCoreProtocol,
            userBio, setUserBio,
            emotionTuning, setEmotionTuning,
            apiKeys, setApiKeys,
            lang, setLang,
            femaleVoices, setFemaleVoices,
            maleVoices, setMaleVoices,
            ambientVolume, setAmbientVolume,
            connectionSound, setConnectionSound,
            avatarUrl, setAvatarUrl,
            subscriptionPlan, setSubscriptionPlan,
            usageData,
            user, handleLogin, handleLogout
        })
  );
};