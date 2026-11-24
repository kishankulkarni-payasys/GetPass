import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createUser, listUsers, updateUser } from '../api/users';
import { UserOut } from '../types/users';
import { UserRole } from '../types/auth';
import { Button, Card, ErrorBanner, FieldLabel, Input, LoadingView, Pill, colors } from '../components/ui';
import { extractErrorMessage } from '../utils/apiError';

// Mirrors Frontend/src/pages/UsersPage.jsx (admin-only user management), kept to the
// fields Backend/app/routers/users.py exposes: create, list, and role/active/password updates.
const ROLE_OPTIONS: UserRole[] = [
  'admin',
  'security_guard',
  'weighbridge_operator',
  'store_incharge',
  'quality_inspector',
  'site_supervisor',
];

function RoleChips({ value, onChange }: { value: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <View style={styles.chipRow}>
      {ROLE_OPTIONS.map(role => (
        <TouchableOpacity
          key={role}
          style={[styles.chip, value === role && styles.chipActive]}
          onPress={() => onChange(role)}
        >
          <Text style={[styles.chipText, value === role && styles.chipTextActive]}>{role.replace('_', ' ')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function UserRow({ user, onToggleActive }: { user: UserOut; onToggleActive: (user: UserOut) => void }) {
  return (
    <Card>
      <View style={styles.userRowHeader}>
        <View>
          <Text style={styles.userName}>{user.full_name}</Text>
          <Text style={styles.userSub}>@{user.username}</Text>
        </View>
        <Pill label={user.role.replace('_', ' ')} tone="info" />
      </View>
      <View style={styles.activeRow}>
        <Text style={styles.userSub}>{user.is_active ? 'Active' : 'Deactivated'}</Text>
        <Switch value={user.is_active} onValueChange={() => onToggleActive(user)} />
      </View>
    </Card>
  );
}

export default function UsersScreen() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('security_guard');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
    setErrorMessage(null);
    try {
      setUsers(await listUsers());
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not load users.'));
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

  async function handleToggleActive(user: UserOut) {
    setErrorMessage(null);
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      await load();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not update that user.'));
    }
  }

  const canSubmit = username.trim().length >= 3 && password.length >= 8 && fullName.trim().length > 0 && !isSubmitting;

  async function handleCreate() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createUser({ username: username.trim(), password, full_name: fullName.trim(), role });
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('security_guard');
      setShowCreateForm(false);
      await load();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not create that user.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingView />;

  return (
    <FlatList
      style={styles.screen}
      data={users}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <View style={styles.toggleRow}>
            <Button
              label={showCreateForm ? 'Cancel' : '+ New user'}
              variant="secondary"
              onPress={() => setShowCreateForm(show => !show)}
            />
          </View>
          {showCreateForm ? (
            <Card>
              <FieldLabel label="Username *" />
              <Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="min 3 characters" />
              <FieldLabel label="Password *" />
              <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="min 8 characters" />
              <FieldLabel label="Full name *" />
              <Input value={fullName} onChangeText={setFullName} placeholder="Full name" />
              <FieldLabel label="Role" />
              <RoleChips value={role} onChange={setRole} />
              <View style={styles.submitRow}>
                <Button label="Create user" onPress={handleCreate} disabled={!canSubmit} loading={isSubmitting} />
              </View>
            </Card>
          ) : null}
        </>
      }
      renderItem={({ item }) => <UserRow user={item} onToggleActive={handleToggleActive} />}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: 24 },
  toggleRow: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 4 },
  submitRow: { marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#eee' },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.subtext },
  chipTextActive: { color: '#fff' },
  userRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  userSub: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
});
