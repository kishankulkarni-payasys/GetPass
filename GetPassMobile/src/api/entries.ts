import apiClient from './client';
import {
  CancelRequest,
  EntryListFilters,
  ExitRequest,
  PassDetailOut,
  PhotoOut,
  VehicleEntryCreate,
  VehicleEntryOut,
} from '../types/entries';

export type EntryPhotoKind = 'plate' | 'po_doc' | 'challan_doc';
export type PhotoUploadKind = EntryPhotoKind | 'weigh_frame';

export interface PhotoUploadAsset {
  uri: string;
  name: string;
  type: string;
}

export async function createEntry(payload: VehicleEntryCreate): Promise<VehicleEntryOut> {
  const { data } = await apiClient.post<VehicleEntryOut>('/entries', payload);
  return data;
}

export async function uploadEntryPhoto(
  entryId: number,
  asset: PhotoUploadAsset,
  kind: PhotoUploadKind,
  weighmentId?: number,
): Promise<PhotoOut[]> {
  const formData = new FormData();
  formData.append('files', {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
  } as unknown as Blob);
  formData.append('kind', kind);
  if (weighmentId != null) formData.append('weighment_id', String(weighmentId));

  const { data } = await apiClient.post<PhotoOut[]>(`/entries/${entryId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listEntries(filters: EntryListFilters = {}): Promise<VehicleEntryOut[]> {
  const { data } = await apiClient.get<VehicleEntryOut[]>('/entries', { params: filters });
  return data;
}

export async function getEntry(entryId: number): Promise<PassDetailOut> {
  const { data } = await apiClient.get<PassDetailOut>(`/entries/${entryId}`);
  return data;
}

export async function gateOutEntry(entryId: number, payload: ExitRequest = {}): Promise<VehicleEntryOut> {
  const { data } = await apiClient.patch<VehicleEntryOut>(`/entries/${entryId}/exit`, payload);
  return data;
}

export async function cancelEntry(entryId: number, payload: CancelRequest): Promise<VehicleEntryOut> {
  const { data } = await apiClient.post<VehicleEntryOut>(`/entries/${entryId}/cancel`, payload);
  return data;
}
