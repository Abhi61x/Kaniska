import { GoogleGenAI } from '@google/genai';

// A custom error class to signal API key issues that the user can fix.
export class ApiKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

// A custom error for the main, environment-set API key which the user cannot fix.
export class MainApiKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MainApiKeyError';
  }
}


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const VALID_EMOTIONS = ['neutral', 'happy', 'sad', 'excited', 'empathetic', 'singing', 'formal', 'chirpy', 'surprised', 'curious', 'thoughtful', 'joking'];

// Centralized error handler for all Gemini API calls to provide consistent, specific feedback.
function handleGeminiError(error, context = 'processing your request') {
    console.error(`Error calling the Gemini API during ${context}:`, error);
    const errorMessage = (error.message || error.toString() || '').toLowerCase();

    if (errorMessage.includes('api key not valid')) {
        return new MainApiKeyError(`I can't complete this action because the main Gemini API key is invalid. Please ask the administrator to check it.`);
    }
    if (errorMessage.includes('rate limit')) {
        return new Error("I'm receiving a lot of requests right now. Please wait a moment before trying again.");
    }
    if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        return new Error("I'm sorry, but I can't provide a response to that due to my safety guidelines.");
    }
    if (error instanceof TypeError && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
         return new Error("I'm having trouble connecting to my core services. Please check your internet connection and try again.");
    }
    // Generic error for other cases (500 errors, etc.)
    return new Error("I'm having a little trouble thinking right now. The Gemini service might be temporarily unavailable. Please try again shortly.");
}

export async function processUserCommand(
    history, 
    systemInstruction, 
    temperature,
    emotionTuning
) {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.sender !== 'user' || !lastMessage.text.trim()) {
      // This case should ideally not be retried as it's not an API failure.
      throw new Error("I didn't hear that. Could you please say it again?");
  }
  try {
    const contents = history.map(msg => ({
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
            // FIX: When using googleSearch, responseMimeType and responseSchema are not allowed.
            // The model is instructed to return JSON via the system prompt.
            tools: [{googleSearch: {}}],
            systemInstruction: `${systemInstruction}\n${emotionInstruction}`,
            temperature: temperature,
        }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("I'm sorry, but I can't provide a response to that due to my safety guidelines.");
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks
        ?.map(chunk => chunk.web)
        .filter((web) => !!(web?.uri && web.title))
        .map(web => ({ uri: web.uri, title: web.title })) || [];

    try {
        const jsonText = response.text.trim();
        const cleanJsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleanJsonText);

        if (typeof parsed.command !== 'string' || typeof parsed.reply !== 'string' || typeof parsed.youtubeQuery !== 'string' || typeof parsed.location !== 'string' || typeof parsed.emotion !== 'string' || typeof parsed.newsQuery !== 'string' || typeof parsed.imagePrompt !== 'string' || typeof parsed.songTitle !== 'string' || typeof parsed.songArtist !== 'string' || typeof parsed.timerDurationSeconds !== 'number') {
            throw new Error('Invalid JSON structure from Gemini');
        }

        const validatedEmotion = VALID_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral';

        return {
            command: parsed.command,
            reply: parsed.reply,
            youtubeQuery: parsed.youtubeQuery || '',
            newsQuery: parsed.newsQuery || '',
            location: parsed.location || '',
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
            songTitle: '',
            songArtist: '',
            timerDurationSeconds: 0,
        };
    }
  } catch (apiError) {
    throw handleGeminiError(apiError, 'processing your command');
  }
}

export async function processCodeCommand(
    code,
    language,
    instruction
) {
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
                // FIX: Removed responseMimeType and responseSchema to rely on the system prompt for JSON output, which is a more robust method.
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

    } catch (apiError) {
        throw handleGeminiError(apiError, 'processing the code');
    }
}

export async function fetchWeatherSummary(location, apiKey) {
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
            throw new Error("I'm having trouble fetching the weather forecast right now. The service might be temporarily unavailable.");
        }
        const data = await response.json();
        
        if (!data.currentConditions) {
            throw new Error("The weather service returned an unexpected response. Please try again later.");
        }

        return {
            summary: data.description || 'No summary available.',
            location: data.resolvedAddress || location,
            temp: Math.round(data.currentConditions.temp),
            conditions: data.currentConditions.conditions,
            icon: data.currentConditions.icon,
        };
    } catch (error) {
        if (error instanceof ApiKeyError) {
            throw error;
        }
        console.error("Error fetching weather data:", error);
        throw new Error("I'm having trouble fetching the weather forecast right now. Please try again later.");
    }
}

