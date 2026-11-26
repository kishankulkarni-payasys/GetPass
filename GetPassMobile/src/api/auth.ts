import apiClient from './client';
import { LoginResponse, AuthUser } from '../types/auth';

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { username, password });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

// Always returns 200 with a generic message, even if the account doesn't exist
// (see Backend/app/routers/auth.py's FORGOT_PASSWORD_ACK) — the UI shows its own
// localized copy instead of the raw `detail` text, so never branch on it here.
export async function forgotPassword(identifier: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { identifier });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { token, password });
}
