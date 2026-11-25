import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../../config/env';
import { getToken } from '../../auth/tokenStorage';
import { useCancelEntry, useEntryDetail, useGateOutEntry } from '../../queries/useEntryQueries';
import { useStartGrn } from '../../queries/useGrnQueries';
import { useSendToQuality } from '../../queries/useQualityQueries';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBanner, FieldLabel, Input, LoadingView } from '../../components/ui';
import { Text } from '../../components/LocalizedText';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { AuditOut, PassDetailOut, PassState, PhotoOut, WeighmentOut } from '../../types/entries';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';
import { background, insetSurfaceStyle, raisedSurface } from '../../theme/neumorphism';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;
type Tone = 'good' | 'warn' | 'crit' | 'neutral';
type ActionVariant = 'primary' | 'secondary' | 'danger';
type JourneyStep = { label: string; hardGate?: boolean };

const OPEN_STATES = new Set(['GATE_IN', 'ON_SITE', 'QUALITY_PENDING', 'QUALITY_RESOLVED', 'GRN_DRAFT', 'GRN_APPROVED']);
const GATE_OUT_ROLES = new Set(['admin', 'security_guard']);
const WEIGH_ROLES = new Set(['admin', 'weighbridge_operator']);
const STORE_ROLES = new Set(['admin', 'store_incharge']);
const QUALITY_ROLES = new Set(['admin', 'quality_inspector']);

const INWARD_STEPS: JourneyStep[] = [
  { label: 'Gate-in' },
  { label: 'Weigh' },
  { label: 'Quality', hardGate: true },
  { label: 'GRN' },
  { label: 'Gate-out' },
];
const GENERAL_STEPS: JourneyStep[] = [{ label: 'Gate-in' }, { label: 'Gate-out' }];

const INWARD_CURRENT_STEP: Partial<Record<PassState, number>> = {
  GATE_IN: 1,
  ON_SITE: 2,
  QUALITY_PENDING: 2,
  QUALITY_RESOLVED: 3,
  GRN_DRAFT: 3,
  GRN_APPROVED: 4,
  GATE_OUT: 5,
};
const GENERAL_CURRENT_STEP: Partial<Record<PassState, number>> = {
  GATE_IN: 1,
  GATE_OUT: 2,
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date
    .toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\b(am|pm)\b/, match => match.toLowerCase());
}

function formatAuditDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date
    .toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\b(am|pm)\b/, match => match.toLowerCase());
}

function formatStatus(value?: string | null): string {
  if (!value) return 'Not yet';
  return value.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase());
}

function getPassStatus(entry: PassDetailOut): { label: string; tone: Tone } {
  switch (entry.pass_state) {
    case 'GATE_IN':
      return entry.pass_type === 'inward'
        ? { label: 'WEIGH GROSS', tone: 'warn' }
        : { label: 'ON SITE', tone: 'warn' };
    case 'ON_SITE':
      return { label: 'ON SITE · UNLOADING', tone: 'warn' };
    case 'QUALITY_PENDING':
      return { label: 'AWAITING QUALITY', tone: 'crit' };
    case 'QUALITY_RESOLVED':
      return { label: 'QUALITY RESOLVED', tone: 'good' };
    case 'GRN_DRAFT':
      return { label: 'GRN DRAFT', tone: 'good' };
    case 'GRN_APPROVED':
      if (entry.grn?.erp_status === 'not_required') return { label: 'RETURN ONLY · NO GRN', tone: 'warn' };
      if (entry.grn?.erp_status === 'pending' || entry.grn?.erp_status === 'failed') {
        return { label: 'GRN PENDING POST', tone: 'crit' };
      }
      if (entry.grn?.erp_status === 'posted') return { label: 'GRN POSTED', tone: 'good' };
      return { label: 'GRN APPROVED', tone: 'good' };
    case 'GATE_OUT':
      return { label: 'GATE OUT', tone: 'neutral' };
    case 'CANCELLED':
      return { label: 'CANCELLED', tone: 'neutral' };
  }
}

