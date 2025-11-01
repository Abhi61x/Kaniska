
export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'composing'
  | 'confused'
  | 'sleep'
  | 'singing';

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
  command: 'REPLY' | 'YOUTUBE_SEARCH' | 'GET_WEATHER' | 'GET_NEWS' | 'SEND_EMAIL' | 'SING_SONG' | 'DEACTIVATE_LISTENING';
  reply: string;
  // FIX: youtubeQuery is always present as per the system prompt (can be an empty string).
  youtubeQuery: string;
  newsQuery: string;
  location: string;
  emotion: Emotion;
  sources: Source[];
  songTitle?: string;
  songArtist?: string;
}

export type Gender = 'female' | 'male';