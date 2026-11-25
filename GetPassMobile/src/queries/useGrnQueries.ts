import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveGrn, editGrnLines, getGrn, listStoreWork, retryGrnPost, startGrn } from '../api/grn';
import { ErpStatus, GrnLinesEdit, GrnStatus } from '../types/grn';
import { queryKeys } from '../api/queryKeys';

export function useGrnWorkList(status?: GrnStatus, erpStatus?: ErpStatus) {
  return useQuery({
    queryKey: [...queryKeys.grnWorkList(), status ?? null, erpStatus ?? null],
    queryFn: () => listStoreWork(status, erpStatus),
  });
}

export function useGrnDetail(entryId: number) {
  return useQuery({
    queryKey: queryKeys.grnDetail(entryId),
    queryFn: () => getGrn(entryId),
  });
}

export function useStartGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => startGrn(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.grnDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.grnWorkList() });
    },
  });
}

export function useEditGrnLines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, payload }: { entryId: number; payload: GrnLinesEdit }) => editGrnLines(entryId, payload),
    onSuccess: (_data, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grnDetail(entryId) });
    },
  });
}

export function useApproveGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => approveGrn(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grnDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.grnWorkList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.entryList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
    },
  });
}

export function useRetryGrnPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => retryGrnPost(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grnDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.grnWorkList() });
    },
  });
}
