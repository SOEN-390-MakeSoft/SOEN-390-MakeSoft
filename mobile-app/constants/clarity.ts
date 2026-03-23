const clarityProjectId = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID?.trim();

export const CLARITY_PROJECT_ID = clarityProjectId ? clarityProjectId : null;
export const CLARITY_ENABLE_VERBOSE_LOGGING = __DEV__;
