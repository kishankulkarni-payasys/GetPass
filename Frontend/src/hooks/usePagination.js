import { useEffect, useMemo, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [10, 25, 50]
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]

// Client-side paging for a list already in memory.
// `resetKey` (e.g. the active filters or search text) sends the list back to page 1 when it
// changes; a plain refresh keeps the current page, pulled back if the list got shorter.
export function usePagination(items, { pageSize: initialPageSize = DEFAULT_PAGE_SIZE, resetKey } = {}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount)

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  const setPageSize = (size) => {
    setPageSizeState(size)
    setPage(1)
  }

  return {
    pageItems,
    page: currentPage,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : (currentPage - 1) * pageSize + 1,
    to: Math.min(currentPage * pageSize, total),
    setPage,
    setPageSize,
  }
}
