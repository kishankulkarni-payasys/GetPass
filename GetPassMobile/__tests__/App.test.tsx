/**
 * @format
 */

jest.mock('react-native-camera-kit', () => ({
  Camera: () => null,
  CameraType: { Back: 'back', Front: 'front' },
}));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: { CAMERA: 'android.permission.CAMERA' },
    IOS: { CAMERA: 'ios.permission.CAMERA' },
  },
  RESULTS: {
    BLOCKED: 'blocked',
    DENIED: 'denied',
    GRANTED: 'granted',
    LIMITED: 'limited',
    UNAVAILABLE: 'unavailable',
  },
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
