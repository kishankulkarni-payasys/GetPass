import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { listEntries } from '../../api/entries';
import { VehicleEntryOut } from '../../types/entries';
import { EmptyState, ErrorBanner, Input, LoadingView, Pill, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryList'>;

const OPEN_STATES = ['GATE_IN', 'ON_SITE', 'QUALITY_PENDING', 'QUALITY_RESOLVED', 'GRN_DRAFT', 'GRN_APPROVED'] as const;

type PillTone = 'good' | 'warn' | 'crit' | 'info' | 'neutral';

const STATE_TONE: Record<string, PillTone> = {
  GATE_IN: 'warn',
  ON_SITE: 'warn',
  QUALITY_PENDING: 'crit',
  QUALITY_RESOLVED: 'good',
  GRN_DRAFT: 'good',
  GRN_APPROVED: 'info',
  GATE_OUT: 'neutral',
  CANCELLED: 'neutral',
};

function EntryRow({ entry, onPress }: { entry: VehicleEntryOut; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <Text style={styles.vehicle}>{entry.vehicle_number}</Text>
        <Pill label={entry.pass_state.replace('_', ' ')} tone={STATE_TONE[entry.pass_state] ?? 'neutral'} />
      </View>
      <Text style={styles.subtext}>{entry.driver_name}</Text>
      {entry.supplier_transporter_name ? <Text style={styles.subtext}>{entry.supplier_transporter_name}</Text> : null}
      <Text style={styles.timestamp}>In: {new Date(entry.entry_time).toLocaleString()}</Text>
    </TouchableOpacity>
  );
}

export default function EntryListScreen({ route, navigation }: Props) {
  const mode = route.params?.mode ?? 'open';
  const [entries, setEntries] = useState<VehicleEntryOut[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
    setErrorMessage(null);
    try {
      // Filtered client-side (not via the `state` query param) to avoid relying on axios's
      // array-param serialization matching FastAPI's repeated-key `Query(List[...])` parsing.
      const data = await listEntries({});
      setEntries(mode === 'open' ? data.filter(entry => OPEN_STATES.includes(entry.pass_state as any)) : data);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load passes.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = entries.filter(entry =>
    search.trim().length === 0 || entry.vehicle_number.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Input value={search} onChangeText={setSearch} placeholder="Search by vehicle number" autoCapitalize="characters" />
      </View>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <EntryRow entry={item} onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })} />
        )}
        ListEmptyComponent={<EmptyState message={mode === 'open' ? 'No vehicles currently on site.' : 'No passes found.'} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: { paddingHorizontal: 16, paddingTop: 12 },
  list: { paddingBottom: 24 },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  vehicle: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtext: { fontSize: 13, color: colors.subtext, marginTop: 2 },
  timestamp: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
