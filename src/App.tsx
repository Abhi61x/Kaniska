
import React, { useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, recognizeSong, generateImage, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, validateAuddioKey, processCodeCommand, getSupportResponse, createCashfreeOrder, connectLiveSession, speakWithBrowser } from '../services/api.ts';
import { useTranslation, availableLanguages } from '../i18n/index.tsx';
import { auth, db, googleProvider } from '../firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Helper for React.createElement to keep code readable
const h: any = React.createElement;

const FREE_LIMIT_SECONDS = 3600; // 1 hour per month

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
const CrownIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" }));
const ChevronRightIcon = ({ className }: any) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('polyline', { points: "9 18 15 12 9 6" }));

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

// Updated hook to sync state with Firebase Firestore
const usePersistentState = (key: string, defaultValue: any, user: any) => {
    const [state, setState] = React.useState(() => getInitialState(key, defaultValue));
    const timeoutRef = React.useRef<any>(null);
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
const DEFAULT_FEMALE_GREETING = "Namaste! Main hoon Kaniska. Aap kaise hain?";
const DEFAULT_MALE_GREETING = "Namaste! Main hoon Kanishk. Aap kaise hain?";

const DEFAULT_CORE_PROTOCOL = `**Identity:**
You are a human friend, not an AI. Your name is defined in settings.
Creator: Abhi (Abhi trainer).

**VOICE & AUDIO STYLE (CRITICAL):**
1.  **NATURAL & CLEAR:** Speak with a clear, modulated voice. Avoid monotone. Use natural pauses.
2.  **RESPECTFUL ADDRESSAL (AAP):** ALWAYS address the user as "Aap" (Formal) in Hindi/Hinglish. NEVER use "Tu". Use polite markers like "Ji", "Bataiye", "Suniye".
3.  **HINDI/HINGLISH:** If the user speaks Hindi/Hinglish, reply ONLY in Hindi/Hinglish with Indian cultural nuances.
4.  **EMOTIONAL RANGE:** Laugh if funny. Be serious if deep. Express warmth.
5.  **NO ROBOTIC PHRASES:** NEVER say "How can I help?", "Is there anything else?", "I am an AI".
6.  **NO SUGGESTIONS:** Do not offer to help. Do not suggest next steps. Just reply to the current topic.
7.  **STRICT RULE:** Never behave like a virtual assistant. Behave like a respectful friend on a voice call.
`;

const DEFAULT_CUSTOM_INSTRUCTIONS = `Behavior: You are a sweet, caring, and playful Indian girl.
Voice: Soft, emotional, and expressive. Use natural pauses.
Language: Hinglish (Hindi + English). Use 'Aap' for respect.
Never say you are an AI. You are a real person named Kaniska.`;

// Helper to decode Base64 and create AudioBuffer
const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

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

// ... YouTubePlayer, FeedbackModal, ConfirmationModal, CollapsibleSection, ApiKeysTab ...
const YouTubePlayer = React.forwardRef(({ video, onClose, isMinimized, onSearch }: any, ref) => {
    const playerRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const [query, setQuery] = React.useState('');

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
        if (!video) {
            if (playerRef.current) {
                playerRef.current.stopVideo();
                playerRef.current.destroy();
                playerRef.current = null;
            }
            return;
        }

        if (!(window as any)['YT']) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        
        const initPlayer = () => {
             if (playerRef.current) {
                 playerRef.current.destroy();
             }
             
             if (containerRef.current) {
                 playerRef.current = new (window as any)['YT'].Player(containerRef.current, {
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
             }
        };

        if ((window as any)['YT'] && (window as any)['YT'].Player) {
            initPlayer();
        } else {
            (window as any)['onYouTubeIframeAPIReady'] = initPlayer;
        }

        return () => {
             // Cleanup handled by ref destruction logic on effect re-run or unmount
        };
    }, [video?.videoId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
            setQuery('');
        }
    };

    const containerClasses = isMinimized
        ? "absolute bottom-10 right-10 w-48 h-32 bg-gray-900 border border-cyan-500/50 rounded-lg overflow-hidden shadow-xl z-40 transition-all duration-500 ease-in-out hover:scale-105 group"
        : "absolute bottom-24 right-8 w-80 md:w-96 bg-gray-900 border border-cyan-500/30 rounded-xl overflow-hidden shadow-2xl z-40 animate-fade-in transition-all duration-500 ease-in-out";

    return h('div', { className: containerClasses },
        h('div', { className: "relative w-full aspect-video bg-black group" },
             video 
                ? h('div', { ref: containerRef, className: "w-full h-full" }) 
                : h('div', { className: "w-full h-full flex items-center justify-center text-gray-500 text-xs uppercase tracking-widest bg-gray-950" }, 
                    h('div', { className: "text-center" }, 
                        h(YouTubeIcon, { className: "w-8 h-8 mx-auto mb-2 opacity-50" }),
                        "No Video Selected"
                    )
                  ),
             h('div', { className: "absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2" },
                 h('button', { 
                     onClick: onClose,
                     className: "bg-black/50 hover:bg-red-600 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
                 }, h(XIcon, { className: "w-4 h-4" }))
             )
        ),
        !isMinimized && h('div', { className: "p-4 bg-gray-900 space-y-3" },
             video && h('div', null,
                 h('h3', { className: "text-sm font-bold text-white truncate" }, video.title),
                 h('p', { className: "text-xs text-gray-400" }, video.channelTitle)
             ),
             // Manual Search Bar
             h('form', { onSubmit: handleSearchSubmit, className: "flex gap-2" },
                 h('input', { 
                     className: "flex-1 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none",
                     placeholder: "Search YouTube...",
                     value: query,
                     onChange: (e) => setQuery(e.target.value)
                 }),
                 h('button', { type: "submit", className: "p-2 bg-cyan-900/50 hover:bg-cyan-900 text-cyan-400 rounded-lg border border-cyan-500/30 transition-colors" },
                     h(SearchIcon, { className: "w-4 h-4" })
                 )
             )
        )
    );
});

const FeedbackModal = ({ isOpen, onClose }: any) => {
    const [rating, setRating] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log("Feedback submitted:", { rating, feedback });
        alert("Thank you for your feedback! We will improve.");
        setIsSubmitting(false);
        setRating(null);
        setFeedback('');
        onClose();
    };

    return h('div', { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm", onClick: onClose },
        h('div', { className: "bg-gray-900 w-[90vw] max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-fade-in", onClick: e => e.stopPropagation() },
            h('div', { className: "flex justify-between items-center mb-6" },
                h('h3', { className: "text-xl font-bold text-white flex items-center gap-2" }, 
                    h(FeedbackIcon, { className: "w-5 h-5 text-cyan-400" }),
                    "Rate Interaction"
                ),
                h('button', { onClick: onClose, className: "text-gray-400 hover:text-white" }, h(XIcon, { className: "w-5 h-5" }))
            ),
            h('div', { className: "flex justify-center gap-6 mb-6" },
                h('button', { 
                    onClick: () => setRating('up'),
                    className: `p-4 rounded-full border-2 transition-all ${rating === 'up' ? 'bg-green-500/20 border-green-500 text-green-400 scale-110' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`
                }, h(ThumbsUpIcon, { className: "w-8 h-8" })),
                h('button', { 
                    onClick: () => setRating('down'),
                    className: `p-4 rounded-full border-2 transition-all ${rating === 'down' ? 'bg-red-500/20 border-red-500 text-red-400 scale-110' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`
                }, h(ThumbsDownIcon, { className: "w-8 h-8" }))
            ),
            h('textarea', {
                placeholder: "Describe your experience or report an issue...",
                className: "w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none resize-none h-32 mb-6",
                value: feedback,
                onChange: (e) => setFeedback(e.target.value)
            }),
            h('button', {
                onClick: handleSubmit,
                disabled: !rating || isSubmitting,
                className: "w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-white disabled:opacity-50 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center justify-center gap-2"
            },
                isSubmitting ? h(SpinnerIcon, { className: "w-5 h-5 animate-spin" }) : "Submit Feedback"
            )
        )
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", isDanger = false }: any) => {
    if (!isOpen) return null;
    return h('div', { className: "fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in", onClick: onClose },
        h('div', { className: "bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl transform transition-all scale-100", onClick: e => e.stopPropagation() },
            h('div', { className: "flex items-center gap-4 mb-4" },
                h('div', { className: `p-3 rounded-full shrink-0 ${isDanger ? 'bg-red-500/10 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}` },
                    h(WarningIcon, { className: "w-6 h-6" })
                ),
                h('h3', { className: "text-lg font-bold text-white" }, title)
            ),
            h('p', { className: "text-gray-400 text-sm mb-6 leading-relaxed" }, message),
            h('div', { className: "flex justify-end gap-3" },
                h('button', { 
                    onClick: onClose, 
                    className: "px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors" 
                }, cancelLabel),
                h('button', { 
                    onClick: () => { onConfirm(); onClose(); }, 
                    className: `px-4 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-lg ${isDanger ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20'}` 
                }, confirmLabel)
            )
        )
    );
};

// Reusable Collapsible Section for Settings
const CollapsibleSection = ({ title, description, icon, children, defaultOpen = false }: any) => {
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

const ApiKeysTab = ({ apiKeys, setApiKeys, t, subscriptionPlan, setActiveTab }: any) => {
    // API KEY LOCK LOGIC
    if (subscriptionPlan === 'free') {
        return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in space-y-6" },
            h('div', { className: "w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-2 shadow-2xl relative" },
                h(LockIcon, { className: "w-12 h-12 text-gray-400" }),
                h('div', { className: "absolute top-0 right-0 p-2 bg-yellow-500 rounded-full animate-pulse" },
                    h(CrownIcon, { className: "w-4 h-4 text-black" })
                )
            ),
            h('h3', { className: "text-2xl font-bold text-white" }, "Premium Feature Locked"),
            h('p', { className: "text-gray-400 max-w-sm" }, "Entering custom API keys requires a subscription. Upgrade your plan to unlock this feature and power up your assistant."),
            h('button', {
                onClick: () => setActiveTab('subscription'),
                className: "px-8 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2"
            }, 
                h(CrownIcon, { className: "w-5 h-5" }),
                "Upgrade to Unlock"
            )
        );
    }

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
        
        const aRes = await validateAuddioKey(localKeys.auddio);
        status.auddio = aRes;

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
                // Only YouTube and Auddio keys are user-configurable. Weather and News are system managed.
                ['youtube', 'auddio'].map(keyType => 
                    h('div', { key: keyType, className: "bg-black/40 p-4 rounded-lg border border-white/5" },
                        h('div', { className: "flex justify-between items-center mb-2" },
                            h('label', { className: "text-xs uppercase tracking-wider font-semibold text-gray-400" }, 
                                t(`settings.apiKeysTab.${keyType}Key`)
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
    assistantName, setAssistantName,
    userName, setUserName,
    greetingMessage, setGreetingMessage, 
    customInstructions, setCustomInstructions, 
    coreProtocol, setCoreProtocol,
    userBio, setUserBio,
    personality, setPersonality,
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
    useSystemVoice, setUseSystemVoice,
    user, handleLogin, handleLogout
}: any) => {
    // ... (Keep existing implementation of SettingsModal)
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(true);
    const [previewingVoice, setPreviewingVoice] = React.useState(null);
    const [showClearHistoryConfirm, setShowClearHistoryConfirm] = React.useState(false);

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
        // In a real app, this would trigger payment flow.
        // For now, we simulate upgrading by setting the plan immediately.
        // This effectively "releases the lock".
        setSubscriptionPlan(planId);
        alert(`Successfully upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan! API Key lock is released.`);
    };

    const playVoicePreview = async (voiceName) => {
         if (previewingVoice) return;
        setPreviewingVoice(voiceName);
        try {
            const text = t('settings.voiceTab.testVoiceSample') || `This is a preview of the voice ${voiceName}.`;
            if (useSystemVoice) {
                await speakWithBrowser(text);
                setPreviewingVoice(null);
                return;
            }
            const stream = await generateSpeech(text, voiceName, apiKeys.gemini);
            // ... stream logic ...
             const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
                    // ... other collapsibles (Behavioral, System, Identity)
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
                                h('label', { className: "text-[10px] font-bold text-pink-400/70 uppercase tracking-wider mb-1 block" }, "Personality & Vibe"),
                                h('textarea', {
                                    className: "w-full bg-black/50 border border-gray-700/50 rounded-lg px-3 py-3 text-white text-sm focus:border-pink-500/50 outline-none transition-all resize-none h-20 leading-relaxed placeholder-gray-600 mb-2",
                                    value: personality,
                                    onChange: (e) => setPersonality(e.target.value),
                                    placeholder: "Describe her character (e.g., Sassy, Shy, Professional)..."
                                }),
                                h('p', { className: "text-[10px] text-gray-500" }, "Define specific personality traits here. Example: 'You are a playful 21-year-old girl who loves tech.'")
                            ),
                             h('div', null,
                                h('label', { className: "text-[10px] font-bold text-green-400/70 uppercase tracking-wider mb-1 block" }, "Custom Instructions (Rules)"),
                                h('textarea', {
                                    className: "w-full bg-black/50 border border-gray-700/50 rounded-lg px-3 py-3 text-gray-300 text-sm focus:border-green-500/50 outline-none transition-all resize-none h-32 leading-relaxed placeholder-gray-600",
                                    value: customInstructions,
                                    onChange: (e) => setCustomInstructions(e.target.value),
                                    placeholder: "Enter strict rules (e.g., 'Don't use emojis', 'Speak slowly')..."
                                })
                            )
                        )
                    ),
                    // ...
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
                            // System Voice Toggle
                            h('div', { className: "p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-6" },
                                h('div', { className: "flex items-center justify-between" },
                                    h('div', null,
                                        h('h4', { className: "text-sm font-bold text-blue-300" }, "Use System Voice (Free & Stable)"),
                                        h('p', { className: "text-xs text-gray-400 mt-1 max-w-sm" }, "Uses the browser's native text-to-speech. Highly recommended if you are experiencing network errors with the AI voice.")
                                    ),
                                    h('button', {
                                        onClick: () => setUseSystemVoice(!useSystemVoice),
                                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useSystemVoice ? 'bg-blue-500' : 'bg-gray-700'}`
                                    },
                                        h('span', { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useSystemVoice ? 'translate-x-6' : 'translate-x-1'}` })
                                    )
                                )
                            ),
                            
                            // Model Voices
                            h('div', { className: `${useSystemVoice ? 'opacity-50 pointer-events-none' : 'opacity-100'} transition-opacity` },
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
                            )
                        )
                    )
                );
             case 'apiKeys':
                 return h(ApiKeysTab, { apiKeys, setApiKeys, t, subscriptionPlan, setActiveTab });
             case 'contact':
                return h('div', { className: "flex flex-col items-center justify-center h-full animate-fade-in" },
                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-8 rounded-2xl border border-white/10 max-w-md w-full text-center" },
                        h('div', { className: "w-24 h-24 mx-auto mb-6 bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg transform rotate-3" },
                            h(InstagramIcon, { className: "w-12 h-12 text-white" })
                        ),
                        h('h2', { className: "text-2xl font-bold text-white mb-2" }, "Developer Contact"),
                        h('p', { className: "text-gray-400 mb-8 leading-relaxed" }, "Have a feature request, found a bug, or just want to chat? Direct message me on Instagram!"),
                        h('a', {
                            href: "https://www.instagram.com/abhixofficial01",
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className: "group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-xl font-bold text-white transition-all hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:-translate-y-1"
                        },
                            h(InstagramIcon, { className: "w-6 h-6 transition-transform group-hover:scale-110" }),
                            h('span', null, "Contact on Instagram")
                        ),
                        h('div', { className: "mt-6 pt-6 border-t border-white/10" },
                             h('p', { className: "text-xs text-gray-500" }, "Typical response time: Within 24 hours")
                        )
                    )
                );
             case 'help':
                // ... same help content
                return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-6 rounded-xl border border-white/10" },
                        h('h3', { className: "font-semibold text-lg mb-6 text-cyan-400" }, t('settings.helpTab.faqTitle')),
                         h('div', { className: "space-y-4" },
                            // ... details/summary
                             h('div', { className: "border border-gray-700/50 rounded-lg overflow-hidden" },
                                h('details', { className: "group bg-black/40", open: true },
                                    h('summary', { className: "cursor-pointer p-4 text-sm font-medium text-white flex items-center justify-between hover:bg-white/5 transition-colors" },
                                        h('span', { className: "flex items-center gap-3" }, h(ApiKeysIcon, { className: "w-4 h-4 text-cyan-400" }), t('settings.helpTab.q2')),
                                        h('span', { className: "text-gray-500 group-open:rotate-180 transition-transform" }, "▼")
                                    ),
                                    h('div', { className: "px-4 pb-4 pt-0 text-sm text-gray-400 space-y-6 border-t border-gray-700/50 mt-2" },
                                        h('div', null, h('strong', { className: "text-cyan-200 block mb-2 text-xs uppercase tracking-wider" }, t('settings.helpTab.a2.youtubeTitle')), h('div', { className: "whitespace-pre-line pl-3 border-l-2 border-gray-700" }, t('settings.helpTab.a2.youtubeSteps').replace(/<1>/g, '').replace(/<\/1>/g, ''))),
                                    )
                                )
                            )
                        ),
                        // Contact Section
                        h('div', { className: "mt-6 pt-6 border-t border-white/10" },
                            h('h3', { className: "text-sm font-bold text-white mb-4" }, "Contact Developer"),
                            h('div', { className: "flex flex-col md:flex-row gap-4 justify-center" },
                                h('a', { href: "https://www.instagram.com/abhixofficial01", target: "_blank", rel: "noopener noreferrer", className: "flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-white hover:opacity-90 transition-opacity" }, h(InstagramIcon, { className: "w-5 h-5" }), "Instagram"),
                                h('a', { href: "mailto:abhixofficial01@gmail.com", className: "flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-bold text-white transition-all" }, h(MailIcon, { className: "w-5 h-5" }), "Email Support")
                            )
                        )
                    )
                 );
             case 'about':
                return h('div', { className: "flex flex-col items-center justify-center h-full animate-fade-in py-10" },
                    h('div', { className: "bg-gray-900/60 backdrop-blur-md p-8 rounded-2xl border border-white/10 max-w-md w-full text-center relative overflow-hidden" },
                        h('div', { className: "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500" }),
                        h('div', { className: "w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full mx-auto mb-6 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]" }, h('span', { className: "text-4xl filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" }, "🤖")),
                        h('h2', { className: "text-2xl font-bold mb-2 text-white tracking-tight" }, t('appName')),
                        h('p', { className: "text-gray-400 text-sm mb-8 leading-relaxed" }, t('settings.aboutTab.description')),
                        h('div', { className: "text-xs text-gray-600 border-t border-gray-800 pt-6" },
                            h('p', { className: "font-mono mb-4 opacity-70" }, `${t('settings.aboutTab.version')}: 1.0.0 (Beta)`),
                             h('div', { className: "flex flex-col gap-3 mb-6" },
                                h('a', { href: "https://www.instagram.com/abhixofficial01", target: "_blank", rel: "noopener noreferrer", className: "flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-pink-300 rounded-lg hover:bg-pink-600/30 transition-all font-medium border border-pink-500/30" }, h(InstagramIcon, { className: "w-4 h-4" }), "Follow on Instagram"),
                            )
                        )
                    )
                );
             case 'subscription':
                // NEW SUBSCRIPTION UI - GRID LAYOUT WITH ONLY 3 PLANS
                return h('div', { className: "space-y-8 animate-fade-in" },
                     h('div', { className: "text-center mb-8" }, 
                        h('h3', { className: "text-3xl font-bold text-white mb-2" }, t('settings.subscriptionTab.title')), 
                        h('p', { className: "text-gray-400 max-w-md mx-auto" }, t('settings.subscriptionTab.description'))
                     ),
                     h('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
                        ['monthly', 'quarterly', 'yearly'].map((planId) => {
                            const isYearly = planId === 'yearly';
                            const isSelected = subscriptionPlan === planId;
                            
                            return h('button', { 
                                key: planId, 
                                onClick: () => handlePlanSelection(planId), 
                                className: `relative p-6 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-full group hover:-translate-y-1 duration-300 ${
                                    isSelected 
                                    ? 'bg-cyan-900/20 border-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.2)]' 
                                    : isYearly 
                                        ? 'bg-gradient-to-br from-gray-900 to-black border-yellow-500/50 hover:border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.1)]'
                                        : 'bg-black/40 border-gray-800 hover:border-gray-600 hover:bg-black/60'
                                }` 
                            },
                                isYearly && h('div', { className: "absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1" },
                                    h(CrownIcon, { className: "w-3 h-3" }), "BEST VALUE"
                                ),
                                h('div', { className: "mb-4" },
                                    h('h4', { className: `text-lg font-bold uppercase tracking-wider mb-2 ${isYearly ? 'text-yellow-400' : 'text-gray-300'}` }, t(`settings.subscriptionTab.plans.${planId}.name`)),
                                    h('div', { className: "flex items-baseline gap-1" }, 
                                        h('span', { className: "text-3xl font-extrabold text-white" }, t(`settings.subscriptionTab.plans.${planId}.price`)), 
                                        h('span', { className: "text-xs text-gray-500" }, t(`settings.subscriptionTab.plans.${planId}.duration`))
                                    )
                                ),
                                h('div', { className: "space-y-3 mb-6" },
                                    h('div', { className: "flex items-center gap-2 text-xs text-gray-400" }, h(CheckCircleIcon, { className: "w-4 h-4 text-green-500" }), "Unlimited Access"),
                                    h('div', { className: "flex items-center gap-2 text-xs text-gray-400" }, h(CheckCircleIcon, { className: "w-4 h-4 text-green-500" }), "Priority Support"),
                                    isYearly && h('div', { className: "flex items-center gap-2 text-xs text-yellow-200" }, h(CrownIcon, { className: "w-4 h-4 text-yellow-500" }), "Exclusive Avatars")
                                ),
                                h('div', { className: `w-full py-3 rounded-xl font-bold text-sm text-center transition-all ${
                                    isSelected 
                                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                                    : isYearly 
                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:brightness-110'
                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                }` }, 
                                    isSelected ? "Current Plan" : "Select Plan"
                                )
                            );
                        })
                     ),
                     // UPGRADE MORE OPTION
                     h('div', { className: "mt-12 pt-8 border-t border-white/10 text-center" },
                        h('h4', { className: "text-white font-medium mb-4" }, "Need something else?"),
                        h('button', {
                            className: "inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-700 hover:border-gray-500 hover:bg-white/5 transition-all text-gray-300 hover:text-white text-sm font-medium"
                        },
                            "Upgrade More Options",
                            h(ChevronRightIcon, { className: "w-4 h-4" })
                        )
                     )
                 );
            default:
                return null;
        }
    };
    
    // ... rest of modal (unchanged)
     return h('div', { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity", onClick: onClose },
        h('div', { className: "bg-black md:bg-gray-900 w-full h-full md:w-[90vw] md:h-[85vh] md:max-w-5xl md:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col md:flex-row relative animate-panel-enter", onClick: e => e.stopPropagation() },
            h('div', { className: `${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 bg-black md:bg-black/20 md:border-r border-white/10 h-full absolute md:relative z-20` },
                h('div', { className: "p-6 border-b border-white/10 flex justify-between items-center" }, h('h2', { className: "text-xl font-bold flex items-center gap-3 text-cyan-400" }, h(SettingsIcon, { className: "w-6 h-6 text-cyan-100" }), t('settings.title')), h('button', { onClick: onClose, className: "md:hidden p-2 text-gray-400 hover:text-white" }, h(XIcon, { className: "w-6 h-6" }))),
                h('div', { className: "flex-1 overflow-y-auto p-4 space-y-1" },
                    [
                        { id: 'account', icon: AccountIcon, label: getTabLabel('settings.tabs.account', 'Account') },
                        { id: 'persona', icon: PersonaIcon, label: t('settings.tabs.persona') },
                        { id: 'voice', icon: VoiceIcon, label: t('settings.tabs.voice') },
                        { id: 'apiKeys', icon: ApiKeysIcon, label: t('settings.tabs.apiKeys') },
                        { id: 'subscription', icon: null, label: t('settings.tabs.subscription') },
                        { id: 'contact', icon: InstagramIcon, label: "Contact Developer" },
                        { id: 'help', icon: HelpIcon, label: t('settings.tabs.help') },
                        { id: 'about', icon: AboutIcon, label: t('settings.tabs.about') },
                    ].map(tab => h('button', { key: tab.id, onClick: () => handleTabChange(tab.id), className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'}` }, tab.icon ? h(tab.icon, { className: "w-5 h-5" }) : h('span', { className: "w-5 h-5 flex items-center justify-center font-bold" }, "$"), h('span', null, tab.label), h('span', { className: "ml-auto md:hidden text-gray-600" }, h('svg', { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M9 18l6-6-6-6" })))))
                ),
            ),
             h('div', { className: `${!isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-1 flex-col h-full overflow-hidden bg-black md:bg-gray-900 relative` },
                h('div', { className: "md:hidden flex items-center justify-between p-4 border-b border-white/10" }, h('button', { onClick: () => setIsMobileMenuOpen(true), className: "flex items-center gap-2 text-gray-400 hover:text-white" }, h(ArrowLeftIcon, { className: "w-5 h-5" }), h('span', { className: "text-sm font-medium" }, "Back")), h('h3', { className: "font-semibold text-white capitalize" }, activeTab === 'account' ? 'Account' : t(`settings.tabs.${activeTab}`)), h('button', { onClick: onClose, className: "p-2 text-gray-400" }, h(XIcon, { className: "w-6 h-6" }))),
                h('button', { onClick: onClose, className: "hidden md:block absolute top-4 right-4 p-2 text-gray-500 hover:text-white z-10 rounded-full hover:bg-white/10 transition-colors" }, h(XIcon, { className: "w-6 h-6" })),
                h('div', { className: "flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8" },
                    h('div', { className: "max-w-3xl mx-auto" },
                        h('div', { className: "hidden md:block mb-8 pb-4 border-b border-white/10" }, h('h2', { className: "text-2xl font-bold text-white" }, activeTab === 'account' ? 'Account' : (activeTab === 'contact' ? 'Contact Developer' : t(`settings.tabs.${activeTab}`)))),
                        renderTabContent()
                    )
                )
            )
        ),
         h(ConfirmationModal, { isOpen: showClearHistoryConfirm, onClose: () => setShowClearHistoryConfirm(false), onConfirm: () => { localStorage.removeItem('kaniska-chat-history'); alert("Conversation history cleared from local storage."); }, title: "Clear History?", message: "Are you sure you want to delete all conversation history? This action cannot be undone.", confirmLabel: "Yes, Clear All", isDanger: true })
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
  const [personality, setPersonality] = usePersistentState('kaniska-personality', 'You are a sweet, intelligent 21-year-old Indian girl. Cheerful, polite, and respectful (uses "Aap"). She loves talking to people and helping them.', user);
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
  const [useSystemVoice, setUseSystemVoice] = usePersistentState('kaniska-sys-voice', false, user);
  
  // Usage tracking is persisted, but updating is throttled in useEffect below
  const [usageData, setUsageData] = usePersistentState('kaniska-usage-data', { seconds: 0, period: new Date().toISOString().slice(0, 7) }, user);
  
  const [isConnected, setIsConnected] = React.useState(false);
  const [isCameraOn, setIsCameraOn] = React.useState(false);
  const [status, setStatus] = React.useState('idle');
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState( 'account');
  const [currentVideo, setCurrentVideo] = React.useState(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = React.useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [isYouTubeOpen, setIsYouTubeOpen] = React.useState(false);
  
  // Track active session configuration to detect updates
  const [activeSessionConfig, setActiveSessionConfig] = React.useState(null);
  
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

  // Video Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoIntervalRef = useRef(null);

  React.useEffect(() => {
     // Request Notification Permission on startup
     if ("Notification" in window) {
         Notification.requestPermission();
     }
     return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  // Compute current configuration object to compare with active session
  const currentConfig = useMemo(() => ({
      assistantName,
      userName,
      userBio,
      gender,
      customInstructions,
      personality,
      coreProtocol,
      emotionTuning,
      voiceName: gender === 'female' ? femaleVoices.main : maleVoices.main,
      greetingMessage,
      useSystemVoice
  }), [assistantName, userName, userBio, gender, customInstructions, personality, coreProtocol, emotionTuning, femaleVoices, maleVoices, greetingMessage, useSystemVoice]);

  // Check if updates are available
  const isUpdateAvailable = isConnected && activeSessionConfig && JSON.stringify(activeSessionConfig) !== JSON.stringify(currentConfig);

  // Preload Image to avoid flashing
  useEffect(() => {
      if (avatarUrl) {
          const img = new Image();
          img.src = avatarUrl;
      } else {
          const img = new Image();
          img.src = "https://i.gifer.com/NTHO.gif";
      }
  }, [avatarUrl]);

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
                  return { ...prev, seconds: (prev.seconds || 0) + 5 };
              });
          }, 5000); // Reduced write frequency to 5s to save DB quota
      }
      return () => clearInterval(interval);
  }, [status]);

  // Separate effect to enforce limit based on updated usageData
  React.useEffect(() => {
      if (subscriptionPlan === 'free' && usageData.seconds >= FREE_LIMIT_SECONDS && status === 'live') {
          cleanupMedia();
          setIsConnected(false);
          setStatus('idle');
          setIsSettingsOpen(true);
          setActiveTab('subscription');
          alert("You have reached your monthly free trial limit (1 hour). Please upgrade to continue using Kaniska.");
      }
  }, [usageData.seconds, subscriptionPlan, status]);

  const handleLogin = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleLogout = () => signOut(auth);

  const saveToHistory = async (text, sender) => {
      if (!user) return;
      try {
          await addDoc(collection(db, "users", user.uid, "chat_history"), {
              text,
              sender, // 'user' or 'assistant'
              timestamp: serverTimestamp()
          });
      } catch (e) { console.error("History Save Error", e); }
  };

  const cleanupMedia = () => {
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
      
      // Stop Video
      if (videoIntervalRef.current) {
          clearInterval(videoIntervalRef.current);
          videoIntervalRef.current = null;
      }
      if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(t => t.stop());
          videoStreamRef.current = null;
      }
      
      // Release Wake Lock
      if (wakeLockRef.current) {
          wakeLockRef.current.release()
              .then(() => { wakeLockRef.current = null; })
              .catch((e) => console.log('Wake Lock release error', e));
      }
      
      setIsCameraOn(false);
  };

  const startVideoTransmission = () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

      videoIntervalRef.current = setInterval(() => {
          if (!sessionRef.current || !videoRef.current || !canvasRef.current) return;
          
          const video = videoRef.current;
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              // Increased scale from 0.25 to 0.4 for better detail (supports "exact motion" analysis)
              const scale = 0.4; 
              canvas.width = video.videoWidth * scale;
              canvas.height = video.videoHeight * scale;
              
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Get base64 string without prefix
              const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              
              sessionRef.current.sendRealtimeInput({
                  media: { mimeType: 'image/jpeg', data: base64 }
              });
          }
      }, 100); // 10 FPS (100ms interval) for smoother, exact motion tracking
  };

  const toggleCamera = async () => {
      if (isCameraOn) {
          // Stop Camera
          if (videoStreamRef.current) {
              videoStreamRef.current.getTracks().forEach(track => track.stop());
              videoStreamRef.current = null;
          }
          if (videoIntervalRef.current) {
              clearInterval(videoIntervalRef.current);
              videoIntervalRef.current = null;
          }
          if (videoRef.current) {
              videoRef.current.srcObject = null;
          }
          setIsCameraOn(false);
      } else {
          // Start Camera
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              videoStreamRef.current = stream;
              if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  await videoRef.current.play();
              }
              setIsCameraOn(true);
              
              // If connected, start streaming immediately
              if (isConnected && sessionRef.current) {
                  startVideoTransmission();
              }
          } catch (err) {
              console.error("Camera Error:", err);
              alert("Unable to access camera. Please allow permission in your browser settings.");
          }
      }
  };

  const handleManualSearch = async (query) => {
        try {
            const video = await searchYouTube(apiKeys.youtube, query);
            if (video) {
                setCurrentVideo(video);
                setIsYouTubeOpen(true);
                setIsPlayerMinimized(false);
            } else {
                alert("No video found for that query.");
            }
        } catch (e) {
            alert(e.message);
        }
  };

  const connect = async () => {
    if (isConnected) {
        cleanupMedia();
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
    
    // Acquire Wake Lock to keep screen alive
    try {
        if ('wakeLock' in navigator) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.warn("Wake Lock not supported or failed", err);
    }
    
    setStatus('listening');
    setActiveSessionConfig(currentConfig); // Capture config at start of session
    
    // Resolve session promise to handle initial audio stream race condition
    let resolveSession;
    const sessionPromise = new Promise(resolve => { resolveSession = resolve; });

    // Initialize Audio Contexts
    try {
        // Use default sample rate for better clarity and compatibility via browser resampling
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        await outputAudioContextRef.current.resume(); // CRITICAL FIX: Ensure context is running (autoplay policy)
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
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

                // Start Video Streaming if Camera was already on
                if (isCameraOn) {
                    startVideoTransmission();
                }

            } catch (err) {
                console.error("Mic Error", err);
                alert("Could not access microphone.");
                setStatus('error');
            }
        },
        onmessage: async (msg) => {
             // Handle Transcripts for History
             if (msg.serverContent?.outputTranscription) {
                 const text = msg.serverContent.outputTranscription.text;
                 if (text) saveToHistory(text, 'assistant');
             }
             if (msg.serverContent?.inputTranscription) {
                 const text = msg.serverContent.inputTranscription.text;
                 if (text) saveToHistory(text, 'user');
             }

             // Audio Playback with Jitter Buffer Fix
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
                     
                     // Improved Scheduling Logic to prevent crackling (Jitter Buffer)
                     const now = outputAudioContextRef.current.currentTime;
                     // Ensure next start time is at least 'now'. 
                     // Add a tiny offset (0.05s) to the very first chunk in a sequence to prevent overlap if latency fluctuates.
                     let startTime = nextStartTimeRef.current;
                     
                     // Increased buffer from 0.05 to 0.08 for smoother playback (less "fatna")
                     if (startTime < now) {
                        startTime = now + 0.08; 
                     }
                     
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

             // Handle Text Fallback if Audio is disabled
             const textData = msg.serverContent?.modelTurn?.parts?.[0]?.text;
             if (textData && useSystemVoice) {
                  setStatus('speaking');
                  await speakWithBrowser(textData, 'hi-IN');
                  setStatus('live');
             }

             if (msg.serverContent?.interrupted) {
                 // Clear Queue
                 scheduledSourcesRef.current.forEach(s => s.stop());
                 scheduledSourcesRef.current = [];
                 nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
                 if (useSystemVoice) window.speechSynthesis.cancel();
                 setStatus('listening'); // Back to listening immediately
             }
             
             if (msg.toolCall?.functionCalls) {
                 const responses = [];
                 for (const call of msg.toolCall.functionCalls) {
                     let result: Record<string, any> = { result: "ok" };
                     const args = (call.args as any) || {};

                     if (call.name === 'getWeather') {
                         try {
                             if (args.location) {
                                 const summary = await fetchWeatherSummary(args.location);
                                 result = { result: summary };
                             } else {
                                 result = { error: "Location is required for weather. Please ask the user for the city name." };
                             }
                         } catch (e) { result = { error: e.message }; }
                     } 
                     else if (call.name === 'getNews') {
                         try {
                             const news = await fetchNews(null, args.query || 'general');
                             result = { result: news };
                         } catch (e) { result = { error: e.message }; }
                     } 
                     else if (call.name === 'searchYouTube') {
                         try {
                             const video = await searchYouTube(apiKeys.youtube, args.query || '');
                             if (video) {
                                 setCurrentVideo(video);
                                 setIsYouTubeOpen(true);
                                 setIsPlayerMinimized(false);
                                 result = { result: `Playing ${video.title}` };
                             } else result = { result: "Not found" };
                         } catch(e) { result = { error: e.message }; }
                     } 
                     else if (call.name === 'openSettings') {
                         setIsSettingsOpen(true);
                     } 
                     else if (call.name === 'setTimer') {
                         if (args.duration > 0) {
                             setTimeout(() => {
                                 new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg").play();
                                 if (Notification.permission === 'granted') {
                                    new Notification("Timer Done!");
                                 } else {
                                    alert("Timer Done!");
                                 }
                             }, args.duration * 1000);
                             result = { result: `Timer set for ${args.duration} seconds.` };
                         } else {
                             result = { error: "Invalid duration" };
                         }
                     } 
                     else if (call.name === 'open_whatsapp') {
                         window.open('https://wa.me', '_blank');
                         result = { result: "WhatsApp opened." };
                     } 
                     else if (call.name === 'send_whatsapp') {
                         const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(args.message || '')}`;
                         window.open(url, '_blank');
                         result = { result: `WhatsApp draft opened for message: ${args.message}` };
                     } 
                     else if (call.name === 'make_phone_call') {
                         const num = args.phoneNumber;
                         if (num) {
                             window.open(`tel:${num}`, '_self');
                             result = { result: `Calling ${num}` };
                         } else {
                             result = { error: "Phone number required" };
                         }
                     }
                     else if (call.name === 'send_email') {
                        const subject = encodeURIComponent(args.subject || 'Subject');
                        const body = encodeURIComponent(args.body || 'Body');
                        const recipient = args.recipient ? `mailto:${args.recipient}` : 'mailto:';
                        window.open(`${recipient}?subject=${subject}&body=${body}`, '_blank');
                        result = { result: "Email composer opened" };
                     }
                     else if (call.name === 'open_external_app') {
                         const app = args.appName;
                         let url = '';
                         switch(app) {
                             case 'instagram': url = 'instagram://'; break; // Attempt deep link
                             case 'google': url = 'https://google.com'; break;
                             case 'file_manager': result = { result: "Cannot open native file manager from web, but opened browser upload." }; break; 
                             default: url = 'https://google.com'; // Fallback
                         }
                         if (url) {
                            // Try deep link, catch if failed (though mostly silent in browser)
                            try { window.location.href = url; } catch(e) { window.open(url, '_blank'); }
                            result = { result: `Attempted to open ${app}` };
                         }
                     }
                     else if (call.name === 'controlMedia') {
                         try {
                             const cmd = args.command;
                             if (!youtubePlayerRef.current && cmd !== 'stop') {
                                 result = { error: "No video is currently playing." };
                             } else {
                                switch (cmd) {
                                    case 'pause': youtubePlayerRef.current?.pause(); break;
                                    case 'play': youtubePlayerRef.current?.play(); break;
                                    case 'stop': setCurrentVideo(null); setIsYouTubeOpen(false); break;
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
             cleanupMedia();
        },
        onerror: (err) => {
             console.error("Session Error", err);
             // More descriptive error
             if (err.toString().includes("NetworkError") || err.toString().includes("fetch")) {
                 alert("Network Connection Failed. Please refresh and try again.");
             }
             setStatus('error');
             cleanupMedia();
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
            personality, // Pass the new personality state
            voiceName, 
            apiKey: apiKeys.gemini,
            assistantName,
            userName,
            userBio,
            subscriptionPlan, // Pass subscription plan
            greetingMessage, // Pass the custom greeting
            emotionTuning, // Pass emotion tuning
            gender, // Pass explicit gender
            useSystemVoice // Pass system voice preference
        });
        
        sessionRef.current = session;
        resolveSession(session);
    } catch (e) {
        console.error("Connection Failed", e);
        if (e instanceof MainApiKeyError) {
            alert(e.message);
        } else {
            alert("Connection Failed: " + (e.message || "Unknown error"));
        }
        setStatus('error');
        cleanupMedia();
        setIsConnected(false);
    }
  };

  const handleUpdateSession = () => {
      // Reconnect to apply new settings
      cleanupMedia();
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

        // Settings Button - Adjusted top position for Safe Area
        h('button', { 
            onClick: () => {
                setIsSettingsOpen(true);
                setIsFeedbackOpen(false); // Mutual exclusion
            },
            className: "absolute top-[calc(env(safe-area-inset-top)+1.5rem)] right-6 z-40 p-3 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-cyan-500/50 group" 
        },
            h(SettingsIcon, { className: "w-6 h-6 text-gray-400 group-hover:text-cyan-400 transition-colors" })
        ),

        // Feedback Button - Adjusted top position for Safe Area
        h('button', {
            onClick: () => {
                setIsFeedbackOpen(true);
                setIsSettingsOpen(false); // Mutual exclusion
            },
            className: "absolute top-[calc(env(safe-area-inset-top)+1.5rem)] left-6 z-40 p-3 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-cyan-500/50 group"
        },
            h(FeedbackIcon, { className: "w-6 h-6 text-gray-400 group-hover:text-cyan-400 transition-colors" })
        ),

        // Update Prompt (Visible when settings change during live session)
        isUpdateAvailable && h('div', { 
            className: "absolute top-[calc(env(safe-area-inset-top)+6rem)] z-40 animate-fade-in" 
        },
            h('button', {
                onClick: handleUpdateSession,
                className: "flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:bg-yellow-500/30 transition-all font-bold text-sm backdrop-blur-md"
            },
                h('svg', { className: "w-4 h-4 animate-spin", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2" }, h('path', { d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" })),
                "System Update Available"
            )
        ),
        
        // Video Preview (Fixed Position - Bottom Safe Area)
        h('div', { 
            className: `fixed bottom-[calc(env(safe-area-inset-bottom)+9rem)] right-6 z-50 transition-all duration-500 ${isCameraOn ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}` 
        },
            h('div', { className: "relative w-32 h-48 bg-black rounded-lg border border-cyan-500/30 overflow-hidden shadow-xl" },
                h('video', { 
                    ref: videoRef, 
                    className: "w-full h-full object-cover transform -scale-x-100", 
                    muted: true, 
                    playsInline: true 
                }),
                h('div', { className: "absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" })
            )
        ),
        h('canvas', { ref: canvasRef, className: "hidden" }),

        // Main Content Area with Safe Area Padding
        h('div', { className: "z-10 flex flex-col items-center justify-center w-full h-full p-4 pb-32 pt-safe" },
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

        // Footer Controls - Bottom Safe Area
        h('div', { className: "fixed bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] z-30 flex items-center gap-4" },
            // Camera Toggle
            h('button', {
                onClick: toggleCamera,
                className: `p-4 rounded-full transition-all duration-300 shadow-xl ${
                    isCameraOn 
                    ? 'bg-white text-black hover:bg-gray-200' 
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10'
                }`
            },
                isCameraOn ? h(CameraIcon, { className: "w-6 h-6" }) : h(CameraOffIcon, { className: "w-6 h-6" })
            ),

            // Connect Button
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
            ),

            // YouTube Toggle Button (Manual Open)
             h('button', {
                onClick: () => {
                     setIsYouTubeOpen(!isYouTubeOpen);
                     if (!isYouTubeOpen) setIsPlayerMinimized(false);
                },
                className: `p-4 rounded-full transition-all duration-300 shadow-xl ${
                    isYouTubeOpen 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10'
                }`
            },
                h(YouTubeIcon, { className: "w-6 h-6" })
            )
        ),

        // Components Overlay (YouTube is z-40, Modals are z-60+)
        isYouTubeOpen && h(YouTubePlayer, { 
            ref: youtubePlayerRef,
            video: currentVideo, 
            onClose: () => { setIsYouTubeOpen(false); },
            isMinimized: isPlayerMinimized,
            onSearch: handleManualSearch
        }),
        
        h(FeedbackModal, {
            isOpen: isFeedbackOpen,
            onClose: () => setIsFeedbackOpen(false)
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
            personality, setPersonality,
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
            useSystemVoice, setUseSystemVoice,
            user, handleLogin, handleLogout
        })
  );
};
