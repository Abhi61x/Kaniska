




import React, { createContext, useContext, useState, useCallback, FC } from 'react';

const en = {
  "appName": "Kaniska",
  "auth": {
    "loginMessage": "Please log in to continue",
    "signupMessage": "Create an account to begin",
    "login": "Login",
    "signup": "Sign Up",
    "identifierLabel": "Username, Email, or Phone",
    "identifierPlaceholder": "Enter your identifier",
    "passwordLabel": "Password",
    "passwordPlaceholder": "Enter your password",
    "signupNameLabel": "Name / Username",
    "signupNamePlaceholder": "Choose a username",
    "signupEmailLabel": "Email",
    "signupEmailPlaceholder": "your@email.com",
    "signupPhoneLabel": "Phone Number",
    "signupPhonePlaceholder": "10-digit phone number",
    "signupPasswordPlaceholder": "Create a strong password",
    "toggleToSignup": "Don't have an account? Sign Up",
    "toggleToLogin": "Already have an account? Login",
    "error": {
      "fillFields": "Please fill in all fields.",
      "userNotFound": "No account found with that username, email, or phone number.",
      "invalidPassword": "The password you entered is incorrect. Please try again.",
      "emailExists": "An account with this email already exists.",
      "usernameExists": "This username is already taken.",
      "unexpected": "An unexpected error occurred."
    }
  },
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
      "error": "An error occurred.",
      "idle": "Idle",
      "disconnectedInactivity": "Disconnected due to inactivity.",
      "listeningForWakeWord": "Listening for '{{wakeWord}}'",
      "awake": "Awake. Listening for command...",
      "sleep": "Sleeping. Click the mic to wake me up.",
      "goingToSleep": "Going to sleep due to inactivity. Click the microphone to wake me up."
    },
    "noSpeechHint": "I didn't hear anything."
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
    "sources": "Sources:"
  },
  "settings": {
    "title": "Settings",
    "tabs": {
      "persona": "Persona",
      "bias": "Bias",
      "voice": "Voice",
      "avatar": "Avatar",
      "apiKeys": "API Keys",
      "account": "Account & Data",
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
      "continuousListening": {
        "title": "Continuous Listening",
        "description": "Allow the assistant to listen continuously without needing to press the record button each time.",
        "enable": "Enable Continuous Listening"
      },
       "wakeWord": {
        "title": "Wake Word",
        "description": "Set a custom phrase to activate the assistant in continuous listening mode.",
        "default": "Default",
        "custom": "Custom",
        "placeholder": "Enter custom wake word"
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
        "description": "Provide API keys for additional features like weather and YouTube search. Your keys are saved locally to your account."
      },
      "weatherKey": "Visual Crossing Weather Key",
      "newsKey": "GNews API Key",
      "youtubeKey": "Google Cloud API Key (for YouTube)",
      "save": "Save All Keys"
    },
    "accountTab": {
      "session": {
        "title": "Session Information",
        "description": "This is your unique identifier for this browser session."
      },
      "data": {
        "title": "Data Management",
        "description": "Manage your conversation history and other stored data."
      },
      "clearHistory": {
        "button": "Clear Conversation History",
        "description": "This will permanently remove all conversation transcripts from your account."
      },
      "logout": {
        "button": "Log Out",
        "description": "This will end your current session. Your data will be saved to your account."
      }
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
        "inputSteps": "1. In this app, go to Settings ⚙️ > API Keys.\n2. Paste your copied key into the corresponding input field.\n3. Click the \"Save All Keys\" button."
      }
    },
    "common": {
      "save": "Save",
      "copy": "Copy",
      "copied": "Copied!",
      "retry": "Retry"
    }
  }
};

