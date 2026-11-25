import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, CameraType } from 'react-native-camera-kit';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { parseEntryQrPayload } from '../utils/qrPayload';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

type PermissionState = 'checking' | 'granted' | 'denied';

async function resolveCameraPermission(): Promise<PermissionState> {
  const permission = Platform.select({ ios: PERMISSIONS.IOS.CAMERA, default: PERMISSIONS.ANDROID.CAMERA });
  if (!permission) return 'denied';

  const status = await check(permission);
  if (status === RESULTS.GRANTED) return 'granted';
  if (status === RESULTS.BLOCKED || status === RESULTS.UNAVAILABLE) return 'denied';

  const requested = await request(permission);
  return requested === RESULTS.GRANTED ? 'granted' : 'denied';
}

// Opens the device camera to scan a pass's printed/displayed QR code and jumps
// straight to that pass's detail screen. This is the lookup counterpart to the
// web app's supplier/vehicle QR (which pre-fills the gate-in form) — here the
// QR code identifies an existing pass by id, it doesn't carry form fields.
export default function ScanScreen({ navigation }: Props) {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [scanError, setScanError] = useState<string | null>(null);
  const scanHandled = useRef(false);

  useFocusEffect(
    useCallback(() => {
      scanHandled.current = false;
      setScanError(null);
    }, []),
  );

  useEffect(() => {
    let active = true;
    resolveCameraPermission().then(result => {
      if (active) setPermissionState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleScan(rawValue: string) {
    if (scanHandled.current) return;
    const payload = parseEntryQrPayload(rawValue);
    if (!payload) {
      setScanError('This QR code is not a recognised GetPass pass. Point the camera at a pass QR code.');
      return;
    }

    scanHandled.current = true;
    navigation.navigate('EntryDetail', { entryId: payload.entry_id });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {permissionState === 'granted' ? (
        <View style={styles.cameraWrap}>
          <Camera
            style={styles.camera}
            cameraType={CameraType.Back}
            scanBarcode
            showFrame
            frameColor="#fff"
            laserColor="#e85d1f"
            allowedBarcodeTypes={['qr']}
            scanThrottleDelay={500}
            onReadCode={event => handleScan(event.nativeEvent.codeStringValue)}
            onError={event => setScanError(event.nativeEvent.errorMessage || 'The camera could not start.')}
          />
          <Text style={styles.hint}>Place the pass's QR code inside the frame.</Text>
        </View>
      ) : permissionState === 'checking' ? (
        <View style={styles.center}>
          <Text style={styles.message}>Checking camera access…</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.message}>
            Camera access is blocked or unavailable. Enable it in Settings to scan a pass.
          </Text>
        </View>
      )}

      {scanError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{scanError}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setScanError(null)}>
            <Text style={styles.errorDismiss}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1118' },
  cameraWrap: { flex: 1, justifyContent: 'flex-end' },
  camera: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  hint: { color: '#fff', fontSize: 12, textAlign: 'center', marginBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  message: { color: '#fff', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#fdeaea',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#a83227', fontSize: 12, lineHeight: 17 },
  errorDismiss: { color: '#a83227', fontSize: 12, fontWeight: '700', marginTop: 8 },
});
