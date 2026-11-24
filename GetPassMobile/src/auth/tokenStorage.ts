import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Secure token storage backed by the OS keystore (Android Keystore / iOS Keychain)
 * via react-native-keychain, so the bearer token never sits in plain-text
 * AsyncStorage on disk. The stored "user" is non-sensitive display data
 * (name/role/etc, no credentials) and stays in AsyncStorage for simplicity.
 */
const KEYCHAIN_SERVICE = 'getpass.accessToken';
// Keychain requires a username; a fixed constant is fine since one device holds one session.
const KEYCHAIN_USERNAME = 'getpass-user';
const USER_KEY = 'getpass.user';

export async function saveToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, { service: KEYCHAIN_SERVICE });
}

export async function getToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  return credentials ? credentials.password : null;
}

export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  await AsyncStorage.removeItem(USER_KEY);
}

export async function saveStoredUser(user: unknown): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser<T = unknown>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}
