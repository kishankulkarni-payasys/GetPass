import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listEntries } from '../../api/entries';
import { ErrorBanner, LoadingView } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { VehicleEntryOut, WeighmentKind } from '../../types/entries';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';

type Props = NativeStackScreenProps<RootStackParamList, 'Weighbridge'>;
type ListScope = 'onSite' | 'all';

const OPEN_STATES = new Set([
  'GATE_IN',
  'ON_SITE',
  'QUALITY_PENDING',
  'QUALITY_RESOLVED',
  'GRN_DRAFT',
  'GRN_APPROVED',
]);

const PASS_STATE_LABELS: Record<VehicleEntryOut['pass_state'], string> = {
  GATE_IN: 'ON SITE',
  ON_SITE: 'ON SITE',
  QUALITY_PENDING: 'QUALITY PENDING',
  QUALITY_RESOLVED: 'QUALITY RESOLVED',
  GRN_DRAFT: 'GRN DRAFT',
  GRN_APPROVED: 'GRN APPROVED',
  GATE_OUT: 'GATE OUT',
  CANCELLED: 'CANCELLED',
};

function getStatusLabel(entry: VehicleEntryOut): string {
  if (OPEN_STATES.has(entry.pass_state) && entry.pass_type === 'inward') {
    if (entry.current_gross_kg == null) return 'WEIGH GROSS';
    if (entry.current_tare_kg == null) return 'WEIGH TARE';
  }
  return PASS_STATE_LABELS[entry.pass_state];
}

function getNextWeighment(entry: VehicleEntryOut): WeighmentKind | null {
  if (!OPEN_STATES.has(entry.pass_state) || entry.pass_type !== 'inward') return null;
  if (entry.current_gross_kg == null) return 'gross';
  if (entry.current_tare_kg == null) return 'tare';
  return null;
}

function formatWeight(value?: number | null): string {
  return value == null ? 'Pending' : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
}

function formatEntryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
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

function WeightLines({ entry }: { entry: VehicleEntryOut }) {
  return (
    <View style={styles.weightLines}>
      <Text style={styles.weightLine}>
        Loaded (gross): <Text style={entry.current_gross_kg == null ? styles.pending : styles.value}>{formatWeight(entry.current_gross_kg)}</Text>
      </Text>
      <Text style={styles.weightLine}>
        Empty (tare): <Text style={entry.current_tare_kg == null ? styles.pending : styles.value}>{formatWeight(entry.current_tare_kg)}</Text>
      </Text>
      <Text style={styles.weightLine}>
        Net material: <Text style={entry.net_kg == null ? styles.pending : styles.value}>{formatWeight(entry.net_kg)}</Text>
      </Text>
    </View>
  );
}

export default function WeighbridgeScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<VehicleEntryOut[]>([]);
  const [scope, setScope] = useState<ListScope>('onSite');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      setEntries(await listEntries({}));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load vehicles.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSiteEntries = useMemo(
    () => entries.filter(entry => OPEN_STATES.has(entry.pass_state)),
    [entries],
  );
  const waitingForGross = onSiteEntries.filter(
    entry => entry.pass_type === 'inward' && entry.current_gross_kg == null,
  ).length;
  const waitingForTare = onSiteEntries.filter(
    entry => entry.pass_type === 'inward' && entry.current_gross_kg != null && entry.current_tare_kg == null,
  ).length;
  const visibleEntries = scope === 'onSite' ? onSiteEntries : entries;

  if (isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
    <FlatList
      style={styles.flexOne}
      data={visibleEntries}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <View>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>{waitingForGross} vehicle(s) waiting for a gross weight</Text>
            <Text style={styles.summaryText}>{waitingForTare} vehicle(s) waiting for an empty (tare) weight</Text>
          </View>
          <View style={styles.scopeControl}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: scope === 'onSite' }}
              style={[styles.scopeButton, scope === 'onSite' && styles.scopeButtonActive]}
              onPress={() => setScope('onSite')}
            >
              <Text style={[styles.scopeLabel, scope === 'onSite' && styles.scopeLabelActive]}>On site</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: scope === 'all' }}
              style={[styles.scopeButton, scope === 'all' && styles.scopeButtonActive]}
              onPress={() => setScope('all')}
            >
              <Text style={[styles.scopeLabel, scope === 'all' && styles.scopeLabelActive]}>All entries</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const nextKind = getNextWeighment(item);
        const actionLabel = nextKind === 'gross' ? 'Capture gross' : nextKind === 'tare' ? 'Capture tare' : null;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.vehicleInfo}>
                <Text style={styles.caption}>VEHICLE</Text>
                <View style={styles.plate}>
                  <Text style={styles.plateText}>{formatPlate(item.vehicle_number)}</Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{getStatusLabel(item)}</Text>
              </View>
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Weight</Text>
                <WeightLines entry={item} />
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Supplier</Text>
                <Text style={styles.value}>{item.supplier_transporter_name || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Driver</Text>
                <Text style={styles.value}>{item.driver_name || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Entry</Text>
                <Text style={styles.value}>{formatEntryTime(item.entry_time)}</Text>
              </View>
            </View>

            {actionLabel && nextKind ? (
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.captureButton}
                onPress={() =>
                  navigation.navigate('WeighCapture', {
                    entryId: item.id,
                    vehicleNumber: item.vehicle_number,
                    kind: nextKind,
                  })
                }
              >
                <Text style={styles.captureButtonText}>{actionLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {scope === 'onSite' ? 'No vehicles currently on site.' : 'No entries found.'}
          </Text>
        </View>
      }
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  flexOne: { flex: 1 },
  listContent: { paddingBottom: 16 },
  summary: { paddingHorizontal: 9, paddingTop: 22, paddingBottom: 12, gap: 5 },
  summaryText: { color: '#15263a', fontSize: 12 },
  scopeControl: {
    flexDirection: 'row',
    marginHorizontal: 9,
    marginBottom: 11,
    padding: 4,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#dce2e8',
    backgroundColor: '#f6f7f9',
  },
  scopeButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  scopeButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#263447',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  scopeLabel: { color: '#25364a', fontSize: 12, fontWeight: '500' },
  scopeLabelActive: { color: '#b8410e', fontWeight: '700' },
  card: {
    marginHorizontal: 9,
    marginBottom: 11,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e5ea',
    backgroundColor: '#fff',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  vehicleInfo: { flex: 1 },
  caption: { color: '#536274', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 },
  plate: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#463700',
    borderRadius: 3,
    backgroundColor: '#f8cc24',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  plateText: { color: '#111827', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    backgroundColor: '#f8f0da',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a77916' },
  statusText: { color: '#80600f', fontSize: 9, fontWeight: '700', letterSpacing: 0.25 },
  details: { marginTop: 11, gap: 7 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailLabel: { width: '38%', color: '#24364b', fontSize: 11, paddingRight: 6 },
  value: { flex: 1, color: '#1d2938', fontSize: 11, lineHeight: 16 },
  weightLines: { flex: 1 },
  weightLine: { color: '#526171', fontSize: 10, lineHeight: 16 },
  pending: { color: '#a77916' },
  captureButton: {
    minHeight: 40,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#b8410e',
  },
  captureButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 13 },
});