function PassStatusBadge({ entry }: { entry: PassDetailOut }) {
  const status = getPassStatus(entry);
  return (
    <View
      style={[
        styles.statusBadge,
        status.tone === 'good'
          ? styles.statusGood
          : status.tone === 'crit'
            ? styles.statusCrit
            : status.tone === 'neutral'
              ? styles.statusNeutral
              : styles.statusWarn,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          status.tone === 'good'
            ? styles.statusDotGood
            : status.tone === 'crit'
              ? styles.statusDotCrit
              : status.tone === 'neutral'
                ? styles.statusDotNeutral
                : styles.statusDotWarn,
        ]}
      />
      <Text
        style={[
          styles.statusText,
          status.tone === 'good'
            ? styles.statusTextGood
            : status.tone === 'crit'
              ? styles.statusTextCrit
              : status.tone === 'neutral'
                ? styles.statusTextNeutral
                : styles.statusTextWarn,
        ]}
      >
        {status.label}
      </Text>
    </View>
  );
}

function PassJourney({ entry }: { entry: PassDetailOut }) {
  if (entry.pass_state === 'CANCELLED') {
    return (
      <View style={styles.cancelledBanner}>
        <Text style={styles.cancelledText}>This pass was cancelled. Reason: {entry.cancelled_reason || '—'}</Text>
      </View>
    );
  }

  const steps = entry.pass_type === 'inward' ? INWARD_STEPS : GENERAL_STEPS;
  const currentStep = (entry.pass_type === 'inward' ? INWARD_CURRENT_STEP : GENERAL_CURRENT_STEP)[entry.pass_state] ?? 0;

  return (
    <View style={styles.journeyCard}>
      {steps.map((step, index) => {
        const status = index < currentStep ? 'done' : index > currentStep ? 'todo' : step.hardGate ? 'gate' : 'current';
        const statusText = status === 'done' ? 'Done' : status === 'gate' ? 'Waiting for quality' : status === 'current' ? 'Now' : 'Next';
        return (
          <View key={step.label} style={styles.stepRow}>
            <View
              style={[
                styles.stepCircle,
                status === 'done' ? styles.stepDone : status === 'gate' ? styles.stepGate : status === 'current' ? styles.stepCurrent : styles.stepTodo,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (status === 'done' || status === 'gate') && styles.stepNumberLight,
                ]}
              >
                {status === 'done' ? '✓' : index + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, status === 'done' && styles.stepLabelDone]}>{step.label}</Text>
            <Text style={[styles.stepStatus, status === 'gate' && styles.stepStatusGate]}>{statusText}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value === null || value === undefined || value === '' ? '—' : String(value)}</Text>
    </View>
  );
}

function DocumentFact({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string | null;
  tone?: Tone;
}) {
  return (
    <View style={styles.documentFact}>
      <Text style={styles.documentLabel}>{label}</Text>
      {tone ? (
        <View
          style={[
            styles.documentBadge,
            tone === 'good' ? styles.statusGood : tone === 'crit' ? styles.statusCrit : tone === 'warn' ? styles.statusWarn : styles.statusNeutral,
          ]}
        >
          <Text
            style={[
              styles.documentBadgeText,
              tone === 'good' ? styles.statusTextGood : tone === 'crit' ? styles.statusTextCrit : tone === 'warn' ? styles.statusTextWarn : styles.statusTextNeutral,
            ]}
          >
            {value || '—'}
          </Text>
        </View>
      ) : (
        <Text style={styles.documentValue}>{value || '—'}</Text>
      )}
    </View>
  );
}

function poLookupStatus(status?: string | null): { label: string; tone: Tone } | null {
  if (!status) return null;
  switch (status) {
    case 'matched':
      return { label: 'FOUND', tone: 'good' };
    case 'not_found':
      return { label: 'NOT FOUND', tone: 'crit' };
    case 'not_checked':
      return { label: 'NOT CHECKED', tone: 'neutral' };
    default:
      return { label: status.replace(/_/g, ' ').toUpperCase(), tone: 'neutral' };
  }
}

function ActionButton({
  label,
  variant,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  variant: ActionVariant;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[
        styles.actionButton,
        variant === 'primary' ? styles.actionPrimary : variant === 'danger' ? styles.actionDanger : styles.actionSecondary,
        disabled && styles.actionDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' ? '#131a22' : '#fff'} /> : <Text style={[styles.actionText, variant === 'secondary' && styles.actionTextSecondary]}>{label}</Text>}
    </TouchableOpacity>
  );
}

function WeighmentHistory({ weighments }: { weighments: WeighmentOut[] }) {
  if (weighments.length === 0) return <Text style={styles.emptyText}>No weight records yet.</Text>;

  const orderedWeighments = [...weighments].sort(
    (first, second) => second.captured_at.localeCompare(first.captured_at) || second.id - first.id,
  );
  return (
    <View style={styles.weighmentHistory}>
      {orderedWeighments.map(weighment => {
        const source = weighment.source === 'manual' ? 'MANUAL' : weighment.source === 'indicator' ? 'INDICATOR' : 'LEGACY';
        const sourceStyle = weighment.source === 'manual' ? styles.manualBadge : styles.indicatorBadge;
        const formattedWeight = weighment.weight.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        return (
          <View key={weighment.id} style={[styles.weighmentItem, weighment.is_superseded && styles.weighmentSuperseded]}>
            <View style={styles.weighmentHeader}>
              <Text style={styles.weighmentKind}>{weighment.kind === 'gross' ? 'Gross' : 'Tare'}</Text>
              <Text style={styles.weighmentValue}>{formattedWeight} {weighment.unit}</Text>
              <View style={[styles.weighmentBadge, sourceStyle]}>
                <Text style={[styles.weighmentBadgeText, weighment.source === 'manual' && styles.manualBadgeText]}>{source}</Text>
              </View>
              {weighment.is_superseded ? (
                <View style={[styles.weighmentBadge, styles.statusNeutral]}>
                  <Text style={[styles.weighmentBadgeText, styles.statusTextNeutral]}>REPLACED</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.weighmentMeta}>{formatDateTime(weighment.captured_at)}</Text>
            {weighment.manual_reason ? <Text style={styles.weighmentReason}>Reason: {weighment.manual_reason}</Text> : null}
            {weighment.indicator_frame_ref ? <Text style={styles.weighmentMeta}>{weighment.indicator_frame_ref}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function PhotoCard({ photo, label }: { photo: PhotoOut; label: string }) {
  const [source, setSource] = useState<{ uri: string; headers: { Authorization: string } } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    async function preparePhoto() {
      try {
        const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getToken()]);
        if (!token) throw new Error('No signed-in session is available to load this photo.');
        const filePath = photo.file_path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
        if (active) {
          setSource({
            uri: `${baseUrl.replace(/\/+$/, '')}/uploads/${filePath}`,
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not prepare the photo request.');
      }
    }

    preparePhoto();
    return () => {
      active = false;
    };
  }, [photo.file_path]);

  return (
    <View style={styles.photoCard}>
      {errorMessage ? (
        <View style={styles.photoError}>
          <Text style={styles.photoErrorText}>{errorMessage}</Text>
        </View>
      ) : source ? (
        <Image
          source={source}
          style={styles.photoImage}
          resizeMode="cover"
          onError={() => setErrorMessage('Could not load this photo.')}
        />
      ) : (
        <View style={styles.photoLoading}><ActivityIndicator color="#64748b" /></View>
      )}
      <Text style={styles.photoLabel}>{label}</Text>
    </View>
  );
}

function PhotosSection({ entry }: { entry: PassDetailOut }) {
  const photos = entry.photos ?? [];
  const kindLabels: Record<string, string> = {
    plate: 'Number plate',
    po_doc: 'PO document',
    challan_doc: 'Challan',
    weigh_frame: 'Weighbridge',
    vehicle: 'Vehicle',
    other: 'Other',
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Photos</Text>
      {photos.length === 0 ? (
        <Text style={styles.emptyText}>No photos.</Text>
      ) : (
        <View style={styles.photoGrid}>
          {photos.map(photo => {
            const linkedWeighment = photo.weighment_id == null
              ? null
              : entry.weighments.find(weighment => weighment.id === photo.weighment_id);
            const label = photo.kind === 'weigh_frame' && linkedWeighment
              ? `Weighbridge: ${linkedWeighment.kind === 'gross' ? 'loaded (gross)' : 'empty (tare)'}`
              : kindLabels[photo.kind] ?? 'Other';
            return <PhotoCard key={photo.id} photo={photo} label={label} />;
          })}
        </View>
      )}
    </View>
  );
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  pass_created: 'Pass created',
  state_changed: 'State changed',
  ocr_field_overridden: 'OCR value corrected',
  weighment_captured: 'Weight recorded',
  weighment_superseded: 'Weight replaced',
  grn_line_edited: 'GRN line edited',
  grn_approved: 'GRN approved',
  erp_post_attempt: 'ERP post attempt',
  quality_result_recorded: 'Quality result recorded',
  quality_result_corrected: 'Quality result corrected',
  photo_uploaded: 'Photo uploaded',
  rejected_material_confirmed: 'Rejected material confirmed',
  pass_cancelled: 'Pass cancelled',
};

function AuditHistory({ audit }: { audit: AuditOut[] }) {
  if (audit.length === 0) return <Text style={styles.emptyText}>No history yet.</Text>;
  const orderedAudit = [...audit].sort(
    (first, second) => second.created_at.localeCompare(first.created_at) || second.id - first.id,
  );

  return (
    <View style={styles.auditHistory}>
      {orderedAudit.map(row => {
        const hasChange = row.old_value !== null || row.new_value !== null;
        const actionLabel = AUDIT_ACTION_LABELS[row.action]
          ?? row.action.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase());
        const actor = row.actor_name || row.actor_service || 'System';
        return (
          <View key={row.id} style={styles.auditItem}>
            <View style={styles.auditHeader}>
              <Text style={styles.auditAction}>{actionLabel}</Text>
              {row.is_manual_override ? (
                <View style={styles.manualBadge}>
                  <Text style={styles.manualBadgeText}>MANUAL CHANGE</Text>
                </View>
              ) : null}
            </View>
            {hasChange ? (
              <Text style={styles.auditChange}>
                {row.field ? `${row.field}: ` : ''}{row.old_value ?? '—'} → {row.new_value ?? '—'}
              </Text>
            ) : null}
            <Text style={styles.auditMeta}>{actor} · {formatAuditDateTime(row.created_at)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function EntryDetailScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { user } = useAuth();
  const { data: entry, isLoading, error: loadError } = useEntryDetail(entryId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const gateOutMutation = useGateOutEntry();
  const cancelMutation = useCancelEntry();
  const startGrnMutation = useStartGrn();
  const sendToQualityMutation = useSendToQuality();

  async function runAction(action: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    setIsActing(true);
    try {
      await action();
      return true;
    } catch (error) {
      setActionError(extractErrorMessage(error, 'That action could not be completed.'));
      return false;
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) return <LoadingView />;
  const errorMessage = loadError ? extractErrorMessage(loadError, 'Could not load this pass.') : null;
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
  const poStatus = poLookupStatus(entry.po_lookup_status);
  const actions: { key: string; label: string; variant: ActionVariant; onPress: () => void }[] = [];

  if (canCaptureWeight) {
    actions.push({
      key: 'weigh',
      label: 'Go to weighing',
      variant: 'secondary',
      onPress: () =>
        navigation.navigate('WeighCapture', {
          entryId: entry.id,
          vehicleNumber: entry.vehicle_number,
          kind: entry.current_gross_kg == null ? 'gross' : 'tare',
        }),
    });
  }
  if (canSendToQuality) {
    actions.push({
      key: 'quality-send',
      label: 'Send for inspection',
      variant: 'primary',
      onPress: () => runAction(() => sendToQualityMutation.mutateAsync(entry.id)),
    });
  }
  if (canEnterQuality) {
    actions.push({
      key: 'quality-result',
      label: 'Record result',
      variant: 'primary',
      onPress: () => navigation.navigate('QualityResult', { entryId: entry.id }),
    });
  }
  if (canStartGrn) {
    actions.push({
      key: 'grn-start',
      label: 'Start GRN',
      variant: 'primary',
      onPress: async () => {
        const ok = await runAction(() => startGrnMutation.mutateAsync(entry.id));
        if (ok) navigation.navigate('GrnDetail', { entryId: entry.id });
      },
    });
  }
  if (canViewGrn) {
    actions.push({
      key: 'grn-view',
      label: 'Open GRN',
      variant: 'secondary',
      onPress: () => navigation.navigate('GrnDetail', { entryId: entry.id }),
    });
  }
  if (canGateOut) {
    actions.push({
      key: 'gate-out',
      label: 'Go to gate-out',
      variant: 'primary',
      onPress: () =>
        runAction(() =>
          gateOutMutation.mutateAsync({
            entryId: entry.id,
            payload: { rejected_material_on_vehicle: needsRejectedConfirm },
          }),
        ),
    });
  }
  if (canCancel && !showCancelForm) {
    actions.push({
      key: 'cancel',
      label: 'Cancel pass',
      variant: 'danger',
      onPress: () => setShowCancelForm(true),
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
    <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
      <View style={styles.passHeader}>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{formatPlate(entry.vehicle_number)}</Text>
        </View>
        <PassStatusBadge entry={entry} />
      </View>

      <PassJourney entry={entry} />

      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {actions.map(action => (
            <ActionButton
              key={action.key}
              label={action.label}
              variant={action.variant}
              onPress={action.onPress}
              disabled={isActing}
              loading={isActing && action.key !== 'weigh' && action.key !== 'quality-result' && action.key !== 'grn-view' && action.key !== 'cancel'}
            />
          ))}
        </View>
      ) : null}

      {showCancelForm ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cancel pass</Text>
          <FieldLabel label="Cancellation reason (min 5 characters)" />
          <Input value={cancelReason} onChangeText={setCancelReason} placeholder="Reason" />
          <ActionButton
            label="Confirm cancel"
            variant="danger"
            disabled={cancelReason.trim().length < 5 || isActing}
            loading={isActing}
            onPress={async () => {
              const cancelled = await runAction(() =>
                cancelMutation.mutateAsync({ entryId: entry.id, payload: { reason: cancelReason.trim() } }),
              );
              if (cancelled) setShowCancelForm(false);
            }}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <DocumentFact label="Pass type" value={entry.pass_type === 'inward' ? 'Inward material' : 'General vehicle'} />
        {entry.pass_type === 'inward' ? (
          <>
            <DocumentFact label="PO number" value={entry.po_number} />
            {poStatus ? <DocumentFact label="PO check" value={poStatus.label} tone={poStatus.tone} /> : null}
            <DocumentFact label="Challan number" value={entry.challan_number} />
          </>
        ) : (
          <DocumentFact label="Reference document" value={entry.reference_doc_number} />
        )}
        <DocumentFact label="Driver name" value={entry.driver_name} />
        <DocumentFact label="Driver phone" value={entry.driver_phone} />
        <DocumentFact label="Supplier / transporter" value={entry.supplier_transporter_name} />
        <DocumentFact label="Entry" value={formatDateTime(entry.entry_time)} />
        {entry.exit_time ? <DocumentFact label="Exit" value={formatDateTime(entry.exit_time)} /> : null}
        {entry.purpose ? <DocumentFact label="Purpose" value={entry.purpose} /> : null}
        {entry.material_description ? <DocumentFact label="Material" value={entry.material_description} /> : null}
        {entry.cancelled_reason ? <DocumentFact label="Cancelled reason" value={entry.cancelled_reason} /> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weights</Text>
        <DetailRow label="Loaded (gross)" value={entry.current_gross_kg != null ? `${entry.current_gross_kg.toLocaleString('en-IN')} kg` : 'Pending'} />
        <DetailRow label="Empty (tare)" value={entry.current_tare_kg != null ? `${entry.current_tare_kg.toLocaleString('en-IN')} kg` : 'Pending'} />
        <DetailRow label="Net material" value={entry.net_kg != null ? `${entry.net_kg.toLocaleString('en-IN')} kg` : 'Pending'} />
        <WeighmentHistory weighments={entry.weighments ?? []} />
      </View>

      {entry.challan_lines.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challan lines</Text>
          {entry.challan_lines.map(line => (
            <DetailRow key={line.id} label={line.material} value={`${line.quantity} ${line.uom}`} />
          ))}
        </View>
      ) : null}

      {entry.pass_type === 'inward' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quality and GRN</Text>
          <DocumentFact label="Quality" value={formatStatus(entry.quality?.result)} />
          <DocumentFact label="GRN" value={formatStatus(entry.grn?.status)} />
          {entry.quality ? (
            <>
              <DetailRow label="Inspected by" value={entry.quality.inspected_by_name} />
              <DetailRow label="Inspected at" value={formatDateTime(entry.quality.inspected_at)} />
              <DetailRow label="Quality remarks" value={entry.quality.remarks} />
            </>
          ) : null}
          {entry.grn ? (
            <>
              <DetailRow label="ERP status" value={entry.grn.erp_status} />
              <DetailRow label="ERP GRN number" value={entry.grn.erp_grn_number} />
              <DetailRow label="Return pass number" value={entry.grn.return_pass_number} />
              <DetailRow label="Total rejected" value={entry.grn.total_rejected_qty} />
            </>
          ) : null}
        </View>
      ) : null}

      <PhotosSection entry={entry} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        <AuditHistory audit={entry.audit ?? []} />
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: background },
  flexOne: { flex: 1 },
  content: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 24 },
  passHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  plate: {
    backgroundColor: '#facc15',
    borderColor: '#17202b',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  plateText: { color: '#111827', fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusGood: { backgroundColor: '#e8f5ed' },
  statusWarn: { backgroundColor: '#f8f0da' },
  statusCrit: { backgroundColor: '#fdeaea' },
  statusNeutral: { backgroundColor: '#eef1f5' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotGood: { backgroundColor: '#2f855a' },
  statusDotWarn: { backgroundColor: '#a77916' },
  statusDotCrit: { backgroundColor: '#c0392b' },
  statusDotNeutral: { backgroundColor: '#64748b' },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.25 },
  statusTextGood: { color: '#276749' },
  statusTextWarn: { color: '#80600f' },
  statusTextCrit: { color: '#a83227' },
  statusTextNeutral: { color: '#475569' },
  journeyCard: { ...raisedSurface, borderRadius: 14, padding: 14, marginBottom: 14 },
  stepRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stepDone: { backgroundColor: '#e8f5ed', borderColor: '#14a065' },
  stepGate: { backgroundColor: '#b83232', borderColor: '#b83232' },
  stepCurrent: { backgroundColor: '#e9edf4', borderColor: '#b8410e' },
  stepTodo: { backgroundColor: '#f5f7f9', borderColor: '#d7dee6' },
  stepNumber: { color: '#34445a', fontSize: 11, fontWeight: '700' },
  stepNumberLight: { color: '#fff' },
  stepLabel: { color: '#15263a', fontSize: 12, fontWeight: '600', flex: 1 },
  stepLabelDone: { color: '#24364b' },
  stepStatus: { color: '#64748b', fontSize: 10 },
  stepStatusGate: { color: '#b83232', fontWeight: '700' },
  cancelledBanner: { ...insetSurfaceStyle, borderRadius: 10, padding: 12, marginBottom: 14 },
  cancelledText: { color: '#475569', fontSize: 12 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  actionButton: { flexGrow: 1, flexBasis: '46%', minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  actionPrimary: { backgroundColor: '#b8410e' },
  actionSecondary: { ...raisedSurface },
  actionDanger: { backgroundColor: '#c0392b' },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  actionTextSecondary: { color: '#131a22' },
  section: { ...raisedSurface, borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionTitle: { color: '#15263a', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  documentFact: { ...insetSurfaceStyle, minHeight: 54, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  documentLabel: { color: '#34445a', fontSize: 10, marginBottom: 4 },
  documentValue: { color: '#15263a', fontSize: 13, fontWeight: '700' },
  documentBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  documentBadgeText: { fontSize: 9, fontWeight: '700' },
  emptyText: { color: '#526171', fontSize: 12 },
  weighmentHistory: { marginTop: 8 },
  weighmentItem: { ...raisedSurface, borderRadius: 10, padding: 10, marginTop: 8 },
  weighmentSuperseded: { opacity: 0.6 },
  weighmentHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  weighmentKind: { color: '#15263a', fontSize: 12, fontWeight: '700' },
  weighmentValue: { color: '#15263a', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  weighmentBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  manualBadge: { backgroundColor: '#f8f0da', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  manualBadgeText: { color: '#80600f', fontSize: 9, fontWeight: '700' },
  indicatorBadge: { backgroundColor: '#e8f1fa' },
  weighmentBadgeText: { color: '#47617c', fontSize: 9, fontWeight: '700' },
  weighmentMeta: { color: '#526171', fontSize: 10, marginTop: 5 },
  weighmentReason: { color: '#526171', fontSize: 10, marginTop: 3 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCard: { ...raisedSurface, flexGrow: 1, flexBasis: '47%', overflow: 'hidden', borderRadius: 10, padding: 6 },
  photoImage: { width: '100%', height: 110, borderRadius: 5, backgroundColor: background },
  photoLoading: { height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7f9', borderRadius: 5 },
  photoError: { height: 110, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#fdeaea', borderRadius: 5 },
  photoErrorText: { color: '#a83227', fontSize: 10, textAlign: 'center' },
  photoLabel: { color: '#15263a', fontSize: 10, fontWeight: '600', paddingTop: 7, paddingHorizontal: 2 },
  auditHistory: { borderLeftWidth: 1.5, borderLeftColor: '#dce2e8', marginLeft: 2, paddingLeft: 12 },
  auditItem: { paddingBottom: 12 },
  auditHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  auditAction: { color: '#15263a', fontSize: 12, fontWeight: '700' },
  auditChange: { color: '#34445a', fontSize: 10, lineHeight: 16, marginTop: 4, fontFamily: 'monospace' },
  auditMeta: { color: '#526171', fontSize: 10, marginTop: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 10 },
  detailLabel: { color: '#526171', fontSize: 12, flex: 1 },
  detailValue: { color: '#15263a', fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' },
});
