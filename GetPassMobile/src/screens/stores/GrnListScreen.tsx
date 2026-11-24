import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabScreenProps } from '../../navigation/TabNavigator';
import { listStoreWork, retryGrnPost, startGrn } from '../../api/grn';
import { sendToQuality } from '../../api/quality';
import { GrnWorkGroup, GrnWorkItem } from '../../types/grn';
import { EmptyState, ErrorBanner, LoadingView } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';
import { formatPlate } from '../../utils/formatPlate';

type Props = MainTabScreenProps<'StoresTab'>;
type GroupId = Exclude<GrnWorkGroup, 'approved'>;
type BadgeTone = 'good' | 'warn' | 'crit' | 'info';
type ListRow =
  | { kind: 'heading'; key: string; group: GroupId; title: string; hint: string; count: number }
  | { kind: 'empty'; key: string }
  | { kind: 'item'; key: string; item: GrnWorkItem };

const GROUPS: Array<{ id: GroupId; title: string; hint: string }> = [
  {
    id: 'send_for_inspection',
    title: 'Unloaded? Send for inspection',
    hint: 'Vehicles weighed and unloading. Send them once unloading is done.',
  },
  {
    id: 'ready_for_grn',
    title: 'Ready for GRN',
    hint: 'Quality has given a result. Start the GRN.',
  },
  {
    id: 'draft',
    title: 'Drafts',
    hint: 'GRNs being prepared.',
  },
  {
    id: 'pending_post',
    title: 'Pending ERP post',
    hint: 'Approved GRNs the ERP has not accepted yet.',
  },
];

const STATUS_TONE_STYLES: Record<BadgeTone, { container: ViewStyle; dot: ViewStyle; text: TextStyle }> = {
  good: {
    container: { backgroundColor: '#e8f5ed' },
    dot: { backgroundColor: '#2f855a' },
    text: { color: '#276749' },
  },
  warn: {
    container: { backgroundColor: '#f8f0da' },
    dot: { backgroundColor: '#a77916' },
    text: { color: '#80600f' },
  },
  crit: {
    container: { backgroundColor: '#fdeaea' },
    dot: { backgroundColor: '#c0392b' },
    text: { color: '#a83227' },
  },
  info: {
    container: { backgroundColor: '#e9f1fb' },
    dot: { backgroundColor: '#2d6cdf' },
    text: { color: '#2457a6' },
  },
};

