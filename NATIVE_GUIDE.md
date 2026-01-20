
# कनिष्का को एक सुपर-पावरफुल नेटिव Android App (APK) में कैसे बदलें

नमस्ते! वेब ब्राउज़र की सुरक्षा सीमाएँ हैं, इसलिए इंस्टाग्राम को कंट्रोल करने या पूरी तरह बैकग्राउंड में चलने के लिए आपको **React Native** का उपयोग करके एक असली ऐप (.apk) बनाना होगा।

यहाँ पूरी प्रक्रिया हिंदी में दी गई है।

---

## 1. प्रोजेक्ट सेटअप (Project Setup)

आपको **React Native CLI** का उपयोग करना चाहिए क्योंकि यह भारी ऐप्स (100MB+) और नेटिव मॉड्यूल (Native Modules) को अच्छे से संभाल सकता है।

```bash
npx react-native init KaniskaAI
```

---

## 2. जरूरी परमिशन (AndroidManifest.xml)

फाइल लोकेशन: `android/app/src/main/AndroidManifest.xml`

ये परमिशन ऐप को फोन का "भगवान" बना देंगी (सब कुछ कंट्रोल करने की ताकत):

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.kaniskaai">

    <!-- इंटरनेट और नेटवर्क -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- माइक और ऑडियो -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- फोन कॉल्स और कांटेक्ट -->
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.READ_CALL_LOG" />

    <!-- दूसरे ऐप्स के ऊपर दिखना (Floating Avatar) -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <!-- बैकग्राउंड में हमेशा चलना (Never Sleep) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

    <!-- ऑटोमेशन और स्क्रीन कंट्रोल (सबसे जरूरी) -->
    <!-- इसके लिए नीचे सर्विस भी डिक्लेअर करनी होगी -->

    <application ...>
        
        <!-- Accessibility Service (इंस्टाग्राम कंट्रोल के लिए) -->
        <service android:name=".KaniskaAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

    </application>
</manifest>
```

---

## 3. इंस्टाग्राम और ऐप्स को कंट्रोल करना (The Accessibility Service)

यह "जादू" है। आपको Android (Java/Kotlin) में एक फाइल बनानी होगी जो स्क्रीन को पढ़ सके और क्लिक कर सके।

फाइल: `android/app/src/main/java/com/kaniskaai/KaniskaAccessibilityService.java`

```java
package com.kaniskaai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class KaniskaAccessibilityService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // यह तब कॉल होगा जब स्क्रीन पर कुछ बदलेगा (जैसे नया पेज खुला)
        
        if (event.getPackageName().equals("com.instagram.android")) {
            // अगर इंस्टाग्राम खुला है
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            
            // उदाहरण: अगर कनिष्का ने "Like" कमांड दिया है
            if (GlobalState.shouldLikePost) {
                // स्क्रीन पर "Like" बटन या हार्ट आइकन ढूंढो और क्लिक करो
                // यह बहुत पावरफुल है, आप किसी भी बटन को ढूंढकर क्लिक करवा सकते हैं
                clickButtonByContentDescription(rootNode, "Like");
                GlobalState.shouldLikePost = false;
            }
            
            // उदाहरण: स्क्रॉल करना (Reels)
            if (GlobalState.shouldScroll) {
                scrollScreen();
                GlobalState.shouldScroll = false;
            }
        }
    }

    // स्क्रीन स्क्रॉल करने का फंक्शन (Swipe Up)
    private void scrollScreen() {
        Path swipePath = new Path();
        swipePath.moveTo(500, 1500); // नीचे से शुरू
        swipePath.lineTo(500, 500);  // ऊपर तक स्वाइप
        
        GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
        gestureBuilder.addStroke(new GestureDescription.StrokeDescription(swipePath, 0, 500));
        dispatchGesture(gestureBuilder.build(), null, null);
    }

    @Override
    public void onInterrupt() {}
}
```

---

## 4. बैकग्राउंड में हमेशा ज़िंदा रहना (Persistent Service)

ऐप को मरने से बचाने के लिए (Anti-Kill), आपको एक `Foreground Service` चलानी होगी जो नोटिफिकेशन बार में हमेशा दिखेगी।

```java
// इसे MainActivity.java या अलग सर्विस फाइल में डालें
public void startForegroundService() {
    Notification channel = new NotificationCompat.Builder(this, "CHANNEL_ID")
            .setContentTitle("Kaniska is Active")
            .setContentText("Listening for commands...")
            .setSmallIcon(R.drawable.ic_mic)
            .build();
            
    startForeground(1, channel);
}
```

---

## 5. React Native UI (Auto-Detect Screen)

React Native में `SafeAreaView` का उपयोग करें, यह अपने आप नॉच (Notch) और नेविगेशन बार को डिटेक्ट कर लेता है।

```javascript
import { SafeAreaView, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const App = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
       {/* यहाँ आपका कनिष्का का UI आएगा */}
       {/* यह अपने आप सुरक्षित जगह (Safe Area) में फिट हो जाएगा */}
    </SafeAreaView>
  );
};
```

---

## निष्कर्ष (Summary)

1.  **React Native** का उपयोग करें।
2.  **Accessibility Service** का उपयोग करें ताकि कनिष्का खुद फोन चला सके (स्क्रॉल, क्लिक)।
3.  **Foreground Service** का उपयोग करें ताकि ऐप कभी बंद न हो।
4.  यह 100MB से कम में आसानी से बन जाएगा और **Super Fast** काम करेगा क्योंकि लॉजिक फोन के अंदर (Native) चल रहा होगा, वेब पर नहीं।

