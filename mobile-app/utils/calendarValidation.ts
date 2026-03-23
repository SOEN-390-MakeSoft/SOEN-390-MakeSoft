/**
 * Returns true if the user has a valid Classes calendar connected.
 * The app requires a connected calendar (named "Classes" per setup instructions).
 */
export function isClassesCalendarValid(isConnected: boolean): boolean {
  if (process.env.EXPO_PUBLIC_E2E_CALENDAR_MODE) {
    return true;
  }
  return isConnected;
}
