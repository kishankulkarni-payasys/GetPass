import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { approveGrn, editGrnLines, getGrn, retryGrnPost } from '../../api/grn';
import { GrnOut } from '../../types/grn';
import { Button, Card, ErrorBanner, FieldLabel, Input, LoadingView, Pill, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'GrnDetail'>;

interface LineDraft {
  id: number;
  receivedQty: string;
  acceptedQty: string;
  rejectedQty: string;
  remarks: string;
}

export default function GrnDetailScreen({ route }: Props) {
  const { entryId } = route.params;
  const [grn, setGrn] = useState<GrnOut | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getGrn(entryId);
      setGrn(data);
      setLines(
        data.lines.map(line => ({
          id: line.id,
          receivedQty: String(line.received_qty),
          acceptedQty: String(line.accepted_qty),
          rejectedQty: String(line.rejected_qty),
          remarks: line.remarks ?? '',
        })),
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load the GRN.'));
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

  const isDraft = grn?.status === 'draft';

  async function handleSaveLines() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);
    try {
      await editGrnLines(entryId, {
        lines: lines.map(line => ({
          id: line.id,
          received_qty: Number(line.receivedQty),
          accepted_qty: Number(line.acceptedQty),
          rejected_qty: Number(line.rejectedQty),
          remarks: line.remarks.trim() || undefined,
        })),
      });
      setSuccessMessage('Quantities saved.');
      await load();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not save the GRN lines.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApprove() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsApproving(true);
    try {
      await approveGrn(entryId);
      setSuccessMessage('GRN approved.');
      await load();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not approve the GRN.'));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRetryPost() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsApproving(true);
    try {
      await retryGrnPost(entryId);
      setSuccessMessage('ERP post retried.');
      await load();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not retry the ERP post.'));
    } finally {
      setIsApproving(false);
    }
  }

  if (isLoading) return <LoadingView />;
  if (!grn) return <ErrorBanner message={errorMessage ?? 'GRN not found.'} />;

  return (
    <ScrollView style={styles.screen}>
      <Card>
        <View style={styles.header}>
          <Text style={styles.title}>GRN for pass #{grn.entry_id}</Text>
          <Pill label={grn.status} tone={grn.status === 'approved' ? 'good' : 'warn'} />
        </View>
        <Text style={styles.subtext}>ERP status: {grn.erp_status ?? '—'}</Text>
        {grn.erp_last_error ? <Text style={styles.errorText}>{grn.erp_last_error}</Text> : null}
        {grn.current_user_weighed ? (
          <Text style={styles.warnText}>You captured a weighment on this pass and cannot approve its GRN.</Text>
        ) : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      </Card>

      {lines.map((line, index) => {
        const source = grn.lines[index];
        return (
          <Card key={line.id}>
            <Text style={styles.lineTitle}>{source.material}</Text>
            <Text style={styles.lineSubtitle}>
              Challan qty: {source.challan_qty} {source.uom}
              {source.quality_accepted_qty != null ? ` · Quality accepted: ${source.quality_accepted_qty}` : ''}
            </Text>
            <View style={styles.qtyRow}>
              <View style={styles.qtyField}>
                <FieldLabel label="Received" />
                <Input
                  value={line.receivedQty}
                  onChangeText={text => updateLine(index, { receivedQty: text })}
                  keyboardType="decimal-pad"
                  editable={isDraft}
                />
              </View>
              <View style={styles.qtyField}>
                <FieldLabel label="Accepted" />
                <Input
                  value={line.acceptedQty}
                  onChangeText={text => updateLine(index, { acceptedQty: text })}
                  keyboardType="decimal-pad"
                  editable={isDraft}
                />
              </View>
              <View style={styles.qtyField}>
                <FieldLabel label="Rejected" />
                <Input
                  value={line.rejectedQty}
                  onChangeText={text => updateLine(index, { rejectedQty: text })}
                  keyboardType="decimal-pad"
                  editable={isDraft}
                />
              </View>
            </View>
            {source.flags.length > 0 ? <Text style={styles.flagText}>{source.flags.join(', ')}</Text> : null}
            <FieldLabel label="Remarks" />
            <Input
              value={line.remarks}
              onChangeText={text => updateLine(index, { remarks: text })}
              placeholder="Optional"
              editable={isDraft}
            />
          </Card>
        );
      })}

      <Card>
        {isDraft ? (
          <View style={styles.actionRow}>
            <Button label="Save quantities" variant="secondary" onPress={handleSaveLines} loading={isSaving} />
          </View>
        ) : null}
        {isDraft ? (
          <View style={styles.actionRow}>
            <Button
              label="Approve GRN"
              onPress={handleApprove}
              loading={isApproving}
              disabled={grn.current_user_weighed}
            />
          </View>
        ) : null}
        {grn.status === 'approved' && (grn.erp_status === 'pending' || grn.erp_status === 'failed') ? (
          <View style={styles.actionRow}>
            <Button label="Retry ERP post" onPress={handleRetryPost} loading={isApproving} />
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtext: { fontSize: 13, color: colors.subtext },
  errorText: { fontSize: 12, color: colors.danger, marginTop: 4 },
  warnText: { fontSize: 12, color: colors.warn, marginTop: 6 },
  successText: { fontSize: 13, color: colors.success, marginTop: 6, fontWeight: '600' },
  lineTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  lineSubtitle: { fontSize: 12, color: colors.subtext, marginBottom: 8 },
  qtyRow: { flexDirection: 'row', gap: 8 },
  qtyField: { flex: 1 },
  flagText: { fontSize: 11, color: colors.warn, marginTop: 4, marginBottom: 4 },
  actionRow: { marginBottom: 10 },
});
