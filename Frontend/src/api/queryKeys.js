// Central query key factory, one per API domain, so invalidation after a
// mutation (and the keys a useQuery reads) always agree on the same shape.

export const entryKeys = {
  all: ['entries'],
  lists: () => [...entryKeys.all, 'list'],
  list: (filters) => [...entryKeys.lists(), filters],
  groups: (groupFilters) => [...entryKeys.all, 'groups', groupFilters],
  detail: (id) => [...entryKeys.all, 'detail', String(id)],
}

export const gateInKeys = {
  all: ['gateIn'],
  config: () => [...gateInKeys.all, 'config'],
  poLookup: (poNumber) => [...gateInKeys.all, 'po', poNumber],
  poSearch: (supplier) => [...gateInKeys.all, 'poSearch', supplier],
  openPass: (plate) => [...gateInKeys.all, 'openPass', plate],
}

export const gateOutKeys = {
  all: ['gateOut'],
  exitDetails: (entryId) => [...gateOutKeys.all, 'exitDetails', String(entryId)],
  returnPass: (entryId) => [...gateOutKeys.all, 'returnPass', String(entryId)],
}

export const grnKeys = {
  all: ['grn'],
  list: (filters = {}) => [...grnKeys.all, 'list', filters],
  detail: (entryId) => [...grnKeys.all, 'detail', String(entryId)],
}

export const qualityKeys = {
  all: ['quality'],
  queue: () => [...qualityKeys.all, 'queue'],
}

export const userKeys = {
  all: ['users'],
  list: () => [...userKeys.all, 'list'],
}

export const weighmentKeys = {
  all: ['weighments'],
  indicatorReading: () => [...weighmentKeys.all, 'indicatorReading'],
}

export const dashboardKeys = {
  all: ['dashboard'],
  summary: (day) => [...dashboardKeys.all, 'summary', day ?? 'today'],
}
