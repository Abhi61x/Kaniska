# Kaniska AI: Capacitor Android Setup Guide (Hindi)

भाई, अपनी वेबसाइट को Android App (APK) में बदलने के लिए नीचे दिए गए स्टेप्स को फॉलो करें।

## 1. प्रोजेक्ट तैयार करें (Terminal Commands)

सबसे पहले अपने प्रोजेक्ट फोल्डर में Terminal खोलें और ये कमांड चलाएं:

```bash
# 1. प्रोजेक्ट बिल्ड करें
npm run build

# 2. Android फोल्डर जोड़ें (Agar pehle nahi kiya)
npx cap add android

# 3. Code sync karein
npx cap sync
```

## 2. Permissions सेट करना (Bahut Zaroori)

Android 10/11/12+ पर माइक और कैमरा इस्तेमाल करने के लिए आपको `AndroidManifest.xml` फाइल में परमिशन जोड़नी पड़ेगी।

1.  Is file ko kholein: `android/app/src/main/AndroidManifest.xml`
2.  Niche diye gaye permissions ko `<manifest>` tag ke andar paste karein:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.kaniska.ai">

    <!-- INTERNET: App ko online chalane ke liye -->
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- MICROPHONE: Kaniska se baat karne ke liye -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- CAMERA: Video call/vision features ke liye -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" />
    <uses-feature android:name="android.hardware.camera.autofocus" />

    <!-- FILE UPLOAD: Agar user photo upload kare -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"> <!-- HTTP links ke liye zaroori -->

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```

## 3. App Run Karein

Permissions set karne ke baad, app ko run karein:

```bash
npx cap open android
```

Ye Android Studio khol dega. Wahan upar "Play" button dabayein aur apna phone USB se connect karke app install karein.

## 4. Tips

*   **App Icon:** `android/app/src/main/res/mipmap...` folders mein apne icons (`ic_launcher.png`) replace kar dein taaki Kaniska ka logo dikhe.
*   **Back Button:** Maine `src/App.tsx` mein code daal diya hai taaki jab aap "Back" dabayein to app band hone ki jagah minimize ho jaye (jaise asli assistants karte hain).
