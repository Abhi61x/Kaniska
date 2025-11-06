
import { GoogleGenAI, Type, Content, Modality } from '@google/genai';
import type { GeminiResponse, Emotion, Source, ChatMessage, WeatherData } from '../types.ts';

// A custom error class to signal API key issues that the user can fix.
export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

// A custom error for the main, environment-set API key which the user cannot fix.
export class MainApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainApiKeyError';
  }
}


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const VALID_EMOTIONS: Emotion[] = ['neutral', 'happy', 'sad', 'excited', 'empathetic', 'singing', 'formal', 'chirpy', 'surprised', 'curious', 'thoughtful', 'joking'];

export async function processUserCommand(
    history: ChatMessage[], 
    systemInstruction: string, 
    temperature: number,
    emotionTuning: { happiness: number; empathy: number; formality: number; excitement: number; sadness: number; curiosity: number; }
): Promise<GeminiResponse> {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.sender !== 'user' || !lastMessage.text.trim()) {
      // This case should ideally not be retried as it's not an API failure.
      throw new Error("I didn't hear that. Could you please say it again?");
  }
  try {
    const contents: Content[] = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    const emotionInstruction = `
PERSONALITY TUNING:
When formulating your 'reply', first analyze the emotional tone of the user's most recent message. Adapt your 'emotion' value and the tone of your 'reply' to be appropriate to the user's detected emotion. For example, if the user sounds frustrated, adopt an 'empathetic' and helpful tone. If they are excited, share their excitement with a 'happy' or 'excited' tone. While doing this, still generally adhere to your core personality traits defined below on a scale of 0 to 100.
- Happiness: ${emotionTuning.happiness}. (0 is melancholic, 100 is extremely joyful).
- Empathy: ${emotionTuning.empathy}. (0 is clinical and detached, 100 is deeply compassionate).
- Formality: ${emotionTuning.formality}. (0 is very casual and uses slang, 100 is extremely formal and professional).
- Excitement: ${emotionTuning.excitement}. (0 is calm and monotonous, 100 is highly energetic and expressive).
- Sadness: ${emotionTuning.sadness}. (0 is optimistic, 100 is sorrowful and somber).
- Curiosity: ${emotionTuning.curiosity}. (0 is passive, 100 is inquisitive and might ask clarifying questions).
Your 'emotion' value in the JSON output must reflect this adaptive process.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            tools: [{googleSearch: {}}],
            systemInstruction: `${systemInstruction}\n${emotionInstruction}`,
            temperature: temperature,
        }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("I'm sorry, but I can't provide a response to that due to my safety guidelines.");
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: Source[] = groundingChunks
        ?.map(chunk => chunk.web)
        .filter((web): web is { uri: string; title: string } => !!(web?.uri && web.title))
        .map(web => ({ uri: web.uri, title: web.title })) || [];

    try {
        const jsonText = response.text.trim();
        const cleanJsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleanJsonText);

        if (typeof parsed.command !== 'string' || typeof parsed.reply !== 'string' || typeof parsed.youtubeQuery !== 'string' || typeof parsed.location !== 'string' || typeof parsed.emotion !== 'string' || typeof parsed.newsQuery !== 'string' || typeof parsed.imagePrompt !== 'string') {
            throw new Error('Invalid JSON structure from Gemini');
        }

        const validatedEmotion = VALID_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral';

        return {
            command: parsed.command,
            reply: parsed.reply,
            youtubeQuery: parsed.youtubeQuery,
            newsQuery: parsed.newsQuery || '',
            location: parsed.location,
            imagePrompt: parsed.imagePrompt || '',
            emotion: validatedEmotion,
            sources,
            songTitle: parsed.songTitle || '',
            songArtist: parsed.songArtist || '',
            timerDurationSeconds: parsed.timerDurationSeconds || 0,
        };
    } catch (jsonError) {
        console.warn("Failed to parse Gemini response as JSON. Falling back to plain text reply.", {
            error: jsonError,
            originalText: response.text
        });
        // If JSON parsing fails, the model likely returned a plain text response.
        // We can salvage this by wrapping it in a default REPLY command, making the assistant more robust.
        return {
            command: 'REPLY',
            reply: response.text.trim(),
            youtubeQuery: '',
            newsQuery: '',
            location: '',
            imagePrompt: '',
            emotion: 'neutral',
            sources,
        };
    }
  } catch (apiError: any) {
    console.error("Error calling the Gemini API:", apiError);
    const errorMessage = (apiError.message || apiError.toString() || '').toLowerCase();

    if (errorMessage.includes('api key not valid')) {
        throw new MainApiKeyError("I can't connect because the main Gemini API key is invalid. Please ask the administrator to check it.");
    }
    if (errorMessage.includes('rate limit')) {
        throw new Error("I'm receiving a lot of requests right now. Please wait a moment before trying again.");
    }
    if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        throw new Error("I'm sorry, but I can't respond to that request due to my safety guidelines.");
    }
    if (apiError instanceof TypeError && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
         throw new Error("I'm having trouble connecting to my core services. Please check your internet connection and try again.");
    }
    // Generic error for other cases (500 errors, etc.)
    throw new Error("I'm having a little trouble thinking right now. The Gemini service might be temporarily unavailable. Please try again shortly.");
  }
}

export async function processCodeCommand(
    code: string,
    language: string,
    instruction: string
): Promise<{ newCode: string; explanation: string; }> {
    const systemInstruction = `You are an expert coding assistant. Your task is to modify the provided code based on the user's instruction.
Return ONLY a valid JSON object with the following structure:
{
  "newCode": "The full, updated code as a single string. Do not use markdown.",
  "explanation": "A brief, conversational explanation of the changes you made. This will be spoken to the user."
}

If the user's instruction is to debug, find and fix any errors in the code. If the user asks to write new code, the "current code" might be empty.
Do not add any comments to the code unless specifically asked to.
The user's instruction is: "${instruction}".
The programming language is: "${language}".`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Use a more powerful model for coding
            contents: [{ role: 'user', parts: [{ text: `Current code:\n\`\`\`${language}\n${code}\n\`\`\`` }] }],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        newCode: { type: Type.STRING, description: 'The full, updated code.' },
                        explanation: { type: Type.STRING, description: 'An explanation of the changes.' },
                    },
                    required: ['newCode', 'explanation'],
                },
                temperature: 0.1, // Be precise for coding
            },
        });
        
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);

        if (typeof parsed.newCode !== 'string' || typeof parsed.explanation !== 'string') {
            throw new Error('Invalid JSON structure from Gemini for code command');
        }

        return {
            newCode: parsed.newCode,
            explanation: parsed.explanation,
        };

    } catch (apiError: any) {
        console.error("Error processing code command with Gemini:", apiError);
        const errorMessage = (apiError.message || apiError.toString() || '').toLowerCase();
        if (errorMessage.includes('api key not valid')) {
            throw new MainApiKeyError("I can't process this code because the main Gemini API key is invalid.");
        }
        throw new Error("I had trouble processing that code instruction. Please try again.");
    }
}

