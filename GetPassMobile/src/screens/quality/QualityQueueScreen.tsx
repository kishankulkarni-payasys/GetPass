import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getQualityQueue } from '../../api/quality';
import { ErrorBanner, LoadingView } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { QualityQueueItem } from '../../types/quality';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';

type Props = NativeStackScreenProps<RootStackParamList, 'QualityQueue'>;

function formatWaitingTime(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '--:--';
  const total = Math.max(0, Math.round(Number(minutes)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function oldestFirst(a: QualityQueueItem, b: QualityQueueItem): number {
  const aTime = a.pass_state_changed_at ? new Date(a.pass_state_changed_at).getTime() : Number.NaN;
  const bTime = b.pass_state_changed_at ? new Date(b.pass_state_changed_at).getTime() : Number.NaN;
  if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
  return (b.minutes_in_state ?? 0) - (a.minutes_in_state ?? 0);
}

function QualityDetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValue}>{children}</View>
    </View>
  );
}

function QualityCard({
  item,
  correction,
  onPress,
}: {
  item: QualityQueueItem;
  correction: boolean;
  onPress: () => void;
}) {
  const result = item.current_result?.result;
  const badgeLabel = correction ? (result ? result.replace('_', ' ').toUpperCase() : 'RESULT RECORDED') : 'AWAITING QUALITY';
  const badgeTone = correction
    ? result === 'approved'
      ? 'good'
      : result === 'rejected'
        ? 'crit'
        : 'warn'
    : item.over_sla
      ? 'crit'
      : 'warn';
  const challanLines = item.challan_lines.map(line => line.material).join(', ') || '-';

  return (
    <View style={[styles.card, item.over_sla && !correction && styles.cardOverSla]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={styles.supplier}>{item.supplier || 'INWARD MATERIAL'}</Text>
          <View style={styles.plate}>
            <Text style={styles.plateText}>{formatPlate(item.vehicle_number)}</Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            badgeTone === 'crit' ? styles.statusCrit : badgeTone === 'good' ? styles.statusGood : styles.statusWarn,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              badgeTone === 'crit' ? styles.statusDotCrit : badgeTone === 'good' ? styles.statusDotGood : styles.statusDotWarn,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              badgeTone === 'crit' ? styles.statusTextCrit : badgeTone === 'good' ? styles.statusTextGood : styles.statusTextWarn,
            ]}
          >
            {badgeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <QualityDetailRow label="PO"><Text style={styles.value}>{item.po_number || '-'}</Text></QualityDetailRow>
        <QualityDetailRow label="Challan"><Text style={styles.value}>{item.challan_number || '-'}</Text></QualityDetailRow>
        <QualityDetailRow label="Challan lines"><Text style={styles.value}>{challanLines}</Text></QualityDetailRow>
        {correction ? (
          <QualityDetailRow label="Result"><Text style={styles.value}>{badgeLabel}</Text></QualityDetailRow>
        ) : (
          <QualityDetailRow label="Waiting">
            <Text style={[styles.value, styles.waitingTime, item.over_sla && styles.waitingTimeOverSla]}>
              {formatWaitingTime(item.minutes_in_state)}
            </Text>
          </QualityDetailRow>
        )}
      </View>

      <TouchableOpacity accessibilityRole="button" style={styles.recordButton} onPress={onPress}>
        <Text style={styles.recordButtonText}>{correction ? 'Correct result' : 'Record result'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function QualityQueueScreen({ navigation }: Props) {
  const [items, setItems] = useState<QualityQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      setItems(await getQualityQueue());
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load the quality queue.'));
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

  if (isLoading) return <LoadingView />;

  const pendingItems = items
    .filter(item => item.pass_state === 'QUALITY_PENDING')
    .sort(oldestFirst);
  const resolvedItems = items
    .filter(item => item.pass_state === 'QUALITY_RESOLVED')
    .sort(oldestFirst);

  return (
    <FlatList
      style={styles.screen}
      data={pendingItems}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <View>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <Text style={styles.sectionTitle}>Awaiting inspection</Text>
          <Text style={styles.sectionHint}>
            {pendingItems.length > 0
              ? 'Oldest first. Waiting time turns red after the quality time limit.'
              : 'Nothing is waiting for inspection right now.'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <QualityCard
          item={item}
          correction={false}
          onPress={() => navigation.navigate('QualityResult', { entryId: item.id })}
        />
      )}
      ListEmptyComponent={
        items.length === 0 ? (
          <Text style={styles.emptyText}>No vehicle is waiting for inspection.</Text>
        ) : undefined
      }
      ListFooterComponent={
        resolvedItems.length > 0 ? (
          <View style={styles.resolvedSection}>
            <Text style={styles.sectionTitle}>Result recorded</Text>
            <Text style={styles.sectionHint}>A result can be corrected until stores start the GRN.</Text>
            {resolvedItems.map(item => (
              <QualityCard
                key={item.id}
                item={item}
                correction
                onPress={() => navigation.navigate('QualityResult', { entryId: item.id })}
              />
            ))}
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  list: { paddingHorizontal: 6, paddingTop: 18, paddingBottom: 24 },
  sectionTitle: { color: '#131a22', fontSize: 20, fontWeight: '700' },
  sectionHint: { color: '#526171', fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 4 },
  emptyText: { color: '#526171', fontSize: 13, paddingVertical: 16 },
  card: {
    backgroundColor: '#fff',
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dce2e8',
  },
  cardOverSla: { borderColor: '#f1b8b8' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardHeading: { flex: 1, minWidth: 0 },
  supplier: {
    color: '#34445a',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
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
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  statusCrit: { backgroundColor: '#fdeaea' },
  statusWarn: { backgroundColor: '#f8f0da' },
  statusGood: { backgroundColor: '#e8f5ed' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotCrit: { backgroundColor: '#c0392b' },
  statusDotWarn: { backgroundColor: '#a77916' },
  statusDotGood: { backgroundColor: '#2f855a' },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.25 },
  statusTextCrit: { color: '#a83227' },
  statusTextWarn: { color: '#80600f' },
  statusTextGood: { color: '#276749' },
  details: { gap: 8, marginTop: 12, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { color: '#24364b', fontSize: 11, width: '34%' },
  detailValue: { flex: 1, minWidth: 0 },
  value: { color: '#17202b', fontSize: 11, lineHeight: 16 },
  waitingTime: { fontFamily: 'monospace' },
  waitingTimeOverSla: { color: '#c0392b', fontWeight: '700' },
  recordButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b8410e',
    borderRadius: 9,
    marginTop: 1,
  },
  recordButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  resolvedSection: { marginTop: 20 },
});
