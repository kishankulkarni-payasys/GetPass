import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { getActionsForRole } from './roleActions';
import { RootStackParamList } from './RootNavigator';
import DashboardScreen from '../screens/DashboardScreen';
import NewEntryScreen from '../screens/gate/NewEntryScreen';
import EntryListScreen from '../screens/gate/EntryListScreen';
import GrnListScreen from '../screens/stores/GrnListScreen';
import MoreScreen from '../screens/MoreScreen';
import { colors } from '../components/ui';

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

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#1a1a2e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabLabel, focused ? styles.tabLabelFocused : styles.tabLabelInactive]}>{label}</Text>
  );
}

function tabLabelOptions(label: string) {
  return { tabBarLabel: ({ focused }: { focused: boolean }) => <TabLabel label={label} focused={focused} /> };
}

// EntryListScreen is shared with the top-level stack's own "EntryList" screen (pushed from
// NewEntryScreen after gate-in), so its props are typed against RootStackParamList. The tab
// navigator's navigation object already bubbles navigate() calls for parent-stack screens
// (e.g. EntryDetail) at runtime; this wrapper only reconciles the two navigator type shapes.
function EntryLogTabScreen(props: MainTabScreenProps<'EntryLogTab'>) {
  return <EntryListScreen {...(props as unknown as NativeStackScreenProps<RootStackParamList, 'EntryList'>)} />;
}

export default function TabNavigator() {
  const { user } = useAuth();
  const actions = user ? getActionsForRole(user.role) : [];
  const hasAction = (key: string) => actions.some(action => action.key === key);

  const showDashboard = hasAction('dashboard');
  const showGateIn = hasAction('gateIn');
  const showEntryLog = hasAction('gateOut');
  const showStores = hasAction('stores');

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        ...HEADER_OPTIONS,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      {showDashboard ? (
        <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Dashboard', ...tabLabelOptions('Dashboard') }} />
      ) : null}
      {showGateIn ? (
        <Tab.Screen name="GateInTab" component={NewEntryScreen} options={{ title: 'Gate In', ...tabLabelOptions('Gate In') }} />
      ) : null}
      {showEntryLog ? (
        <Tab.Screen
          name="EntryLogTab"
          component={EntryLogTabScreen}
          initialParams={{ mode: 'all' }}
          options={{ title: 'Entry Log', ...tabLabelOptions('Entry Log') }}
        />
      ) : null}
      {showStores ? (
        <Tab.Screen name="StoresTab" component={GrnListScreen} options={{ title: 'Stores / GRN', ...tabLabelOptions('Stores/GRN') }} />
      ) : null}
      <Tab.Screen name="MoreTab" component={MoreScreen} options={{ title: 'More', ...tabLabelOptions('More') }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11 },
  tabLabelFocused: { fontWeight: '700', color: colors.primary },
  tabLabelInactive: { fontWeight: '500', color: colors.muted },
});
