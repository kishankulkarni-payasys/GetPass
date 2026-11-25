import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveGrn, editGrnLines, getGrn, getStoreWorkList, retryGrnPost } from '../api/grn'
import { getEntry } from '../api/entries'
import { entryKeys, grnKeys } from '../api/queryKeys'
import { apiErrorDetail } from '../i18n/apiErrors'

// Store work list (GET /grn): send for inspection, ready for GRN, drafts, pending ERP post.
export function useStoreWorkList() {
  const query = useQuery({
    queryKey: grnKeys.list(),
    queryFn: () => getStoreWorkList(),
  })

  return {
    items: query.data ?? [],
    loading: query.isFetching,
    failed: query.isError,
    errorDetail: query.isError ? apiErrorDetail(query.error) : null,
    refresh: query.refetch,
  }
}

// One GRN plus its pass (for PO, challan and gross weight in the header).
// Actions return the updated GRN and throw API errors for the screen to show.
export function useGrnRecord(entryId) {
  const queryClient = useQueryClient()
  const [grnQuery, passQuery] = useQueries({
    queries: [
      { queryKey: grnKeys.detail(entryId), queryFn: () => getGrn(entryId) },
      { queryKey: entryKeys.detail(entryId), queryFn: () => getEntry(entryId) },
    ],
  })

  const loading = grnQuery.isLoading || passQuery.isLoading
  const failed = grnQuery.isError || passQuery.isError
  const errorDetail = failed ? apiErrorDetail(grnQuery.error ?? passQuery.error) : null

  const reload = () => Promise.all([grnQuery.refetch(), passQuery.refetch()])

  // Shared by all three actions: write the updated GRN straight into the
  // cache (so the editor shows it at once) and mark the work list stale,
  // since approve/retry/save-lines each change which group this entry sits in.
  const onActionSuccess = (updated) => {
    queryClient.setQueryData(grnKeys.detail(entryId), updated)
    queryClient.invalidateQueries({ queryKey: grnKeys.list() })
  }

  const saveLinesMutation = useMutation({
    mutationFn: (lines) => editGrnLines(entryId, lines),
    onSuccess: onActionSuccess,
  })
  const approveMutation = useMutation({
    mutationFn: () => approveGrn(entryId),
    onSuccess: onActionSuccess,
  })
  const retryPostMutation = useMutation({
    mutationFn: () => retryGrnPost(entryId),
    onSuccess: onActionSuccess,
  })

  return {
    grn: grnQuery.data ?? null,
    pass: passQuery.data ?? null,
    loading,
    failed,
    errorDetail,
    reload,
    saveLines: (lines) => saveLinesMutation.mutateAsync(lines),
    approve: () => approveMutation.mutateAsync(),
    retryPost: () => retryPostMutation.mutateAsync(),
  }
}
