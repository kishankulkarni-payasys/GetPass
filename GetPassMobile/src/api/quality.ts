import apiClient from './client';
import { VehicleEntryOut } from '../types/entries';
import { QualityQueueItem, QualityResultIn, QualityResultSaved } from '../types/quality';

export async function sendToQuality(entryId: number): Promise<VehicleEntryOut> {
  const { data } = await apiClient.post<VehicleEntryOut>(`/entries/${entryId}/send-to-quality`);
  return data;
}

export async function getQualityQueue(): Promise<QualityQueueItem[]> {
  const { data } = await apiClient.get<QualityQueueItem[]>('/quality/queue');
  return data;
}

export async function putQualityResult(entryId: number, payload: QualityResultIn): Promise<QualityResultSaved> {
  const { data } = await apiClient.put<QualityResultSaved>(`/entries/${entryId}/quality-result`, payload);
  return data;
}
