import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getQualityQueue, putQualityResult, sendToQuality } from '../api/quality';
import { QualityResultIn } from '../types/quality';
import { queryKeys } from '../api/queryKeys';

export function useQualityQueue() {
  return useQuery({
    queryKey: queryKeys.qualityQueue(),
    queryFn: getQualityQueue,
  });
}

export function useSendToQuality() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => sendToQuality(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.qualityQueue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.grnWorkList() });
    },
  });
}

export function usePutQualityResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, payload }: { entryId: number; payload: QualityResultIn }) =>
      putQualityResult(entryId, payload),
    onSuccess: (_data, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qualityQueue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.grnWorkList() });
    },
  });
}
