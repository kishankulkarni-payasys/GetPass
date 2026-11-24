import apiClient from './client';
import { ErpStatus, GrnLinesEdit, GrnOut, GrnStatus, GrnWorkItem } from '../types/grn';

export async function startGrn(entryId: number): Promise<GrnOut> {
  const { data } = await apiClient.post<GrnOut>(`/entries/${entryId}/grn`);
  return data;
}

export async function listStoreWork(status?: GrnStatus, erpStatus?: ErpStatus): Promise<GrnWorkItem[]> {
  const { data } = await apiClient.get<GrnWorkItem[]>('/grn', { params: { status, erp_status: erpStatus } });
  return data;
}

export async function getGrn(entryId: number): Promise<GrnOut> {
  const { data } = await apiClient.get<GrnOut>(`/entries/${entryId}/grn`);
  return data;
}

export async function editGrnLines(entryId: number, payload: GrnLinesEdit): Promise<GrnOut> {
  const { data } = await apiClient.patch<GrnOut>(`/entries/${entryId}/grn/lines`, payload);
  return data;
}

export async function approveGrn(entryId: number): Promise<GrnOut> {
  const { data } = await apiClient.post<GrnOut>(`/entries/${entryId}/grn/approve`);
  return data;
}

export async function retryGrnPost(entryId: number): Promise<GrnOut> {
  const { data } = await apiClient.post<GrnOut>(`/entries/${entryId}/grn/retry-post`);
  return data;
}