const hi = {
  "appName": "कनिष्का",
  "auth": {
    "loginMessage": "जारी रखने के लिए कृपया लॉग इन करें",
    "signupMessage": "शुरू करने के लिए एक खाता बनाएं",
    "login": "लॉग इन करें",
    "signup": "साइन अप करें",
    "identifierLabel": "उपयोगकर्ता नाम, ईमेल, या फ़ोन",
    "identifierPlaceholder": "अपना पहचानकर्ता दर्ज करें",
    "passwordLabel": "पासवर्ड",
    "passwordPlaceholder": "अपना पासवर्ड डालें",
    "signupNameLabel": "नाम / उपयोगकर्ता नाम",
    "signupNamePlaceholder": "एक उपयोगकर्ता नाम चुनें",
    "signupEmailLabel": "ईमेल",
    "signupEmailPlaceholder": "आपका@email.com",
    "signupPhoneLabel": "फ़ोन नंबर",
    "signupPhonePlaceholder": "10-अंकीय फ़ोन नंबर",
    "signupPasswordPlaceholder": "एक मजबूत पासवर्ड बनाएं",
    "toggleToSignup": "खाता नहीं है? साइन अप करें",
    "toggleToLogin": "पहले से ही एक खाता है? लॉग इन करें",
    "error": {
      "fillFields": "कृपया सभी फ़ील्ड भरें।",
      "userNotFound": "उस उपयोगकर्ता नाम, ईमेल या फ़ोन नंबर से कोई खाता नहीं मिला।",
      "invalidPassword": "आपके द्वारा दर्ज किया गया पासवर्ड गलत है। कृपया पुनः प्रयास करें।",
      "emailExists": "इस ईमेल से एक खाता पहले से मौजूद है।",
      "usernameExists": "यह उपयोगकर्ता नाम पहले ही लिया जा चुका है।",
      "unexpected": "एक अप्रत्याशित त्रुटि हुई।"
    }
  },
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
      "error": "एक त्रुटि हुई।",
      "idle": "निष्क्रिय",
      "disconnectedInactivity": "निष्क्रियता के कारण डिस्कनेक्ट हो गया।",
      "listeningForWakeWord": "'{{wakeWord}}' के लिए सुन रही हूँ",
      "awake": "जागृत। कमांड के लिए सुन रही हूँ...",
      "sleep": "सो रही हूँ। मुझे जगाने के लिए माइक पर क्लिक करें।",
      "goingToSleep": "निष्क्रियता के कारण सोने जा रही हूँ। मुझे जगाने के लिए माइक्रोफ़ोन पर क्लिक करें।"
    },
    "noSpeechHint": "मैंने कुछ नहीं सुना।"
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
    "sources": "स्रोत:"
  },
  "settings": {
    "title": "सेटिंग्स",
    "tabs": {
      "persona": "व्यक्तित्व",
      "bias": "झुकाव",
      "voice": "आवाज़",
      "avatar": "अवतार",
      "apiKeys": "एपीआई कुंजी",
      "account": "खाता और डेटा",
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
       "continuousListening": {
        "title": "सतत सुनना",
        "description": "सहायक को हर बार रिकॉर्ड बटन दबाए बिना लगातार सुनने की अनुमति दें।",
        "enable": "सतत सुनना सक्षम करें"
      },
      "wakeWord": {
        "title": "वेक वर्ड",
        "description": "सतत सुनने की मोड में सहायक को सक्रिय करने के लिए एक कस्टम वाक्यांश सेट करें।",
        "default": "डिफ़ॉल्ट",
        "custom": "कस्टम",
        "placeholder": "कस्टम वेक वर्ड दर्ज करें"
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
        "description": "मौसम और यूट्यूब खोज जैसी अतिरिक्त सुविधाओं के लिए एपीआई कुंजी प्रदान करें। आपकी कुंजियाँ स्थानीय रूप से आपके खाते में सहेजी जाती हैं।"
      },
      "weatherKey": "विज़ुअल क्रॉसिंग वेदर कुंजी",
      "newsKey": "जीन्यूज एपीआई कुंजी",
      "youtubeKey": "गूगल क्लाउड एपीआई कुंजी (यूट्यूब के लिए)",
      "save": "सभी कुंजियाँ सहेजें"
    },
    "accountTab": {
      "session": {
        "title": "सत्र की जानकारी",
        "description": "यह इस ब्राउज़र सत्र के लिए आपका अद्वितीय पहचानकर्ता है।"
      },
      "data": {
        "title": "डेटा प्रबंधन",
        "description": "अपनी बातचीत के इतिहास और अन्य संग्रहीत डेटा को प्रबंधित करें।"
      },
      "clearHistory": {
        "button": "बातचीत का इतिहास साफ़ करें",
        "description": "यह आपके खाते से सभी बातचीत के प्रतिलेखों को स्थायी रूप से हटा देगा।"
      },
      "logout": {
        "button": "लॉग आउट",
        "description": "यह आपके वर्तमान सत्र को समाप्त कर देगा। आपका डेटा आपके खाते में सहेजा जाएगा।"
      }
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
        "inputSteps": "1. इस ऐप में, सेटिंग्स ⚙️ > एपीआई कुंजी पर जाएं।\n2. अपनी कॉपी की गई कुंजी को संबंधित इनपुट फ़ील्ड में पेस्ट करें।\n3. \"सभी कुंजियाँ सहेजें\" बटन पर क्लिक करें।"
      }
    },
    "common": {
      "save": "सहेजें",
      "copy": "कॉपी करें",
      "copied": "कॉपी किया गया!",
      "retry": "पुनः प्रयास करें"
    }
  }
};

const translationsData = { en, hi };

type Language = keyof typeof translationsData;

interface TranslationContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: { [key: string]: string }) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const getNested = (obj: any, path: string): string | undefined => {
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
};

// FIX: Changed to React.FC to make the component type explicit for the JSX transpiler.
export const TranslationProvider: FC<{children: React.ReactNode}> = ({ children }) => {
  const [lang, setLangState] = useState<Language>((localStorage.getItem('kaniska-lang') as Language) || 'en');

  const setLang = useCallback((newLang: Language) => {
    if (Object.keys(translationsData).includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('kaniska-lang', newLang);
    }
  }, []);

  const t = useCallback((key: string, params?: { [key: string]: string }): string => {
    let translation = getNested(translationsData[lang], key) || getNested(translationsData['en'], key) || key;
    if (params) {
        Object.keys(params).forEach(paramKey => {
            translation = translation.replace(`{{${paramKey}}}`, params[paramKey]);
        });
    }
    return translation;
  }, [lang]);

  // FIX: Replaced JSX with React.createElement to be valid in a .ts file.
  return React.createElement(TranslationContext.Provider, { value: { lang, setLang, t } }, children);
};

export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const availableLanguages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' }
];