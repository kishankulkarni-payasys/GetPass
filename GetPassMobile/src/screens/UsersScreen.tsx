import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createUser, deleteUser, listUsers, updateUser } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, FieldLabel, Input, LoadingView } from '../components/ui';
import { UserRole } from '../types/auth';
import { UserOut } from '../types/users';
import { extractErrorMessage } from '../utils/apiError';

const ROLE_OPTIONS: UserRole[] = [
  'admin',
  'security_guard',
  'weighbridge_operator',
  'store_incharge',
  'quality_inspector',
  'site_supervisor',
];

function formatRole(role: UserRole): string {
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

function RoleSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Account role: ${formatRole(value)}`}
        style={[styles.roleSelect, disabled && styles.roleSelectDisabled]}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
      >
        <Text style={[styles.roleSelectText, disabled && styles.disabledText]}>{formatRole(value)}</Text>
        <Text style={[styles.roleChevron, disabled && styles.disabledText]}>⌄</Text>
      </TouchableOpacity>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            accessibilityLabel="Close role options"
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View style={styles.roleModal}>
            <Text style={styles.roleModalTitle}>Select account role</Text>
            {ROLE_OPTIONS.map(role => (
              <TouchableOpacity
                key={role}
                style={[styles.roleOption, role === value && styles.roleOptionSelected]}
                onPress={() => {
                  setIsOpen(false);
                  onChange(role);
                }}
              >
                <Text style={[styles.roleOptionText, role === value && styles.roleOptionTextSelected]}>{formatRole(role)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

function UserCard({
  user,
  isCurrentUser,
  isMutating,
  onRoleChange,
  onToggleActive,
  onDelete,
}: {
  user: UserOut;
  isCurrentUser: boolean;
  isMutating: boolean;
  onRoleChange: (user: UserOut, role: UserRole) => void;
  onToggleActive: (user: UserOut) => void;
  onDelete: (user: UserOut) => void;
}) {
  return (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(user.full_name)}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.full_name}</Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          {isCurrentUser ? (
            <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>
          ) : null}
          <View style={[styles.activeBadge, !user.is_active && styles.inactiveBadge]}>
            <Text style={[styles.activeBadgeText, !user.is_active && styles.inactiveBadgeText]}>
              {user.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
      </View>

      <FieldLabel label="Account role" />
      <RoleSelect
        value={user.role}
        disabled={isCurrentUser || isMutating}
        onChange={role => onRoleChange(user, role)}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          accessibilityRole="button"
          style={[
            styles.userActionButton,
            user.is_active ? styles.deactivateButton : styles.activateButton,
            (isCurrentUser || isMutating) && styles.disabledButton,
          ]}
          disabled={isCurrentUser || isMutating}
          onPress={() => onToggleActive(user)}
        >
          <Text style={[styles.userActionText, user.is_active && styles.deactivateText, (isCurrentUser || isMutating) && styles.disabledText]}>
            {user.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.userActionButton, styles.deleteButton, (isCurrentUser || isMutating) && styles.disabledDeleteButton]}
          disabled={isCurrentUser || isMutating}
          onPress={() => onDelete(user)}
        >
          <Text style={[styles.userActionText, (isCurrentUser || isMutating) && styles.disabledText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
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
  const [mutatingUserId, setMutatingUserId] = useState<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
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

  async function handleToggleActive(target: UserOut) {
    setErrorMessage(null);
    setMutatingUserId(target.id);
    try {
      const updated = await updateUser(target.id, { is_active: !target.is_active });
      setUsers(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not update that user.'));
    } finally {
      setMutatingUserId(null);
    }
  }

  async function handleRoleChange(target: UserOut, nextRole: UserRole) {
    if (target.role === nextRole) return;
    setErrorMessage(null);
    setMutatingUserId(target.id);
    try {
      const updated = await updateUser(target.id, { role: nextRole });
      setUsers(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not update that user.'));
    } finally {
      setMutatingUserId(null);
    }
  }

  async function performDelete(target: UserOut) {
    setErrorMessage(null);
    setMutatingUserId(target.id);
    try {
      await deleteUser(target.id);
      setUsers(current => current.filter(item => item.id !== target.id));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Could not delete that user.'));
    } finally {
      setMutatingUserId(null);
    }
  }

  function confirmDelete(target: UserOut) {
    Alert.alert(
      'Delete user?',
      `Delete ${target.full_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { performDelete(target); } },
      ],
    );
  }

  const canSubmit = username.trim().length >= 3 && password.length >= 8 && fullName.trim().length > 0 && !isSubmitting;

  async function handleCreate() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const created = await createUser({ username: username.trim(), password, full_name: fullName.trim(), role });
      setUsers(current => [...current, created].sort((first, second) => first.username.localeCompare(second.username)));
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('security_guard');
      setShowCreateForm(false);
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
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.addButton}
            onPress={() => setShowCreateForm(show => !show)}
          >
            <Text style={styles.addButtonText}>{showCreateForm ? 'Cancel' : 'Add user'}</Text>
          </TouchableOpacity>
          {showCreateForm ? (
            <View style={styles.createCard}>
              <Text style={styles.createTitle}>New user</Text>
              <FieldLabel label="Full name *" />
              <Input value={fullName} onChangeText={setFullName} placeholder="Full name" />
              <FieldLabel label="Username *" />
              <Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="min 3 characters" />
              <FieldLabel label="Password *" />
              <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="min 8 characters" />
              <FieldLabel label="Account role" />
              <RoleSelect value={role} onChange={setRole} />
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.addButton, styles.createSubmitButton, !canSubmit && styles.disabledButton]}
                disabled={!canSubmit}
                onPress={handleCreate}
              >
                {isSubmitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.addButtonText}>Create user</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
      renderItem={({ item }) => (
        <UserCard
          user={item}
          isCurrentUser={item.id === currentUser?.id}
          isMutating={mutatingUserId === item.id}
          onRoleChange={handleRoleChange}
          onToggleActive={handleToggleActive}
          onDelete={confirmDelete}
        />
      )}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef1f5' },
  list: { paddingHorizontal: 10, paddingBottom: 24 },
  addButton: {
    height: 42,
    marginTop: 16,
    marginBottom: 10,
    borderRadius: 9,
    backgroundColor: '#b8410e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  createCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#dce2e8', padding: 14, marginBottom: 12 },
  createTitle: { color: '#15263a', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  createSubmitButton: { marginTop: 14, marginBottom: 0 },
  userCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#dce2e8', padding: 14, marginBottom: 12 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fceee6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#b8410e', fontSize: 11, fontWeight: '700' },
  userDetails: { flex: 1 },
  userName: { color: '#15263a', fontSize: 14, fontWeight: '700' },
  username: { color: '#526171', fontSize: 11, marginTop: 2 },
  badges: { alignItems: 'flex-end', gap: 5 },
  youBadge: { backgroundColor: '#e8f1fa', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  youBadgeText: { color: '#1e5d91', fontSize: 9, fontWeight: '700' },
  activeBadge: { backgroundColor: '#e5f4ec', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  activeBadgeText: { color: '#18734a', fontSize: 9, fontWeight: '700' },
  inactiveBadge: { backgroundColor: '#eef1f5' },
  inactiveBadgeText: { color: '#526171' },
  roleSelect: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce2e8',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  roleSelectDisabled: { backgroundColor: '#f5f7f9' },
  roleSelectText: { color: '#15263a', fontSize: 13 },
  roleChevron: { color: '#526171', fontSize: 18, marginTop: -4 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  userActionButton: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deactivateButton: { backgroundColor: '#c99217' },
  activateButton: { backgroundColor: '#238653' },
  deleteButton: { backgroundColor: '#a92729' },
  disabledButton: { opacity: 0.55 },
  disabledDeleteButton: { backgroundColor: '#d09494' },
  userActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deactivateText: { color: '#161616' },
  disabledText: { color: '#7b8590' },
  emptyText: { color: '#526171', fontSize: 12, textAlign: 'center', paddingVertical: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  roleModal: { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 8 },
  roleModalTitle: { color: '#15263a', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  roleOption: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10 },
  roleOptionSelected: { backgroundColor: '#fceee6' },
  roleOptionText: { color: '#15263a', fontSize: 13 },
  roleOptionTextSelected: { color: '#b8410e', fontWeight: '700' },
});
