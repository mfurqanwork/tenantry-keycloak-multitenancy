import { useCallback, useEffect, useState } from 'react';
import { useApi } from './api.js';

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  reload: () => void;
}

// GET a path once, and again on reload(). A newer response always wins over an older one.
export function useResource<T>(path: string): Resource<T> {
  const api = useApi();
  const [state, setState] = useState<{ data: T | undefined; error: unknown }>({
    data: undefined,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    api.get<T>(path).then(
      (data) => {
        if (current) setState({ data, error: null });
      },
      (error: unknown) => {
        if (current) setState((s) => ({ data: s.data, error }));
      },
    );
    return () => {
      current = false;
    };
  }, [api, path, version]);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);
  return { ...state, reload };
}
