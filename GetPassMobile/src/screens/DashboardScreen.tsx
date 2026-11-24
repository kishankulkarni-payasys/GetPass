import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabScreenProps } from '../navigation/TabNavigator';
import { getDashboardSummary } from '../api/dashboard';
import { DashboardRow, DashboardSummary } from '../types/dashboard';
import { Card, EmptyState, ErrorBanner, LoadingView, Pill, colors } from '../components/ui';
import { extractErrorMessage } from '../utils/apiError';

type Props = MainTabScreenProps<'DashboardTab'>;

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function BoardRow({ row, onPress }: { row: DashboardRow; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <Text style={styles.vehicle}>{row.vehicle_number}</Text>
        <Pill label={row.display_state.replace(/_/g, ' ')} tone={row.tone} />
      </View>
      {row.supplier ? <Text style={styles.subtext}>{row.supplier}</Text> : null}
      <Text style={styles.subtext}>
        Dwell: {row.dwell_minutes}m {row.over_sla ? '· Over SLA' : ''}
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
    setErrorMessage(null);
    try {
      setSummary(await getDashboardSummary());
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load the dashboard.'));
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
  if (errorMessage || !summary) return <ErrorBanner message={errorMessage ?? 'No data.'} />;

  return (
    <FlatList
      style={styles.screen}
      data={summary.board}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <Card>
          <Text style={styles.sectionTitle}>Today's KPIs</Text>
          <View style={styles.kpiGrid}>
            <Kpi label="On site now" value={summary.kpis.on_site_now} />
            <Kpi label="Awaiting quality" value={summary.kpis.awaiting_quality} />
            <Kpi label="Quality over SLA" value={summary.kpis.quality_over_sla} />
            <Kpi label="GRN pending post" value={summary.kpis.grn_pending_post} />
            <Kpi label="Avg dwell (min)" value={summary.kpis.avg_dwell_minutes ?? '—'} />
            <Kpi label="Vehicles today" value={summary.kpis.vehicles_today} />
          </View>
        </Card>
      }
      renderItem={({ item }) => (
        <BoardRow row={item} onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })} />
      )}
      ListEmptyComponent={<EmptyState message="No passes to show for today." />}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpi: { width: '33%', marginBottom: 14 },
  kpiValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  kpiLabel: { fontSize: 11, color: colors.subtext, marginTop: 2 },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  vehicle: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtext: { fontSize: 13, color: colors.subtext, marginTop: 2 },
});
