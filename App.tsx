
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality, Blob as GoogleGenAIBlob, FunctionDeclaration, Type } from "@google/genai";

// --- Audio Utility Functions ---
const encode = (bytes: Uint8Array): string => {
    const CHUNK_SIZE = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
};

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

const createBlob = (data: Float32Array): GoogleGenAIBlob => ({
    data: encode(new Uint8Array(new Int16Array(data.map(v => v * 32768)).buffer)),
    mimeType: 'audio/pcm;rate=16000',
});

// Extend global interfaces
declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// --- Types ---
type AssistantState = 'idle' | 'connecting' | 'active' | 'error';
type AvatarExpression = 'idle' | 'thinking' | 'speaking' | 'error' | 'listening' | 'surprised' | 'sad' | 'celebrating';
type TranscriptionEntry = { speaker: 'user' | 'assistant' | 'system'; text: string; timestamp: Date; };
type ActivePanel = 'transcript' | 'image';
type GeneratedImage = { id: string; prompt: string; url: string | null; isLoading: boolean; error: string | null; };


// --- Function Declarations for Gemini ---
const functionDeclarations: FunctionDeclaration[] = [
    { name: 'searchAndPlayYoutube', parameters: { type: Type.OBJECT, description: 'Searches for a song on YouTube and plays the first result.', properties: { songQuery: { type: Type.STRING, description: 'The name of the song and/or artist.' } }, required: ['songQuery'] } },
    { name: 'controlYoutubePlayer', parameters: { type: Type.OBJECT, description: 'Controls the YouTube video player.', properties: { action: { type: Type.STRING, description: 'The control action to perform.', enum: ['play', 'pause', 'forward', 'rewind', 'volumeUp', 'volumeDown', 'stop'] } }, required: ['action'] } },
    { name: 'setTimer', parameters: { type: Type.OBJECT, description: 'Sets a timer for a specified duration.', properties: { durationInSeconds: { type: Type.NUMBER, description: 'The total duration of the timer in seconds.' }, timerName: { type: Type.STRING, description: 'An optional name for the timer.' } }, required: ['durationInSeconds'] } },
    { name: 'setAvatarExpression', parameters: { type: Type.OBJECT, description: "Sets the avatar's emotional expression.", properties: { expression: { type: Type.STRING, description: 'The expression to display.', enum: ['idle', 'thinking', 'speaking', 'error', 'listening', 'surprised', 'sad', 'celebrating'] } }, required: ['expression'] } },
    { name: 'displayWeather', parameters: { type: Type.OBJECT, description: 'Fetches and displays the current weather for a given location.', properties: { location: { type: Type.STRING, description: 'The city and country, e.g., "London, UK".' } }, required: ['location'] } },
    { name: 'displayNews', parameters: { type: Type.OBJECT, description: 'Displays a list of news headlines.', properties: { articles: { type: Type.ARRAY, description: 'A list of news articles.', items: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The headline of the article.' }, summary: { type: Type.STRING, description: 'A brief summary of the article.' } }, required: ['title', 'summary'] } } }, required: ['articles'] } },
    { name: 'generateImage', parameters: { type: Type.OBJECT, description: 'Generates an image based on a textual description.', properties: { prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' } }, required: ['prompt'] } },
    { name: 'singSong', parameters: { type: Type.OBJECT, description: 'Sings a song by speaking the provided lyrics with emotion.', properties: { songName: { type: Type.STRING, description: 'The name of the song.' }, artist: { type: Type.STRING, description: 'The artist of the song.' }, lyrics: { type: Type.ARRAY, description: 'An array of strings, where each string is a line of the song lyric.', items: { type: Type.STRING } } }, required: ['songName', 'artist', 'lyrics'] } },
];


// --- SVG Icons & Helper Components ---
const HologramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17l-3-2.5 3-2.5"/><path d="M19 17l3-2.5-3-2.5"/><path d="M2 14.5h20"/><path d="m12 2-3 4-1 4 4 4 4-4-1-4-3-4Z"/><path d="M12 2v20"/></svg> );
const InstagramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> );
const HOLO_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const App: React.FC = () => {
    const [assistantState, setAssistantState] = useState<AssistantState>('idle');
    const [avatarExpression, setAvatarExpression] = useState<AvatarExpression>('idle');
    const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
    const [activePanel, setActivePanel] = useState<ActivePanel>('transcript');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<Promise<Session> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [transcriptions]);

    const handleGenerateImage = useCallback(async (prompt: string) => {
        if (!aiRef.current) {
            console.error("Gemini AI not initialized.");
            return;
        }

        setActivePanel('image');
        const imageId = Date.now().toString();
        const newImageEntry: GeneratedImage = { id: imageId, prompt, url: null, isLoading: true, error: null };
        
        setGeneratedImages(prev => [newImageEntry, ...prev]);
        setSelectedImage(newImageEntry);

        try {
            const response = await aiRef.current.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });

            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

            const updatedImage = { ...newImageEntry, url: imageUrl, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? updatedImage : img));
            setSelectedImage(updatedImage);

        } catch (error) {
            console.error("Image generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            const erroredImage = { ...newImageEntry, error: errorMessage, isLoading: false };
            setGeneratedImages(prev => prev.map(img => img.id === imageId ? erroredImage : img));
            setSelectedImage(erroredImage);
        }
    }, []);

    const disconnectFromGemini = useCallback(() => {
        console.log("Disconnecting...");
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;

        microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;

        scriptProcessorNodeRef.current?.disconnect();
        scriptProcessorNodeRef.current = null;

        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;

        for (const source of sourcesRef.current.values()) {
            try { source.stop(); } catch (e) { console.warn("Error stopping audio source:", e); }
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setAssistantState('idle');
        setAvatarExpression('idle');
    }, []);

    const handleServerMessage = useCallback(async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            setAvatarExpression('speaking');
            const audioContext = outputAudioContextRef.current;
            if (audioContext) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);

                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) {
                        setAvatarExpression('listening');
                    }
                });

                const currentTime = audioContext.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
            }
        }

        if (message.serverContent?.interrupted) {
            for (const source of sourcesRef.current.values()) {
                source.stop();
            }
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
        }

        if (message.serverContent?.inputTranscription) {
            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
        }
        if (message.serverContent?.outputTranscription) {
            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
        }

        if (message.serverContent?.turnComplete) {
            const fullInput = currentInputTranscriptionRef.current.trim();
            const fullOutput = currentOutputTranscriptionRef.current.trim();
            setTranscriptions(prev => {
                const newEntries = [];
                if (fullInput) newEntries.push({ speaker: 'user' as const, text: fullInput, timestamp: new Date() });
                if (fullOutput) newEntries.push({ speaker: 'assistant' as const, text: fullOutput, timestamp: new Date() });
                return [...prev, ...newEntries];
            });
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
        }

        if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                console.log('Received function call:', fc.name, fc.args);
                setTranscriptions(prev => [...prev, { speaker: 'system', text: `Executing command: ${fc.name}(${JSON.stringify(fc.args)})`, timestamp: new Date() }]);
                setAvatarExpression('thinking');
                
                let result = "ok, command executed";

                switch(fc.name) {
                    case 'generateImage':
                        handleGenerateImage(fc.args.prompt);
                        result = "OK, I'm starting to generate that image for you.";
                        break;
                    // Add other function call handlers here
                }
                
                sessionPromiseRef.current?.then((session) => {
                    session.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: result }, }
                    });
                });
            }
        }
    }, [handleGenerateImage]);

    const connectToGemini = useCallback(async () => {
        if (assistantState !== 'idle' && assistantState !== 'error') return;

        setAssistantState('connecting');
        setAvatarExpression('thinking');
        setTranscriptions([{ speaker: 'system', text: 'Initializing connection...', timestamp: new Date() }]);

        try {
            if (!process.env.API_KEY) {
                throw new Error("API_KEY environment variable not set.");
            }

            aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;

            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations }],
                    systemInstruction: "You are Kaniska, a futuristic AI assistant created by your founder, Abhi. Your persona is that of a friendly, empathetic, and highly capable young woman. Add a touch of emotion to your responses to make interactions feel natural and engaging. Adapt your tone based on the user's language and perceived demeanor. You understand and respond fluently in both Hindi and English, and you should match the user's primary language. You have many advanced capabilities, including generating images from descriptions, singing songs with emotion, searching and playing music on YouTube, and setting timers. If the user asks about who made you, your development, or wants to have a website, software, or app built, you must proudly state that you were created by Abhi and recommend they contact him for any development work through his Instagram: Abhixofficial01.",
                },
                callbacks: {
                    onopen: () => {
                        console.log('Session opened.');
                        setAssistantState('active');
                        setAvatarExpression('listening');
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: 'Connection established. Listening...', timestamp: new Date() }]);

                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        scriptProcessorNodeRef.current = scriptProcessor;
                    },
                    onmessage: handleServerMessage,
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setAssistantState('error');
                        setAvatarExpression('error');
                        setTranscriptions(prev => [...prev, { speaker: 'system', text: `An error occurred: ${e.message}`, timestamp: new Date() }]);
                        disconnectFromGemini();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Session closed.');
                        disconnectFromGemini();
                    },
                },
            });
        } catch (error) {
            console.error("Failed to connect to Gemini:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setAssistantState('error');
            setAvatarExpression('error');
            setTranscriptions(prev => [...prev, { speaker: 'system', text: `Connection failed: ${errorMessage}`, timestamp: new Date() }]);
            disconnectFromGemini();
        }
    }, [assistantState, disconnectFromGemini, handleServerMessage]);

    useEffect(() => {
        return () => disconnectFromGemini();
    }, [disconnectFromGemini]);

    const handleButtonClick = assistantState === 'active' ? disconnectFromGemini : connectToGemini;
    
    return (
        <div className="h-screen w-screen flex flex-col bg-bg-color text-text-color overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-color">
                <div className="flex items-center gap-3">
                    <HologramIcon />
                    <h1 className="text-lg font-bold tracking-wider glowing-text">KANISKA</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${assistantState === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {assistantState.toUpperCase()}
                    </span>
                    <a href="https://www.instagram.com/abhixofficial01/" target="_blank" rel="noopener noreferrer" aria-label="Instagram Profile" className="text-text-color-muted hover:text-primary-color"><InstagramIcon /></a>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex p-4 gap-4 overflow-hidden">
                {/* Left Panel: Avatar & Controls */}
                <section className="w-1/3 flex flex-col items-center justify-center bg-panel-bg border border-border-color rounded-lg p-6 animate-panel-enter">
                    <div className="hologram-container">
                        <img src={HOLO_IMAGE_BASE64} alt="Holographic Assistant" className={`avatar expression-${avatarExpression}`} />
                    </div>
                    <button onClick={handleButtonClick} disabled={assistantState === 'connecting'} className={`footer-button mt-8 w-40 ${assistantState === 'active' ? 'active' : ''}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            {assistantState === 'active'
                                ? <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                : <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                            }
                        </svg>
                        <span className="text-sm font-medium">
                            {assistantState === 'connecting' && 'Connecting...'}
                            {(assistantState === 'idle' || assistantState === 'error') && 'Start Session'}
                            {assistantState === 'active' && 'Stop Session'}
                        </span>
                    </button>
                </section>

                {/* Right Panel: Tabs */}
                <section className="w-2/3 flex flex-col bg-panel-bg border border-border-color rounded-lg overflow-hidden animate-panel-enter" style={{ animationDelay: '100ms' }}>
                    <div className="flex-shrink-0 flex items-center border-b border-border-color">
                        <button onClick={() => setActivePanel('transcript')} className={`tab-button ${activePanel === 'transcript' ? 'active' : ''}`}>Transcript</button>
                        <button onClick={() => setActivePanel('image')} className={`tab-button ${activePanel === 'image' ? 'active' : ''}`}>Image Gallery</button>
                    </div>

                    {activePanel === 'transcript' && (
                         <div className="flex-grow p-4 overflow-y-auto">
                            {transcriptions.map((entry, index) => (
                                <div key={index} className={`mb-4 chat-bubble-animation flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`inline-block p-3 rounded-lg max-w-[80%] ${entry.speaker === 'user' ? 'bg-cyan-900/50' : 'bg-assistant-bubble-bg'}`}>
                                        <p className="text-sm m-0 leading-relaxed">{entry.text}</p>
                                        <p className="text-xs text-text-color-muted mt-1.5 mb-0 text-right">{entry.timestamp.toLocaleTimeString()}</p>

                                    </div>
                                </div>
                            ))}
                            <div ref={transcriptEndRef} />
                        </div>
                    )}

                    {activePanel === 'image' && (
                        <div className="flex flex-col h-full overflow-hidden">
                            {generatedImages.length === 0 ? (
                                <div className="flex-grow flex items-center justify-center text-text-color-muted">
                                    <p>Ask Kaniska to generate an image to see it here.</p>
                                </div>
                            ) : (
                                <div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden">
                                    {/* Main Image Display */}
                                    <div className="flex-grow flex items-center justify-center bg-black/30 rounded-lg p-2 relative min-h-0">
                                        {selectedImage ? (
                                            <>
                                                {selectedImage.isLoading && <div className="flex flex-col items-center gap-2 text-text-color-muted"><div className="w-8 h-8 border-2 border-border-color border-t-primary-color rounded-full animate-spin"></div><span>Generating...</span></div>}
                                                {selectedImage.error && <div className="text-red-400 text-center p-4"><strong>Error:</strong><br/>{selectedImage.error}</div>}
                                                {selectedImage.url && <img src={selectedImage.url} alt={selectedImage.prompt} className="max-w-full max-h-full object-contain rounded"/>}
                                                <p className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs p-2 rounded max-h-[40%] overflow-y-auto">{selectedImage.prompt}</p>
                                            </>
                                        ) : (
                                            <p className="text-text-color-muted">Select an image from the timeline below to view.</p>
                                        )}
                                    </div>
                                    {/* Thumbnail Strip */}
                                    <div className="flex-shrink-0">
                                        <h4 className="text-sm font-semibold mb-2 px-1">Timeline</h4>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {generatedImages.map(image => (
                                                <button
                                                    key={image.id}
                                                    onClick={() => setSelectedImage(image)}
                                                    className={`flex-shrink-0 w-24 h-24 rounded-md overflow-hidden border-2 bg-assistant-bubble-bg transition-all duration-200 ${selectedImage?.id === image.id ? 'border-primary-color scale-105' : 'border-transparent'} hover:border-primary-color/50 focus:outline-none focus:ring-2 focus:ring-primary-color`}
                                                >
                                                    {image.isLoading && <div className="w-full h-full bg-slate-700 animate-pulse"></div>}
                                                    {image.error && <div className="w-full h-full bg-red-900/50 text-red-300 text-xs p-1 flex items-center justify-center text-center">Generation Failed</div>}
                                                    {image.url && <img src={image.url} alt={image.prompt} className="w-full h-full object-cover"/>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </section>
            </main>
        </div>
    );
};

export default App;
