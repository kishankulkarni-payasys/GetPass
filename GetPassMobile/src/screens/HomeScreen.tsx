import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getActionsForRole, RoleAction } from '../navigation/roleActions';

// Placeholder shell: tapping an action currently just confirms navigation would
// occur here. Each one becomes a real screen in a follow-up pass (see report).
function ActionCard({ action }: { action: RoleAction }) {
  return (
    <TouchableOpacity style={styles.card}>
      <Text style={styles.cardLabel}>{action.label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const actions = user ? getActionsForRole(user.role) : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.full_name}</Text>
          <Text style={styles.role}>{user?.role.replace('_', ' ')}</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={actions}
        keyExtractor={item => item.key}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ActionCard action={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No actions available for this role yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  role: { fontSize: 13, color: '#888', textTransform: 'capitalize', marginTop: 2 },
  signOut: { color: '#c0392b', fontWeight: '600' },
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
    borderColor: '#eee',
  },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', textAlign: 'center' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
