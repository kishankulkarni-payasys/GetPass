import apiClient from './client';
import { PhotoUploadAsset } from './entries';
import { DocScanOut, DocScanSaveIn, DocScanSavedOut } from '../types/docScan';

/** PDF scan: OCR + regex field extraction, field name `file` (matches Backend/app/routers/doc_scan.py). */
export async function scanPdf(file: PhotoUploadAsset, signal?: AbortSignal): Promise<DocScanOut> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const { data } = await apiClient.post<DocScanOut>('/doc-scan/pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
  });
  return data;
}

/** Photo scan: 1-10 images under the repeated field `files` (matches entries.ts's uploadEntryPhoto pattern). */
export async function scanPhotos(assets: PhotoUploadAsset[], signal?: AbortSignal): Promise<DocScanOut> {
  const formData = new FormData();
  for (const asset of assets) {
    formData.append('files', {
      uri: asset.uri,
      name: asset.name,
      type: asset.type,
    } as unknown as Blob);
  }

  const { data } = await apiClient.post<DocScanOut>('/doc-scan/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
  });
  return data;
}

export async function saveDocScan(body: DocScanSaveIn): Promise<DocScanSavedOut> {
  const { data } = await apiClient.post<DocScanSavedOut>('/doc-scan/save', body);
  return data;
}
