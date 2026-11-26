// Mirrors Backend/app/schemas.py's UserCreate/UserUpdate/UserOut.
import { UserRole } from './auth';

export interface UserCreate {
  username: string;
  password: string;
  full_name: string;
  role: UserRole;
}

export interface UserUpdate {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
  email?: string | null;
  contact_no?: string | null;
}

export interface UserOut {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  email?: string | null;
  contact_no?: string | null;
}
