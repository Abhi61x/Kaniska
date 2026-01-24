
import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Modality } from '@google/genai';
// FIX: Updated import path to point to the more complete service file in src/
import { 
    processUserCommand, 
    generateSpeech, 
    validateYouTubeKey, 
    validateAuddioKey, 
    createCashfreeOrder, 
    connectLiveSession,
    searchYouTube
} from './src/services/api.ts';
import { useTranslation, availableLanguages } from './i18n/index.tsx';
import { auth, db, googleProvider } from './firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const h: any = React.createElement;

// --- Icons ---
const SettingsIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "3" }), h('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
const ConnectIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" }), h('path', { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" }));
const DisconnectIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m18.07 11.93-1.34.54" }), h('path', { d: "m14.2 16.8-1.34.54" }), h('path', { d: "m11.93 6-1.34-.54" }), h('path', { d: "m7.2 10.2-1.34-.54" }), h('path', { d: "m16.8 9.8.54-1.34" }), h('path', { d: "m10.2 16.8.54-1.34" }), h('path', { d: "m6 11.93-.54-1.34" }), h('path', { d: "m9.8 7.2-.54-1.34" }), h('path', { d: "M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.13-6.84-9.48" }));
const PersonaIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "8", r: "5" }), h('path', { d: "M20 21a8 8 0 0 0-16 0" }));
const VoiceIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), h('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), h('line', { x1: "12", y1: "19", x2: "12", y2: "22" }));
const ApiKeysIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19.9 5a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4z" }), h('path', { d: "m4 6 2-2" }), h('path', { d: "m10.5 10.5 5 5" }), h('path', { d: "m8.5 8.5 2 2" }), h('path', { d: "m14.5 14.5 2 2" }), h('path', { d: "M7 21a4 4 0 0 0 4-4" }), h('path', { d: "M12 12v4a4 4 0 0 0 4 4h4" }));
const AboutIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "12", y1: "16", x2: "12", y2: "12" }), h('line', { x1: "12", y1: "8", x2: "12.01", y2: "8" }));
const HelpIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('path', { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const PlayIcon = ({className}: any) => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "round", className }, h('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), h('polyline', { points: "22 4 12 14.01 9 11.01" }));
const WarningIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), h('line', { x1: "12", y1: "9", x2: "12", y2: "13" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const SpinnerIcon = ({ className }: any) => h('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), h('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), h('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), h('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), h('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), h('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), h('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), h('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));
const XIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), h('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));
const ArrowLeftIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "19", y1: "12", x2: "5", y2: "12" }), h('polyline', { points: "12 19 5 12 12 5" }));
const UserIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), h('circle', { cx: "12", cy: "7", r: "4" }));
const AccountIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), h('circle', { cx: "8.5", cy: "7", r: "4" }), h('line', { x1: "20", y1: "8", x2: "20", y2: "14" }), h('line', { x1: "23", y1: "11", x2: "17", y2: "11" }));
const GoogleIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: "24", height: "24" }, h('path', { fill: "#4285F4", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), h('path', { fill: "#34A853", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), h('path', { fill: "#FBBC05", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), h('path', { fill: "#EA4335", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" }));
const SendIcon = ({ className }: any) => h('svg', { className, xmlns:"http://www.w3.org/2000/svg", width:"24", height:"24", viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" }, h('line',{ x1:"22", y1:"2", x2:"11", y2:"13" }), h('polygon', { points:"22 2 15 22 11 13 2 9 22 2" }));
const SunIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "5" }), h('line', { x1: "12", y1: "1", x2: "12", y2: "3" }), h('line', { x1: "12", y1: "21", x2: "12", y2: "23" }), h('line', { x1: "4.22", y1: "4.22", x2: "5.64", y2: "5.64" }), h('line', { x1: "18.36", y1: "18.36", x2: "19.78", y2: "19.78" }), h('line', { x1: "1", y1: "12", x2: "3", y2: "12" }), h('line', { x1: "21", y1: "12", x2: "23", y2: "12" }), h('line', { x1: "4.22", y1: "19.78", x2: "5.64", y2: "18.36" }), h('line', { x1: "18.36", y1: "5.64", x2: "19.78", y2: "4.22" }));
const MoonIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }));

const getInitialState = (key: string, defaultValue: any) => {
    try {
        const storedValue = localStorage.getItem(key);
        if (!storedValue) return defaultValue;
        const parsed = JSON.parse(storedValue);
        return parsed === null ? defaultValue : parsed;
    } catch (error) {
        return defaultValue;
    }
};

const usePersistentState = (key: string, defaultValue: any, user: any) => {
    const [state, setState] = useState(() => getInitialState(key, defaultValue));
    const timeoutRef = useRef<any>(null);
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        if (!user) return;
        const docRef = doc(db, "users", user.uid, "settings", key);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
             if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.value !== undefined) {
                    if (JSON.stringify(data.value) !== JSON.stringify(stateRef.current)) {
                        setState(data.value);
                        localStorage.setItem(key, JSON.stringify(data.value));
                    }
                }
             } else {
                 setDoc(docRef, { value: stateRef.current }, { merge: true }).catch(() => {});
             }
        }, (err) => {
            console.warn(`Firestore sync error for ${key}:`, err.message);
        });
        return () => unsubscribe();
    }, [user, key]);

    const setPersistentState = (newValue: any) => {
        setState((current: any) => {
            const valueToStore = newValue instanceof Function ? newValue(current) : newValue;
            try {
                localStorage.setItem(key, JSON.stringify(valueToStore));
            } catch (error) {}
            if (user) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    const docRef = doc(db, "users", user.uid, "settings", key);
                    setDoc(docRef, { value: valueToStore }, { merge: true }).catch(() => {});
                }, 1000);
            }
            return valueToStore;
        });
    };

    return [state, setPersistentState];
};

