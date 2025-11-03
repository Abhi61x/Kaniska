
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

        if (typeof parsed.command !== 'string' || typeof parsed.reply !== 'string' || typeof parsed.youtubeQuery !== 'string' || typeof parsed.location !== 'string' || typeof parsed.emotion !== 'string' || typeof parsed.newsQuery !== 'string') {
            throw new Error('Invalid JSON structure from Gemini');
        }

        const validatedEmotion = VALID_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral';

        return {
            command: parsed.command,
            reply: parsed.reply,
            youtubeQuery: parsed.youtubeQuery,
            newsQuery: parsed.newsQuery || '',
            location: parsed.location,
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

export async function fetchWeatherSummary(location: string, apiKey: string): Promise<WeatherData> {
    if (!apiKey) {
      throw new ApiKeyError("To enable weather forecasts, please go to Settings > API Keys and enter your Visual Crossing API key.");
    }

    const encodedLocation = encodeURIComponent(location);
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodedLocation}?unitGroup=metric&key=${apiKey}&contentType=json`;

    try {
      const weatherResponse = await fetch(url);
      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        // Log detailed error for debugging
        console.error("Visual Crossing API Error:", { 
            status: weatherResponse.status, 
            responseText: errorText,
            location: location 
        });
        if (weatherResponse.status === 401 || errorText.toLowerCase().includes("api key")) {
            throw new ApiKeyError("The weather API key seems to be invalid. Please check it in Settings > API Keys.");
        }
        if (errorText.includes('Bad data') || errorText.includes('find location')) {
             throw new Error(`I couldn't find any weather data for "${location}". Please try another location.`);
        }
        // More user-friendly generic error
        throw new Error("I'm sorry, the weather service seems to be unavailable right now. Please try again in a little while.");
      }
      
      const weatherData = await weatherResponse.json();

      const current = weatherData.currentConditions;
      const today = weatherData.days[0];

      const simplifiedData = {
        resolvedAddress: weatherData.resolvedAddress,
        current: {
          temp: current.temp,
          feelslike: current.feelslike,
          conditions: current.conditions,
          windspeed: current.windspeed,
          humidity: current.humidity,
        },
        today: {
          description: today.description,
          tempmax: today.tempmax,
          tempmin: today.tempmin,
          precipprob: today.precipprob,
        }
      };

      const summaryPrompt = `You are a friendly, conversational weather reporter. Summarize the following JSON weather data for a user.
      - Keep it concise and natural, like a real person talking (2-3 sentences max).
      - Start by confirming the location from 'resolvedAddress'.
      - Mention the current temperature ('temp') and what it feels like ('feelslike').
      - Briefly describe the current conditions.
      - Give a simple forecast for the day, mentioning the high ('tempmax'), low ('tempmin'), and chance of rain ('precipprob').

      Weather Data:
      ${JSON.stringify(simplifiedData, null, 2)}`;
      
      const summaryResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: summaryPrompt,
          config: { temperature: 0.6 }
      });
      
      return {
          summary: summaryResponse.text.trim(),
          location: weatherData.resolvedAddress,
          temp: Math.round(current.temp),
          conditions: current.conditions,
          icon: current.icon
      };

    } catch (error) {
      // Log the original, detailed error for debugging.
      console.error("Error fetching or processing weather data:", error);
      
      // If it's one of our specific, user-friendly errors, pass it along.
      if (error instanceof ApiKeyError || (error instanceof Error && (error.message.startsWith("I couldn't") || error.message.startsWith("I'm sorry")))) {
        throw error;
      }

      // For everything else (network errors, etc.), throw a generic user-friendly error.
      throw new Error("I had trouble fetching the weather. Please check your internet connection and try again.");
    }
}

