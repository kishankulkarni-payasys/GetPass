import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { TabBarIcon, TabBarIconName } from '../components/icons/TabBarIcon';
import { colors } from '../components/ui';
import { Text } from '../components/LocalizedText';
import { raisedSurface } from '../theme/neumorphism';
import { getActionsForRole } from '../navigation/roleActions';
import type { MainTabScreenProps } from '../navigation/TabNavigator';
import type { UserRole } from '../types/auth';

type Props = MainTabScreenProps<'MoreTab'>;

interface MoreItem {
  key: string;
  label: string;
  icon: TabBarIconName;
}

// Actions already surfaced as real bottom-tab entries (see TabNavigator.tsx) are left out of
// More so a role never sees the same destination listed in both places.
const PRIMARY_TAB_KEYS = new Set(['dashboard', 'gateIn', 'stores', 'weighbridge', 'quality']);

const ACTION_DETAILS: Record<string, Omit<MoreItem, 'key'>> = {
  gateOut: { label: 'Gate-out', icon: 'logout' },
  users: { label: 'Users', icon: 'group' },
  weighbridge: { label: 'Weighbridge', icon: 'balance' },
  quality: { label: 'Quality', icon: 'verified_user' },
};

function getMoreItems(role?: UserRole): MoreItem[] {
  // Admin is the exception: TabNavigator.tsx hides weighbridge/quality as tabs for admin
  // specifically, so they must NOT be excluded here as "already a tab" for that role — every
  // other role still has them as primary tabs and keeps the usual exclusion.
  const isAdmin = role === 'admin';
  const primaryTabKeys = isAdmin
    ? new Set([...PRIMARY_TAB_KEYS].filter(key => key !== 'weighbridge' && key !== 'quality'))
    : PRIMARY_TAB_KEYS;

  const actionItems = role
    ? getActionsForRole(role)
        .filter(action => !primaryTabKeys.has(action.key))
        .flatMap(action => {
          const details = ACTION_DETAILS[action.key];
          return details ? [{ key: action.key, ...details }] : [];
        })
    : [];

  return [
    ...actionItems,
    { key: 'account', label: 'Account', icon: 'account_circle' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ];
}

function MoreRow({
  item,
  selected,
  onPress,
}: {
  item: MoreItem;
  selected: boolean;
  onPress: () => void;
}) {
  const color = selected ? '#b8410e' : '#475569';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
    >
      <TabBarIcon name={item.icon} color={color} size={19} />
      <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{item.label}</Text>
    </TouchableOpacity>
  );
}

function navigateToItem(navigation: Props['navigation'], key: string) {
  switch (key) {
    case 'gateOut':
      navigation.navigate('EntryList', { mode: 'open' });
      break;
    case 'users':
      navigation.navigate('Users');
      break;
    case 'weighbridge':
      navigation.navigate('Weighbridge');
      break;
    case 'quality':
      navigation.navigate('QualityQueue');
      break;
    case 'account':
      navigation.navigate('Account');
      break;
    case 'settings':
      navigation.navigate('Settings');
      break;
  }
}

export function MoreSectionsSheet({
  visible,
  activeKey,
  onClose,
  onSelect,
}: {
  visible: boolean;
  activeKey: string | null;
  onClose: () => void;
  onSelect: (key: string) => void;
}) {
  const { user } = useAuth();
  const items = getMoreItems(user?.role);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close More sections"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>More sections</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.rows} keyboardShouldPersistTaps="handled">
            {items.map(item => (
              <MoreRow
                key={item.key}
                item={item}
                selected={item.key === activeKey}
                onPress={() => onSelect(item.key)}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function MoreScreen({ navigation }: Props) {
  const { user } = useAuth();
  const items = getMoreItems(user?.role);

  return (
    <SafeAreaView style={styles.fallbackScreen} edges={['left', 'right']}>
      <Text style={styles.fallbackTitle}>More sections</Text>
      <ScrollView contentContainerStyle={styles.fallbackRows}>
        {items.map(item => (
          <MoreRow
            key={item.key}
            item={item}
            selected={false}
            onPress={() => navigateToItem(navigation, item.key)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  sheet: {
    ...raisedSurface,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 8,
  },
  sheetTitle: { color: '#17202b', fontSize: 14, fontWeight: '700' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#475569', fontSize: 22, lineHeight: 24 },
  rows: { paddingHorizontal: 6, paddingBottom: 16 },
  row: {
    ...raisedSurface,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 7,
  },
  rowSelected: { backgroundColor: '#fceee6' },
  rowLabel: { color: '#17202b', fontSize: 12, fontWeight: '500' },
  rowLabelSelected: { color: '#b8410e', fontWeight: '600' },
  fallbackScreen: { flex: 1, backgroundColor: colors.background },
  fallbackTitle: { color: '#17202b', fontSize: 18, fontWeight: '700', paddingHorizontal: 18, paddingVertical: 16 },
  fallbackRows: { paddingHorizontal: 8 },
});