const DEFAULT_ASSISTANT_NAME_FEMALE = "Kaniska";
const DEFAULT_FEMALE_GREETING = "Greetings. I am Kaniska. Ready to assist.";
const DEFAULT_CUSTOM_INSTRUCTIONS = `You are a sophisticated AI assistant. Respond helpfully and concisely.`;

const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
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
};

const Avatar = React.memo(({ state, mood = 'neutral', customUrl }: any) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerMove = (e: React.PointerEvent) => {
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

    let stateClass = 'avatar-state-idle';
    if (state === 'speaking' || state === 'live') stateClass = 'avatar-state-speaking';
    if (state === 'listening') stateClass = 'avatar-state-listening';
    if (state === 'thinking' || state === 'processing' || state === 'recognizing') stateClass = 'avatar-state-thinking';

    const imageUrl = customUrl || "https://i.gifer.com/NTHO.gif";

    return h('div', { 
            className: `avatar-wrap ${stateClass}`,
            ref: wrapRef,
            onPointerMove: handlePointerMove,
            onPointerLeave: handlePointerLeave
        },
        h('div', { className: "avatar-container relative flex flex-col items-center justify-center", ref: containerRef },
            h('img', { 
                src: imageUrl, 
                alt: "Avatar", 
                className: "avatar-image z-10",
                onError: (e: any) => { e.currentTarget.src = "https://i.gifer.com/NTHO.gif"; }
            }),
            h('div', { className: "absolute -bottom-12 w-32 h-8 bg-cyan-500/20 blur-xl rounded-[100%] animate-pulse z-0" }),
            h('div', { className: "holo-overlay" }),
            h('div', { className: "holo-scanline" }),
            h('div', { className: "thinking-ring" }),
            h('div', { className: "speaking-ring" }),
            h('div', { className: "speaking-ring delay-ring" })
        )
    );
});

