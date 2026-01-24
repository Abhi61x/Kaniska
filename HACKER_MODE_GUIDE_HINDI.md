
# कनिष्का: हैकर मोड (Accessibility Service Automation)

भाई, अगर आप चाहते हैं कि कनिष्का सच में फोन चलाए, तो आपको कनिष्का के "दिमाग" (Gemini) को फोन के "हाथों" (Accessibility Service) से जोड़ना होगा।

यहाँ इसकी **Complete Step-by-Step Guide** है:

## 1. Logic कैसे काम करेगा?
1.  **Gemini:** कनिष्का को हम `automatePhone` नाम का टूल देंगे। 
2.  **React:** जब कनिष्का ये टूल कॉल करेगी, React ऐप एक `Custom Event` जनरेट करेगा।
3.  **Bridge:** Capacitor के माध्यम से हम इस डेटा को Native Android (Java) पर भेजेंगे।
4.  **Java Service:** आपका `AccessibilityService` उस मैसेज को पकड़ेगा और स्क्रीन पर क्लिक या स्क्रॉल करेगा।

## 2. Native Java कोड (Android Studio में)

फाइल: `android/app/src/main/java/com/kaniska/ai/AutomationBridge.java`
(यह Capacitor और Accessibility के बीच का पुल है)

```java
package com.kaniska.ai;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AutomationBridge")
public class AutomationBridge extends Plugin {

    @PluginMethod()
    public void sendToService(PluginCall call) {
        String action = call.getString("action");
        String target = call.getString("target");
        
        // यहाँ हम Accessibility Service को मैसेज भेजते हैं
        KaniskaAccessibilityService.performAction(action, target);
        
        JSObject ret = new JSObject();
        ret.put("status", "success");
        call.resolve(ret);
    }
}
```

## 3. Accessibility Service का असली काम

फाइल: `KaniskaAccessibilityService.java` में इस फंक्शन को जोड़ें:

```java
public static void performAction(String action, String target) {
    if (instance == null) return;

    AccessibilityNodeInfo root = instance.getRootInActiveWindow();
    if (root == null) return;

    if ("click".equals(action)) {
        // स्क्रीन पर उस बटन को ढूंढो जिसपर 'target' लिखा है
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(target);
        for (AccessibilityNodeInfo node : nodes) {
            node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
    } else if ("scroll_down".equals(action)) {
        // स्वाइप अप (Reels के लिए)
        instance.dispatchGesture(...); // यहाँ Gesture वाला कोड आएगा
    }
}
```

## 4. React साइड पर इसे कॉल करना

`App.tsx` में जहाँ हम इवेंट सुनते हैं:

```javascript
import { registerPlugin } from '@capacitor/core';
const AutomationBridge = registerPlugin('AutomationBridge');

window.addEventListener('kaniska-phone-control', async (e) => {
    const { action, target, textValue } = e.detail;
    // Native Plugin को कॉल करें
    await AutomationBridge.sendToService({ action, target, textValue });
});
```

## 5. बहुत ज़रूरी बातें (WARNING)
*   **Security:** Accessibility Service बहुत पावरफुल है, इसे केवल अपने फोन पर टेस्ट करें। Play Store पर इसे पब्लिश करना बहुत मुश्किल है।
*   **Permissions:** यूजर को मैन्युअली `Settings > Accessibility` में जाकर कनिष्का को ON करना पड़ेगा।
*   **Deep Links:** बेहतर अनुभव के लिए पहले `open_external_app` का इस्तेमाल करें ताकि सही ऐप खुल जाए, फिर `automatePhone` चलाएं।

भाई, ये सेटअप करने के बाद कनिष्का सच में आपके हाथ का काम कम कर देगी!
