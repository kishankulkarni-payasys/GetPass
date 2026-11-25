import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageCode, LANGUAGES, translateText } from './translations';

const LANGUAGE_STORAGE_KEY = 'getpass.mobile.language';

interface LanguageContextValue {
  language: LanguageCode;
  locale: string;
  storageError: string | null;
  setLanguage: (language: LanguageCode) => Promise<void>;
  t: (value: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguageCode(value: string | null): value is LanguageCode {
  return LANGUAGES.some(language => language.code === value);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then(savedLanguage => {
        if (active && isLanguageCode(savedLanguage)) setLanguageState(savedLanguage);
      })
      .catch(() => {
        if (active) setStorageError('Could not load the saved language preference.');
      });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: LanguageCode) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      setLanguageState(nextLanguage);
      setStorageError(null);
    } catch (error) {
      setStorageError('Could not save the language preference. Please try again.');
      throw error;
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: LANGUAGES.find(option => option.code === language)?.locale ?? 'en-IN',
      storageError,
      setLanguage,
      t: text => translateText(text, language),
    }),
    [language, setLanguage, storageError],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider.');
  return context;
}
