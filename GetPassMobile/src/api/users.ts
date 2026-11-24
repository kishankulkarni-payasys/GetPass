import apiClient from './client';
import { UserCreate, UserOut, UserUpdate } from '../types/users';

export async function listUsers(): Promise<UserOut[]> {
  const { data } = await apiClient.get<UserOut[]>('/users');
  return data;
}

export async function createUser(payload: UserCreate): Promise<UserOut> {
  const { data } = await apiClient.post<UserOut>('/users', payload);
  return data;
}

export async function updateUser(userId: number, payload: UserUpdate): Promise<UserOut> {
  const { data } = await apiClient.patch<UserOut>(`/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}