export async function fetchWeatherSummary(location: string, apiKey: string): Promise<WeatherData> {
    if (!apiKey) {
      throw new ApiKeyError("To enable weather forecasts, please go to Settings > API Keys and enter your Visual Crossing API key.");
    }

    const encodedLocation = encodeURIComponent(location);
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodedLocation}?unitGroup=metric&key=${apiKey}&contentType=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401 || errorText.toLowerCase().includes('invalid api key')) {
                throw new ApiKeyError("The Visual Crossing API key is invalid. Please check it in Settings > API Keys.");
            }
            throw new Error(`Weather service returned status ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        
        if (!data.currentConditions) {
            throw new Error("Invalid weather data structure received.");
        }

        return {
            summary: data.description || 'No summary available.',
            location: data.resolvedAddress || location,
            temp: Math.round(data.currentConditions.temp),
            conditions: data.currentConditions.conditions,
            icon: data.currentConditions.icon,
        };
    } catch (error: any) {
        if (error instanceof ApiKeyError) {
            throw error;
        }
        console.error("Error fetching weather data:", error);
        throw new Error("I'm having trouble fetching the weather forecast right now. Please try again later.");
    }
}

// FIX: Added missing functions that were used in App.tsx but not defined.
export async function validateWeatherKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) {
        return { success: true, message: "No key provided. Weather will be disabled." };
    }
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/London?unitGroup=metric&key=${apiKey}&contentType=json`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            return { success: true, message: "Weather key is valid." };
        }
        return { success: false, message: "Invalid API key." };
    } catch (e) {
        return { success: false, message: "Network error during validation." };
    }
}

