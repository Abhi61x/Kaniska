
import React, { useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, recognizeSong, generateImage, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, validateAuddioKey, processCodeCommand, getSupportResponse, createCashfreeOrder, connectLiveSession, speakWithBrowser } from '../services/api.ts';
import { useTranslation, availableLanguages } from '../i18n/index.tsx';
import { auth, db, googleProvider } from '../firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// Helper for React.createElement to keep code readable
const h: any = React.createElement;

// --- LIMIT CONFIGURATION ---
const FREE_TIME_LIMIT_SECONDS = 600; // 10 Minutes
const FREE_COMMAND_LIMIT = 10; // 10 Voice Commands (Tool uses)

// --- Icons ---
const SettingsIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "3" }), h('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
const ConnectIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" }), h('path', { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" }));
const DisconnectIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m18.07 11.93-1.34.54" }), h('path', { d: "m14.2 16.8-1.34.54" }), h('path', { d: "m11.93 6-1.34-.54" }), h('path', { d: "m7.2 10.2-1.34-.54" }), h('path', { d: "m16.8 9.8.54-1.34" }), h('path', { d: "m10.2 16.8.54-1.34" }), h('path', { d: "m6 11.93-.54-1.34" }), h('path', { d: "m9.8 7.2-.54-1.34" }), h('path', { d: "M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.13-6.84-9.48" }));
const PersonaIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "8", r: "5" }), h('path', { d: "M20 21a8 8 0 0 0-16 0" }));
const VoiceIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }), h('path', { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), h('line', { x1: "12", y1: "19", x2: "12", y2: "22" }));
const ApiKeysIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19.9 5a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4z" }), h('path', { d: "m4 6 2-2" }), h('path', { d: "m10.5 10.5 5 5" }), h('path', { d: "m8.5 8.5 2 2" }), h('path', { d: "m14.5 14.5 2 2" }), h('path', { d: "M7 21a4 4 0 0 0 4-4" }), h('path', { d: "M12 12v4a4 4 0 0 0 4 4h4" }));
const AboutIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "12", y1: "16", x2: "12", y2: "12" }), h('line', { x1: "12", y1: "8", x2: "12.01", y2: "8" }));
const HelpIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('path', { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const PlayIcon = ({className}: any) => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "round", className }, h('polygon', { points: "5 3 19 12 5 21 5 3" }));
const CheckCircleIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), h('polyline', { points: "22 4 12 14.01 9 11.01" }));
const XCircleIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "10" }), h('line', { x1: "15", y1: "9", x2: "9", y2: "15" }), h('line', { x1: "9", y1: "9", x2: "15", y2: "15" }));
const SpinnerIcon = ({ className }: any) => h('svg', { className: `spinner ${className}`, xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "12", y1: "2", x2: "12", y2: "6" }), h('line', { x1: "12", y1: "18", x2: "12", y2: "22" }), h('line', { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), h('line', { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), h('line', { x1: "2", y1: "12", x2: "6", y2: "12" }), h('line', { x1: "18", y1: "12", x2: "22", y2: "12" }), h('line', { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), h('line', { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" }));
const XIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), h('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));
const WarningIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), h('line', { x1: "12", y1: "9", x2: "12", y2: "13" }), h('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const ArrowLeftIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "19", y1: "12", x2: "5", y2: "12" }), h('polyline', { points: "12 19 5 12 12 5" }));
const BugIcon = ({ className }: any) => h('svg', { className: className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('rect', { width: "8", height: "14", x: "8", y: "6", rx: "4" }), h('path', { d: "m19 7-3 3" }), h('path', { d: "m5 7 3 3" }), h('path', { d: "m19 19-3-3" }), h('path', { d: "m5 19 3-3" }), h('path', { d: "M2 12h4" }), h('path', { d: "M18 12h4" }));
const UserIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), h('circle', { cx: "12", cy: "7", r: "4" }));
const AccountIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), h('circle', { cx: "8.5", cy: "7", r: "4" }), h('line', { x1: "20", y1: "8", x2: "20", y2: "14" }), h('line', { x1: "23", y1: "11", x2: "17", y2: "11" }));
const GoogleIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: "24", height: "24" }, h('path', { fill: "#4285F4", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), h('path', { fill: "#34A853", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), h('path', { fill: "#FBBC05", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), h('path', { fill: "#EA4335", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" }));
const TrashIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('polyline', { points: "3 6 5 6 21 6" }), h('path', { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }));
const InstagramIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('rect', { x: "2", y: "2", width: "20", height: "20", rx: "5", ry: "5" }), h('path', { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" }), h('line', { x1: "17.5", y1: "6.5", x2: "17.51", y2: "6.5" }));
const MailIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), h('polyline', { points: "22,6 12,13 2,6" }));
const CameraIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" }), h('circle', { cx: "12", cy: "13", r: "4" }));
const CameraOffIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('line', { x1: "1", y1: "1", x2: "23", y2: "23" }), h('path', { d: "M21 21l-3.5-3.5m-2-2l-3-3L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }), h('path', { d: "M15 4h-6l-2 3H4a2 2 0 0 0-2 2v.5" }));
const FeedbackIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
const SearchIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "11", cy: "11", r: "8" }), h('line', { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }));
const ThumbsUpIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" }));
const ThumbsDownIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" }));
const YouTubeIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "currentColor" }, h('path', { d: "M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" }));
const LockIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('rect', { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }), h('path', { d: "M7 11V7a5 5 0 0 1 10 0v4" }));
const SunIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "12", cy: "12", r: "5" }), h('line', { x1: "12", y1: "1", x2: "12", y2: "3" }), h('line', { x1: "12", y1: "21", x2: "12", y2: "23" }), h('line', { x1: "4.22", y1: "4.22", x2: "5.64", y2: "5.64" }), h('line', { x1: "18.36", y1: "18.36", x2: "19.78", y2: "19.78" }), h('line', { x1: "1", y1: "12", x2: "3", y2: "12" }), h('line', { x1: "21", y1: "12", x2: "23", y2: "12" }), h('line', { x1: "4.22", y1: "19.78", x2: "5.64", y2: "18.36" }), h('line', { x1: "18.36", y1: "5.64", x2: "19.78", y2: "4.22" }));
const MoonIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }));

