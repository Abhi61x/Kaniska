import React, { createContext, useContext, useState, useCallback, FC } from 'react';

const en = {
  "appName": "Kaniska",
  "header": {
    "settings": "Settings",
    "toggleTheme": "Toggle Theme"
  },
  "main": {
    "status": {
      "offline": "Offline",
      "listening": "Listening...",
      "thinking": "Thinking...",
      "speaking": "Speaking...",
      "singing": "Singing...",
      "error": "An error occurred.",
      "idle": "Idle"
    },
    "noSpeechHint": "I didn't hear anything.",
    "lowConfidenceHint": "I'm not sure I got that. Could you repeat?"
  },
  "footer": {
    "connect": "Connect",
    "disconnect": "Disconnect",
    "record": "Record",
    "stop": "Stop"
  },
  "chat": {
    "placeholder": {
      "title": "Your conversation will appear here.",
      "info": "[INFO] Connection closed."
    },
    "sources": "Sources:",
    "goToApiSettings": "Go to API Key Settings"
  },
  "timer": {
    "title": "Timer"
  },
  "settings": {
    "title": "Settings",
    "tabs": {
      "persona": "Persona",
      "bias": "Bias",
      "voice": "Voice",
      "avatar": "Avatar",
      "apiKeys": "API Keys",
      "subscription": "Subscription",
      "help": "Help & Support"
    },
    "personaTab": {
      "appearance": {
        "title": "Appearance",
        "description": "Choose how the application looks.",
        "light": "Light",
        "dark": "Dark"
      },
      "greeting": {
        "title": "Greeting Message",
        "description": "This is what the assistant says when you first connect."
      },
      "tuning": {
        "title": "Emotional Tuning",
        "description": "Fine-tune the assistant's personality traits. Changes will be reflected in responses.",
        "happiness": "Happiness",
        "empathy": "Empathy",
        "formality": "Formality",
        "excitement": "Excitement",
        "sadness": "Sadness",
        "curiosity": "Curiosity"
      },
      "ambient": {
        "title": "Ambient Sound",
        "description": "Control the volume of the background sci-fi ambience.",
        "volume": "Volume"
      },
      "connectionSound": {
        "title": "Connection Sound",
        "description": "Play a custom sound when you connect to the assistant.",
        "upload": "Upload Sound",
        "test": "Test sound",
        "remove": "Remove"
      },
      "systemPrompt": {
        "title": "Custom System Prompt",
        "description": "Define the core personality and instructions. A restart is needed for changes to take full effect.",
        "save": "Save Prompt"
      },
       "gender": {
        "title": "Gender Persona",
        "description": "Choose the assistant's gender, which affects its name and default greeting.",
        "female": "Female",
        "male": "Male"
      },
      "dataManagement": {
        "title": "Data Management",
        "clearHistory": {
          "button": "Clear Conversation History",
          "description": "This will permanently remove all conversation transcripts from this browser's local storage."
        }
      },
      "proFeature": {
        "title": "Pro Feature",
        "description": "Full persona customization is available with Kaniska Pro.",
        "button": "Upgrade Now"
      }
    },
    "biasTab": {
      "title": "Response Bias",
      "description": "Control the AI's personality from deterministic to creative.",
      "options": {
        "precise": {
          "label": "Precise",
          "description": "For factual, deterministic answers. (Low bias)"
        },
        "balanced": {
          "label": "Balanced",
          "description": "A mix of creativity and factuality. (Default)"
        },
        "creative": {
          "label": "Creative",
          "description": "For imaginative and diverse responses. (High bias)"
        }
      }
    },
    "voiceTab": {
      "title": "Voice Configuration",
      "description": "Set different voices for each persona. These are high-quality, natural-sounding voices provided by Google's Gemini API.",
      "female": {
        "title": "Female Persona (Kaniska)"
      },
      "male": {
        "title": "Male Persona (Kanishk)"
      },
      "mainVoiceLabel": "Main Voice",
      "greetingVoiceLabel": "Greeting Voice",
      "singingTuning": {
        "title": "Singing Emotion Tuning",
        "description": "Fine-tune the emotional delivery for the assistant's singing voice."
      },
      "speed": {
        "title": "General Voice Settings",
        "description": "Adjust global voice properties like speaking speed.",
        "label": "Speaking Rate"
      },
      "test": "Test Voice",
      "save": "Save Voice Settings"
    },
    "avatarTab": {
      "title": "Custom Avatars",
      "description": "Upload a custom image for each assistant state. A default is used if none is set.",
      "change": "Change",
      "save": "Save Avatars"
    },
    "apiKeysTab": {
      "gemini": {
        "title": "Gemini API Key (Required)",
        "description": "The core key for AI functionality. Managed by the environment.",
        "envSet": "Environment Set"
      },
      "optional": {
        "title": "Optional API Keys",
        "description": "Provide API keys for additional features like weather and YouTube search. Your keys are saved locally to your browser."
      },
      "weatherKey": "Visual Crossing Weather Key",
      "newsKey": "GNews API Key",
      "youtubeKey": "Google Cloud API Key (for YouTube)",
      "save": "Save & Validate Keys"
    },
    "subscriptionTab": {
      "title": "Subscription",
      "description": "Manage your Kaniska Pro subscription.",
      "currentPlan": "Current Plan",
      "planName": "Kaniska Pro",
      "price": "₹100 / month",
      "subscribeButton": "Subscribe Now",
      "cancelButton": "Cancel Subscription",
      "statusActive": "Active",
      "featuresTitle": "Pro Features included:",
      "feature1": "Higher priority access during peak times",
      "feature2": "Access to advanced and experimental voice models",
      "feature3": "Exclusive avatar packs and visual customizations"
    },
    "helpTab": {
      "faqTitle": "Frequently Asked Questions",
      "contactTitle": "Contact Support",
      "contactDescription": "If you're facing technical issues, you can get help via Instagram DM.",
      "contactButton": "DM on Instagram",
      "q1": "How do I use Kaniska?",
      "a1": "Click the \"Connect\" button to start a session. When the avatar indicates it's listening, speak your command. You can now interrupt the assistant at any time by simply speaking again.",
      "q2": "How do I get and set up API Keys?",
      "a2": {
        "weatherTitle": "Visual Crossing Weather API Key",
        "weatherSteps": "1. Go to the <1>Visual Crossing Weather Data</1> website.\n2. Click \"Sign Up\" to create a free account.\n3. After signing in, navigate to your Account page from the top-right menu.\n4. Your API Key will be visible on this page. Copy it.",
        "youtubeTitle": "Google Cloud API Key (for YouTube)",
        "youtubeSteps": "1. Go to the <1>Google Cloud Console</1>.\n2. Create a new project (or select an existing one).\n3. In the search bar, find and enable the \"YouTube Data API v3\".\n4. Go to \"APIs & Services\" > \"Credentials\".\n5. Click \"+ CREATE CREDENTIALS\" and select \"API key\".\n6. Your new API key will be displayed. Copy it.",
        "inputTitle": "Where do I input the keys?",
        "inputSteps": "1. In this app, go to Settings ⚙️ > API Keys.\n2. Paste your copied key into the corresponding input field.\n3. Click the \"Save & Validate Keys\" button."
      }
    },
    "common": {
      "save": "Save",
      "saved": "Saved!",
      "copy": "Copy",
      "copied": "Copied!",
      "retry": "Retry"
    },
    "errors": {
      "micNotAllowed": "Microphone access is not allowed. Please enable it in your browser settings to continue.",
      "micAudioCapture": "I can't hear you. Please check if your microphone is connected and working correctly.",
      "network": "A network error occurred with the speech service. Please check your internet connection.",
      "speechRecognitionGeneric": "An unexpected error occurred with speech recognition.",
      "youtubePlayback": "I'm sorry, I couldn't play that video. It might be restricted from being played here. Please try another one."
    }
  }
};

