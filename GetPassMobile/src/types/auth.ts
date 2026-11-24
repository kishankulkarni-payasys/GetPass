// Mirrors Backend/app/schemas.py (UserOut) and the extra `access_token` field
// that Backend/app/routers/auth.py's /api/auth/login response adds on top of it.
export type UserRole =
  | 'admin'
  | 'security_guard'
  | 'weighbridge_operator'
  | 'store_incharge'
  | 'quality_inspector'
  | 'site_supervisor';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse extends AuthUser {
  access_token: string;
}
