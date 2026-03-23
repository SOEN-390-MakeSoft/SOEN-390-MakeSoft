# Microsoft Clarity Setup

## What changed

- Added `@microsoft/react-native-clarity` and `expo-dev-client`.
- Added a native-only Clarity bootstrap in `app/_layout.tsx`.
- Added `services/clarity/index.native.ts` for Android/iOS and a no-op `services/clarity/index.ts` fallback for web.
- Added `constants/clarity.ts` so the Clarity project ID comes from one place.
- Added `eas.json` with a `development` profile for EAS development builds.
- Added masking-friendly `testID`s for calendar event lists and next-class details.

## Where to put the Clarity project ID

Add this to `mobile-app/.env`:

```bash
EXPO_PUBLIC_CLARITY_PROJECT_ID=your_clarity_project_id
```

The example placeholder lives in `mobile-app/.env.example`.

If the value is missing, the app stays functional and logs a warning instead of crashing.

## How to run with a development build

Clarity does not work in Expo Go because it requires native code.

### Local Android development build

```bash
cd mobile-app
npm install
npm run android:dev
npm run start:dev-client
```

### Local iOS development build

Run this on macOS only:

```bash
cd mobile-app
npm install
npx expo prebuild --platform ios
npm run ios:dev
npm run start:dev-client
```

### EAS development build

```bash
cd mobile-app
npm install
npx eas build --profile development --platform android
npx eas build --profile development --platform ios
npm run start:dev-client
```

Notes:

- The repo already contains `android/`, so Android can be built locally without running `expo prebuild`.
- `ios/` is not checked in right now. Generate it with `npx expo prebuild --platform ios` before a local iOS build.
- Any time you add or update native libraries, you need a new native build.

## How to verify capture

1. Start a development build, not Expo Go.
2. Open the app and navigate across a few screens.
3. In a dev build, Clarity logs `Session started: <id>` once the session begins.
4. Check the Clarity dashboard for live or in-progress recordings.
5. Complete sessions can take up to about 2 hours to fully appear.

The app reports Expo Router path names as Clarity screen names:

- `index`
- `Map`
- `menu`
- `google-calendar-instructions`

## Privacy-safe defaults and masking guidance

This implementation intentionally does **not** set custom user IDs, session IDs, or custom tags.

Recommended dashboard masking/disallow rules for usability testing:

- Mask `#calendar-link-input` because it contains the user's secret Google Calendar iCal URL.
- Mask `#calendar-events-list` because it contains course names, times, and locations.
- Mask `#next-class-card` because it surfaces upcoming class schedule details on the map screen.
- Mask `#next-class-sensitive` because it shows course, building, room, and timing details in the modal.
- Mask `#map-search-input` and `#map-search-results` if testers may search for personally meaningful locations or room destinations.
- Mask `#room-info-bubble` if room selections could identify a student's schedule or destination.

Sensitive surfaces found in this app:

- `components/CalendarModal.tsx`: secret iCal input plus upcoming events.
- `components/NextClassModal.tsx`: next class course/building/room/time details.
- `components/MapScreen.tsx`: next-class summary card.
- `components/SearchBar.tsx`: building and room search input/results.
- `components/indoor/RoomInfoBubble.tsx`: selected room details.

I did not find dedicated profile, grades, or account-management screens in the current mobile app code. The main privacy exposure is schedule and destination data.

## Expo limitations and caveats

- Expo Go is not supported for Clarity.
- Web remains supported because the web bundle resolves to a no-op Clarity service.
- If Clarity is initialized inside Expo Go by accident, the app now warns and skips the SDK instead of trying to use the native module.
- For iOS, native pods are handled as part of the generated native project/build flow.