export async function fetchNews(apiKey: string, query: string): Promise<string> {
    if (!apiKey) {
        throw new ApiKeyError("I'm sorry, the news service isn't configured. Please add a GNews API key in Settings > API Keys to fetch news.");
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://gnews.io/api/v4/search?q=${encodedQuery}&lang=en&max=5&token=${apiKey}`;

    try {
        const newsResponse = await fetch(url);
        if (!newsResponse.ok) {
            const errorData = await newsResponse.json();
            // Log detailed error for debugging
            console.error("GNews API Error:", { 
                status: newsResponse.status, 
                responseData: errorData,
                query: query
            });
            if (newsResponse.status === 401 || newsResponse.status === 403) {
                throw new ApiKeyError("The GNews API key appears to be invalid. Please go to Settings > API Keys to update it.");
            }
            throw new Error("I couldn't fetch the news right now. The news service might be temporarily unavailable.");
        }
        const newsData = await newsResponse.json();
        if (!newsData.articles || newsData.articles.length === 0) {
            return `I couldn't find any recent news articles about "${query}".`;
        }

        const summaryPrompt = `You are a news anchor. Summarize the following news articles into a concise, 2-3 sentence brief. Mention the most important headlines.

        Articles JSON:
        ${JSON.stringify(newsData.articles, null, 2)}`;

        const summaryResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: summaryPrompt,
            config: { temperature: 0.5 }
        });
        
        return summaryResponse.text.trim();

    } catch (error) {
        // Log the original, detailed error for debugging.
        console.error("Error fetching or processing news:", error);

        // If it's one of our specific, user-friendly errors, pass it along.
        if (error instanceof ApiKeyError || (error instanceof Error && error.message.startsWith("I couldn't"))) {
          throw error;
        }
        
        // For everything else (network errors, etc.), throw a generic user-friendly error.
        throw new Error("I had trouble fetching the news. Please check your internet connection and try again.");
    }
}


export async function searchYouTube(apiKey: string, query: string): Promise<string | null> {
    if (!apiKey) {
        throw new ApiKeyError("I'm sorry, YouTube search isn't configured. You'll need to add a Google Cloud API key in Settings > API Keys.");
    }
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&maxResults=1&key=${apiKey}`;

    try {
        const ytResponse = await fetch(url);
        if (!ytResponse.ok) {
            const errorData = await ytResponse.json();
            // Log detailed error for debugging
            console.error("YouTube API Error:", { 
                responseData: errorData,
                query: query
            });
            const errorMessage = errorData?.error?.message || '';
            if (ytResponse.status === 400 && errorMessage.toLowerCase().includes('api key not valid')) {
                throw new ApiKeyError("The Google Cloud API key for YouTube is invalid. Please correct it in Settings > API Keys.");
            }
            throw new Error("I couldn't search YouTube at the moment. The service may be temporarily unavailable.");
        }
        const ytData = await ytResponse.json();
        return ytData.items?.[0]?.id?.videoId || null;
    } catch (error) {
        // Log the original, detailed error for debugging.
        console.error("Error searching YouTube:", error);

        // If it's one of our specific, user-friendly errors, pass it along.
        if (error instanceof ApiKeyError || (error instanceof Error && (error.message.startsWith("I couldn't") || error.message.startsWith("I'm sorry")))) {
          throw error;
        }

        // For everything else (network errors, etc.), throw a generic user-friendly error.
        throw new Error("I had trouble searching YouTube. Please check your internet connection and try again.");
    }
}

export async function generateSpeech(text: string, voiceName: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
                    },
                },
            },
        });
        
        if (response.candidates?.[0]?.finishReason === 'SAFETY') {
            console.warn('Speech generation blocked for safety reasons.', { text });
            throw new Error("I'm unable to say that due to safety guidelines.");
        }

        let base64Audio: string | undefined;
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64Audio = part.inlineData.data;
                    break;
                }
            }
        }

        if (!base64Audio) {
            console.warn('API response for TTS did not contain audio data.', { response });
            throw new Error("API did not return audio data.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech with Gemini API:", error);
        if (error instanceof Error && (error.message.includes("safety") || error.message.includes("API did not return"))) {
            throw error; // Re-throw our specific errors
        }
        throw new Error("I'm having trouble with my voice right now. The speech generation service may be down. Please try again in a moment.");
    }
}

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
    const artistEnc = encodeURIComponent(artist.trim());
    const titleEnc = encodeURIComponent(title.trim());
    const url = `https://api.lyrics.ovh/v1/${artistEnc}/${titleEnc}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                 // Not an error, just no lyrics found.
                 return null;
            }
            // Other server errors.
            throw new Error(`Lyrics service returned status: ${response.status}`);
        }
        const data = await response.json();
        
        // The API can return an empty 'lyrics' field, which we treat as not found.
        if (!data.lyrics || data.lyrics.trim() === '') {
            return null;
        }

        // Clean up lyrics: remove RCR line and extra newlines
        return data.lyrics
            ? data.lyrics.replace(/Paroles de la chanson.*\r\n/, '').trim() 
            : null;
    } catch (error) {
        console.error("Error fetching lyrics:", error);
        
        // Re-throw with a more user-friendly message for network/service errors.
        throw new Error("I'm having trouble connecting to the lyrics service. Please check your connection and try again.");
    }
}

