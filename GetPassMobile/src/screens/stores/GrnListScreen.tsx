import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabScreenProps } from '../../navigation/TabNavigator';
import { listStoreWork } from '../../api/grn';
import { GrnWorkItem } from '../../types/grn';
import { EmptyState, ErrorBanner, LoadingView, Pill, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = MainTabScreenProps<'StoresTab'>;

const GROUP_LABELS: Record<string, string> = {
  send_for_inspection: 'Awaiting inspection',
  ready_for_grn: 'Ready for GRN',
  draft: 'GRN draft',
  pending_post: 'Pending ERP post',
  approved: 'Approved',
};

export default function GrnListScreen({ navigation }: Props) {
  const [items, setItems] = useState<GrnWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
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

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        {/* Pushed as a top-level stack screen (not a tab switch): store_incharge has the
            Stores/GRN tab but not the Entry Log tab, so this link must keep working for them. */}
        <TouchableOpacity onPress={() => navigation.navigate('EntryList', { mode: 'all' })}>
          <Text style={styles.link}>Open entry log</Text>
        </TouchableOpacity>
      </View>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      <FlatList
        data={items}
        keyExtractor={item => String(item.entry_id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('EntryDetail', { entryId: item.entry_id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.vehicle}>{item.vehicle_number}</Text>
              <Pill label={GROUP_LABELS[item.group] ?? item.group} tone={item.group === 'pending_post' ? 'crit' : 'info'} />
            </View>
            {item.supplier ? <Text style={styles.subtext}>{item.supplier}</Text> : null}
            <Text style={styles.subtext}>
              PO {item.po_number ?? '—'} · Challan {item.challan_number ?? '—'}
            </Text>
            {item.erp_last_error ? <Text style={styles.errorText}>{item.erp_last_error}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState message="Nothing in the store work list right now." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: { paddingHorizontal: 16, paddingTop: 12 },
  link: { color: colors.primary, fontWeight: '600' },
  list: { paddingVertical: 12, paddingBottom: 24 },
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
  errorText: { fontSize: 12, color: colors.danger, marginTop: 4 },
});