export async function validateNewsKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) {
        return { success: true, message: "No key provided. News will be disabled." };
    }
    const url = `https://gnews.io/api/v4/search?q=example&lang=en&max=1&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            return { success: true, message: "News key is valid." };
        }
        const data = await response.json();
        return { success: false, message: data.errors?.[0] || "Invalid API key." };
    } catch (e) {
        return { success: false, message: "Network error during validation." };
    }
}

export async function validateYouTubeKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) {
        return { success: true, message: "No key provided. YouTube search will be disabled." };
    }
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=music&maxResults=1&key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            return { success: true, message: "YouTube key is valid." };
        }
        const data = await response.json();
        return { success: false, message: data.error?.message || "Invalid API key." };
    } catch (e) {
        return { success: false, message: "Network error during validation." };
    }
}

export async function fetchNews(apiKey: string, query: string): Promise<string> {
    if (!apiKey) {
        throw new ApiKeyError("To get news updates, please go to Settings > API Keys and enter your GNews API key.");
    }
    const encodedQuery = encodeURIComponent(query);
    const url = `https://gnews.io/api/v4/search?q=${encodedQuery}&lang=en&max=5&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Could not fetch news from the service.");
        }
        const data = await response.json();
        if (!data.articles || data.articles.length === 0) {
            return `I couldn't find any recent news articles about "${query}".`;
        }
        const summary = data.articles.map((article: any, index: number) => 
            `${index + 1}. ${article.title}`
        ).join('\n');
        return `Here are the top headlines about "${query}":\n${summary}`;
    } catch (error) {
        console.error("Error fetching news:", error);
        throw new Error("I'm having trouble fetching the news right now.");
    }
}

export async function searchYouTube(apiKey: string, query: string): Promise<string | null> {
    if (!apiKey) {
        throw new ApiKeyError("To search YouTube, please go to Settings > API Keys and enter your Google Cloud API key.");
    }
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&maxResults=1&key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Could not search YouTube at the moment.");
        }
        const data = await response.json();
        return data.items?.[0]?.id?.videoId || null;
    } catch (error) {
        console.error("Error searching YouTube:", error);
        throw new Error("I'm having trouble with YouTube search right now.");
    }
}

export async function generateSpeech(text: string, voiceName: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("I'm having trouble with my voice right now. The text-to-speech service might be down.");
    }
}

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
    try {
        const prompt = `Please provide the full lyrics for the song "${title}" by ${artist}. Only return the lyrics text, with no extra commentary or formatting.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1,
            }
        });

        const responseText = response.text.trim();
        if (responseText.toLowerCase().includes("i'm sorry") || responseText.toLowerCase().includes("i cannot provide") || responseText.length < 20) {
            return null;
        }

        return responseText;
    } catch (error) {
        console.error(`Error fetching lyrics for ${title}:`, error);
        return null;
    }
}

export async function generateSong(lyrics: string, voiceName: string, tuning: { happiness: number; sadness: number; excitement: number; }): Promise<string> {
    let emotionalPrompt = "sing the following lyrics";
    if (tuning.excitement > 70) emotionalPrompt = "energetically sing the following lyrics";
    else if (tuning.happiness > 70) emotionalPrompt = "cheerfully sing the following lyrics";
    else if (tuning.sadness > 70) emotionalPrompt = "sadly sing the following lyrics";

    const fullPrompt = `${emotionalPrompt}:\n\n${lyrics}`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS API for singing.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating song:", error);
        throw new Error("I'm having trouble with my singing voice right now. The service might be unavailable.");
    }
}