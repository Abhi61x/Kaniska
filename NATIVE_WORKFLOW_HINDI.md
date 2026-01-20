
# कनिष्का को एक नेटिव Android App (APK) में बदलने का तरीका

भाई, जैसा तुमने पूछा, अगर तुम्हें इस वेब ऐप को एक असली Android App में बदलना है जो Vercel पर होस्ट होने की जगह फोन में इंस्टॉल हो, और फ्री में काम करे, तो तुम्हें **React Native** का इस्तेमाल करना होगा। 

वेबसाइट (Browser) में API Key छुपाना मुश्किल होता है, लेकिन Android App में हम उसे `local.properties` या `.env` फाइल में सुरक्षित रख सकते हैं।

नीचे पूरा वर्कफ़्लो (Workflow) हिंदी में है:

---

## 1. कंप्यूटर तैयार करें (Setup)

तुम्हें अपने लैपटॉप/पीसी पर ये चीज़ें इंस्टॉल करनी होंगी:
1.  **Node.js** (वेबसाइट वाली ही टेक्नोलॉजी)।
2.  **Android Studio** (ऐप बनाने और चलाने के लिए)।
3.  **Java JDK** (Android के लिए जरूरी)।

---

## 2. नया प्रोजेक्ट बनाएं

कमांड प्रॉम्प्ट (Terminal) खोलें और ये कमांड लिखें:

```bash
npx react-native init KaniskaApp
cd KaniskaApp
```

यह एक खाली ऐप बना देगा।

---

## 3. जरूरी पैकेजों को इंस्टॉल करें

वेब और ऐप में थोड़ा फर्क होता है। ऐप में कैमरा और माइक के लिए अलग लाइब्रेरी लगती है।

```bash
# नेविगेशन के लिए
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context

# माइक और आवाज के लिए
npm install react-native-audio-recorder-player

# कैमरा के लिए
npm install react-native-vision-camera

# वीडियो चलाने के लिए (YouTube)
npm install react-native-youtube-iframe

# Google Gemini API (Same as web)
npm install @google/genai
```

---

## 4. API Key को सुरक्षित रखना (Secret Key)

यही वो स्टेप है जो तुम Vercel पर करना चाहते थे। नेटिव ऐप में हम इसे ऐसे करते हैं:

1.  प्रोजेक्ट के अंदर `android/local.properties` फाइल को खोलें।
2.  इसमें अपनी YouTube और Gemini Keys लिखें:

```properties
YOUTUBE_API_KEY="AIzaSyB..."
GEMINI_API_KEY="AIzaSyC..."
```

3.  अब कोड में इसे `Config` लाइब्रेरी से एक्सेस करें। इससे कोई भी यूजर तुम्हारा APK डिकोड करके की (Key) आसानी से नहीं चुरा पाएगा।

---

## 5. कोड को वेब से ऐप में लाना

तुम्हारे `App.tsx` का लॉजिक वही रहेगा, लेकिन **HTML** टैग्स को बदलना पड़ेगा:

*   `<div>` बन जाएगा `<View>`
*   `<h1>`, `<p>` बन जाएंगे `<Text>`
*   `<button>` बन जाएगा `<TouchableOpacity>`
*   `<img />` बन जाएगा `<Image />`

**उदाहरण (React Native Code):**

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

const App = () => {
  return (
    <View style={{flex: 1, backgroundColor: 'black', alignItems: 'center'}}>
       <Image source={{uri: 'https://i.gifer.com/NTHO.gif'}} style={{width: 200, height: 200}} />
       <Text style={{color: 'cyan', fontSize: 24, fontWeight: 'bold'}}>Kaniska AI</Text>
       
       <TouchableOpacity style={{backgroundColor: 'white', padding: 20, borderRadius: 50}}>
          <Text>Connect</Text>
       </TouchableOpacity>
    </View>
  );
};
```

---

## 6. परमिशन्स (Permissions)

फोन का माइक और कैमरा इस्तेमाल करने के लिए, तुम्हें `android/app/src/main/AndroidManifest.xml` फाइल में ये लाइनें जोड़नी होंगी:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
```

---

## 7. APK बनाना (Build)

जब कोड तैयार हो जाए, तो यह कमांड चलाओ:

```bash
cd android
./gradlew assembleRelease
```

यह तुम्हें एक `.apk` फाइल देगा जिसे तुम अपने दोस्तों को WhatsApp पर भेज सकते हो।

---

## Vercel पर API Key कैसे लगाएँ? (Web Version के लिए)

अगर तुम अभी भी वेबसाइट (Vercel) ही चला रहे हो, तो API Key छुपाने के लिए:

1.  **Vercel Dashboard** पर जाओ।
2.  अपने प्रोजेक्ट (Kaniska) की **Settings** में जाओ।
3.  **Environment Variables** पर क्लिक करो।
4.  वहाँ ये डालो:
    *   **Key:** `VITE_YOUTUBE_API_KEY`
    *   **Value:** `AIzaSyB... (तुम्हारी YouTube Key)`
5.  **Save** करो और प्रोजेक्ट को **Redeploy** करो।

अब कोड में यूजर से की (Key) मांगने की जरूरत नहीं, वो सर्वर से खुद उठा लेगा।
