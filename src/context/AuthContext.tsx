import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { onSessionExpired, tokens } from '../api/client';
import { authApi, publicApi } from '../services';
import { apiErrorCode } from '../api/errors';
import type { UserResponse } from '../models';
import { bindPrefsToUser } from '../lib/prefs';

type Status = 'loading' | 'anon' | 'authed';

interface AuthValue {
  status: Status;
  user: UserResponse | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<UserResponse>;
  logout: () => Promise<void>;
  setUser: (u: UserResponse) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(tokens.access ? 'loading' : 'anon');
  const [user, setUserState] = useState<UserResponse | null>(null);

  const setUser = useCallback((u: UserResponse) => {
    setUserState(u);
    bindPrefsToUser(u.userId);
  }, []);

  const dropSession = useCallback(() => {
    tokens.clear();
    setUserState(null);
    bindPrefsToUser(null);
    setStatus('anon');
  }, []);

  // Count one visit per browser tab session, guests included.
  useEffect(() => {
    if (sessionStorage.getItem('visit_tracked')) return;
    sessionStorage.setItem('visit_tracked', '1');
    publicApi.trackVisit().catch(() => sessionStorage.removeItem('visit_tracked'));
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokens.access) return;
    authApi.me()
      .then(u => { setUser(u); setStatus('authed'); })
      .catch(err => {
        // Only a rejected token ends the session; a gateway that is still booting should not log anyone out.
        if (isAxiosError(err) && err.response && [401, 403].includes(err.response.status)) dropSession();
        else setStatus('anon');
      });
  }, [setUser, dropSession]);

  useEffect(() => onSessionExpired(dropSession), [dropSession]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      tokens.set(res.accessToken, res.refreshToken);
      setUser(res.user);
      setStatus('authed');
      // Re-track with the token so the visit is attributed to this user instead of a guest.
      publicApi.trackVisit().catch(() => {});
      return res.user;
    } catch (err) {
      if (apiErrorCode(err) === 'AUTH_1006') throw new Error('This account has been deactivated by an administrator.');
      if (isAxiosError(err) && !err.response) throw new Error('Cannot reach the server. Check that the API gateway is running.');
      throw new Error('Wrong email or password. Please check and try again.');
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    const refresh = tokens.refresh;
    try { if (refresh) await authApi.logout(refresh); } catch { /* the local session ends either way */ }
    dropSession();
  }, [dropSession]);

  const value = useMemo<AuthValue>(() => ({
    status, user, isAdmin: user?.role === 'ADMIN', login, logout, setUser,
  }), [status, user, login, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
