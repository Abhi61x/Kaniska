import React, { createContext, useContext, useState, useCallback } from 'react';

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
      "idle": "Idle",
      "live": "Live",
      "recognizing": "Listening for song..."
    },
    "noSpeechHint": "I didn't hear anything. Please try speaking again.",
    "lowConfidenceHint": "I'm not sure I got that. Could you repeat?"
  },
  "footer": {
    "connect": "Connect",
    "disconnect": "Disconnect",
    "record": "Record",
    "stop": "Stop",
    "recognizeSong": "Recognize Song"
  },
  "chat": {
    "placeholder": {
      "title": "Your conversation will appear here.",
      "info": "[INFO] Connection closed."
    },
    "sources": "Sources:",
    "goToApiSettings": "Go to API Key Settings",
    "songRecognized": "I think this is \"{{title}}\" by {{artist}}.",
    "songNotFound": "I couldn't recognize that song. Please make sure the music is clear."
  },
  "timer": {
    "title": "Timer"
  },
  "youtubePanel": {
    "title": "YouTube Player",
    "recentSearches": "Recent Searches",
    "views": "{{count}} views"
  },
  "settings": {
    "title": "Settings",
    "tabs": {
      "persona": "Persona",
      "voice": "Voice",
      "apiKeys": "API Keys",
      "subscription": "Subscription",
      "help": "Help & Support",
      "about": "About"
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
    "voiceTab": {
      "title": "Voice Configuration",
      "description": "Set different voices for each persona. These are high-quality, natural-sounding voices provided by Google.",
      "female": {
        "title": "Female Persona (Kaniska)"
      },
      "male": {
        "title": "Male Persona (Kanishk)"
      },
      "mainVoiceLabel": "Main Voice",
      "greetingVoiceLabel": "Greeting Voice",
      "test": "Test",
      "testVoiceSample": "This is a test of the selected voice."
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
      "auddioKey": "Audd.io API Key",
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
      "aiChat": {
        "title": "Chat with Support AI",
        "description": "Have a question? Ask our AI assistant for help with app features, settings, or troubleshooting.",
        "placeholder": "Ask a question...",
        "send": "Send"
      },
      "q1": "How do I use Kaniska?",
      "a1": "Click the \"Connect\" button to start a session. When the avatar indicates it's listening, speak your command. You can interrupt the assistant at any time by simply speaking again.",
      "q2": "How do I get and set up API Keys?",
      "a2": {
        "weatherTitle": "Visual Crossing Weather API Key",
        "weatherSteps": "1. Go to the <1>Visual Crossing Weather Data</1> website.\n2. Click 'Sign Up' to create a free account.\n3. After signing in, click your account name in the top-right corner and select 'Account' from the dropdown menu.\n4. Your API Key will be visible on this page. Copy it.",
        "youtubeTitle": "Google Cloud API Key (for YouTube)",
        "youtubeSteps": "1. Go to the <1>Google Cloud Console</1> and sign in.\n2. In the top bar, click the project selector dropdown (it might say 'Select a project') and click 'NEW PROJECT'.\n3. Give your project a name (e.g., 'Kaniska YouTube Key') and click 'CREATE'.\n4. Ensure your new project is selected in the top bar.\n5. In the top search bar, type 'YouTube Data API v3' and select it.\n6. Click the blue 'ENABLE' button.\n7. After it's enabled, open the navigation menu (☰) in the top-left, go to 'APIs & Services', then 'Credentials'.\n8. Click '+ CREATE CREDENTIALS' at the top and select 'API key'.\n9. A pop-up will show your new API key. Copy it.",
        "inputTitle": "Where do I input the keys?",
        "inputSteps": "1. In this app, click the Settings icon (⚙️) in the top-right corner.\n2. Go to the 'API Keys' tab.\n3. Paste your copied key into the correct input field.\n4. Click 'Save & Validate Keys'."
      }
    },
    "aboutTab": {
      "title": "About Kaniska",
      "description": "Kaniska, a sci-fi inspired female voice assistant that uses Gemini to understand commands in Hindi, search YouTube, and provide voice replies using the browser's built-in text-to-speech.",
      "version": "Version",
      "privacyPolicy": "Privacy Policy"
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
      "speechRecognitionGeneric": "An unexpected error occurred with speech recognition. Please try again. If it continues, try refreshing the page.",
      "speechRecognitionNetwork": "A network error prevented speech recognition. Please check your connection.",
      "connection": "Live connection failed. Please check your internet and try again. The service might be temporarily unavailable.",
      "youtubePlayback": "I'm sorry, but there was an error playing that video. It might be private, deleted, or restricted from being embedded. Please try a different search.",
      "auddioKeyMissing": "Please set your Audd.io API key in the settings to use song recognition.",
      "auddioRecording": "I couldn't start recording for song recognition. Please ensure microphone permissions are granted in your browser settings and try again."
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
      "idle": "निष्क्रिय",
      "live": "लाइव",
      "recognizing": "गाना सुन रही हूँ..."
    },
    "noSpeechHint": "मैंने कुछ नहीं सुना। कृपया दोबारा बोलने का प्रयास करें।",
    "lowConfidenceHint": "मुझे ठीक से समझ नहीं आया। क्या आप दोहरा सकते हैं?"
  },
  "footer": {
    "connect": "कनेक्ट",
    "disconnect": "डिस्कनेक्ट",
    "record": "रिकॉर्ड",
    "stop": "रोकें",
    "recognizeSong": "गाना पहचानें"
  },
  "chat": {
    "placeholder": {
      "title": "आपकी बातचीत यहाँ दिखाई देगी।",
      "info": "[जानकारी] कनेक्शन बंद हो गया।"
    },
    "sources": "स्रोत:",
    "goToApiSettings": "एपीआई कुंजी सेटिंग्स पर जाएं",
    "songRecognized": "मुझे लगता है यह \"{{title}}\" है, जिसे {{artist}} ने गाया है।",
    "songNotFound": "मैं उस गाने को पहचान नहीं सकी। कृपया सुनिश्चित करें कि संगीत स्पष्ट है।"
  },
  "timer": {
    "title": "टाइमर"
  },
  "youtubePanel": {
    "title": "यूट्यूब प्लेयर",
    "recentSearches": "हाल की खोजें",
    "views": "{{count}} बार देखा गया"
  },
  "settings": {
    "title": "सेटिंग्स",
    "tabs": {
      "persona": "व्यक्तित्व",
      "voice": "आवाज़",
      "apiKeys": "एपीआई कुंजी",
      "subscription": "सदस्यता",
      "help": "सहायता और समर्थन",
      "about": "बारे में"
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
    "voiceTab": {
      "title": "आवाज़ विन्यास",
      "description": "प्रत्येक व्यक्तित्व के लिए अलग-अलग आवाजें सेट करें। ये गूगल द्वारा प्रदान की गई उच्च-गुणवत्ता वाली, प्राकृतिक लगने वाली आवाजें हैं।",
      "female": {
        "title": "महिला व्यक्तित्व (कनिष्का)"
      },
      "male": {
        "title": "पुरुष व्यक्तित्व (कनिष्क)"
      },
      "mainVoiceLabel": "मुख्य आवाज़",
      "greetingVoiceLabel": "अभिवादन की आवाज़",
      "test": "परीक्षण",
      "testVoiceSample": "यह चुनी हुई आवाज़ का परीक्षण है।"
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
      "auddioKey": "Audd.io API कुंजी",
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
      "aiChat": {
        "title": "सपोर्ट AI से चैट करें",
        "description": "कोई प्रश्न है? ऐप की सुविधाओं, सेटिंग्स या समस्या निवारण में सहायता के लिए हमारे AI सहायक से पूछें।",
        "placeholder": "एक प्रश्न पूछें...",
        "send": "भेजें"
      },
      "q1": "मैं कनिष्का का उपयोग कैसे करूँ?",
      "a1": "सत्र शुरू करने के लिए \"कनेक्ट\" बटन पर क्लिक करें। जब अवतार सुनने का संकेत दे, तो अपना कमांड बोलें। आप किसी भी समय केवल दोबारा बोलकर सहायक को बाधित कर सकते हैं।",
      "q2": "मैं एपीआई कुंजी कैसे प्राप्त और सेट करूं?",
      "a2": {
        "weatherTitle": "विज़ुअल क्रॉसिंग मौसम एपीआई कुंजी",
        "weatherSteps": "1. <1>विज़ुअल क्रॉसिंग वेदर डेटा</1> वेबसाइट पर जाएं।\n2. एक निःशुल्क खाता बनाने के लिए 'साइन अप करें' पर क्लिक करें।\n3. साइन इन करने के बाद, ऊपर-दाएं कोने में अपने खाते के नाम पर क्लिक करें और ड्रॉपडाउन मेनू से 'अकाउंट' चुनें।\n4. आपकी एपीआई कुंजी इस पृष्ठ पर दिखाई देगी। इसे कॉपी करें।",
        "youtubeTitle": "गूगल क्लाउड एपीआई कुंजी (यूट्यूब के लिए)",
        "youtubeSteps": "1. <1>गूगल क्लाउड कंसोल</1> पर जाएं और साइन इन करें।\n2. ऊपरी बार में, प्रोजेक्ट चयनकर्ता ड्रॉपडाउन पर क्लिक करें (यह 'एक प्रोजेक्ट चुनें' कह सकता है) और 'नया प्रोजेक्ट' पर क्लिक करें।\n3. अपने प्रोजेक्ट को एक नाम दें (जैसे, 'कनिष्का यूट्यूब कुंजी') और 'बनाएं' पर क्लिक करें।\n4. सुनिश्चित करें कि आपका नया प्रोजेक्ट ऊपरी बार में चुना गया है।\n5. ऊपरी खोज बार में, 'YouTube Data API v3' टाइप करें और इसे चुनें।\n6. नीले 'सक्षम करें' बटन पर क्लिक करें।\n7. सक्षम होने के बाद, ऊपर-बाईं ओर नेविगेशन मेनू (☰) खोलें, 'एपीआई और सेवाएं' पर जाएं, फिर 'क्रेडेंशियल' पर जाएं।\n8. शीर्ष पर '+ क्रेडेंशियल बनाएं' पर क्लिक करें और 'एपीआई कुंजी' चुनें।\n9. एक पॉप-अप आपकी नई एपीआई कुंजी दिखाएगा। इसे कॉपी करें।",
        "inputTitle": "मैं कुंजियाँ कहाँ दर्ज करूँ?",
        "inputSteps": "1. इस ऐप में, ऊपर-दाएं कोने में सेटिंग्स आइकन (⚙️) पर क्लिक करें।\n2. 'एपीआई कुंजी' टैब पर जाएं।\n3. अपनी कॉपी की गई कुंजी को सही इनपुट फ़ील्ड में पेस्ट करें।\n4. 'कुंजी सहेजें और मान्य करें' पर क्लिक करें।"
      }
    },
    "aboutTab": {
      "title": "कनिष्का के बारे में",
      "description": "कनिष्का, एक विज्ञान-कथा से प्रेरित महिला वॉयस असिस्टेंट है जो जेमिनी का उपयोग करके हिंदी में कमांड समझने, यूट्यूब पर खोजने और ब्राउज़र के अंतर्निहित टेक्स्ट-टू-स्पीच का उपयोग करके वॉयस रिप्लाई प्रदान करती है।",
      "version": "संस्करण",
      "privacyPolicy": "गोपनीयता नीति"
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
      "speechRecognitionGeneric": "वाक् पहचान में एक अप्रत्याशित त्रुटि हुई। कृपया पुनः प्रयास करें। यदि यह जारी रहता है, तो पृष्ठ को ताज़ा करने का प्रयास करें।",
      "speechRecognitionNetwork": "नेटवर्क त्रुटि के कारण वाक् पहचान बाधित हुई। कृपया अपना कनेक्शन जांचें।",
      "connection": "लाइव कनेक्शन विफल हो गया। कृपया अपना इंटरनेट जांचें और फिर से प्रयास करें। सेवा अस्थायी रूप से अनुपलब्ध हो सकती है।",
      "youtubePlayback": "मुझे खेद है, लेकिन उस वीडियो को चलाने में एक त्रुटि हुई। यह निजी, हटा दिया गया, या एम्बेड करने से प्रतिबंधित हो सकता है। कृपया एक अलग खोज का प्रयास करें।",
      "auddioKeyMissing": "गाना पहचानने की सुविधा का उपयोग करने के लिए कृपया सेटिंग्स में अपनी Audd.io API कुंजी सेट करें।",
      "auddioRecording": "मैं गाना पहचानने के लिए रिकॉर्डिंग शुरू नहीं कर सकी। कृपया सुनिश्चित करें कि आपकी ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति है और पुनः प्रयास करें।"
    }
  }
};

const translationsData = { en, hi };

const TranslationContext = createContext(undefined);

const getNested = (obj, path) => {
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
};

export function TranslationProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem('kaniska-lang') || 'en');

  const setLang = useCallback((newLang) => {
    if (Object.keys(translationsData).includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('kaniska-lang', newLang);
    }
  }, []);

  const t = useCallback((key, params) => {
    let text = getNested(translationsData[lang], key);

    if (typeof text !== 'string') {
      text = getNested(translationsData.en, key);
    }

    if (typeof text !== 'string') {
      return key;
    }

    if (params) {
      for (const p of Object.keys(params)) {
        text = text.replace(`{{${p}}}`, params[p]);
      }
    }
    return text;
  }, [lang]);
  
  return React.createElement(TranslationContext.Provider, { value: { lang, setLang, t } }, children);
}

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const availableLanguages = [
    { code: 'en', name: 'English (India)', bcp47: 'en-IN' },
    { code: 'hi', name: 'हिंदी (Hindi)', bcp47: 'hi-IN' },
];