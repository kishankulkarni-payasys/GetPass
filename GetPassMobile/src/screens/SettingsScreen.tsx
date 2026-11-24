import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getApiBaseUrl, getDefaultApiBaseUrl, setApiBaseUrl } from '../config/env';
import { Button, Card, ErrorBanner, FieldLabel, Input, colors } from '../components/ui';

// Lets the team point a device at a LAN IP (e.g. http://192.168.1.50:8000) without rebuilding,
// using the override already supported by src/config/env.ts.
export default function SettingsScreen() {
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

  return (
    <ScrollView style={styles.screen}>
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.subtext, marginBottom: 12 },
  saved: { fontSize: 13, color: colors.success, fontWeight: '600', marginBottom: 8 },
  buttonRow: { marginBottom: 10 },
});
