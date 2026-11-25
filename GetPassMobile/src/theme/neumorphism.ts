import { Platform } from 'react-native';

export const background = '#e9edf4';
export const surface = '#e9edf4';
export const insetSurface = '#e3e9f1';
export const text = '#17202b';
export const subtext = '#526171';
export const accent = '#b8410e';

export const raisedSurface = {
  backgroundColor: surface,
  borderWidth: 1,
  borderColor: '#d8e0ea',
  borderTopColor: '#fff',
  borderLeftColor: '#fff',
  shadowColor: '#9aa7b8',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: Platform.OS === 'ios' ? 0.28 : 0.16,
  shadowRadius: 7,
  elevation: 3,
};

export const insetSurfaceStyle = {
  backgroundColor: insetSurface,
  borderWidth: 1,
  borderColor: '#d4dce7',
  borderTopColor: '#cbd4e0',
  borderLeftColor: '#cbd4e0',
  borderBottomColor: '#fff',
  borderRightColor: '#fff',
};
