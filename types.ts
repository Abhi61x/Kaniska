


export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'composing'
  | 'confused'
  | 'singing'
  | 'sad'
  | 'celebrating'
  | 'surprised';

export interface Source {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  isError?: boolean;
  onRetry?: () => void;
  isApiKeyError?: boolean;
}

export type Emotion = 'neutral' | 'happy' | 'sad' | 'excited' | 'empathetic' | 'singing' | 'formal' | 'chirpy' | 'surprised' | 'curious' | 'thoughtful' | 'joking';

export interface GeminiResponse {
  command: 'REPLY' | 'YOUTUBE_SEARCH' | 'GET_WEATHER' | 'GET_NEWS' | 'SEND_EMAIL' | 'SING_SONG' | 'GET_LYRICS' | 'DEACTIVATE_LISTENING' | 'SET_TIMER' | 'RANDOM_FACT';
  reply: string;
  // FIX: youtubeQuery is always present as per the system prompt (can be an empty string).
  youtubeQuery: string;
  newsQuery: string;
  location: string;
  emotion: Emotion;
  sources: Source[];
  songTitle?: string;
  songArtist?: string;
  timerDurationSeconds?: number;
}

export type Gender = 'female' | 'male';

export interface WeatherData {
    summary: string;
    location: string;
    temp: number;
    conditions: string;
    icon: string; // e.g., 'partly-cloudy-day', 'clear-day', 'rain'
}