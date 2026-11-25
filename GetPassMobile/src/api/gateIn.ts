import apiClient from './client';
import { PhotoUploadAsset } from './entries';
import { GateInConfigOut, OcrResultOut } from '../types/gateIn';

export const OCR_DOC_TYPES = {
  plate: 'plate',
  po: 'po',
  challan: 'challan',
} as const;

// The guard must not wait indefinitely for a slow/unreachable OCR service;
// the photo tile falls back to manual entry once this elapses (spec 8.1).
export const OCR_TIMEOUT_MS = 15000;

export async function getGateInConfig(): Promise<GateInConfigOut> {
  const { data } = await apiClient.get<GateInConfigOut>('/gate-in/config');
  return data;
}

/** Stateless OCR: the image is not stored here, only read for field values. */
export async function readDocument(
  asset: PhotoUploadAsset,
  docType: string,
  signal?: AbortSignal,
): Promise<OcrResultOut> {
  const formData = new FormData();
  formData.append('image', {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
  } as unknown as Blob);
  formData.append('doc_type', docType);

  const { data } = await apiClient.post<OcrResultOut>('/gate-in/ocr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: OCR_TIMEOUT_MS,
    signal,
  });
  return data;
}
