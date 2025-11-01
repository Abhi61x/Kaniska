


import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AssistantState, ChatMessage, Emotion, Source, Gender } from './types.ts';
import { processUserCommand, fetchWeatherSummary, fetchNews, searchYouTube, generateSpeech } from './services/api.ts';
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
const AccountDataIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M20.66 13.5A5.5 5.5 0 0 0 17.5 13a5.5 5.5 0 0 0-3.16 9.5"/></svg>;
const HelpSupportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
const SlidersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>;
const ConnectIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14q1.25 0 2.125-.875T15 11V5q0-1.25-.875-2.125T12 2q-1.25 0-2.125.875T9 5v6q0 1.25.875 2.125T12 14Zm-1 7v-3.05q-2.825-.2-4.913-2.288T4 11H6q0 2.5 1.75 4.25T12 17q2.5 0 4.25-1.75T18 11h2q0 2.825-2.088 4.913T13 18.05V21h-2Z"/></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m18 22 4-4-4-4-1.4 1.45 1.55 1.55H13q-2.075 0-3.538-1.463T8 12V5H6v7q0 2.9 2.05 4.95T13 19h5.15l-1.55 1.55L18 22ZM6 8V3h2v2h3V3h2v2h3V3h2v5h-2V6h-3v2h-2V6H8v2H6Z"/></svg>;
const VolumeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c-1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const PlayIcon = ({ className = "w-6 h-6" } : { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = ({ className = "w-6 h-6" } : { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;

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
  "command": "REPLY" | "YOUTUBE_SEARCH" | "GET_WEATHER" | "GET_NEWS" | "SEND_EMAIL",
  "reply": "Your verbal response to the user. This is what will be spoken out loud. IMPORTANT: This text will be fed directly into a text-to-speech (TTS) engine. It MUST contain only plain, speakable words. Do not include markdown, emojis, or parenthetical non-speech descriptions like '(laughs)' or '♪'. Keep it concise and conversational.",
  "youtubeQuery": "A simplified keyword for the YouTube search. Examples: 'music', 'news', 'cats'. Otherwise, an empty string.",
  "newsQuery": "The topic for the news search. Examples: 'technology', 'world headlines'. Otherwise, an empty string.",
  "location": "The city or place for the weather query. Examples: 'London', 'Tokyo'. Otherwise, an empty string.",
  "emotion": "neutral" | "happy" | "sad" | "excited" | "empathetic" | "singing" | "formal" | "chirpy" | "surprised" | "curious" | "thoughtful" | "joking"
}

HOW TO DECIDE THE JSON VALUES:

1. COMMAND:
- If the user asks you to search for or play a video on YouTube (e.g., "play some music", "find a video about cats"), set command to "YOUTUBE_SEARCH".
- If the user asks about the weather (e.g., "what's the weather like?", "is it going to rain in Paris?"), set command to "GET_WEATHER".
- If the user asks for news (e.g., "latest headlines", "news about space exploration"), set command to "GET_NEWS".
- If the user asks to send an email (e.g., "send an email to John"), set command to "SEND_EMAIL". Your 'reply' should confirm the request, like "Certainly, who should the email be addressed to and what is the message?".
- For ALL other queries (greetings, questions, singing requests), set command to "REPLY".

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
- 'singing': ONLY when the user asks you to sing a song. The 'reply' must contain only the song lyrics as plain, speakable text.
- 'surprised': For reacting to unexpected information from the user.
- 'curious' or 'thoughtful': When asking clarifying questions or pondering a complex topic.
- 'joking': When you are being playful or telling a joke.
- 'neutral': Use as a default for general conversation.

4. TOOLS:
- IMPORTANT: You have access to Google Search for any questions about general topics you don't know. Formulate your 'reply' based on the findings in your own words. Do NOT use it for weather or news queries; use the GET_WEATHER or GET_NEWS commands for those.
`;

const getSystemPrompt = (gender: Gender) => {
    const name = gender === 'female' ? 'Kaniska' : 'Kanishk';
    return DEFAULT_SYSTEM_PROMPT
        .replace(/{{name}}/g, name)
        .replace(/{{gender}}/g, gender);
};


const PLACEHOLDER_AVATAR_URL = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2' fill='%2330363d'/%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E`;

const DEFAULT_AVATAR_MAP: Record<AssistantState, string> = {
  idle: PLACEHOLDER_AVATAR_URL,
  listening: PLACEHOLDER_AVATAR_URL,
  thinking: PLACEHOLDER_AVATAR_URL,
  speaking: PLACEHOLDER_AVATAR_URL,
  error: PLACEHOLDER_AVATAR_URL,
  composing: PLACEHOLDER_AVATAR_URL,
  confused: PLACEHOLDER_AVATAR_URL,
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

const defaultSettings = {
    greeting: "Hello, I am Kaniska. How can I assist you today?",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    gender: 'female' as Gender,
    avatarMap: DEFAULT_AVATAR_MAP,
    bias: 'balanced',
    voice: {
        main: { name: 'Kore' },
        greeting: { name: 'Puck' },
    },
    emotionTuning: {
        happiness: 50,
        empathy: 50,
        formality: 50,
    },
    volume: 1,
    ambientVolume: 0.3,
    connectionSoundUrl: null,
    apiKeys: { weather: '', news: '', youtube: '' },
    userId: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
};


// --- Child Components ---

const Auth = ({ onLogin, onSignUp }) => {
    const { t } = useTranslation();
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
    const [error, setError] = useState('');

    // Login state
    const [identifier, setIdentifier] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Signup state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedIdentifier = identifier.trim();
        if (!trimmedIdentifier || !loginPassword) {
            setError(t('auth.error.fillFields'));
            return;
        }
        const success = onLogin(trimmedIdentifier, loginPassword);
        if (!success) {
            setError(t('auth.error.invalidCredentials'));
        }
    };

    const handleSignUpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedName || !trimmedEmail || !trimmedPhone || !signUpPassword) {
            setError(t('auth.error.fillFields'));
            return;
        }
        const result = onSignUp(trimmedName, trimmedEmail, trimmedPhone, signUpPassword);
        if (!result.success) {
            setError(t(result.message));
        }
    };
    
    const toggleMode = () => {
        setError('');
        setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content w-full max-w-md p-8" onClick={e => e.stopPropagation()}>
                <h1 className="text-3xl font-bold tracking-wider glowing-text text-center mb-2">{t('appName')}</h1>
                <p className="text-center text-text-color-muted mb-6">
                    {authMode === 'login' ? t('auth.loginMessage') : t('auth.signupMessage')}
                </p>
                {error && <p className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4 text-center">{error}</p>}
                
                {authMode === 'login' ? (
                     <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="text-sm text-text-color-muted block mb-2">{t('auth.identifierLabel')}</label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                className="w-full p-3 rounded bg-bg-color border border-border-color focus:ring-1 focus:ring-primary-color"
                                placeholder={t('auth.identifierPlaceholder')}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-text-color-muted block mb-2">{t('auth.passwordLabel')}</label>
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={e => setLoginPassword(e.target.value)}
                                className="w-full p-3 rounded bg-bg-color border border-border-color focus:ring-1 focus:ring-primary-color"
                                placeholder={t('auth.passwordPlaceholder')}
                            />
                        </div>
                        <button type="submit" className="w-full p-3 mt-4 rounded-lg bg-primary-color/80 hover:bg-primary-color text-white font-semibold transition text-lg">
                            {t('auth.login')}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSignUpSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="text-sm text-text-color-muted block mb-2">{t('auth.signupNameLabel')}</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 rounded bg-bg-color border border-border-color" placeholder={t('auth.signupNamePlaceholder')}/>
                        </div>
                         <div>
                            <label className="text-sm text-text-color-muted block mb-2">{t('auth.signupEmailLabel')}</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 rounded bg-bg-color border border-border-color" placeholder={t('auth.signupEmailPlaceholder')}/>
                        </div>
                         <div>
                            <label className="text-sm text-text-color-muted block mb-2">{t('auth.signupPhoneLabel')}</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 rounded bg-bg-color border border-border-color" placeholder={t('auth.signupPhonePlaceholder')}/>
                        </div>
                         <div>
                            <label className="text-sm text-text-color-muted block mb-2">{t('auth.passwordLabel')}</label>
                            <input type="password" value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)} className="w-full p-2.5 rounded bg-bg-color border border-border-color" placeholder={t('auth.signupPasswordPlaceholder')}/>
                        </div>
                        <button type="submit" className="w-full p-3 mt-4 rounded-lg bg-primary-color/80 hover:bg-primary-color text-white font-semibold transition text-lg">
                            {t('auth.signup')}
                        </button>
                    </form>
                )}
                <div className="text-center mt-6">
                    <button onClick={toggleMode} className="text-sm text-primary-color/80 hover:text-primary-color hover:underline">
                        {authMode === 'login' ? t('auth.toggleToSignup') : t('auth.toggleToLogin')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Clock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    };
    let formatted = new Intl.DateTimeFormat('en-US', options).format(date);
    return formatted.replace(',', '').replace(' AM', ' am').replace(' PM', ' pm');
  };

  return (
    <div className="text-sm text-text-color-muted font-mono hidden sm:block">
      {formatDate(time)}
    </div>
  );
};

