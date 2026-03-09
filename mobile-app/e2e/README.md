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

# Optional: override calendar mode (Detox build defaults to scripted)
export EXPO_PUBLIC_E2E_CALENDAR_MODE="scripted"
# Optional: override directions mode (Detox build defaults to scripted)
export EXPO_PUBLIC_E2E_DIRECTIONS_MODE="scripted"

npm run detox:build:android
npm run detox:test:android
```

## Test steps (ES-1 / US-1.1)

File: `e2e/map.campus-switch.e2e.js`

1. Launch app
2. Verify map screen and label show **SGW**
3. Tap **Loyola** and verify label updates to **LOYOLA**

Expected: Map loads within 10 seconds and campus switch recenters the map.

## Test steps (US-3.1)

File: `e2e/us-3.1.google-calendar.e2e.js`

1. Launch app, open calendar connect modal.
2. Connect with a mock iCal link (scripted mode).
3. Verify an event appears and disconnect works.
4. Enter a denied link and verify the permission error message.

Expected: Checklist logs (☐/☑) print to the terminal during the run.

## Test steps (US-3.2)

File: `e2e/us-3.2.calendar-selection.e2e.js`

1. Connect using a mock iCal link (scripted mode).
2. Toggle a calendar selection.
3. Disconnect and reconnect using the same mock link.
4. Verify the selection is preserved.
5. Connect with a `no-calendars` link and verify the empty-state message.

Expected: Selected calendars persist between sessions and the empty state is shown when none are available.

## Test steps (US-3.3)

File: `e2e/us-3.3.next-class-location.e2e.js`

1. Connect using a mock iCal link (scripted mode).
2. Tap **Directions to my next class** and verify the next-class card shows the event name and a mapped building.
3. Disconnect and reconnect with a `mock-unknown` link.
4. Tap **Directions to my next class**, press **Go**, and verify the fallback alert appears.

Expected: The next event is identified, known locations resolve to buildings, and unknown locations trigger the manual fallback alert.

## Test steps (US-3.4)

File: `e2e/us-3.4.next-class-directions.e2e.js`

1. Connect using a mock iCal link (scripted mode).
2. Tap **Directions to my next class** and verify the next-class card appears.
3. Tap **Go** and verify navigation steps appear and the start is **Your location**.
4. Verify the arrival banner is shown when near the destination.
5. Disconnect and reconnect using a `mock-next` link.
6. Tap **Directions to my next class** and **Go** again.
7. Verify the destination updates to the new class building.

Expected: Directions are generated from the current location, arrival is detected near the destination, and routes update when the next class changes.

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
