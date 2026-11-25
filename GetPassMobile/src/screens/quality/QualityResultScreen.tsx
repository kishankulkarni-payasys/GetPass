import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useEntryDetail } from '../../queries/useEntryQueries';
import { usePutQualityResult } from '../../queries/useQualityQueries';
import { ErrorBanner, LoadingView } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';

type Props = NativeStackScreenProps<RootStackParamList, 'QualityResult'>;

interface LineDraft {
  challanLineId: number;
  lineNumber: number;
  material: string;
  uom: string;
  challanQty: number;
  acceptedQty: string;
  rejectedQty: string;
  remarks: string;
}

type QualityResult = 'approved' | 'rejected' | 'partial';

const QUANTITY_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;
const QUANTITY_SCALE = 1000;

function isValidQuantity(value: string): boolean {
  return QUANTITY_PATTERN.test(value.trim());
}

function toThousandths(value: string | number): number {
  return Math.round(Number(value) * QUANTITY_SCALE);
}

function deriveQualityResult(lines: LineDraft[]): QualityResult | null {
  if (lines.length === 0 || !lines.every(line => isValidQuantity(line.acceptedQty) && isValidQuantity(line.rejectedQty))) {
    return null;
  }
  if (lines.every(line => toThousandths(line.rejectedQty) === 0)) return 'approved';
  if (lines.every(line => toThousandths(line.acceptedQty) === 0)) return 'rejected';
  return 'partial';
}

function formatResult(result: QualityResult): string {
  return result.toUpperCase();
}

