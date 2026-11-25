import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { getActionsForRole } from './roleActions';
import type { RootStackParamList } from './RootNavigator';
import DashboardScreen from '../screens/DashboardScreen';
import NewEntryScreen from '../screens/gate/NewEntryScreen';
import EntryListScreen from '../screens/gate/EntryListScreen';
import GrnListScreen from '../screens/stores/GrnListScreen';
import MoreScreen, { MoreSectionsSheet } from '../screens/MoreScreen';
import { colors } from '../components/ui';
import { BrandHeaderAvatar, BrandHeaderMark } from '../components/BrandHeader';
import { TabBarIcon, TabBarIconName } from '../components/icons/TabBarIcon';

// The bottom tabs for the authenticated area, matching the roles' existing allow-lists in
// roleActions.ts (which itself mirrors Backend/app/auth.py's role gates). A tab only renders
// when the signed-in user's role has that action, same as the card grid it replaces.
export type MainTabParamList = {
  DashboardTab: undefined;
  GateInTab: undefined;
  EntryLogTab: { mode: 'all' };
  StoresTab: undefined;
  MoreTab: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

const Tab = createBottomTabNavigator<MainTabParamList>();
type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#fff' },
  headerTintColor: '#131a22',
  headerTitleStyle: { color: '#131a22', fontWeight: '700' as const },
  headerTitleAlign: 'left' as const,
  headerLeft: BrandHeaderMark,
  headerRight: BrandHeaderAvatar,
};

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabLabel, focused ? styles.tabLabelFocused : styles.tabLabelInactive]}>{label}</Text>
  );
}

function tabOptions(label: string, iconName: TabBarIconName) {
  return {
    tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name={iconName} color={color} />,
    tabBarLabel: ({ focused }: { focused: boolean }) => <TabLabel label={label} focused={focused} />,
  };
}

// EntryListScreen is shared with the top-level stack's own "EntryList" screen (pushed from
// NewEntryScreen after gate-in), so its props are typed against RootStackParamList. The tab
// navigator's navigation object already bubbles navigate() calls for parent-stack screens
// (e.g. EntryDetail) at runtime; this wrapper only reconciles the two navigator type shapes.
function EntryLogTabScreen(props: MainTabScreenProps<'EntryLogTab'>) {
  return <EntryListScreen {...(props as unknown as NativeStackScreenProps<RootStackParamList, 'EntryList'>)} />;
}

export default function TabNavigator({ navigation }: Props) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeMoreKey, setActiveMoreKey] = useState<string | null>(null);
  const { user } = useAuth();
  const actions = user ? getActionsForRole(user.role) : [];
  const hasAction = (key: string) => actions.some(action => action.key === key);

  const showDashboard = hasAction('dashboard');
  const showGateIn = hasAction('gateIn');
  const showEntryLog = hasAction('gateOut');
  const showStores = hasAction('stores');
  const hasPrimaryTabs = showDashboard || showGateIn || showEntryLog || showStores;

  function selectMoreItem(key: string) {
    setActiveMoreKey(key);
    setIsMoreOpen(false);
    switch (key) {
      case 'scan':
        navigation.navigate('Scan');
        break;
      case 'gateOut':
        navigation.navigate('EntryList', { mode: 'open' });
        break;
      case 'weighbridge':
        navigation.navigate('Weighbridge');
        break;
      case 'quality':
        navigation.navigate('QualityQueue');
        break;
      case 'users':
        navigation.navigate('Users');
        break;
      case 'account':
        navigation.navigate('Account');
        break;
      case 'settings':
        navigation.navigate('Settings');
        break;
    }
  }

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          ...HEADER_OPTIONS,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
        }}
      >
        {showDashboard ? (
          <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Dashboard', ...tabOptions('Dashboard', 'dashboard') }} />
        ) : null}
        {showGateIn ? (
          <Tab.Screen name="GateInTab" component={NewEntryScreen} options={{ title: 'Gate-in', ...tabOptions('Gate In', 'meeting_room') }} />
        ) : null}
        {showEntryLog ? (
          <Tab.Screen
            name="EntryLogTab"
            component={EntryLogTabScreen}
            initialParams={{ mode: 'all' }}
            options={{ title: 'Entry Log', ...tabOptions('Entry Log', 'receipt_long') }}
          />
        ) : null}
        {showStores ? (
          <Tab.Screen name="StoresTab" component={GrnListScreen} options={{ title: 'Stores / GRN', ...tabOptions('Stores/GRN', 'inventory_2') }} />
        ) : null}
        <Tab.Screen
          name="MoreTab"
          component={MoreScreen}
          options={{ title: 'More', ...tabOptions('More', 'more_horiz') }}
          listeners={{
            tabPress: event => {
              if (!hasPrimaryTabs) return;
              event.preventDefault();
              setIsMoreOpen(true);
            },
          }}
        />
      </Tab.Navigator>
      <MoreSectionsSheet
        visible={isMoreOpen}
        activeKey={activeMoreKey}
        onClose={() => setIsMoreOpen(false)}
        onSelect={selectMoreItem}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11 },
  tabLabelFocused: { fontWeight: '700', color: colors.primary },
  tabLabelInactive: { fontWeight: '500', color: colors.muted },
});
