import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Quick notes:
// Android emulator: use 10.0.2.2 -> maps to host machine's localhost
// iOS simulator: use localhost -> shares host network
// Physical devices: use your PC's LAN IP (set in mobile-app/env.local as REACT_NATIVE_PACKAGER_HOSTNAME or EXPO_PUBLIC_PC_IP)

// Read host Expo extra;
// fall back to emulator/simulator host when running in emulators.
const envHost = ((Constants?.expoConfig || (Constants as any).manifest || {}).extra?.PC_IP) ||  undefined;

const ANDROID_EMULATOR_HOST = '10.0.2.2:8081';
const IOS_SIMULATOR_HOST = 'localhost:8081';

// normalize env host (append :8081 if missing)
const normalizedEnvHost = typeof envHost === 'string' && envHost.length > 0
  ? (envHost.includes(':') ? envHost : `${envHost}:8081`)
  : undefined;

const host = (() => {
  const isDevice = Constants?.isDevice ?? false;

  if (normalizedEnvHost && (Platform.OS === 'ios' || isDevice)) {
    return normalizedEnvHost;
  }
  if (Platform.OS === 'android' && !isDevice) return ANDROID_EMULATOR_HOST;
  if (Platform.OS === 'ios' && !isDevice) return IOS_SIMULATOR_HOST;
  // Fallback: env host if present, otherwise localhost:8081
  return normalizedEnvHost ?? 'localhost:8081';
})();

// DEBUG: show the final chosen host
// console.log('DEBUG: selected API host =', host);

export const API_BASE_URL = `http://${host}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const testConnection = async () => {
  try {
    console.log('Attempting to connect to:', API_BASE_URL);
    const response = await api.get('/health');
    console.log('API Response:', response.data);

    return { success: true, data: response.data };
  } catch (error) {
    console.log('Full error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('Error message:', errorMessage);

    return { success: false, error: errorMessage };
  }
};

export default api;
