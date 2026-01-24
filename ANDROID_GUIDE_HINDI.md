
# कनिष्का Android App (APK) बनाने की गाइड

नमस्ते! इस वेब ऐप को एक असली Android App में बदलने के लिए नीचे दिए गए स्टेप्स को फॉलो करें। हम **Capacitor** का उपयोग कर रहे हैं जो React को Android App में बदल देता है।

## 1. जरूरी टूल्स (Prerequisites)
आपके कंप्यूटर पर ये इंस्टॉल होना चाहिए:
*   Node.js
*   Android Studio (लेटेस्ट वर्जन)

## 2. ऐप को तैयार करें (Build Process)

अपने प्रोजेक्ट फोल्डर में टर्मिनल (Terminal) खोलें और ये कमांड्स एक-एक करके चलाएं:

### स्टेप 1: डिपेंडेंसी इंस्टॉल करें
```bash
npm install
```

### स्टेप 2: प्रोजेक्ट का बिल्ड बनाएं
यह आपके कोड को `dist` फोल्डर में बदल देगा जिसे Android समझ सकता है।
```bash
npm run build
```

### स्टेप 3: Android प्लेटफॉर्म जोड़ें
```bash
npx cap add android
```

### स्टेप 4: कोड को Android में सिंक करें
जब भी आप React कोड में कोई बदलाव करें, यह कमांड जरूर चलाएं:
```bash
npx cap sync
```

## 3. APK बनाना और रन करना

### स्टेप 5: Android Studio खोलें
```bash
npx cap open android
```
यह कमांड Android Studio खोल देगा।

### स्टेप 6: परमिशन सेट करें (Permissions)
Android Studio में, बाईं तरफ फ़ाइलों में यहाँ जाएं:
`app/src/main/AndroidManifest.xml`

वहाँ `<manifest>` टैग के अंदर ये लाइनें होनी चाहिए (ताकि माइक और कैमरा चले):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.CAMERA" />
```

### स्टेप 7: ऐप रन करें
1.  अपना Android फोन USB से कनेक्ट करें (Developer Mode ऑन होना चाहिए)।
2.  Android Studio में ऊपर हरे रंग का **Play (▶)** बटन दबाएं।
3.  ऐप आपके फोन में इंस्टॉल हो जाएगा!

---

## 4. API Keys (महत्वपूर्ण)

Android App में `.env` फाइल हमेशा काम नहीं करती। अगर ऐप में API Key काम नहीं कर रही है, तो सबसे आसान तरीका यह है:

1.  `vite.config.ts` फाइल में `define` सेक्शन देखें। हम वहां `process.env.API_KEY` को सेट कर रहे हैं।
2.  बिल्ड करते समय अपनी Key को सिस्टम में सेट करें, या `vite.config.ts` में हार्डकोड कर दें (सिर्फ टेस्टिंग के लिए)।

सुरक्षित तरीका:
`local.properties` फाइल (Android फोल्डर में) का उपयोग करें, लेकिन अभी के लिए `.env` फाइल से `VITE_GEMINI_API_KEY` सही से सेट होनी चाहिए।

शुभकामनाएं! आपका कनिष्का ऐप तैयार है।
