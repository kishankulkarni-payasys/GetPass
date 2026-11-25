import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEntryDetail, useUploadEntryPhoto } from '../../queries/useEntryQueries';
import { useCaptureWeighment, useReadIndicator } from '../../queries/useWeighmentQueries';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';
import { getApiBaseUrl } from '../../config/env';
import { getToken } from '../../auth/tokenStorage';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { PassDetailOut, PhotoOut, WeighmentKind, WeighmentOut, WeightUnit } from '../../types/entries';
import type { PhotoUploadAsset } from '../../api/entries';
import { ErrorBanner, FieldLabel, Input } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';
import { background, insetSurfaceStyle, raisedSurface } from '../../theme/neumorphism';
import { Text } from '../../components/LocalizedText';

type Props = NativeStackScreenProps<RootStackParamList, 'WeighCapture'>;
type SelectOption<T extends string> = { value: T; label: string };
type PhotoSource = 'camera' | 'library';

const KIND_OPTIONS: SelectOption<WeighmentKind>[] = [
  { value: 'gross', label: 'Gross (loaded)' },
  { value: 'tare', label: 'Tare (empty)' },
];
const UNIT_OPTIONS: SelectOption<WeightUnit>[] = [
  { value: 'kg', label: 'kg' },
  { value: 'ton', label: 'ton' },
];

