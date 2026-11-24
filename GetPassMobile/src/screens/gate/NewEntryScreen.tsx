import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MainTabScreenProps } from '../../navigation/TabNavigator';
import { createEntry } from '../../api/entries';
import { ChallanLineIn, PassType } from '../../types/entries';
import { Button, Card, ErrorBanner, FieldLabel, Input, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = MainTabScreenProps<'GateInTab'>;

// Mirrors Frontend/src/components/EntryForm.jsx's pass-type switch (inward vs general),
// and the fields on VehicleEntryCreate (Backend/app/schemas.py). OCR/PO-lookup/QR capture
// and the offline queue from the web app are left for a follow-up pass (see mobile report).
const PASS_TYPE_OPTIONS: { value: PassType; label: string }[] = [
  { value: 'inward', label: 'Inward (material)' },
  { value: 'general', label: 'General pass' },
];

function PassTypeSwitch({ value, onChange }: { value: PassType; onChange: (v: PassType) => void }) {
  return (
    <View style={styles.segmented}>
      {PASS_TYPE_OPTIONS.map(option => (
        <TouchableOpacity
          key={option.value}
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

interface ChallanLineDraft {
  material: string;
  quantity: string;
  uom: string;
}

function emptyLine(): ChallanLineDraft {
  return { material: '', quantity: '', uom: '' };
}

export default function NewEntryScreen({ navigation }: Props) {
  const [passType, setPassType] = useState<PassType>('inward');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [challanLines, setChallanLines] = useState<ChallanLineDraft[]>([emptyLine()]);
  const [purpose, setPurpose] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<ChallanLineDraft>) {
    setChallanLines(lines => lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setChallanLines(lines => [...lines, emptyLine()]);
  }

  function removeLine(index: number) {
    setChallanLines(lines => lines.filter((_, i) => i !== index));
  }

  function resetForm() {
    setVehicleNumber('');
    setDriverName('');
    setDriverPhone('');
    setSupplierName('');
    setPoNumber('');
    setChallanNumber('');
    setChallanLines([emptyLine()]);
    setPurpose('');
    setMaterialDescription('');
  }

  function buildChallanLines(): ChallanLineIn[] {
    return challanLines
      .filter(line => line.material.trim() && line.quantity.trim() && line.uom.trim())
      .map(line => ({ material: line.material.trim(), quantity: Number(line.quantity), uom: line.uom.trim() }));
  }

  const canSubmit = vehicleNumber.trim().length > 0 && driverName.trim().length > 0 && !isSubmitting;

  async function handleSubmit() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const entry = await createEntry({
        vehicle_number: vehicleNumber.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim() || undefined,
        supplier_transporter_name: supplierName.trim() || undefined,
        pass_type: passType,
        gate_in_method: 'manual',
        po_number: passType === 'inward' ? poNumber.trim() || undefined : undefined,
        challan_number: passType === 'inward' ? challanNumber.trim() || undefined : undefined,
        challan_lines: passType === 'inward' ? buildChallanLines() : undefined,
        purpose: passType === 'general' ? purpose.trim() || undefined : undefined,
        material_description: passType === 'general' ? materialDescription.trim() || undefined : undefined,
      });
      setSuccessMessage(`Pass created for ${entry.vehicle_number}.`);
      resetForm();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not create the pass. Check the details and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled">
      <Card>
        <PassTypeSwitch value={passType} onChange={setPassType} />

        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('EntryList', { mode: 'open' })}>
              <Text style={styles.link}>View open passes</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

        <FieldLabel label="Vehicle number *" />
        <Input value={vehicleNumber} onChangeText={setVehicleNumber} autoCapitalize="characters" placeholder="MH12AB1234" />

        <FieldLabel label="Driver name *" />
        <Input value={driverName} onChangeText={setDriverName} placeholder="Driver's full name" />

        <FieldLabel label="Driver phone" />
        <Input value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" placeholder="10-digit number" />

        <FieldLabel label="Supplier / transporter" />
        <Input value={supplierName} onChangeText={setSupplierName} placeholder="Supplier or transporter name" />

        {passType === 'inward' ? (
          <>
            <FieldLabel label="PO number" />
            <Input value={poNumber} onChangeText={setPoNumber} autoCapitalize="characters" placeholder="PO number" />

            <FieldLabel label="Challan number" />
            <Input value={challanNumber} onChangeText={setChallanNumber} placeholder="Challan number" />

            <FieldLabel label="Challan lines" />
            {challanLines.map((line, index) => (
              <View key={index} style={styles.lineRow}>
                <Input
                  style={styles.lineMaterial}
                  value={line.material}
                  onChangeText={text => updateLine(index, { material: text })}
                  placeholder="Material"
                />
                <Input
                  style={styles.lineQty}
                  value={line.quantity}
                  onChangeText={text => updateLine(index, { quantity: text })}
                  keyboardType="decimal-pad"
                  placeholder="Qty"
                />
                <Input
                  style={styles.lineUom}
                  value={line.uom}
                  onChangeText={text => updateLine(index, { uom: text })}
                  placeholder="UOM"
                />
                {challanLines.length > 1 ? (
                  <TouchableOpacity onPress={() => removeLine(index)} style={styles.removeLine}>
                    <Text style={styles.removeLineText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            <TouchableOpacity onPress={addLine}>
              <Text style={styles.link}>+ Add another line</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <FieldLabel label="Purpose" />
            <Input value={purpose} onChangeText={setPurpose} placeholder="Reason for visit" />

            <FieldLabel label="Material description" />
            <Input value={materialDescription} onChangeText={setMaterialDescription} placeholder="What is on the vehicle" />
          </>
        )}

        <View style={styles.submitRow}>
          <Button label="Create pass" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  segmented: { flexDirection: 'row', backgroundColor: '#eee', borderRadius: 8, padding: 4, marginBottom: 8 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.subtext },
  segmentTextActive: { color: '#fff' },
  submitRow: { marginTop: 20 },
  link: { color: colors.primary, fontWeight: '600', marginTop: 8 },
  successBanner: { backgroundColor: '#e8f6ee', borderRadius: 8, padding: 12, marginBottom: 12 },
  successText: { color: colors.success, fontWeight: '600', marginBottom: 4 },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  lineMaterial: { flex: 2 },
  lineQty: { flex: 1 },
  lineUom: { flex: 1 },
  removeLine: { paddingHorizontal: 6, paddingVertical: 6 },
  removeLineText: { color: colors.danger, fontSize: 16 },
});
