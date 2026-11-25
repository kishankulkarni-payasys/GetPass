import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEntryDetail } from '../../queries/useEntryQueries';
import { useApproveGrn, useEditGrnLines, useGrnDetail, useRetryGrnPost } from '../../queries/useGrnQueries';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBanner, FieldLabel, Input, LoadingView } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { GrnLineOut } from '../../types/grn';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'GrnDetail'>;

interface LineDraft {
  id: number;
  receivedQty: string;
  acceptedQty: string;
  rejectedQty: string;
  remarks: string;
}

const MAX_QTY = 999999999.999;

function formatQty(value?: number | null): string {
  return value == null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function formatName(value?: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase());
}

function isValidQty(value: string): boolean {
  const amount = Number(value);
  return value.trim() !== '' && Number.isFinite(amount) && amount >= 0 && amount <= MAX_QTY;
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factCard}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function QualityBadge({ result }: { result?: string | null }) {
  const tone = !result
    ? styles.qualityMissing
    : result === 'approved'
      ? styles.qualityApproved
      : result === 'partial'
        ? styles.qualityPartial
        : styles.qualityRejected;
  const textTone = !result
    ? styles.qualityMissingText
    : result === 'approved'
      ? styles.qualityApprovedText
      : result === 'partial'
        ? styles.qualityPartialText
        : styles.qualityRejectedText;
  return (
    <View style={[styles.qualityBadge, tone]}>
      <Text style={[styles.qualityBadgeText, textTone]}>{result ? formatName(result).toUpperCase() : '—'}</Text>
    </View>
  );
}

function GrnLineCard({
  line,
  draft,
  editable,
  onChange,
}: {
  line: GrnLineOut;
  draft: LineDraft;
  editable: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
}) {
  return (
    <View style={styles.lineCard}>
      <Text style={styles.lineTitle}>
        {line.material} <Text style={styles.lineUnit}>({line.uom})</Text>
      </Text>

      <View style={styles.lineFacts}>
        <View style={styles.lineFact}>
          <Text style={styles.lineFactLabel}>PO open qty</Text>
          <Text style={styles.lineFactValue}>{formatQty(line.po_qty)}</Text>
        </View>
        <View style={styles.lineFact}>
          <Text style={styles.lineFactLabel}>Challan qty</Text>
          <Text style={styles.lineFactValue}>{formatQty(line.challan_qty)}</Text>
        </View>
      </View>

      <View style={styles.quantityRow}>
        <View style={styles.quantityField}>
          <FieldLabel label="Received" />
          <Input
            value={draft.receivedQty}
            onChangeText={receivedQty => onChange({ receivedQty })}
            keyboardType="decimal-pad"
            editable={editable}
            style={styles.quantityInput}
          />
        </View>
        <View style={styles.quantityField}>
          <FieldLabel label="Accepted" />
          <Input
            value={draft.acceptedQty}
            onChangeText={acceptedQty => onChange({ acceptedQty })}
            keyboardType="decimal-pad"
            editable={editable}
            style={styles.quantityInput}
          />
        </View>
        <View style={styles.quantityField}>
          <FieldLabel label="Rejected" />
          <Input
            value={draft.rejectedQty}
            onChangeText={rejectedQty => onChange({ rejectedQty })}
            keyboardType="decimal-pad"
            editable={editable}
            style={styles.quantityInput}
          />
        </View>
      </View>

      {line.flags.length > 0 ? <Text style={styles.flagText}>{line.flags.join(' · ')}</Text> : null}
      <FieldLabel label="Remarks" />
      <Input
        value={draft.remarks}
        onChangeText={remarks => onChange({ remarks })}
        placeholder="Optional"
        editable={editable}
        style={styles.remarksInput}
      />
    </View>
  );
}

