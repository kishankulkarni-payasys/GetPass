import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { cancelEntry, gateOutEntry, getEntry } from '../../api/entries';
import { sendToQuality } from '../../api/quality';
import { startGrn } from '../../api/grn';
import { PassDetailOut } from '../../types/entries';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, ErrorBanner, FieldLabel, Input, LoadingView, Pill, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;

const OPEN_STATES = new Set(['GATE_IN', 'ON_SITE', 'QUALITY_PENDING', 'QUALITY_RESOLVED', 'GRN_DRAFT', 'GRN_APPROVED']);
const GATE_OUT_ROLES = new Set(['admin', 'security_guard']);
const WEIGH_ROLES = new Set(['admin', 'weighbridge_operator']);
const STORE_ROLES = new Set(['admin', 'store_incharge']);
const QUALITY_ROLES = new Set(['admin', 'quality_inspector']);

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

export default function EntryDetailScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { user } = useAuth();
  const [entry, setEntry] = useState<PassDetailOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
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

  async function runAction(action: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    setIsActing(true);
    try {
      await action();
      await load();
      return true;
    } catch (error) {
      setActionError(extractErrorMessage(error, 'That action could not be completed.'));
      return false;
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) return <LoadingView />;
  if (errorMessage || !entry) return <ErrorBanner message={errorMessage ?? 'Pass not found.'} />;

  const role = user?.role;
  const isOpen = OPEN_STATES.has(entry.pass_state) && !entry.exit_time;
  const needsRejectedConfirm = (entry.grn?.total_rejected_qty ?? 0) > 0;
  const canGateOut = role && GATE_OUT_ROLES.has(role) && isOpen;
  const canCancel = role && GATE_OUT_ROLES.has(role) && entry.pass_state === 'GATE_IN';
  const canCaptureWeight = role && WEIGH_ROLES.has(role) && isOpen;
  const canSendToQuality = role && STORE_ROLES.has(role) && entry.pass_type === 'inward' && entry.pass_state === 'ON_SITE';
  const canStartGrn = role && STORE_ROLES.has(role) && entry.pass_state === 'QUALITY_RESOLVED';
  const canViewGrn = role && STORE_ROLES.has(role) && (entry.grn != null || entry.pass_state === 'GRN_DRAFT' || entry.pass_state === 'GRN_APPROVED');
  const canEnterQuality = role && QUALITY_ROLES.has(role) && entry.pass_state === 'QUALITY_PENDING';

  return (
    <ScrollView style={styles.screen}>
      <Card>
        <View style={styles.header}>
          <Text style={styles.vehicle}>{entry.vehicle_number}</Text>
          <Pill label={entry.pass_state.replace('_', ' ')} tone={entry.exit_time ? 'neutral' : 'warn'} />
        </View>
        <DetailRow label="Pass type" value={entry.pass_type} />
        <DetailRow label="Driver" value={entry.driver_name} />
        <DetailRow label="Driver phone" value={entry.driver_phone} />
        <DetailRow label="Supplier / transporter" value={entry.supplier_transporter_name} />
        <DetailRow label="PO number" value={entry.po_number} />
        <DetailRow label="Challan number" value={entry.challan_number} />
        <DetailRow label="Purpose" value={entry.purpose} />
        <DetailRow label="Material" value={entry.material_description} />
        <DetailRow label="Entry time" value={new Date(entry.entry_time).toLocaleString()} />
        <DetailRow label="Exit time" value={entry.exit_time ? new Date(entry.exit_time).toLocaleString() : null} />
        <DetailRow label="Cancelled reason" value={entry.cancelled_reason} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Weights</Text>
        <DetailRow label="Gross (loaded)" value={entry.current_gross_kg != null ? `${entry.current_gross_kg} kg` : 'Not captured'} />
        <DetailRow label="Tare (empty)" value={entry.current_tare_kg != null ? `${entry.current_tare_kg} kg` : 'Not captured'} />
        <DetailRow label="Net" value={entry.net_kg != null ? `${entry.net_kg} kg` : null} />
      </Card>

      {entry.challan_lines.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Challan lines</Text>
          {entry.challan_lines.map(line => (
            <DetailRow key={line.id} label={line.material} value={`${line.quantity} ${line.uom}`} />
          ))}
        </Card>
      ) : null}

      {entry.quality ? (
        <Card>
          <Text style={styles.sectionTitle}>Quality</Text>
          <DetailRow label="Result" value={entry.quality.result} />
          <DetailRow label="Inspected by" value={entry.quality.inspected_by_name} />
          <DetailRow label="Remarks" value={entry.quality.remarks} />
        </Card>
      ) : null}

      {entry.grn ? (
        <Card>
          <Text style={styles.sectionTitle}>GRN</Text>
          <DetailRow label="Status" value={entry.grn.status} />
          <DetailRow label="ERP status" value={entry.grn.erp_status} />
          <DetailRow label="Return pass number" value={entry.grn.return_pass_number} />
          <DetailRow label="Rejected qty" value={entry.grn.total_rejected_qty} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Actions</Text>
        {actionError ? <ErrorBanner message={actionError} /> : null}

        {canCaptureWeight ? (
          <View style={styles.actionRow}>
            <Button
              label="Capture weight"
              variant="secondary"
              onPress={() => navigation.navigate('WeighCapture', { entryId: entry.id, vehicleNumber: entry.vehicle_number })}
            />
          </View>
        ) : null}

        {canSendToQuality ? (
          <View style={styles.actionRow}>
            <Button label="Send to quality" variant="secondary" loading={isActing} onPress={() => runAction(() => sendToQuality(entry.id))} />
          </View>
        ) : null}

        {canEnterQuality ? (
          <View style={styles.actionRow}>
            <Button label="Enter quality result" onPress={() => navigation.navigate('QualityResult', { entryId: entry.id })} />
          </View>
        ) : null}

        {canStartGrn ? (
          <View style={styles.actionRow}>
            <Button
              label="Start GRN"
              loading={isActing}
              onPress={async () => {
                const ok = await runAction(() => startGrn(entry.id));
                if (ok) navigation.navigate('GrnDetail', { entryId: entry.id });
              }}
            />
          </View>
        ) : null}

        {canViewGrn ? (
          <View style={styles.actionRow}>
            <Button label="View GRN" variant="secondary" onPress={() => navigation.navigate('GrnDetail', { entryId: entry.id })} />
          </View>
        ) : null}

        {canGateOut ? (
          <View style={styles.actionRow}>
            <Button
              label={needsRejectedConfirm ? 'Confirm rejected material on board & gate out' : 'Gate out'}
              loading={isActing}
              onPress={() =>
                runAction(() => gateOutEntry(entry.id, { rejected_material_on_vehicle: needsRejectedConfirm }))
              }
            />
          </View>
        ) : null}

        {canCancel ? (
          showCancelForm ? (
            <View>
              <FieldLabel label="Cancellation reason (min 5 characters)" />
              <Input value={cancelReason} onChangeText={setCancelReason} placeholder="Reason" />
              <View style={styles.actionRow}>
                <Button
                  label="Confirm cancel"
                  variant="danger"
                  loading={isActing}
                  disabled={cancelReason.trim().length < 5}
                  onPress={() => runAction(() => cancelEntry(entry.id, { reason: cancelReason.trim() }))}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Button label="Cancel pass" variant="danger" onPress={() => setShowCancelForm(true)} />
            </View>
          )
        ) : null}

        {!canGateOut && !canCancel && !canCaptureWeight && !canSendToQuality && !canEnterQuality && !canStartGrn && !canViewGrn ? (
          <Text style={styles.noActions}>No actions available for your role at this stage.</Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  vehicle: { fontSize: 22, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { color: colors.subtext, fontSize: 13 },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  actionRow: { marginBottom: 10 },
  noActions: { color: colors.muted, fontSize: 13 },
});
