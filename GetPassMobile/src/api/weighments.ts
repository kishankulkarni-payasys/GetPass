import apiClient from './client';
import { VehicleEntryOut, WeighmentCreate, WeighmentOut } from '../types/entries';

export interface IndicatorReadingOut {
  available: boolean;
  weight_kg?: number | null;
  stable?: boolean | null;
  frame_ref?: string | null;
  read_at?: string | null;
}

export async function readIndicator(): Promise<IndicatorReadingOut> {
  const { data } = await apiClient.get<IndicatorReadingOut>('/weighbridge/reading');
  return data;
}

export async function captureWeighment(entryId: number, payload: WeighmentCreate): Promise<WeighmentOut> {
  const { data } = await apiClient.post<WeighmentOut>(`/entries/${entryId}/weighments`, payload);
  return data;
}

/** Legacy compatibility path kept by the backend for a single manual gross weight. */
export async function recordLegacyWeight(
  entryId: number,
  grossWeight: number,
  weightUnit?: 'kg' | 'ton',
): Promise<VehicleEntryOut> {
  const { data } = await apiClient.patch<VehicleEntryOut>(`/entries/${entryId}/weight`, {
    gross_weight: grossWeight,
    weight_unit: weightUnit,
  });
  return data;
}
