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

## Test steps (ES-4)

### US-4.1 Indoor rooms

File: `e2e/indoor-room.e2e.js`

1. Launch app and open the map
2. Ensure Classes calendar is connected (if prompted)
3. Search for **H-822** and select the result
4. Verify the room info bubble and **Navigate here** button

Expected: Room is visible and navigation is available.

### US-4.2 Indoor shortest path

File: `e2e/indoor-path.e2e.js`

1. Launch app and open the map
2. Ensure Classes calendar is connected (if prompted)
3. Set location in **H-811**
4. Search for **H-822** and open **Navigate here**
5. Select floor **8** and confirm **Yes** if prompted

Expected: Indoor navigation flow opens for the destination.

### US-4.3 Accessible indoor routes

File: `e2e/indoor-accessible.e2e.js`

1. Launch app and open the map
2. Ensure Classes calendar is connected (if prompted)
3. Set location near Webster Library
4. Search for **H-838** and open **Navigate here**
5. Scroll the navigation steps and enable **Accessible route**

Expected: Accessible route toggle is available and can be enabled.

### US-4.4 Indoor POIs

File: `e2e/indoor-poi.e2e.js`

1. Launch app and open the map
2. Ensure Classes calendar is connected (if prompted)
3. Search for **H-822** to enter indoor mode
4. Close the room info card
5. Tap POI filter chips (washrooms, elevators, water fountains)

Expected: POI filters are visible and respond to taps.

### US-4.5 Tunnel navigation

File: `e2e/tunnel-navigation.e2e.js`

1. Launch app and open the map
2. Ensure Classes calendar is connected (if prompted)
3. Set location near Hall building
4. Search for **EV** and open directions
5. Select floor **8** and confirm **Yes** if prompted
6. Scroll the navigation steps list

Expected: Navigation steps list is visible and scrollable.

## Recording (GIF/Video)

In two terminals:

Terminal A:

```
export ANDROID_SDK_ROOT=/Users/admin/Library/Android/sdk
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
adb shell screenrecord /sdcard/detox_map.mp4
```

Terminal B:

```
npm run detox:test:android
```

Stop recording with Ctrl+C, then pull:

```
adb pull /sdcard/detox_map.mp4 ../Artifacts/detox_map.mp4
adb shell rm /sdcard/detox_map.mp4
```
