import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { forgotPassword, resetPassword } from '../api/auth';
import { Button, Card, FieldLabel, Input, colors } from '../components/ui';
import { Text } from '../components/LocalizedText';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

// Two steps in one screen/flow rather than two stack routes: there is no state
// worth round-tripping through navigation params (the identifier is only used to
// fire the request, and the token is typed fresh by the user from whatever the
// delivery channel showed them), so a local step enum keeps this simple.
// EMAIL_PROVIDER=none in this environment, so there's no real email delivery yet
// (see Backend/app/routers/auth.py) - the token/code entry field here is built as
// if delivery works. Flag to Hinata if that gap blocks a planned release.
type Step = 'identifier' | 'resetCode';

const COPY = {
  identifierTitle: 'Reset your password',
  identifierIntro: "Enter your username, email, or mobile number and we'll send you a reset code.",
  labelIdentifier: 'Username, Email or Mobile Number',
  placeholderIdentifier: 'Username, email, or mobile number',
  submitIdentifier: 'Send reset code',
  submittingIdentifier: 'Sending...',
  ackMessage: 'If that account exists, a reset code has been sent.',
  resetTitle: 'Enter reset code',
  resetIntro: 'Enter the reset code you received along with your new password.',
  labelResetCode: 'Reset code',
  placeholderResetCode: 'Reset code',
  labelNewPassword: 'New password',
  placeholderNewPassword: 'New password',
  labelConfirmPassword: 'Confirm new password',
  placeholderConfirmPassword: 'Confirm new password',
  submitReset: 'Reset password',
  submittingReset: 'Resetting...',
  passwordsDoNotMatch: 'Passwords do not match',
  backToSignIn: 'Back to Sign In',
};

function extractErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.length > 0) return detail;
  if ((error as { request?: unknown })?.request) {
    return 'Cannot reach the server. Check that your phone and computer are on the same Wi-Fi network.';
  }
  return 'Something went wrong. Please try again.';
}

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ackMessage, setAckMessage] = useState<string | null>(null);

  async function handleSendCode() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(identifier.trim());
      // The backend always answers with the same generic ack regardless of whether
      // the account exists, so it never tells us; show our own copy and move on.
      setAckMessage(COPY.ackMessage);
      setStep('resetCode');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword() {
    setErrorMessage(null);
    if (newPassword !== confirmPassword) {
      setErrorMessage(COPY.passwordsDoNotMatch);
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(resetCode.trim(), newPassword);
      navigation.navigate('Login');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSendCode = identifier.trim().length > 0 && !isSubmitting;
  const canResetPassword =
    resetCode.trim().length > 0 && newPassword.length > 0 && confirmPassword.length > 0 && !isSubmitting;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {step === 'identifier' ? (
            <Card>
              <Text style={styles.title}>{COPY.identifierTitle}</Text>
              <Text style={styles.intro}>{COPY.identifierIntro}</Text>

              <FieldLabel label={COPY.labelIdentifier} />
              <Input
                placeholder={COPY.placeholderIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                value={identifier}
                onChangeText={setIdentifier}
                editable={!isSubmitting}
                onSubmitEditing={handleSendCode}
              />

              {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

              <View style={styles.buttonSpacing}>
                <Button
                  label={isSubmitting ? COPY.submittingIdentifier : COPY.submitIdentifier}
                  onPress={handleSendCode}
                  disabled={!canSendCode}
                  loading={isSubmitting}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.title}>{COPY.resetTitle}</Text>
              {ackMessage ? <Text style={styles.ack}>{ackMessage}</Text> : null}
              <Text style={styles.intro}>{COPY.resetIntro}</Text>

              <FieldLabel label={COPY.labelResetCode} />
              <Input
                placeholder={COPY.placeholderResetCode}
                autoCapitalize="none"
                autoCorrect={false}
                value={resetCode}
                onChangeText={setResetCode}
                editable={!isSubmitting}
              />

              <FieldLabel label={COPY.labelNewPassword} />
              <Input
                placeholder={COPY.placeholderNewPassword}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!isSubmitting}
              />

              <FieldLabel label={COPY.labelConfirmPassword} />
              <Input
                placeholder={COPY.placeholderConfirmPassword}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isSubmitting}
                onSubmitEditing={handleResetPassword}
              />

              {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

              <View style={styles.buttonSpacing}>
                <Button
                  label={isSubmitting ? COPY.submittingReset : COPY.submitReset}
                  onPress={handleResetPassword}
                  disabled={!canResetPassword}
                  loading={isSubmitting}
                />
              </View>
            </Card>
          )}

          <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('Login')} disabled={isSubmitting}>
            <Text style={styles.backLinkText}>{COPY.backToSignIn}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 32, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  intro: { color: colors.subtext, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  ack: { color: colors.success, fontSize: 13, marginBottom: 8 },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  buttonSpacing: { marginTop: 16 },
  backLink: { alignItems: 'center', marginTop: 20, padding: 4 },
  backLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
