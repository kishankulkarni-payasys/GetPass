import { UserRole } from '../types/auth';

/**
 * What each role can see on the home shell. Mirrors the allow-lists in
 * Backend/app/auth.py (GATE_IN_ROLES, GATE_OUT_ROLES, WEIGH_ROLES, STORE_ROLES,
 * QUALITY_ROLES, DASHBOARD_ROLES) so the mobile shell doesn't invent new rules —
 * it just reflects what the backend already enforces.
 */
export interface RoleAction {
  key: string;
  label: string;
}

const ALL_ACTIONS: Record<string, RoleAction> = {
  gateIn: { key: 'gateIn', label: 'Gate In' },
  gateOut: { key: 'gateOut', label: 'Gate Out' },
  weighbridge: { key: 'weighbridge', label: 'Weighbridge' },
  quality: { key: 'quality', label: 'Quality' },
  stores: { key: 'stores', label: 'Stores / GRN' },
  dashboard: { key: 'dashboard', label: 'Dashboard' },
  users: { key: 'users', label: 'Users' },
};

const ACTIONS_BY_ROLE: Record<UserRole, RoleAction[]> = {
  admin: [
    ALL_ACTIONS.gateIn,
    ALL_ACTIONS.gateOut,
    ALL_ACTIONS.weighbridge,
    ALL_ACTIONS.quality,
    ALL_ACTIONS.stores,
    ALL_ACTIONS.dashboard,
    ALL_ACTIONS.users,
  ],
  security_guard: [ALL_ACTIONS.gateIn, ALL_ACTIONS.gateOut],
  weighbridge_operator: [ALL_ACTIONS.weighbridge],
  store_incharge: [ALL_ACTIONS.stores, ALL_ACTIONS.dashboard],
  quality_inspector: [ALL_ACTIONS.quality],
  site_supervisor: [ALL_ACTIONS.dashboard],
};

export function getActionsForRole(role: UserRole): RoleAction[] {
  return ACTIONS_BY_ROLE[role] ?? [];
}
