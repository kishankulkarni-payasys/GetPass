import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/TabNavigator';
import { EntryPhotoKind, PhotoUploadAsset } from '../../api/entries';
import { useCreateEntry, useUploadEntryPhoto } from '../../queries/useEntryQueries';
import { ChallanLineIn, PassType } from '../../types/entries';
import { ErrorBanner, FieldLabel, Input } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = MainTabScreenProps<'GateInTab'>;
type PhotoAssets = Partial<Record<EntryPhotoKind, Asset>>;

interface ChallanLineDraft {
  key: number;
  material: string;
  quantity: string;
  uom: string;
}

interface PendingPhoto {
  kind: EntryPhotoKind;
  asset: Asset;
}

interface PendingPhotoUpload {
  entryId: number;
  items: PendingPhoto[];
}

const PASS_TYPE_OPTIONS: { value: PassType; label: string }[] = [
  { value: 'inward', label: 'Inward material' },
  { value: 'general', label: 'Other vehicle' },
];

const MAX_CHALLAN_LINES = 20;

const PHOTO_TILES: Array<{ kind: EntryPhotoKind; label: string; hint: string }> = [
  { kind: 'plate', label: 'Number plate', hint: 'Photo of the front plate' },
  { kind: 'po_doc', label: 'PO document', hint: 'Photo of the purchase order' },
  { kind: 'challan_doc', label: 'Challan', hint: 'Photo of the delivery challan' },
];

const QR_FIELD_LIMITS: Record<string, number> = {
  vehicle_number: 20,
  driver_name: 100,
  driver_phone: 20,
  po_number: 50,
  challan_number: 50,
  supplier_transporter_name: 100,
  reference_doc_number: 50,
  purpose: 50,
  material_description: 200,
  material_unit: 20,
};

const QR_FIELD_ALIASES: Record<string, string> = {
  supplier: 'supplier_transporter_name',
  supplier_name: 'supplier_transporter_name',
  po: 'po_number',
  challan: 'challan_number',
  plate: 'vehicle_number',
};

const QR_FIELD_STATE: Record<string, 'vehicle' | 'driver' | 'phone' | 'po' | 'challan' | 'supplier' | 'purpose' | 'material'> = {
  vehicle_number: 'vehicle',
  driver_name: 'driver',
  driver_phone: 'phone',
  po_number: 'po',
  challan_number: 'challan',
  supplier_transporter_name: 'supplier',
  purpose: 'purpose',
  material_description: 'material',
};

function parseQrPayload(rawValue: string): Partial<Record<keyof typeof QR_FIELD_STATE, string>> {
  let parsed: unknown = rawValue;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    parsed = rawValue;
  }

  const source =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { vehicle_number: parsed };
  const result: Partial<Record<keyof typeof QR_FIELD_STATE, string>> = {};

  for (const [key, value] of Object.entries(source)) {
    const field = QR_FIELD_ALIASES[key] ?? key;
    if (!(field in QR_FIELD_LIMITS) || !(field in QR_FIELD_STATE)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const cleaned = String(value).trim().slice(0, QR_FIELD_LIMITS[field]);
    if (cleaned) result[field as keyof typeof QR_FIELD_STATE] = cleaned;
  }
  return result;
}

function newLine(key: number): ChallanLineDraft {
  return { key, material: '', quantity: '', uom: '' };
}

function isLineStarted(line: ChallanLineDraft): boolean {
  return Boolean(line.material.trim() || line.quantity.trim() || line.uom.trim());
}

function isLineComplete(line: ChallanLineDraft): boolean {
  const quantity = Number(line.quantity);
  return Boolean(
    line.material.trim() &&
      line.quantity.trim() &&
      Number.isFinite(quantity) &&
      quantity >= 0 &&
      line.uom.trim(),
  );
}

function toUploadAsset(asset: Asset): PhotoUploadAsset | null {
  if (!asset.uri) return null;
  return {
    uri: asset.uri,
    name: asset.fileName || 'gate-in-photo.jpg',
    type: asset.type || 'image/jpeg',
  };
}

type UploadPhoto = (args: { entryId: number; asset: PhotoUploadAsset; kind: EntryPhotoKind }) => Promise<unknown>;

