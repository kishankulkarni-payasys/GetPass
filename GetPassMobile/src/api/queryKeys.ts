/** Central query key factory so invalidation call sites don't hand-roll matching keys. */
export const queryKeys = {
  dashboardSummary: (day: string) => ['dashboard', 'summary', day] as const,

  entryList: () => ['entries', 'list'] as const,
  entryDetail: (entryId: number) => ['entries', 'detail', entryId] as const,

  grnWorkList: () => ['grn', 'workList'] as const,
  grnDetail: (entryId: number) => ['grn', 'detail', entryId] as const,

  qualityQueue: () => ['quality', 'queue'] as const,

  userList: () => ['users', 'list'] as const,
};
