import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, colors } from '../components/ui';
import { Text } from '../components/LocalizedText';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

// Mirrors Frontend/src/pages/AccountPage.jsx: profile summary and sign-out. The web app has
// no self-service password change (Backend/app/routers/users.py is admin-only), so neither does this.
export default function AccountScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
    <ScrollView style={styles.flexOne}>
      <Card>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.full_name ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        <Text style={styles.role}>{user?.role.replace('_', ' ')}</Text>
      </Card>

      <Card>
        <Button label="Connection settings" variant="secondary" onPress={() => navigation.navigate('Settings')} />
      </Card>

      <Card>
        <Button label="Sign out" variant="danger" onPress={signOut} />
      </Card>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  username: { fontSize: 13, color: colors.subtext, marginTop: 2 },
  role: { fontSize: 13, color: colors.subtext, marginTop: 6, textTransform: 'capitalize' },
});