async function uploadPhotos(
  entryId: number,
  items: PendingPhoto[],
  uploadPhoto: UploadPhoto,
): Promise<{
  failed: PendingPhoto[];
  errors: string[];
}> {
  const failed: PendingPhoto[] = [];
  const errors: string[] = [];
  for (const item of items) {
    const asset = toUploadAsset(item.asset);
    if (!asset) {
      failed.push(item);
      errors.push(`${item.kind}: the selected image has no file location.`);
      continue;
    }
    try {
      await uploadPhoto({ entryId, asset, kind: item.kind });
    } catch (error) {
      failed.push(item);
      errors.push(`${item.kind}: ${extractErrorMessage(error, 'Upload failed.')}`);
    }
  }
  return { failed, errors };
}

function PassTypeSwitch({ value, onChange }: { value: PassType; onChange: (value: PassType) => void }) {
  return (
    <View style={styles.segmented}>
      {PASS_TYPE_OPTIONS.map(option => (
        <TouchableOpacity
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          style={[styles.segment, value === option.value && styles.segmentActive]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PhotoTile({
  label,
  hint,
  photo,
  disabled,
  onTakePhoto,
  onChooseFile,
}: {
  label: string;
  hint: string;
  photo?: Asset;
  disabled: boolean;
  onTakePhoto: () => void;
  onChooseFile: () => void;
}) {
  return (
    <View style={styles.photoCard}>
      <View style={styles.photoFrame}>
        {photo?.uri ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <Text style={styles.photoHint}>{hint}</Text>
        )}
        <View style={styles.photoLabel}><Text style={styles.photoLabelText}>{label}</Text></View>
      </View>
      <Text style={styles.photoNote}>
        {photo ? 'Photo is ready to save with the pass.' : 'Photo is saved with the pass. Type the details below.'}
      </Text>
      <View style={styles.photoActions}>
        <ActionButton label="Take photo" onPress={onTakePhoto} disabled={disabled} />
        <ActionButton label="Choose file" onPress={onChooseFile} disabled={disabled} secondary />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[
        styles.actionButton,
        secondary ? styles.actionButtonSecondary : styles.actionButtonPrimary,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function NewEntryScreen({ navigation }: Props) {
  const nextLineKey = useRef(1);
  const qrHandled = useRef(false);
  const [passType, setPassType] = useState<PassType>('inward');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [challanLines, setChallanLines] = useState<ChallanLineDraft[]>([newLine(0)]);
  const [purpose, setPurpose] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [gateInMethod, setGateInMethod] = useState<'manual' | 'qr'>('manual');
  const [photos, setPhotos] = useState<PhotoAssets>({});
  const [pendingUpload, setPendingUpload] = useState<PendingPhotoUpload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingPhotos, setIsRetryingPhotos] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const createEntryMutation = useCreateEntry();
  const uploadEntryPhotoMutation = useUploadEntryPhoto();

  function updateLine(key: number, patch: Partial<ChallanLineDraft>) {
    setChallanLines(lines => lines.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    if (challanLines.length >= MAX_CHALLAN_LINES) return;
    const key = nextLineKey.current++;
    setChallanLines(lines => [...lines, newLine(key)]);
  }

  function removeLine(key: number) {
    setChallanLines(lines => lines.filter(line => line.key !== key));
  }

  function resetForm(preserveNotices = false) {
    setVehicleNumber('');
    setDriverName('');
    setDriverPhone('');
    setSupplierName('');
    setPoNumber('');
    setChallanNumber('');
    setChallanLines([newLine(nextLineKey.current++)]);
    setPurpose('');
    setMaterialDescription('');
    setGateInMethod('manual');
    setPhotos({});
    if (!preserveNotices) {
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }

  function buildChallanLines(): ChallanLineIn[] {
    return challanLines
      .filter(isLineComplete)
      .map(line => ({
        material: line.material.trim(),
        quantity: Number(line.quantity),
        uom: line.uom.trim(),
      }));
  }

  const requiredInwardFieldsFilled = Boolean(
    vehicleNumber.trim() && driverName.trim() && poNumber.trim() && challanNumber.trim(),
  );
  const hasCompleteLine = challanLines.some(isLineComplete);
  const hasPartialLine = challanLines.some(line => isLineStarted(line) && !isLineComplete(line));
  const canSubmit =
    !isSubmitting &&
    !isRetryingPhotos &&
    !pendingUpload &&
    (passType === 'inward'
      ? requiredInwardFieldsFilled &&
        hasCompleteLine &&
        !hasPartialLine &&
        challanLines.length <= MAX_CHALLAN_LINES
      : Boolean(vehicleNumber.trim() && driverName.trim()));

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
        setErrorMessage('Camera access is blocked or unavailable. Enable it in Settings or choose an image file.');
        return false;
      }

      status = await request(permission);
      if (status === RESULTS.GRANTED) return true;
      setErrorMessage('Camera access was not granted. You can still choose an image file.');
      return false;
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not request camera access.'));
      return false;
    }
  }

  async function handlePhoto(kind: EntryPhotoKind, source: 'camera' | 'library') {
    setErrorMessage(null);
    if (source === 'camera' && !(await ensureCameraPermission())) return;

    try {
      const result =
        source === 'camera'
          ? await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8, maxWidth: 2048, maxHeight: 2048 })
          : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8, maxWidth: 2048, maxHeight: 2048 });

      if (result.didCancel) return;
      if (result.errorCode) {
        throw new Error(result.errorMessage || `Image selection failed (${result.errorCode}).`);
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error('The selected image could not be opened.');
      }
      setPhotos(current => ({ ...current, [kind]: asset }));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not open the camera or image picker.'));
    }
  }

  async function openQrScanner() {
    setErrorMessage(null);
    if (!(await ensureCameraPermission())) return;
    qrHandled.current = false;
    setIsScannerOpen(true);
  }

  function handleQrScan(rawValue: string) {
    if (qrHandled.current) return;
    qrHandled.current = true;
    setIsScannerOpen(false);
    const values = parseQrPayload(rawValue);
    if (Object.keys(values).length === 0) {
      setErrorMessage('This QR code did not contain supported pass details. Enter the details manually.');
      return;
    }

    if (values.vehicle_number) setVehicleNumber(values.vehicle_number);
    if (values.driver_name) setDriverName(values.driver_name);
    if (values.driver_phone) setDriverPhone(values.driver_phone);
    if (values.po_number) setPoNumber(values.po_number);
    if (values.challan_number) setChallanNumber(values.challan_number);
    if (values.supplier_transporter_name) setSupplierName(values.supplier_transporter_name);
    if (values.purpose) setPurpose(values.purpose);
    if (values.material_description) setMaterialDescription(values.material_description);
    setGateInMethod('qr');
  }

  async function retryPhotoUploads() {
    if (!pendingUpload || isRetryingPhotos) return;
    setIsRetryingPhotos(true);
    setErrorMessage(null);
    try {
      const result = await uploadPhotos(pendingUpload.entryId, pendingUpload.items, uploadEntryPhotoMutation.mutateAsync);
      if (result.failed.length === 0) {
        setPendingUpload(null);
        setSuccessMessage('All selected photos are now attached to the pass.');
      } else {
        setPendingUpload({ ...pendingUpload, items: result.failed });
        setErrorMessage(`Some photos could not be uploaded. ${result.errors.join(' ')}`);
      }
    } finally {
      setIsRetryingPhotos(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const entry = await createEntryMutation.mutateAsync({
        vehicle_number: vehicleNumber.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim() || undefined,
        supplier_transporter_name: supplierName.trim() || undefined,
        pass_type: passType,
        gate_in_method: gateInMethod,
        po_number: passType === 'inward' ? poNumber.trim() : undefined,
        challan_number: passType === 'inward' ? challanNumber.trim() : undefined,
        challan_lines: passType === 'inward' ? buildChallanLines() : undefined,
        purpose: passType === 'general' ? purpose.trim() || undefined : undefined,
        material_description: passType === 'general' ? materialDescription.trim() || undefined : undefined,
      });

      setSuccessMessage(`Pass created for ${entry.vehicle_number}.`);
      const selectedPhotos = passType === 'inward'
        ? PHOTO_TILES.flatMap(({ kind }) => {
            const asset = photos[kind];
            return asset ? [{ kind, asset }] : [];
          })
        : [];
      if (selectedPhotos.length > 0) {
        const result = await uploadPhotos(entry.id, selectedPhotos, uploadEntryPhotoMutation.mutateAsync);
        if (result.failed.length > 0) {
          setPendingUpload({ entryId: entry.id, items: result.failed });
          setErrorMessage(`The pass was created, but some photos could not be uploaded. Retry the upload below. ${result.errors.join(' ')}`);
        }
      }
      resetForm(true);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not create the pass. Check the details and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitHint =
    passType === 'inward'
      ? 'Fill in the fields marked * and at least one complete challan line.'
      : 'Vehicle number and driver name are required.';

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <PassTypeSwitch value={passType} onChange={setPassType} />
        <View style={styles.introBlock}>
          <Text style={styles.introText}>
            {passType === 'inward'
              ? 'Take photos of the number plate, PO and challan, then type the details below.'
              : 'Visitors, service and other vehicles. Vehicle number and driver name are required.'}
          </Text>
          <TouchableOpacity accessibilityRole="button" style={styles.qrButton} onPress={openQrScanner}>
            <Text style={styles.qrButtonText}>Scan QR code</Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
            <View style={styles.successActions}>
              <TouchableOpacity onPress={() => navigation.navigate('EntryList', { mode: 'open' })}>
                <Text style={styles.link}>View open passes</Text>
              </TouchableOpacity>
              {pendingUpload ? (
                <TouchableOpacity onPress={retryPhotoUploads} disabled={isRetryingPhotos}>
                  <Text style={[styles.link, isRetryingPhotos && styles.mutedLink]}>
                    {isRetryingPhotos ? 'Uploading...' : 'Retry photo upload'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {passType === 'inward' ? (
          <View style={styles.photoList}>
            {PHOTO_TILES.map(tile => (
              <PhotoTile
                key={tile.kind}
                label={tile.label}
                hint={tile.hint}
                photo={photos[tile.kind]}
                disabled={isSubmitting || isRetryingPhotos}
                onTakePhoto={() => handlePhoto(tile.kind, 'camera')}
                onChooseFile={() => handlePhoto(tile.kind, 'library')}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Vehicle details</Text>
          <FieldLabel label="Vehicle number *" />
          <Input
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            autoCapitalize="characters"
            placeholder="MH12AB1234"
          />

          <FieldLabel label="Driver name *" />
          <Input value={driverName} onChangeText={setDriverName} placeholder="Driver's full name" />

          <FieldLabel label="Driver phone" />
          <Input value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" placeholder="10-digit number" />

          <FieldLabel label="Supplier / transporter" />
          <Input value={supplierName} onChangeText={setSupplierName} placeholder="Supplier or transporter name" />

          {passType === 'inward' ? (
            <>
              <FieldLabel label="PO number *" />
              <Input value={poNumber} onChangeText={setPoNumber} autoCapitalize="characters" placeholder="PO number" />

              <FieldLabel label="Challan number *" />
              <Input value={challanNumber} onChangeText={setChallanNumber} placeholder="Challan number" />

              <View style={styles.challanHeading}>
                <Text style={styles.sectionTitle}>Challan lines</Text>
                <Text style={styles.lineCount}>{challanLines.length} of {MAX_CHALLAN_LINES}</Text>
              </View>
              {challanLines.map((line, index) => (
                <View key={line.key} style={styles.challanLine}>
                  <View style={styles.lineNumber}><Text style={styles.lineNumberText}>{index + 1}</Text></View>
                  <Input
                    style={styles.lineMaterial}
                    value={line.material}
                    onChangeText={text => updateLine(line.key, { material: text })}
                    placeholder="Material"
                  />
                  <Input
                    style={styles.lineQuantity}
                    value={line.quantity}
                    onChangeText={text => updateLine(line.key, { quantity: text })}
                    keyboardType="decimal-pad"
                    placeholder="Qty"
                  />
                  <Input
                    style={styles.lineUom}
                    value={line.uom}
                    onChangeText={text => updateLine(line.key, { uom: text })}
                    placeholder="UOM"
                  />
                  {challanLines.length > 1 ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Remove challan line ${index + 1}`}
                      style={styles.removeLine}
                      onPress={() => removeLine(line.key)}
                    >
                      <Text style={styles.removeLineText}>X</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.addLineButton, challanLines.length >= MAX_CHALLAN_LINES && styles.disabled]}
                onPress={addLine}
                disabled={challanLines.length >= MAX_CHALLAN_LINES}
              >
                <Text style={styles.addLineText}>+ Add another line</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <FieldLabel label="Purpose" />
              <Input value={purpose} onChangeText={setPurpose} placeholder="Reason for visit" />

              <FieldLabel label="Material description" />
              <Input
                value={materialDescription}
                onChangeText={setMaterialDescription}
                placeholder="What is on the vehicle"
              />
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Text style={styles.actionHint}>{submitHint}</Text>
        <View style={styles.actionRow}>
          <ActionButton
            label="Re-scan"
            onPress={() => resetForm()}
            disabled={isSubmitting || isRetryingPhotos || Boolean(pendingUpload)}
            secondary
          />
          <ActionButton
            label={isSubmitting ? 'Creating pass...' : passType === 'inward' ? 'Confirm & create pass' : 'Create pass'}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        </View>
      </View>

      <Modal
        visible={isScannerOpen}
        animationType="slide"
        onRequestClose={() => setIsScannerOpen(false)}
      >
        <View style={styles.scannerScreen}>
          <Camera
            style={styles.scannerCamera}
            cameraType={CameraType.Back}
            scanBarcode
            showFrame
            frameColor="#fff"
            laserColor="#e85d1f"
            allowedBarcodeTypes={['qr']}
            scanThrottleDelay={500}
            onReadCode={event => handleQrScan(event.nativeEvent.codeStringValue)}
            onError={event => {
              setIsScannerOpen(false);
              setErrorMessage(event.nativeEvent.errorMessage || 'The QR scanner could not start.');
            }}
          />
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR code</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setIsScannerOpen(false)}>
              <Text style={styles.scannerClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.scannerHint}>Place the QR code inside the frame.</Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 16 },
  segmented: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2e8',
    padding: 4,
    marginBottom: 18,
  },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  segmentActive: { backgroundColor: '#fff', elevation: 1 },
  segmentText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: '#b8410e' },
  introBlock: { marginBottom: 12 },
  introText: { color: '#17202b', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  qrButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dce2e8',
    backgroundColor: '#fff',
  },
  qrButtonText: { color: '#17202b', fontSize: 11, fontWeight: '700' },
  photoList: { gap: 10 },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2e8',
    padding: 8,
  },
  photoFrame: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#0f1720',
  },
  photoPreview: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  photoLabel: { position: 'absolute', top: 8, left: 8, backgroundColor: '#050b12', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  photoLabelText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  photoHint: { color: '#cbd5e1', fontSize: 11, textAlign: 'center' },
  photoNote: { color: '#526171', fontSize: 10, lineHeight: 15, marginTop: 8, marginBottom: 6 },
  photoActions: { flexDirection: 'row', gap: 6 },
  actionButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9 },
  actionButtonPrimary: { backgroundColor: '#b8410e' },
  actionButtonSecondary: { borderWidth: 1, borderColor: '#dce2e8', backgroundColor: '#fff' },
  actionButtonText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  actionButtonTextSecondary: { color: '#17202b' },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2e8',
    padding: 12,
    marginTop: 10,
  },
  sectionTitle: { color: '#17202b', fontSize: 14, fontWeight: '700' },
  challanHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 2 },
  lineCount: { color: '#64748b', fontFamily: 'monospace', fontSize: 10 },
  challanLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  lineNumber: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#eef1f5' },
  lineNumberText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  lineMaterial: { flex: 2 },
  lineQuantity: { flex: 1 },
  lineUom: { flex: 1 },
  removeLine: { paddingHorizontal: 4, paddingVertical: 8 },
  removeLineText: { color: '#b83232', fontSize: 12, fontWeight: '700' },
  addLineButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4, paddingRight: 8 },
  addLineText: { color: '#b8410e', fontSize: 11, fontWeight: '700' },
  successBanner: { backgroundColor: '#e8f6ee', borderRadius: 8, padding: 12, marginBottom: 12 },
  successText: { color: '#1e8e5a', fontSize: 12, fontWeight: '600' },
  successActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  link: { color: '#b8410e', fontSize: 11, fontWeight: '700', marginTop: 8 },
  mutedLink: { opacity: 0.6 },
  actionBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dce2e8', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  actionHint: { color: '#64748b', fontSize: 10, lineHeight: 14, marginBottom: 7 },
  actionRow: { flexDirection: 'row', gap: 8 },
  disabled: { opacity: 0.55 },
  scannerScreen: { flex: 1, justifyContent: 'space-between', backgroundColor: '#0b1118' },
  scannerCamera: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 18 },
  scannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scannerClose: { color: '#fff', fontSize: 13, fontWeight: '600', padding: 10 },
  scannerHint: { color: '#fff', fontSize: 12, textAlign: 'center', marginBottom: 48 },
});
