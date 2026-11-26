import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateUser, useDeleteUser, useUpdateUser, useUserList } from '../queries/useUserQueries';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, FieldLabel, Input, LoadingView } from '../components/ui';
import { UserRole } from '../types/auth';
import { UserOut } from '../types/users';
import { extractErrorMessage } from '../utils/apiError';
import { background, insetSurfaceStyle, raisedSurface } from '../theme/neumorphism';
import { Text } from '../components/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';

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

function matchesSearch(user: UserOut, query: string): boolean {
  const haystacks = [user.username, user.full_name, user.email, user.contact_no];
  return haystacks.some(value => Boolean(value) && value!.toLocaleLowerCase().includes(query));
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
  onEdit,
  onToggleActive,
  onDelete,
}: {
  user: UserOut;
  isCurrentUser: boolean;
  isMutating: boolean;
  onEdit: (user: UserOut) => void;
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
            <Text style={[styles.userMeta, !user.email && styles.userMetaMuted]}>
              {user.email || 'No email'}
            </Text>
            <Text style={[styles.userMeta, !user.contact_no && styles.userMetaMuted]}>
              {user.contact_no || 'No contact info'}
            </Text>
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

      <View style={styles.buttonRow}>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.userActionButton, styles.editButton, isMutating && styles.disabledButton]}
          disabled={isMutating}
          onPress={() => onEdit(user)}
        >
          <Text style={[styles.userActionText, styles.editText, isMutating && styles.disabledText]}>Edit</Text>
        </TouchableOpacity>
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
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { data: fetchedUsers, isLoading, isRefetching: isRefreshing, error: loadError, refetch } = useUserList();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('security_guard');
  const [mutatingUserId, setMutatingUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserOut | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('security_guard');
  const [editEmail, setEditEmail] = useState('');
  const [editContactNo, setEditContactNo] = useState('');

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const isSubmitting = createUserMutation.isPending;
  const isSavingEdit = updateUserMutation.isPending && editingUser !== null;

  const errorMessage = actionError ?? (loadError ? extractErrorMessage(loadError, 'Could not load users.') : null);

  const visibleUsers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return fetchedUsers ?? [];
    return (fetchedUsers ?? []).filter(candidate => matchesSearch(candidate, query));
  }, [fetchedUsers, searchQuery]);

  async function handleToggleActive(target: UserOut) {
    setActionError(null);
    setMutatingUserId(target.id);
    try {
      await updateUserMutation.mutateAsync({ userId: target.id, payload: { is_active: !target.is_active } });
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Could not update that user.'));
    } finally {
      setMutatingUserId(null);
    }
  }

  function openEditModal(target: UserOut) {
    setActionError(null);
    setEditingUser(target);
    setEditFullName(target.full_name);
    setEditRole(target.role);
    setEditEmail(target.email ?? '');
    setEditContactNo(target.contact_no ?? '');
  }

  function closeEditModal() {
    if (isSavingEdit) return;
    setEditingUser(null);
  }

  const canSubmitEdit = editFullName.trim().length > 0 && !isSavingEdit;

  async function handleSaveEdit() {
    if (!editingUser) return;
    const isEditingSelf = editingUser.id === currentUser?.id;
    setActionError(null);
    setMutatingUserId(editingUser.id);
    try {
      await updateUserMutation.mutateAsync({
        userId: editingUser.id,
        payload: {
          full_name: editFullName.trim(),
          role: isEditingSelf ? editingUser.role : editRole,
          email: editEmail.trim() || null,
          contact_no: editContactNo.trim() || null,
        },
      });
      setEditingUser(null);
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Could not update that user.'));
    } finally {
      setMutatingUserId(null);
    }
  }

  async function performDelete(target: UserOut) {
    setActionError(null);
    setMutatingUserId(target.id);
    try {
      await deleteUserMutation.mutateAsync(target.id);
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Could not delete that user.'));
    } finally {
      setMutatingUserId(null);
    }
  }

  function confirmDelete(target: UserOut) {
    Alert.alert(
      t('Delete user?'),
      t(`Delete ${target.full_name}? This cannot be undone.`),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Delete'), style: 'destructive', onPress: () => { performDelete(target); } },
      ],
    );
  }

  const canSubmit = username.trim().length >= 3 && password.length >= 8 && fullName.trim().length > 0 && !isSubmitting;

  async function handleCreate() {
    setActionError(null);
    try {
      await createUserMutation.mutateAsync({ username: username.trim(), password, full_name: fullName.trim(), role });
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('security_guard');
      setShowCreateForm(false);
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Could not create that user.'));
    }
  }

  function closeCreateForm() {
    if (isSubmitting) return;
    setUsername('');
    setPassword('');
    setFullName('');
    setRole('security_guard');
    setShowCreateForm(false);
  }

  if (isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <FlatList
        style={styles.flexOne}
        data={visibleUsers}
        keyExtractor={item => String(item.id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { refetch(); }} />}
        ListHeaderComponent={
          <>
            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.addButton, styles.addButtonCompact]}
              onPress={() => setShowCreateForm(true)}
            >
              <Text style={styles.addButtonText}>Add user</Text>
            </TouchableOpacity>
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search users..."
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            isCurrentUser={item.id === currentUser?.id}
            isMutating={mutatingUserId === item.id}
            onEdit={openEditModal}
            onToggleActive={handleToggleActive}
            onDelete={confirmDelete}
          />
        )}
        contentContainerStyle={styles.list}
      />

      <Modal
        visible={showCreateForm}
        transparent
        animationType="fade"
        onRequestClose={closeCreateForm}
      >
        <KeyboardAvoidingView
          style={styles.createModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            accessibilityLabel="Close create user form"
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeCreateForm}
          />
          <View style={styles.createModal}>
            <View style={styles.createModalHeader}>
              <View>
                <Text style={styles.createTitle}>Create a team account</Text>
                <Text style={styles.createCopy}>Set up sign-in details and permissions for a new user.</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeButton}
                disabled={isSubmitting}
                onPress={closeCreateForm}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.createModalBody}
            >
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editingUser !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          style={styles.createModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            accessibilityLabel="Close edit user form"
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeEditModal}
          />
          <View style={styles.createModal}>
            <View style={styles.createModalHeader}>
              <View>
                <Text style={styles.createTitle}>Edit team account</Text>
                <Text style={styles.createCopy}>Update profile details and permissions for this user.</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeButton}
                disabled={isSavingEdit}
                onPress={closeEditModal}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.createModalBody}
            >
              <FieldLabel label="Full name *" />
              <Input value={editFullName} onChangeText={setEditFullName} placeholder="Full name" />
              <FieldLabel label="Email" />
              <Input
                value={editEmail}
                onChangeText={setEditEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
              />
              <FieldLabel label="Contact number" />
              <Input
                value={editContactNo}
                onChangeText={setEditContactNo}
                keyboardType="phone-pad"
                placeholder="Contact number"
              />
              <FieldLabel label="Account role" />
              <RoleSelect
                value={editRole}
                disabled={editingUser?.id === currentUser?.id}
                onChange={setEditRole}
              />
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.addButton, styles.createSubmitButton, !canSubmitEdit && styles.disabledButton]}
                disabled={!canSubmitEdit}
                onPress={handleSaveEdit}
              >
                {isSavingEdit
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.addButtonText}>Save changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: background },
  flexOne: { flex: 1 },
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
  addButtonCompact: {
    alignSelf: 'flex-end',
    width: 130,
    paddingHorizontal: 12,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchInput: { marginBottom: 12 },
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  createModal: {
    ...raisedSurface,
    maxHeight: '88%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  createModalBody: { paddingHorizontal: 16, paddingBottom: 16 },
  createTitle: { color: '#15263a', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  createCopy: { color: '#526171', fontSize: 11, maxWidth: 260 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { color: '#526171', fontSize: 22, lineHeight: 24 },
  createSubmitButton: { marginTop: 14, marginBottom: 0 },
  userCard: { ...raisedSurface, borderRadius: 14, padding: 14, marginBottom: 12 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fceee6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#b8410e', fontSize: 11, fontWeight: '700' },
  userDetails: { flex: 1 },
  userName: { color: '#15263a', fontSize: 14, fontWeight: '700' },
  username: { color: '#526171', fontSize: 11, marginTop: 2 },
  userMeta: { color: '#526171', fontSize: 11, marginTop: 2 },
  userMetaMuted: { color: '#9aa6b1', fontStyle: 'italic' },
  badges: { alignItems: 'flex-end', gap: 5 },
  youBadge: { backgroundColor: '#e8f1fa', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  youBadgeText: { color: '#1e5d91', fontSize: 9, fontWeight: '700' },
  activeBadge: { backgroundColor: '#e5f4ec', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  activeBadgeText: { color: '#18734a', fontSize: 9, fontWeight: '700' },
  inactiveBadge: { backgroundColor: '#eef1f5' },
  inactiveBadgeText: { color: '#526171' },
  roleSelect: {
    ...insetSurfaceStyle,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  roleSelectDisabled: { backgroundColor: '#f5f7f9' },
  roleSelectText: { color: '#15263a', fontSize: 13 },
  roleChevron: { color: '#526171', fontSize: 18, marginTop: -4 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  userActionButton: { flex: 1, height: 36, borderRadius: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  editButton: { backgroundColor: '#eef1f5' },
  editText: { color: '#15263a' },
  deactivateButton: { backgroundColor: '#c99217' },
  activateButton: { backgroundColor: '#238653' },
  deleteButton: { backgroundColor: '#a92729' },
  disabledButton: { opacity: 0.55 },
  disabledDeleteButton: { backgroundColor: '#d09494' },
  userActionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  deactivateText: { color: '#161616' },
  disabledText: { color: '#7b8590' },
  emptyText: { color: '#526171', fontSize: 12, textAlign: 'center', paddingVertical: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  roleModal: { ...raisedSurface, borderRadius: 16, padding: 16, elevation: 8 },
  roleModalTitle: { color: '#15263a', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  roleOption: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10 },
  roleOptionSelected: { backgroundColor: '#fceee6' },
  roleOptionText: { color: '#15263a', fontSize: 13 },
  roleOptionTextSelected: { color: '#b8410e', fontWeight: '700' },
});
