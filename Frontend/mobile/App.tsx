import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, {AxiosInstance} from 'axios';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

const API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://localhost:8000/api';

type User = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

let api: AxiosInstance;

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

function errorDetail(error: unknown, fallback = 'Request failed') {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {return detail;}
  }
  return fallback;
}

function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api = axios.create({baseURL: API_URL});
    const restore = async () => {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      api.defaults.headers.Authorization = `Bearer ${token}`;
      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
      } catch {
        await AsyncStorage.removeItem('access_token');
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username,
      password,
    });
    await AsyncStorage.setItem('access_token', response.data.access_token);
    api.defaults.headers.Authorization = `Bearer ${response.data.access_token}`;
    setUser(response.data);
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      await AsyncStorage.removeItem('access_token');
      delete api.defaults.headers.Authorization;
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{user, loading, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

const colors = {
  navy: '#102a43',
  blue: '#2563eb',
  pale: '#eff6ff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#dbe3ed',
  white: '#ffffff',
  danger: '#dc2626',
  success: '#15803d',
};

function LoginScreen() {
  const {login} = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Required', 'Enter username and password');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (error) {
      Alert.alert('Sign in failed', errorDetail(error, 'Invalid credentials'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginPage}>
      <ScrollView contentContainerStyle={styles.loginContent}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>G</Text>
          </View>
          <Text style={styles.brandName}>GatePass</Text>
        </View>
        <Text style={styles.loginTitle}>Operational access</Text>
        <Text style={styles.loginCopy}>Sign in to manage gate, weighbridge, quality and GRN work.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in securely</Text>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
            editable={!submitting}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            editable={!submitting}
          />
          <Pressable
            style={[styles.primaryButton, submitting && styles.disabled]}
            onPress={submit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.footer}>GatePass mobile</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenHeader({title, subtitle}: {title: string; subtitle?: string}) {
  return (
    <View style={styles.screenHeader}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.blue} />
    </View>
  );
}

function DashboardScreen({navigation}: any) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard/summary');
      setSummary(response.data);
    } catch (error) {
      Alert.alert('Dashboard unavailable', errorDetail(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !summary) {return <LoadingView />;}

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={styles.screenContent}>
      <ScreenHeader title="Dashboard" subtitle="Live operational summary" />
      {summary ? (
        <>
          <View style={styles.kpiGrid}>
            <Kpi value={summary.kpis.on_site_now} label="On site" />
            <Kpi value={summary.kpis.awaiting_quality} label="Awaiting quality" />
            <Kpi value={summary.kpis.grn_pending_post} label="GRN pending" />
            <Kpi value={summary.kpis.vehicles_today} label="Vehicles today" />
          </View>
          <Text style={styles.sectionTitle}>Active passes</Text>
          {(summary.board ?? []).map((row: any) => (
            <Pressable
              key={row.id}
              style={styles.recordCard}
              onPress={() => navigation.navigate('PassDetail', {id: row.id})}>
              <View style={styles.recordTop}>
                <Text style={styles.plate}>{row.vehicle_number}</Text>
                <Text style={styles.badge}>{row.pass_state}</Text>
              </View>
              <Text style={styles.recordMeta}>{row.supplier_name || row.pass_type}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Kpi({value, label}: {value: number | string; label: string}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function EntryLogScreen({navigation}: any) {
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/entries', {
        params: search ? {vehicle_number: search} : undefined,
      });
      setEntries(response.data);
    } catch (error) {
      Alert.alert('Entry log unavailable', errorDetail(error));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <View style={styles.screenContent}>
      <ScreenHeader title="Entry log" subtitle="Search and open passes" />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search vehicle number"
        style={styles.input}
      />
      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          ListEmptyComponent={<Text style={styles.empty}>No passes found</Text>}
          renderItem={({item}) => (
            <Pressable
              style={styles.recordCard}
              onPress={() =>
                navigation.navigate('PassDetail', {id: item.id})
              }>
              <View style={styles.recordTop}>
                <Text style={styles.plate}>{item.vehicle_number}</Text>
                <Text style={styles.badge}>{item.pass_state}</Text>
              </View>
              <Text style={styles.recordMeta}>
                {item.pass_type} • {item.driver_name || 'No driver'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function GateInScreen() {
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!vehicle.trim() || !driver.trim()) {
      Alert.alert('Required', 'Vehicle number and driver name are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/entries', {
        vehicle_number: vehicle.trim(),
        driver_name: driver.trim(),
        driver_phone: phone.trim() || null,
        pass_type: 'inward',
      });
      setVehicle('');
      setDriver('');
      setPhone('');
      Alert.alert('Pass created', 'Gate-in entry was registered');
    } catch (error) {
      Alert.alert('Could not create pass', errorDetail(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <ScreenHeader title="Gate in" subtitle="Register a vehicle" />
      <View style={styles.card}>
        <Text style={styles.label}>Vehicle number</Text>
        <TextInput value={vehicle} onChangeText={setVehicle} style={styles.input} autoCapitalize="characters" />
        <Text style={styles.label}>Driver name</Text>
        <TextInput value={driver} onChangeText={setDriver} style={styles.input} />
        <Text style={styles.label}>Driver phone</Text>
        <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
        <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Create pass</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function GateOutScreen({navigation}: any) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/entries');
      setEntries(
        response.data.filter((entry: any) =>
          !['GATE_OUT', 'CANCELLED'].includes(entry.pass_state),
        ),
      );
    } catch (error) {
      Alert.alert('Gate-out unavailable', errorDetail(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {return <LoadingView />;}
  return (
    <FlatList
      contentContainerStyle={styles.screenContent}
      data={entries}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={<ScreenHeader title="Gate out" subtitle="Active passes" />}
      renderItem={({item}) => (
        <Pressable style={styles.recordCard} onPress={() => navigation.navigate('PassDetail', {id: item.id})}>
          <View style={styles.recordTop}>
            <Text style={styles.plate}>{item.vehicle_number}</Text>
            <Text style={styles.badge}>{item.pass_state}</Text>
          </View>
          <Text style={styles.recordMeta}>{item.driver_name}</Text>
        </Pressable>
      )}
    />
  );
}

function PassDetailScreen({route}: any) {
  const {id} = route.params;
  const [pass, setPass] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/entries/${id}`);
      setPass(response.data);
    } catch (error) {
      Alert.alert('Pass unavailable', errorDetail(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {return <LoadingView />;}
  if (!pass) {return null;}

  const exit = async () => {
    try {
      await api.patch(`/entries/${id}/exit`, {
        rejected_material_on_vehicle: false,
      });
      await load();
      Alert.alert('Gate-out complete', 'The pass has exited');
    } catch (error) {
      Alert.alert('Gate-out failed', errorDetail(error));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <ScreenHeader title={pass.vehicle_number} subtitle={pass.pass_state} />
      <View style={styles.card}>
        <DetailRow label="Pass type" value={pass.pass_type} />
        <DetailRow label="Driver" value={pass.driver_name} />
        <DetailRow label="Driver phone" value={pass.driver_phone || '—'} />
        {pass.project_name ? <DetailRow label="Project" value={pass.project_name} /> : null}
      </View>
      {!['GATE_OUT', 'CANCELLED'].includes(pass.pass_state) ? (
        <Pressable style={styles.primaryButton} onPress={exit}>
          <Text style={styles.primaryButtonText}>Record gate out</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function GenericApiScreen({title, endpoint, fields}: {title: string; endpoint: string; fields?: string[]}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(endpoint);
      setItems(Array.isArray(response.data) ? response.data : response.data.items ?? []);
    } catch (error) {
      Alert.alert(title, errorDetail(error));
    } finally {
      setLoading(false);
    }
  }, [endpoint, title]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {return <LoadingView />;}
  return (
    <FlatList
      contentContainerStyle={styles.screenContent}
      data={items}
      keyExtractor={(item, index) => String(item.id ?? item.name ?? index)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={<ScreenHeader title={title} />}
      ListEmptyComponent={<Text style={styles.empty}>No records found</Text>}
      renderItem={({item}) => (
        <View style={styles.recordCard}>
          {fields?.map(field => (
            <Text key={field} style={styles.recordMeta}>
              {field}: {String(item[field] ?? '—')}
            </Text>
          )) ?? <Text style={styles.recordMeta}>{JSON.stringify(item)}</Text>}
        </View>
      )}
    />
  );
}

function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      Alert.alert('Users unavailable', errorDetail(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {return <LoadingView />;}
  return (
    <FlatList
      contentContainerStyle={styles.screenContent}
      data={users}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={<ScreenHeader title="Users" subtitle="Team accounts" />}
      renderItem={({item}) => (
        <View style={styles.recordCard}>
          <Text style={styles.plate}>{item.full_name}</Text>
          <Text style={styles.recordMeta}>{item.username} • {item.role}</Text>
        </View>
      )}
    />
  );
}

function AccountScreen() {
  const {user, logout} = useAuth();
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <ScreenHeader title="Account" />
      <View style={styles.card}>
        <DetailRow label="Name" value={user?.full_name ?? ''} />
        <DetailRow label="Username" value={user?.username ?? ''} />
        <DetailRow label="Role" value={user?.role ?? ''} />
      </View>
      <Pressable
        style={[styles.primaryButton, {backgroundColor: colors.danger}]}
        onPress={() => logout()}>
        <Text style={styles.primaryButtonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function PassStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="EntryLog" component={EntryLogScreen} options={{title: 'Entry log'}} />
      <Stack.Screen name="PassDetail" component={PassDetailScreen} options={{title: 'Pass detail'}} />
    </Stack.Navigator>
  );
}

function MainApp() {
  const {user} = useAuth();
  const role = user?.role;
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
      }}>
      {['admin', 'store_incharge', 'site_supervisor'].includes(role ?? '') && (
        <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      )}
      {['admin', 'security_guard'].includes(role ?? '') && (
        <Tabs.Screen name="GateIn" component={GateInScreen} options={{title: 'Gate in'}} />
      )}
      {['admin', 'security_guard'].includes(role ?? '') && (
        <Tabs.Screen name="GateOut" component={GateOutScreen} options={{title: 'Gate out'}} />
      )}
      {['admin', 'weighbridge_operator'].includes(role ?? '') && (
        <Tabs.Screen
          name="Weighbridge"
          children={() => (
            <GenericApiScreen title="Weighbridge" endpoint="/weighments" fields={['vehicle_number', 'gross_weight', 'tare_weight', 'net_weight']} />
          )}
        />
      )}
      {['admin', 'quality_inspector'].includes(role ?? '') && (
        <Tabs.Screen
          name="Quality"
          children={() => (
            <GenericApiScreen title="Quality" endpoint="/quality/queue" fields={['vehicle_number', 'pass_state']} />
          )}
        />
      )}
      {['admin', 'store_incharge'].includes(role ?? '') && (
        <Tabs.Screen
          name="GRN"
          children={() => (
            <GenericApiScreen title="GRN" endpoint="/grn/work" />
          )}
        />
      )}
      <Tabs.Screen name="Log" component={PassStack} options={{title: 'Log'}} />
      {role === 'admin' && (
        <Tabs.Screen name="Users" component={UsersScreen} />
      )}
      <Tabs.Screen name="Account" component={AccountScreen} />
    </Tabs.Navigator>
  );
}

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <AppNavigation />
    </AuthProvider>
  );
}

function AppNavigation() {
  const {user, loading} = useAuth();
  if (loading) {return <SafeAreaView style={styles.center}><LoadingView /></SafeAreaView>;}
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {user ? (
          <Stack.Screen name="Main" component={MainApp} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loginPage: {flex: 1, backgroundColor: colors.navy},
  loginContent: {flexGrow: 1, justifyContent: 'center', padding: 24},
  brand: {flexDirection: 'row', alignItems: 'center', marginBottom: 32},
  brandMark: {width: 38, height: 38, borderRadius: 10, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center', marginRight: 10},
  brandMarkText: {color: colors.white, fontSize: 22, fontWeight: '800'},
  brandName: {color: colors.white, fontSize: 24, fontWeight: '800'},
  loginTitle: {color: colors.white, fontSize: 34, fontWeight: '800', marginBottom: 8},
  loginCopy: {color: '#cbd5e1', fontSize: 16, lineHeight: 24, marginBottom: 24},
  footer: {color: '#94a3b8', textAlign: 'center', marginTop: 24},
  card: {backgroundColor: colors.white, borderRadius: 16, padding: 18, marginBottom: 16},
  cardTitle: {fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16},
  label: {fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 7, marginTop: 8},
  input: {borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, color: colors.text, backgroundColor: colors.white, marginBottom: 8},
  primaryButton: {backgroundColor: colors.blue, borderRadius: 9, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10},
  primaryButtonText: {color: colors.white, fontWeight: '800', fontSize: 16},
  disabled: {opacity: 0.65},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  screenContent: {flexGrow: 1, backgroundColor: '#f8fafc', padding: 16, paddingBottom: 28},
  screenHeader: {marginBottom: 16},
  screenTitle: {fontSize: 26, fontWeight: '800', color: colors.text},
  screenSubtitle: {fontSize: 14, color: colors.muted, marginTop: 4},
  sectionTitle: {fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 18, marginBottom: 10},
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  kpi: {width: '48%', backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border},
  kpiValue: {fontSize: 24, fontWeight: '800', color: colors.navy},
  kpiLabel: {fontSize: 12, color: colors.muted, marginTop: 4},
  recordCard: {backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10},
  recordTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  plate: {fontSize: 17, fontWeight: '800', color: colors.text},
  badge: {fontSize: 11, fontWeight: '800', color: colors.blue, backgroundColor: colors.pale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, overflow: 'hidden'},
  recordMeta: {fontSize: 13, color: colors.muted, marginTop: 6},
  empty: {textAlign: 'center', color: colors.muted, marginTop: 32},
  detailRow: {flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#edf2f7', paddingVertical: 10},
  detailLabel: {color: colors.muted, fontSize: 13},
  detailValue: {color: colors.text, fontWeight: '700', fontSize: 13, maxWidth: '65%', textAlign: 'right'},
});

export default App;
