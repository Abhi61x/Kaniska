import { GoogleGenAI, Type, Content, Modality } from '@google/genai';
import type { GeminiResponse, Emotion, Source, ChatMessage } from '../types.ts';

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
Adhere to the following personality traits on a scale of 0 to 100.
- Happiness: ${emotionTuning.happiness}. (0 is melancholic, 100 is extremely joyful).
- Empathy: ${emotionTuning.empathy}. (0 is clinical and detached, 100 is deeply compassionate).
- Formality: ${emotionTuning.formality}. (0 is very casual and uses slang, 100 is extremely formal and professional).
- Excitement: ${emotionTuning.excitement}. (0 is calm and monotonous, 100 is highly energetic and expressive).
- Sadness: ${emotionTuning.sadness}. (0 is optimistic, 100 is sorrowful and somber).
- Curiosity: ${emotionTuning.curiosity}. (0 is passive, 100 is inquisitive and might ask clarifying questions).
Your 'emotion' value in the JSON output should reflect these settings.
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
        };
    } catch (jsonError) {
        console.warn("Failed to parse Gemini response as JSON, indicating a misunderstanding.", {
            error: jsonError,
            originalText: response.text
        });
        // This is a model misunderstanding, not a service failure, so a simple reply is better than a retry.
        throw new Error("I'm sorry, I didn't quite understand that. Could you try rephrasing?");
    }
  } catch (apiError: any) {
    console.error("Error calling the Gemini API:", apiError);
    const errorMessage = (apiError.message || apiError.toString() || '').toLowerCase();

    if (errorMessage.includes('api key not valid')) {
        throw new Error("I can't connect because the main Gemini API key is invalid. Please ask the administrator to check it.");
    }
    if (errorMessage.includes('rate limit')) {
        throw new Error("I'm receiving a lot of requests right now. Please wait a moment before trying again.");
    }
    if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        throw new Error("I'm sorry, but I can't respond to that request due to my safety guidelines.");
    }
    if (apiError instanceof TypeError && errorMessage.includes('fetch')) {
         throw new Error("I'm having trouble connecting to my core services. Please check your internet connection and try again.");
    }
    // Generic error for other cases (500 errors, etc.)
    throw new Error("I'm having a little trouble thinking right now. My core service might be temporarily unavailable. Please try again shortly.");
  }
}

export async function fetchWeatherSummary(location: string, apiKey: string): Promise<string> {
    if (!apiKey) {
      throw new Error("I'm sorry, the weather service isn't configured. The administrator needs to provide a Visual Crossing API key in the settings.");
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
            throw new Error("I can't fetch weather information because the API key is invalid or missing. Please check your settings.");
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
      
      return summaryResponse.text.trim();

    } catch (error) {
      // Log the original, detailed error for debugging.
      console.error("Error fetching or processing weather data:", error);
      
      // If it's one of our specific, user-friendly errors, pass it along.
      if (error instanceof Error && (error.message.startsWith("I can't") || error.message.startsWith("I couldn't") || error.message.startsWith("I'm sorry"))) {
        throw error;
      }

      // For everything else (network errors, etc.), throw a generic user-friendly error.
      throw new Error("I had trouble fetching the weather. Please check your internet connection and try again.");
    }
}

export async function fetchNews(apiKey: string, query: string): Promise<string> {
    if (!apiKey) {
        throw new Error("I'm sorry, the news service isn't configured. An administrator needs to provide a GNews API key in the settings to fetch news.");
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
                throw new Error("I can't fetch news because the GNews API key is invalid or missing. Please check your settings.");
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
        if (error instanceof Error && (error.message.startsWith("I can't") || error.message.startsWith("I couldn't"))) {
          throw error;
        }
        
        // For everything else (network errors, etc.), throw a generic user-friendly error.
        throw new Error("I had trouble fetching the news. Please check your internet connection and try again.");
    }
}


export async function searchYouTube(apiKey: string, query: string): Promise<string | null> {
    if (!apiKey) {
        throw new Error("I'm sorry, the YouTube search isn't configured. An administrator needs to provide a Google Cloud API key in the settings to search videos.");
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
                throw new Error("I can't search YouTube because the Google Cloud API key is invalid. Please check your settings.");
            }
            throw new Error("I couldn't search YouTube at the moment. The service may be temporarily unavailable.");
        }
        const ytData = await ytResponse.json();
        return ytData.items?.[0]?.id?.videoId || null;
    } catch (error) {
        // Log the original, detailed error for debugging.
        console.error("Error searching YouTube:", error);

        // If it's one of our specific, user-friendly errors, pass it along.
        if (error instanceof Error && (error.message.startsWith("I can't") || error.message.startsWith("I couldn't") || error.message.startsWith("I'm sorry"))) {
          throw error;
        }

        // For everything else (network errors, etc.), throw a generic user-friendly error.
        throw new Error("I had trouble searching YouTube. Please check your internet connection and try again.");
    }
}

export async function generateSpeech(text: string, voiceName: string): Promise<string> {
    try {
        const instructionalText = `Speak at a slightly faster pace, but clearly: ${text}`;
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
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("API did not return audio data.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech with Gemini API:", error);
        throw new Error("I'm having trouble with my voice right now. The speech generation service may be down. Please try again in a moment.");
    }
}