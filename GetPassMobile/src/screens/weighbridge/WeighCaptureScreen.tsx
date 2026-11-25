import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getEntry } from '../../api/entries';
import { captureWeighment, readIndicator } from '../../api/weighments';
import { PassDetailOut, WeighmentKind, WeightUnit } from '../../types/entries';
import { Button, Card, ErrorBanner, FieldLabel, Input, LoadingView, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'WeighCapture'>;

const KIND_OPTIONS: { value: WeighmentKind; label: string }[] = [
  { value: 'gross', label: 'Gross (loaded)' },
  { value: 'tare', label: 'Tare (empty)' },
];

export default function WeighCaptureScreen({ route }: Props) {
  const { entryId, vehicleNumber, kind: initialKind = 'gross' } = route.params;
  const [entry, setEntry] = useState<PassDetailOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kind, setKind] = useState<WeighmentKind>(initialKind);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [manualReason, setManualReason] = useState('');
  const [supersedeReason, setSupersedeReason] = useState('');
  const [indicatorMessage, setIndicatorMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setEntry(await getEntry(entryId));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load this pass.'));
    } finally {
      setIsLoading(false);
    }
  }, [entryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasExisting = kind === 'gross' ? entry?.current_gross_kg != null : entry?.current_tare_kg != null;

  async function tryIndicator() {
    setIndicatorMessage(null);
    try {
      const reading = await readIndicator();
      if (!reading.available) {
        setIndicatorMessage('No weighbridge indicator is configured here. Enter the weight manually.');
        return;
      }
      if (reading.weight_kg != null) {
        setWeight(String(reading.weight_kg));
        setUnit('kg');
      }
      setIndicatorMessage(reading.stable ? 'Indicator reading loaded.' : 'Reading is not stable yet; re-check before capturing.');
    } catch (error) {
      setIndicatorMessage(extractErrorMessage(error, 'Could not read the indicator.'));
    }
  }

  const canSubmit =
    weight.trim().length > 0 &&
    manualReason.trim().length >= 3 &&
    (!hasExisting || supersedeReason.trim().length >= 3) &&
    !isCapturing;

  async function handleCapture() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsCapturing(true);
    try {
      await captureWeighment(entryId, {
        kind,
        source: 'manual',
        weight: Number(weight),
        unit,
        manual_reason: manualReason.trim(),
        supersede_reason: hasExisting ? supersedeReason.trim() : undefined,
      });
      setSuccessMessage(`${kind === 'gross' ? 'Gross' : 'Tare'} weight captured for ${vehicleNumber}.`);
      setWeight('');
      setManualReason('');
      setSupersedeReason('');
      await load();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not capture the weight.'));
    } finally {
      setIsCapturing(false);
    }
  }

  if (isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
    <ScrollView style={styles.flexOne}>
      <Card>
        <Text style={styles.title}>{vehicleNumber}</Text>
        <Text style={styles.subtitle}>
          Current gross: {entry?.current_gross_kg ?? '—'} kg · Current tare: {entry?.current_tare_kg ?? '—'} kg
        </Text>

        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

        <FieldLabel label="Weighment kind" />
        <View style={styles.segmented}>
          {KIND_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, kind === option.value && styles.segmentActive]}
              onPress={() => setKind(option.value)}
            >
              <Text style={[styles.segmentText, kind === option.value && styles.segmentTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={tryIndicator} style={styles.indicatorLink}>
          <Text style={styles.link}>Try reading the weighbridge indicator</Text>
        </TouchableOpacity>
        {indicatorMessage ? <Text style={styles.indicatorMessage}>{indicatorMessage}</Text> : null}

        <FieldLabel label="Weight *" />
        <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 18500" />

        <FieldLabel label="Unit" />
        <View style={styles.segmented}>
          {(['kg', 'ton'] as WeightUnit[]).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.segment, unit === option && styles.segmentActive]}
              onPress={() => setUnit(option)}
            >
              <Text style={[styles.segmentText, unit === option && styles.segmentTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel label="Reason for manual entry * (min 3 characters)" />
        <Input value={manualReason} onChangeText={setManualReason} placeholder="e.g. Indicator offline" />

        {hasExisting ? (
          <>
            <FieldLabel label={`Reason for re-capturing the ${kind} weight * (min 3 characters)`} />
            <Input value={supersedeReason} onChangeText={setSupersedeReason} placeholder="Why this reading is being corrected" />
          </>
        ) : null}

        <View style={styles.submitRow}>
          <Button label="Capture weight" onPress={handleCapture} disabled={!canSubmit} loading={isCapturing} />
        </View>
      </Card>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.subtext, marginTop: 4, marginBottom: 8 },
  segmented: { flexDirection: 'row', backgroundColor: '#eee', borderRadius: 8, padding: 4, marginBottom: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.subtext },
  segmentTextActive: { color: '#fff' },
  indicatorLink: { marginTop: 10, marginBottom: 2 },
  link: { color: colors.primary, fontWeight: '600' },
  indicatorMessage: { fontSize: 12, color: colors.subtext, marginBottom: 6 },
  submitRow: { marginTop: 20 },
  successBanner: { backgroundColor: '#e8f6ee', borderRadius: 8, padding: 12, marginBottom: 12 },
  successText: { color: colors.success, fontWeight: '600' },
});
