import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabScreenProps } from '../navigation/TabNavigator';
import { getDashboardSummary } from '../api/dashboard';
import { DashboardRow, DashboardSummary, Tone } from '../types/dashboard';
import { EmptyState, ErrorBanner, Input, LoadingView } from '../components/ui';
import { extractErrorMessage } from '../utils/apiError';
import { formatPlate } from '../utils/formatPlate';

type Props = MainTabScreenProps<'DashboardTab'>;

const POLL_INTERVAL_MS = 30_000;

const TONE_STYLES: Record<Tone, { backgroundColor: string; color: string }> = {
  good: { backgroundColor: '#e8f5ed', color: '#276749' },
  warn: { backgroundColor: '#f8f0da', color: '#80600f' },
  crit: { backgroundColor: '#fdeaea', color: '#a83227' },
  info: { backgroundColor: '#e9f1fb', color: '#2457a6' },
  neutral: { backgroundColor: '#eef1f5', color: '#475569' },
};

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayDate(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}-${month}-${year}`;
}

function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

function formatDwell(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—';
  const total = Math.max(0, Math.round(Number(minutes)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function DatePickerModal({
  visible,
  day,
  onClose,
  onApply,
}: {
  visible: boolean;
  day: string;
  onClose: () => void;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(displayDate(day));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(displayDate(day));
      setError(null);
    }
  }, [day, visible]);

  function applyDate() {
    const parsed = parseDisplayDate(draft);
    if (!parsed) {
      setError('Enter a valid date in DD-MM-YYYY format.');
      return;
    }
    onApply(parsed);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select dashboard day</Text>
          <Text style={styles.fieldLabel}>Day</Text>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="DD-MM-YYYY"
            keyboardType="default"
            maxLength={10}
          />
          {error ? <Text style={styles.dateError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={() => {
                onApply(localToday());
                onClose();
              }}
            >
              <Text style={styles.modalSecondaryText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryButton} onPress={applyDate}>
              <Text style={styles.modalPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function KpiTile({
  value,
  label,
  note,
  alert,
}: {
  value: string | number;
  label: string;
  note?: string;
  alert?: boolean;
}) {
  return (
    <View style={[styles.kpi, alert && styles.kpiAlert]}>
      <Text style={[styles.kpiValue, alert && styles.kpiAlertText]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {note ? <Text style={[styles.kpiNote, alert && styles.kpiAlertText]}>{note}</Text> : null}
    </View>
  );
}

function StatusBadge({ row }: { row: DashboardRow }) {
  const label = (row.display_state || row.pass_state).replace(/_/g, ' ').toUpperCase();
  const tone = TONE_STYLES[row.tone];
  return (
    <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor }]}>
      <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
      <Text style={[styles.statusText, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

function BoardCard({
  row,
  qualitySlaMinutes,
  onPress,
}: {
  row: DashboardRow;
  qualitySlaMinutes: number;
  onPress: () => void;
}) {
  const qualityAlert = row.pass_state === 'QUALITY_PENDING' && (row.minutes_in_state ?? 0) > qualitySlaMinutes;

  return (
    <View style={[styles.boardCard, qualityAlert && styles.boardCardAlert]}>
      <View style={styles.boardHeader}>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{formatPlate(row.vehicle_number)}</Text>
        </View>
        <StatusBadge row={row} />
      </View>
      {row.supplier ? <Text style={styles.supplier}>{row.supplier}</Text> : null}
      <View style={styles.boardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Dwell</Text>
          <Text style={[styles.detailValue, styles.mono, row.over_sla && styles.overSla]}>
            {formatDwell(row.dwell_minutes)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Qty source</Text>
          <Text style={[styles.detailValue, styles.mono]}>
            {row.qty_source === 'challan' ? 'Challan' : '—'}
          </Text>
        </View>
      </View>
      <TouchableOpacity accessibilityRole="button" style={styles.openButton} onPress={onPress}>
        <Text style={styles.openButtonText}>Open pass</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const [day, setDay] = useState(localToday);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const requestId = ++latestRequest.current;
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getDashboardSummary(day);
      if (requestId !== latestRequest.current) return;
      setSummary(data);
      setUpdatedAt(new Date());
    } catch (error) {
      if (requestId === latestRequest.current) {
        setErrorMessage(extractErrorMessage(error, 'Could not load the dashboard.'));
      }
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(true), POLL_INTERVAL_MS);
      return () => {
        clearInterval(timer);
        latestRequest.current += 1;
      };
    }, [load]),
  );

  if (isLoading) return <LoadingView />;
  if (!summary) {
    return (
      <View style={styles.loadError}>
        <ErrorBanner message={errorMessage ?? 'No dashboard data.'} />
        <TouchableOpacity style={styles.refreshButton} onPress={() => load()}>
          <Text style={styles.refreshButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const qualityAlert = summary.kpis.quality_over_sla > 0;

  return (
    <>
      <FlatList
        style={styles.screen}
        data={summary.board}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.toolbar}>
              <Text style={styles.fieldLabel}>Day</Text>
              <View style={styles.toolbarControls}>
                <TouchableOpacity style={styles.dateControl} onPress={() => setIsDatePickerOpen(true)}>
                  <Text style={styles.dateText}>{displayDate(day)}</Text>
                  <Text style={styles.calendarIcon}>{'▦'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
                  onPress={() => load(true)}
                  disabled={isRefreshing}
                >
                  <Text style={styles.refreshButtonText}>{isRefreshing ? 'Refreshing' : 'Refresh'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.updatedBlock}>
                <Text style={styles.updatedText}>{updatedAt ? `Updated ${formatClock(updatedAt)}` : ''}</Text>
                <Text style={styles.updatedText}>Updates every 30 seconds while this tab is open.</Text>
              </View>
            </View>

            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

            <View style={styles.kpiGrid}>
              <KpiTile
                value={summary.kpis.on_site_now}
                label="ON SITE NOW"
                note={`${summary.kpis.vehicles_today} vehicles on this day`}
              />
              <KpiTile
                value={summary.kpis.awaiting_quality}
                label="AWAITING QUALITY"
                note={qualityAlert ? `${summary.kpis.quality_over_sla} over the time limit` : undefined}
                alert={qualityAlert}
              />
              <KpiTile value={summary.kpis.grn_pending_post} label="GRN PENDING POST" />
              <KpiTile value={formatDwell(summary.kpis.avg_dwell_minutes)} label="AVG DWELL" />
            </View>

            <View style={styles.boardHeading}>
              <Text style={styles.boardTitle}>Vehicle board</Text>
              <Text style={styles.boardHint}>
                Open passes first, longest on site first. Dwell turns red after {summary.dwell_sla_minutes} minutes.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <BoardCard
            row={item}
            qualitySlaMinutes={summary.quality_sla_minutes}
            onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })}
          />
        )}
        ListEmptyComponent={<EmptyState message="No passes to show for this day." />}
      />
      <DatePickerModal
        visible={isDatePickerOpen}
        day={day}
        onClose={() => setIsDatePickerOpen(false)}
        onApply={setDay}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  loadError: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  list: { paddingBottom: 24 },
  toolbar: { paddingHorizontal: 2, paddingTop: 10, paddingBottom: 8 },
  fieldLabel: { color: '#526171', fontSize: 12, marginBottom: 4 },
  toolbarControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateControl: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dce2e8',
    backgroundColor: '#eef1f5',
  },
  dateText: { color: '#17202b', fontSize: 12 },
  calendarIcon: { color: '#17202b', fontSize: 17 },
  refreshButton: {
    minHeight: 44,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  refreshButtonDisabled: { opacity: 0.6 },
  refreshButtonText: { color: '#17202b', fontSize: 13, fontWeight: '700' },
  updatedBlock: { marginTop: 12 },
  updatedText: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: 2,
    marginTop: 10,
  },
  kpi: {
    width: '48%',
    minHeight: 92,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  kpiAlert: { backgroundColor: '#fae8e8', borderColor: '#f1caca' },
  kpiValue: { color: '#17202b', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  kpiLabel: { color: '#34445a', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginTop: 2 },
  kpiNote: { color: '#64748b', fontSize: 10, marginTop: 4 },
  kpiAlertText: { color: '#b83232' },
  boardHeading: { marginHorizontal: 2, marginTop: 18, marginBottom: 2 },
  boardTitle: { color: '#17202b', fontSize: 20, fontWeight: '700' },
  boardHint: { color: '#526171', fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 6 },
  boardCard: {
    backgroundColor: '#fff',
    marginHorizontal: 2,
    marginTop: 10,
    borderRadius: 11,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dce2e8',
  },
  boardCardAlert: { backgroundColor: '#fff5f5', borderColor: '#f1caca' },
  boardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
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
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.25 },
  supplier: { color: '#526171', fontSize: 11, marginTop: 4 },
  boardDetails: { gap: 8, marginTop: 12, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { color: '#334155', fontSize: 12, flex: 1 },
  detailValue: { color: '#17202b', fontSize: 12, flex: 1 },
  mono: { fontFamily: 'monospace' },
  overSla: { color: '#c92a2a', fontWeight: '700' },
  openButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 8,
  },
  openButtonText: { color: '#17202b', fontSize: 12, fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 18, elevation: 8 },
  modalTitle: { color: '#17202b', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  dateError: { color: '#b83232', fontSize: 12, marginTop: 6 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalSecondaryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#eef1f5' },
  modalSecondaryText: { color: '#17202b', fontSize: 13, fontWeight: '600' },
  modalPrimaryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#b8410e' },
  modalPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
