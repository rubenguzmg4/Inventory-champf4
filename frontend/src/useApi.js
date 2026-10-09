import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/**
 * Carga datos del API y los vuelve a cargar cuando cambian la ruta o los parámetros.
 *   const { data, loading, error, reload } = useApi('/products', { search });
 * Si `path` es null no se hace la petición.
 */
export function useApi(path, params) {
  const key = path ? `${path}?${JSON.stringify(params ?? {})}` : null;
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { params })
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState((s) => ({ data: s.data, loading: false, error })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
