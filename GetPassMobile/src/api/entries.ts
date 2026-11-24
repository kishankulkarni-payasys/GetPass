import apiClient from './client';
import {
  CancelRequest,
  EntryListFilters,
  ExitRequest,
  PassDetailOut,
  VehicleEntryCreate,
  VehicleEntryOut,
} from '../types/entries';

export async function createEntry(payload: VehicleEntryCreate): Promise<VehicleEntryOut> {
  const { data } = await apiClient.post<VehicleEntryOut>('/entries', payload);
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
