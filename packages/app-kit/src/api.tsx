import { createContext, useContext, type ReactNode } from 'react';

// An API error as the user should read it: the problem document's title and detail.
// `extras` are the problem type's own members, such as a suggested value.
export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly extras: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = 'ApiProblem';
  }
}

export interface Api {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
  del: (path: string) => Promise<void>;
  // multipart/form-data with one file under `field`; the browser sets the boundary.
  upload: <T>(path: string, field: string, file: Blob) => Promise<T>;
}

// Same-origin calls to /api with the current access token. Every failure becomes an ApiProblem.
export function createApi(getToken: () => Promise<string | null>, fetchFn: typeof fetch = fetch): Api {
  async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = new Headers({ accept: 'application/json' });
    const token = await getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    const form = body instanceof FormData;
    if (body !== undefined && !form) headers.set('content-type', 'application/json');
    const res = await fetchFn(path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
    });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw await toProblem(res);
    return (await res.json()) as T;
  }
  return {
    get: (path) => send('GET', path),
    post: (path, body) => send('POST', path, body),
    put: (path, body) => send('PUT', path, body),
    patch: (path, body) => send('PATCH', path, body),
    del: (path) => send('DELETE', path),
    upload: (path, field, file) => {
      const form = new FormData();
      form.append(field, file);
      return send('POST', path, form);
    },
  };
}

async function toProblem(res: Response): Promise<ApiProblem> {
  const fallback = new ApiProblem(res.status, res.statusText || 'Error', 'Something went wrong. Try again.');
  if (!res.headers.get('content-type')?.includes('json')) return fallback;
  try {
    const extras = (await res.json()) as Record<string, unknown>;
    const { title, detail } = extras;
    for (const key of ['type', 'title', 'status', 'detail']) Reflect.deleteProperty(extras, key);
    return new ApiProblem(
      res.status,
      typeof title === 'string' ? title : fallback.title,
      typeof detail === 'string' ? detail : fallback.detail,
      extras,
    );
  } catch {
    return fallback;
  }
}

const ApiContext = createContext<Api | null>(null);

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
