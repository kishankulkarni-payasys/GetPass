import { useMutation, useQueryClient } from '@tanstack/react-query';
import { captureWeighment, readIndicator } from '../api/weighments';
import { WeighmentCreate } from '../types/entries';
import { queryKeys } from '../api/queryKeys';

export function useCaptureWeighment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, payload }: { entryId: number; payload: WeighmentCreate }) =>
      captureWeighment(entryId, payload),
    onSuccess: (_data, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryDetail(entryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.entryList() });
    },
  });
}

/**
 * The indicator reading is triggered on demand by a button press and never cached or
 * re-read by anything else, so it is modelled as a mutation (a one-off side-effecting
 * call) rather than a query.
 */
export function useReadIndicator() {
  return useMutation({
    mutationFn: readIndicator,
  });
}