function formatWeight(value?: number | null): string {
  return value == null ? '—' : `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
}

function formatCaptureTime(value: string): string {
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

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <>
      <FieldLabel label={label} />
      <TouchableOpacity style={styles.selectField} onPress={() => setIsOpen(true)}>
        <Text style={styles.selectText}>{selected?.label ?? value}</Text>
        <Text style={styles.selectChevron}>⌄</Text>
      </TouchableOpacity>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            accessibilityLabel="Close options"
            onPress={() => setIsOpen(false)}
          />
          <View style={styles.modalCard}>
            {options.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.modalOption, option.value === value && styles.modalOptionActive]}
                onPress={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
              >
                <Text style={[styles.modalOptionText, option.value === value && styles.modalOptionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

function WeighmentHistory({ weighments }: { weighments: WeighmentOut[] }) {
  if (weighments.length === 0) return <Text style={styles.emptyText}>No weighments recorded yet.</Text>;
  const ordered = [...weighments].sort(
    (first, second) => second.captured_at.localeCompare(first.captured_at) || second.id - first.id,
  );
  return (
    <View style={styles.historyList}>
      {ordered.map(item => (
        <View key={item.id} style={[styles.historyItem, item.is_superseded && styles.historyItemSuperseded]}>
          <View style={styles.historyMain}>
            <Text style={styles.historyKind}>{item.kind === 'gross' ? 'Gross' : 'Tare'}</Text>
            <Text style={styles.historyWeight}>
              {item.weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {item.unit}
            </Text>
            <View style={[styles.historyBadge, item.source === 'manual' ? styles.manualBadge : styles.indicatorBadge]}>
              <Text style={[styles.historyBadgeText, item.source === 'manual' && styles.manualBadgeText]}>
                {item.source === 'manual' ? 'MANUAL' : 'INDICATOR'}
              </Text>
            </View>
            {item.is_superseded ? (
              <View style={[styles.historyBadge, styles.replacedBadge]}>
                <Text style={styles.replacedText}>REPLACED</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.historyMetaText}>{formatCaptureTime(item.captured_at)}</Text>
            {item.manual_reason ? <Text style={styles.historyMetaText}>Reason: {item.manual_reason}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function WeighPhoto({ photo }: { photo: PhotoOut }) {
  const [imageSource, setImageSource] = useState<{ uri: string; headers: { Authorization: string } } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function prepareImage() {
      try {
        const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getToken()]);
        if (!token) throw new Error('You are signed out. Sign in again to view photos.');
        const filePath = photo.file_path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
        if (active) {
          setImageSource({
            uri: `${baseUrl.replace(/\/+$/, '')}/uploads/${filePath}`,
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not prepare the photo.');
      }
    }

    prepareImage();
    return () => {
      active = false;
    };
  }, [photo.file_path]);

  if (errorMessage) {
    return <View style={styles.photoError}><Text style={styles.photoErrorText}>{errorMessage}</Text></View>;
  }
  if (!imageSource) return <View style={styles.photoLoading}><ActivityIndicator color="#64748b" /></View>;
  return (
    <Image
      source={imageSource}
      style={styles.photoImage}
      resizeMode="cover"
      onError={() => setErrorMessage('Could not load this photo.')}
    />
  );
}

function PhotoGroup({
  entry,
  kind,
  title,
  description,
  isBusy,
  onChoose,
}: {
  entry: PassDetailOut;
  kind: WeighmentKind;
  title: string;
  description: string;
  isBusy: boolean;
  onChoose: (kind: WeighmentKind, source: PhotoSource) => void;
}) {
  const weighment = entry.weighments.find(item => item.kind === kind && !item.is_superseded);
  const photos = entry.photos.filter(photo => {
    if (photo.kind !== 'weigh_frame' || photo.weighment_id == null) return false;
    return entry.weighments.some(item => item.id === photo.weighment_id && item.kind === kind);
  });

  return (
    <View style={styles.photoSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.photoDescription}>{weighment ? description : 'Record this weight first, then add its photo.'}</Text>
      {weighment ? (
        <View style={styles.photoActions}>
          <TouchableOpacity
            style={[styles.photoActionButton, isBusy && styles.disabledButton]}
            disabled={isBusy}
            onPress={() => onChoose(kind, 'library')}
          >
            <Text style={styles.photoActionText}>Upload files</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.photoActionButton, isBusy && styles.disabledButton]}
            disabled={isBusy}
            onPress={() => onChoose(kind, 'camera')}
          >
            <Text style={styles.photoActionText}>{isBusy ? 'Opening camera...' : 'Capture photo'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {photos.length === 0 ? (
        <Text style={styles.noPhotos}>{weighment ? 'No photos yet. Upload a file or capture a photo.' : 'No photos yet.'}</Text>
      ) : (
        <View style={styles.photoGrid}>
          {photos.map(photo => (
            <View key={photo.id} style={styles.photoFrame}><WeighPhoto photo={photo} /></View>
          ))}
        </View>
      )}
    </View>
  );
}

function PhotoHeader({
  vehicleNumber,
  status,
  onClose,
}: {
  vehicleNumber: string;
  status: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerInfo}>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{formatPlate(vehicleNumber)}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close weighment" style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function WeighCaptureScreen({ route, navigation }: Props) {
  const { entryId, vehicleNumber, kind: initialKind = 'gross' } = route.params;
  const { data: entry, isLoading, error: loadError, refetch } = useEntryDetail(entryId);
  const [kind, setKind] = useState<WeighmentKind>(initialKind);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [manualReason, setManualReason] = useState('');
  const [supersedeReason, setSupersedeReason] = useState('');
  const [indicatorMessage, setIndicatorMessage] = useState('Checking weighbridge indicator...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  const captureWeighmentMutation = useCaptureWeighment();
  const readIndicatorMutation = useReadIndicator();
  const readIndicator = readIndicatorMutation.mutateAsync;
  const uploadPhotoMutation = useUploadEntryPhoto();
  const isCapturing = captureWeighmentMutation.isPending;
  const isUploadingPhoto = uploadPhotoMutation.isPending;
  const currentWeight = kind === 'gross' ? entry?.current_gross_kg : entry?.current_tare_kg;
  const hasExisting = currentWeight != null;
  const headerStatus = entry?.pass_state === 'GATE_IN' || entry?.pass_state === 'ON_SITE'
    ? 'ON SITE'
    : (entry?.pass_state ?? 'ON SITE').replace(/_/g, ' ');

  const tryIndicator = useCallback(async () => {
    setIndicatorMessage('Checking weighbridge indicator...');
    try {
      const reading = await readIndicator();
      if (!reading.available) {
        setIndicatorMessage('No weighbridge indicator is connected. Enter weights manually.');
        return;
      }
      if (reading.weight_kg != null) {
        setWeight(String(reading.weight_kg));
        setUnit('kg');
      }
      setIndicatorMessage(
        reading.weight_kg == null
          ? 'Indicator is connected, but no weight is available.'
          : reading.stable
            ? 'Stable indicator reading loaded.'
            : 'Indicator reading is not stable yet. Re-check before saving.',
      );
    } catch (error) {
      setIndicatorMessage(extractErrorMessage(error, 'Could not read the indicator.'));
    }
  }, [readIndicator]);

  useEffect(() => {
    tryIndicator();
  }, [tryIndicator]);

  const numericWeight = Number(weight);
  const canSubmit =
    weight.trim().length > 0 &&
    Number.isFinite(numericWeight) &&
    numericWeight > 0 &&
    manualReason.trim().length >= 3 &&
    (!hasExisting || supersedeReason.trim().length >= 3) &&
    !isCapturing;

  async function handleCapture() {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await captureWeighmentMutation.mutateAsync({
        entryId,
        payload: {
          kind,
          source: 'manual',
          weight: numericWeight,
          unit,
          manual_reason: manualReason.trim(),
          supersede_reason: hasExisting ? supersedeReason.trim() : undefined,
        },
      });
      setSuccessMessage(`${kind === 'gross' ? 'Gross' : 'Tare'} weight captured for ${vehicleNumber}.`);
      setWeight('');
      setManualReason('');
      setSupersedeReason('');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not capture the weight.'));
    }
  }

  async function ensureCameraPermission(): Promise<boolean> {
    try {
      const permission = Platform.select({
        ios: PERMISSIONS.IOS.CAMERA,
        default: PERMISSIONS.ANDROID.CAMERA,
      });
      if (!permission) {
        setErrorMessage('Camera permission is not available on this device.');
        return false;
      }
      let status = await check(permission);
      if (status === RESULTS.GRANTED) return true;
      if (status === RESULTS.BLOCKED || status === RESULTS.UNAVAILABLE) {
        setErrorMessage('Camera access is blocked or unavailable. Enable it in Settings or upload an image.');
        return false;
      }
      status = await request(permission);
      if (status === RESULTS.GRANTED) return true;
      setErrorMessage('Camera access was not granted. You can still upload an image.');
      return false;
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not request camera access.'));
      return false;
    }
  }

  async function handleChoosePhoto(photoKind: WeighmentKind, source: PhotoSource) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPhotoMessage(null);
    if (source === 'camera' && !(await ensureCameraPermission())) return;

    setIsPickingPhoto(true);
    try {
      const result = source === 'camera'
        ? await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8, maxWidth: 2048, maxHeight: 2048 })
        : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0, quality: 0.8, maxWidth: 2048, maxHeight: 2048 });

      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || `Image selection failed (${result.errorCode}).`);
      const assets = result.assets ?? [];
      if (assets.length === 0) {
        setErrorMessage('No image was selected.');
        return;
      }

      const weighment = entry?.weighments.find(item => item.kind === photoKind && !item.is_superseded);
      if (!weighment) {
        setErrorMessage(`Record the ${photoKind} weight before adding its photo.`);
        return;
      }

      setIsPickingPhoto(false);
      let uploaded = 0;
      const failures: string[] = [];
      for (const asset of assets) {
        if (!asset.uri) {
          failures.push(`${asset.fileName || 'Selected image'} has no file location.`);
          continue;
        }
        const uploadAsset: PhotoUploadAsset = {
          uri: asset.uri,
          name: asset.fileName || `weigh-${photoKind}.jpg`,
          type: asset.type || 'image/jpeg',
        };
        try {
          await uploadPhotoMutation.mutateAsync({
            entryId,
            asset: uploadAsset,
            kind: 'weigh_frame',
            weighmentId: weighment.id,
          });
          uploaded += 1;
        } catch (error) {
          failures.push(`${asset.fileName || 'Photo'}: ${extractErrorMessage(error, 'Upload failed.')}`);
        }
      }
      await refetch();
      if (failures.length > 0) {
        setErrorMessage(`${uploaded > 0 ? `${uploaded} photo(s) uploaded. ` : ''}${failures.join(' ')}`);
      } else {
        setPhotoMessage(`${uploaded} photo(s) uploaded.`);
      }
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not open the camera or image picker.'));
    } finally {
      setIsPickingPhoto(false);
    }
  }

  const entryError = loadError ? extractErrorMessage(loadError, 'Could not load this pass.') : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.screen}>
        <PhotoHeader vehicleNumber={vehicleNumber} status={headerStatus} onClose={() => navigation.goBack()} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {isLoading ? (
            <View style={styles.loadingArea}><ActivityIndicator size="large" color="#b8410e" /></View>
          ) : !entry ? (
            <View>
              <ErrorBanner message={entryError ?? 'Pass not found.'} />
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.indicatorNotice}>
                <Text style={styles.indicatorText}>{indicatorMessage}</Text>
                <TouchableOpacity onPress={tryIndicator} disabled={readIndicatorMutation.isPending}>
                  <Text style={styles.indicatorAction}>{readIndicatorMutation.isPending ? 'Checking...' : 'Read indicator'}</Text>
                </TouchableOpacity>
              </View>

              {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
              {successMessage ? <Text style={styles.successMessage}>{successMessage}</Text> : null}
              {photoMessage ? <Text style={styles.photoMessage}>{photoMessage}</Text> : null}

              <View style={styles.formCard}>
                <SelectField label="Weighment" value={kind} options={KIND_OPTIONS} onChange={setKind} />

                <FieldLabel label="Weight *" />
                <Input
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="Enter weight"
                  style={styles.weightInput}
                />

                <SelectField label="Unit" value={unit} options={UNIT_OPTIONS} onChange={setUnit} />

                <FieldLabel label="Reason for manual entry *" />
                <Input
                  value={manualReason}
                  onChangeText={setManualReason}
                  placeholder="Enter reason"
                  multiline
                  style={styles.reasonInput}
                />
                <Text style={styles.helperText}>At least 3 characters. Kept in the pass history.</Text>

                {hasExisting ? (
                  <>
                    <FieldLabel label="Reason for replacing the current weight *" />
                    <Input
                      value={supersedeReason}
                      onChangeText={setSupersedeReason}
                      placeholder="Enter reason"
                      multiline
                      style={styles.reasonInput}
                    />
                    <Text style={styles.helperText}>At least 3 characters. Kept in the pass history.</Text>
                  </>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.captureButton, (!canSubmit || isCapturing) && styles.disabledButton]}
                  disabled={!canSubmit || isCapturing}
                  onPress={handleCapture}
                >
                  {isCapturing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.captureButtonText}>Save manual weight</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.summaryRow}>
                <WeightSummary label="Loaded (gross)" value={entry.current_gross_kg} />
                <WeightSummary label="Empty (tare)" value={entry.current_tare_kg} />
                <WeightSummary label="Net material" value={entry.net_kg} />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Weighment history</Text>
                <WeighmentHistory weighments={entry.weighments ?? []} />
              </View>

              <PhotoGroup
                entry={entry}
                kind="gross"
                title="Loaded vehicle photos (gross)"
                description="The vehicle with material on the weighbridge."
                isBusy={isPickingPhoto || isUploadingPhoto}
                onChoose={handleChoosePhoto}
              />
              <PhotoGroup
                entry={entry}
                kind="tare"
                title="Empty vehicle photos (tare)"
                description="The empty vehicle on the weighbridge."
                isBusy={isPickingPhoto || isUploadingPhoto}
                onChoose={handleChoosePhoto}
              />
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function WeightSummary({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{formatWeight(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0e1722' },
  screen: { flex: 1, backgroundColor: background },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0e1722', paddingHorizontal: 10, paddingVertical: 8 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  plate: { backgroundColor: '#facc15', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  plateText: { color: '#151515', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fbf4e3', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a77916' },
  statusText: { color: '#80600f', fontSize: 9, fontWeight: '700' },
  closeButton: { width: 42, height: 42, borderRadius: 7, borderWidth: 2, borderColor: '#45505d', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 28, lineHeight: 31, fontWeight: '300' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 7, paddingTop: 16, paddingBottom: 24 },
  loadingArea: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  retryButton: { alignSelf: 'center', backgroundColor: '#b8410e', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  indicatorNotice: { ...raisedSurface, borderRadius: 12, padding: 11, marginBottom: 14 },
  indicatorText: { color: '#526171', fontSize: 12, lineHeight: 18 },
  indicatorAction: { color: '#b8410e', fontSize: 11, fontWeight: '700', marginTop: 6 },
  formCard: { ...raisedSurface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  selectField: { ...insetSurfaceStyle, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14 },
  selectText: { color: '#1d2938', fontSize: 14 },
  selectChevron: { color: '#526171', fontSize: 19, marginTop: -4 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.38)', padding: 24 },
  modalCard: { ...raisedSurface, width: '100%', maxWidth: 360, borderRadius: 14, padding: 8, elevation: 8 },
  modalOption: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8 },
  modalOptionActive: { backgroundColor: '#fceee6' },
  modalOptionText: { color: '#15263a', fontSize: 14 },
  modalOptionTextActive: { color: '#b8410e', fontWeight: '700' },
  weightInput: { minHeight: 52, fontSize: 15 },
  reasonInput: { minHeight: 52, textAlignVertical: 'top', fontSize: 14 },
  helperText: { color: '#91620b', fontSize: 10, marginTop: 4, marginBottom: 4 },
  captureButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b8410e', borderRadius: 9, paddingHorizontal: 12, marginTop: 14, marginBottom: 4 },
  captureButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  successMessage: { color: '#18734a', fontSize: 12, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  photoMessage: { color: '#18734a', fontSize: 12, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  summaryRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  summaryCard: { ...raisedSurface, flex: 1, minHeight: 60, justifyContent: 'center', borderRadius: 11, paddingHorizontal: 7, paddingVertical: 8 },
  summaryLabel: { color: '#526171', fontSize: 9, fontWeight: '600', marginBottom: 4 },
  summaryValue: { color: '#15263a', fontSize: 12, fontWeight: '700' },
  section: { ...raisedSurface, borderRadius: 12, padding: 12, marginBottom: 14 },
  sectionTitle: { color: '#15263a', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: '#526171', fontSize: 12 },
  historyList: { gap: 7 },
  historyItem: { ...raisedSurface, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  historyItemSuperseded: { opacity: 0.6 },
  historyMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  historyKind: { color: '#34445a', fontSize: 11, fontWeight: '600' },
  historyWeight: { color: '#15263a', fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  historyBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  manualBadge: { backgroundColor: '#f8f0da' },
  indicatorBadge: { backgroundColor: '#e8f1fa' },
  historyBadgeText: { color: '#47617c', fontSize: 9, fontWeight: '700' },
  manualBadgeText: { color: '#80600f' },
  replacedBadge: { backgroundColor: '#eef1f5' },
  replacedText: { color: '#64748b', fontSize: 9, fontWeight: '700' },
  historyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  historyMetaText: { color: '#526171', fontSize: 10 },
  photoSection: { marginBottom: 14 },
  photoDescription: { color: '#526171', fontSize: 11, marginTop: -5, marginBottom: 8 },
  photoActions: { gap: 6, marginBottom: 8 },
  photoActionButton: { ...raisedSurface, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  photoActionText: { color: '#15263a', fontSize: 11, fontWeight: '700' },
  noPhotos: { color: '#526171', fontSize: 11, textAlign: 'center', backgroundColor: '#f7f8fa', padding: 16, borderRadius: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoFrame: { ...raisedSurface, width: '48%', height: 118, borderRadius: 9, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#fdeaea' },
  photoErrorText: { color: '#a83227', fontSize: 10, textAlign: 'center' },
});
