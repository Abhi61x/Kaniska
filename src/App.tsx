
import React, { useState, useEffect, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // for HTML
import 'prismjs/components/prism-python';
import { GoogleGenAI, Type, Modality, FunctionDeclaration, LiveServerMessage } from '@google/genai';
// Correct relative path to services from src/App.tsx
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, recognizeSong, generateImage, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, validateAuddioKey, processCodeCommand, getSupportResponse, createCashfreeOrder, connectLiveSession } from '../services/api.ts';
import { useTranslation, availableLanguages } from '../i18n/index.tsx';
import { auth, db, googleProvider } from '../firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
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
const SearchIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('circle', { cx: "11", cy: "11", r: "8" }), h('line', { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }));
const WhatsAppIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "currentColor" }, h('path', { d: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" }));
const MailIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), h('polyline', { points: "22,6 12,13 2,6" }));
const SpaciousIcon = ({ className }) => h('svg', { className, viewBox: "0 0 24 24", height: "24", width: "24", xmlns: "http://www.w3.org/2000/svg" },
    h('g', { fill: "none" },
        h('path', { d: "m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z", fill: "currentColor" }),
        h('path', { d: "M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM11 6.094l-.806 2.36a6 6 0 0 1-3.49 3.649l-.25.091l-2.36.806l2.36.806a6 6 0 0 1 3.649 3.49l.091.25l.806 2.36l.806-2.36a6 6 0 0 1 3.49-3.649l.25-.09l2.36-.807l-2.36-.806a6 6 0 0 1-3.649-3.49l-.09-.25M19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027a1 1 0 0 1-1.845.117l-.048-.117l-.35-1.026l-1.027-.35a1 1 0 0 1-.118-1.845l.118-.048l1.026-.35l.35-1.027A1 1 0 0 1 19 2", fill: "currentColor" })
    )
);
const AccountIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, h('path', { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), h('circle', { cx: "8.5", cy: "7", r: "4" }), h('line', { x1: "20", y1: "8", x2: "20", y2: "14" }), h('line', { x1: "23", y1: "11", x2: "17", y2: "11" }));
const GoogleIcon = ({ className }) => h('svg', { className, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: "24", height: "24" }, h('path', { fill: "#4285F4", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), h('path', { fill: "#34A853", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), h('path', { fill: "#FBBC05", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), h('path', { fill: "#EA4335", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" }));

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
4.  **Controlling YouTube playback:** Use the 'CONTROL_MEDIA' tool when the user asks to play, pause, stop, rewind, or fast-forward the currently playing video.
5.  **Getting Weather:** Use the 'GET_WEATHER' tool to provide weather forecasts for a specific location.
6.  **Setting Timers:** Use the 'SET_TIMER' tool to set a countdown timer.
7.  **Generating Images:** Use the 'GENERATE_IMAGE' tool when the user asks to generate, create, draw, or show an image of something. If the user asks for a "real" object (e.g., "show me a real banana"), generate a photorealistic image of it.
8.  **WhatsApp Control:** You have full power to handle WhatsApp. Use 'send_whatsapp' to draft and send messages. Use 'open_whatsapp' to simply open the app. If the user says 'Send message to X', and you don't have the number, ask for it, or just use the name if the user insists (WhatsApp will search for the contact).
9.  **Sending Emails:** Use the 'send_email' tool when the user wants to send an email. You MUST have the recipient's email address, the subject, and the message body. If any of these are missing, ask the user for them specifically before calling the tool.
10. **Random Fact:** Use the 'random_fact' tool when the user asks for a random, interesting, or fun fact.

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
const Avatar = ({ state, mood = 'neutral', customUrl }) => {
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
    // Use custom URL if provided, otherwise fallback to the requested GIF
    const imageUrl = customUrl || "https://i.gifer.com/NTHO.gif";

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
                    backgroundColor: 'rgba(34, 211, 238, 0.5)',
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
    // FIX: Typed validationStatus to allow string keys
    const [validationStatus, setValidationStatus] = React.useState<Record<string, any>>({});
    const [isValidating, setIsValidating] = React.useState(false);

    const handleSaveKeys = async () => {
        setIsValidating(true);
        setValidationStatus({});
        // FIX: Typed status object to allow dynamic assignment
        const status: Record<string, any> = {};
        
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
                // Added Gemini Key support so users can provide their own key if env is missing
                ['gemini', 'weather', 'news', 'youtube', 'auddio'].map(keyType => 
                    h('div', { key: keyType, className: "bg-black/40 p-4 rounded-lg border border-gray-700/50" },
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
                            className: "w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder-gray-600",
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
    greetingMessage, setGreetingMessage, 
    customInstructions, setCustomInstructions, 
    userBio, setUserBio,
    emotionTuning, setEmotionTuning, 
    apiKeys, setApiKeys, 
    lang, setLang, 
    femaleVoices, setFemaleVoices, 
    maleVoices, setMaleVoices, 
    ambientVolume, setAmbientVolume,
    avatarUrl, setAvatarUrl,
    subscriptionPlan, setSubscriptionPlan,
    dailyUsage,
    user, handleLogin, handleLogout
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

    // Robust label getter that uses fallback if translation key is returned (meaning translation missing)
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
            // Use authenticated user details if available, else guest
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
                     h('div', { className: "bg-black/20 p-6 rounded-xl border border-gray-800 text-center" },
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
                return h('div', { className: "space-y-6 animate-fade-in" },
                    h('div', { className: "bg-black/20 p-5 rounded-xl border border-gray-800" },
                        h('div', { className: "mb-6" },
                            h('h3', { className: "font-semibold text-lg text-cyan-400" }, "Custom Instructions"),
                            h('p', { className: "text-xs text-gray-500" }, "Personalize how the assistant interacts with you.")
                        ),
                        
                        h('div', { className: "space-y-5" },
                            h('div', null,
                                h('label', { className: "block text-sm font-medium text-gray-300 mb-2" }, "What would you like Kaniska to know about you to provide better responses?"),
                                h('textarea', {
                                    className: "w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none text-sm leading-relaxed",
                                    rows: 3,
                                    value: userBio,
                                    onChange: (e) => setUserBio(e.target.value),
                                    placeholder: "E.g., I'm a software developer based in Bangalore. I like concise answers..."
                                })
                            ),
                             h('div', null,
                                h('label', { className: "block text-sm font-medium text-gray-300 mb-2" }, "How would you like Kaniska to respond?"),
                                h('textarea', {
                                    className: "w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none text-sm leading-relaxed",
                                    rows: 3,
                                    value: customInstructions,
                                    onChange: (e) => setCustomInstructions(e.target.value),
                                    placeholder: "E.g., Be formal, use technical terms, keep it short..."
                                })
                            )
                        )
                    ),
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
                h('div', { className: "p-4 border-t border-border-color bg-gray-900" },
                    h('label', { className: "text-xs text-gray-500 uppercase font-semibold mb-2 block px-1" }, "Language"),
                    // Using flex-wrap for better responsive layout to prevent text overlap
                    h('div', { className: "flex flex-wrap gap-2" },
                        availableLanguages.map(l => 
                            h('button', {
                                key: l.code,
                                onClick: () => setLang(l.code),
                                className: `flex-grow py-2 px-3 text-[10px] font-medium rounded-lg border transition-colors truncate text-center ${
                                    lang === l.code ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'border-border-color text-gray-500 hover:border-gray-600'
                                }`,
                                title: l.name,
                                style: { minWidth: '30%' }
                            }, l.name.split(' ')[0])
                        )
                    )
                )
            ),
            h('div', { className: `${!isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-1 flex-col h-full overflow-hidden bg-black md:bg-panel-bg relative` },
                h('div', { className: "md:hidden flex items-center justify-between p-4 border-b border-border-color" },
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

export const App = () => {
    const { t, setLang, lang } = useTranslation();
    
    // Persistent State
    const [theme, setTheme] = usePersistentState('kaniska-theme', 'dark');
    const [gender, setGender] = usePersistentState('kaniska-gender', 'female');
    const [greetingMessage, setGreetingMessage] = usePersistentState('kaniska-greeting', DEFAULT_FEMALE_GREETING);
    const [customInstructions, setCustomInstructions] = usePersistentState('kaniska-instructions', DEFAULT_CUSTOM_INSTRUCTIONS);
    const [userBio, setUserBio] = usePersistentState('kaniska-bio', '');
    const [emotionTuning, setEmotionTuning] = usePersistentState('kaniska-emotions', {
        happiness: 50, empathy: 50, formality: 50, excitement: 50, sadness: 10, curiosity: 50
    });
    const [apiKeys, setApiKeys] = usePersistentState('kaniska-api-keys', {
        weather: '', news: '', youtube: '', auddio: '', gemini: ''
    });
    const [femaleVoices, setFemaleVoices] = usePersistentState('kaniska-voices-female', { main: 'Kore', greeting: 'Kore' });
    const [maleVoices, setMaleVoices] = usePersistentState('kaniska-voices-male', { main: 'Fenrir', greeting: 'Fenrir' });
    const [ambientVolume, setAmbientVolume] = usePersistentState('kaniska-ambient', 0.2);
    const [avatarUrl, setAvatarUrl] = usePersistentState('kaniska-avatar', '');
    const [subscriptionPlan, setSubscriptionPlan] = usePersistentState('kaniska-plan', 'free');
    const [dailyUsage, setDailyUsage] = usePersistentState('kaniska-usage', { date: new Date().toDateString(), seconds: 0 });

    // Runtime State
    const [user, setUser] = React.useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('account');
    const [status, setStatus] = React.useState('idle'); 
    const [errorMsg, setErrorMsg] = React.useState(null);

    const liveSessionRef = React.useRef(null);
    const audioContextRef = React.useRef(null);
    const nextStartTimeRef = React.useRef(0);
    const mediaStreamRef = React.useRef(null);
    const inputAudioContextRef = React.useRef(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (e) {
            console.error("Login failed", e);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    const handleConnect = async () => {
        try {
            setStatus('connecting');
            setErrorMsg(null);
            
            // 1. Setup Audio Output Context
            if (!audioContextRef.current) {
                 audioContextRef.current = new (window.AudioContext || window['webkitAudioContext'])({sampleRate: 24000});
            }
            const audioCtx = audioContextRef.current;
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            nextStartTimeRef.current = audioCtx.currentTime;

            // 2. Setup Audio Input (Microphone) - CRITICAL for "No Reply" issue
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const inputAudioContext = new (window.AudioContext || window['webkitAudioContext'])({ sampleRate: 16000 });
            inputAudioContextRef.current = inputAudioContext;
            const source = inputAudioContext.createMediaStreamSource(stream);
            
            // Use ScriptProcessor for raw PCM access (worklet is better but this is simpler for single-file demo)
            const processor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Create Blob for 16-bit PCM 16kHz
                const pcmBlob = createBlob(inputData);
                
                // Send audio to Gemini if session is active
                if (liveSessionRef.current) {
                    liveSessionRef.current.sendRealtimeInput({ media: pcmBlob });
                }
            };

            source.connect(processor);
            processor.connect(inputAudioContext.destination);

            // 3. Prepare configuration
            const voiceConfig = gender === 'female' ? femaleVoices : maleVoices;
            const selectedLangName = availableLanguages.find(l => l.code === lang)?.name || 'English';
            const fullSystemInstruction = `${FIXED_SYSTEM_INSTRUCTIONS}\n\n${customInstructions}\n\nUser Context:\nBio: ${userBio}\nPlan: ${subscriptionPlan}\nLanguage Priority: You MUST speak in ${selectedLangName}.`;

            // 4. Callbacks for Live API
            const callbacks = {
                onopen: () => {
                    setStatus('live');
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                        const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
                        const bytes = decode(base64);
                        const buffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
                        
                        const now = audioCtx.currentTime;
                        if (nextStartTimeRef.current < now) {
                            nextStartTimeRef.current = now + 0.25; 
                        }
                        
                        const source = audioCtx.createBufferSource();
                        source.buffer = buffer;
                        source.connect(audioCtx.destination);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += buffer.duration;
                    }
                },
                onclose: () => {
                    setStatus(prev => prev === 'error' ? 'error' : 'idle');
                },
                onerror: (e) => {
                    console.error("Live API Error:", e);
                    setStatus('error');
                    setErrorMsg("Connection failed. Please check your API key and network.");
                }
            };

            const session = await connectLiveSession(callbacks, fullSystemInstruction, voiceConfig.main, apiKeys.gemini);
            liveSessionRef.current = session;

        } catch (e) {
            console.error(e);
            setStatus('error');
            if (e.message?.includes('API key') || e instanceof MainApiKeyError) {
                setErrorMsg("Gemini API Key missing. Please add it in Settings > API Keys.");
                setActiveTab('apiKeys');
                setIsSettingsOpen(true);
            } else if (e.name === 'NotAllowedError') {
                setErrorMsg("Microphone access denied. Please allow microphone permissions.");
            } else {
                setErrorMsg(e.message || "Could not connect.");
            }
        }
    };

    const handleDisconnect = () => {
        // Stop Microphone Stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        // Close Input Context
        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }

        // Close Gemini Session
        // @ts-ignore
        liveSessionRef.current?.close?.();
        liveSessionRef.current = null;
        
        setStatus('idle');
    };

    return h('div', { className: `w-full h-screen bg-gray-900 text-white overflow-hidden flex flex-col ${theme} font-sans` },
        // Header
        h('header', { className: "p-4 flex justify-between items-center bg-black/20 z-10" },
            h('div', { className: "flex items-center gap-2" },
                h('div', { className: "w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20" }, "K"),
                h('span', { className: "font-bold text-lg tracking-tight" }, t('appName'))
            ),
            h('button', { onClick: () => setIsSettingsOpen(true), className: "p-2 hover:bg-white/10 rounded-full transition-colors" },
                h(SettingsIcon, { className: "w-6 h-6 text-gray-300" })
            )
        ),

        // Main Stage
        h('main', { className: "flex-1 flex flex-col items-center justify-center relative" },
            h(Avatar, { state: status === 'live' ? 'speaking' : status === 'connecting' ? 'thinking' : 'idle', mood: 'neutral', customUrl: avatarUrl }),
            
            h('div', { className: "mt-12 flex flex-col items-center gap-4" },
                h('div', { className: "text-cyan-400 font-mono text-sm tracking-[0.2em] uppercase" }, 
                    status === 'idle' ? 'SYSTEM READY' : 
                    status === 'connecting' ? 'INITIALIZING UPLINK...' : 
                    status === 'live' ? 'LIVE CONNECTION ESTABLISHED' : 'SYSTEM ERROR'
                ),
                
                status === 'idle' || status === 'error' ? 
                h('button', {
                    onClick: handleConnect,
                    className: "group relative flex items-center gap-3 px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-bold transition-all hover:scale-105 shadow-[0_0_40px_rgba(8,145,178,0.4)] hover:shadow-[0_0_60px_rgba(8,145,178,0.6)]"
                },
                    h(ConnectIcon, { className: "w-5 h-5" }),
                    h('span', null, "INITIATE LINK"),
                    h('div', { className: "absolute inset-0 rounded-full border border-white/20 animate-ping opacity-20" })
                ) :
                h('button', {
                    onClick: handleDisconnect,
                    className: "flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold transition-all hover:scale-105 shadow-[0_0_40px_rgba(220,38,38,0.4)]"
                },
                    h(DisconnectIcon, { className: "w-5 h-5" }),
                    h('span', null, "TERMINATE LINK")
                )
            ),
            
            errorMsg && h('div', { className: "mt-4 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm max-w-md text-center animate-fade-in" }, errorMsg)
        ),

        // Footer / Info
        h('footer', { className: "p-4 text-center text-gray-600 text-xs font-mono" },
            user ? `LOGGED IN AS: ${user.email}` : "GUEST ACCESS",
            " // V1.0.0"
        ),

        // Settings
        h(SettingsModal, {
            isOpen: isSettingsOpen,
            onClose: () => setIsSettingsOpen(false),
            activeTab, setActiveTab,
            theme, setTheme,
            gender, setGender,
            greetingMessage, setGreetingMessage,
            customInstructions, setCustomInstructions,
            userBio, setUserBio,
            emotionTuning, setEmotionTuning,
            apiKeys, setApiKeys,
            lang, setLang,
            femaleVoices, setFemaleVoices,
            maleVoices, setMaleVoices,
            ambientVolume, setAmbientVolume,
            avatarUrl, setAvatarUrl,
            subscriptionPlan, setSubscriptionPlan,
            dailyUsage,
            user, handleLogin, handleLogout
        })
    );
};
