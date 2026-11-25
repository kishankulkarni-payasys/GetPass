import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelEntry,
  createEntry,
  EntryPhotoKind,
  gateOutEntry,
  getEntry,
  listEntries,
  PhotoUploadAsset,
  uploadEntryPhoto,
} from '../api/entries';
import { CancelRequest, ExitRequest, VehicleEntryCreate } from '../types/entries';
import { queryKeys } from '../api/queryKeys';

/**
 * All screens list the same unfiltered set (`listEntries({})`) and filter client-side, so they
 * share one cache entry under `queryKeys.entryList()`.
 */
export function useEntryList() {
  return useQuery({
    queryKey: queryKeys.entryList(),
    queryFn: () => listEntries({}),
  });
}

export function useEntryDetail(entryId: number) {
  return useQuery({
    queryKey: queryKeys.entryDetail(entryId),
    queryFn: () => getEntry(entryId),
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehicleEntryCreate) => createEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryList() });
    },
  });
}

export function useUploadEntryPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, asset, kind }: { entryId: number; asset: PhotoUploadAsset; kind: EntryPhotoKind }) =>
      uploadEntryPhoto(entryId, asset, kind),
    onSuccess: (_data, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
    },
  });
}

export function useGateOutEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, payload }: { entryId: number; payload?: ExitRequest }) =>
      gateOutEntry(entryId, payload),
    onSuccess: (_data, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
    },
  });
}

export function useCancelEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, payload }: { entryId: number; payload: CancelRequest }) =>
      cancelEntry(entryId, payload),
    onSuccess: (_data, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
    },
  });
}
