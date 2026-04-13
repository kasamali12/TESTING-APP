# Maro Hisab - Android Project
## Professional Finance App | Android 8.0+ (API 26+)

---

## 📁 Project Structure
```
MaroHisab/
├── app/
│   ├── src/main/
│   │   ├── assets/
│   │   │   └── index.html           ← Your HTML app lives here
│   │   ├── java/com/marohisab/app/
│   │   │   ├── MainActivity.java    ← WebView host
│   │   │   └── SplashActivity.java  ← Splash screen
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml
│   │   │   │   └── activity_splash.xml
│   │   │   ├── values/
│   │   │   │   ├── strings.xml
│   │   │   │   ├── colors.xml
│   │   │   │   └── themes.xml
│   │   │   └── mipmap-*/            ← App icons
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── build.gradle
├── settings.gradle
└── gradle.properties
```

---

## 🛠️ How to Build APK

### Requirements
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17 (bundled with Android Studio)
- Android SDK with API 34 installed

### Steps

**1. Open Project**
- Launch Android Studio
- Click "Open" → select the `MaroHisab` folder
- Wait for Gradle sync to complete (first time may take 2–5 mins)

**2. Build Debug APK** (for testing)
- Go to menu: `Build → Build Bundle(s) / APK(s) → Build APK(s)`
- APK will be at: `app/build/outputs/apk/debug/app-debug.apk`

**3. Build Release APK** (for distribution)
- Go to menu: `Build → Generate Signed Bundle / APK`
- Choose `APK` → Next
- Create a new keystore (or use existing)
- Fill in key details → Next
- Select `release` → Finish
- APK will be at: `app/build/outputs/apk/release/app-release.apk`

---

## 📱 Install on Device

### Via Android Studio
- Connect your phone via USB
- Enable Developer Options + USB Debugging on phone
- Click the green ▶ Run button

### Via ADB (command line)
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Manual Install
- Copy the APK to your phone
- Open file manager → tap the APK
- Allow "Install from unknown sources" if prompted
- Tap Install

---

## ✨ Features Included
- Full WebView with JavaScript enabled
- localStorage support (data persists between sessions)
- Dark/Light theme support
- PDF & Excel export support
- Splash screen with animation
- Back button navigation
- Hardware acceleration
- Portrait orientation lock
- Custom app icon (MH)

---

## 🔧 Customization

### Change App Name
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Your App Name</string>
```

### Change App Icon
Replace the PNG files in each `mipmap-*` folder with your own icons.

### Update HTML
Replace `app/src/main/assets/index.html` with your updated HTML file.

### Allow Landscape Mode
In `AndroidManifest.xml`, remove or change:
```xml
android:screenOrientation="portrait"
```

---

## 📦 App Details
- **Package ID:** com.marohisab.app
- **Min SDK:** Android 8.0 (API 26)
- **Target SDK:** Android 14 (API 34)
- **Version:** 10.0