const hi = {
  "appName": "कनिष्का",
  "header": {
    "settings": "सेटिंग्स",
    "toggleTheme": "थीम टॉगल करें"
  },
  "main": {
    "status": {
      "offline": "ऑफलाइन",
      "listening": "सुन रही हूँ...",
      "thinking": "सोच रही हूँ...",
      "speaking": "बोल रही हूँ...",
      "singing": "गा रही हूँ...",
      "error": "एक त्रुटि हुई।",
      "idle": "निष्क्रिय"
    },
    "noSpeechHint": "मैंने कुछ नहीं सुना।",
    "lowConfidenceHint": "मुझे ठीक से समझ नहीं आया। क्या आप दोहरा सकते हैं?"
  },
  "footer": {
    "connect": "कनेक्ट",
    "disconnect": "डिस्कनेक्ट",
    "record": "रिकॉर्ड",
    "stop": "रोकें"
  },
  "chat": {
    "placeholder": {
      "title": "आपकी बातचीत यहाँ दिखाई देगी।",
      "info": "[जानकारी] कनेक्शन बंद हो गया।"
    },
    "sources": "स्रोत:",
    "goToApiSettings": "एपीआई कुंजी सेटिंग्स पर जाएं"
  },
  "timer": {
    "title": "टाइमर"
  },
  "settings": {
    "title": "सेटिंग्स",
    "tabs": {
      "persona": "व्यक्तित्व",
      "bias": "झुकाव",
      "voice": "आवाज़",
      "avatar": "अवतार",
      "apiKeys": "एपीआई कुंजी",
      "subscription": "सदस्यता",
      "help": "सहायता"
    },
    "personaTab": {
       "appearance": {
        "title": "दिखावट",
        "description": "चुनें कि एप्लिकेशन कैसा दिखता है।",
        "light": "रोशनी",
        "dark": "अंधेरा"
      },
      "greeting": {
        "title": "अभिवादन संदेश",
        "description": "जब आप पहली बार कनेक्ट होते हैं तो सहायक यह कहता है।"
      },
      "tuning": {
        "title": "भावनात्मक ट्यूनिंग",
        "description": "सहायक के व्यक्तित्व लक्षणों को ठीक करें। परिवर्तन प्रतिक्रियाओं में दिखाई देंगे।",
        "happiness": "ख़ुशी",
        "empathy": "सहानुभूति",
        "formality": "औपचारिकता",
        "excitement": "उत्साह",
        "sadness": "उदासी",
        "curiosity": "जिज्ञासा"
      },
      "ambient": {
        "title": "परिवेश ध्वनि",
        "description": "पृष्ठभूमि विज्ञान-कथा माहौल की मात्रा को नियंत्रित करें।",
        "volume": "आवाज़"
      },
      "connectionSound": {
        "title": "कनेक्शन ध्वनि",
        "description": "जब आप सहायक से कनेक्ट होते हैं तो एक कस्टम ध्वनि चलाएं।",
        "upload": "ध्वनि अपलोड करें",
        "test": "परीक्षण ध्वनि",
        "remove": "हटाएं"
      },
      "systemPrompt": {
        "title": "कस्टम सिस्टम प्रॉम्प्ट",
        "description": "मूल व्यक्तित्व और निर्देशों को परिभाषित करें। परिवर्तनों को पूरी तरह से प्रभावी होने के लिए पुनरारंभ की आवश्यकता है।",
        "save": "प्रॉम्प्ट सहेजें"
      },
      "gender": {
        "title": "लिंग व्यक्तित्व",
        "description": "सहायक का लिंग चुनें, जो उसके नाम और डिफ़ॉल्ट अभिवादन को प्रभावित करता है।",
        "female": "महिला",
        "male": "पुरुष"
      },
      "dataManagement": {
          "title": "डेटा प्रबंधन",
          "clearHistory": {
              "button": "बातचीत का इतिहास साफ़ करें",
              "description": "यह इस ब्राउज़र के स्थानीय संग्रहण से सभी बातचीत के प्रतिलेखों को स्थायी रूप से हटा देगा।"
          }
      },
      "proFeature": {
        "title": "प्रो फ़ीचर",
        "description": "पूर्ण व्यक्तित्व अनुकूलन कनिष्का प्रो के साथ उपलब्ध है।",
        "button": "अभी अपग्रेड करें"
      }
    },
    "biasTab": {
      "title": "प्रतिक्रिया झुकाव",
      "description": "एआई के व्यक्तित्व को नियतात्मक से रचनात्मक तक नियंत्रित करें।",
      "options": {
        "precise": {
          "label": "सटीक",
          "description": "तथ्यात्मक, नियतात्मक उत्तरों के लिए। (कम झुकाव)"
        },
        "balanced": {
          "label": "संतुलित",
          "description": "रचनात्मकता और तथ्यात्मकता का मिश्रण। (डिफ़ॉल्ट)"
        },
        "creative": {
          "label": "रचनात्मक",
          "description": "कल्पनाशील और विविध प्रतिक्रियाओं के लिए। (उच्च झुकाव)"
        }
      }
    },
    "voiceTab": {
      "title": "आवाज़ विन्यास",
      "description": "प्रत्येक व्यक्तित्व के लिए अलग-अलग आवाजें सेट करें। ये गूगल की जेमिनी एपीआई द्वारा प्रदान की गई उच्च-गुणवत्ता, प्राकृतिक-लगने वाली आवाजें हैं।",
      "female": {
        "title": "महिला व्यक्तित्व (कनिष्का)"
      },
      "male": {
        "title": "पुरुष व्यक्तित्व (कनिष्क)"
      },
      "mainVoiceLabel": "मुख्य आवाज़",
      "greetingVoiceLabel": "अभिवादन की आवाज़",
      "singingTuning": {
        "title": "गायन भावना ट्यूनिंग",
        "description": "सहायक की गायन आवाज के लिए भावनात्मक प्रस्तुति को ठीक करें।"
      },
      "speed": {
        "title": "सामान्य आवाज़ सेटिंग्स",
        "description": "बोलने की गति जैसे वैश्विक आवाज गुणों को समायोजित करें।",
        "label": "बोलने की दर"
      },
      "test": "आवाज़ का परीक्षण करें",
      "save": "आवाज़ सेटिंग्स सहेजें"
    },
    "avatarTab": {
      "title": "कस्टम अवतार",
      "description": "प्रत्येक सहायक स्थिति के लिए एक कस्टम छवि अपलोड करें। यदि कोई सेट नहीं है तो डिफ़ॉल्ट का उपयोग किया जाता है।",
      "change": "बदलें",
      "save": "अवतार सहेजें"
    },
    "apiKeysTab": {
      "gemini": {
        "title": "जेमिनी एपीआई कुंजी (आवश्यक)",
        "description": "एआई कार्यक्षमता के लिए मुख्य कुंजी। पर्यावरण द्वारा प्रबंधित।",
        "envSet": "पर्यावरण सेट"
      },
      "optional": {
        "title": "वैकल्पिक एपीआई कुंजी",
        "description": "मौसम और यूट्यूब खोज जैसी अतिरिक्त सुविधाओं के लिए एपीआई कुंजी प्रदान करें। आपकी कुंजियाँ स्थानीय रूप से आपके ब्राउज़र में सहेजी जाती हैं।"
      },
      "weatherKey": "विज़ुअल क्रॉसिंग वेदर कुंजी",
      "newsKey": "जीन्यूज एपीआई कुंजी",
      "youtubeKey": "गूगल क्लाउड एपीआई कुंजी (यूट्यूब के लिए)",
      "save": "कुंजी सहेजें और मान्य करें"
    },
     "subscriptionTab": {
      "title": "सदस्यता",
      "description": "अपनी कनिष्का प्रो सदस्यता प्रबंधित करें।",
      "currentPlan": "वर्तमान योजना",
      "planName": "कनिष्का प्रो",
      "price": "₹100 / महीना",
      "subscribeButton": "अभी सदस्यता लें",
      "cancelButton": "सदस्यता रद्द करें",
      "statusActive": "सक्रिय",
      "featuresTitle": "प्रो सुविधाओं में शामिल हैं:",
      "feature1": "व्यस्त समय के दौरान उच्च प्राथमिकता वाली पहुंच।",
      "feature2": "उन्नत और प्रायोगिक आवाज मॉडल तक पहुंच।",
      "feature3": "विशेष अवतार पैक और दृश्य अनुकूलन।"
    },
    "helpTab": {
      "faqTitle": "अक्सर पूछे जाने वाले प्रश्न",
      "contactTitle": "समर्थन से संपर्क करें",
      "contactDescription": "यदि आप तकनीकी समस्याओं का सामना कर रहे हैं, तो आप इंस्टाग्राम डीएम के माध्यम से सहायता प्राप्त कर सकते हैं।",
      "contactButton": "इंस्टाग्राम पर डीएम करें",
      "q1": "मैं कनिष्का का उपयोग कैसे करूँ?",
      "a1": "सत्र शुरू करने के लिए \"कनेक्ट\" बटन पर क्लिक करें। जब अवतार सुनने का संकेत दे, तो अपना कमांड बोलें। अब आप किसी भी समय केवल दोबारा बोलकर सहायक को बाधित कर सकते हैं।",
      "q2": "मैं एपीआई कुंजी कैसे प्राप्त और सेट करूं?",
      "a2": {
        "weatherTitle": "विज़ुअल क्रॉसिंग मौसम एपीआई कुंजी",
        "weatherSteps": "1. <1>विज़ुअल क्रॉसिंग वेदर डेटा</1> वेबसाइट पर जाएं।\n2. एक निःशुल्क खाता बनाने के लिए \"साइन अप करें\" पर क्लिक करें।\n3. साइन इन करने के बाद, ऊपर-दाएं मेनू से अपने खाता पृष्ठ पर जाएं।\n4. आपकी एपीआई कुंजी इस पृष्ठ पर दिखाई देगी। इसे कॉपी करें।",
        "youtubeTitle": "गूगल क्लाउड एपीआई कुंजी (यूट्यूब के लिए)",
        "youtubeSteps": "1. <1>गूगल क्लाउड कंसोल</1> पर जाएं।\n2. एक नया प्रोजेक्ट बनाएं (या किसी मौजूदा का चयन करें)।\n3. सर्च बार में, \"YouTube Data API v3\" ढूंढें और सक्षम करें।\n4. \"एपीआई और सेवाएं\" > \"क्रेडेंशियल\" पर जाएं।\n5. \"+ क्रेडेंशियल बनाएं\" पर क्लिक करें और \"एपीआई कुंजी\" चुनें।\n6. आपकी नई एपीआई कुंजी प्रदर्शित होगी। इसे कॉपी करें।",
        "inputTitle": "मैं कुंजियाँ कहाँ दर्ज करूँ?",
        "inputSteps": "1. इस ऐप में, सेटिंग्स ⚙️ > एपीआई कुंजी पर जाएं।\n2. अपनी कॉपी की गई कुंजी को संबंधित इनपुट फ़ील्ड में पेस्ट करें।\n3. \"कुंजी सहेजें और मान्य करें\" बटन पर क्लिक करें।"
      }
    },
    "common": {
      "save": "सहेजें",
      "saved": "सहेजा गया!",
      "copy": "कॉपी करें",
      "copied": "कॉपी किया गया!",
      "retry": "पुनः प्रयास करें"
    },
    "errors": {
      "micNotAllowed": "माइक्रोफ़ोन एक्सेस की अनुमति नहीं है। जारी रखने के लिए कृपया इसे अपनी ब्राउज़र सेटिंग्स में सक्षम करें।",
      "micAudioCapture": "मैं आपको सुन नहीं सकती। कृपया जांचें कि आपका माइक्रोफ़ोन जुड़ा हुआ है और ठीक से काम कर रहा है।",
      "network": "स्पीच सेवा में नेटवर्क त्रुटि हुई। कृपया अपना इंटरनेट कनेक्शन जांचें।",
      "speechRecognitionGeneric": "वाक् पहचान में एक अप्रत्याशित त्रुटि हुई।",
      "youtubePlayback": "मुझे खेद है, मैं वह वीडियो नहीं चला सकी। हो सकता है कि उसे यहां चलाने पर प्रतिबंध हो। कृपया कोई दूसरा प्रयास करें।"
    }
  }
};

