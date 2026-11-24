import apiClient from './client';
import { DashboardSummary } from '../types/dashboard';

export async function getDashboardSummary(day?: string): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary', { params: { day } });
  return data;
}
