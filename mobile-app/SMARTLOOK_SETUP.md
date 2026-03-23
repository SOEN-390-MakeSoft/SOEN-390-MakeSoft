# Smartlook Setup and Run Guide

This guide explains how to run Smartlook session recording in this project.

## Current integration in this repo

- Package: `react-native-smartlook-analytics`
- Initialization: `app/_layout.tsx`
- Env key: `EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY`
- New architecture: enabled (`newArchEnabled=true`)

## 1) One-time setup

From `mobile-app/` run:

```bash
cd mobile-app
npm install
npm install react-native-smartlook-analytics
```

Do not install `smartlook-react-native-wrapper` in this project.

Set the Smartlook project key in `mobile-app/.env`:

```env
EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY=your_project_key_here
```

## 2) Build and run commands (Android)

Use these commands in order:

```bash
cd mobile-app
npx expo run:android
npm start
```

Then press `a` in the Metro terminal (or open the installed app on the emulator/device).

## 3) Verify Smartlook is recording

1. Open Smartlook dashboard.
2. Go to `Sessions`.
3. Use app for 1-3 minutes.
4. You should see a session in `Active sessions`.
5. Close/background app, wait 30-120 seconds, then check `Completed sessions`.

## 4) Stop/start recording manually (optional)

If needed in code:

```ts
await Smartlook.instance.stop();
await Smartlook.instance.start();
```

## 5) Common issues and fixes

### A) "Cannot read property ... of null"

Cause: app opened in a runtime without native module loaded.

Fix:

```bash
npx expo run:android
npm start
```

Make sure you run the installed dev build app, not a stale runtime.

### B) Gradle cannot resolve Smartlook artifacts

This repo already includes Smartlook Maven repository in `android/build.gradle`:

`https://sdk.smartlook.com/android/release`

If build cache is stale:

```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

On Windows PowerShell, use:

```powershell
cd android
.\gradlew clean
cd ..
npx expo run:android
```

### C) Build fails in `react-native-smartlook-analytics` Kotlin

There is a compatibility patch applied inside `node_modules` for:

`node_modules/react-native-smartlook-analytics/android/src/turbo/SmartlookSensitivityViewManager.kt`

If dependencies are reinstalled and build fails again, re-apply this guard in `receiveCommand`:

```kotlin
if (commandId == null || args == null) {
    return
}
delegate.receiveCommand(view, commandId, args)
```

## 6) Team workflow recommendation

- Keep `EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY` in local `.env` only.
- Do not commit private project keys.
- Use a dedicated Smartlook project for usability testing if you want relaxed masking.
