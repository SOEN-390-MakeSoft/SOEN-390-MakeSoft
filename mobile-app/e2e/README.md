# Detox E2E (Android)

This project uses Detox for Android end-to-end tests.

## Prerequisites

- Android SDK installed and `ANDROID_SDK_ROOT` set
- JDK 17
- `.env.local` with:
  ```
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID=...
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=...
  ```

## One-time setup (per machine)

If the `android/` directory doesn't exist:

```
npx expo prebuild -p android
```

Publish the Detox Android AAR locally:

```
npm run detox:publish:android
```

## Build + run

```
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_SDK_ROOT=/Users/admin/Library/Android/sdk
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
export DETOX_AVD_NAME="Medium_Phone_API_36.1"

set -a
source .env.local
set +a

npm run detox:build:android
npm run detox:test:android
```

## Test steps (ES-1 / US-1.1)

File: `e2e/map.campus-switch.e2e.js`

1. Launch app
2. Verify map screen and label show **SGW**
3. Tap **Loyola** and verify label updates to **LOYOLA**

Expected: Map loads within 10 seconds and campus switch recenters the map.

## Test steps (ES-4 / US-4.1)

File: `e2e/indoor-room.e2e.js`

1. Launch app
2. Tap **Get Started** to open the map
3. Search for room **H-822** and select it
4. Verify room info and the **Navigate here** button are visible

## Test steps (ES-4 / US-4.2)

File: `e2e/indoor-path.e2e.js`

1. Launch app
2. Tap **Get Started** to open the map
3. Set location in **H-811** (current location)
4. Search for room **H-822** and select it
5. Tap **Navigate here** to open indoor navigation
6. Select **Floor 8** and confirm **H-811** if prompted
7. Verify indoor route steps are shown
