import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getEntry } from '../../api/entries';
import { putQualityResult } from '../../api/quality';
import { PassDetailOut } from '../../types/entries';
import { Button, Card, ErrorBanner, FieldLabel, Input, LoadingView, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'QualityResult'>;

interface LineDraft {
  challanLineId: number;
  material: string;
  uom: string;
  challanQty: number;
  acceptedQty: string;
  rejectedQty: string;
  remarks: string;
}

export default function QualityResultScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const [entry, setEntry] = useState<PassDetailOut | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [resultRemarks, setResultRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getEntry(entryId);
      setEntry(data);
      const savedLines = new Map((data.quality?.lines ?? []).map(line => [line.challan_line_id, line]));
      setLines(
        data.challan_lines.map(line => ({
          challanLineId: line.id,
          material: line.material,
          uom: line.uom,
          challanQty: line.quantity,
          acceptedQty: String(savedLines.get(line.id)?.accepted_qty ?? line.quantity),
          rejectedQty: String(savedLines.get(line.id)?.rejected_qty ?? 0),
          remarks: savedLines.get(line.id)?.remarks ?? '',
        })),
      );
      setResultRemarks(data.quality?.remarks ?? '');
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

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function isValidNonNegativeQty(value: string): boolean {
    const parsed = Number(value.trim());
    return value.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;
  }

  const canSubmit =
    lines.length > 0 &&
    lines.every(line => isValidNonNegativeQty(line.acceptedQty) && isValidNonNegativeQty(line.rejectedQty)) &&
    !isSubmitting;

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await putQualityResult(entryId, {
        lines: lines.map(line => ({
          challan_line_id: line.challanLineId,
          accepted_qty: Number(line.acceptedQty),
          rejected_qty: Number(line.rejectedQty),
          remarks: line.remarks.trim() || undefined,
        })),
        remarks: resultRemarks.trim() || undefined,
      });
      navigation.goBack();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not save the quality result.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingView />;
  if (!entry) return <ErrorBanner message={errorMessage ?? 'Pass not found.'} />;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
    <ScrollView style={styles.flexOne}>
      <Card>
        <Text style={styles.title}>{entry.vehicle_number}</Text>
        <Text style={styles.subtitle}>
          {entry.challan_number ? `Challan ${entry.challan_number}` : 'No challan number'} ·{' '}
          {entry.supplier_transporter_name ?? 'No supplier recorded'}
        </Text>
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      </Card>

      {lines.map((line, index) => (
        <Card key={line.challanLineId}>
          <Text style={styles.lineTitle}>{line.material}</Text>
          <Text style={styles.lineSubtitle}>Challan qty: {line.challanQty} {line.uom}</Text>
          <View style={styles.qtyRow}>
            <View style={styles.qtyField}>
              <FieldLabel label="Accepted qty" />
              <Input
                value={line.acceptedQty}
                onChangeText={text => updateLine(index, { acceptedQty: text })}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.qtyField}>
              <FieldLabel label="Rejected qty" />
              <Input
                value={line.rejectedQty}
                onChangeText={text => updateLine(index, { rejectedQty: text })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <FieldLabel label="Remarks" />
          <Input value={line.remarks} onChangeText={text => updateLine(index, { remarks: text })} placeholder="Optional" />
        </Card>
      ))}

      <Card>
        <FieldLabel label="Overall remarks" />
        <Input value={resultRemarks} onChangeText={setResultRemarks} placeholder="Optional" />
        <View style={styles.submitRow}>
          <Button label="Save quality result" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
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
  subtitle: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  lineTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  lineSubtitle: { fontSize: 12, color: colors.subtext, marginBottom: 8 },
  qtyRow: { flexDirection: 'row', gap: 10 },
  qtyField: { flex: 1 },
  submitRow: { marginTop: 12 },
});
