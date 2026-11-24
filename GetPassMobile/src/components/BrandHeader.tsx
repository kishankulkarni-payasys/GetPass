import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function BrandHeaderMark() {
  return (
    <View style={styles.mark}>
      <Text style={styles.markText}>G</Text>
    </View>
  );
}

export function BrandHeaderAvatar() {
  const { user } = useAuth();
  const name = user?.full_name || user?.username || 'User';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#e85d1f',
    marginRight: 8,
  },
  markText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#fceee6',
    marginRight: 4,
  },
  avatarText: { color: '#b8410e', fontSize: 11, fontWeight: '700' },
});
