import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * API host configuration.
 *
 * - Android emulator cannot reach the host machine via `localhost` — it must use
 *   the special alias `10.0.2.2`, which maps to the host's loopback interface.
 * - iOS simulator shares the host's network namespace, so `localhost` works directly.
 * - A real device (either platform) needs the host machine's LAN IP instead of
 *   either of the above, so the default is overridable at runtime without a rebuild.
 */
const DEFAULT_PORT = 8000;

const DEFAULT_HOST_BY_PLATFORM: Record<string, string> = {
  android: '10.0.2.2',
  ios: 'localhost',
};

const STORAGE_KEY = 'getpass.apiBaseUrl';

function buildDefaultBaseUrl(): string {
  const host = DEFAULT_HOST_BY_PLATFORM[Platform.OS] ?? 'localhost';
  return `http://${host}:${DEFAULT_PORT}`;
}

let cachedBaseUrl: string | null = null;

/** Resolves the API base URL: a user-set override (if any) wins, else the platform default. */
export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cachedBaseUrl = stored?.trim() || buildDefaultBaseUrl();
  } catch {
    // Storage unavailable (e.g. first launch race) — fall back to the computed default.
    cachedBaseUrl = buildDefaultBaseUrl();
  }
  return cachedBaseUrl;
}

/** Lets a settings screen point the app at a different host (e.g. a LAN IP for a real device). */
export async function setApiBaseUrl(baseUrl: string): Promise<void> {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  cachedBaseUrl = trimmed;
  await AsyncStorage.setItem(STORAGE_KEY, trimmed);
}

export function getDefaultApiBaseUrl(): string {
  return buildDefaultBaseUrl();
}
