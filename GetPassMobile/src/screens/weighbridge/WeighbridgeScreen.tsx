import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { listEntries } from '../../api/entries';
import { VehicleEntryOut } from '../../types/entries';
import { EmptyState, ErrorBanner, LoadingView, Pill, colors } from '../../components/ui';
import { extractErrorMessage } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'Weighbridge'>;

const OPEN_STATES = new Set(['GATE_IN', 'ON_SITE', 'QUALITY_PENDING', 'QUALITY_RESOLVED', 'GRN_DRAFT', 'GRN_APPROVED']);

function weightStatus(entry: VehicleEntryOut): { label: string; tone: 'crit' | 'warn' | 'good' } {
  if (entry.current_gross_kg == null) return { label: 'Needs gross', tone: 'crit' };
  if (entry.current_tare_kg == null) return { label: 'Needs tare', tone: 'warn' };
  return { label: 'Both captured', tone: 'good' };
}

export default function WeighbridgeScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<VehicleEntryOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listEntries({});
      setEntries(data.filter(entry => OPEN_STATES.has(entry.pass_state)));
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

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.screen}>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      <FlatList
        data={entries}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => {
          const status = weightStatus(item);
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('WeighCapture', { entryId: item.id, vehicleNumber: item.vehicle_number })}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.vehicle}>{item.vehicle_number}</Text>
                <Pill label={status.label} tone={status.tone} />
              </View>
              <Text style={styles.subtext}>{item.driver_name}</Text>
              <Text style={styles.subtext}>
                Gross: {item.current_gross_kg ?? '—'} kg · Tare: {item.current_tare_kg ?? '—'} kg
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyState message="No vehicles currently on site." />}
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
