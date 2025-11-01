


export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'composing'
  | 'confused'
  | 'sleep';

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
}

export type Emotion = 'neutral' | 'happy' | 'sad' | 'excited' | 'empathetic' | 'singing' | 'formal' | 'chirpy' | 'surprised' | 'curious' | 'thoughtful' | 'joking';

export interface GeminiResponse {
  command: 'REPLY' | 'YOUTUBE_SEARCH' | 'GET_WEATHER' | 'GET_NEWS' | 'SEND_EMAIL';
  reply: string;
  // FIX: youtubeQuery is always present as per the system prompt (can be an empty string).
  youtubeQuery: string;
  newsQuery: string;
  location: string;
  emotion: Emotion;
  sources: Source[];
}

export type Gender = 'female' | 'male';