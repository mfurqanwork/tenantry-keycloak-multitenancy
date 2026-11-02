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

  it('sends a JSON body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(201, { id: '1' }));
    await createApi(() => Promise.resolve('tok'), fetchFn).post('/api/projects', { name: 'Apollo' });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"Apollo"}');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
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

  it('returns nothing for 204', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      createApi(() => Promise.resolve('tok'), fetchFn).del('/api/members/1'),
    ).resolves.toBeUndefined();
  });
});
