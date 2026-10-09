import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api';
import { useSettings } from './SettingsContext';

const AuthContext = createContext(null);

/**
 * Estado de la sesión:
 *  - loading: comprobando · setup: falta crear el primer administrador
 *  - anonymous: hay que iniciar sesión · authenticated: listo · offline: sin servidor
 */
export function AuthProvider({ children }) {
  const { loadFull } = useSettings();
  const [state, setState] = useState({ status: 'loading', user: null });

  const logout = useCallback(() => {
    setToken(null);
    setState({ status: 'anonymous', user: null });
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const check = useCallback(async () => {
    setState({ status: 'loading', user: null });
    try {
      const { needs_setup: needsSetup } = await api.get('/setup');
      if (needsSetup) return setState({ status: 'setup', user: null });
      if (!getToken()) return setState({ status: 'anonymous', user: null });
      const user = await api.get('/me');
      await loadFull();
      return setState({ status: 'authenticated', user });
    } catch (error) {
      if (error.status === 0 || error.status >= 500) return setState({ status: 'offline', user: null });
      setToken(null);
      return setState({ status: 'anonymous', user: null });
    }
  }, [loadFull]);

  useEffect(() => {
    check();
  }, [check]);

  const startSession = useCallback(
    async ({ access_token: accessToken, user }) => {
      setToken(accessToken);
      await loadFull();
      setState({ status: 'authenticated', user });
    },
    [loadFull],
  );

  const value = useMemo(
    () => ({
      ...state,
      isAdmin: state.user?.role === 'admin',
      login: async (username, password) =>
        startSession(await api('/login', { method: 'POST', form: { username, password } })),
      setup: async (data) => startSession(await api.post('/setup', data)),
      logout,
      retry: check,
    }),
    [state, startSession, logout, check],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
