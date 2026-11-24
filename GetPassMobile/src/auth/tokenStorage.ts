import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Baseline token storage using AsyncStorage, as suggested by the team for the first pass.
 * AsyncStorage is unencrypted on disk — before shipping, swap this for react-native-keychain
 * (or EncryptedSharedPreferences/Keychain-backed storage) to keep the bearer token out of
 * plain-text device storage.
 */
const TOKEN_KEY = 'getpass.accessToken';
const USER_KEY = 'getpass.user';

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeMany([TOKEN_KEY, USER_KEY]);
}

export async function saveStoredUser(user: unknown): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser<T = unknown>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}