export default function QualityResultScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { data: entry, isLoading, error: loadError } = useEntryDetail(entryId);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [resultRemarks, setResultRemarks] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const putQualityResultMutation = usePutQualityResult();
  const isSubmitting = putQualityResultMutation.isPending;

  useEffect(() => {
    if (!entry || isInitialized) return;
    const savedLines = new Map((entry.quality?.lines ?? []).map(line => [line.challan_line_id, line]));
    setLines(
      entry.challan_lines.map(line => ({
        challanLineId: line.id,
        lineNumber: line.line_no,
        material: line.material,
        uom: line.uom,
        challanQty: line.quantity,
        acceptedQty: String(savedLines.get(line.id)?.accepted_qty ?? line.quantity),
        rejectedQty: String(savedLines.get(line.id)?.rejected_qty ?? 0),
        remarks: savedLines.get(line.id)?.remarks ?? '',
      })),
    );
    setResultRemarks(entry.quality?.remarks ?? '');
    setIsInitialized(true);
  }, [entry, isInitialized]);

  useEffect(() => {
    if (loadError) setErrorMessage(extractErrorMessage(loadError, 'Could not load this pass.'));
  }, [loadError]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const result = useMemo(() => deriveQualityResult(lines), [lines]);
  const canSubmit = result !== null && !isSubmitting;

  async function handleSubmit() {
    setShowErrors(true);
    setErrorMessage(null);
    if (!result || isSubmitting) return;
    try {
      await putQualityResultMutation.mutateAsync({
        entryId,
        payload: {
          lines: lines.map(line => ({
            challan_line_id: line.challanLineId,
            accepted_qty: Number(line.acceptedQty),
            rejected_qty: Number(line.rejectedQty),
            remarks: line.remarks.trim() || undefined,
          })),
          remarks: resultRemarks.trim() || undefined,
        },
      });
      navigation.goBack();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not save the quality result.'));
    }
  }

  if (isLoading) return <LoadingView />;
  if (!entry) return <ErrorBanner message={errorMessage ?? 'Pass not found.'} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Quality result</Text>
            <View style={styles.plate}>
              <Text style={styles.plateText}>{formatPlate(entry.vehicle_number)}</Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close quality result"
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            {entry.supplier_transporter_name || '-'} · PO {entry.po_number || '-'} · Challan {entry.challan_number || '-'}
          </Text>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

          {lines.map((line, index) => {
            const acceptedInvalid = showErrors && !isValidQuantity(line.acceptedQty);
            const rejectedInvalid = showErrors && !isValidQuantity(line.rejectedQty);
            const quantitiesValid = isValidQuantity(line.acceptedQty) && isValidQuantity(line.rejectedQty);
            const quantityMismatch =
              quantitiesValid &&
              toThousandths(line.acceptedQty) + toThousandths(line.rejectedQty) !== toThousandths(line.challanQty);

            return (
              <View key={line.challanLineId} style={styles.lineCard}>
                <Text style={styles.lineTitle}>Line {line.lineNumber} · {line.material}</Text>
                <Text style={styles.challanQty}>
                  Challan qty: <Text style={styles.challanQtyValue}>{line.challanQty} {line.uom}</Text>
                </Text>

                <View style={styles.qtyRow}>
                  <View style={styles.qtyField}>
                    <Text style={styles.fieldLabel}>Accepted ({line.uom})</Text>
                    <TextInput
                      accessibilityLabel={`Line ${line.lineNumber} accepted quantity`}
                      value={line.acceptedQty}
                      onChangeText={text => updateLine(index, { acceptedQty: text })}
                      keyboardType="decimal-pad"
                      maxLength={13}
                      style={[styles.quantityInput, acceptedInvalid && styles.inputInvalid]}
                    />
                    {acceptedInvalid ? <Text style={styles.invalidText}>Enter 0 or more, up to 3 decimals.</Text> : null}
                  </View>
                  <View style={styles.qtyField}>
                    <Text style={styles.fieldLabel}>Rejected ({line.uom})</Text>
                    <TextInput
                      accessibilityLabel={`Line ${line.lineNumber} rejected quantity`}
                      value={line.rejectedQty}
                      onChangeText={text => updateLine(index, { rejectedQty: text })}
                      keyboardType="decimal-pad"
                      maxLength={13}
                      style={[styles.quantityInput, rejectedInvalid && styles.inputInvalid]}
                    />
                    {rejectedInvalid ? <Text style={styles.invalidText}>Enter 0 or more, up to 3 decimals.</Text> : null}
                  </View>
                </View>
                {quantityMismatch ? (
                  <Text style={styles.mismatchText}>
                    Accepted + rejected is {(toThousandths(line.acceptedQty) + toThousandths(line.rejectedQty)) / QUANTITY_SCALE}, the challan says {line.challanQty}.
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>Remarks (optional)</Text>
                <TextInput
                  accessibilityLabel={`Line ${line.lineNumber} remarks`}
                  value={line.remarks}
                  onChangeText={text => updateLine(index, { remarks: text })}
                  maxLength={200}
                  style={styles.remarksInput}
                />
              </View>
            );
          })}

          <View style={styles.resultCard} accessibilityLiveRegion="polite">
            <View style={styles.resultHeading}>
              <Text style={styles.resultTitle}>Result</Text>
              {result ? (
                <View
                  style={[
                    styles.resultBadge,
                    result === 'approved' ? styles.resultApproved : result === 'rejected' ? styles.resultRejected : styles.resultPartial,
                  ]}
                >
                  <Text
                    style={[
                      styles.resultBadgeText,
                      result === 'approved' ? styles.resultApprovedText : result === 'rejected' ? styles.resultRejectedText : styles.resultPartialText,
                    ]}
                  >
                    {formatResult(result)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.waitingResult}>Enter valid quantities</Text>
              )}
            </View>
            <Text style={styles.resultHint}>
              Worked out from the quantities: nothing rejected is approved, nothing accepted is rejected, anything else is partial.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Overall remarks (optional)</Text>
          <TextInput
            accessibilityLabel="Overall remarks"
            value={resultRemarks}
            onChangeText={setResultRemarks}
            maxLength={500}
            multiline
            textAlignVertical="top"
            style={styles.overallRemarks}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.footerButton, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.footerButton, styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Saving...' : entry.quality ? 'Correct result' : 'Record result'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  flexOne: { flex: 1 },
  header: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: '#0f1722',
  },
  headerCopy: { gap: 7 },
  headerEyebrow: { color: '#c4cbd3', fontSize: 11, fontWeight: '600' },
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: '#facc15',
    borderRadius: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  plateText: { color: '#111827', fontFamily: 'monospace', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  closeButton: {
    width: 40,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#3e4650',
    borderRadius: 8,
  },
  closeText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
  content: { paddingHorizontal: 0, paddingTop: 16, paddingBottom: 18 },
  subtitle: { color: '#455363', fontSize: 12, marginBottom: 14, paddingHorizontal: 0 },
  lineCard: {
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 14,
    backgroundColor: '#eef1f5',
  },
  lineTitle: { color: '#171f29', fontSize: 18, fontWeight: '700', marginBottom: 22 },
  challanQty: { color: '#526171', fontSize: 11, marginBottom: 12 },
  challanQtyValue: { color: '#253244', fontWeight: '600' },
  qtyRow: { flexDirection: 'row', gap: 14 },
  qtyField: { flex: 1, minWidth: 0 },
  fieldLabel: { color: '#526171', fontSize: 11, marginBottom: 5, marginTop: 4 },
  quantityInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 7,
    paddingHorizontal: 12,
    color: '#17202b',
    fontSize: 14,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  inputInvalid: { borderColor: '#c0392b' },
  invalidText: { color: '#a83227', fontSize: 10, marginTop: 3 },
  mismatchText: { color: '#80600f', fontSize: 11, marginTop: 8 },
  remarksInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#17202b',
    backgroundColor: 'transparent',
  },
  resultCard: { backgroundColor: '#f8f9fa', borderRadius: 11, padding: 14, marginBottom: 16 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultTitle: { color: '#171f29', fontSize: 13, fontWeight: '700' },
  resultBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  resultApproved: { backgroundColor: '#e3f4ea' },
  resultPartial: { backgroundColor: '#fff1d6' },
  resultRejected: { backgroundColor: '#fde7e5' },
  resultBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  resultApprovedText: { color: '#237347' },
  resultPartialText: { color: '#94620d' },
  resultRejectedText: { color: '#a83227' },
  waitingResult: { color: '#526171', fontSize: 11 },
  resultHint: { color: '#526171', fontSize: 11, lineHeight: 16, marginTop: 5 },
  overallRemarks: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#17202b',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#dce2e8',
    backgroundColor: '#fff',
  },
  footerButton: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cancelButton: { borderWidth: 1, borderColor: '#cbd2da', backgroundColor: '#fff' },
  cancelButtonText: { color: '#263342', fontSize: 13, fontWeight: '700' },
  submitButton: { backgroundColor: '#a73508' },
  submitButtonDisabled: { opacity: 0.55 },
  submitButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
