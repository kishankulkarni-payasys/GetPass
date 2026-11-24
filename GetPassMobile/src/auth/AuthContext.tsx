import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, logout as logoutRequest } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { clearToken, getStoredUser, getToken, saveStoredUser, saveToken } from './tokenStorage';
import { AuthUser } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On launch, restore whatever session was last persisted so the user isn't
  // dropped back to the login screen on every app restart.
  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([getToken(), getStoredUser<AuthUser>()]);
        if (token && storedUser) {
          setUser(storedUser);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const response = await loginRequest(username, password);
    const { access_token: token, ...authUser } = response;
    await saveToken(token);
    await saveStoredUser(authUser);
    setUser(authUser);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Best-effort: the local session still ends even if the network call fails.
    } finally {
      await clearToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, isLoading, signIn, signOut }), [user, isLoading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