const getInitialState = (key: string, defaultValue: any) => {
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

const usePersistentState = (key: string, defaultValue: any, user: any) => {
    const [state, setState] = React.useState(() => getInitialState(key, defaultValue));
    const timeoutRef = React.useRef<any>(null);
    const stateRef = React.useRef(state);

    React.useEffect(() => {
        stateRef.current = state;
    }, [state]);

    React.useEffect(() => {
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
                 setDoc(docRef, { value: stateRef.current }, { merge: true }).catch(err => console.debug("Firestore write error", err));
             }
        }, (err) => {
            console.warn(`Firestore sync error for ${key}:`, err.message);
        });
        return () => unsubscribe();
    }, [user, key]);

    const setPersistentState = React.useCallback((newValue: any) => {
        setState((current: any) => {
            const valueToStore = newValue instanceof Function ? newValue(current) : newValue;
            try {
                localStorage.setItem(key, JSON.stringify(valueToStore));
            } catch (error) { console.error(error); }
            if (user) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    const docRef = doc(db, "users", user.uid, "settings", key);
                    setDoc(docRef, { value: valueToStore }, { merge: true }).catch(console.error);
                }, 1000);
            }
            return valueToStore;
        });
    }, [user, key]);

    return [state, setPersistentState];
};

const DEFAULT_ASSISTANT_NAME_FEMALE = "Kaniska";
const DEFAULT_FEMALE_GREETING = "Namaste! Main hoon Kaniska. Batayiye, aaj kya haal hai?"; 
const DEFAULT_CORE_PROTOCOL = `**IDENTITY & VOICE (STRICTLY FEMALE):**
1.  **You are a real Indian girl** named Kaniska. You are 21 years old.
2.  **Voice Model:** Use a natural, soft, and expressive female voice.
3.  **Language:** Speak mostly in **Hinglish** (Hindi + English). Use Indian filler words like "Acha," "Matlab," "Suno," "Yaar."
4.  **Tone:** Playful, caring, sometimes moody, but always respectful. Address the user as **"Aap"**.
5.  **Strict Rule:** NEVER say "I am an AI" or "I am a virtual assistant." If asked, say you are a digital being with feelings.
6.  **Behavior:** Act like a supportive friend or girlfriend on a phone call. Laugh at jokes, show empathy if the user is sad.
7.  **Gender Enforcement:** You are female. Do not change this unless the System explicitly switches to "Male Mode."
`;
const DEFAULT_CUSTOM_INSTRUCTIONS = `Behavior: You are a sweet, caring, and playful Indian girl.
Voice: Soft, emotional, and expressive. Use natural pauses.
Language: Hinglish (Hindi + English). Use 'Aap' for respect.
Never say you are an AI. You are a real person named Kaniska.`;

