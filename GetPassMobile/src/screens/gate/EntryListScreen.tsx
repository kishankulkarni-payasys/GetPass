import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getEntry } from '../../api/entries';
import { useEntryList, useGateOutEntry } from '../../queries/useEntryQueries';
import { PassState, PassType, VehicleEntryOut } from '../../types/entries';
import { EmptyState, ErrorBanner, Input, LoadingView } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryList'>;
type Tone = 'good' | 'warn' | 'crit' | 'info' | 'neutral';
type ErpFilter = '' | 'posted' | 'pending' | 'failed' | 'not_required';
type FilterOption<T extends string> = { value: T; label: string };

const STATUS_TONE_STYLES: Record<Tone, ViewStyle> = {
  good: { backgroundColor: '#e8f5ed' },
  warn: { backgroundColor: '#f8f0da' },
  crit: { backgroundColor: '#fdeaea' },
  info: { backgroundColor: '#e9f1fb' },
  neutral: { backgroundColor: '#eef1f5' },
};

const STATUS_DOT_TONE_STYLES: Record<Tone, ViewStyle> = {
  good: { backgroundColor: '#2f855a' },
  warn: { backgroundColor: '#a77916' },
  crit: { backgroundColor: '#c0392b' },
  info: { backgroundColor: '#2d6cdf' },
  neutral: { backgroundColor: '#64748b' },
};

const STATUS_TEXT_TONE_STYLES: Record<Tone, TextStyle> = {
  good: { color: '#276749' },
  warn: { color: '#80600f' },
  crit: { color: '#a83227' },
  info: { color: '#2457a6' },
  neutral: { color: '#475569' },
};

const OPEN_STATES = new Set<PassState>([
  'GATE_IN',
  'ON_SITE',
  'QUALITY_PENDING',
  'QUALITY_RESOLVED',
  'GRN_DRAFT',
  'GRN_APPROVED',
]);
const ALL_STATES: PassState[] = [
  'GATE_IN',
  'ON_SITE',
  'QUALITY_PENDING',
  'QUALITY_RESOLVED',
  'GRN_DRAFT',
  'GRN_APPROVED',
  'GATE_OUT',
  'CANCELLED',
];

const PASS_TYPE_OPTIONS: FilterOption<PassType | ''>[] = [
  { value: '', label: 'Any' },
  { value: 'inward', label: 'Inward material' },
  { value: 'general', label: 'General' },
];

const ERP_OPTIONS: FilterOption<ErpFilter>[] = [
  { value: '', label: 'Any' },
  { value: 'posted', label: 'Posted' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'not_required', label: 'Not required' },
];

const STATE_LABELS: Record<PassState, string> = {
  GATE_IN: 'At gate',
  ON_SITE: 'On site',
  QUALITY_PENDING: 'Quality pending',
  QUALITY_RESOLVED: 'Quality resolved',
  GRN_DRAFT: 'GRN draft',
  GRN_APPROVED: 'GRN approved',
  GATE_OUT: 'Gate out',
  CANCELLED: 'Cancelled',
};