export async function validateWeatherKey(apiKey) {
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

export async function validateNewsKey(apiKey) {
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

export async function validateYouTubeKey(apiKey) {
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

export async function validateAuddioKey(apiKey) {
    if (!apiKey) {
        return { success: true, message: "No key provided. Song recognition will be disabled." };
    }
    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('url', 'https://audd.tech/example.mp3');

    try {
        const response = await fetch('https://api.audd.io/', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (data.status === 'success') {
            return { success: true, message: "Audd.io key is valid." };
        }
        return { success: false, message: data.error?.error_message || "Invalid API key." };
    } catch (e) {
        return { success: false, message: "Network error during validation." };
    }
}

export async function fetchNews(apiKey, query) {
    if (!apiKey) {
        throw new ApiKeyError("To get news updates, please go to Settings > API Keys and enter your GNews API key.");
    }
    const encodedQuery = encodeURIComponent(query);
    const url = `https://gnews.io/api/v4/search?q=${encodedQuery}&lang=en&max=5&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
             if (response.status === 401) {
                 throw new ApiKeyError("The GNews API key is invalid. Please check it in Settings > API Keys.");
            }
            throw new Error("The news service seems to be unavailable right now. Please try again later.");
        }
        const data = await response.json();
        if (!data.articles || data.articles.length === 0) {
            return `I couldn't find any recent news articles about "${query}".`;
        }
        const summary = data.articles.map((article, index) => 
            `${index + 1}. ${article.title}`
        ).join('\n');
        return `Here are the top headlines about "${query}":\n${summary}`;
    } catch (error) {
        if (error instanceof ApiKeyError) {
            throw error;
        }
        console.error("Error fetching news:", error);
        if (error instanceof TypeError) { // Likely a network error
            throw new Error("I'm having trouble fetching the news right now. Please check your internet connection.");
        }
        throw new Error("I'm having trouble fetching the news right now. The service may be unavailable.");
    }
}

export async function searchYouTube(apiKey, query) {
    if (!apiKey) {
        throw new ApiKeyError("To search YouTube, please go to Settings > API Keys and enter your Google Cloud API key.");
    }
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&maxResults=1&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
            if (data.error?.errors?.[0]?.reason === 'keyInvalid') {
                 throw new ApiKeyError("The YouTube API key is invalid. Please check it in Settings > API Keys.");
            }
            throw new Error(data.error?.message || "I couldn't search YouTube right now. The service may be temporarily unavailable.");
        }
        return data.items?.[0]?.id?.videoId || null;
    } catch (error) {
         if (error instanceof ApiKeyError) {
            throw error;
        }
        console.error("Error searching YouTube:", error);
        if (error instanceof TypeError) { // Likely a network error
            throw new Error("I'm having trouble with YouTube search. Please check your internet connection.");
        }
        throw new Error("I'm having trouble with YouTube search right now. The service may be unavailable.");
    }
}

export async function generateSpeech(text, voiceName) {
    try {
        // Return the stream iterator directly for low-latency playback
        return await ai.models.generateContentStream({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
    } catch (error) {
        throw handleGeminiError(error, 'speech generation');
    }
}

export async function fetchLyrics(artist, title) {
    try {
        const prompt = `Please provide the full lyrics for the song "${title}" by ${artist}. Only return the lyrics text, with no extra commentary or formatting.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            // FIX: The `contents` property must be used to pass the prompt string.
            contents: prompt,
            config: {
                temperature: 0.1,
            }
        });

        const responseText = response.text.trim();
        if (responseText.toLowerCase().includes("i'm sorry") || responseText.toLowerCase().includes("i cannot provide") || responseText.length < 20) {
            // Treat this as a valid response where lyrics couldn't be found, not an error.
            return null;
        }

        return responseText;
    } catch (error) {
        // This catches API-level errors (network, auth, etc.)
        throw handleGeminiError(error, 'fetching lyrics');
    }
}

export async function generateSong(lyrics, voiceName, tuning) {
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
                responseModalities: ['AUDIO'],
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
        throw handleGeminiError(error, 'singing');
    }
}

export async function recognizeSong(apiKey, audioBlob) {
    if (!apiKey) {
        throw new ApiKeyError("To use song recognition, please go to Settings > API Keys and enter your Audd.io API key.");
    }

    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('file', audioBlob);
    formData.append('return', 'apple_music,spotify');

    try {
        const response = await fetch('https://api.audd.io/', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (data.status === 'error') {
            if (data.error?.error_code === 300) { // Invalid API Token
                 throw new ApiKeyError("The Audd.io API key is invalid. Please check it in Settings > API Keys.");
            }
            throw new Error(data.error?.error_message || 'The song recognition service returned an error. Please try again.');
        }

        if (data.status === 'success' && data.result) {
            return {
                artist: data.result.artist,
                title: data.result.title,
                album: data.result.album,
            };
        } else {
            // This means success status but no result found.
            return null;
        }
    } catch (error) {
        if (error instanceof ApiKeyError) {
            throw error;
        }
        console.error("Error recognizing song:", error);
        if (error instanceof TypeError) { // Likely a network error
            throw new Error("I'm having trouble with song recognition. Please check your internet connection.");
        }
        throw new Error("I'm having trouble with the song recognition service right now. The service may be unavailable.");
    }
}