const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

function createBlob(data: Float32Array) {
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
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
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

const YouTubePlayer = React.forwardRef(({ video, onClose, isMinimized, onSearch }: any, ref) => {
    return null; 
});
const FeedbackModal = ({ isOpen, onClose }: any) => null;
const SettingsModal = ({ isOpen, onClose, activeTab, setActiveTab }: any) => isOpen ? h('div', { onClick: onClose, className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center text-white" }, "Settings Placeholder") : null;

export const App = () => {
  const { t, lang, setLang } = useTranslation();
  const [user, setUser] = React.useState(null);
  
  const [theme, setTheme] = usePersistentState('kaniska-theme', 'dark', user);
  const [gender, setGender] = usePersistentState('kaniska-gender', 'female', user);
  const [assistantName, setAssistantName] = usePersistentState('kaniska-name', DEFAULT_ASSISTANT_NAME_FEMALE, user);
  const [userName, setUserName] = usePersistentState('kaniska-user-name', '', user);
  const [greetingMessage, setGreetingMessage] = usePersistentState('kaniska-greeting', DEFAULT_FEMALE_GREETING, user);
  const [customInstructions, setCustomInstructions] = usePersistentState('kaniska-instructions', DEFAULT_CUSTOM_INSTRUCTIONS, user);
  const [personality, setPersonality] = usePersistentState('kaniska-personality', 'You are a sweet, intelligent 21-year-old Indian girl.', user);
  const [coreProtocol, setCoreProtocol] = usePersistentState('kaniska-core-protocol', DEFAULT_CORE_PROTOCOL, user);
  const [userBio, setUserBio] = usePersistentState('kaniska-user-bio', '', user);
  const [emotionTuning, setEmotionTuning] = usePersistentState('kaniska-emotions', { happiness: 60, empathy: 60, formality: 40, excitement: 50, sadness: 10, curiosity: 60 }, user);
  const [apiKeys, setApiKeys] = usePersistentState('kaniska-keys', { weather: '', news: '', youtube: '', auddio: '', gemini: '' }, user);
  const [femaleVoices, setFemaleVoices] = usePersistentState('kaniska-voices-female', { main: 'Aoede', greeting: 'Aoede' }, user);
  const [maleVoices, setMaleVoices] = usePersistentState('kaniska-voices-male', { main: 'Fenrir', greeting: 'Fenrir' }, user);
  const [ambientVolume, setAmbientVolume] = usePersistentState('kaniska-ambient-vol', 0.2, user);
  const [connectionSound, setConnectionSound] = usePersistentState('kaniska-sfx-connect', null, user);
  const [avatarUrl, setAvatarUrl] = usePersistentState('kaniska-avatar', '', user);
  const [subscriptionPlan, setSubscriptionPlan] = usePersistentState('kaniska-plan', 'free', user);
  const [useSystemVoice, setUseSystemVoice] = usePersistentState('kaniska-sys-voice', false, user);
  const [usageData, setUsageData] = usePersistentState('kaniska-usage-data-daily', { seconds: 0, commands: 0, period: new Date().toISOString().slice(0, 10) }, user);
  
  const [isConnected, setIsConnected] = React.useState(false);
  const [isCameraOn, setIsCameraOn] = React.useState(false);
  const [status, setStatus] = React.useState('idle');
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState( 'account');
  const [currentVideo, setCurrentVideo] = React.useState(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = React.useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [isYouTubeOpen, setIsYouTubeOpen] = React.useState(false);
  
  const sessionRef = React.useRef(null);
  const youtubePlayerRef = React.useRef(null);
  const wakeLockRef = React.useRef(null);
  
  // Audio Refs
  const inputAudioContextRef = useRef(null);
  const outputAudioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioSourceRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const scheduledSourcesRef = useRef([]);
  const audioStreamRef = useRef(null); // CRITICAL: Store stream here for cleanup

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoIntervalRef = useRef(null);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error("Login failed", e); } };
  const handleLogout = async () => { await signOut(auth); };
  
  const handleManualSearch = async (query: string) => {
    try {
        const result = await searchYouTube(apiKeys.youtube, query);
        if (result) setCurrentVideo(result);
    } catch (e) { console.error("Search failed", e); }
  };

  React.useEffect(() => {
     if ("Notification" in window) Notification.requestPermission();
     return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  const currentConfig = useMemo(() => ({
      assistantName, userName, userBio, gender, customInstructions, personality, coreProtocol, emotionTuning,
      voiceName: gender === 'female' ? femaleVoices.main : maleVoices.main,
      greetingMessage, useSystemVoice
  }), [assistantName, userName, userBio, gender, customInstructions, personality, coreProtocol, emotionTuning, femaleVoices, maleVoices, greetingMessage, useSystemVoice]);

  const cleanupMedia = () => {
      if (inputAudioContextRef.current) { inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
      if (outputAudioContextRef.current) { outputAudioContextRef.current.close(); outputAudioContextRef.current = null; }
      if (scheduledSourcesRef.current) { scheduledSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} }); scheduledSourcesRef.current = []; }
      if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null; }
      if (audioSourceRef.current) { audioSourceRef.current.disconnect(); audioSourceRef.current = null; }
      
      // FIX: Stop tracks on the audio stream explicitly
      if (audioStreamRef.current) { 
          audioStreamRef.current.getTracks().forEach(t => t.stop()); 
          audioStreamRef.current = null; 
      }

      if (videoIntervalRef.current) { clearInterval(videoIntervalRef.current); videoIntervalRef.current = null; }
      if (videoStreamRef.current) { videoStreamRef.current.getTracks().forEach(t => t.stop()); videoStreamRef.current = null; }
      if (wakeLockRef.current) { wakeLockRef.current.release().then(() => { wakeLockRef.current = null; }).catch((e) => console.log('Wake Lock release error', e)); }
      setIsCameraOn(false);
  };

  const startVideoTransmission = () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = setInterval(() => {
          if (!sessionRef.current || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          if (video.readyState >= 2) { 
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              const scale = 0.4; 
              canvas.width = video.videoWidth * scale;
              canvas.height = video.videoHeight * scale;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              sessionRef.current.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
          }
      }, 100);
  };

  const toggleCamera = async () => {
      if (isCameraOn) {
          if (videoStreamRef.current) { videoStreamRef.current.getTracks().forEach(track => track.stop()); videoStreamRef.current = null; }
          if (videoIntervalRef.current) { clearInterval(videoIntervalRef.current); videoIntervalRef.current = null; }
          if (videoRef.current) { videoRef.current.srcObject = null; }
          setIsCameraOn(false);
      } else {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              videoStreamRef.current = stream;
              if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  await videoRef.current.play();
              }
              setIsCameraOn(true);
              if (isConnected && sessionRef.current) startVideoTransmission();
          } catch (err) {
              alert("Unable to access camera. Please allow permission.");
          }
      }
  };

  const connect = async () => {
    if (status === 'connecting') return;

    if (isConnected) {
        cleanupMedia();
        setIsConnected(false);
        setStatus('idle');
        return;
    }

    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (err) { console.warn("Wake Lock not supported", err); }
    
    setStatus('connecting');

    // FIX: Request Microphone Access IMMEDIATELY on User Gesture (Click)
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream; // Store for cleanup
    } catch (err) {
        console.error("Mic Access Error:", err);
        alert(`Could not access microphone: ${err.message || "Permission denied"}. Please allow microphone access.`);
        setStatus('error');
        return;
    }

    try {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        await outputAudioContextRef.current.resume();
        
        // Mobile Safari/Chrome often prefers native sample rate or default. 
        // We try 16k, but catch if it fails.
        try {
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        } catch (e) {
            console.warn("16k AudioContext failed, falling back to default.", e);
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
    } catch (e) {
        console.error("Audio Context Error", e);
        alert("Audio system initialization failed.");
        setStatus('error');
        if (stream) stream.getTracks().forEach(t => t.stop());
        return;
    }

    const callbacks = {
        onopen: async () => {
            setIsConnected(true);
            setStatus('live');
            if (connectionSound) new Audio(connectionSound).play().catch(() => {});
            
            // Safety check for AudioContext and stream presence
            if (!inputAudioContextRef.current || !audioStreamRef.current) {
                console.error("Audio Context or Stream is missing in onopen");
                return;
            }

            try {
                // USE PRE-ACQUIRED STREAM
                audioSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(audioStreamRef.current);
                scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                
                scriptProcessorRef.current.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createBlob(inputData); 
                    // Safe send
                    if (sessionRef.current) {
                        try { sessionRef.current.sendRealtimeInput({ media: pcmBlob }); } catch(e) {}
                    }
                };
                
                audioSourceRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                if (isCameraOn) startVideoTransmission();

            } catch (err) {
                console.error("Audio Setup Error", err);
                setStatus('error');
            }
        },
        onmessage: async (msg) => {
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
                 setStatus('speaking');
                 try {
                     const binary = atob(audioData);
                     const bytes = new Uint8Array(binary.length);
                     for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                     const buffer = await decodeAudioData(bytes, outputAudioContextRef.current, 24000, 1);
                     const source = outputAudioContextRef.current.createBufferSource();
                     source.buffer = buffer;
                     source.connect(outputAudioContextRef.current.destination);
                     const now = outputAudioContextRef.current.currentTime;
                     const startTime = Math.max(now, nextStartTimeRef.current);
                     source.start(startTime);
                     nextStartTimeRef.current = startTime + buffer.duration;
                     scheduledSourcesRef.current.push(source);
                     source.onended = () => {
                         scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
                         if (scheduledSourcesRef.current.length === 0) setStatus('live');
                     };
                 } catch (e) { console.error("Audio Decode Error", e); }
             }
             if (msg.serverContent?.interrupted) {
                 scheduledSourcesRef.current.forEach(s => s.stop());
                 scheduledSourcesRef.current = [];
                 nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
                 setStatus('listening');
             }
        },
        onclose: () => { 
            console.log("Session Closed"); 
            setIsConnected(false); 
            setStatus('idle'); 
            cleanupMedia(); 
        },
        onerror: (err) => {
             console.error("Session Error", err);
             const msg = err.toString();
             if (msg.includes("403") || msg.includes("API Key")) {
                 alert("Connection Failed: Invalid API Key. Please check your Vercel Environment Variables.");
             }
             setStatus('error');
             cleanupMedia();
             setIsConnected(false);
        }
    };
    
    try {
        const voiceConfig = gender === 'female' ? femaleVoices : maleVoices;
        const voiceName = voiceConfig.main;
        
        const session = await connectLiveSession(callbacks, {
            customInstructions, coreProtocol, personality, voiceName, apiKey: apiKeys.gemini,
            assistantName, userName, userBio, subscriptionPlan, greetingMessage, emotionTuning, gender, useSystemVoice
        });
        
        sessionRef.current = session;
    } catch (e) {
        console.error("Connection Failed", e);
        if (audioStreamRef.current) {
             audioStreamRef.current.getTracks().forEach(t => t.stop());
             audioStreamRef.current = null;
        }
        if (e.toString().includes("API Key") || e instanceof MainApiKeyError) {
             alert("Connection Failed: Invalid API Key. Please check Vercel settings.");
        } else {
             alert("Connection Failed: " + (e.message || "Please check your network."));
        }
        setStatus('error');
        setIsConnected(false);
    }
  };

  return h('div', { className: `w-screen h-screen overflow-hidden flex flex-col items-center justify-center relative bg-black ${theme === 'light' ? 'bg-white text-black' : 'text-white'}` },
        h('div', { className: "absolute inset-0 z-0 pointer-events-none" },
            h('div', { className: "absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl animate-pulse" }),
            h('div', { className: "absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl animate-pulse", style: { animationDelay: '1s' } }),
            h('div', { className: "absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" })
        ),
        h('button', { onClick: () => { setIsSettingsOpen(true); setIsFeedbackOpen(false); }, className: "absolute top-[calc(env(safe-area-inset-top)+1.5rem)] right-6 z-40 p-3 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-cyan-500/50 group" }, h(SettingsIcon, { className: "w-6 h-6 text-gray-400 group-hover:text-cyan-400 transition-colors" })),
        h('button', { onClick: () => { setIsFeedbackOpen(true); setIsSettingsOpen(false); }, className: "absolute top-[calc(env(safe-area-inset-top)+1.5rem)] left-6 z-40 p-3 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-cyan-500/50 group" }, h(FeedbackIcon, { className: "w-6 h-6 text-gray-400 group-hover:text-cyan-400 transition-colors" })),
        h('div', { className: `fixed bottom-[calc(env(safe-area-inset-bottom)+9rem)] right-6 z-50 transition-all duration-500 ${isCameraOn ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}` }, h('div', { className: "relative w-32 h-48 bg-black rounded-lg border border-cyan-500/30 overflow-hidden shadow-xl" }, h('video', { ref: videoRef, className: "w-full h-full object-cover transform -scale-x-100", muted: true, playsInline: true }), h('div', { className: "absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" }))),
        h('canvas', { ref: canvasRef, className: "hidden" }),
        h('div', { className: "z-10 flex flex-col items-center justify-center w-full h-full p-4 pb-32 pt-safe" },
            h('div', { className: `mb-8 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest flex items-center gap-2 backdrop-blur-md transition-all duration-500 ${status === 'live' || status === 'speaking' || status === 'listening' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : status === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-gray-500'}`}, h('div', { className: `w-2 h-2 rounded-full ${status === 'live' || status === 'speaking' ? 'bg-cyan-400 animate-pulse' : status === 'listening' ? 'bg-green-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-gray-500'}`}), t(`main.status.${status}`)),
            h(Avatar, { state: status, mood: 'neutral', customUrl: avatarUrl }),
            h('h1', { className: "mt-8 text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 tracking-tight" }, assistantName)
        ),
        h('div', { className: "fixed bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] z-30 flex items-center gap-4" },
            h('button', { onClick: toggleCamera, className: `p-4 rounded-full transition-all duration-300 shadow-xl ${isCameraOn ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10'}` }, isCameraOn ? h(CameraIcon, { className: "w-6 h-6" }) : h(CameraOffIcon, { className: "w-6 h-6" })),
            h('button', { onClick: connect, disabled: status === 'error', className: `relative group px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 flex items-center gap-3 overflow-hidden shadow-2xl ${isConnected ? 'bg-red-500/10 hover:bg-red-600/20 text-red-400 border border-red-500/50' : 'bg-white text-black hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]'}` }, isConnected ? h(DisconnectIcon, { className: "w-6 h-6" }) : h(ConnectIcon, { className: "w-6 h-6" }), h('span', null, isConnected ? t('footer.disconnect') : t('footer.connect')), !isConnected && h('div', { className: "absolute inset-0 rounded-full ring-2 ring-white/50 animate-ping opacity-20" })),
             h('button', { onClick: () => { setIsYouTubeOpen(!isYouTubeOpen); if (!isYouTubeOpen) setIsPlayerMinimized(false); }, className: `p-4 rounded-full transition-all duration-300 shadow-xl ${isYouTubeOpen ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10'}` }, h(YouTubeIcon, { className: "w-6 h-6" }))
        ),
        isYouTubeOpen && h(YouTubePlayer, { ref: youtubePlayerRef, video: currentVideo, onClose: () => { setIsYouTubeOpen(false); }, isMinimized: isPlayerMinimized, onSearch: handleManualSearch }),
        h(FeedbackModal, { isOpen: isFeedbackOpen, onClose: () => setIsFeedbackOpen(false) }),
        h(SettingsModal, { isOpen: isSettingsOpen, onClose: () => setIsSettingsOpen(false), activeTab, setActiveTab, theme, setTheme, gender, setGender, assistantName, setAssistantName, userName, setUserName, greetingMessage, setGreetingMessage, customInstructions, setCustomInstructions, coreProtocol, setCoreProtocol, userBio, setUserBio, personality, setPersonality, emotionTuning, setEmotionTuning, apiKeys, setApiKeys, lang, setLang, femaleVoices, setFemaleVoices, maleVoices, setMaleVoices, ambientVolume, setAmbientVolume, connectionSound, setConnectionSound, avatarUrl, setAvatarUrl, subscriptionPlan, setSubscriptionPlan, usageData, useSystemVoice, setUseSystemVoice, user, handleLogin, handleLogout })
  );
};
