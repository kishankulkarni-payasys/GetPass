import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getActionsForRole, RoleAction } from '../navigation/roleActions';
import type { MainTabScreenProps } from '../navigation/TabNavigator';
import { colors } from '../components/ui';

type Props = MainTabScreenProps<'MoreTab'>;

// Secondary destinations that have their own primary tab are left off this list so they
// aren't shown twice; everything else the role can reach (plus Account/Settings, which every
// signed-in user gets) lives here instead.
const PRIMARY_TAB_KEYS = new Set(['dashboard', 'gateIn', 'gateOut', 'stores']);

function ActionCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.cardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MoreScreen({ navigation }: Props) {
  const { user } = useAuth();
  const secondaryActions: RoleAction[] = user
    ? getActionsForRole(user.role).filter(action => !PRIMARY_TAB_KEYS.has(action.key))
    : [];

  const items: { key: string; label: string; onPress: () => void }[] = [
    ...secondaryActions.map(action => ({
      key: action.key,
      label: action.label,
      onPress: () => navigation.navigate(action.screen as never),
    })),
    { key: 'account', label: 'Account', onPress: () => navigation.navigate('Account') },
    { key: 'settings', label: 'Settings', onPress: () => navigation.navigate('Settings') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.full_name}</Text>
        <Text style={styles.role}>{user?.role.replace('_', ' ')}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.key}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ActionCard label={item.label} onPress={item.onPress} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.text },
  role: { fontSize: 13, color: colors.muted, textTransform: 'capitalize', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  row: { justifyContent: 'space-between' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 28,
    paddingHorizontal: 12,
    marginBottom: 12,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
});