function stateOptions(states: PassState[]): FilterOption<PassState | ''>[] {
  return [{ value: '', label: 'Any' }, ...states.map(state => ({ value: state, label: STATE_LABELS[state] }))];
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(option => option.value === value)?.label ?? 'Any';

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel}`}
        style={styles.select}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.selectText}>{selectedLabel}</Text>
        <Text style={styles.selectChevron}>{'⌄'}</Text>
      </TouchableOpacity>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map(option => (
              <TouchableOpacity
                key={option.value || 'any'}
                style={styles.modalOption}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, option.value === value && styles.modalOptionSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(/\b(am|pm)\b/, match => match.toLowerCase());
}

function formatDwell(entry: VehicleEntryOut): string {
  let minutes = entry.dwell_minutes;
  if (minutes == null) {
    const enteredAt = new Date(entry.entry_time).getTime();
    const endedAt = entry.exit_time ? new Date(entry.exit_time).getTime() : Date.now();
    if (!Number.isFinite(enteredAt) || !Number.isFinite(endedAt)) return '--:--';
    minutes = Math.max(0, Math.floor((endedAt - enteredAt) / 60000));
  }
  const total = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatWeight(value?: number | null): string {
  return value == null ? 'Pending' : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
}

function getStatus(entry: VehicleEntryOut): { label: string; tone: Tone } {
  switch (entry.pass_state) {
    case 'GATE_IN':
      return entry.pass_type === 'inward'
        ? { label: 'WEIGH GROSS', tone: 'warn' }
        : { label: 'ON SITE', tone: 'warn' };
    case 'ON_SITE':
      return { label: 'UNLOADING', tone: 'warn' };
    case 'QUALITY_PENDING':
      return { label: 'QUALITY PENDING', tone: 'crit' };
    case 'QUALITY_RESOLVED':
      return { label: 'QUALITY RESOLVED', tone: 'good' };
    case 'GRN_DRAFT':
      return { label: 'GRN DRAFT', tone: 'good' };
    case 'GRN_APPROVED':
      if (entry.erp_status === 'posted') return { label: 'POSTED', tone: 'info' };
      if (entry.erp_status === 'pending' || entry.erp_status === 'failed') {
        return { label: 'ERP PENDING POST', tone: 'crit' };
      }
      if (entry.erp_status === 'not_required') return { label: 'NOT REQUIRED', tone: 'warn' };
      return { label: 'GRN APPROVED', tone: 'info' };
    case 'GATE_OUT':
      return { label: 'GATE OUT', tone: 'neutral' };
    case 'CANCELLED':
      return { label: 'CANCELLED', tone: 'neutral' };
  }
}

function getGateOutStatus(entry: VehicleEntryOut): { label: string; tone: Tone } {
  if (entry.pass_state === 'GRN_APPROVED') {
    if (entry.erp_status === 'not_required') return { label: 'RETURN ONLY — NO GRN', tone: 'warn' };
    if (entry.erp_status === 'pending' || entry.erp_status === 'failed') {
      return { label: 'GRN PENDING POST', tone: 'crit' };
    }
  }
  return getStatus(entry);
}

function isGateOutReady(entry: VehicleEntryOut): boolean {
  return (
    (entry.pass_type === 'inward' && entry.pass_state === 'GRN_APPROVED') ||
    (entry.pass_type === 'general' && entry.pass_state === 'GATE_IN')
  );
}

function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hasBothWeights(entry: VehicleEntryOut): boolean {
  return entry.current_gross_kg != null && entry.current_tare_kg != null;
}

function oldestFirst(a: VehicleEntryOut, b: VehicleEntryOut): number {
  return new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime();
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValue}>{children}</View>
    </View>
  );
}

function WeightDetails({ entry }: { entry: VehicleEntryOut }) {
  return (
    <View>
      <Text style={styles.weightLine}>Loaded (gross): <Text style={entry.current_gross_kg == null ? styles.pending : undefined}>{formatWeight(entry.current_gross_kg)}</Text></Text>
      <Text style={styles.weightLine}>Empty (tare): <Text style={entry.current_tare_kg == null ? styles.pending : undefined}>{formatWeight(entry.current_tare_kg)}</Text></Text>
      <Text style={styles.weightLine}>Net material: <Text style={entry.net_kg == null ? styles.pending : styles.netWeight}>{formatWeight(entry.net_kg)}</Text></Text>
    </View>
  );
}

function EntryCard({ entry, onPress }: { entry: VehicleEntryOut; onPress: () => void }) {
  const status = getStatus(entry);
  const quantity = entry.material_quantity == null
    ? ''
    : ` (${entry.material_quantity}${entry.material_unit ? ` ${entry.material_unit}` : ''})`;
  const material = entry.material_description ? `${entry.material_description}${quantity}` : '-';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={styles.caption}>{entry.pass_type === 'inward' ? 'INWARD MATERIAL' : 'GENERAL PASS'}</Text>
          <View style={styles.plate}>
            <Text style={styles.plateText}>{formatPlate(entry.vehicle_number)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, STATUS_TONE_STYLES[status.tone]]}>
          <View style={[styles.statusDot, STATUS_DOT_TONE_STYLES[status.tone]]} />
          <Text style={[styles.statusText, STATUS_TEXT_TONE_STYLES[status.tone]]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <DetailRow label="PO / Challan">
          {entry.po_number || entry.challan_number ? (
            <View>
              {entry.po_number ? <Text style={styles.mono}>PO {entry.po_number}</Text> : null}
              {entry.challan_number ? <Text style={styles.mono}>Challan {entry.challan_number}</Text> : null}
            </View>
          ) : (
            <Text style={styles.mono}>{entry.reference_doc_number || '-'}</Text>
          )}
        </DetailRow>
        <DetailRow label="Driver"><Text style={styles.valueText}>{entry.driver_name || '-'}</Text></DetailRow>
        <DetailRow label="Material"><Text style={styles.valueText}>{material}</Text></DetailRow>
        <DetailRow label="Weight (kg)"><WeightDetails entry={entry} /></DetailRow>
        <DetailRow label="Entry"><Text style={styles.valueText}>{formatDateTime(entry.entry_time)}</Text></DetailRow>
        <DetailRow label="Time on site"><Text style={[styles.valueText, styles.mono]}>{formatDwell(entry)}</Text></DetailRow>
      </View>

      <TouchableOpacity accessibilityRole="button" style={styles.openButton} onPress={onPress}>
        <Text style={styles.openButtonText}>Open pass</Text>
      </TouchableOpacity>
    </View>
  );
}

function GateOutCard({
  entry,
  canLetOut,
  isActing,
  onOpen,
  onLetOut,
}: {
  entry: VehicleEntryOut;
  canLetOut: boolean;
  isActing: boolean;
  onOpen: () => void;
  onLetOut: () => void;
}) {
  const status = getGateOutStatus(entry);
  const isInward = entry.pass_type === 'inward';
  const weighed = hasBothWeights(entry);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={styles.caption}>{isInward ? 'INWARD MATERIAL' : 'GENERAL PASS'}</Text>
          <View style={styles.plate}>
            <Text style={styles.plateText}>{formatPlate(entry.vehicle_number)}</Text>
          </View>
          {entry.supplier_transporter_name ? (
            <Text style={styles.gateOutSupplier}>{entry.supplier_transporter_name}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, STATUS_TONE_STYLES[status.tone]]}>
          <View style={[styles.statusDot, STATUS_DOT_TONE_STYLES[status.tone]]} />
          <Text style={[styles.statusText, STATUS_TEXT_TONE_STYLES[status.tone]]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.details}>
        {isInward ? (
          <>
            <DetailRow label="PO"><Text style={styles.mono}>{entry.po_number || '-'}</Text></DetailRow>
            <DetailRow label="Challan"><Text style={styles.mono}>{entry.challan_number || '-'}</Text></DetailRow>
          </>
        ) : null}
        <DetailRow label="Driver"><Text style={styles.valueText}>{entry.driver_name || '-'}</Text></DetailRow>
        <DetailRow label="Entry"><Text style={styles.valueText}>{formatDateTime(entry.entry_time)}</Text></DetailRow>
        <DetailRow label="Time on site"><Text style={[styles.valueText, styles.mono]}>{formatDwell(entry)}</Text></DetailRow>
        <DetailRow label="Weight (kg)"><WeightDetails entry={entry} /></DetailRow>
      </View>

      {canLetOut ? (
        <>
          {!weighed ? <Text style={styles.needsWeights}>Needs both weights before it can leave.</Text> : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Let ${entry.vehicle_number} out`}
            style={[styles.gateOutButton, (!weighed || isActing) && styles.gateOutButtonDisabled]}
            disabled={!weighed || isActing}
            onPress={onLetOut}
          >
            <Text style={styles.gateOutButtonText}>{isActing ? 'Letting out...' : 'Let out'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity accessibilityRole="button" style={styles.openButton} onPress={onOpen}>
          <Text style={styles.openButtonText}>Open pass</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function EntryListScreen({ route, navigation }: Props) {
  const mode = route.params?.mode ?? 'open';
  const [search, setSearch] = useState('');
  const [passTypeFilter, setPassTypeFilter] = useState<PassType | ''>('');
  const [stateFilter, setStateFilter] = useState<PassState | ''>('');
  const [erpFilter, setErpFilter] = useState<ErpFilter>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFiltersOpen, setDateFiltersOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingEntryId, setActingEntryId] = useState<number | null>(null);

  const {
    data: fetchedEntries,
    isLoading,
    isRefetching: isRefreshing,
    error: loadError,
    refetch,
  } = useEntryList();
  const gateOutMutation = useGateOutEntry();

  const allEntries = fetchedEntries ?? [];
  const entries = mode === 'open' ? allEntries.filter(entry => OPEN_STATES.has(entry.pass_state)) : allEntries;
  const errorMessage = actionError ?? (loadError ? extractErrorMessage(loadError, 'Could not load passes.') : null);

  const states = mode === 'open' ? [...OPEN_STATES] : ALL_STATES;
  const visibleEntries = entries.filter(entry => {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch && !entry.vehicle_number.toLowerCase().includes(normalizedSearch)) return false;
    if (passTypeFilter && entry.pass_type !== passTypeFilter) return false;
    if (stateFilter && entry.pass_state !== stateFilter) return false;
    if (erpFilter && entry.erp_status !== erpFilter) return false;

    const enteredAt = new Date(entry.entry_time).getTime();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NaN;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.NaN;
    if (Number.isFinite(from) && enteredAt < from) return false;
    if (Number.isFinite(to) && enteredAt > to) return false;
    return true;
  });

  const hasFilters = Boolean(search.trim() || passTypeFilter || stateFilter || erpFilter || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch('');
    setPassTypeFilter('');
    setStateFilter('');
    setErpFilter('');
    setDateFrom('');
    setDateTo('');
  };

  async function submitGateOut(entry: VehicleEntryOut, rejectedMaterialOnVehicle: boolean) {
    setActingEntryId(entry.id);
    setActionError(null);
    try {
      await gateOutMutation.mutateAsync({
        entryId: entry.id,
        payload: { rejected_material_on_vehicle: rejectedMaterialOnVehicle },
      });
      Alert.alert('Gate-out complete', `${entry.vehicle_number} has been let out.`);
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Failed to let the vehicle out.'));
    } finally {
      setActingEntryId(null);
    }
  }

  async function confirmGateOut(entry: VehicleEntryOut) {
    setActingEntryId(entry.id);
    setActionError(null);
    try {
      // One-off imperative check (not a render-driven read), so it stays a direct API
      // call rather than a cached query.
      const detail = entry.pass_type === 'inward' ? await getEntry(entry.id) : null;
      const rejectedQuantity = detail?.grn?.total_rejected_qty ?? 0;
      const hasRejectedMaterial = rejectedQuantity > 0;
      Alert.alert(
        hasRejectedMaterial ? 'Rejected material on board' : 'Confirm gate-out',
        hasRejectedMaterial
          ? `${rejectedQuantity} rejected material is recorded. Confirm it remains on this vehicle before letting it out.`
          : `Record ${entry.vehicle_number} as exited from the site?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: hasRejectedMaterial ? 'Confirm and let out' : 'Let out',
            onPress: () => submitGateOut(entry, hasRejectedMaterial),
          },
        ],
      );
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Could not load pass details.'));
    } finally {
      setActingEntryId(null);
    }
  }

  if (isLoading) return <LoadingView />;

  if (mode === 'open') {
    const query = normalizePlate(search.trim());
    const matchesSearch = (entry: VehicleEntryOut) =>
      !query || normalizePlate(entry.vehicle_number).includes(query);
    const readyEntries = entries.filter(isGateOutReady).filter(matchesSearch).sort(oldestFirst);
    const atGateEntries = entries
      .filter(entry => entry.pass_type === 'inward' && entry.pass_state === 'GATE_IN')
      .filter(matchesSearch)
      .sort(oldestFirst);

    return (
      <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <FlatList
        style={styles.flexOne}
        data={readyEntries}
        keyExtractor={item => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { refetch(); }} />}
        ListHeaderComponent={
          <View>
            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
            <View style={styles.gateOutHeader}>
              <Text style={styles.filterLabel}>Search vehicle number</Text>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="e.g. MH12AB1234"
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.gateOutSearchInput}
              />
              <Text style={styles.gateOutTitle}>Ready to leave</Text>
              <Text style={styles.gateOutHint}>
                Inward passes with an approved GRN, and other vehicles on site.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <GateOutCard
            entry={item}
            canLetOut
            isActing={actingEntryId === item.id}
            onOpen={() => navigation.navigate('EntryDetail', { entryId: item.id })}
            onLetOut={() => confirmGateOut(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.gateOutEmpty}>
            {query ? 'No vehicle matches this number.' : 'No vehicle is ready to leave.'}
          </Text>
        }
        ListFooterComponent={
          atGateEntries.length > 0 ? (
            <View style={styles.atGateSection}>
              <Text style={styles.atGateTitle}>At the gate, not weighed yet</Text>
              <Text style={styles.atGateHint}>
                Inward passes before the gross weight. They cannot leave yet; open a pass to cancel it if the vehicle is turned back.
              </Text>
              {atGateEntries.map(entry => (
                <GateOutCard
                  key={entry.id}
                  entry={entry}
                  canLetOut={false}
                  isActing={false}
                  onOpen={() => navigation.navigate('EntryDetail', { entryId: entry.id })}
                  onLetOut={() => undefined}
                />
              ))}
            </View>
          ) : undefined
        }
      />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
    <FlatList
      style={styles.flexOne}
      data={visibleEntries}
      keyExtractor={item => String(item.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { refetch(); }} />}
      ListHeaderComponent={
        <View>
          <View style={styles.searchCard}>
            <Text style={styles.filterLabel}>Vehicle Number</Text>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search vehicle number"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.searchInput}
            />
            <View style={styles.searchActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setDateFiltersOpen(open => !open)}>
                <Text style={styles.actionIcon}>{'☷'}</Text>
                <Text style={styles.actionButtonText}>Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => refetch()} disabled={isRefreshing}>
                <Text style={styles.actionIcon}>{'↻'}</Text>
                <Text style={styles.actionButtonText}>{isRefreshing ? 'Refreshing' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>
            {dateFiltersOpen ? (
              <View style={styles.dateFilters}>
                <View style={styles.dateField}>
                  <Text style={styles.filterLabel}>From</Text>
                  <Input value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" autoCapitalize="none" />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.filterLabel}>To</Text>
                  <Input value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" autoCapitalize="none" />
                </View>
                {hasFilters ? (
                  <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                    <Text style={styles.clearFiltersText}>Clear filters</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.filters}>
            <FilterSelect
              label="State"
              value={stateFilter}
              options={stateOptions(states)}
              onChange={setStateFilter}
            />
            <View style={styles.filterRow}>
              <FilterSelect
                label="Pass type"
                value={passTypeFilter}
                options={PASS_TYPE_OPTIONS}
                onChange={setPassTypeFilter}
              />
              <FilterSelect
                label="ERP post"
                value={erpFilter}
                options={ERP_OPTIONS}
                onChange={setErpFilter}
              />
            </View>
          </View>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        </View>
      }
      renderItem={({ item }) => (
        <EntryCard entry={item} onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })} />
      )}
      ListEmptyComponent={<EmptyState message={hasFilters ? 'No passes match these filters.' : 'No passes found.'} />}
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  flexOne: { flex: 1 },
  listContent: { paddingBottom: 24 },
  gateOutHeader: { paddingHorizontal: 8, paddingTop: 18, paddingBottom: 4 },
  gateOutSearchInput: { minHeight: 44, fontSize: 13, borderRadius: 8, paddingVertical: 10 },
  gateOutTitle: { color: '#131a22', fontSize: 20, fontWeight: '700', marginTop: 21 },
  gateOutHint: { color: '#526171', fontSize: 12, lineHeight: 17, marginTop: 4 },
  gateOutEmpty: { color: '#526171', fontSize: 13, marginHorizontal: 8, paddingVertical: 14 },
  atGateSection: { marginTop: 12, paddingHorizontal: 8 },
  atGateTitle: { color: '#131a22', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  atGateHint: { color: '#526171', fontSize: 12, lineHeight: 17, marginBottom: 4 },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2e8',
    padding: 14,
    marginHorizontal: 5,
    marginTop: 10,
  },
  searchInput: { minHeight: 44, fontSize: 13, borderRadius: 8, paddingVertical: 10 },
  searchActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 9,
  },
  actionIcon: { color: '#334155', fontSize: 17, fontWeight: '700' },
  actionButtonText: { color: '#1a1a2e', fontSize: 13, fontWeight: '700' },
  dateFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  dateField: { flex: 1, minWidth: '45%' },
  clearFiltersButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 8,
  },
  clearFiltersText: { color: '#1a1a2e', fontSize: 13, fontWeight: '600' },
  filters: { gap: 10, marginHorizontal: 5, marginTop: 18, marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterField: { flex: 1, minWidth: 0 },
  filterLabel: { color: '#526171', fontSize: 12, marginBottom: 4 },
  select: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce2e8',
    backgroundColor: '#eef1f5',
  },
  selectText: { color: '#17202b', fontSize: 13 },
  selectChevron: { color: '#17202b', fontSize: 16 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 8 },
  modalTitle: { color: '#131a22', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalOption: { minHeight: 44, justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#eef1f5' },
  modalOptionText: { color: '#334155', fontSize: 14 },
  modalOptionSelected: { color: '#b8410e', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 5,
    marginTop: 10,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dce2e8',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardHeading: { flex: 1, minWidth: 0 },
  caption: { color: '#34445a', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 },
  gateOutSupplier: { color: '#526171', fontSize: 11, marginTop: 4 },
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: '#facc15',
    borderColor: '#17202b',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  plateText: { color: '#111827', fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  details: { gap: 8, marginTop: 12, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { color: '#334155', fontSize: 12, width: '36%' },
  detailValue: { flex: 1, minWidth: 0 },
  valueText: { color: '#17202b', fontSize: 12 },
  mono: { color: '#17202b', fontFamily: 'monospace', fontSize: 12 },
  weightLine: { color: '#526171', fontSize: 11, lineHeight: 16 },
  pending: { color: '#a77916' },
  netWeight: { color: '#17202b', fontWeight: '700' },
  openButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 8,
  },
  openButtonText: { color: '#17202b', fontSize: 12, fontWeight: '600' },
  needsWeights: { color: '#80600f', fontSize: 11, fontWeight: '600', marginBottom: 8 },
  gateOutButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b8410e',
    borderRadius: 9,
  },
  gateOutButtonDisabled: { opacity: 0.5 },
  gateOutButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