const es = {};
const fr = {};
const de = {};
const ja = {};
const ru = {};
const pt = {};
const zh = {};
const en_us = {};
const en_gb = {};

const translationsData = { en, hi, es, fr, de, ja, ru, pt, zh, en_us, en_gb };

type Language = keyof typeof translationsData;

interface TranslationContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: { [key: string]: string }) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const getNested = (obj: any, path: string): any => {
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
};

export const TranslationProvider: FC<{children: React.ReactNode}> = ({ children }) => {
  const [lang, setLangState] = useState<Language>((localStorage.getItem('kaniska-lang') as Language) || 'en');

  const setLang = useCallback((newLang: Language) => {
    if (Object.keys(translationsData).includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('kaniska-lang', newLang);
    }
  }, []);

  const t = useCallback((key: string, params?: { [key: string]: string }): string => {
    let translation = getNested(translationsData[lang], key);

    // Fallback to English if translation not found in current language
    if (translation === undefined) {
      translation = getNested(translationsData['en'], key);
    }
    
    // If translation is an object (e.g., a parent key was used) or still not found, return the key.
    // This prevents React from trying to render an object.
    if (typeof translation !== 'string') {
        if (typeof translation === 'object' && translation !== null) {
            console.warn(`Translation key "${key}" resolved to an object. Returning the key as fallback.`);
        }
        return key;
    }

    let result = translation;

    if (params) {
        Object.keys(params).forEach(paramKey => {
            result = result.replace(`{{${paramKey}}}`, params[paramKey]);
        });
    }
    return result;
  }, [lang]);

  return React.createElement(TranslationContext.Provider, { value: { lang, setLang, t } }, children);
};

export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const availableLanguages: { code: Language; name: string; bcp47: string; }[] = [
    { code: 'en', name: 'English (India)', bcp47: 'en-IN' },
    { code: 'en_us', name: 'English (US)', bcp47: 'en-US' },
    { code: 'en_gb', name: 'English (UK)', bcp47: 'en-GB' },
    { code: 'hi', name: 'हिंदी (Hindi)', bcp47: 'hi-IN' },
    { code: 'es', name: 'Español', bcp47: 'es-ES' },
    { code: 'fr', name: 'Français', bcp47: 'fr-FR' },
    { code: 'de', name: 'Deutsch', bcp47: 'de-DE' },
    { code: 'ja', name: '日本語', bcp47: 'ja-JP' },
    { code: 'ru', name: 'Русский', bcp47: 'ru-RU' },
    { code: 'pt', name: 'Português (BR)', bcp47: 'pt-BR' },
    { code: 'zh', name: '中文 (Mandarin)', bcp47: 'zh-CN' },
];
