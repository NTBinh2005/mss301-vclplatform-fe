import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { onSessionExpired, tokens } from '../api/client';
import { authApi, publicApi, userApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { UserResponse } from '../models';
import { bindPrefsToUser } from '../lib/prefs';

type Status = 'loading' | 'anon' | 'authed';

interface AuthValue {
  status: Status;
  user: UserResponse | null;
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<UserResponse>;
  logout: () => Promise<void>;
  setUser: (u: UserResponse) => void;
  dropSession: () => void;
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

  // Restore the session from a stored token. An expired access token is refreshed
  // by the client interceptor before this fails.
  useEffect(() => {
    if (!tokens.access) return;
    userApi.me()
      .then(u => { setUser(u); setStatus('authed'); })
      .catch(err => {
        // Only a rejected token ends the session; a gateway that is still booting should not log anyone out.
        if (isAxiosError(err) && err.response && [401, 403].includes(err.response.status)) dropSession();
        else setStatus('anon');
      });
  }, [setUser, dropSession]);

  useEffect(() => onSessionExpired(dropSession), [dropSession]);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const res = await authApi.login(identifier, password);
      tokens.set(res.accessToken, res.refreshToken);
      // The token response has no profile (name, avatar...), so fetch it.
      const me = await userApi.me();
      setUser(me);
      setStatus('authed');
      // Re-track with the token so the visit is attributed to this user instead of a guest.
      publicApi.trackVisit().catch(() => {});
      return me;
    } catch (err) {
      tokens.clear();
      if (isAxiosError(err) && !err.response) throw new Error('Cannot reach the server. Check that the API gateway is running.');
      // 403 = locked account; identity explains why in the message.
      if (isAxiosError(err) && err.response?.status === 403) throw new Error(apiErrorMessage(err, 'This account has been locked by an administrator.'));
      throw new Error('Wrong username/email or password. Please check and try again.');
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    const refresh = tokens.refresh;
    try { if (refresh) await authApi.logout(refresh); } catch { /* the local session ends either way */ }
    dropSession();
  }, [dropSession]);

  const value = useMemo<AuthValue>(() => ({
    status, user, isAdmin: user?.role === 'ADMIN', login, logout, setUser, dropSession,
  }), [status, user, login, logout, setUser, dropSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