export async function generateSong(
    lyrics: string, 
    voiceName: string,
    singingTuning: { happiness: number; sadness: number; excitement: number; }
): Promise<string> {
    try {
        const { happiness, sadness, excitement } = singingTuning;
        let emotionalDescriptor = "a balanced and neutral emotional tone";

        // Prioritize strong emotions
        if (sadness > 70 && sadness >= happiness && sadness >= excitement) {
            emotionalDescriptor = "a deeply sad and melancholic tone";
        } else if (excitement > 70 && excitement >= happiness) {
            emotionalDescriptor = "an energetic and excited tone";
        } else if (happiness > 70) {
            emotionalDescriptor = "a joyful and very happy tone";
        } else if (sadness > 50) {
            emotionalDescriptor = "a somber and emotional tone";
        } else if (excitement > 50) {
            emotionalDescriptor = "an enthusiastic and upbeat tone";
        } else if (happiness > 50) {
            emotionalDescriptor = "a cheerful tone";
        }

        const instructionalText = `Your task is to sing the following lyrics. You MUST sing them with melody, rhythm, and genuine emotion. DO NOT speak, recite, or read them flatly.

For this performance, adopt ${emotionalDescriptor}. Your singing should have variations in pitch and dynamics to convey this feeling. This is a song, not a speech.

- Do not add any spoken intro or outro.
- Sing only the provided lyrics.

Lyrics to sing:
${lyrics}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: instructionalText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
                    },
                },
            },
        });

        if (response.candidates?.[0]?.finishReason === 'SAFETY') {
            console.warn('Song generation blocked for safety reasons.', { lyrics });
            throw new Error("I'm unable to sing that due to safety guidelines.");
        }

        let base64Audio: string | undefined;
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64Audio = part.inlineData.data;
                    break;
                }
            }
        }

        if (!base64Audio) {
            throw new Error("API did not return audio data for the song.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating song with Gemini API:", error);
        if (error instanceof Error && error.message.includes("safety")) {
            throw error;
        }
        throw new Error("I'm having trouble singing right now. My vocal synthesizer might be down.");
    }
}

// --- API Key Validation Functions ---

export async function validateWeatherKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) return { success: false, message: 'API key is missing.' };
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/new%20york?unitGroup=metric&key=${apiKey}&contentType=json&include=current`;
    try {
        const response = await fetch(url);
        if (response.ok) return { success: true, message: 'Valid key.' };
        if (response.status === 401) return { success: false, message: 'Invalid API Key.' };
        return { success: false, message: `API returned status ${response.status}.` };
    } catch (error) {
        return { success: false, message: 'Network error during validation.' };
    }
}

export async function validateNewsKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) return { success: false, message: 'API key is missing.' };
    const url = `https://gnews.io/api/v4/search?q=test&lang=en&max=1&token=${apiKey}`;
    try {
        const response = await fetch(url);
        if (response.ok) return { success: true, message: 'Valid key.' };
        if (response.status === 401 || response.status === 403) return { success: false, message: 'Invalid API Key.' };
        return { success: false, message: `API returned status ${response.status}.` };
    } catch (error) {
        return { success: false, message: 'Network error during validation.' };
    }
}

export async function validateYouTubeKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) return { success: false, message: 'API key is missing.' };
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) return { success: true, message: 'Valid key.' };
        const errorMessage = data?.error?.message || `API returned status ${response.status}.`;
        if (response.status === 400 && errorMessage.toLowerCase().includes('api key not valid')) {
             return { success: false, message: 'Invalid API Key.' };
        }
        return { success: false, message: 'Validation failed.' };
    } catch (error) {
        return { success: false, message: 'Network error during validation.' };
    }
}
