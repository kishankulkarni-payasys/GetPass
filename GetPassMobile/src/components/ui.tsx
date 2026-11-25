import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { background, insetSurfaceStyle, raisedSurface } from '../theme/neumorphism';
import { Text, TextInput } from './LocalizedText';

// Shared visual language for the GetPass mobile screens.
export const colors = {
  background,
  card: background,
  border: '#d8e0ea',
  text: '#17202b',
  subtext: '#526171',
  muted: '#718096',
  primary: '#b8410e',
  danger: '#c0392b',
  success: '#1e8e5a',
  warn: '#b8860b',
};

export function ScreenContainer({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function LoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ label, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.button, buttonVariantStyles[variant], isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#999" />;
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof pillTones }) {
  return (
    <View style={[styles.pill, pillTones[tone]]}>
      <Text style={[styles.pillText, tone === 'neutral' ? null : styles.pillTextOnColor]}>{label}</Text>
    </View>
  );
}

const pillTones = StyleSheet.create({
  neutral: { backgroundColor: colors.background },
  good: { backgroundColor: colors.success },
  warn: { backgroundColor: colors.warn },
  crit: { backgroundColor: colors.danger },
  info: { backgroundColor: '#2d6cdf' },
});

const buttonVariantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary, shadowColor: '#8f3510', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  secondary: { ...raisedSurface, borderColor: '#d8e0ea' },
  danger: { backgroundColor: colors.danger, shadowColor: '#6f2424', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 14 },
  errorBanner: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorText: { color: colors.danger, fontSize: 14 },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonTextSecondary: { color: colors.primary },
  card: {
    ...raisedSurface,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 6, marginTop: 10 },
  input: {
    ...insetSurfaceStyle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text },
  pillTextOnColor: { color: '#fff' },
});
