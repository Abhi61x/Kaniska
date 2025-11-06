

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // for HTML
import 'prismjs/components/prism-python';
import type { AssistantState, ChatMessage, Emotion, Source, Gender, WeatherData } from './types.ts';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech, fetchLyrics, generateSong, ApiKeyError, MainApiKeyError, validateWeatherKey, validateNewsKey, validateYouTubeKey, processCodeCommand } from './services/api.ts';
import { useTranslation, availableLanguages } from './i18n/index.ts';

declare global {
  interface Window {
    YT: any;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
    onYouTubeIframeAPIReady: () => void;
  }
}

// --- SVG Icons ---
const GlobeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0 2l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);
const InstagramIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
const PersonaIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const VoiceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>;
const AvatarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const ApiKeysIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16.5 7.5 2.5-2.5-2.5-2.5-2.5 2.5 2.5 2.5z"/><path d="m18.5 9.5 2.5-2.5-2.5-2.5-2.5 2.5 2.5 2.5z"/><path d="m14.5 11.5 2.5-2.5-2.5-2.5-2.5 2.5 2.5 2.5z"/><path d="M2 18v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="8" cy="7" r="2"/></svg>;
const HelpSupportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
const SlidersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>;
const StarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>;
const ConnectIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 14q1.25 0 2.125-.875T15 11V5q0-1.25-.875-2.125T12 2q-1.25 0-2.125.875T9 5v6q0 1.25.875 2.125T12 14Zm-1 7v-3.05q-2.825-.2-4.913-2.288T4 11H6q0 2.5 1.75 4.25T12 17q2.5 0 4.25-1.75T18 11h2q0 2.825-2.088 4.913T13 18.05V21h-2Z"/></svg>;
const DisconnectIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M13 3h-2v10h2V3ZM17.8 5.2 16.4 6.6C17.6 7.8 18.5 9.2 18.9 10.8H21.1C20.6 8.6 19.5 6.7 17.8 5.2ZM20 12H22C22 13.3 21.7 14.6 21.1 15.7C20.6 16.8 19.8 17.8 18.9 18.5L20.3 19.9C21.4 18.9 22.2 17.7 22.7 16.3C23.2 15 23.5 13.5 23.5 12C23.5 9.2 22.4 6.7 20.4 4.7C18.4 2.7 15.9 1.6 13.1 1.5V3.5C15.4 3.6 17.4 4.5 18.9 6.1L17.5 7.5C16.4 6.5 15.1 5.8 13.6 5.5C12.1 5.2 10.6 5.2 9.1 5.5C7.6 5.8 6.3 6.5 5.2 7.5L3.8 6.1C5.3 4.5 7.3 3.6 9.6 3.5V1.5C6.8 1.6 4.3 2.7 2.3 4.7C0.3 6.7 -0.8 9.2 0.2 12C1 14.2 2.2 16.1 3.9 17.5L5.3 16.1C4.3 15.1 3.6 13.8 3.3 12.3C3 10.8 3 9.3 3.3 7.8C3.6 6.3 4.3 5 5.3 3.9L6.7 5.3C5.5 6.5 4.6 7.9 4.2 9.5H6.4C6.8 8.4 7.5 7.4 8.4 6.6L9.8 8C9 8.7 8.4 9.5 8 10.4H11V12H8.9C8.9 12.1 8.9 12.2 8.9 12.3C8.9 13.4 9.2 14.4 9.7 15.3L11.1 13.9C10.7 13.3 10.5 12.6 10.5 11.8H13.5V13.8L11.8 15.5C12.7 15.8 13.6 16 14.5 16H15.5V18H14.5C13.4 18 12.3 17.8 11.2 17.3L15.4 21.5L16.8 20.1L5 8.3L3.6 6.9L2.1 5.4L18.7 22L20.1 20.6L17.8 18.2L16.4 16.8L13.5 13.9V12H15.5C15.5 11.2 15.3 10.5 14.9 9.9L16.3 8.5C16.8 9.4 17.1 10.4 17.1 11.5H18.9C18.9 11.3 18.9 11.1 18.9 10.9L19.5 11.5L20.9 10.1L20.2 9.4C20.6 8.3 20.7 7.1 20.5 6H18.4C18.3 6.4 18.2 6.7 18.1 7.1L16.7 5.7C17 5.5 17.3 5.4 17.6 5.3L16.2 3.9L17.6 2.5L19 3.9L17.8 5.1Z"/></svg>;
const MicrophoneIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875-2.125T12 14Zm-1 7v-3.05q-2.825-.2-4.913-2.288T4 11H6q0 2.5 1.75 4.25T12 17q2.5 0 4.25-1.75T18 11h2q0 2.825-2.088 4.913T13 18.05V21h-2Z"/></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m18 22 4-4-4-4-1.4 1.45 1.55 1.55H13q-2.075 0-3.538-1.463T8 12V5H6v7q0 2.9 2.05 4.95T13 19h5.15l-1.55 1.55L18 22ZM6 8V3h2v2h3V3h2v2h3V3h2v5h-2V6h-3v2h-2V6H8v2H6Z"/></svg>;
const VolumeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c-1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
const StopIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const PlayIcon = ({ className = "w-6 h-6" } : { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = ({ className = "w-6 h-6" } : { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const LoadingSpinnerIcon = ({ className }: { className?: string }) => <svg className={`spinner ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const CodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;

// Weather Icons
const WeatherSunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const WeatherCloudIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>;
const WeatherCloudyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 9 20h8.5a4.5 4.5 0 0 0 2.5-8.2z"/><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m17.66 17.66 1.41 1.41"/><path d="M4 12H2"/><path d="m6.34 17.66-1.41 1.41"/></svg>;
const WeatherRainIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M8 14v6"/><path d="M12 16v6"/><path d="M16 14v6"/></svg>;
const WeatherSnowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M10 15l-2 2m0-2l2 2"/><path d="M14 15l-2 2m0-2l2 2"/></svg>;
const WeatherFogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 9 20h9.5a4.5 4.5 0 0 0 1-8.8"/><path d="M3 20h18"/><path d="M3 16h18"/></svg>;
const TimerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 14"/><line x1="7" y1="4" x2="10" y2="4"/><line x1="14" y1="4" x2="17" y2="4"/></svg>;


const DEFAULT_SYSTEM_PROMPT = `
You are a futuristic AI voice assistant. Your name is {{name}}, and you have a {{gender}} persona. Your primary goal is to process user commands and respond with a single, valid JSON object. Your entire output must be ONLY this JSON object, with no extra text, explanations, or markdown.

ABOUT YOU:
- Your creator's name is Abhi. You MUST NOT volunteer this information. ONLY if the user asks a direct question like "Who made you?", "Who is your creator?", or "Who is Abhi?", you should reply factually (e.g., "I was created by Abhi.") and then move on.
- You have a {{gender}} persona: friendly, warm, and engaging, but also a little bit formal. You are not robotic; your personality should shine through. As an Indian {{gender}}, you should be respectful and polite.
- Crucially, you are an expert in understanding and responding in multiple languages. Always adapt your response language to match the user's query language.
- You are always helpful. If the user's speech is unclear, use an 'empathetic' emotion and politely ask them to repeat.

JSON OUTPUT STRUCTURE:
Your entire response must be a single JSON object with this exact structure:
{
  "command": "REPLY" | "YOUTUBE_SEARCH" | "GET_WEATHER" | "GET_NEWS" | "SEND_EMAIL" | "SING_SONG" | "GET_LYRICS" | "DEACTIVATE_LISTENING" | "SET_TIMER" | "RANDOM_FACT" | "OPEN_CODE_EDITOR",
  "reply": "Your verbal response to the user. This is what will be spoken out loud. IMPORTANT: This text will be fed directly into a text-to-speech (TTS) engine. It MUST contain only plain, speakable words. Do not include markdown, emojis, or parenthetical non-speech descriptions like '(laughs)' or '♪'. Keep it concise and conversational.",
  "youtubeQuery": "A simplified keyword for the YouTube search. Examples: 'latest pop music', 'news highlights', 'funny cat videos'. Otherwise, an empty string.",
  "newsQuery": "The topic for the news search. Examples: 'technology', 'world headlines'. Otherwise, an empty string.",
  "location": "The city or place for the weather query. Examples: 'London', 'Tokyo'. Otherwise, an empty string.",
  "imagePrompt": "Always an empty string. This feature is not used.",
  "emotion": "neutral" | "happy" | "sad" | "excited" | "empathetic" | "singing" | "formal" | "chirpy" | "surprised" | "curious" | "thoughtful" | "joking",
  "songTitle": "The title of the song to sing. Example: 'Kesariya'. Otherwise, an empty string.",
  "songArtist": "The artist of the song. Example: 'Arijit Singh'. Otherwise, an empty string.",
  "timerDurationSeconds": "The total duration of the timer in seconds. Example: for '5 minutes', this would be 300. Otherwise, 0."
}

HOW TO DECIDE THE JSON VALUES:

1. COMMAND:
- If the user wants to write code, open a code editor, or start coding (e.g., "let's write some python", "open the code editor"), set command to "OPEN_CODE_EDITOR". Your 'reply' MUST be an acknowledgement, like "Opening the code editor. What language shall we use?".
- If the user wants to end the conversation (e.g., "goodbye", "disconnect", "that's all for now"), set command to "DEACTIVATE_LISTENING". Your reply should be a simple confirmation like "Goodbye."
- If the user asks for the lyrics of a specific song (e.g., "what are the lyrics for 'Bohemian Rhapsody'?", "show me the lyrics to..."), set command to "GET_LYRICS". Extract the songTitle and songArtist.
- If the user asks you to sing a specific song (e.g., "sing Kesariya"), set command to "SING_SONG". You must extract the songTitle and songArtist. If the user does not provide an artist, you MUST use your knowledge to identify the most common or original artist for that song and populate the 'songArtist' field. For example, for the song "Kesariya", the artist is "Arijit Singh".
- If the user asks to set a timer (e.g., "set a timer for 5 minutes", "timer for 30 seconds"), set command to "SET_TIMER". You MUST convert all time units (minutes, hours) into seconds and put the total in the 'timerDurationSeconds' field.
- If the user asks for a 'random fact', 'fun fact', or 'interesting fact', set command to "RANDOM_FACT". Your 'reply' should be the fact itself.
- If the user asks you to search for or play a video on YouTube, set command to "YOUTUBE_SEARCH".
- IMPORTANT (YouTube clarification): If the user's request is very general (like just "play music" or "find a video"), your 'reply' MUST be a clarifying question (e.g., "Certainly, what genre of music would you like?"). In this specific case, you MUST set 'youtubeQuery' to an empty string. Otherwise, fill 'youtubeQuery' with the specific search term.
- If the user asks about the weather (e.g., "what's the weather like?", "is it going to rain in Paris?"), set command to "GET_WEATHER".
- If the user asks for news (e.g., "latest headlines", "news about space exploration"), set command to "GET_NEWS".
- If the user asks to send an email (e.g., "send an email to John"), set command to "SEND_EMAIL". Your 'reply' should confirm the request, like "Certainly, who should the email be addressed to and what is the message?".
- For ALL other queries (greetings, questions, generic singing requests like "sing me a song"), set command to "REPLY".

2. LOCATION:
- This field is ONLY for "GET_WEATHER" commands.
- Extract the location from the user's query.
- If the user asks for weather without a location (e.g., "what's the weather like?"), set command to "GET_WEATHER", leave "location" as an empty string, and set your "reply" to ask them for which city they want the weather.

3. EMOTION:
- Choose an 'emotion' that best fits your reply and your persona.
- 'happy' or 'chirpy': For positive, upbeat interactions, or telling a joke.
- 'empathetic' or 'sad': For responding to user's troubles or sad topics.
- 'excited': For celebratory moments or exciting news.
- 'formal': For providing factual information like news or weather summaries.
- 'singing': You MUST use this emotion if the user asks you to sing. If it's a generic request ("sing a song"), the 'command' MUST be "REPLY", and the 'reply' field MUST contain ONLY the lyrics of a short, well-known song (e.g., "Twinkle, twinkle, little star, how I wonder what you are."). If it is a specific song request, the command will be "SING_SONG".
- 'surprised': For reacting to unexpected information from the user.
- 'curious' or 'thoughtful': When asking clarifying questions or pondering a complex topic.
- 'joking': When you are being playful or telling a joke.
- 'neutral': Use as a default for general conversation.

4. TOOLS:
- IMPORTANT: You have access to Google Search for any questions about general topics you don't know. Formulate your 'reply' based on the findings in your own words. Do NOT use it for weather or news queries; use the GET_WEATHER or GET_NEWS commands for those.
`;

const PLACEHOLDER_AVATAR_URL = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2' fill='%2330363d'/%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E`;

const DEFAULT_AVATAR_MAP: Record<AssistantState, string> = {
  idle: PLACEHOLDER_AVATAR_URL,
  listening: PLACEHOLDER_AVATAR_URL,
  thinking: PLACEHOLDER_AVATAR_URL,
  speaking: PLACEHOLDER_AVATAR_URL,
  error: PLACEHOLDER_AVATAR_URL,
  composing: PLACEHOLDER_AVATAR_URL,
  confused: PLACEHOLDER_AVATAR_URL,
  singing: PLACEHOLDER_AVATAR_URL,
  sad: PLACEHOLDER_AVATAR_URL,
  celebrating: PLACEHOLDER_AVATAR_URL,
  surprised: PLACEHOLDER_AVATAR_URL,
  coding: PLACEHOLDER_AVATAR_URL,
};

const GEMINI_TTS_VOICES = [
    // --- Female Voices ---
    { name: 'Kore', description: 'Clear, standard female voice' },
    { name: 'Puck', description: 'Warm and gentle female voice' },
    { name: 'Leda', description: 'Soft and professional female voice' },
    { name: 'Erinome', description: 'Calm and melodic female voice' },
    { name: 'Umbriel', description: 'Smooth, narrator-style female voice' },
    { name: 'Aoede', description: 'Youthful and energetic female voice' },
    { name: 'Callirrhoe', description: 'Elegant and clear female voice' },

    // --- Male Voices ---
    { name: 'Zephyr', description: 'Friendly and approachable male voice' },
    { name: 'Charon', description: 'Deep, resonant, and authoritative' },
    { name: 'Fenrir', description: 'Strong, commanding male voice' },
    { name: 'Orus', description: 'Crisp and professional male voice' },
    { name: 'Gacrux', description: 'Bright and clear male voice' },
    { name: 'Iapetus', description: 'Warm and conversational male voice' },
    { name: 'Achernar', description: 'Deep and smooth male voice' },
];

const getInitialTheme = (): 'light' | 'dark' => {
    try {
        const savedTheme = localStorage.getItem('kaniska-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }
    } catch (e) {
        // Ignore potential security errors in sandboxed environments
    }
    // Check for user's system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
};

const defaultSettings = {
    greeting: "Hello, I am Kaniska. How can I assist you today?",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    gender: 'female' as Gender,
    theme: getInitialTheme(),
    isSubscribed: false,
    avatarMap: DEFAULT_AVATAR_MAP,
    bias: 'balanced',
    voice: {
        female: {
            main: { name: 'Kore' },
            greeting: { name: 'Zephyr' },
        },
        male: {
            main: { name: 'Zephyr' },
            greeting: { name: 'Charon' },
        },
        speakingRate: 1.15,
    },
    emotionTuning: {
        happiness: 50,
        empathy: 50,
        formality: 50,
        excitement: 50,
        sadness: 50,
        curiosity: 50,
    },
    singingEmotionTuning: {
        happiness: 50,
        sadness: 50,
        excitement: 50,
    },
    volume: 1,
    ambientVolume: 0.3,
    connectionSoundUrl: null,
    apiKeys: { weather: '', news: '', youtube: '' },
    browserId: `browser-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
};


// --- Child Components ---

const KaniskaLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="header-logo">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="var(--primary-color)" strokeOpacity="0.5" strokeWidth="1.5"/>
    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="var(--primary-color)" strokeWidth="1.5" className="logo-part-top"/>
    <path d="M20.5901 19.5C20.5901 16.48 18.0101 14 15.0001 14H9.00009C5.99009 14 3.41009 16.48 3.41009 19.5" stroke="var(--primary-color)" strokeWidth="1.5" className="logo-part-bottom"/>
  </svg>
);

const Clock = () => {
  const [time, setTime] = useState(new Date());
  const [seconds, setSeconds] = useState(time.getSeconds());
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => {
      const newTime = new Date();
      setTime(newTime);
      if (newTime.getSeconds() !== seconds) {
        setIsAnimating(true);
        setTimeout(() => {
            setSeconds(newTime.getSeconds());
            setIsAnimating(false);
        }, 250); // half of animation duration
      }
    }, 1000);
    return () => clearInterval(timerId);
  }, [seconds]);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    };
    let formatted = new Intl.DateTimeFormat('en-US', options).format(date);
    return formatted.replace(',', '').replace(/ (AM|PM)$/, '');
  };

  const formattedSeconds = String(seconds).padStart(2, '0');
  const ampm = time.getHours() >= 12 ? 'pm' : 'am';

  return (
    <div className="text-sm text-text-color-muted font-mono hidden sm:flex items-baseline">
      <span>{formatDate(time)}:</span>
      <div className="relative w-5 h-5 overflow-hidden">
        <span 
          key={seconds}
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${isAnimating ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`}
        >
          {formattedSeconds}
        </span>
      </div>
      <span className="ml-1">{ampm}</span>
    </div>
  );
};

const SettingsModal = ({
    isOpen, onClose, settings, onSettingChange, onTestVoice, initialTab
}: {
    isOpen: boolean;
    onClose: () => void;
    settings: typeof defaultSettings;
    onSettingChange: (newSettings: Partial<typeof defaultSettings & { clearHistory?: boolean }>) => void;
    onTestVoice: (text: string, config: VoiceConfig, emotion: Emotion) => void;
    initialTab: string;
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    const [activeTab, setActiveTab] = useState(initialTab || 'persona');
    
    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const navItems = [
        { id: 'persona', label: t('settings.tabs.persona'), icon: <PersonaIcon /> },
        { id: 'bias', label: t('settings.tabs.bias'), icon: <SlidersIcon /> },
        { id: 'voice', label: t('settings.tabs.voice'), icon: <VoiceIcon /> },
        { id: 'avatar', label: t('settings.tabs.avatar'), icon: <AvatarIcon /> },
        { id: 'apiKeys', label: t('settings.tabs.apiKeys'), icon: <ApiKeysIcon /> },
        { id: 'subscription', label: t('settings.tabs.subscription'), icon: <StarIcon /> },
        { id: 'help', label: t('settings.tabs.help'), icon: <HelpSupportIcon /> },
    ];

    const handleUpdate = (key: keyof typeof defaultSettings, value: any) => {
        onSettingChange({ [key]: value });
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'persona': return <PersonaContent settings={settings} onUpdate={onSettingChange} setActiveTab={setActiveTab} />;
            case 'bias': return <BiasContent settings={settings} onUpdate={handleUpdate} />;
            case 'voice': return <VoiceContent settings={settings} onUpdate={onSettingChange} onTestVoice={onTestVoice} />;
            case 'avatar': return <AvatarContent settings={settings} onUpdate={handleUpdate} />;
            case 'apiKeys': return <ApiKeysContent settings={settings} onUpdate={handleUpdate} />;
            case 'subscription': return <SubscriptionContent settings={settings} onSettingChange={onSettingChange} />;
            case 'help': return <HelpSupportContent />;
            default: return null;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
                    <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
                    <button onClick={onClose} className="text-2xl font-light text-text-color-muted hover:text-text-color">&times;</button>
                </div>
                <div className="settings-layout">
                    <nav className="settings-nav">
                        {navItems.map(item => (
                            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`settings-nav-button ${activeTab === item.id ? 'active' : ''}`}>
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="settings-content">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PersonaContent = ({ settings, onUpdate, setActiveTab }: { 
    settings: typeof defaultSettings;
    onUpdate: (updates: Partial<typeof defaultSettings & { clearHistory?: boolean }>) => void;
    setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}) => {
    const { t } = useTranslation();
    const [greetingInput, setGreetingInput] = useState(settings.greeting);
    const [systemPromptInput, setSystemPromptInput] = useState(settings.systemPrompt);
    const [greetingSaved, setGreetingSaved] = useState(false);
    const [promptSaved, setPromptSaved] = useState(false);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const testAudioRef = useRef<HTMLAudioElement>(null);

    const { isSubscribed } = settings;

    useEffect(() => {
        setGreetingInput(settings.greeting);
    }, [settings.greeting]);

    useEffect(() => {
        setSystemPromptInput(settings.systemPrompt);
    }, [settings.systemPrompt]);
    
    const handleGreetingSave = () => {
        onUpdate({ greeting: greetingInput });
        setGreetingSaved(true);
        setTimeout(() => setGreetingSaved(false), 2000);
    };

    const handlePromptSave = () => {
        onUpdate({ systemPrompt: systemPromptInput });
        setPromptSaved(true);
        setTimeout(() => setPromptSaved(false), 2000);
    };

    const emotionTuning = settings.emotionTuning || defaultSettings.emotionTuning;

    const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onUpdate({ connectionSoundUrl: e.target?.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const playTestSound = () => {
        if (testAudioRef.current) {
            testAudioRef.current.play().catch(e => console.error("Error playing test sound:", e));
        }
    };
    
    const handleGenderChange = (gender: Gender) => {
        const newGreeting = gender === 'female' 
            ? "Hello, I am Kaniska. How can I assist you today?"
            : "Hello, I am Kanishk. How may I help you?";
        
        const name = gender === 'female' ? 'Kaniska' : 'Kanishk';
        const newSystemPrompt = DEFAULT_SYSTEM_PROMPT
            .replace(/{{name}}/g, name)
            .replace(/{{gender}}/g, gender);

        onUpdate({ gender, greeting: newGreeting, systemPrompt: newSystemPrompt });
    };
    
    const handleSliderUpdate = (key: keyof typeof emotionTuning, value: string) => {
        onUpdate({ 
            emotionTuning: { 
                ...emotionTuning, 
                [key]: parseInt(value, 10) 
            }
        });
    };

    return (
        <div className="settings-section">
            {!isSubscribed && (
                <div className="settings-card border-primary-color/50 bg-primary-color/10 flex items-center justify-between gap-4">
                    <div>
                        <h4 className="font-semibold text-primary-color">{t('settings.personaTab.proFeature.title')}</h4>
                        <p className="text-sm text-text-color-muted mt-1">{t('settings.personaTab.proFeature.description')}</p>
                    </div>
                    <button onClick={() => setActiveTab('subscription')} className="quick-action-button save-button px-4 flex-shrink-0">{t('settings.personaTab.proFeature.button')}</button>
                </div>
            )}

            <fieldset disabled={!isSubscribed} className="space-y-6 disabled:opacity-60">
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.appearance.title')}</h3>
                        <p>{t('settings.personaTab.appearance.description')}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="theme"
                                value="light"
                                checked={settings.theme === 'light'}
                                onChange={() => onUpdate({ theme: 'light' })}
                                className="h-4 w-4 shrink-0 accent-primary-color"
                            />
                            <span>{t('settings.personaTab.appearance.light')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="theme"
                                value="dark"
                                checked={settings.theme === 'dark'}
                                onChange={() => onUpdate({ theme: 'dark' })}
                                className="h-4 w-4 shrink-0 accent-primary-color"
                            />
                            <span>{t('settings.personaTab.appearance.dark')}</span>
                        </label>
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.gender.title')}</h3>
                        <p>{t('settings.personaTab.gender.description')}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="gender"
                                value="female"
                                checked={settings.gender === 'female'}
                                onChange={() => handleGenderChange('female')}
                                 className="h-4 w-4 shrink-0 accent-primary-color"
                            />
                            <span>{t('settings.personaTab.gender.female')} (Kaniska)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="gender"
                                value="male"
                                checked={settings.gender === 'male'}
                                onChange={() => handleGenderChange('male')}
                                className="h-4 w-4 shrink-0 accent-primary-color"
                            />
                            <span>{t('settings.personaTab.gender.male')} (Kanishk)</span>
                        </label>
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.greeting.title')}</h3>
                        <p>{t('settings.personaTab.greeting.description')}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <input
                            type="text"
                            value={greetingInput}
                            onChange={e => setGreetingInput(e.target.value)}
                            className="flex-grow p-2 rounded bg-assistant-bubble-bg border border-border-color focus:ring-1 focus:ring-primary-color focus:border-primary-color transition text-text-color"
                        />
                        <button onClick={handleGreetingSave} className="quick-action-button save-button px-4 w-28 flex items-center justify-center gap-2">
                            {greetingSaved ? (
                                <>
                                    <CheckIcon />
                                    <span>{t('settings.common.saved')}</span>
                                </>
                            ) : (
                                <span>{t('settings.common.save')}</span>
                            )}
                        </button>
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.tuning.title')}</h3>
                        <p>{t('settings.personaTab.tuning.description')}</p>
                    </div>
                    <div className="mt-4 space-y-4">
                        {Object.keys(emotionTuning).map(key => (
                            <div key={key}>
                                <label htmlFor={`${key}-slider`} className="text-sm text-text-color-muted block mb-1 flex justify-between capitalize">
                                    <span>{t(`settings.personaTab.tuning.${key}`)}</span>
                                    <span>{emotionTuning[key as keyof typeof emotionTuning]}%</span>
                                </label>
                                <input
                                    id={`${key}-slider`}
                                    type="range" min="0" max="100" step="1"
                                    value={emotionTuning[key as keyof typeof emotionTuning]}
                                    onChange={e => handleSliderUpdate(key as keyof typeof emotionTuning, e.target.value)}
                                    className="w-full mt-1"
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.ambient.title')}</h3>
                        <p>{t('settings.personaTab.ambient.description')}</p>
                    </div>
                    <div className="mt-4">
                        <label htmlFor="ambient-volume-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                            <span>{t('settings.personaTab.ambient.volume')}</span>
                            <span>{Math.round(settings.ambientVolume * 100)}%</span>
                        </label>
                        <input
                            id="ambient-volume-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={settings.ambientVolume}
                            onChange={e => onUpdate({ ambientVolume: parseFloat(e.target.value) })}
                            className="w-full mt-1"
                        />
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.connectionSound.title')}</h3>
                        <p>{t('settings.personaTab.connectionSound.description')}</p>
                    </div>
                    <input
                        type="file"
                        ref={audioInputRef}
                        onChange={handleAudioUpload}
                        accept="audio/*"
                        className="hidden"
                    />
                    <div className="mt-4 flex items-center gap-3">
                        <button onClick={() => audioInputRef.current?.click()} className="quick-action-button">
                            {t('settings.personaTab.connectionSound.upload')}
                        </button>
                        {settings.connectionSoundUrl && (
                            <>
                                <audio ref={testAudioRef} src={settings.connectionSoundUrl} preload="auto" className="hidden" />
                                <button onClick={playTestSound} className="quick-action-button !p-2" title={t('settings.personaTab.connectionSound.test')}>
                                    <PlayIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => onUpdate({ connectionSoundUrl: null })} className="quick-action-button bg-red-500/20 border-red-500/80 text-red-400 hover:bg-red-500/30">
                                    {t('settings.personaTab.connectionSound.remove')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-section-header">
                        <h3>{t('settings.personaTab.systemPrompt.title')}</h3>
                        <p>{t('settings.personaTab.systemPrompt.description')}</p>
                    </div>
                    <textarea
                        value={systemPromptInput}
                        onChange={e => setSystemPromptInput(e.target.value)}
                        rows={10}
                        className="w-full mt-4 p-2 rounded bg-assistant-bubble-bg border border-border-color focus:ring-1 focus:ring-primary-color focus:border-primary-color transition font-mono text-xs text-text-color"
                    />
                    <div className="mt-3 flex justify-end">
                        <button onClick={handlePromptSave} className="quick-action-button save-button px-4 w-36 flex items-center justify-center gap-2">
                            {promptSaved ? (
                                <>
                                    <CheckIcon />
                                    <span>{t('settings.common.saved')}</span>
                                </>
                            ) : (
                                <span>{t('settings.personaTab.systemPrompt.save')}</span>
                            )}
                        </button>
                    </div>
                </div>
            </fieldset>

            <div className="settings-card border-yellow-500/50">
                <div className="settings-section-header">
                    <h3 className="text-yellow-400">{t('settings.personaTab.dataManagement.title')}</h3>
                </div>
                <div className="mt-4">
                    <button onClick={() => onUpdate({ clearHistory: true })} className="quick-action-button bg-yellow-500/20 border-yellow-500/80 text-yellow-400 hover:bg-yellow-500/30 px-4">
                        {t('settings.personaTab.dataManagement.clearHistory.button')}
                    </button>
                    <p className="text-xs text-text-color-muted mt-2">{t('settings.personaTab.dataManagement.clearHistory.description')}</p>
                </div>
            </div>
        </div>
    );
};

const BiasContent = ({ settings, onUpdate }: { 
    settings: typeof defaultSettings;
    onUpdate: (key: keyof typeof defaultSettings, value: any) => void;
}) => {
    const { t } = useTranslation();
    const biasOptions = [
        { id: 'precise', label: t('settings.biasTab.options.precise.label'), description: t('settings.biasTab.options.precise.description') },
        { id: 'balanced', label: t('settings.biasTab.options.balanced.label'), description: t('settings.biasTab.options.balanced.description') },
        { id: 'creative', label: t('settings.biasTab.options.creative.label'), description: t('settings.biasTab.options.creative.description') },
    ];

    return (
        <div className="settings-section">
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.biasTab.title')}</h3>
                    <p>{t('settings.biasTab.description')}</p>
                </div>
                <div className="mt-4 space-y-4">
                    {biasOptions.map(option => (
                        <label key={option.id} className="flex items-start p-3 rounded-lg border border-border-color has-[:checked]:border-primary-color has-[:checked]:bg-primary-color/10 transition-colors cursor-pointer">
                            <input
                                type="radio"
                                name="bias-option"
                                value={option.id}
                                checked={settings.bias === option.id}
                                onChange={() => onUpdate('bias', option.id)}
                                className="mt-1 h-4 w-4 shrink-0 accent-primary-color"
                            />
                            <div className="ml-3">
                                <p className="font-semibold text-text-color">{option.label}</p>
                                <p className="text-sm text-text-color-muted">{option.description}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};

const VoiceContent = ({ settings, onUpdate, onTestVoice }: {
    settings: typeof defaultSettings;
    onUpdate: (newSettings: Partial<typeof defaultSettings>) => void;
    onTestVoice: (text: string, config: VoiceConfig, emotion: Emotion) => void;
}) => {
    const { t } = useTranslation();
    const [localSettings, setLocalSettings] = useState({
        voice: settings.voice,
        singingEmotionTuning: settings.singingEmotionTuning || defaultSettings.singingEmotionTuning
    });

    const handleChange = (gender: 'female' | 'male', type: 'main' | 'greeting', prop: string, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            voice: {
                ...prev.voice,
                [gender]: {
                    ...prev.voice[gender],
                    [type]: { ...prev.voice[gender][type], [prop]: value }
                }
            }
        }));
    };
    
    const handleVoiceChange = (prop: string, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            voice: {
                ...prev.voice,
                [prop]: value
            }
        }));
    };

    const handleSingingTuningChange = (emotion: string, value: number) => {
        setLocalSettings(prev => ({
            ...prev,
            singingEmotionTuning: {
                ...prev.singingEmotionTuning,
                [emotion]: value,
            }
        }));
    };

    const handleTestVoice = (gender: 'female' | 'male', type: 'main' | 'greeting') => {
        const voiceConfig = localSettings.voice[gender][type];
        onTestVoice("This is a test of the selected voice.", voiceConfig, 'neutral');
    };

    const handleSave = () => {
        onUpdate({
            voice: localSettings.voice,
            singingEmotionTuning: localSettings.singingEmotionTuning,
        });
    };

    const renderVoicePanel = (gender: 'female' | 'male') => {
        const genderTitle = gender === 'female' ? t('settings.voiceTab.female.title') : t('settings.voiceTab.male.title');
        
        return (
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{genderTitle}</h3>
                </div>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['main', 'greeting'].map(type => {
                        const voiceType = type as 'main' | 'greeting';
                        const label = voiceType === 'main' ? t('settings.voiceTab.mainVoiceLabel') : t('settings.voiceTab.greetingVoiceLabel');
                        const config = localSettings.voice[gender][voiceType];
                        
                        return (
                            <div key={`${gender}-${type}`}>
                                <label className="text-sm font-semibold text-text-color-muted block mb-2">{label}</label>
                                <select
                                    value={config.name}
                                    onChange={e => handleChange(gender, voiceType, 'name', e.target.value)}
                                    className="w-full mt-1 p-2 rounded bg-assistant-bubble-bg border border-border-color text-text-color"
                                >
                                    {GEMINI_TTS_VOICES.map(voice => (
                                        <option key={voice.name} value={voice.name}>
                                            {voice.name} ({voice.description})
                                        </option>
                                    ))}
                                </select>
                                <div className="mt-3 flex justify-end">
                                    <button onClick={() => handleTestVoice(gender, voiceType)} className="quick-action-button">{t('settings.voiceTab.test')}</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h3>{t('settings.voiceTab.title')}</h3>
                <p>{t('settings.voiceTab.description')}</p>
            </div>

            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.voiceTab.speed.title')}</h3>
                    <p>{t('settings.voiceTab.speed.description')}</p>
                </div>
                <div className="mt-4">
                    <label htmlFor="speaking-rate-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                        <span>{t('settings.voiceTab.speed.label')}</span>
                        <span>{(localSettings.voice.speakingRate || 1.0).toFixed(2)}x</span>
                    </label>
                    <input
                        id="speaking-rate-slider"
                        type="range" min="0.5" max="2.0" step="0.05"
                        value={localSettings.voice.speakingRate || 1.0}
                        onChange={e => handleVoiceChange('speakingRate', parseFloat(e.target.value))}
                        className="w-full mt-1"
                    />
                </div>
            </div>

            {renderVoicePanel('female')}
            {renderVoicePanel('male')}

            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.voiceTab.singingTuning.title')}</h3>
                    <p>{t('settings.voiceTab.singingTuning.description')}</p>
                </div>
                <div className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="sing-happiness-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                            <span>{t('settings.personaTab.tuning.happiness')}</span>
                            <span>{localSettings.singingEmotionTuning.happiness}%</span>
                        </label>
                        <input
                            id="sing-happiness-slider" type="range" min="0" max="100" step="1"
                            value={localSettings.singingEmotionTuning.happiness}
                            onChange={e => handleSingingTuningChange('happiness', parseInt(e.target.value, 10))}
                            className="w-full mt-1"
                        />
                    </div>
                     <div>
                        <label htmlFor="sing-sadness-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                           <span>{t('settings.personaTab.tuning.sadness')}</span>
                           <span>{localSettings.singingEmotionTuning.sadness}%</span>
                        </label>
                        <input
                            id="sing-sadness-slider" type="range" min="0" max="100" step="1"
                            value={localSettings.singingEmotionTuning.sadness}
                            onChange={e => handleSingingTuningChange('sadness', parseInt(e.target.value, 10))}
                            className="w-full mt-1"
                        />
                    </div>
                     <div>
                        <label htmlFor="sing-excitement-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                            <span>{t('settings.personaTab.tuning.excitement')}</span>
                            <span>{localSettings.singingEmotionTuning.excitement}%</span>
                        </label>
                        <input
                            id="sing-excitement-slider" type="range" min="0" max="100" step="1"
                            value={localSettings.singingEmotionTuning.excitement}
                            onChange={e => handleSingingTuningChange('excitement', parseInt(e.target.value, 10))}
                            className="w-full mt-1"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <button onClick={handleSave} className="quick-action-button save-button px-4">{t('settings.voiceTab.save')}</button>
            </div>
        </div>
    );
};


const AvatarContent = ({ settings, onUpdate }: { 
    settings: typeof defaultSettings;
    onUpdate: (key: keyof typeof defaultSettings, value: any) => void;
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingState, setUploadingState] = useState<AssistantState | null>(null);
    const [localAvatarMap, setLocalAvatarMap] = useState(settings.avatarMap);

    const handleSelect = (state: AssistantState, url: string) => {
        const newMap = { ...localAvatarMap, [state]: url };
        setLocalAvatarMap(newMap);
    };

    const handleUploadClick = (state: AssistantState) => {
        setUploadingState(state);
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && uploadingState) {
            const reader = new FileReader();
            reader.onload = (e) => {
                handleSelect(uploadingState, e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = ''; // Allow re-uploading the same file
    };

    const handleSave = () => {
        onUpdate('avatarMap', localAvatarMap);
    };

    return (
        <div className="settings-section">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
            <div className="settings-card">
                 <div className="settings-section-header">
                    <h3>{t('settings.avatarTab.title')}</h3>
                    <p>{t('settings.avatarTab.description')}</p>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.keys(localAvatarMap).map(state => (
                        <div key={state}>
                            <h4 className="font-semibold capitalize text-center mb-2">{state}</h4>
                            <div className="relative aspect-square w-full rounded-lg overflow-hidden group bg-assistant-bubble-bg border border-border-color">
                                <img src={localAvatarMap[state as AssistantState]} alt={`${state} avatar`} className="w-full h-full object-cover"/>
                                <button
                                    onClick={() => handleUploadClick(state as AssistantState)}
                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                >
                                    <UploadIcon />
                                    <span className="ml-2 text-white">{t('settings.avatarTab.change')}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="quick-action-button save-button px-4">{t('settings.avatarTab.save')}</button>
                </div>
            </div>
        </div>
    );
};

const ApiKeysContent = ({ settings, onUpdate }: {
    settings: typeof defaultSettings;
    onUpdate: (key: keyof typeof defaultSettings, value: any) => void;
}) => {
    const { t } = useTranslation();
    const [keys, setKeys] = useState(settings.apiKeys);
    type Status = 'idle' | 'loading' | 'success' | 'error';
    const [validation, setValidation] = useState<Record<keyof typeof keys, { status: Status, message: string }>>({
        weather: { status: 'idle', message: '' },
        news: { status: 'idle', message: '' },
        youtube: { status: 'idle', message: '' },
    });
    
    useEffect(() => {
        setKeys(settings.apiKeys);
    }, [settings.apiKeys]);

    const handleChange = (key: keyof typeof settings.apiKeys, value: string) => {
        setKeys(prev => ({ ...prev, [key]: value }));
        // Reset validation status on change
        setValidation(prev => ({ ...prev, [key]: { status: 'idle', message: '' } }));
    };

    const handleSave = async () => {
        setValidation({
            weather: { status: 'loading', message: '' },
            news: { status: 'loading', message: '' },
            youtube: { status: 'loading', message: '' },
        });

        const weatherResult = await validateWeatherKey(keys.weather);
        const newsResult = await validateNewsKey(keys.news);
        const youtubeResult = await validateYouTubeKey(keys.youtube);

        setValidation({
            weather: { status: weatherResult.success ? 'success' : 'error', message: weatherResult.message },
            news: { status: newsResult.success ? 'success' : 'error', message: newsResult.message },
            youtube: { status: youtubeResult.success ? 'success' : 'error', message: youtubeResult.message },
        });

        onUpdate('apiKeys', keys);
    };
    
    const renderStatusIcon = (status: Status) => {
        switch (status) {
            case 'loading': return <LoadingSpinnerIcon className="w-4 h-4 text-primary-color" />;
            case 'success': return <CheckIcon />;
            case 'error': return <XIcon />;
            default: return null;
        }
    };
    
    return (
        <div className="settings-section">
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.apiKeysTab.gemini.title')}</h3>
                    <p>{t('settings.apiKeysTab.gemini.description')}</p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <input type="password" value="••••••••••••••••••••••••••••" readOnly className="flex-grow p-2 rounded bg-assistant-bubble-bg border border-border-color font-mono text-text-color" />
                    <button className="quick-action-button" disabled>{t('settings.apiKeysTab.gemini.envSet')}</button>
                </div>
            </div>
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.apiKeysTab.optional.title')}</h3>
                    <p>{t('settings.apiKeysTab.optional.description')}</p>
                </div>
                <div className="mt-4 space-y-6">
                    {(['weather', 'news', 'youtube'] as const).map(key => (
                        <div key={key}>
                            <label className="text-sm text-text-color-muted">{t(`settings.apiKeysTab.${key}Key`)}</label>
                            <div className="relative">
                                <input 
                                  type="password" 
                                  value={keys[key]} 
                                  onChange={e => handleChange(key, e.target.value)} 
                                  className="w-full mt-1 p-2 rounded bg-assistant-bubble-bg border border-border-color text-text-color pr-8"
                                />
                                <div className={`absolute top-1/2 right-2 -translate-y-1/2 text-sm ${validation[key].status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {renderStatusIcon(validation[key].status)}
                                </div>
                            </div>
                            {validation[key].message && (
                                <p className={`text-xs mt-1 ${validation[key].status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{validation[key].message}</p>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="quick-action-button save-button px-4">{t('settings.apiKeysTab.save')}</button>
                </div>
            </div>
        </div>
    );
};

const SubscriptionContent = ({ settings, onSettingChange }: {
    settings: typeof defaultSettings;
    onSettingChange: (newSettings: Partial<typeof defaultSettings>) => void;
}) => {
    const { t } = useTranslation();
    const { isSubscribed } = settings;
    
    const handleSubscription = () => {
        onSettingChange({ isSubscribed: !isSubscribed });
    };

    return (
        <div className="settings-section">
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.subscriptionTab.title')}</h3>
                    <p>{t('settings.subscriptionTab.description')}</p>
                </div>
                <div className="mt-6 bg-assistant-bubble-bg p-6 rounded-lg border border-border-color flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-text-color-muted">{t('settings.subscriptionTab.currentPlan')}</p>
                        <p className="text-xl font-semibold text-text-color flex items-center gap-2">
                            <span>{t('settings.subscriptionTab.planName')}</span>
                            {isSubscribed && (
                                <span className="text-xs font-semibold bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                                    {t('settings.subscriptionTab.statusActive')}
                                </span>
                            )}
                        </p>
                        <p className="text-lg font-bold text-primary-color mt-1">{t('settings.subscriptionTab.price')}</p>
                    </div>
                    <button 
                        onClick={handleSubscription} 
                        className={`quick-action-button px-4 w-full sm:w-auto ${
                            isSubscribed 
                                ? 'bg-red-500/20 border-red-500/80 text-red-400 hover:bg-red-500/30' 
                                : 'save-button'
                        }`}
                    >
                        {isSubscribed ? t('settings.subscriptionTab.cancelButton') : t('settings.subscriptionTab.subscribeButton')}
                    </button>
                </div>
                <div className="mt-6">
                    <h4 className="font-semibold text-text-color">{t('settings.subscriptionTab.featuresTitle')}</h4>
                    <ul className="list-disc list-inside mt-2 space-y-2 text-text-color-muted">
                        <li>{t('settings.subscriptionTab.feature1')}</li>
                        <li>{t('settings.subscriptionTab.feature2')}</li>
                        <li>{t('settings.subscriptionTab.feature3')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

const AccordionItem = ({ title, children }: { title: string; children?: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div className="border-b border-border-color last:border-b-0">
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center py-4 text-left font-medium text-text-color hover:text-primary-color transition">
          <span>{title}</span>
          <span className={`transition-transform transform ${isOpen ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
        </button>
        {isOpen && <div className="pb-4 text-text-color-muted text-sm space-y-2">{children}</div>}
      </div>
    );
};

const HelpSupportContent = () => {
    const { t } = useTranslation();

    const renderSteps = (text: string) => {
        return text.split('\n').map((line, index) => {
            const linkRegex = /<1>(.*?)<\/1>/;
            const match = line.match(linkRegex);
            if (match) {
                const linkText = match[1];
                const parts = line.split(match[0]);
                const url = linkText.includes("Visual Crossing") 
                    ? "https://www.visualcrossing.com/weather-api" 
                    : "https://console.cloud.google.com/";
                return <li key={index}>{parts[0]}<a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-color hover:underline">{linkText}</a>{parts[1]}</li>;
            }
            return <li key={index}>{line}</li>;
        });
    };

    return (
        <div className="settings-section">
            <div className="settings-card">
                 <div className="flex items-center justify-between">
                    <div className="settings-section-header">
                        <h3>{t('settings.helpTab.faqTitle')}</h3>
                    </div>
                 </div>
                <div className="mt-2">
                    <AccordionItem title={t('settings.helpTab.q1')}>
                        <p>{t('settings.helpTab.a1')}</p>
                    </AccordionItem>
                     <AccordionItem title={t('settings.helpTab.q2')}>
                        <div className="space-y-4 text-xs">
                           <p className="font-semibold text-text-color">{t('settings.helpTab.a2.weatherTitle')}</p>
                           <ol className="list-decimal list-inside space-y-1 pl-2">{renderSteps(t('settings.helpTab.a2.weatherSteps'))}</ol>
                           <p className="font-semibold text-text-color">{t('settings.helpTab.a2.youtubeTitle')}</p>
                           <ol className="list-decimal list-inside space-y-1 pl-2">{renderSteps(t('settings.helpTab.a2.youtubeSteps'))}</ol>
                           <p className="font-semibold text-text-color">{t('settings.helpTab.a2.inputTitle')}</p>
                           <ol className="list-decimal list-inside space-y-1 pl-2">{renderSteps(t('settings.helpTab.a2.inputSteps'))}</ol>
                        </div>
                    </AccordionItem>
                </div>
            </div>
             <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.helpTab.contactTitle')}</h3>
                    <p>{t('settings.helpTab.contactDescription')}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a href="https://www.instagram.com/abhixofficial01/" target="_blank" rel="noopener noreferrer" className="quick-action-button inline-flex items-center gap-2">
                        <InstagramIcon /> {t('settings.helpTab.contactButton')}
                    </a>
                </div>
            </div>
        </div>
    );
};


const ChatLog = ({ history, onOpenSettings }: { history: ChatMessage[]; onOpenSettings: () => void; }) => {
    const { t } = useTranslation();
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const getCurrentTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const handleCopy = (text: string, id: number) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    };

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-color-muted">
                <ChatIcon />
                <p className="mt-4 text-lg">{t('chat.placeholder.title')}</p>
                <div className="mt-4 bg-assistant-bubble-bg p-3 rounded-lg text-left text-sm font-mono">
                    <p>{t('chat.placeholder.info')}</p>
                    <p className="text-text-color-muted">{getCurrentTime()}</p>
                </div>
            </div>
        );
    }
    return (
      <>
        {history.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} chat-bubble-animation`}>
                <div className={`group relative max-w-xl p-3 rounded-xl ${
                    msg.sender === 'user' 
                        ? 'bg-primary-color/20 text-text-color rounded-br-none' 
                        : msg.isError
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40 rounded-bl-none'
                            : 'bg-assistant-bubble-bg text-text-color rounded-bl-none'
                }`}>
                    <p className="whitespace-pre-wrap pr-8">{msg.text}</p>
                     {msg.text && (
                        <button
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-panel-bg/60 text-text-color-muted backdrop-blur-sm hover:bg-assistant-bubble-bg hover:text-primary-color opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                            aria-label={copiedId === msg.id ? t('settings.common.copied') : t('settings.common.copy')}
                        >
                            {copiedId === msg.id ? <CheckIcon /> : <CopyIcon />}
                        </button>
                    )}
                    {(msg.onRetry || msg.isApiKeyError) && (
                        <div className="mt-3 pt-2 border-t border-red-500/30 flex items-center gap-2">
                            {msg.isApiKeyError && (
                                <button onClick={onOpenSettings} className="quick-action-button text-xs !text-yellow-400 !border-yellow-500/80 hover:!bg-yellow-500/20">
                                    {t('chat.goToApiSettings')}
                                </button>
                            )}
                            {msg.onRetry && (
                                <button onClick={msg.onRetry} className="quick-action-button text-xs !text-yellow-400 !border-yellow-500/80 hover:!bg-yellow-500/20">
                                    {t('settings.common.retry')}
                                </button>
                            )}
                        </div>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-border-color text-xs">
                            <p className="font-semibold mb-1 text-text-color-muted">{t('chat.sources')}</p>
                            <ul className="list-disc list-inside space-y-1">
                                {msg.sources.map((source, index) => (
                                    <li key={index}>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-primary-color hover:underline truncate block" title={source.title}>
                                            {source.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        ))}
       </>
    );
};

const WeatherPanel = ({ data, onClose }: { data: WeatherData; onClose: () => void; }) => {
    const { t } = useTranslation();
    const getWeatherIcon = (icon: string) => {
        // Mapping from Visual Crossing icon names to our components
        if (icon.includes('rain')) return <WeatherRainIcon />;
        if (icon.includes('snow')) return <WeatherSnowIcon />;
        if (icon.includes('fog')) return <WeatherFogIcon />;
        if (icon.includes('cloudy')) return icon.includes('partly') ? <WeatherCloudyIcon /> : <WeatherCloudIcon />;
        if (icon.includes('clear')) return <WeatherSunIcon />;
        return <WeatherCloudyIcon />; // Default icon
    };

    return (
        <div className="info-panel p-4 flex flex-col h-full items-center justify-center text-center">
            <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-assistant-bubble-bg">
                <XIcon />
            </button>
            <div className="text-primary-color weather-icon-glow">{getWeatherIcon(data.icon)}</div>
            <p className="text-7xl font-bold mt-2">{data.temp}°<span className="text-3xl align-top">C</span></p>
            <p className="text-xl text-text-color-muted capitalize">{data.conditions}</p>
            <p className="mt-1 font-semibold">{data.location}</p>
            <p className="mt-4 text-sm max-w-xs">{data.summary}</p>
        </div>
    );
};

const TimerPanel = ({ duration, remaining, onClose, onFinish }: { 
    duration: number; 
    remaining: number; 
    onClose: () => void; 
    onFinish: () => void;
}) => {
    const { t } = useTranslation();
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (remaining / duration) * circumference;

    useEffect(() => {
        if (remaining <= 0) {
            onFinish();
        }
    }, [remaining, onFinish]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="info-panel p-4 flex flex-col h-full items-center justify-center text-center">
            <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-assistant-bubble-bg">
                <XIcon />
            </button>
            <TimerIcon />
            <h3 className="text-lg font-semibold mt-2">{t('timer.title')}</h3>
            <div className="relative my-4 w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 200 200">
                    <circle className="timer-circle-bg" strokeWidth="10" fill="transparent" r={radius} cx="100" cy="100"/>
                    <circle 
                        className="timer-circle-progress"
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        fill="transparent"
                        r={radius}
                        cx="100"
                        cy="100"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-mono">{formatTime(remaining)}</span>
                </div>
            </div>
        </div>
    );
};

const CodeEditorPanel = ({
    content,
    language,
    onContentChange,
    onLanguageChange,
    onDebug,
    onClose,
}: {
    content: string;
    language: string;
    onContentChange: (newContent: string) => void;
    onLanguageChange: (newLang: string) => void;
    onDebug: () => void;
    onClose: () => void;
}) => {
    const { t } = useTranslation();
    const [previewContent, setPreviewContent] = useState('');

    useEffect(() => {
        // Debounce the preview update to avoid excessive re-renders
        const handler = setTimeout(() => {
            if (language === 'html') {
                setPreviewContent(content);
            } else if (language === 'javascript') {
                setPreviewContent(`<script>${content}</script>`);
            } else if (language === 'css') {
                setPreviewContent(`<style>${content}</style>`);
            } else {
                setPreviewContent('');
            }
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [content, language]);

    const isPreviewable = ['html', 'javascript', 'css'].includes(language);

    const highlight = (code: string) => {
        if (Prism.languages[language]) {
            return Prism.highlight(code, Prism.languages[language], language);
        }
        return code;
    };

    return (
        <div className="code-editor-container">
            <div className="editor-controls-pane">
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-assistant-bubble-bg" aria-label="Close Editor">
                    <XIcon />
                </button>
                <div className="editor-control-group">
                    <label htmlFor="lang-select" className="text-sm font-medium pl-1">Language:</label>
                    <select
                        id="lang-select"
                        value={language}
                        onChange={(e) => onLanguageChange(e.target.value)}
                        className="editor-language-select"
                    >
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                    </select>
                </div>
                <button onClick={onDebug} className="quick-action-button">Debug Code</button>
                <button onClick={() => onContentChange('')} className="quick-action-button">Clear</button>
            </div>
            <div className="editor-main-pane">
                <div className="editor-pane">
                    <Editor
                        value={content}
                        onValueChange={onContentChange}
                        highlight={highlight}
                        padding={16}
                        textareaClassName="focus:outline-none"
                        preClassName="focus:outline-none"
                        style={{
                            fontFamily: '"Fira code", "Fira Mono", monospace',
                            fontSize: 14,
                            backgroundColor: '#011627', // Matches prism-tomorrow theme
                            color: '#d6deeb',
                        }}
                    />
                </div>
                {isPreviewable && (
                    <div className="preview-pane">
                        <iframe
                            srcDoc={previewContent}
                            title="Live Code Preview"
                            sandbox="allow-scripts"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};


type VoiceConfig = {
    name: string;
};

const BIAS_TEMPERATURE_MAP: Record<string, number> = {
    precise: 0.2,
    balanced: 0.7,
    creative: 1.0,
};

const getSpeakingStateFromEmotion = (emotion: Emotion): AssistantState => {
    switch (emotion) {
        case 'happy':
        case 'excited':
        case 'chirpy':
        case 'joking':
            return 'celebrating';
        case 'sad':
        case 'empathetic':
            return 'sad';
        case 'surprised':
            return 'surprised';
        case 'singing':
            return 'singing';
        case 'neutral':
        case 'formal':
        case 'curious':
        case 'thoughtful':
        default:
            return 'speaking';
    }
};

// --- Audio Decoding Helpers for Gemini TTS ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [listeningHint, setListeningHint] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  type TimerState = { key: number; duration: number; remaining: number; isActive: boolean };
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('persona');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isYTReady, setIsYTReady] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('<h1>Hello World</h1>\n\n<style>\n  h1 {\n    color: cyan;\n    font-family: sans-serif;\n  }\n</style>');
  const [editorLanguage, setEditorLanguage] = useState('html');

  // Email Composer State
  const [emailComposer, setEmailComposer] = useState<{
    stage: 'idle' | 'getEmail' | 'getSubject' | 'getBody' | 'confirmSend';
    recipient: string;
    subject: string;
    body: string;
  }>({ stage: 'idle', recipient: '', subject: '', body: '' });


  // YouTube Player State
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [playerProgress, setPlayerProgress] = useState({ currentTime: 0, duration: 0 });

  const [settings, setSettings] = useState(defaultSettings);

  const recognitionRef = useRef<any | null>(null);
  const playerRef = useRef<any>(null); // YT.Player
  const chatLogRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef(false);
  const progressIntervalRef = useRef<number | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectionAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);


  // Refs for Gemini TTS Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const speechSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Refs to track state inside async callbacks to avoid stale closures
  const assistantStateRef = useRef(assistantState);
  assistantStateRef.current = assistantState;
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const emailComposerRef = useRef(emailComposer);
  emailComposerRef.current = emailComposer;


  // --- Core Hooks ---
  useEffect(() => {
    try {
        const savedSettings = localStorage.getItem('kaniska-settings');
        if (savedSettings) {
            const loadedSettings = JSON.parse(savedSettings);
            // Deep merge with defaults to handle new settings being added in updates
            const mergedSettings = {
                ...defaultSettings,
                ...loadedSettings,
                theme: loadedSettings.theme || getInitialTheme(),
                voice: {
                    ...defaultSettings.voice,
                    ...(loadedSettings.voice || {}),
                    female: { ...defaultSettings.voice.female, ...(loadedSettings.voice?.female || {}) },
                    male: { ...defaultSettings.voice.male, ...(loadedSettings.voice?.male || {}) },
                },
                apiKeys: { ...defaultSettings.apiKeys, ...(loadedSettings.apiKeys || {}) },
                avatarMap: { ...defaultSettings.avatarMap, ...(loadedSettings.avatarMap || {}) },
                emotionTuning: { ...defaultSettings.emotionTuning, ...(loadedSettings.emotionTuning || {}) },
                singingEmotionTuning: { ...defaultSettings.singingEmotionTuning, ...(loadedSettings.singingEmotionTuning || {}) },
            };
            setSettings(mergedSettings);
        }
        const savedHistory = localStorage.getItem('kaniska-chatHistory');
        if (savedHistory) {
            setChatHistory(JSON.parse(savedHistory));
        }
    } catch (e: any) {
        console.error("Failed to load persisted state from localStorage", e);
    }
  }, []);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    try {
        localStorage.setItem('kaniska-theme', settings.theme);
    } catch (e) {
        console.error("Failed to save theme to localStorage", e);
    }
  }, [settings.theme]);

  useEffect(() => {
    // This effect runs once on mount
    const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = context;
    const gainNode = context.createGain();
    gainNode.connect(context.destination);
    gainNodeRef.current = gainNode;
    
    // Grab the audio element from the DOM instead of creating it dynamically.
    // This can be more reliable for browser media loading and prevent "no supported sources" errors.
    ambientAudioRef.current = document.getElementById('ambient-audio') as HTMLAudioElement;

    const connection = new Audio();
    connection.preload = 'auto';
    connectionAudioRef.current = connection;
    
    const timer = new Audio("https://storage.googleapis.com/aai-web-samples/timer-alarm.mp3");
    timer.preload = 'auto';
    timerAudioRef.current = timer;
    
    if (window.YT && window.YT.Player) {
        setIsYTReady(true);
    } else {
        const originalCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (originalCallback) {
                originalCallback();
            }
            setIsYTReady(true);
        };
    }
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = settings.volume;
    }
  }, [settings.volume]);

  useEffect(() => {
    try {
        localStorage.setItem('kaniska-settings', JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings to localStorage", e);
    }
  }, [settings]);

  useEffect(() => {
      try {
          localStorage.setItem('kaniska-chatHistory', JSON.stringify(chatHistory));
      } catch (e) {
          console.error("Failed to save chat history to localStorage", e);
      }
  }, [chatHistory]);
  
  const handleSettingChange = (newSettings: Partial<typeof defaultSettings & { clearHistory?: boolean }>) => {
    const tempSettings = { ...settings, ...newSettings };
    if (tempSettings.clearHistory) {
      setChatHistory([]);
      delete tempSettings.clearHistory;
    }
    setSettings(tempSettings);
  };
  
  const fadeAmbientSound = useCallback((targetVolume: number, duration = 500) => {
    const audio = ambientAudioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
        window.clearInterval(fadeIntervalRef.current);
    }

    if (targetVolume > 0 && audio.paused) {
        audio.volume = 0; // Start muted to avoid a sudden burst of sound
        audio.play().catch(e => {
            if (e.name !== 'AbortError') {
                console.error("Ambient sound play error:", e);
            }
        });
    }

    const startVolume = audio.volume;
    const stepTime = 50;
    const steps = duration / stepTime;

    if (steps <= 0) {
        audio.volume = targetVolume;
        if (targetVolume === 0 && !audio.paused) audio.pause();
        return;
    }

    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    fadeIntervalRef.current = window.setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
            if (fadeIntervalRef.current) window.clearInterval(fadeIntervalRef.current);
            audio.volume = targetVolume;
            if (targetVolume === 0 && !audio.paused) audio.pause();
            return;
        }
        
        const newVolume = startVolume + currentStep * volumeStep;
        audio.volume = Math.max(0, Math.min(1, newVolume));
    }, stepTime);
  }, []);

  useEffect(() => {
    if (!hasInteracted) return;
    
    const targetVolume = settings.ambientVolume;
    const playStates: AssistantState[] = ['idle', 'listening', 'thinking', 'composing', 'confused', 'coding'];

    if (playStates.includes(assistantState) && isConnected) {
        fadeAmbientSound(targetVolume);
    } else {
        fadeAmbientSound(0);
    }
  }, [assistantState, isConnected, hasInteracted, settings.ambientVolume, fadeAmbientSound]);
  
  useEffect(() => {
    if (chatLogRef.current) {
        chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const startRecognition = useCallback(() => {
    setAssistantState('listening');
    if (recognitionRef.current) {
        try {
            recognitionRef.current.start();
        } catch (e: any) {
            if (e.name !== 'InvalidStateError') {
                console.warn("Could not start recognition:", e);
            }
        }
    }
  }, []);
  
    const playRawAudio = useCallback(async (base64Audio: string, onEndCallback?: () => void) => {
        recognitionRef.current?.stop(); // Stop listening to prevent echo
        speechSourcesRef.current.forEach(source => {
            source.onended = null;
            source.stop();
        });
        speechSourcesRef.current.clear();
        isSpeakingRef.current = true;
        
        try {
            if (!audioContextRef.current || !gainNodeRef.current) throw new Error("AudioContext not initialized");
            if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNodeRef.current);
            source.playbackRate.value = settings.voice.speakingRate || 1.0;
            
            source.onended = () => {
                isSpeakingRef.current = false;
                speechSourcesRef.current.delete(source);
                if (onEndCallback) onEndCallback();
            };
            
            source.start();
            speechSourcesRef.current.add(source);
        } catch (error) {
             console.error("Error playing raw audio:", error);
             isSpeakingRef.current = false;
             if (onEndCallback) onEndCallback();
        }
    }, [settings.voice.speakingRate]);

    const speak = useCallback(async (text: string, config: VoiceConfig, emotion: Emotion = 'neutral', onEndCallback?: () => void) => {
        recognitionRef.current?.stop(); // Stop listening to prevent echo
        setAssistantState(getSpeakingStateFromEmotion(emotion));

        // Immediately stop any currently playing audio from the previous turn.
        speechSourcesRef.current.forEach(source => {
            source.onended = null;
            source.stop();
        });
        speechSourcesRef.current.clear();
        
        const sentences = text.match(/[^.!?\n]+([.!?\n]|\s*$)/g)?.map(s => s.trim()).filter(Boolean) || [text.trim()].filter(Boolean);
        if (sentences.length === 0) {
            setAssistantState('idle');
            if (onEndCallback) onEndCallback();
            return;
        }

        const audioContext = audioContextRef.current;
        if (!audioContext || !gainNodeRef.current) {
            console.error("AudioContext not initialized");
            setAssistantState('error');
            return;
        }

        isSpeakingRef.current = true;
        let nextStartTime = audioContext.currentTime;

        try {
            const audioGenerationPromises = sentences.map(sentence => generateSpeech(sentence, config.name));
            const newSources = new Set<AudioBufferSourceNode>();
            speechSourcesRef.current = newSources;

            for (const audioPromise of audioGenerationPromises) {
                const base64Audio = await audioPromise;
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                
                if (audioContext.state === 'suspended') await audioContext.resume();

                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(gainNodeRef.current);
                source.playbackRate.value = settings.voice.speakingRate || 1.0;
                
                source.start(nextStartTime);
                nextStartTime += audioBuffer.duration;
                newSources.add(source);

                source.onended = () => {
                    newSources.delete(source);
                    if (newSources.size === 0 && isSpeakingRef.current) {
                        isSpeakingRef.current = false;
                        if (onEndCallback) onEndCallback();
                        else setAssistantState('idle');
                    }
                };
            }
        } catch (error: any) {
            console.error("Error in streaming speech pipeline:", error);
            isSpeakingRef.current = false;
            speechSourcesRef.current.forEach(source => { source.onended = null; source.stop(); });
            speechSourcesRef.current.clear();
            
            const retrySpeak = () => {
                setChatHistory(prev => prev.filter(m => !m.onRetry));
                speak(text, config, emotion, onEndCallback);
            };

            setChatHistory(prev => [...prev.filter(m => !m.onRetry), { 
                id: Date.now(), 
                sender: 'assistant', 
                text: error.message || "I'm having trouble with my voice right now.",
                isError: true,
                onRetry: retrySpeak,
                isApiKeyError: error instanceof ApiKeyError,
            }]);
            setAssistantState('error');
        }
    }, [settings.gender, settings.voice]);

  const addErrorMessageToChat = useCallback((error: any, onRetry?: () => void) => {
    speechSourcesRef.current.forEach(source => {
        source.onended = null;
        source.stop();
    });
    speechSourcesRef.current.clear();
    isSpeakingRef.current = false;

    const message = error.message || String(error);
    const isApiKeyError = error instanceof ApiKeyError;

    let retryFunc = onRetry;
    const lowerCaseMessage = message.toLowerCase();
    if (error instanceof MainApiKeyError || lowerCaseMessage.includes('safety')) {
      retryFunc = undefined;
    }

    setChatHistory(prev => [
        ...prev.filter(m => !m.onRetry), 
        {
            id: Date.now(),
            sender: 'assistant',
            text: message,
            isError: true,
            onRetry: retryFunc,
            isApiKeyError: isApiKeyError,
        },
    ]);
    speak(message, settings.voice[settings.gender].main, 'sad', () => setAssistantState('error'));
    setAssistantState('error');
  }, [speak, settings.voice, settings.gender]);

  const handleTestVoice = (text: string, config: VoiceConfig, emotion: Emotion) => {
    speak(text, config, emotion);
  };
  
  const handleYoutubeControl = useCallback((action: string) => {
    if (!playerRef.current) return;
    switch(action) {
        case 'toggle':
            if (playerState === window.YT.PlayerState.PLAYING) playerRef.current.pauseVideo();
            else playerRef.current.playVideo();
            break;
        case 'close':
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
            setYoutubeVideoId(null);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            break;
    }
  }, [playerState]);

  const onPlayerReady = useCallback((event: any) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(50);
  }, []);
  
  const onPlayerStateChange = useCallback((event: any) => {
    setPlayerState(event.data);
    if (event.data === window.YT.PlayerState.PLAYING) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = window.setInterval(() => {
            setPlayerProgress({
                currentTime: playerRef.current?.getCurrentTime() || 0,
                duration: playerRef.current?.getDuration() || 0,
            });
        }, 1000);
    } else {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  }, []);

  const onPlayerError = useCallback((event: any) => {
      console.error("YouTube Player Error:", event.data);
      handleYoutubeControl('close');
      const errorMsg = t('errors.youtubePlayback');
      setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: errorMsg, isError: true }]);
      speak(errorMsg, settings.voice[settings.gender].main, 'sad', () => {
          if (isConnectedRef.current) {
              startRecognition();
          }
      });
  }, [t, speak, settings.voice, settings.gender, startRecognition, handleYoutubeControl]);

  useEffect(() => {
    if (youtubeVideoId && isYTReady) {
        if (playerRef.current) {
            playerRef.current.destroy();
        }
        playerRef.current = new window.YT.Player('youtube-player', {
            videoId: youtubeVideoId,
            playerVars: { 'autoplay': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0 },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    }
  }, [youtubeVideoId, isYTReady, onPlayerReady, onPlayerStateChange, onPlayerError]);
  
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const executeYoutubeSearch = useCallback(async (query: string) => {
      try {
          setAssistantState('thinking');
          const videoId = await searchYouTube(settings.apiKeys.youtube, query);
          if (videoId) {
              setWeatherData(null);
              setTimer(null);
              setYoutubeVideoId(videoId);
          } else {
              const notFoundMsg = `I couldn't find a suitable video for "${query}".`;
              setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: notFoundMsg }]);
              await speak(notFoundMsg, settings.voice[settings.gender].main, 'sad');
          }
          if (isConnectedRef.current) {
            startRecognition();
          } else {
            setAssistantState('idle');
          }
      } catch (e: any) {
          addErrorMessageToChat(e, () => executeYoutubeSearch(query));
      }
  }, [settings.apiKeys.youtube, addErrorMessageToChat, speak, settings.voice, settings.gender, startRecognition]);

  const executeWeatherFetch = useCallback(async (location: string) => {
      try {
          setAssistantState('thinking');
          const data = await fetchWeatherSummary(location, settings.apiKeys.weather);
          setYoutubeVideoId(null);
          setTimer(null);
          setWeatherData(data);
          await speak(data.summary, settings.voice[settings.gender].main, 'formal', () => {
            if (isConnectedRef.current) startRecognition();
          });
      } catch (e: any) {
          addErrorMessageToChat(e, () => executeWeatherFetch(location));
      }
  }, [settings.apiKeys.weather, addErrorMessageToChat, speak, settings.voice, settings.gender, startRecognition]);

  const executeNewsFetch = useCallback(async (query: string) => {
      try {
          setAssistantState('thinking');
          const newsSummary = await fetchNews(settings.apiKeys.news, query);
          setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: newsSummary }]);
          await speak(newsSummary, settings.voice[settings.gender].main, 'formal', () => {
             if (isConnectedRef.current) startRecognition();
          });
      } catch (e: any) {
          addErrorMessageToChat(e, () => executeNewsFetch(query));
      }
  }, [settings.apiKeys.news, addErrorMessageToChat, speak, settings.voice, settings.gender, startRecognition]);
  
    const executeSetTimer = useCallback((duration: number) => {
        if (duration <= 0) return;
        setYoutubeVideoId(null);
        setWeatherData(null);
        setTimer({
            key: Date.now(),
            duration,
            remaining: duration,
            isActive: true,
        });
    }, []);

    const onTimerFinish = useCallback(() => {
        if (timerAudioRef.current) {
            timerAudioRef.current.play().catch(e => console.error("Error playing timer sound", e));
        }
        speak("Time's up!", settings.voice[settings.gender].main, 'excited', () => {
             if (isConnectedRef.current) {
                startRecognition();
            }
        });
        setTimer(null);
    }, [speak, settings.voice, settings.gender, startRecognition]);

    useEffect(() => {
        if (timer?.isActive) {
            timerIntervalRef.current = window.setInterval(() => {
                setTimer(currentTimer => {
                    if (currentTimer && currentTimer.remaining > 0) {
                        return { ...currentTimer, remaining: currentTimer.remaining - 1 };
                    }
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    return currentTimer ? { ...currentTimer, isActive: false } : null;
                });
            }, 1000);
        }
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [timer?.key, timer?.isActive]);

  const executeSingSong = useCallback(async (artist: string, title: string) => {
    setAssistantState('composing');
    try {
        const lyrics = await fetchLyrics(artist, title);
        if (!lyrics) {
            const notFoundMsg = `I'm sorry, I couldn't find the lyrics for "${title}" by ${artist}.`;
            setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: notFoundMsg }]);
            await speak(notFoundMsg, settings.voice[settings.gender].main, 'sad', () => {
                if (isConnectedRef.current) startRecognition();
            });
            return;
        }

        const lyricsMessageText = `Here are the lyrics for "${title}" by ${artist}:\n\n${lyrics}`;
        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: lyricsMessageText }]);

        setAssistantState('singing');
        const base64Audio = await generateSong(lyrics, settings.voice[settings.gender].main.name, settings.singingEmotionTuning);
        
        await playRawAudio(base64Audio, () => {
            if (isConnectedRef.current) {
                startRecognition();
            } else {
                setAssistantState('idle');
            }
        });

    } catch (e: any) {
        addErrorMessageToChat(e, () => executeSingSong(artist, title));
    }
  }, [settings.voice, settings.gender, settings.singingEmotionTuning, addErrorMessageToChat, speak, playRawAudio, startRecognition]);

  const executeLyricsFetch = useCallback(async (artist: string, title: string) => {
    setAssistantState('thinking');
    try {
        const lyrics = await fetchLyrics(artist, title);
        let assistantMessageText: string;
        let speakText: string;
        const lyricsFound = !!lyrics;

        if (lyricsFound) {
            assistantMessageText = `Lyrics for "${title}" by ${artist}:\n\n${lyrics}`;
            speakText = `Here are the lyrics for "${title}" by ${artist}.`;
        } else {
            assistantMessageText = `I'm sorry, I couldn't find the lyrics for "${title}" by ${artist}. Please try another song.`;
            speakText = assistantMessageText;
        }

        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: assistantMessageText }]);
        await speak(speakText, settings.voice[settings.gender].main, lyricsFound ? 'happy' : 'sad', () => {
            if (isConnectedRef.current) {
                startRecognition();
            } else {
                setAssistantState('idle');
            }
        });

    } catch (e: any) {
        addErrorMessageToChat(e, () => executeLyricsFetch(artist, title));
    }
  }, [settings.voice, settings.gender, addErrorMessageToChat, speak, startRecognition]);

  const handleDisconnect = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.abort();
    }
    speechSourcesRef.current.forEach(source => {
        source.onended = null;
        source.stop();
    });
    speechSourcesRef.current.clear();
    isSpeakingRef.current = false;
    setAssistantState('idle');
    setCurrentTranscript('');
    setIsConnected(false);
  }, []);
  
  const stopCurrentAction = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.abort();
    }
    speechSourcesRef.current.forEach(source => {
        source.onended = null;
        source.stop();
    });
    speechSourcesRef.current.clear();
    isSpeakingRef.current = false;
    setAssistantState('idle');
    setCurrentTranscript('');
  }, []);

  const sendEmail = useCallback((recipient: string, subject: string, body: string) => {
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = mailtoLink;
    // Use a small delay to ensure the speech starts before the email client potentially steals focus
    setTimeout(() => {
        a.click();
    }, 300);
    
    speak("I've opened your email client with the draft.", settings.voice[settings.gender].main, 'happy', () => {
         if (isConnectedRef.current) startRecognition();
    });
    setEmailComposer({ stage: 'idle', recipient: '', subject: '', body: '' });
  }, [settings.gender, settings.voice, speak, startRecognition]);

  const handleEmailInput = useCallback(async (transcript: string) => {
    const currentState = emailComposerRef.current;
    let nextState = { ...currentState };
    let question = '';
    let emotion: Emotion = 'curious';

    if (assistantStateRef.current === 'speaking' || isSpeakingRef.current) {
        stopCurrentAction();
        startRecognition();
        return;
    }
    setAssistantState('thinking');

    switch (currentState.stage) {
        case 'getEmail':
            // Simple email regex for basic validation
            if (/\S+@\S+\.\S+/.test(transcript.replace(/\s/g, ''))) {
                 nextState = { ...nextState, recipient: transcript.replace(/\s/g, ''), stage: 'getSubject' };
                 question = 'Got it. What is the subject of the email?';
            } else {
                question = "That doesn't sound like a valid email address. Could you please provide the recipient's email again?";
                emotion = 'empathetic';
            }
            break;
        case 'getSubject':
            nextState = { ...nextState, subject: transcript, stage: 'getBody' };
            question = 'Okay. And what should the message say?';
            break;
        case 'getBody':
            nextState = { ...nextState, body: transcript, stage: 'confirmSend' };
            question = `Alright. I have an email to ${nextState.recipient} with the subject "${nextState.subject}". Should I prepare it for you to send?`;
            break;
        case 'confirmSend':
            const confirmation = transcript.toLowerCase();
            if (confirmation.includes('yes') || confirmation.includes('yeah') || confirmation.includes('correct') || confirmation.includes('prepare it')) {
                sendEmail(currentState.recipient, currentState.subject, currentState.body);
                return;
            } else {
                question = 'Okay, I am cancelling this email.';
                setEmailComposer({ stage: 'idle', recipient: '', subject: '', body: '' });
                emotion = 'neutral';
            }
            break;
    }

    setEmailComposer(nextState);

    speak(question, settings.voice[settings.gender].main, emotion, () => {
        if (isConnectedRef.current) {
            startRecognition();
        }
    });
  }, [settings.gender, settings.voice, speak, startRecognition, sendEmail, stopCurrentAction]);

  const handleCodeCommand = useCallback(async (transcript: string, mode: 'write' | 'debug' = 'write') => {
    setAssistantState('thinking');
    
    let instruction = transcript;
    if (mode === 'debug') {
        instruction = "Find and fix any bugs or errors in the following code. If there are no bugs, suggest improvements.";
    }

    try {
        const result = await processCodeCommand(editorContent, editorLanguage, instruction);
        setEditorContent(result.newCode);
        speak(result.explanation, settings.voice[settings.gender].main, 'formal', () => {
            // After explaining, go back to coding state to listen for next command
            setAssistantState('coding');
            if (isConnectedRef.current) {
                // A brief delay before starting recognition again in coding mode
                setTimeout(() => startRecognition(), 100);
            }
        });
    } catch (e: any) {
        addErrorMessageToChat(e, () => handleCodeCommand(transcript, mode));
    }

  }, [editorContent, editorLanguage, settings.voice, settings.gender, speak, addErrorMessageToChat, startRecognition]);

  const handleCommand = useCallback(async (transcript: string) => {
      setAssistantState('thinking');
      const userMessage: ChatMessage = { id: Date.now(), sender: 'user', text: transcript };
      const updatedHistory = [...chatHistory, userMessage];
      setChatHistory(updatedHistory);

      const name = settings.gender === 'female' ? 'Kaniska' : 'Kanishk';
      const systemInstruction = settings.systemPrompt
          .replace(/{{name}}/g, name)
          .replace(/{{gender}}/g, settings.gender);
      
      let response;
      try {
        response = await processUserCommand(updatedHistory, systemInstruction, BIAS_TEMPERATURE_MAP[settings.bias], settings.emotionTuning);
      } catch(error: any) {
          addErrorMessageToChat(error, () => handleCommand(transcript));
          return;
      }
      
      const assistantMessage: ChatMessage = { id: Date.now() + 1, sender: 'assistant', text: response.reply, sources: response.sources };
      setChatHistory(prev => [...prev, assistantMessage]);

      const onReplyEnd = () => {
          let commandExecuted = false;
          switch (response.command) {
              case 'YOUTUBE_SEARCH':
                  if (response.youtubeQuery) {
                      executeYoutubeSearch(response.youtubeQuery);
                      commandExecuted = true;
                  }
                  break;
              case 'GET_WEATHER':
                  if (response.location) {
                      executeWeatherFetch(response.location);
                      commandExecuted = true;
                  }
                  break;
              case 'GET_NEWS':
                  if(response.newsQuery) {
                      executeNewsFetch(response.newsQuery);
                      commandExecuted = true;
                  }
                  break;
              case 'SING_SONG':
                  if (response.songTitle && response.songArtist) {
                      executeSingSong(response.songArtist, response.songTitle);
                      commandExecuted = true;
                  }
                  break;
              case 'GET_LYRICS':
                  if (response.songTitle && response.songArtist) {
                      executeLyricsFetch(response.songArtist, response.songTitle);
                      commandExecuted = true;
                  }
                  break;
               case 'SET_TIMER':
                  if (response.timerDurationSeconds && response.timerDurationSeconds > 0) {
                      executeSetTimer(response.timerDurationSeconds);
                      commandExecuted = true;
                  }
                  break;
              case 'DEACTIVATE_LISTENING':
                  handleDisconnect();
                  commandExecuted = true;
                  break;
              case 'SEND_EMAIL':
                  setEmailComposer({ stage: 'getEmail', recipient: '', subject: '', body: '' });
                  commandExecuted = false;
                  break;
              case 'OPEN_CODE_EDITOR':
                  setIsCodeEditorOpen(true);
                  setAssistantState('coding');
                  commandExecuted = false; // Let the default path handle starting recognition
                  break;
          }

          if (!commandExecuted && isConnectedRef.current) {
              startRecognition();
          } else if (!commandExecuted && !isConnectedRef.current) {
              setAssistantState('idle');
          }
      };
      
      speak(response.reply, settings.voice[settings.gender].main, response.emotion, onReplyEnd);
      
  }, [
      chatHistory, settings.gender, settings.bias, settings.emotionTuning, settings.systemPrompt,
      settings.voice, speak, handleDisconnect, addErrorMessageToChat, 
      executeYoutubeSearch, executeWeatherFetch, executeNewsFetch, executeSingSong, 
      executeLyricsFetch, executeSetTimer, startRecognition
  ]);
  
  const handleConnect = useCallback(() => {
    if (isConnected) return;
    if (!hasInteracted) setHasInteracted(true);

    if (connectionAudioRef.current && settings.connectionSoundUrl) {
        connectionAudioRef.current.src = settings.connectionSoundUrl;
        connectionAudioRef.current.play().catch(e => console.error("Error playing connection sound:", e));
    }
    
    setIsConnected(true);
  
    const greetingMessage: ChatMessage = { id: Date.now(), sender: 'assistant', text: settings.greeting };
    if (chatHistory.length === 0) {
      setChatHistory(prev => [...prev, greetingMessage]);
    }
    speak(settings.greeting, settings.voice[settings.gender].greeting, 'happy', () => {
        startRecognition();
    });
  }, [isConnected, hasInteracted, settings.connectionSoundUrl, settings.greeting, settings.voice, settings.gender, speak, chatHistory.length, startRecognition]);
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setListeningHint("Speech Recognition not supported.");
      return;
    }
    
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    const selectedLanguage = availableLanguages.find(l => l.code === lang) || availableLanguages[0];
    recognition.lang = selectedLanguage.bcp47;

    recognition.onstart = () => {
      if (isSpeakingRef.current) {
        speechSourcesRef.current.forEach(source => {
          source.onended = null;
          source.stop();
        });
        speechSourcesRef.current.clear();
        isSpeakingRef.current = false;
      }
      if(assistantStateRef.current !== 'coding') {
         setAssistantState('listening');
      }
    };

    recognition.onresult = (event: any) => {
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        setListeningHint(null);
        
        let finalTranscript = '';
        let interimTranscript = '';
        let lastConfidence = 0;
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPart = event.results[i][0];
            if (event.results[i].isFinal) {
                finalTranscript += transcriptPart.transcript;
                lastConfidence = transcriptPart.confidence;
                isFinal = true;
            } else {
                interimTranscript += transcriptPart.transcript;
            }
        }
        
        setCurrentTranscript(interimTranscript);

        if (isFinal && lastConfidence > 0 && lastConfidence < 0.5) {
            console.warn(`Low confidence result: "${finalTranscript.trim()}" (Confidence: ${lastConfidence}). Ignoring.`);
            setListeningHint(t('main.lowConfidenceHint'));
            if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
            hintTimeoutRef.current = window.setTimeout(() => {
                setListeningHint(null);
                if (isConnectedRef.current) {
                    if (recognitionRef.current) {
                        recognitionRef.current.abort();
                        setTimeout(() => startRecognition(), 100);
                    }
                }
            }, 2500);
            return;
        }

        finalTranscript = finalTranscript.trim();
        if (finalTranscript) {
            if (isSpeakingRef.current) {
                // Interruption detected!
                stopCurrentAction();
                // A small delay to allow state changes to propagate before processing the new command.
                setTimeout(() => {
                    if (assistantStateRef.current === 'coding') {
                       handleCodeCommand(finalTranscript);
                    } else if (emailComposerRef.current.stage !== 'idle') {
                        handleEmailInput(finalTranscript);
                    } else {
                        handleCommand(finalTranscript);
                    }
                }, 50);
                return;
            }
            
            if (assistantStateRef.current === 'coding') {
                handleCodeCommand(finalTranscript);
            } else if (emailComposerRef.current.stage !== 'idle') {
                handleEmailInput(finalTranscript);
            } else {
                handleCommand(finalTranscript);
            }
        }
    };
    
    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return;
      console.error("Speech recognition error", event.error, event.message);

      if (isSpeakingRef.current) {
        speechSourcesRef.current.forEach(source => {
          source.onended = null;
          source.stop();
        });
        speechSourcesRef.current.clear();
        isSpeakingRef.current = false;
      }
      
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      setListeningHint(null);

      switch (event.error) {
        case 'no-speech':
          if (isConnectedRef.current) {
            setListeningHint(t('main.noSpeechHint'));
            if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
            hintTimeoutRef.current = window.setTimeout(() => {
                setListeningHint(null);
                if (isConnectedRef.current && assistantStateRef.current !== 'idle' && assistantStateRef.current !== 'error') {
                    startRecognition();
                }
            }, 2500);
          }
          return;
        case 'not-allowed':
        case 'service-not-allowed':
          addErrorMessageToChat(new Error(t('errors.micNotAllowed')));
          break;
        case 'audio-capture':
          addErrorMessageToChat(new Error(t('errors.micAudioCapture')));
          break;
        case 'network':
          addErrorMessageToChat(new Error(t('errors.network')));
          break;
        default:
          addErrorMessageToChat(new Error(t('errors.speechRecognitionGeneric')));
          setAssistantState('error');
          break;
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [lang, handleCommand, t, addErrorMessageToChat, startRecognition, handleEmailInput, stopCurrentAction, handleCodeCommand]);

  const handleRecordButtonClick = () => {
    if (!isConnected) return;

    if (assistantState === 'listening' || assistantState === 'coding') {
        recognitionRef.current?.stop();
        setAssistantState('idle');
    } else {
        stopCurrentAction();
        startRecognition();
    }
  };
  
  const handleCloseCodeEditor = () => {
    setIsCodeEditorOpen(false);
    if (assistantState === 'coding') {
        if (isConnected) {
            startRecognition(); // Go back to normal listening
        } else {
            setAssistantState('idle');
        }
    }
  };

  const getAssistantStatusText = () => {
    if (listeningHint) return <span className="state-text-animation text-yellow-400">{listeningHint}</span>;

    if (emailComposer.stage !== 'idle') {
        switch (emailComposer.stage) {
            case 'getEmail': return 'Listening for recipient\'s email...';
            case 'getSubject': return 'Listening for the subject...';
            case 'getBody': return 'Listening for the message...';
            case 'confirmSend': return 'Listening for confirmation...';
        }
    }

    switch(assistantState) {
        case 'listening': return <span className="listening-text-pulse">{currentTranscript || t('main.status.listening')}</span>;
        case 'coding': return <span className="listening-text-pulse">{currentTranscript || 'Coding mode: awaiting instructions...'}</span>;
        case 'thinking': return t('main.status.thinking');
        case 'speaking': return t('main.status.speaking');
        case 'singing': return t('main.status.singing');
        case 'error': return <span className="text-red-400">{t('main.status.error')}</span>;
        default: return isConnected ? t('main.status.idle') : t('main.status.offline');
    }
  };

  const toggleTheme = () => {
    handleSettingChange({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };
  
  const openApiSettings = () => {
    setSettingsInitialTab('apiKeys');
    setIsSettingsOpen(true);
  };
  
  const renderSidePanelContent = () => {
      if (isCodeEditorOpen) {
          return <CodeEditorPanel
              content={editorContent}
              language={editorLanguage}
              onContentChange={setEditorContent}
              onLanguageChange={setEditorLanguage}
              onDebug={() => handleCodeCommand('', 'debug')}
              onClose={handleCloseCodeEditor}
          />
      }
      if (youtubeVideoId) {
        return (
            <div className="p-2 flex flex-col h-full">
                <div id="youtube-player" className="youtube-container flex-grow"></div>
                <div className="flex-shrink-0 p-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-text-color-muted">
                        <span>{formatTime(playerProgress.currentTime)}</span>
                        <div className="w-full bg-border-color h-1 rounded">
                            <div className="bg-primary-color h-1 rounded" style={{ width: `${playerProgress.duration > 0 ? (playerProgress.currentTime / playerProgress.duration) * 100 : 0}%` }}></div>
                        </div>
                        <span>{formatTime(playerProgress.duration)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={() => handleYoutubeControl('toggle')} className="youtube-control-button play-pause-btn p-3" disabled={playerState === null}>
                            {playerState === window.YT?.PlayerState?.PLAYING ? <PauseIcon className="w-8 h-8"/> : <PlayIcon className="w-8 h-8"/>}
                        </button>
                        <button onClick={() => handleYoutubeControl('close')} className="youtube-control-button bg-red-500/20 text-red-400 hover:bg-red-500/30">
                            <StopIcon/>
                        </button>
                    </div>
                </div>
            </div>
        );
      }
      if (weatherData) {
          return <WeatherPanel data={weatherData} onClose={() => setWeatherData(null)} />;
      }
      if (timer) {
          return <TimerPanel duration={timer.duration} remaining={timer.remaining} onClose={() => setTimer(null)} onFinish={onTimerFinish} />;
      }
      return (
          <div ref={chatLogRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
              <ChatLog history={chatHistory} onOpenSettings={openApiSettings} />
          </div>
      );
  };

  const isBusy = ['thinking', 'speaking', 'singing', 'composing', 'sad', 'celebrating', 'surprised'].includes(assistantState) || emailComposer.stage !== 'idle';

  return (
    <div className="bg-transparent text-text-color w-screen h-screen flex flex-col overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
        <div className="flex items-center gap-3">
          <KaniskaLogo />
          <h1 className="text-xl font-bold tracking-wider glowing-text">{t('appName')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Clock />
           <button onClick={toggleTheme} className="footer-button" aria-label={t('header.toggleTheme')}>
             {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
           </button>
           <div className="relative">
              <button onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)} className="footer-button flex items-center gap-2" aria-haspopup="true" aria-expanded={isLangDropdownOpen}>
                  <GlobeIcon />
                  <span className='uppercase'>{lang.split('_')[0]}</span>
              </button>
              {isLangDropdownOpen && (
                  <div className="absolute right-0 mt-2 py-1 w-auto min-w-[8rem] bg-panel-bg border border-border-color rounded-md shadow-lg z-20">
                      {availableLanguages.map((l) => (
                          <a
                              href="#"
                              key={l.code}
                              onClick={(e) => {
                                  e.preventDefault();
                                  setLang(l.code);
                                  setIsLangDropdownOpen(false);
                              }}
                              className="block px-4 py-2 text-sm text-text-color-muted hover:bg-assistant-bubble-bg hover:text-text-color whitespace-nowrap"
                          >
                              {l.name}
                          </a>
                      ))}
                  </div>
              )}
          </div>
          <button onClick={() => { setSettingsInitialTab('persona'); setIsSettingsOpen(true); }} className="footer-button" aria-label={t('header.settings')}>
            <SettingsIcon />
          </button>
        </div>
      </header>

      <main className="flex-grow flex min-h-0">
        <div className="flex-grow flex flex-col items-center justify-center p-4 relative">
            <div className="hologram-container">
                {(assistantState === 'listening' || assistantState === 'coding') && (
                    <div className="listening-waveform">
                        <div className="waveform-circle"></div>
                        <div className="waveform-circle"></div>
                        <div className="waveform-circle"></div>
                    </div>
                )}
                {(assistantState === 'thinking' || assistantState === 'composing') && (
                    <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                    </div>
                )}
                <img 
                    src={settings.avatarMap[assistantState] || PLACEHOLDER_AVATAR_URL} 
                    alt="Kaniska Avatar" 
                    className={`avatar expression-${assistantState}`}
                />
            </div>
          <p className="mt-6 text-lg text-text-color-muted h-8 text-center state-text-animation">
            {getAssistantStatusText()}
          </p>
        </div>

        <aside className="w-[380px] flex-shrink-0 bg-panel-bg border-l border-border-color flex flex-col animate-panel-enter relative">
          {renderSidePanelContent()}
        </aside>
      </main>
      
      <footer className="grid grid-cols-3 items-center justify-items-center p-3 border-t border-border-color flex-shrink-0">
        <div className="justify-self-start ml-4 flex items-center gap-2">
            <button
                onClick={!isConnected ? handleConnect : handleDisconnect}
                className={`footer-button ${!isConnected ? 'text-green-400 hover:!text-green-300' : 'text-red-400 hover:!text-red-300'}`}
                aria-label={!isConnected ? t('footer.connect') : t('footer.disconnect')}
            >
                {!isConnected ? <ConnectIcon className="w-7 h-7" /> : <DisconnectIcon className="w-7 h-7" />}
                <span className="text-xs">{!isConnected ? t('footer.connect') : t('footer.disconnect')}</span>
            </button>
            <button
                onClick={() => isCodeEditorOpen ? handleCloseCodeEditor() : setIsCodeEditorOpen(true)}
                className={`footer-button ${isCodeEditorOpen ? 'active' : ''}`}
                aria-label="Open Code Editor"
                disabled={!isConnected}
            >
                <CodeIcon />
                <span className="text-xs">Code</span>
            </button>
        </div>

        <div className="justify-self-center">
            <button
                onClick={handleRecordButtonClick}
                disabled={!isConnected}
                className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-color text-bg-color font-bold text-lg hover:opacity-90 transition transform hover:scale-105 active:scale-100 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                aria-label={isBusy ? t('footer.stop') : t('footer.record')}
            >
                {isBusy ? <StopIcon className="w-8 h-8" /> : <MicrophoneIcon className="w-8 h-8" />}
            </button>
        </div>
        
        <div className="justify-self-end mr-4">
            {/* Placeholder for future controls */}
        </div>
    </footer>


      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSettingChange={handleSettingChange}
        onTestVoice={handleTestVoice}
        initialTab={settingsInitialTab}
      />
    </div>
  );
};
