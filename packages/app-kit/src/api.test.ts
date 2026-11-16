import { describe, expect, it, vi } from 'vitest';
import { ApiProblem, createApi } from './api.js';

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });

describe('createApi', () => {
  it('sends the access token and parses JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { ok: true }));
    const api = createApi(() => Promise.resolve('tok'), fetchFn);
    await expect(api.get('/api/me')).resolves.toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/me');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });

  it('turns a problem response into an ApiProblem with its detail', async () => {
    const problem = { type: 'x', title: 'Conflict', status: 409, detail: 'That address is taken.' };
    const fetchFn = vi.fn().mockResolvedValue(json(409, problem, 'application/problem+json'));
    const error = await createApi(() => Promise.resolve('tok'), fetchFn)
      .post('/api/signup', {})
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiProblem);
    expect(error).toMatchObject({ status: 409, title: 'Conflict', detail: 'That address is taken.' });
  });

  it('still gives an ApiProblem when the error body is not a problem document', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    const error = await createApi(() => Promise.resolve(null), fetchFn)
      .get('/api/x')
      .catch((err: unknown) => err);
    expect(error).toMatchObject({ status: 502 });
  });

  it('uploads a file as multipart form data, without setting the content type itself', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(201, {}));
    const file = new File([new Uint8Array([1, 2])], 'logo.png', { type: 'image/png' });
    await createApi(() => Promise.resolve('tok'), fetchFn).upload('/api/branding/logo', 'file', file);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(new Headers(init.headers).get('content-type')).toBeNull();
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });
});