function formatDuration(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—';
  const total = Math.max(0, Math.round(Number(minutes)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function statusForItem(item: GrnWorkItem): { label: string; tone: BadgeTone } {
  if (item.group === 'send_for_inspection') return { label: 'ON SITE · UNLOADING', tone: 'warn' };
  if (item.group === 'ready_for_grn') return { label: 'QUALITY DONE', tone: 'good' };
  if (item.group === 'pending_post') return { label: 'GRN PENDING POST', tone: 'crit' };
  return { label: 'GRN DRAFT', tone: 'info' };
}

function WorkAction({
  label,
  disabled,
  secondary,
  onPress,
}: {
  label: string;
  disabled: boolean;
  secondary?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.actionButton, secondary ? styles.actionButtonSecondary : styles.actionButtonPrimary, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>
        {disabled ? 'Working...' : label}
      </Text>
    </TouchableOpacity>
  );
}

function WorkCard({
  item,
  busy,
  onOpen,
  onSendToInspection,
  onStartGrn,
  onRetryPost,
}: {
  item: GrnWorkItem;
  busy: boolean;
  onOpen: () => void;
  onSendToInspection: () => void;
  onStartGrn: () => void;
  onRetryPost: () => void;
}) {
  const status = statusForItem(item);

  return (
    <View style={styles.workCard}>
      <View style={styles.workHeader}>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{formatPlate(item.vehicle_number)}</Text>
        </View>
        <View style={[styles.statusBadge, STATUS_TONE_STYLES[status.tone].container]}>
          <View style={[styles.statusDot, STATUS_TONE_STYLES[status.tone].dot]} />
          <Text style={[styles.statusText, STATUS_TONE_STYLES[status.tone].text]}>{status.label}</Text>
        </View>
        {item.minutes_in_state != null ? (
          <Text style={styles.waiting}>Waiting <Text style={styles.mono}>{formatDuration(item.minutes_in_state)}</Text></Text>
        ) : null}
      </View>

      <Text style={styles.supplier}>{item.supplier || '—'}</Text>
      <Text style={styles.documents}>
        PO number <Text style={styles.mono}>{item.po_number || '—'}</Text>
        {' · '}
        Challan number <Text style={styles.mono}>{item.challan_number || '—'}</Text>
      </Text>
      {item.erp_last_error ? <Text style={styles.erpError}>{item.erp_last_error}</Text> : null}

      <View style={styles.actions}>
        {item.group === 'send_for_inspection' ? (
          <WorkAction label="Send for inspection" disabled={busy} onPress={onSendToInspection} />
        ) : null}
        {item.group === 'ready_for_grn' ? (
          <WorkAction label="Start GRN" disabled={busy} onPress={onStartGrn} />
        ) : null}
        {item.group === 'draft' ? (
          <WorkAction label="Open GRN" disabled={busy} onPress={onOpen} />
        ) : null}
        {item.group === 'pending_post' ? (
          <>
            <WorkAction label="Retry post" disabled={busy} onPress={onRetryPost} />
            <WorkAction label="Open GRN" disabled={busy} secondary onPress={onOpen} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function GrnListScreen({ navigation }: Props) {
  const [items, setItems] = useState<GrnWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      setItems(await listStoreWork());
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load the store work list.'));
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

  const rows = useMemo<ListRow[]>(() => {
    const result: ListRow[] = [];
    for (const group of GROUPS) {
      const groupItems = items.filter(item => item.group === group.id);
      result.push({
        kind: 'heading',
        key: `heading-${group.id}`,
        group: group.id,
        title: group.title,
        hint: group.hint,
        count: groupItems.length,
      });
      if (groupItems.length === 0) {
        result.push({ kind: 'empty', key: `empty-${group.id}` });
      } else {
        for (const item of groupItems) {
          result.push({ kind: 'item', key: `${group.id}-${item.entry_id}`, item });
        }
      }
    }
    return result;
  }, [items]);

  async function runAction(item: GrnWorkItem, action: () => Promise<unknown>, openEditor = false) {
    setBusyId(item.entry_id);
    setErrorMessage(null);
    try {
      await action();
      if (openEditor) {
        navigation.navigate('GrnDetail', { entryId: item.entry_id });
      } else {
        await load(true);
      }
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'The action could not be completed.'));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <LoadingView />;

  return (
    <FlatList
      style={styles.screen}
      data={rows}
      keyExtractor={row => row.key}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.refreshButton, isRefreshing && styles.disabled]}
            onPress={() => load(true)}
            disabled={isRefreshing}
          >
            <Text style={styles.refreshText}>{isRefreshing ? 'Refreshing' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item: row }) => {
        if (row.kind === 'heading') {
          return (
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleRow}>
                <Text style={styles.groupTitle}>{row.title}</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{row.count}</Text></View>
              </View>
              <Text style={styles.groupHint}>{row.hint}</Text>
            </View>
          );
        }
        if (row.kind === 'empty') {
          return <Text style={styles.emptyGroup}>None right now.</Text>;
        }
        const { item } = row;
        const busy = busyId === item.entry_id;
        return (
          <WorkCard
            item={item}
            busy={busy}
            onOpen={() => navigation.navigate('GrnDetail', { entryId: item.entry_id })}
            onSendToInspection={() => runAction(item, () => sendToQuality(item.entry_id))}
            onStartGrn={() => runAction(item, () => startGrn(item.entry_id), true)}
            onRetryPost={() => runAction(item, () => retryGrnPost(item.entry_id))}
          />
        );
      }}
      ListEmptyComponent={<EmptyState message="Nothing in the store work list right now." />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  list: { paddingHorizontal: 10, paddingBottom: 24 },
  listHeader: { marginHorizontal: -8, marginTop: 10, marginBottom: 12 },
  refreshButton: {
    minHeight: 40,
    minWidth: 60,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dce2e8',
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  refreshText: { color: '#17202b', fontSize: 12, fontWeight: '600' },
  groupHeader: { marginBottom: 8, marginTop: 4 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { color: '#17202b', fontSize: 15, fontWeight: '700' },
  countBadge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dce2e8',
    backgroundColor: '#fff',
  },
  countText: { color: '#334155', fontFamily: 'monospace', fontSize: 10, fontWeight: '600' },
  groupHint: { color: '#526171', fontSize: 11, lineHeight: 16, marginTop: 2 },
  emptyGroup: { color: '#64748b', fontSize: 12, marginTop: 2, marginBottom: 18 },
  workCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2e8',
    padding: 12,
    marginBottom: 16,
  },
  workHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  plate: {
    backgroundColor: '#facc15',
    borderColor: '#17202b',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  plateText: { color: '#111827', fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
  waiting: { color: '#17202b', fontSize: 11 },
  mono: { color: '#17202b', fontFamily: 'monospace' },
  supplier: { color: '#17202b', fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 8 },
  documents: { color: '#334155', fontSize: 11, lineHeight: 16, marginTop: 4 },
  erpError: { color: '#b83232', fontSize: 11, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9 },
  actionButtonPrimary: { backgroundColor: '#b8410e' },
  actionButtonSecondary: { borderWidth: 1, borderColor: '#dce2e8', backgroundColor: '#fff' },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actionTextSecondary: { color: '#17202b' },
  disabled: { opacity: 0.6 },
});
