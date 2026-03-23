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

## Test steps (US-4.3)

File: `e2e/indoor-accessible.e2e.js`

1. Launch app and open map
2. Set location near Webster Library (LB building)
3. Search for room **H-838** and open indoor navigation
4. Scroll navigation steps
5. Tap **Accessible Route**

Expected: Accessible route toggle is visible and can be enabled for indoor navigation.
