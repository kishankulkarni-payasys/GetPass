import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import NewEntryScreen from '../screens/gate/NewEntryScreen';
import EntryListScreen from '../screens/gate/EntryListScreen';
import EntryDetailScreen from '../screens/gate/EntryDetailScreen';
import WeighbridgeScreen from '../screens/weighbridge/WeighbridgeScreen';
import WeighCaptureScreen from '../screens/weighbridge/WeighCaptureScreen';
import QualityQueueScreen from '../screens/quality/QualityQueueScreen';
import QualityResultScreen from '../screens/quality/QualityResultScreen';
import GrnListScreen from '../screens/stores/GrnListScreen';
import GrnDetailScreen from '../screens/stores/GrnDetailScreen';
import DashboardScreen from '../screens/DashboardScreen';
import UsersScreen from '../screens/UsersScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  NewEntry: undefined;
  EntryList: { mode: 'open' | 'all' };
  EntryDetail: { entryId: number };
  Weighbridge: undefined;
  WeighCapture: { entryId: number; vehicleNumber: string };
  QualityQueue: undefined;
  QualityResult: { entryId: number };
  GrnList: undefined;
  GrnDetail: { entryId: number };
  Dashboard: undefined;
  Users: undefined;
  Account: undefined;
  Settings: undefined;
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
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="NewEntry" component={NewEntryScreen} options={{ headerShown: true, title: 'Gate In', ...HEADER_OPTIONS }} />
            <Stack.Screen
              name="EntryList"
              component={EntryListScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.mode === 'all' ? 'Entry Log' : 'Gate Out',
                ...HEADER_OPTIONS,
              })}
            />
            <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ headerShown: true, title: 'Pass Detail', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Weighbridge" component={WeighbridgeScreen} options={{ headerShown: true, title: 'Weighbridge', ...HEADER_OPTIONS }} />
            <Stack.Screen name="WeighCapture" component={WeighCaptureScreen} options={{ headerShown: true, title: 'Capture Weight', ...HEADER_OPTIONS }} />
            <Stack.Screen name="QualityQueue" component={QualityQueueScreen} options={{ headerShown: true, title: 'Quality Queue', ...HEADER_OPTIONS }} />
            <Stack.Screen name="QualityResult" component={QualityResultScreen} options={{ headerShown: true, title: 'Quality Result', ...HEADER_OPTIONS }} />
            <Stack.Screen name="GrnList" component={GrnListScreen} options={{ headerShown: true, title: 'Stores / GRN', ...HEADER_OPTIONS }} />
            <Stack.Screen name="GrnDetail" component={GrnDetailScreen} options={{ headerShown: true, title: 'GRN', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, title: 'Dashboard', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Users" component={UsersScreen} options={{ headerShown: true, title: 'Users', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: true, title: 'Account', ...HEADER_OPTIONS }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', ...HEADER_OPTIONS }} />
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
