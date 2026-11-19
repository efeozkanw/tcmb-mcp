import { describe, expect, it } from 'vitest';
import { TcmbClient } from '../src/tcmb/client.js';
import { TcmbError, UpstreamError } from '../src/tcmb/errors.js';
import { fakeTcmb, fixture, istanbulTime } from './helpers/fake-tcmb.js';

const THURSDAY_AFTERNOON = istanbulTime('2026-11-19T16:00');

function setup(options: Parameters<typeof fakeTcmb>[0], now = THURSDAY_AFTERNOON) {
  const tcmb = fakeTcmb(options);
  const client = new TcmbClient({ fetch: tcmb.fetch, now, retries: 0 });
  return { client, requests: tcmb.requests };
}

describe('TcmbClient', () => {
  it('serves the latest bulletin from today.xml and caches it', async () => {
    const { client, requests } = setup({ latest: '2026-11-19', published: [] });

    const first = await client.resolve();
    await client.resolve();

    expect(first.bulletin.date).toBe('2026-11-19');
    expect(first.fallbackReason).toBeNull();
    expect(requests).toEqual(['today.xml']);
  });

  it('falls back to Friday for a weekend date without requesting weekend files', async () => {
    const { client, requests } = setup({ latest: '2026-11-19', published: ['2026-11-13'] });

    const resolved = await client.resolve('2026-11-15');

    expect(resolved.bulletin.date).toBe('2026-11-13');
    expect(resolved.fallbackReason).toBe('weekend');
    expect(requests).toEqual(['today.xml', '202611/13112026.xml']);
  });

  it('walks back over holidays and half days', async () => {
    const { client } = setup({ latest: '2026-11-19', published: ['2026-10-27', '2026-10-30'] });

    const resolved = await client.resolve('2026-10-29');

    expect(resolved.bulletin.date).toBe('2026-10-27');
    expect(resolved.fallbackReason).toBe('holiday');
  });

  it('reports today as not published yet before 15:30', async () => {
    const { client, requests } = setup(
      { latest: '2026-11-18', published: [] },
      istanbulTime('2026-11-19T10:15'),
    );

    const resolved = await client.resolve('2026-11-19');

    expect(resolved.bulletin.date).toBe('2026-11-18');
    expect(resolved.fallbackReason).toBe('not_published_yet');
    expect(requests).toEqual(['today.xml']);
  });

  it('uses the last bulletin strictly before a date for invoices', async () => {
    const { client } = setup({ latest: '2026-11-19', published: ['2026-11-13', '2026-11-18'] });

    expect((await client.resolveBefore('2026-11-16')).date).toBe('2026-11-13');
    expect((await client.resolveBefore('2026-11-19')).date).toBe('2026-11-18');
  });

  it('rejects malformed, too early and future dates', async () => {
    const { client } = setup({ latest: '2026-11-19', published: [] });

    await expect(client.resolve('19.11.2026')).rejects.toThrow(/YYYY-MM-DD/);
    await expect(client.resolve('2026-02-30')).rejects.toThrow(TcmbError);
    await expect(client.resolve('1996-04-15')).rejects.toThrow(/start on 1996-04-16/);
    await expect(client.resolve('2026-11-20')).rejects.toThrow(/in the future/);
  });

  it('remembers past dates without a bulletin', async () => {
    const { client, requests } = setup({ latest: '2026-11-19', published: [] });

    expect(await client.bulletinOn('2026-10-29')).toBeNull();
    expect(await client.bulletinOn('2026-10-29')).toBeNull();
    expect(requests).toEqual(['202610/29102026.xml']);
  });

  it('retries server errors and then succeeds', async () => {
    let calls = 0;
    const client = new TcmbClient({
      now: THURSDAY_AFTERNOON,
      retries: 2,
      fetch: async () => {
        calls++;
        return calls < 2
          ? new Response('busy', { status: 503 })
          : new Response(new Uint8Array(fixture('2026-11-19.xml')));
      },
    });

    expect((await client.latest()).date).toBe('2026-11-19');
    expect(calls).toBe(2);
  });

  it('gives up with a readable error when TCMB does not answer', async () => {
    const client = new TcmbClient({
      now: THURSDAY_AFTERNOON,
      retries: 0,
      timeoutMs: 20,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });

    await expect(client.latest()).rejects.toThrow(UpstreamError);
    await expect(client.latest()).rejects.toThrow(/timed out/);
  });
});
