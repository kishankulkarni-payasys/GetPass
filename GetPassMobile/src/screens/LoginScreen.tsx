import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

// Mirrors Frontend/src/pages/LoginPage.jsx and its .login-* styles in
// Frontend/src/index.css, adapted to native primitives and a single-column
// phone layout (the web app's own sub-992px breakpoint also collapses to one
// column and hides the feature checkmarks list there). Copy strings are taken
// verbatim from Frontend/src/i18n/strings/login.js (English only — the web app's
// language switcher relies on LanguageContext, which the mobile app doesn't have,
// so it's omitted here rather than wired up as non-functional UI).
const COPY = {
  headerLabel: 'Secure access portal',
  kicker: 'Gate operations, simplified',
  headlineLine1: 'Every arrival.',
  headlineLine2: 'Accounted for.',
  intro: 'One secure workspace for vehicle entry, site operations, and weighbridge teams.',
  featureRecords: 'Clear vehicle entry records',
  featureWeighbridge: 'Connected weighbridge workflow',
  eyebrow: 'Welcome back',
  title: 'Sign in to GatePass',
  copy: 'Enter your work credentials to continue.',
  labelUsername: 'Username',
  labelPassword: 'Password',
  placeholderUsername: 'Your username',
  placeholderPassword: 'Your password',
  signingIn: 'Signing in...',
  signInSecurely: 'Sign in securely',
  secureNote: 'Secure access for authorized team members',
  footerTagline: 'Site operations platform',
};

// Color tokens lifted from Frontend/src/index.css (--gp-* custom properties)
// so the mobile screen matches the web app's palette exactly.
const PALETTE = {
  control: '#0e1620',
  onControl: '#c4d0db',
  onControlMuted: '#9fb0bf',
  accent: '#e85d1f',
  accentInk: '#b8410e',
  accentStrong: '#9a360b',
  accentWash: '#fceee6',
  focus: '#f3b48e',
  surface: '#fff',
  ink: '#131a22',
  ink2: '#44515f',
  line: '#dce2e8',
  line2: '#e8ecf0',
  checkWash: 'rgba(232, 93, 31, 0.18)',
};

function extractErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.length > 0) return detail;
  return 'Unable to sign in. Check your connection and try again.';
}

function FeatureRow({ label }: { label: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureCheck}>
        <Text style={styles.featureCheckText}>{'✓'}</Text>
      </View>
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>G</Text>
            </View>
            <Text style={styles.brandText}>
              Gate<Text style={styles.brandTextAccent}>Pass</Text>
            </Text>
          </View>
          <Text style={styles.headerLabel}>{COPY.headerLabel}</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.kicker}>{COPY.kicker}</Text>
          <Text style={styles.headline}>
            {COPY.headlineLine1}
            {'\n'}
            <Text style={styles.headlineAccent}>{COPY.headlineLine2}</Text>
          </Text>
          <Text style={styles.introText}>{COPY.intro}</Text>
          <View style={styles.featureList}>
            <FeatureRow label={COPY.featureRecords} />
            <FeatureRow label={COPY.featureWeighbridge} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>{'🛡'}</Text>
          </View>
          <Text style={styles.cardEyebrow}>{COPY.eyebrow}</Text>
          <Text style={styles.cardTitle}>{COPY.title}</Text>
          <Text style={styles.cardCopy}>{COPY.copy}</Text>

          <View style={styles.form}>
            <Text style={styles.fieldLabel}>{COPY.labelUsername}</Text>
            <TextInput
              style={styles.input}
              placeholder={COPY.placeholderUsername}
              placeholderTextColor="#9aa6b1"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              editable={!isSubmitting}
            />
            <Text style={styles.fieldLabel}>{COPY.labelPassword}</Text>
            <TextInput
              style={styles.input}
              placeholder={COPY.placeholderPassword}
              placeholderTextColor="#9aa6b1"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
              onSubmitEditing={handleSubmit}
            />

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.submit, !canSubmit && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitText}>{COPY.signInSecurely}</Text>
                  <Text style={styles.submitArrow}>{'→'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.secureNote}>
            <Text style={styles.secureNoteIcon}>{'🔒'}</Text>
            <Text style={styles.secureNoteText}>{COPY.secureNote}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>GatePass</Text>
          <Text style={styles.footerSeparator}>{'•'}</Text>
          <Text style={styles.footerTagline}>{COPY.footerTagline}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.control },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PALETTE.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  brandText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  brandTextAccent: { color: PALETTE.accent },
  headerLabel: {
    color: PALETTE.onControlMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  intro: { marginTop: 36, marginBottom: 28 },
  kicker: {
    color: PALETTE.onControlMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headline: { color: '#fff', fontSize: 34, fontWeight: '700', letterSpacing: -1, lineHeight: 38, marginTop: 10, marginBottom: 14 },
  headlineAccent: { color: PALETTE.focus },
  introText: { color: PALETTE.onControl, fontSize: 15, lineHeight: 23 },
  featureList: { marginTop: 20, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PALETTE.checkWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCheckText: { color: PALETTE.focus, fontSize: 11, fontWeight: '700' },
  featureText: { color: PALETTE.onControl, fontSize: 13 },
  card: {
    backgroundColor: PALETTE.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 20,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: PALETTE.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardIconText: { fontSize: 20 },
  cardEyebrow: {
    color: PALETTE.accentInk,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardTitle: { color: PALETTE.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  cardCopy: { color: PALETTE.ink2, fontSize: 13, marginTop: 6, marginBottom: 18 },
  form: { gap: 6 },
  fieldLabel: { color: PALETTE.ink2, fontSize: 12, fontWeight: '600', marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: PALETTE.ink,
  },
  error: { color: '#c0392b', fontSize: 13, marginTop: 4 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.accentInk,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  submitArrow: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: PALETTE.line2,
    marginTop: 18,
    paddingTop: 14,
  },
  secureNoteIcon: { fontSize: 12 },
  secureNoteText: { color: PALETTE.ink2, fontSize: 11, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 6 },
  footerBrand: { color: PALETTE.onControlMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  footerSeparator: { color: PALETTE.accent, fontSize: 10 },
  footerTagline: { color: PALETTE.onControlMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});
