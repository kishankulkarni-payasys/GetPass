import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getQualityQueue } from '../../api/quality';
import { QualityQueueItem } from '../../types/quality';
import { EmptyState, ErrorBanner, LoadingView, Pill, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'QualityQueue'>;

export default function QualityQueueScreen({ navigation }: Props) {
  const [items, setItems] = useState<QualityQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
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

  return (
    <View style={styles.screen}>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('QualityResult', { entryId: item.id })}>
            <View style={styles.rowHeader}>
              <Text style={styles.vehicle}>{item.vehicle_number}</Text>
              {item.over_sla ? <Pill label="Over SLA" tone="crit" /> : <Pill label="Pending" tone="warn" />}
            </View>
            {item.supplier ? <Text style={styles.subtext}>{item.supplier}</Text> : null}
            <Text style={styles.subtext}>
              PO {item.po_number ?? '—'} · Challan {item.challan_number ?? '—'} · {item.challan_lines.length} line(s)
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState message="No passes are waiting on quality inspection." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
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
});