export default function GrnDetailScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { user } = useAuth();
  const {
    data: grn,
    isLoading: isGrnLoading,
    error: grnError,
    refetch: refetchGrn,
  } = useGrnDetail(entryId);
  const { data: entry, isLoading: isEntryLoading, error: entryError } = useEntryDetail(entryId);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [isLinesInitialized, setIsLinesInitialized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const editGrnLinesMutation = useEditGrnLines();
  const approveGrnMutation = useApproveGrn();
  const retryGrnPostMutation = useRetryGrnPost();
  const isSaving = editGrnLinesMutation.isPending;
  const isApproving = approveGrnMutation.isPending || retryGrnPostMutation.isPending;
  const isLoading = isGrnLoading || isEntryLoading;

  // Seed the editable quantity drafts from the fetched GRN once; after a save/approve we
  // reset the flag so the next server response re-seeds the drafts with the saved values.
  useEffect(() => {
    if (!grn || isLinesInitialized) return;
    setLines(
      grn.lines.map(line => ({
        id: line.id,
        receivedQty: String(line.received_qty),
        acceptedQty: String(line.accepted_qty),
        rejectedQty: String(line.rejected_qty),
        remarks: line.remarks ?? '',
      })),
    );
    setIsLinesInitialized(true);
  }, [grn, isLinesInitialized]);

  useEffect(() => {
    const loadError = grnError ?? entryError;
    if (loadError) setErrorMessage(extractErrorMessage(loadError, 'Could not load the GRN.'));
  }, [grnError, entryError]);

  function updateLine(lineId: number, patch: Partial<LineDraft>) {
    setLines(current => current.map(line => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  const isDraft = grn?.status === 'draft';
  const hasUnsavedChanges = Boolean(grn && lines.some(draft => {
    const savedLine = grn.lines.find(line => line.id === draft.id);
    return savedLine && (
      String(savedLine.received_qty) !== draft.receivedQty
      || String(savedLine.accepted_qty) !== draft.acceptedQty
      || String(savedLine.rejected_qty) !== draft.rejectedQty
      || (savedLine.remarks ?? '') !== draft.remarks
    );
  }));
  const quantitiesValid = lines.every(line => (
    isValidQty(line.receivedQty) && isValidQty(line.acceptedQty) && isValidQty(line.rejectedQty)
  ));

  function getEditPayload() {
    return {
      lines: lines.map(line => ({
        id: line.id,
        received_qty: Number(line.receivedQty),
        accepted_qty: Number(line.acceptedQty),
        rejected_qty: Number(line.rejectedQty),
        remarks: line.remarks.trim() || undefined,
      })),
    };
  }

  async function handleSaveLines() {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!quantitiesValid) {
      setErrorMessage('Enter valid non-negative quantities before saving.');
      return;
    }
    if (!hasUnsavedChanges) return;

    try {
      await editGrnLinesMutation.mutateAsync({ entryId, payload: getEditPayload() });
      setSuccessMessage('Draft saved.');
      setIsLinesInitialized(false);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not save the GRN lines.'));
    }
  }

  async function handleApprove() {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!quantitiesValid) {
      setErrorMessage('Enter valid non-negative quantities before approving.');
      return;
    }
    try {
      if (hasUnsavedChanges) await editGrnLinesMutation.mutateAsync({ entryId, payload: getEditPayload() });
      await approveGrnMutation.mutateAsync(entryId);
      setSuccessMessage('GRN approved.');
      setIsLinesInitialized(false);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not approve the GRN.'));
    }
  }

  async function handleRetryPost() {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await retryGrnPostMutation.mutateAsync(entryId);
      setSuccessMessage('ERP post retried.');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not retry the ERP post.'));
    }
  }

  if (isLoading) return <LoadingView />;
  if (!grn || !entry) {
    return (
      <View style={styles.errorScreen}>
        <ErrorBanner message={errorMessage ?? 'GRN not found.'} />
        <TouchableOpacity style={styles.retryLoadButton} onPress={() => refetchGrn()}>
          <Text style={styles.retryLoadText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const busy = isSaving || isApproving;
  const canRetryPost = grn.status === 'approved' && (grn.erp_status === 'pending' || grn.erp_status === 'failed');
  const weighedBy = grn.weighed_by.map(person => person.full_name).join(', ') || '—';
  const currentUserName = user?.full_name || user?.username || '—';
  const qualityResult = grn.quality_result ?? entry.quality?.result;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {/* Paired with android:windowSoftInputMode="adjustResize" in AndroidManifest.xml;
          see LoginScreen.tsx for why Android needs 'height' instead of 'undefined'. */}
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← Back to the list</Text>
        </TouchableOpacity>

        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>GRN</Text>
            <View style={styles.plateChip}>
              <Text style={styles.plateText}>{entry.vehicle_number}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, grn.status === 'draft' ? styles.statusDraft : styles.statusApproved]}>
              <View style={styles.statusDot} />
              <Text style={[styles.statusText, grn.status === 'draft' ? styles.statusDraftText : styles.statusApprovedText]}>
                {grn.status === 'draft' ? 'GRN DRAFT' : 'GRN APPROVED'}
              </Text>
            </View>
            {grn.erp_status ? (
              <View style={[styles.erpBadge, grn.erp_status === 'failed' || grn.erp_status === 'pending' ? styles.erpError : styles.erpNeutral]}>
                <Text style={styles.erpBadgeText}>ERP {grn.erp_status.toUpperCase().replace(/_/g, ' ')}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={() => navigation.navigate('EntryDetail', { entryId })}>
              <Text style={styles.passDetailsLink}>Pass details</Text>
            </TouchableOpacity>
          </View>
          {entry.supplier_transporter_name ? <Text style={styles.supplier}>{entry.supplier_transporter_name}</Text> : null}
        </View>

        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        {successMessage ? <Text style={styles.successMessage}>{successMessage}</Text> : null}
        {grn.erp_last_error ? <Text style={styles.erpErrorMessage}>{grn.erp_last_error}</Text> : null}
        {grn.return_pass_number ? (
          <View style={styles.returnPassBanner}>
            <Text style={styles.returnPassText}>Return pass: {grn.return_pass_number}</Text>
          </View>
        ) : null}

        <View style={styles.factsGrid}>
          <FactCard label="PO number" value={entry.po_number || '—'} />
          <FactCard label="Challan number" value={entry.challan_number || '—'} />
          <FactCard label="Inspected by" value={grn.inspected_by_name || entry.quality?.inspected_by_name || '—'} />
          <FactCard label="Gross" value={entry.current_gross_kg == null ? '—' : `${formatQty(entry.current_gross_kg)} kg`} />
          <View style={styles.factCard}>
            <Text style={styles.factLabel}>Quality</Text>
            <QualityBadge result={qualityResult} />
          </View>
        </View>

        {grn.lines.map(line => {
          const draft = lines.find(item => item.id === line.id) ?? {
            id: line.id,
            receivedQty: String(line.received_qty),
            acceptedQty: String(line.accepted_qty),
            rejectedQty: String(line.rejected_qty),
            remarks: line.remarks ?? '',
          };
          return (
            <GrnLineCard
              key={line.id}
              line={line}
              draft={draft}
              editable={isDraft}
              onChange={patch => updateLine(line.id, patch)}
            />
          );
        })}
      </ScrollView>

      {isDraft ? (
        <View style={styles.footer}>
          <Text style={styles.sodNotice}>
            Weighed by <Text style={styles.sodStrong}>{weighedBy}</Text>. You are signed in as{' '}
            <Text style={styles.sodStrong}>{currentUserName}</Text>.
            {grn.current_user_weighed ? ' You cannot approve a GRN for a pass you weighed.' : ''}
          </Text>
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={[styles.saveButton, (!hasUnsavedChanges || !quantitiesValid || busy) && styles.buttonDisabled]}
              disabled={!hasUnsavedChanges || !quantitiesValid || busy}
              onPress={handleSaveLines}
            >
              {isSaving ? <ActivityIndicator color="#526171" /> : <Text style={styles.saveButtonText}>Save draft</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.approveButton, (grn.current_user_weighed || !quantitiesValid || busy) && styles.buttonDisabled]}
              disabled={grn.current_user_weighed || !quantitiesValid || busy}
              onPress={handleApprove}
            >
              {isApproving ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveButtonText}>Approve &amp; post GRN</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : canRetryPost ? (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.approveButton} disabled={busy} onPress={handleRetryPost}>
            {isApproving ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveButtonText}>Retry ERP post</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  flexOne: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 6, paddingTop: 16, paddingBottom: 16 },
  errorScreen: { flex: 1, justifyContent: 'center', backgroundColor: '#eef1f5' },
  retryLoadButton: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#b8410e' },
  retryLoadText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  backLink: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  backLinkText: { color: '#b8410e', fontSize: 11, fontWeight: '600' },
  headerCard: { paddingHorizontal: 8, paddingVertical: 10, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#15263a', fontSize: 22, fontWeight: '500' },
  plateChip: { backgroundColor: '#facc15', borderColor: '#17202b', borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { color: '#111827', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusDraft: { backgroundColor: '#e5f4ec' },
  statusApproved: { backgroundColor: '#e8f1fa' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#18734a' },
  statusText: { fontSize: 9, fontWeight: '800' },
  statusDraftText: { color: '#18734a' },
  statusApprovedText: { color: '#1e5d91' },
  erpBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  erpError: { backgroundColor: '#fdeaea' },
  erpNeutral: { backgroundColor: '#eef1f5' },
  erpBadgeText: { color: '#475569', fontSize: 9, fontWeight: '700' },
  passDetailsLink: { color: '#b8410e', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  supplier: { color: '#34445a', fontSize: 12, marginTop: 8 },
  successMessage: { color: '#18734a', fontSize: 12, fontWeight: '600', paddingHorizontal: 10, marginBottom: 8 },
  erpErrorMessage: { color: '#a83227', fontSize: 12, backgroundColor: '#fdeaea', marginHorizontal: 8, marginBottom: 8, padding: 10, borderRadius: 8 },
  returnPassBanner: { backgroundColor: '#f8f0da', marginHorizontal: 8, marginBottom: 8, padding: 10, borderRadius: 8 },
  returnPassText: { color: '#80600f', fontSize: 12, fontWeight: '600' },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 2, marginBottom: 6 },
  factCard: { flexGrow: 1, flexBasis: '47%', minHeight: 58, justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce2e8', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  factLabel: { color: '#34445a', fontSize: 10, fontWeight: '500', marginBottom: 4 },
  factValue: { color: '#15263a', fontSize: 13, fontWeight: '700' },
  qualityBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  qualityApproved: { backgroundColor: '#e5f4ec' },
  qualityPartial: { backgroundColor: '#f8f0da' },
  qualityRejected: { backgroundColor: '#fdeaea' },
  qualityMissing: { backgroundColor: '#eef1f5' },
  qualityBadgeText: { fontSize: 9, fontWeight: '700' },
  qualityApprovedText: { color: '#18734a' },
  qualityPartialText: { color: '#80600f' },
  qualityRejectedText: { color: '#a83227' },
  qualityMissingText: { color: '#526171' },
  lineCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce2e8', borderRadius: 11, padding: 12, marginHorizontal: 2, marginTop: 8 },
  lineTitle: { color: '#15263a', fontSize: 14, fontWeight: '700' },
  lineUnit: { fontSize: 11, fontWeight: '400' },
  lineFacts: { flexDirection: 'row', gap: 12, marginTop: 10 },
  lineFact: { flex: 1 },
  lineFactLabel: { color: '#34445a', fontSize: 10 },
  lineFactValue: { color: '#15263a', fontSize: 12, fontWeight: '600', marginTop: 3 },
  quantityRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  quantityField: { flex: 1, minWidth: 0 },
  quantityInput: { height: 40, minHeight: 40, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, textAlign: 'right', borderColor: '#dce2e8' },
  flagText: { color: '#80600f', fontSize: 10, marginTop: 7 },
  remarksInput: { minHeight: 40, paddingVertical: 8, fontSize: 12 },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dce2e8', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, elevation: 8 },
  sodNotice: { color: '#526171', fontSize: 10, lineHeight: 15, marginBottom: 8 },
  sodStrong: { color: '#15263a', fontWeight: '700' },
  footerButtons: { flexDirection: 'row', gap: 8 },
  saveButton: { flex: 0.8, minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: '#dce2e8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#15263a', fontSize: 11, fontWeight: '700' },
  approveButton: { flex: 1.2, minHeight: 42, borderRadius: 9, backgroundColor: '#b8410e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  approveButtonText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  buttonDisabled: { opacity: 0.48 },
});