const SettingsModal = ({
    isOpen, onClose, settings, onSettingChange, onTestVoice, onLogout
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    const [activeTab, setActiveTab] = useState('persona');

    const navItems = [
        { id: 'persona', label: t('settings.tabs.persona'), icon: <PersonaIcon /> },
        { id: 'bias', label: t('settings.tabs.bias'), icon: <SlidersIcon /> },
        { id: 'voice', label: t('settings.tabs.voice'), icon: <VoiceIcon /> },
        { id: 'avatar', label: t('settings.tabs.avatar'), icon: <AvatarIcon /> },
        { id: 'apiKeys', label: t('settings.tabs.apiKeys'), icon: <ApiKeysIcon /> },
        { id: 'account', label: t('settings.tabs.account'), icon: <AccountDataIcon /> },
        { id: 'help', label: t('settings.tabs.help'), icon: <HelpSupportIcon /> },
    ];

    const handleUpdate = (key, value) => {
        onSettingChange({ ...settings, [key]: value });
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'persona': return <PersonaContent settings={settings} onUpdate={handleUpdate} />;
            case 'bias': return <BiasContent settings={settings} onUpdate={handleUpdate} />;
            case 'voice': return <VoiceContent settings={settings} onUpdate={handleUpdate} onTestVoice={onTestVoice} />;
            case 'avatar': return <AvatarContent settings={settings} onUpdate={handleUpdate} />;
            case 'apiKeys': return <ApiKeysContent settings={settings} onUpdate={handleUpdate} />;
            case 'account': return <AccountDataContent settings={settings} onUpdate={handleUpdate} onLogout={onLogout} />;
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

const PersonaContent = ({ settings, onUpdate }) => {
    const { t } = useTranslation();
    const [greetingInput, setGreetingInput] = useState(settings.greeting);
    const [systemPromptInput, setSystemPromptInput] = useState(settings.systemPrompt);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const testAudioRef = useRef<HTMLAudioElement>(null);
    
    const emotionTuning = settings.emotionTuning || defaultSettings.emotionTuning;

    const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onUpdate('connectionSoundUrl', e.target?.result as string);
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
        onUpdate('gender', gender);
        onUpdate('greeting', newGreeting);
        setGreetingInput(newGreeting);
    };

    return (
        <div className="settings-section">
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
                        className="flex-grow p-2 rounded bg-bg-color border border-border-color focus:ring-1 focus:ring-primary-color focus:border-primary-color transition"
                    />
                    <button onClick={() => onUpdate('greeting', greetingInput)} className="quick-action-button save-button px-4">{t('settings.common.save')}</button>
                </div>
            </div>
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.personaTab.tuning.title')}</h3>
                    <p>{t('settings.personaTab.tuning.description')}</p>
                </div>
                <div className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="happiness-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                            <span>{t('settings.personaTab.tuning.happiness')}</span>
                            <span>{emotionTuning.happiness}%</span>
                        </label>
                        <input
                            id="happiness-slider"
                            type="range" min="0" max="100" step="1"
                            value={emotionTuning.happiness}
                            onChange={e => onUpdate('emotionTuning', { ...emotionTuning, happiness: parseInt(e.target.value, 10) })}
                            className="w-full mt-1"
                        />
                    </div>
                     <div>
                        <label htmlFor="empathy-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                            <span>{t('settings.personaTab.tuning.empathy')}</span>
                            <span>{emotionTuning.empathy}%</span>
                        </label>
                        <input
                            id="empathy-slider"
                            type="range" min="0" max="100" step="1"
                            value={emotionTuning.empathy}
                            onChange={e => onUpdate('emotionTuning', { ...emotionTuning, empathy: parseInt(e.target.value, 10) })}
                            className="w-full mt-1"
                        />
                    </div>
                     <div>
                        <label htmlFor="formality-slider" className="text-sm text-text-color-muted block mb-1 flex justify-between">
                            <span>{t('settings.personaTab.tuning.formality')}</span>
                            <span>{emotionTuning.formality}%</span>
                        </label>
                        <input
                            id="formality-slider"
                            type="range" min="0" max="100" step="1"
                            value={emotionTuning.formality}
                            onChange={e => onUpdate('emotionTuning', { ...emotionTuning, formality: parseInt(e.target.value, 10) })}
                            className="w-full mt-1"
                        />
                    </div>
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
                        onChange={e => onUpdate('ambientVolume', parseFloat(e.target.value))}
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
                            <button onClick={() => onUpdate('connectionSoundUrl', null)} className="quick-action-button bg-red-500/20 border-red-500/80 text-red-400 hover:bg-red-500/30">
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
                    className="w-full mt-4 p-2 rounded bg-bg-color border border-border-color focus:ring-1 focus:ring-primary-color focus:border-primary-color transition font-mono text-xs"
                />
                <div className="mt-3 flex justify-end">
                    <button onClick={() => onUpdate('systemPrompt', systemPromptInput)} className="quick-action-button save-button px-4">{t('settings.personaTab.systemPrompt.save')}</button>
                </div>
            </div>
        </div>
    );
};

const BiasContent = ({ settings, onUpdate }) => {
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

const VoiceContent = ({ settings, onUpdate, onTestVoice }) => {
    const { t } = useTranslation();
    const [localVoiceSettings, setLocalVoiceSettings] = useState(settings.voice);

    const handleChange = (type, prop, value) => {
        const newSettings = {
            ...localVoiceSettings,
            [type]: { ...localVoiceSettings[type], [prop]: value }
        };
        setLocalVoiceSettings(newSettings);
    };

    const handleTestVoice = (type) => {
        onTestVoice("This is a test of the selected voice.", localVoiceSettings[type]);
    };

    const handleSave = () => {
        onUpdate('voice', localVoiceSettings);
    };

    const renderVoicePanel = (type) => {
        const config = localVoiceSettings[type];
        const title = type === 'main' ? t('settings.voiceTab.main.title') : t('settings.voiceTab.greeting.title');
        const description = type === 'main' ? t('settings.voiceTab.main.description') : t('settings.voiceTab.greeting.description');

        return (
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
                <div className="mt-6 space-y-6">
                    <div>
                        <label className="text-sm text-text-color-muted block mb-1">{t('settings.voiceTab.styleLabel')}</label>
                        <select
                            value={config.name}
                            onChange={e => handleChange(type, 'name', e.target.value)}
                            className="w-full mt-1 p-2 rounded bg-bg-color border border-border-color"
                        >
                            {GEMINI_TTS_VOICES.map(voice => (
                                <option key={voice.name} value={voice.name}>
                                    {voice.name} ({voice.description})
                                </option>
                            ))}
                        </select>
                         <p className="text-xs text-text-color-muted mt-2">
                            {t('settings.voiceTab.styleDescription')}
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={() => handleTestVoice(type)} className="quick-action-button">{t('settings.voiceTab.test')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-section">
            {renderVoicePanel('main')}
            {renderVoicePanel('greeting')}
            <div className="mt-4 flex justify-end">
                <button onClick={handleSave} className="quick-action-button save-button px-4">{t('settings.voiceTab.save')}</button>
            </div>
        </div>
    );
};


const AvatarContent = ({ settings, onUpdate }) => {
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

const ApiKeysContent = ({ settings, onUpdate }) => {
    const { t } = useTranslation();
    const [keys, setKeys] = useState(settings.apiKeys);

    useEffect(() => {
        setKeys(settings.apiKeys);
    }, [settings.apiKeys]);

    const handleChange = (key, value) => {
        setKeys(prev => ({...prev, [key]: value}));
    }

    return (
        <div className="settings-section">
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.apiKeysTab.gemini.title')}</h3>
                    <p>{t('settings.apiKeysTab.gemini.description')}</p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <input type="password" value="••••••••••••••••••••••••••••" readOnly className="flex-grow p-2 rounded bg-bg-color border border-border-color font-mono" />
                    <button className="quick-action-button" disabled>{t('settings.apiKeysTab.gemini.envSet')}</button>
                </div>
            </div>
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.apiKeysTab.optional.title')}</h3>
                    <p>{t('settings.apiKeysTab.optional.description')}</p>
                </div>
                <div className="mt-4 space-y-4">
                     <div>
                        <label className="text-sm text-text-color-muted">{t('settings.apiKeysTab.weatherKey')}</label>
                        <input type="password" value={keys.weather} onChange={e => handleChange('weather', e.target.value)} className="w-full mt-1 p-2 rounded bg-bg-color border border-border-color"/>
                    </div>
                     <div>
                        <label className="text-sm text-text-color-muted">{t('settings.apiKeysTab.newsKey')}</label>
                        <input type="password" value={keys.news} onChange={e => handleChange('news', e.target.value)} className="w-full mt-1 p-2 rounded bg-bg-color border border-border-color"/>
                    </div>
                     <div>
                        <label className="text-sm text-text-color-muted">{t('settings.apiKeysTab.youtubeKey')}</label>
                        <input type="password" value={keys.youtube} onChange={e => handleChange('youtube', e.target.value)} className="w-full mt-1 p-2 rounded bg-bg-color border border-border-color"/>
                    </div>
                </div>
                 <div className="mt-4 flex justify-end">
                    <button onClick={() => onUpdate('apiKeys', keys)} className="quick-action-button save-button px-4">{t('settings.apiKeysTab.save')}</button>
                </div>
            </div>
        </div>
    );
};

const AccountDataContent = ({ settings, onUpdate, onLogout }) => {
    const { t } = useTranslation();
    const [copyText, setCopyText] = useState(t('settings.common.copy'));

    const handleCopy = () => {
        navigator.clipboard.writeText(settings.userId);
        setCopyText(t('settings.common.copied'));
        setTimeout(() => setCopyText(t('settings.common.copy')), 2000);
    };

    return (
        <div className="settings-section">
            <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.accountTab.session.title')}</h3>
                    <p>{t('settings.accountTab.session.description')}</p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <input type="text" readOnly value={settings.userId} className="flex-grow p-2 rounded bg-bg-color border border-border-color font-mono text-sm"/>
                    <button onClick={handleCopy} className="quick-action-button flex items-center gap-2"><CopyIcon /> {copyText}</button>
                </div>
            </div>
             <div className="settings-card">
                <div className="settings-section-header">
                    <h3>{t('settings.accountTab.data.title')}</h3>
                    <p>{t('settings.accountTab.data.description')}</p>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                    <div>
                        <button onClick={() => onUpdate('clearHistory', true)} className="quick-action-button bg-yellow-500/20 border-yellow-500/80 text-yellow-400 hover:bg-yellow-500/30 px-4">{t('settings.accountTab.clearHistory.button')}</button>
                        <p className="text-xs text-text-color-muted mt-2">{t('settings.accountTab.clearHistory.description')}</p>
                    </div>
                    <div>
                        <button onClick={onLogout} className="quick-action-button bg-red-500/20 border-red-500/80 text-red-400 hover:bg-red-500/30 px-4">{t('settings.accountTab.logout.button')}</button>
                        <p className="text-xs text-text-color-muted mt-2">{t('settings.accountTab.logout.description')}</p>
                    </div>
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


const ChatLog = ({ history }: { history: ChatMessage[] }) => {
    const { t } = useTranslation();
    const getCurrentTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

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
                <div className={`max-w-xl p-3 rounded-xl ${
                    msg.sender === 'user' 
                        ? 'bg-primary-color/20 text-text-color rounded-br-none' 
                        : msg.isError
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40 rounded-bl-none'
                            : 'bg-assistant-bubble-bg text-text-color rounded-bl-none'
                }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.onRetry && (
                        <div className="mt-3 pt-2 border-t border-red-500/30">
                            <button onClick={msg.onRetry} className="quick-action-button text-xs !text-yellow-400 !border-yellow-500/80 hover:!bg-yellow-500/20">
                                {t('settings.common.retry')}
                            </button>
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

type VoiceConfig = {
    name: string;
};

const BIAS_TEMPERATURE_MAP: Record<string, number> = {
    precise: 0.2,
    balanced: 0.7,
    creative: 1.0,
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
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [listeningHint, setListeningHint] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isYTReady, setIsYTReady] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);


  // YouTube Player State
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [playerProgress, setPlayerProgress] = useState({ currentTime: 0, duration: 0 });

  const [settings, setSettings] = useState(defaultSettings);

  const recognitionRef = useRef<any | null>(null);
  const playerRef = useRef<any>(null); // YT.Player
  const chatLogRef = useRef<HTMLDivElement>(null);
  const hasGreetedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const progressIntervalRef = useRef<number | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectionAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const noSpeechErrorCountRef = useRef(0);

  // Refs for Gemini TTS Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const speechSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Ref to track the current assistant state inside async callbacks
  const assistantStateRef = useRef(assistantState);
  assistantStateRef.current = assistantState;


  // --- Core Hooks ---
  useEffect(() => {
    try {
        const loggedInUserId = localStorage.getItem('kaniska-session-userId');
        if (loggedInUserId) {
            const allUsers = JSON.parse(localStorage.getItem('kaniska-users') || '[]');
            const user = allUsers.find(u => u.id === loggedInUserId);
            if (user) {
                setCurrentUser(user);
                const loadedSettings = user.settings || {};
                const mergedSettings = {
                    ...defaultSettings,
                    ...loadedSettings,
                    voice: { ...defaultSettings.voice, ...(loadedSettings.voice || {}) },
                    apiKeys: { ...defaultSettings.apiKeys, ...(loadedSettings.apiKeys || {}) },
                    avatarMap: { ...defaultSettings.avatarMap, ...(loadedSettings.avatarMap || {}) },
                    emotionTuning: { ...defaultSettings.emotionTuning, ...(loadedSettings.emotionTuning || {}) }
                };
                setSettings(mergedSettings);
                setChatHistory(user.chatHistory || []);
            }
        }
    } catch (e: any) {
        console.error("Failed to load user session from localStorage", e);
    }
  }, []);
  
  useEffect(() => {
    // This effect runs once on mount
    
    // Configure ambient audio
    if (ambientAudioRef.current) {
        ambientAudioRef.current.volume = 0;
        // Programmatically set the source for the ambient audio.
        // This helps prevent a race condition on some browsers where play() might be
        // called before the browser has processed the `src` attribute from the JSX,
        // which would lead to a "no supported sources" error.
        if (!ambientAudioRef.current.src) {
           ambientAudioRef.current.src = "https://storage.googleapis.com/aai-web-samples/scifi-ambience.mp3";
        }
    }
    
    const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = context;
    const gainNode = context.createGain();
    gainNode.connect(context.destination);
    gainNodeRef.current = gainNode;
    
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

  const saveCurrentUserChanges = useCallback(() => {
    if (!currentUser) return;
    try {
        const allUsers = JSON.parse(localStorage.getItem('kaniska-users') || '[]');
        const userIndex = allUsers.findIndex(u => u.id === currentUser.id);
        
        const updatedUser = {
            ...currentUser,
            settings: settings,
            chatHistory: chatHistory,
        };

        if (userIndex !== -1) {
            allUsers[userIndex] = updatedUser;
        } else {
            allUsers.push(updatedUser);
        }
        
        localStorage.setItem('kaniska-users', JSON.stringify(allUsers));
    } catch (e: any) {
        console.error("Failed to save user data to localStorage", e);
    }
  }, [currentUser, settings, chatHistory]);

  const handleSettingChange = (newSettings: any) => {
    const tempSettings = { ...newSettings };
    if (tempSettings.clearHistory) {
      setChatHistory([]);
      delete tempSettings.clearHistory;
    }
    setSettings(tempSettings);
  };

  useEffect(() => {
      saveCurrentUserChanges();
  }, [settings, chatHistory, saveCurrentUserChanges]);
  
  const fadeAmbientSound = useCallback((targetVolume: number, duration = 500) => {
    const audio = ambientAudioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
        window.clearInterval(fadeIntervalRef.current);
    }

    if (targetVolume > 0 && audio.paused) {
        audio.volume = 0; // Start muted to avoid a sudden burst of sound
        audio.play().catch(e => {
            // AbortError is expected if the user quickly changes state, interrupting the play promise.
            // We can safely ignore it.
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
    const playStates: AssistantState[] = ['idle', 'listening', 'thinking', 'composing', 'confused'];

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
    if (!isSpeakingRef.current) {
        setAssistantState('listening');
    }
    if (recognitionRef.current) {
        try {
            recognitionRef.current.start();
        } catch (e) {
            if (e.name !== 'InvalidStateError') {
                console.warn("Recognition already started.", e);
            }
        }
    }
  }, []);
  
  const speak = useCallback(async (text: string, config: VoiceConfig, onEndCallback?: () => void) => {
    if (speechSourceRef.current) {
        speechSourceRef.current.onended = null;
        speechSourceRef.current.stop();
        speechSourceRef.current.disconnect();
    }

    isSpeakingRef.current = true;
    setAssistantState('speaking');
    
    try {
        const base64Audio = await generateSpeech(text, config.name);
        if (!audioContextRef.current || !gainNodeRef.current) {
            throw new Error("AudioContext not initialized");
        }
        
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            audioContextRef.current,
            24000,
            1,
        );
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);
        source.onended = () => {
            isSpeakingRef.current = false;
            speechSourceRef.current = null;
            if (onEndCallback) {
                onEndCallback();
            } else {
                setAssistantState('idle');
            }
        };
        source.start();
        speechSourceRef.current = source;
    } catch (error: any) {
        console.error("Error generating or playing speech:", error);
        isSpeakingRef.current = false;
        setAssistantState('error');

        const retrySpeak = () => {
            setChatHistory(prev => prev.filter(m => !m.onRetry));
            speak(text, config, onEndCallback);
        };

        setChatHistory(prev => [...prev, { 
            id: Date.now(), 
            sender: 'assistant', 
            text: error.message,
            isError: true,
            onRetry: retrySpeak 
        }]);
    }
  }, []);

  const addErrorMessageToChat = useCallback((message: string, onRetry?: () => void) => {
    if (speechSourceRef.current) {
        speechSourceRef.current.onended = null;
        speechSourceRef.current.stop();
    }
    isSpeakingRef.current = false;

    setChatHistory(prev => [
        ...prev.filter(m => !m.onRetry), 
        {
            id: Date.now(),
            sender: 'assistant',
            text: message,
            isError: true,
            onRetry: onRetry,
        },
    ]);
    speak(message, settings.voice.main, () => setAssistantState('error'));
    setAssistantState('error');
  }, [speak, settings.voice.main]);

  const handleTestVoice = (text: string, config: VoiceConfig) => {
    speak(text, config);
  };
  
  const handleLogin = (identifier: string, password: string): boolean => {
      try {
          const allUsers = JSON.parse(localStorage.getItem('kaniska-users') || '[]');
          const normalizedIdentifier = identifier.toLowerCase().trim();
          const user = allUsers.find(u =>
              (u.email.toLowerCase() === normalizedIdentifier || u.name === identifier || u.phone === identifier) && u.password === password
          );
          if (user) {
              localStorage.setItem('kaniska-session-userId', user.id);
              setCurrentUser(user);
              const loadedSettings = user.settings || {};
              const mergedSettings = {
                  ...defaultSettings,
                  ...loadedSettings,
                  voice: { ...defaultSettings.voice, ...(loadedSettings.voice || {}) },
                  apiKeys: { ...defaultSettings.apiKeys, ...(loadedSettings.apiKeys || {}) },
                  avatarMap: { ...defaultSettings.avatarMap, ...(loadedSettings.avatarMap || {}) },
                  emotionTuning: { ...defaultSettings.emotionTuning, ...(loadedSettings.emotionTuning || {}) }
              };
              setSettings(mergedSettings);
              setChatHistory(user.chatHistory || []);
              return true;
          }
          return false;
      } catch (e) {
          console.error("Login failed:", e);
          return false;
      }
  };

  const handleSignUp = (name: string, email: string, phone: string, password: string): { success: boolean, message: string } => {
    try {
        const allUsers = JSON.parse(localStorage.getItem('kaniska-users') || '[]');
        const normalizedEmail = email.toLowerCase().trim();
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();

        if (allUsers.some(u => u.email.toLowerCase() === normalizedEmail)) {
            return { success: false, message: 'auth.error.emailExists' };
        }
        if (allUsers.some(u => u.name === trimmedName)) {
            return { success: false, message: 'auth.error.usernameExists' };
        }
        
        const newUserId = `user-${Date.now()}`;
        const newSettings = {
            ...defaultSettings,
            userId: newUserId,
        };

        const newUser = {
            id: newUserId,
            name: trimmedName,
            email: normalizedEmail,
            phone: trimmedPhone,
            password: password,
            settings: newSettings,
            chatHistory: [],
        };

        allUsers.push(newUser);
        localStorage.setItem('kaniska-users', JSON.stringify(allUsers));
        handleLogin(email, password);
        return { success: true, message: '' };
    } catch (e) {
        console.error("Signup failed:", e);
        return { success: false, message: 'auth.error.unexpected' };
    }
  };

  const handleLogout = () => {
    saveCurrentUserChanges();
    localStorage.removeItem('kaniska-session-userId');
    setCurrentUser(null);
    setIsConnected(false);
    setChatHistory([]);
  };

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(50);
  };
  
  const onPlayerStateChange = (event: any) => {
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
  };

  useEffect(() => {
    if (youtubeVideoId && isYTReady) {
        if (!playerRef.current) {
            playerRef.current = new window.YT.Player('youtube-player', {
                videoId: youtubeVideoId,
                playerVars: { 'autoplay': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0 },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        } else {
            playerRef.current.loadVideoById(youtubeVideoId);
        }
    }
  }, [youtubeVideoId, isYTReady]);
  
  const handleYoutubeControl = (action: string) => {
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
  };
  
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  }, []);

    const executeYoutubeSearch = useCallback(async (query: string) => {
        try {
            setAssistantState('thinking');
            setChatHistory(prev => prev.filter(m => !m.onRetry));
            const videoId = await searchYouTube(settings.apiKeys.youtube, query);
            if (videoId) {
                setYoutubeVideoId(videoId);
            } else {
                const notFoundMsg = `I couldn't find a suitable video for "${query}".`;
                 speak(notFoundMsg, settings.voice.main);
                 setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: notFoundMsg }]);
            }
        } catch (e: any) {
            addErrorMessageToChat(e.message, () => executeYoutubeSearch(query));
        }
    }, [settings.apiKeys.youtube, addErrorMessageToChat, speak, settings.voice.main]);

    const executeWeatherFetch = useCallback(async (location: string) => {
        try {
            setAssistantState('thinking');
            setChatHistory(prev => prev.filter(m => !m.onRetry));
            const weatherSummary = await fetchWeatherSummary(location, settings.apiKeys.weather);
            speak(weatherSummary, settings.voice.main);
            setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: weatherSummary }]);
        } catch (e: any) {
            addErrorMessageToChat(e.message, () => executeWeatherFetch(location));
        }
    }, [settings.apiKeys.weather, addErrorMessageToChat, speak, settings.voice.main]);

    const executeNewsFetch = useCallback(async (query: string) => {
        try {
            setAssistantState('thinking');
            setChatHistory(prev => prev.filter(m => !m.onRetry));
            const newsSummary = await fetchNews(settings.apiKeys.news, query);
            speak(newsSummary, settings.voice.main);
            setChatHistory(prev => [...prev, { id: Date.now(), sender: 'assistant', text: newsSummary }]);
        } catch (e: any) {
            addErrorMessageToChat(e.message, () => executeNewsFetch(query));
        }
    }, [settings.apiKeys.news, addErrorMessageToChat, speak, settings.voice.main]);


  const handleCommand = useCallback(async (transcript: string) => {
      stopRecognition();
      setAssistantState('thinking');
      const userMessage: ChatMessage = { id: Date.now(), sender: 'user', text: transcript };
      const updatedHistory = [...chatHistory, userMessage];
      setChatHistory(updatedHistory);

      const systemInstruction = getSystemPrompt(settings.gender);
      
      let response;
      try {
        response = await processUserCommand(updatedHistory, systemInstruction, BIAS_TEMPERATURE_MAP[settings.bias], settings.emotionTuning);
      } catch(error: any) {
          addErrorMessageToChat(error.message, () => handleCommand(transcript));
          return;
      }
      
      const assistantMessage: ChatMessage = { id: Date.now() + 1, sender: 'assistant', text: response.reply, sources: response.sources };
      setChatHistory(prev => [...prev, assistantMessage]);

      speak(response.reply, settings.voice.main, () => {
          if (isConnected) {
              startRecognition();
          } else {
              setAssistantState('idle');
          }
      });
      
      switch (response.command) {
          case 'YOUTUBE_SEARCH':
              if (response.youtubeQuery) {
                  await executeYoutubeSearch(response.youtubeQuery);
              }
              break;
          case 'GET_WEATHER':
              if (response.location) {
                  await executeWeatherFetch(response.location);
              }
              break;
          case 'GET_NEWS':
              if(response.newsQuery) {
                  await executeNewsFetch(response.newsQuery);
              }
              break;
      }
  }, [
      chatHistory, settings.gender, settings.bias, settings.emotionTuning, 
      settings.voice.main, isConnected, speak, stopRecognition, startRecognition, 
      addErrorMessageToChat, executeYoutubeSearch, executeWeatherFetch, executeNewsFetch
  ]);

  const handleConnect = useCallback(() => {
    if (!hasInteracted) setHasInteracted(true);

    if (isConnected) {
      stopRecognition();
      if (speechSourceRef.current) {
        speechSourceRef.current.stop();
      }
      isSpeakingRef.current = false;
      setIsConnected(false);
      setAssistantState('idle');
      hasGreetedRef.current = false;
    } else {
      if (connectionAudioRef.current && settings.connectionSoundUrl) {
          connectionAudioRef.current.src = settings.connectionSoundUrl;
          connectionAudioRef.current.play().catch(e => console.error("Error playing connection sound:", e));
      }
      setIsConnected(true);
      
      if (!hasGreetedRef.current) {
        speak(settings.greeting, settings.voice.greeting, () => {
          startRecognition();
          hasGreetedRef.current = true;
        });
      } else {
        startRecognition();
      }
    }
  }, [hasInteracted, isConnected, settings.connectionSoundUrl, settings.greeting, settings.voice.greeting, speak, startRecognition, stopRecognition]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setListeningHint("Speech Recognition not supported.");
      return;
    }
    
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';

    recognition.onstart = () => {
      if (!isSpeakingRef.current) {
        setAssistantState('listening');
      }
    };

    recognition.onresult = (event: any) => {
      noSpeechErrorCountRef.current = 0; // Reset on successful speech input
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setCurrentTranscript(interimTranscript);
      if (finalTranscript.trim()) {
        if (isSpeakingRef.current && speechSourceRef.current) {
            // Force-stop current speech to allow interruption.
            speechSourceRef.current.onended = null; // Prevent old callback from restarting recognition
            speechSourceRef.current.stop();
            speechSourceRef.current = null;
            isSpeakingRef.current = false;
        }
        handleCommand(finalTranscript.trim());
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'no-speech') {
        noSpeechErrorCountRef.current += 1;
        setListeningHint(t('main.noSpeechHint'));
        if(hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = window.setTimeout(() => setListeningHint(null), 2500);
      } else {
        noSpeechErrorCountRef.current = 0;
        setAssistantState('error');
      }
    };

    recognition.onend = () => {
      if (noSpeechErrorCountRef.current >= 3) {
        handleConnect(); // Toggle connection off
        setListeningHint(t('main.status.disconnectedInactivity'));
        if(hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = window.setTimeout(() => setListeningHint(null), 4000);
        noSpeechErrorCountRef.current = 0;
        return;
      }
      // Only restart recognition if we are connected AND the assistant is in a state
      // where it should be listening (i.e., not thinking or speaking). This prevents feedback loops.
      if (isConnected && (assistantStateRef.current === 'idle' || assistantStateRef.current === 'listening')) {
        startRecognition();
      } else if (!isConnected) {
        setAssistantState('idle');
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isConnected, handleCommand, startRecognition, t, lang, handleConnect]);

  const getAssistantStatusText = () => {
    if (listeningHint) return <span className="state-text-animation text-yellow-400">{listeningHint}</span>;
    switch(assistantState) {
        case 'listening': return <span className="listening-text-pulse">{currentTranscript || t('main.status.listening')}</span>;
        case 'thinking': return t('main.status.thinking');
        case 'speaking': return t('main.status.speaking');
        case 'error': return <span className="text-red-400">{t('main.status.error')}</span>;
        default: return t('main.status.idle');
    }
  };
  
  if (!currentUser) {
      return <Auth onLogin={handleLogin} onSignUp={handleSignUp} />;
  }

  return (
    <div className="bg-bg-color text-text-color w-screen h-screen flex flex-col overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
        <h1 className="text-xl font-bold tracking-wider glowing-text">{t('appName')}</h1>
        <div className="flex items-center gap-4">
          <Clock />
           <div className="relative">
              <button onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)} className="footer-button flex items-center gap-2" aria-haspopup="true" aria-expanded={isLangDropdownOpen}>
                  <GlobeIcon />
                  <span>{lang.toUpperCase()}</span>
              </button>
              {isLangDropdownOpen && (
                  <div className="absolute right-0 mt-2 py-1 w-28 bg-panel-bg border border-border-color rounded-md shadow-lg z-20">
                      {availableLanguages.map((l) => (
                          <a
                              href="#"
                              key={l.code}
                              onClick={(e) => {
                                  e.preventDefault();
                                  setLang(l.code);
                                  setIsLangDropdownOpen(false);
                              }}
                              className="block px-4 py-2 text-sm text-text-color-muted hover:bg-assistant-bubble-bg hover:text-text-color"
                          >
                              {l.name}
                          </a>
                      ))}
                  </div>
              )}
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="footer-button" aria-label={t('header.settings')}>
            <SettingsIcon />
          </button>
        </div>
      </header>

      <main className="flex-grow flex min-h-0">
        <div className="flex-grow flex flex-col items-center justify-center p-4 relative">
            <div className={`hologram-container ${isConnected && assistantState === 'listening' ? 'listening-hologram' : ''}`}>
                {assistantState === 'thinking' && (
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
            {isConnected ? getAssistantStatusText() : t('main.status.offline')}
          </p>
        </div>

        <aside className="w-[380px] flex-shrink-0 bg-panel-bg border-l border-border-color flex flex-col animate-panel-enter">
          {youtubeVideoId ? (
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
          ) : (
            <div ref={chatLogRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
              <ChatLog history={chatHistory} />
            </div>
          )}
        </aside>
      </main>
      
      <footer className="flex items-center justify-center p-3 border-t border-border-color flex-shrink-0">
        <button onClick={handleConnect} className="flex items-center gap-3 px-6 py-3 rounded-full bg-primary-color text-bg-color font-bold text-lg hover:opacity-90 transition transform hover:scale-105 active:scale-100 disabled:opacity-50 disabled:scale-100">
            {isConnected ? <StopIcon /> : <ConnectIcon />}
            <span>{isConnected ? t('footer.disconnect') : t('footer.connect')}</span>
        </button>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSettingChange={handleSettingChange}
        onTestVoice={handleTestVoice}
        onLogout={handleLogout}
      />
      <audio ref={ambientAudioRef} loop />
      <audio ref={connectionAudioRef} />
    </div>
  );
};