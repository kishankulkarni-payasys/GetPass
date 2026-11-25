import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import TabNavigator from './TabNavigator';
import EntryListScreen from '../screens/gate/EntryListScreen';
import EntryDetailScreen from '../screens/gate/EntryDetailScreen';
import WeighbridgeScreen from '../screens/weighbridge/WeighbridgeScreen';
import WeighCaptureScreen from '../screens/weighbridge/WeighCaptureScreen';
import QualityQueueScreen from '../screens/quality/QualityQueueScreen';
import QualityResultScreen from '../screens/quality/QualityResultScreen';
import GrnDetailScreen from '../screens/stores/GrnDetailScreen';
import UsersScreen from '../screens/UsersScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanScreen from '../screens/ScanScreen';
import { BrandHeaderAvatar, BrandHeaderMark } from '../components/BrandHeader';
import type { WeighmentKind } from '../types/entries';

// The authenticated area now lives behind a bottom tab navigator (see TabNavigator.tsx,
// rendered here as the "Main" screen). Screens that need to push on top of the tabs
// (pass detail, GRN detail, quality result entry, weigh capture, and the secondary "More"
// destinations) stay registered here so login/logout and the existing push flows are
// untouched.
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  EntryList: { mode: 'open' | 'all' };
  EntryDetail: { entryId: number };
  Weighbridge: undefined;
  WeighCapture: { entryId: number; vehicleNumber: string; kind?: WeighmentKind };
  QualityQueue: undefined;
  QualityResult: { entryId: number };
  GrnDetail: { entryId: number };
  Users: undefined;
  Account: undefined;
  Settings: undefined;
  Scan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#1a1a2e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen
              name="EntryList"
              component={EntryListScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.mode === 'all' ? 'Entry Log' : 'Gate-out',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#131a22',
                headerTitleStyle: { color: '#131a22', fontWeight: '700' as const },
                headerTitleAlign: 'left' as const,
                headerBackVisible: false,
                headerLeft: BrandHeaderMark,
                headerRight: BrandHeaderAvatar,
              })}
            />
            <Stack.Screen
              name="EntryDetail"
              component={EntryDetailScreen}
              options={{
                headerShown: true,
                title: 'Pass details',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#131a22',
                headerTitleStyle: { color: '#131a22', fontWeight: '700' },
                headerTitleAlign: 'left',
                headerRight: BrandHeaderAvatar,
              }}
            />
            <Stack.Screen
              name="Weighbridge"
              component={WeighbridgeScreen}
              options={{
                headerShown: true,
                title: 'Weighbridge',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#131a22',
                headerTitleStyle: { color: '#131a22', fontWeight: '700' },
                headerTitleAlign: 'left',
                headerLeft: BrandHeaderMark,
                headerRight: BrandHeaderAvatar,
              }}
            />
            <Stack.Screen name="WeighCapture" component={WeighCaptureScreen} options={{ headerShown: true, title: 'Capture Weight', ...HEADER_OPTIONS }} />
            <Stack.Screen
              name="QualityQueue"
              component={QualityQueueScreen}
              options={{
                headerShown: true,
                title: 'Quality',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#131a22',
                headerTitleStyle: { color: '#131a22', fontWeight: '700' },
                headerTitleAlign: 'left',
                headerLeft: BrandHeaderMark,
                headerRight: BrandHeaderAvatar,
              }}
            />
            <Stack.Screen name="QualityResult" component={QualityResultScreen} options={{ headerShown: true, title: 'Quality Result', ...HEADER_OPTIONS }} />
            <Stack.Screen
              name="GrnDetail"
              component={GrnDetailScreen}
              options={{
                headerShown: true,
                title: 'Stores / GRN',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#131a22',
                headerTitleStyle: { color: '#131a22', fontWeight: '700' },
                headerTitleAlign: 'left',
                headerRight: BrandHeaderAvatar,
              }}
            />
            <Stack.Screen
              name="Users"
              component={UsersScreen}
              options={{
                headerShown: true,
                title: 'Users',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#131a22',
                headerTitleStyle: { color: '#131a22', fontWeight: '700' },
                headerTitleAlign: 'left',
                headerBackVisible: false,
                headerLeft: BrandHeaderMark,
                headerRight: BrandHeaderAvatar,
              }}
            />
            <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: true, title: 'Account', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: true, title: 'Scan QR', ...HEADER_OPTIONS }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
