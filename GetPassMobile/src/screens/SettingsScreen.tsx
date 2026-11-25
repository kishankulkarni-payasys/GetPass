import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiBaseUrl, getDefaultApiBaseUrl, setApiBaseUrl } from '../config/env';
import { Button, Card, ErrorBanner, FieldLabel, Input, colors } from '../components/ui';
import { Text } from '../components/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, LanguageCode } from '../i18n/translations';
import { raisedSurface } from '../theme/neumorphism';

// Lets the team point a device at a LAN IP (e.g. http://192.168.1.50:8000) without rebuilding,
// using the override already supported by src/config/env.ts.
export default function SettingsScreen() {
  const { language, setLanguage, storageError } = useLanguage();
  const [baseUrl, setBaseUrl] = useState('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getApiBaseUrl().then(setBaseUrl);
  }, []);

  function handleSave() {
    setErrorMessage(null);
    setSavedMessage(null);
    const trimmed = baseUrl.trim();
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setErrorMessage('Enter a full URL, e.g. http://192.168.1.50:8000');
      return;
    }
    setApiBaseUrl(trimmed);
    setSavedMessage('Saved. New requests will use this address.');
  }

  function handleResetDefault() {
    const fallback = getDefaultApiBaseUrl();
    setBaseUrl(fallback);
    setApiBaseUrl(fallback);
    setSavedMessage('Reset to the platform default.');
  }

  function handleLanguageChange(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage).catch(() => undefined);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
    <ScrollView style={styles.flexOne}>
      <Card>
        <Text style={styles.title}>Language</Text>
        <Text style={styles.hint}>Choose the language used throughout the app.</Text>
        <View style={styles.languageOptions}>
          {LANGUAGES.map(option => (
            <TouchableOpacity
              key={option.code}
              accessibilityRole="button"
              accessibilityState={{ selected: language === option.code }}
              style={[styles.languageOption, language === option.code && styles.languageOptionSelected]}
              onPress={() => handleLanguageChange(option.code)}
            >
              <Text style={[styles.languageOptionText, language === option.code && styles.languageOptionTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {storageError ? <ErrorBanner message={storageError} /> : null}
      </Card>

      <Card>
        <Text style={styles.title}>API server address</Text>
        <Text style={styles.hint}>
          Android emulators reach the host machine at 10.0.2.2, not localhost. A real device needs your
          computer's LAN IP address instead (find it with `ipconfig`), on the same Wi-Fi network.
        </Text>

        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        {savedMessage ? <Text style={styles.saved}>{savedMessage}</Text> : null}

        <FieldLabel label="Base URL" />
        <Input
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://10.0.2.2:8000"
        />

        <View style={styles.buttonRow}>
          <Button label="Save" onPress={handleSave} />
        </View>
        <Button label={`Reset to default (${getDefaultApiBaseUrl()})`} variant="secondary" onPress={handleResetDefault} />
      </Card>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.subtext, marginBottom: 12 },
  languageOptions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  languageOption: {
    ...raisedSurface,
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  languageOptionSelected: { backgroundColor: '#fceee6', borderColor: '#e8b99f' },
  languageOptionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  languageOptionTextSelected: { color: colors.primary, fontWeight: '700' },
  saved: { fontSize: 13, color: colors.success, fontWeight: '600', marginBottom: 8 },
  buttonRow: { marginBottom: 10 },
});