const SettingsModal = ({ 
    isOpen, onClose, activeTab, setActiveTab, 
    theme, setTheme, gender, setGender, 
    assistantName, setAssistantName,
    userName, setUserName,
    greetingMessage, setGreetingMessage, 
    customInstructions, setCustomInstructions, 
    apiKeys, setApiKeys, 
    femaleVoices, setFemaleVoices, 
    maleVoices, setMaleVoices, 
    avatarUrl, setAvatarUrl,
    user, handleLogin, handleLogout
}: any) => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);

    if (!isOpen) return null;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'account':
                return h('div', { className: "space-y-6 animate-fade-in" },
                     h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10 text-center" },
                        user ? h('div', null,
                            h('div', { className: "w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-cyan-500" }, user.photoURL ? h('img', { src: user.photoURL, alt: "User", className: "w-full h-full object-cover" }) : h('div', { className: "w-full h-full flex items-center justify-center text-2xl font-bold" }, user.displayName?.[0] || "U")),
                            h('h3', { className: "text-xl font-bold text-white mb-1" }, user.displayName || "User"),
                            h('button', { onClick: handleLogout, className: "px-6 py-2 bg-red-600/20 text-red-400 border border-red-600/50 rounded-lg transition-all" }, "Sign Out")
                        ) : h('button', { onClick: handleLogin, className: "px-6 py-3 bg-white text-black rounded-lg font-bold flex items-center gap-3 mx-auto" }, h(GoogleIcon, { className: "w-5 h-5" }), "Sign in with Google")
                     )
                );
            case 'appearance':
                return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10" },
                        h('div', { className: "flex items-center gap-3 mb-6" },
                            h('div', { className: "p-2 bg-cyan-900/30 rounded-lg" }, h(SunIcon, { className: "w-6 h-6 text-cyan-400" })),
                            h('div', null, h('h3', { className: "font-semibold text-lg text-cyan-400" }, t('settings.personaTab.appearance.title')), h('p', { className: "text-xs text-gray-300" }, t('settings.personaTab.appearance.description')))
                        ),
                        h('div', { className: "grid grid-cols-2 gap-4" },
                            h('button', { 
                                onClick: () => setTheme('light'),
                                className: `p-6 rounded-xl border flex flex-col items-center gap-4 transition-all ${theme === 'light' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 ring-1 ring-cyan-500/30' : 'bg-black/40 border-gray-700 text-gray-400 hover:border-gray-500'}`
                            }, h(SunIcon, { className: "w-10 h-10" }), h('span', { className: "font-bold text-sm" }, t('settings.personaTab.appearance.light'))),
                            h('button', { 
                                onClick: () => setTheme('dark'),
                                className: `p-6 rounded-xl border flex flex-col items-center gap-4 transition-all ${theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 ring-1 ring-cyan-500/30' : 'bg-black/40 border-gray-700 text-gray-400 hover:border-gray-500'}`
                            }, h(MoonIcon, { className: "w-10 h-10" }), h('span', { className: "font-bold text-sm" }, t('settings.personaTab.appearance.dark')))
                        )
                    )
                );
            case 'persona':
                return h('div', { className: "space-y-4 animate-fade-in pb-10" },
                    h('div', { className: "p-4 bg-black/40 rounded-lg border border-white/5" },
                        h('div', null, h('label', { className: "text-[10px] text-gray-400 uppercase mb-1 block" }, "Assistant Name"), h('input', { type: "text", className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none", value: assistantName, onChange: (e: any) => setAssistantName(e.target.value) })),
                        h('div', { className: "mt-4" }, h('label', { className: "text-[10px] text-gray-400 uppercase mb-1 block" }, "Avatar URL"), h('input', { type: "text", className: "w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs outline-none", value: avatarUrl, onChange: (e: any) => setAvatarUrl(e.target.value) }))
                    )
                );
            case 'apiKeys':
                return h('div', { className: "space-y-4 animate-fade-in" },
                     h('div', null, h('label', { className: "text-xs text-gray-400" }, "YouTube API Key"), h('input', { type: "password", className: "w-full bg-black border border-gray-700 rounded px-3 py-2 text-white", value: apiKeys.youtube, onChange: (e: any) => setApiKeys({...apiKeys, youtube: e.target.value}) }))
                );
            default: return h('div', { className: "p-10 text-center text-gray-500" }, "Coming soon...");
        }
    };

    return h('div', { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm", onClick: onClose },
        h('div', { className: "bg-black md:bg-gray-900 w-full h-full md:w-[90vw] md:h-[85vh] md:max-w-5xl md:rounded-2xl shadow-2xl border border-white/10 flex flex-col md:flex-row overflow-hidden animate-panel-enter", onClick: (e: any) => e.stopPropagation() },
            h('div', { className: `${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 bg-black md:bg-black/20 border-r border-white/10` },
                h('div', { className: "p-6" }, h('h2', { className: "text-xl font-bold text-cyan-400" }, t('settings.title'))),
                h('div', { className: "flex-1 p-4 space-y-1" },
                    [
                        { id: 'account', icon: AccountIcon, label: t('settings.tabs.account') },
                        { id: 'appearance', icon: SunIcon, label: t('settings.tabs.appearance') },
                        { id: 'persona', icon: PersonaIcon, label: t('settings.tabs.persona') },
                        { id: 'voice', icon: VoiceIcon, label: t('settings.tabs.voice') },
                        { id: 'apiKeys', icon: ApiKeysIcon, label: t('settings.tabs.apiKeys') }
                    ].map(tab => h('button', { key: tab.id, onClick: () => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }, className: `w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 ${activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-400 hover:bg-white/5'}` }, tab.icon && h(tab.icon, { className: "w-5 h-5" }), tab.label))
                )
            ),
            h('div', { className: `${!isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full bg-black md:bg-panel-bg relative` },
                h('div', { className: "md:hidden flex items-center p-4 border-b border-white/10" }, h('button', { onClick: () => setIsMobileMenuOpen(true), className: "text-gray-400 flex items-center gap-2" }, h(ArrowLeftIcon, { className: "w-5 h-5" }), h('span', null, "Back"))),
                h('button', { onClick: onClose, className: "hidden md:block absolute top-4 right-4 text-gray-500 hover:text-white" }, h(XIcon, { className: "w-6 h-6" })),
                h('div', { className: "flex-1 overflow-y-auto p-4 md:p-8" }, renderTabContent())
            )
        )
    );
};

export const App = () => {
    const { t, lang, setLang } = useTranslation();
    const [user, setUser] = useState<any>(null);

    const [theme, setTheme] = usePersistentState('kaniska-theme', 'dark', user);
    const [gender, setGender] = usePersistentState('kaniska-gender', 'female', user);
    const [assistantName, setAssistantName] = usePersistentState('kaniska-name', DEFAULT_ASSISTANT_NAME_FEMALE, user);
    const [userName, setUserName] = usePersistentState('kaniska-user-name', 'User', user);
    const [greetingMessage, setGreetingMessage] = usePersistentState('kaniska-greeting', DEFAULT_FEMALE_GREETING, user);
    const [customInstructions, setCustomInstructions] = usePersistentState('kaniska-instructions', DEFAULT_CUSTOM_INSTRUCTIONS, user);
    // REMOVED: Gemini API Key from persistent state as it must come from process.env.API_KEY exclusively.
    const [apiKeys, setApiKeys] = usePersistentState('kaniska-keys', { weather: '', news: '', youtube: '', auddio: '' }, user);
    const [femaleVoices, setFemaleVoices] = usePersistentState('kaniska-voices-female', { main: 'Kore', greeting: 'Kore' }, user);
    const [maleVoices, setMaleVoices] = usePersistentState('kaniska-voices-male', { main: 'Fenrir', greeting: 'Fenrir' }, user);
    const [avatarUrl, setAvatarUrl] = usePersistentState('kaniska-avatar', '', user);

    const [isConnected, setIsConnected] = useState(false);
    const [status, setStatus] = useState('idle');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('account');

    const sessionRef = useRef<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error("Login failed", e); } };
    const handleLogout = async () => { await signOut(auth); };

    const handleConnect = async () => {
        if (isConnected) { sessionRef.current?.close(); setIsConnected(false); setStatus('idle'); return; }
        setStatus('connecting');
        try {
            const session = await connectLiveSession({
                onopen: () => { setIsConnected(true); setStatus('live'); },
                onmessage: (msg: any) => {
                    if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                        setStatus('speaking');
                    }
                },
                onclose: () => { setIsConnected(false); setStatus('idle'); },
                onerror: () => { setStatus('error'); setIsConnected(false); }
            }, {
                customInstructions, voiceName: gender === 'female' ? femaleVoices.main : maleVoices.main,
                // REMOVED: apiKey passing as connectLiveSession will use process.env.API_KEY directly.
                assistantName, userName, greetingMessage
            });
            sessionRef.current = session;
        } catch (e) { setStatus('error'); }
    };

    return h('div', { className: `fixed inset-0 flex flex-col items-center justify-center transition-colors duration-500 ${theme === 'dark' ? 'bg-black text-white' : 'bg-gray-100 text-black'}` },
        h('button', { onClick: () => setIsSettingsOpen(true), className: `absolute top-6 right-6 p-3 rounded-full z-40 ${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-black/5 text-black'}` }, h(SettingsIcon, { className: "w-6 h-6" })),
        h('div', { className: "z-10 flex flex-col items-center" },
            h('div', { className: `mb-8 px-4 py-1.5 rounded-full border text-xs font-bold uppercase flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-black/10'}` }, h('div', { className: `w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-400' : 'bg-gray-500'}` }), t(`main.status.${status}`)),
            h(Avatar, { state: status, customUrl: avatarUrl }),
            h('h1', { className: "mt-8 text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400" }, assistantName)
        ),
        h('div', { className: "fixed bottom-10 z-30" },
            h('button', { onClick: handleConnect, className: `px-8 py-4 rounded-full font-bold flex items-center gap-3 shadow-xl transition-all ${isConnected ? 'bg-red-500/10 text-red-400 border border-red-500' : 'bg-cyan-500 text-white hover:scale-105'}` }, isConnected ? h(DisconnectIcon, { className: "w-6 h-6" }) : h(ConnectIcon, { className: "w-6 h-6" }), isConnected ? "DISCONNECT" : "CONNECT")
        ),
        h(SettingsModal, {
            isOpen: isSettingsOpen, onClose: () => setIsSettingsOpen(false), activeTab, setActiveTab,
            theme, setTheme, gender, setGender, assistantName, setAssistantName, userName, setUserName, greetingMessage, setGreetingMessage, customInstructions, setCustomInstructions, apiKeys, setApiKeys, lang, setLang, femaleVoices, setFemaleVoices, maleVoices, setMaleVoices, avatarUrl, setAvatarUrl, user, handleLogin, handleLogout
        })
    );
};
